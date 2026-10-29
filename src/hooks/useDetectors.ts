// 双模型推理管线。对应 SPEC §5：video → 视频坐标 → 容器坐标 → EMA → metrics。
//
// - 检测框 10fps 驱动管线、关键点 5fps 只刷新 PoseState；
// - 采样时钟 dt 用 performance.now() 增量并夹到 SAMPLE_CLOCK_CAP_MS；
// - hasPerson 带 300ms 掉帧容错；
// - rAF + 时间戳节流（禁止 setInterval）；卸载时断开 rAF 并 close 两个模型。

import { useEffect, useRef, useState, type RefObject } from 'react';
import { FilesetResolver, ObjectDetector, PoseLandmarker } from '@mediapipe/tasks-vision';
import {
  BRIGHTNESS_SAMPLE_MS,
  BRIGHTNESS_SAMPLE_SIZE,
  DETECT_CONFIDENCE_MIN,
  DETECT_INTERVAL_MS,
  EMA_ALPHA,
  HAS_PERSON_LOST_MS,
  MAX_INFERENCE_FAILURES,
  MODEL_INIT_TIMEOUT_MS,
  POSE_INTERVAL_MS,
  POSE_MIN_PRESENCE,
  SAMPLE_CLOCK_CAP_MS,
  TRACK_LOST_MS,
} from '../constants';
import { averageLuma } from '../core/brightness';
import { videoBoxToContainer, videoPointToContainer } from '../core/coordinate';
import { computeMetrics } from '../core/metrics';
import { emaBox, emaPoint } from '../core/smoothing';
import { selectBox, selectPose, type BoxCandidate, type PoseCandidate } from '../core/tracking';
import type {
  Box,
  DetectionState,
  Point,
  PoseState,
  ProfileConfig,
  SubjectMetrics,
} from '../types';

type Lm = { x: number; y: number; visibility?: number; presence?: number };

const EMPTY_DET: DetectionState = { hasPerson: false, box: null, confidence: 0, timestamp: 0 };
const EMPTY_POSE: PoseState = {
  hasPerson: false,
  hasShoulders: false,
  shoulderL: null,
  shoulderR: null,
  nose: null,
  timestamp: 0,
};

export interface DetectorsResult {
  status: 'loading' | 'ready' | 'failed';
  failure: 'init' | 'runtime' | null;
  /** 姿态模型是否可用（检测框可用但姿态不可用时，SPEC §11 第 6 步要求判断档案） */
  poseAvailable: boolean;
  detectionFps: number;
  det: DetectionState;
  pose: PoseState;
  metrics: SubjectMetrics | null;
  dt: number;
}

