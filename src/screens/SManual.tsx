// SManual 手动模式。SPEC §11 第 5–7 步 / PRD §4.4：
// 相机可用但识别不可用 → 视频 + 轮廓 + 常驻横幅 + 三句静态指引 + 快门常开。

import { useEffect, useRef } from 'react';
import GuideBar from '../components/GuideBar';
import LoadingOverlay from '../components/LoadingOverlay';
import ShutterButton from '../components/ShutterButton';
import Silhouette from '../components/Silhouette';
import { SCREEN_COPY, UI_COPY } from '../copy';
import { useCamera, type CameraFailureKind } from '../hooks/useCamera';
import { useCapture } from '../hooks/useCapture';
import { useWakeLock } from '../hooks/useWakeLock';
import type { ProfileConfig } from '../types';

interface Props {
  profile: ProfileConfig;
  onBack: () => void;
  onCameraFailure: (kind: CameraFailureKind) => void;
  onRetry: () => void;
  onCaptured: (photos: Blob[]) => void;
}

export default function SManual({
  profile,
  onBack,
  onCameraFailure,
  onRetry,
  onCaptured,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { status: cameraStatus, failure } = useCamera(videoRef);
  const { phase, countdown, busy, capture } = useCapture(videoRef, onCaptured);

  useWakeLock();

  useEffect(() => {
    if (failure) onCameraFailure(failure);
  }, [failure, onCameraFailure]);

  const guideText =
    phase === 'countdown' && countdown !== null ? String(countdown) : UI_COPY.burst;

  return (
    <div className="s4">
      <video className="s4__video" ref={videoRef} playsInline muted autoPlay />

      <Silhouette profile={profile} />

      <div className="manual__briefing">
        {profile.briefing.map((line, i) => (
          <p key={line}>
            <span className="manual__num">{i + 1}</span>
            {line}
          </p>
        ))}
      </div>

      {busy && <GuideBar color="yellow" text={guideText} />}

      <ShutterButton
        isGreen
        disabled={busy || cameraStatus !== 'ready'}
        onCapture={capture}
      />

      <div className="s4__topbar">
        <button className="s4__back" onClick={onBack} disabled={busy}>
          ← {SCREEN_COPY.back}
        </button>
        <span className="s4__profile">{profile.label}</span>
        <button className="s4__back s4__back--end" onClick={onRetry} disabled={busy}>
          {SCREEN_COPY.retryDetect}
        </button>
      </div>

      <div className="manual__banner">{UI_COPY.manualBanner}</div>

      {cameraStatus !== 'ready' && <LoadingOverlay text={UI_COPY.loadingOverlay} />}
    </div>
  );
}
