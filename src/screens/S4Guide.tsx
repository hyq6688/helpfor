// S4 取景页。图层顺序见 SPEC §9.1（自下而上）：
// video → silhouette → GuideBar → TopBar → LoadingOverlay。
//
// 阶段 5 已接真实推理：DEV 下额外显示检测框 / 双肩连线 / 鼻尖与指标读数。
// 阶段 6 由 ruleEngine 产出提示；DEV 调试层保留用于真机核对指标。

import { useEffect, useRef, useState } from 'react';
import GuideBar from '../components/GuideBar';
import LevelIndicator from '../components/LevelIndicator';
import LoadingOverlay from '../components/LoadingOverlay';
import OnboardingOverlay from '../components/OnboardingOverlay';
import ShutterButton from '../components/ShutterButton';
import Silhouette from '../components/Silhouette';
import { HINT_AFTER_MS, ROLL_DISPLAY_DEG } from '../constants';
import { SCREEN_COPY, UI_COPY } from '../copy';
import { gapBottomOf } from '../core/metrics';
import {
  evaluate,
  initEngineState,
  NO_PERSON_FALLBACK,
  resolveDisplay,
} from '../core/ruleEngine';
import { useCamera, type CameraFailureKind } from '../hooks/useCamera';
import { useCapture } from '../hooks/useCapture';
import { useDetectors } from '../hooks/useDetectors';
import { useOrientation } from '../hooks/useOrientation';
import { cancelSpeech, speak } from '../hooks/useSpeech';
import { useWakeLock } from '../hooks/useWakeLock';
import type { ProfileConfig, RuleResult } from '../types';

interface Props {
  profile: ProfileConfig;
  hasSeenOnboarding: boolean;
  onOnboardingSeen: () => void;
  onBack: () => void;
  onCameraFailure: (kind: CameraFailureKind) => void;
  onModelFailure: () => void;
  onCaptured: (photos: Blob[]) => void;
}

