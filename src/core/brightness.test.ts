import { describe, expect, it } from 'vitest';
import { averageLuma } from './brightness';

function rgba(r: number, g: number, b: number, count: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return data;
}

describe('averageLuma', () => {
  it('全黑为 0', () => {
    expect(averageLuma(rgba(0, 0, 0, 16))).toBe(0);
  });

  it('全白接近 255', () => {
    expect(averageLuma(rgba(255, 255, 255, 16))).toBeCloseTo(255, 5);
  });

  it('中灰接近 128', () => {
    expect(averageLuma(rgba(128, 128, 128, 16))).toBeCloseTo(128, 5);
  });

  it('空数据返回 0', () => {
    expect(averageLuma(new Uint8ClampedArray(0))).toBe(0);
  });
});
