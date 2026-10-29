// 亮度。对应 SPEC §4.3（32×32 采样）与 §8.3 的 dark 规则（0–255 灰度）。
// 纯函数便于单测；采样本身在 useDetectors 里做。

/** 平均亮度（0–255）：Rec.601 亮度权重。 */
export function averageLuma(data: Uint8ClampedArray): number {
  if (data.length < 4) return 0;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return sum / (data.length / 4);
}