export function useDetectors(
  videoRef: RefObject<HTMLVideoElement | null>,
  profile: ProfileConfig,
  rollDeg: number,
): DetectorsResult {
  const [result, setResult] = useState<DetectorsResult>({
    status: 'loading',
    failure: null,
    poseAvailable: false,
    detectionFps: 0,
    det: EMPTY_DET,
    pose: EMPTY_POSE,
    metrics: null,
    dt: 0,
  });

  const profileRef = useRef(profile);
  profileRef.current = profile;
  const rollRef = useRef(rollDeg);
  rollRef.current = rollDeg;

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    const video: HTMLVideoElement = videoEl;

    let cancelled = false;
    let timedOut = false;
    let raf = 0;

    // 用对象持有模型句柄：赋值发生在 initModels 内部，直接 let 变量会被
    // 控制流分析判成 never。
    const models: { detector: ObjectDetector | null; pose: PoseLandmarker | null } = {
      detector: null,
      pose: null,
    };

    let lastDetectAt = 0;
    let lastPoseAt = 0;
    let lastSampleAt = performance.now();
    let lastHitAt = Number.NEGATIVE_INFINITY;
    let lastTargetAt = Number.NEGATIVE_INFINITY;
    let errors = 0;
    let fpsMark = performance.now();
    let fpsCount = 0;
    let detectionFps = 0;

    let smoothBox: Box | null = null;
    let smoothL: Point | null = null;
    let smoothR: Point | null = null;
    let smoothNose: Point | null = null;
    let targetX: number | null = null;
    let lastConfidence = 0;

    // 亮度：首帧前保持中性值，避免误判 dark；采样失败时保留上一次值
    let brightness = 128;
    let lastBrightnessAt = Number.NEGATIVE_INFINITY;
    let bCanvas: HTMLCanvasElement | null = null;
    let bCtx: CanvasRenderingContext2D | null = null;

    function sampleBrightness() {
      try {
        if (!bCanvas) {
          bCanvas = document.createElement('canvas');
          bCanvas.width = BRIGHTNESS_SAMPLE_SIZE;
          bCanvas.height = BRIGHTNESS_SAMPLE_SIZE;
          bCtx = bCanvas.getContext('2d', { willReadFrequently: true });
        }
        if (!bCtx) return;
        bCtx.drawImage(video, 0, 0, BRIGHTNESS_SAMPLE_SIZE, BRIGHTNESS_SAMPLE_SIZE);
        const img = bCtx.getImageData(0, 0, BRIGHTNESS_SAMPLE_SIZE, BRIGHTNESS_SAMPLE_SIZE);
        brightness = averageLuma(img.data);
      } catch {
        // 取帧失败不影响推理，保持上一次亮度
      }
    }

    async function initModels() {
      const vision = await FilesetResolver.forVisionTasks('/wasm');
      const detBase = { modelAssetPath: '/models/efficientdet_lite0.tflite' };
      const poseBase = { modelAssetPath: '/models/pose_landmarker_lite.task' };

      const create = (delegate: 'GPU' | 'CPU') =>
        ObjectDetector.createFromOptions(vision, {
          baseOptions: { ...detBase, delegate },
          scoreThreshold: DETECT_CONFIDENCE_MIN,
          runningMode: 'VIDEO',
          maxResults: 5,
        });

      const createPose = (delegate: 'GPU' | 'CPU') =>
        PoseLandmarker.createFromOptions(vision, {
          baseOptions: { ...poseBase, delegate },
          runningMode: 'VIDEO',
          numPoses: 2,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

      // 检测框是「有没有人」的唯一来源，失败即整体失败
      try {
        models.detector = await create('GPU');
      } catch {
        models.detector = await create('CPU'); // 再抛则 initModels 整体失败
      }

      // 姿态是「尺度与正对」，失败降级为 null：交给 SPEC §11 第 6 步按档案判断
      try {
        models.pose = await createPose('GPU');
      } catch {
        try {
          models.pose = await createPose('CPU');
        } catch {
          models.pose = null;
        }
      }
    }

    function tick() {
      if (cancelled) return;
      raf = requestAnimationFrame(tick);

      const detector = models.detector;
      const pose = models.pose;
      if (!detector) return;
      if (video.readyState < 2 || video.videoWidth === 0) return;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const cw = video.clientWidth;
      const ch = video.clientHeight;
      if (cw === 0 || ch === 0) return;

      const now = performance.now();
      if (now - lastBrightnessAt >= BRIGHTNESS_SAMPLE_MS) {
        lastBrightnessAt = now;
        sampleBrightness();
      }
      let hit = false;
      let changed = false;
      let sampleDt = 0;

      try {
        // ---- 检测框 10fps：驱动管线与采样时钟 ----
        if (now - lastDetectAt >= DETECT_INTERVAL_MS) {
          lastDetectAt = now;

          const cands: BoxCandidate[] = [];
          const res = detector.detectForVideo(video, now);
          for (let i = 0; i < res.detections.length; i++) {
            const d = res.detections[i];
            const bb = d.boundingBox;
            // 只认 person：efficientdet 会把椅子/相框等也报出来，不能当人
            if (!bb || d.categories?.[0]?.categoryName !== 'person') continue;
            const box = videoBoxToContainer(
              { x: bb.originX / vw, y: bb.originY / vh, w: bb.width / vw, h: bb.height / vh },
              vw,
              vh,
              cw,
              ch,
            );
            cands.push({
              index: i,
              box,
              centerX: box.x + box.w / 2,
              confidence: d.categories?.[0]?.score ?? 0,
            });
          }
          const chosen = selectBox(cands, targetX);
          if (chosen) {
            smoothBox = emaBox(smoothBox, chosen.box, EMA_ALPHA);
            lastConfidence = chosen.confidence;
            hit = true;
          }

          sampleDt = Math.min(now - lastSampleAt, SAMPLE_CLOCK_CAP_MS);
          lastSampleAt = now;

          fpsCount += 1;
          if (now - fpsMark >= 1000) {
            detectionFps = fpsCount;
            fpsCount = 0;
            fpsMark = now;
          }
          changed = true;
        }

        // ---- 关键点 5fps：只刷新 PoseState（姿态不可用时跳过）----
        if (pose && now - lastPoseAt >= POSE_INTERVAL_MS) {
          lastPoseAt = now;
          const res = pose.detectForVideo(video, now);
          const cands: PoseCandidate[] = [];
          const pts: { l: Point; r: Point; nose: Point | null }[] = [];

          for (let i = 0; i < res.landmarks.length; i++) {
            const lms = res.landmarks[i] as Lm[];
            if (!lms || lms.length < 13) continue;
            hit = true;
            const ls = lms[11];
            const rs = lms[12];
            const ok = (p: Lm | undefined) =>
              !!p && (p.presence ?? p.visibility ?? 0) >= POSE_MIN_PRESENCE;
            if (!ok(ls) || !ok(rs)) continue;

            const L = videoPointToContainer({ x: ls.x, y: ls.y }, vw, vh, cw, ch);
            const R = videoPointToContainer({ x: rs.x, y: rs.y }, vw, vh, cw, ch);
            const noseLm = lms[0];
            const nose = ok(noseLm)
              ? videoPointToContainer({ x: noseLm.x, y: noseLm.y }, vw, vh, cw, ch)
              : null;

            cands.push({ index: i, centerX: (L.x + R.x) / 2, shoulderWidth: Math.abs(L.x - R.x) });
            pts.push({ l: L, r: R, nose });
          }

          const chosen = selectPose(cands, targetX);
          if (chosen) {
            const p = pts[cands.indexOf(chosen)];
            smoothL = emaPoint(smoothL, p.l, EMA_ALPHA);
            smoothR = emaPoint(smoothR, p.r, EMA_ALPHA);
            smoothNose = p.nose ? emaPoint(smoothNose, p.nose, EMA_ALPHA) : null;
            targetX = chosen.centerX;
            lastTargetAt = now;
          }
          changed = true;
        }
      } catch {
        errors += 1;
        if (errors >= MAX_INFERENCE_FAILURES && !cancelled) {
          cancelAnimationFrame(raf);
          setResult((r) => ({ ...r, status: 'failed', failure: 'runtime' }));
        }
        return;
      }

      if (hit) lastHitAt = now;

      // 目标长时间无匹配 → 复位，避免追着虚影走
      if (now - lastTargetAt > TRACK_LOST_MS) targetX = null;

      const alive = now - lastHitAt < HAS_PERSON_LOST_MS;
      if (!alive) {
        smoothBox = null;
        smoothL = null;
        smoothR = null;
        smoothNose = null;
        lastConfidence = 0;
      }

      if (!changed) return;

      // brightness / rollDeg 在阶段 7 接入，此处给「不触发规则」的中性值
      const poseState: PoseState = {
        hasPerson: alive,
        hasShoulders: alive && smoothL !== null && smoothR !== null,
        shoulderL: smoothL,
        shoulderR: smoothR,
        nose: alive ? smoothNose : null,
        timestamp: now,
      };
      const detState: DetectionState = {
        hasPerson: alive,
        box: alive ? smoothBox : null,
        confidence: alive ? lastConfidence : 0,
        timestamp: now,
      };
      const metrics = computeMetrics(smoothBox, poseState, profileRef.current, brightness, rollRef.current);

      setResult({
        status: 'ready',
        failure: null,
        poseAvailable: models.pose !== null,
        detectionFps,
        det: detState,
        pose: poseState,
        metrics,
        dt: sampleDt,
      });
    }

    const timeoutId = window.setTimeout(() => {
      if (cancelled || initDone) return;
      timedOut = true;
      setResult((r) => ({ ...r, status: 'failed', failure: 'init' }));
    }, MODEL_INIT_TIMEOUT_MS);

    let initDone = false;

    void (async () => {
      try {
        await initModels();
      } catch {
        if (!cancelled) setResult((r) => ({ ...r, status: 'failed', failure: 'init' }));
        return;
      }
      initDone = true;
      window.clearTimeout(timeoutId);
      if (cancelled || timedOut) {
        models.detector?.close();
        models.pose?.close();
        return;
      }
      setResult((r) => ({ ...r, status: 'ready', poseAvailable: models.pose !== null }));
      raf = requestAnimationFrame(tick);
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      cancelAnimationFrame(raf);
      models.detector?.close();
      models.pose?.close();
    };
  }, [videoRef]);

  return result;
}
