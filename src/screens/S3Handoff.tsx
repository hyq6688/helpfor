// S3 交接。PRD §4.3：一句话交接 + 一个按钮 + 两行小字；不调用摄像头。
// 点击「开始取景」同时完成 iOS 语音解锁（SPEC §10.1）与传感器授权（SPEC §11 第 8 条）。

import { SCREEN_COPY } from '../copy';
import { requestOrientationPermission } from '../hooks/useOrientation';
import { speak } from '../hooks/useSpeech';

export default function S3Handoff({ onStart }: { onStart: () => void }) {
  const handleStart = () => {
    // 必须在用户手势里同步调用；这句同时承担「交接完成」的语义
    speak(SCREEN_COPY.s3Voice, { bypassThrottle: true });
    // iOS 的传感器授权同样只能由手势触发，失败不阻塞流程
    void requestOrientationPermission();
    onStart();
  };

  return (
    <div className="screen screen--s3">
      <div>
        <p className="handoff__title">{SCREEN_COPY.s3Title}</p>
        <p className="handoff__subtitle">{SCREEN_COPY.s3Subtitle}</p>
      </div>
      <button className="primary" onClick={handleStart}>
        {SCREEN_COPY.s3Start}
      </button>
      <p className="small">
        {SCREEN_COPY.s3Privacy}
        <br />
        {SCREEN_COPY.s3Dnd}
      </p>
    </div>
  );
}
