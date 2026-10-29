// S4 首帧就绪前的遮罩。SPEC §9.1：LoadingOverlay 在最上层，就绪后消失。

export default function LoadingOverlay({ text }: { text: string }) {
  return (
    <div className="overlay">
      <div className="overlay__spinner" />
      <p className="overlay__text">{text}</p>
    </div>
  );
}
