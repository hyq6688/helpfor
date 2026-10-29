// 水平仪。SPEC §9.1：|roll| > ROLL_DISPLAY_DEG 且设备方向可用时显示。
// 白线是水平基准，黄线随手机倾斜反向旋转；两条线重合即端平。

export default function LevelIndicator({ rollDeg }: { rollDeg: number }) {
  const clamped = Math.max(-10, Math.min(10, rollDeg));
  return (
    <div className="level" aria-hidden="true">
      <div className="level__track" />
      <div className="level__needle" style={{ transform: `rotate(${-clamped}deg)` }} />
    </div>
  );
}
