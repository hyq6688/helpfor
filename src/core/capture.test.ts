import { describe, expect, it } from 'vitest';
import { coverSourceRect } from './capture';

describe('coverSourceRect', () => {
  it('竖屏容器配横屏视频：左右各裁一半，纵向完整', () => {
    // 375×812 容器 / 1920×1080 视频，scale = max(0.1953, 0.7519)
    const r = coverSourceRect(1920, 1080, 375, 812);
    expect(r.sx).toBeCloseTo(710.61576, 3);
    expect(r.sy).toBeCloseTo(0, 5);
    expect(r.sw).toBeCloseTo(498.76847, 3);
    expect(r.sh).toBeCloseTo(1080, 3);
    expect(r.sx + r.sw).toBeLessThanOrEqual(1920);
  });

  it('横屏容器配横屏视频：纵向各裁一半，横向完整', () => {
    const r = coverSourceRect(1920, 1080, 812, 375);
    expect(r.sx).toBeCloseTo(0, 5);
    expect(r.sw).toBeCloseTo(1920, 3);
    expect(r.sy).toBeGreaterThan(0);
    expect(r.sy + r.sh).toBeLessThanOrEqual(1080);
  });

  it('容器与视频等比时取全帧', () => {
    const r = coverSourceRect(1920, 1080, 960, 540);
    expect(r).toEqual({ sx: 0, sy: 0, sw: 1920, sh: 1080 });
  });
});