export default function S4Guide({
  profile,
  hasSeenOnboarding,
  onOnboardingSeen,
  onBack,
  onCameraFailure,
  onModelFailure,
  onCaptured,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { status: cameraStatus, failure } = useCamera(videoRef);
  const orientation = useOrientation();
  const {
    status: detStatus,
    failure: detFailure,
    poseAvailable,
    detectionFps,
    det,
    pose,
    metrics,
    dt,
  } = useDetectors(videoRef, profile, orientation.rollDeg);

  useWakeLock();

  // 初始态即 noPerson 红（SPEC §8.5）：加载完成前空白与绿色都不会出现
  const [rule, setRule] = useState<RuleResult>(NO_PERSON_FALLBACK);
  const engineRef = useRef(initEngineState());
  const [showLongPressHint, setShowLongPressHint] = useState(false);

  // 拍摄流程（与 SManual 共用）：倒计时/连拍期间冻结提示与颜色（SPEC §9.4）
  const { phase, countdown, busy, busyRef, capture } = useCapture(videoRef, onCaptured);

  useEffect(() => {
    if (!metrics || busyRef.current) return;
    const next = evaluate(profile, metrics, engineRef.current, dt);
    setRule((prev) => resolveDisplay(prev, next));
  }, [profile, metrics, dt, busyRef]);

  // 语音只在提示变化时播一次；重复同一句话交给 1.5s 节流是没意义的
  const lastVoiceRef = useRef('');
  useEffect(() => {
    if (busyRef.current) return;
    if (rule.voice === lastVoiceRef.current) return;
    lastVoiceRef.current = rule.voice;
    speak(rule.voice);
  }, [rule, busyRef]);

  // 非绿色持续 3s 后追加长按提示（SPEC §9.3）
  useEffect(() => {
    if (rule.color === 'green' || phase !== 'idle') {
      setShowLongPressHint(false);
      return;
    }
    const t = window.setTimeout(() => setShowLongPressHint(true), HINT_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [rule.ruleId, rule.color, phase]);

  // 离开 S4 必须停掉规则播报（SPEC §10.3）
  useEffect(() => () => cancelSpeech(), []);

  useEffect(() => {
    if (failure) onCameraFailure(failure);
  }, [failure, onCameraFailure]);

  // 降级（SPEC §11 第 5、6 步）：模型不可用，或肩宽尺度缺失的档案缺关键点 → SManual
  useEffect(() => {
    if (cameraStatus === 'failed') return; // 相机失败由上面的 effect 先送 SFallback
    if (detStatus === 'failed') onModelFailure();
  }, [cameraStatus, detStatus, onModelFailure]);

  useEffect(() => {
    if (cameraStatus !== 'ready') return;
    if (detStatus !== 'ready') return;
    if (poseAvailable) return;
    if (profile.scaleSource === 'shoulder') onModelFailure();
  }, [cameraStatus, detStatus, poseAvailable, profile.scaleSource, onModelFailure]);

  const guideText =
    phase === 'countdown' && countdown !== null
      ? String(countdown)
      : phase === 'burst'
        ? UI_COPY.burst
        : showLongPressHint
          ? `${rule.message} · ${UI_COPY.longPressHint}`
          : rule.message;

  return (
    <div className="s4">
      <video className="s4__video" ref={videoRef} playsInline muted autoPlay />

      <Silhouette profile={profile} />

      {orientation.available && Math.abs(orientation.rollDeg) > ROLL_DISPLAY_DEG && (
        <LevelIndicator rollDeg={orientation.rollDeg} />
      )}

      <GuideBar color={rule.color} text={guideText} />

      <ShutterButton
        isGreen={rule.color === 'green'}
        disabled={busy || cameraStatus !== 'ready'}
        onCapture={capture}
      />

      {/* DEV：检测结果叠加，真机用来确认坐标换算与跟踪是否正确 */}
      {import.meta.env.DEV && det.box && (
        <div
          className="dbg-box"
          style={{
            left: `${det.box.x * 100}%`,
            top: `${det.box.y * 100}%`,
            width: `${det.box.w * 100}%`,
            height: `${det.box.h * 100}%`,
          }}
        />
      )}
      {import.meta.env.DEV && pose.hasShoulders && pose.shoulderL && pose.shoulderR && (
        <svg className="dbg-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line
            x1={pose.shoulderL.x * 100}
            y1={pose.shoulderL.y * 100}
            x2={pose.shoulderR.x * 100}
            y2={pose.shoulderR.y * 100}
          />
          {pose.nose && (
            <circle
              cx={pose.nose.x * 100}
              cy={pose.nose.y * 100}
              r="1.5"
              fill="rgba(0,255,180,0.9)"
            />
          )}
        </svg>
      )}
      {import.meta.env.DEV && (
        <div className="debug">
          <div>
            模型 {detStatus}
            {detFailure ? ` / ${detFailure}` : ''} · 检测 {detectionFps}fps
          </div>
          <div>
            人 {metrics?.hasPerson ? 'Y' : 'N'} · 框 {metrics?.hasEdges ? 'Y' : 'N'} · 肩{' '}
            {metrics?.hasShoulders ? 'Y' : 'N'}
          </div>
          <div>
            scale {metrics ? metrics.scale.toFixed(2) : '—'} · faceOffset{' '}
            {metrics ? metrics.faceOffset.toFixed(2) : '—'}
          </div>
          <div>
            headTop {metrics ? metrics.headTop.toFixed(2) : '—'} · gapBottom{' '}
            {metrics ? gapBottomOf(metrics).toFixed(2) : '—'}
          </div>
          <div>
            bright {metrics ? metrics.brightness.toFixed(0) : '—'} · roll{' '}
            {orientation.available ? orientation.rollDeg.toFixed(1) : 'N/A'}
          </div>
          <div>
            规则 {rule.ruleId} · {rule.color} · {phase}
          </div>
        </div>
      )}

      <div className="s4__topbar">
        <button className="s4__back" onClick={onBack} disabled={busy}>
          ← {SCREEN_COPY.back}
        </button>
        <span className="s4__profile">{profile.label}</span>
        {/* 徽标只在「要拍脚」档案出现，其余留空以保持档案名居中 */}
        {profile.id === 'full_ground' ? (
          <span className="s4__badge">{SCREEN_COPY.s4BadgeGround}</span>
        ) : (
          <span className="s4__badge s4__badge--empty" />
        )}
      </div>

      {cameraStatus !== 'ready' && <LoadingOverlay text={UI_COPY.loadingOverlay} />}

      {/* 首次进入的引导层（SPEC §9.7）：首帧就绪后才出现 */}
      {cameraStatus === 'ready' && !hasSeenOnboarding && (
        <OnboardingOverlay
          text={UI_COPY.onboarding}
          confirmText={UI_COPY.onboardingConfirm}
          onConfirm={onOnboardingSeen}
        />
      )}
    </div>
  );
}
