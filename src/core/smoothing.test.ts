// EMA 平滑：首帧直通、后续按 EMA_ALPHA 混合（SPEC §5.1 要求平滑在换算之后）。

import { describe, expect, it } from 'vitest';
import { EMA_ALPHA } from '../constants';
import { ema, emaBox, emaPoint } from './smoothing';

describe('ema', () => {
  it('首个样本直通，不做偏置', () => {
    expect(ema(null, 0.42)).toBe(0.42);
  });

  it('后续样本按 alpha 混合', () => {
    expect(ema(0, 1, 0.3)).toBeCloseTo(0.3, 6);
    expect(ema(1, 0, 0.3)).toBeCloseTo(0.7, 6);
  });

  it('默认 alpha 取 EMA_ALPHA', () => {
    expect(ema(0, 1)).toBeCloseTo(EMA_ALPHA, 6);
  });
});

describe('emaBox', () => {
  it('无历史时直接采用新框', () => {
    const next = { x: 0.2, y: 0.1, w: 0.5, h: 0.8 };
    expect(emaBox(null, next)).toEqual(next);
  });

  it('四个分量各自平滑', () => {
    const prev = { x: 0, y: 0, w: 0.4, h: 0.6 };
    const next = { x: 0.1, y: 0.2, w: 0.6, h: 1.0 };
    const out = emaBox(prev, next, 0.3);
    expect(out.x).toBeCloseTo(0.03, 6);
    expect(out.y).toBeCloseTo(0.06, 6);
    expect(out.w).toBeCloseTo(0.46, 6);
    expect(out.h).toBeCloseTo(0.72, 6);
  });
});

describe('emaPoint', () => {
  it('首点直通，次点平滑', () => {
    expect(emaPoint(null, { x: 0.5, y: 0.3 })).toEqual({ x: 0.5, y: 0.3 });
    const out = emaPoint({ x: 0.5, y: 0.3 }, { x: 0.7, y: 0.1 }, 0.3);
    expect(out.x).toBeCloseTo(0.56, 6);
    expect(out.y).toBeCloseTo(0.24, 6);
  });
});
