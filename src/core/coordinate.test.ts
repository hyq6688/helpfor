// SPEC §6.2 的两组用例：竖屏 + 横屏，都必须通过。

import { describe, expect, it } from 'vitest';
import { videoBoxToContainer, videoPointToContainer } from './coordinate';
import type { Box } from '../types';

const BOX: Box = { x: 0.4, y: 0.3, w: 0.2, h: 0.4 };
const CW = 375;
const CH = 812;

describe('videoBoxToContainer', () => {
  it('竖屏 1080x1920 → 容器 375x812', () => {
    const out = videoBoxToContainer(BOX, 1080, 1920, CW, CH);
    expect(out.x).toBeCloseTo(0.3782, 3);
    expect(out.y).toBeCloseTo(0.3, 3);
    expect(out.w).toBeCloseTo(0.2436, 3);
    expect(out.h).toBeCloseTo(0.4, 3);
    // 测试用的框本身居中，换算后必须仍然居中
    expect(out.x + out.w / 2).toBeCloseTo(0.5, 3);
    expect(out.y + out.h / 2).toBeCloseTo(0.5, 3);
  });

  it('横屏 1920x1080 → 容器 375x812', () => {
    const out = videoBoxToContainer(BOX, 1920, 1080, CW, CH);
    expect(out.x).toBeCloseTo(0.1151, 3);
    expect(out.y).toBeCloseTo(0.3, 3);
    expect(out.w).toBeCloseTo(0.7699, 3);
    expect(out.h).toBeCloseTo(0.4, 3);
    expect(out.x + out.w / 2).toBeCloseTo(0.5, 3);
    expect(out.y + out.h / 2).toBeCloseTo(0.5, 3);
  });

  it('超出画面的框允许出现负值或大于 1 的值（cover 裁掉的部分）', () => {
    const out = videoBoxToContainer({ x: -0.1, y: 0.9, w: 0.2, h: 0.3 }, 1080, 1920, CW, CH);
    expect(out.x).toBeLessThan(0);
    expect(out.y + out.h).toBeGreaterThan(1);
  });
});

describe('videoPointToContainer', () => {
  it('竖屏中心点保持在中心', () => {
    const out = videoPointToContainer({ x: 0.5, y: 0.5 }, 1080, 1920, CW, CH);
    expect(out.x).toBeCloseTo(0.5, 6);
    expect(out.y).toBeCloseTo(0.5, 6);
  });

  it('横屏中心点保持在中心', () => {
    const out = videoPointToContainer({ x: 0.5, y: 0.5 }, 1920, 1080, CW, CH);
    expect(out.x).toBeCloseTo(0.5, 6);
    expect(out.y).toBeCloseTo(0.5, 6);
  });

  it('与 videoBoxToContainer 对同一组角点的换算一致', () => {
    const vw = 1080;
    const vh = 1920;
    const left = videoPointToContainer({ x: BOX.x, y: BOX.y }, vw, vh, CW, CH);
    const right = videoPointToContainer(
      { x: BOX.x + BOX.w, y: BOX.y + BOX.h },
      vw,
      vh,
      CW,
      CH,
    );
    const box = videoBoxToContainer(BOX, vw, vh, CW, CH);
    expect(left.x).toBeCloseTo(box.x, 6);
    expect(left.y).toBeCloseTo(box.y, 6);
    expect(right.x).toBeCloseTo(box.x + box.w, 6);
    expect(right.y).toBeCloseTo(box.y + box.h, 6);
  });
});
