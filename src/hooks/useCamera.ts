// 相机接入。对应 SPEC §9.1 的视频层与 §11 降级判定第 2–4 步。
// 非安全连接（第 1 步）由 App 在进入 S4 之前判定，这里不再重复。

import { useEffect, useState, type RefObject } from 'react';
import { CAMERA_CONSTRAINTS } from '../constants';

export type CameraFailureKind = 'permission' | 'notFound';
export type CameraStatus = 'loading' | 'ready' | 'failed';

export interface CameraResult {
  status: CameraStatus;
  failure: CameraFailureKind | null;
}

export function useCamera(videoRef: RefObject<HTMLVideoElement | null>): CameraResult {
  const [status, setStatus] = useState<CameraStatus>('loading');
  const [failure, setFailure] = useState<CameraFailureKind | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    const video = videoRef.current;
    if (!video) return;

    const onFirstFrame = () => setStatus('ready');
    video.addEventListener('canplay', onFirstFrame);
    video.addEventListener('playing', onFirstFrame);

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setFailure('notFound');
          setStatus('failed');
        }
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      } catch (e) {
        if (cancelled) return;
        const name = e instanceof DOMException ? e.name : '';
        setFailure(name === 'NotAllowedError' || name === 'SecurityError' ? 'permission' : 'notFound');
        setStatus('failed');
        return;
      }
      // 组件已卸载（或 StrictMode 二次挂载）时，立即释放刚拿到的轨道
      if (cancelled || !videoRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      videoRef.current.srcObject = stream;
      try {
        await videoRef.current.play();
      } catch {
        // 自动播放被拒时不阻断流程，画面由后续手势触发
      }
    }

    void start();

    return () => {
      cancelled = true;
      video.removeEventListener('canplay', onFirstFrame);
      video.removeEventListener('playing', onFirstFrame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [videoRef]);

  return { status, failure };
}
