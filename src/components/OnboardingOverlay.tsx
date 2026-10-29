// 首次进入 S4 的引导层。SPEC §9.7：首帧就绪后出现，点「知道了」写入 localStorage 后不再出现。

export default function OnboardingOverlay({
  text,
  confirmText,
  onConfirm,
}: {
  text: string;
  confirmText: string;
  onConfirm: () => void;
}) {
  return (
    <div className="onboarding">
      <div className="onboarding__card">
        <p className="onboarding__text">{text}</p>
        <button className="primary" onClick={onConfirm}>
          {confirmText}
        </button>
      </div>
    </div>
  );
}
