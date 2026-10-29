// SPEC §7 的口径校验：尺度随档案切换、faceOffset 与远近无关且不产生 NaN。

import { describe, expect, it } from 'vitest';
import { computeMetrics, dxOf, gapBottomOf } from './metrics';
import { PROFILES } from '../profiles';
import type { Box, PoseState } from '../types';

const NO_POSE: PoseState = {
  hasPerson: false,
  hasShoulders: false,
  shoulderL: null,
  shoulderR: null,
  nose: null,
  timestamp: 0,
};

function poseWith(
  left: [number, number] | null,
  right: [number, number] | null,
  nose: [number, number] | null,
): PoseState {
  return {
    hasPerson: true,
    hasShoulders: !!left && !!right,
    shoulderL: left ? { x: left[0], y: left[1] } : null,
    shoulderR: right ? { x: right[0], y: right[1] } : null,
    nose: nose ? { x: nose[0], y: nose[1] } : null,
    timestamp: 1,
  };
}

describe('computeMetrics', () => {
  it('无框无姿态：不判为人，中心退回 0.5', () => {
    const m = computeMetrics(null, NO_POSE, PROFILES.half, 80, 0);
    expect(m.hasPerson).toBe(false);
    expect(m.hasEdges).toBe(false);
    expect(m.centerX).toBe(0.5);
    expect(m.scale).toBe(0);
    expect(m.faceOffset).toBe(0);
  });

  it('只有检测框：尺度用框高（full_ground），无肩时 faceOffset 为 0', () => {
    const det: Box = { x: 0.25, y: 0.1, w: 0.5, h: 0.8 };
    const m = computeMetrics(det, NO_POSE, PROFILES.full_ground, 80, 0);
    expect(m.hasPerson).toBe(true);
    expect(m.hasEdges).toBe(true);
    expect(m.hasShoulders).toBe(false);
    expect(m.headTop).toBeCloseTo(0.1, 6);
    expect(m.bottomEdge).toBeCloseTo(0.9, 6);
    expect(m.centerX).toBeCloseTo(0.5, 6);
    expect(m.scale).toBeCloseTo(0.8, 6); // bboxHeight
    expect(m.faceOffset).toBe(0);
  });

  it('只有检测框：尺度用肩宽（half），无肩时为 0（不会被框高污染）', () => {
    const det: Box = { x: 0.25, y: 0.1, w: 0.5, h: 0.8 };
    const m = computeMetrics(det, NO_POSE, PROFILES.half, 80, 0);
    expect(m.scale).toBe(0);
    expect(m.headTop).toBeCloseTo(0.1, 6);
  });

  it('正对：鼻尖在肩中线，faceOffset 为 0，尺度取肩宽', () => {
    const pose = poseWith([0.3, 0.4], [0.7, 0.4], [0.5, 0.2]);
    const m = computeMetrics(null, pose, PROFILES.half, 80, 0);
    expect(m.hasShoulders).toBe(true);
    expect(m.shoulderWidth).toBeCloseTo(0.4, 6);
    expect(m.centerX).toBeCloseTo(0.5, 6);
    expect(m.faceOffset).toBeCloseTo(0, 6);
    expect(m.scale).toBeCloseTo(0.4, 6);
  });

  it('侧身：鼻尖偏离肩中线 0.1、肩宽 0.4 → faceOffset 为 0.25', () => {
    const pose = poseWith([0.3, 0.4], [0.7, 0.4], [0.6, 0.2]);
    const m = computeMetrics(null, pose, PROFILES.half, 80, 0);
    expect(m.faceOffset).toBeCloseTo(0.25, 6);
  });

  it('faceOffset 与远近无关：同一姿态整体缩小一半，比值不变', () => {
    const near = computeMetrics(null, poseWith([0.2, 0.5], [0.8, 0.5], [0.65, 0.2]), PROFILES.half, 80, 0);
    const far = computeMetrics(null, poseWith([0.35, 0.5], [0.65, 0.5], [0.575, 0.2]), PROFILES.half, 80, 0);
    expect(near.faceOffset).toBeCloseTo(far.faceOffset, 6);
    expect(near.scale).toBeGreaterThan(far.scale);
  });

  it('鼻尖缺失时 faceOffset 为 0，不误报侧身', () => {
    const m = computeMetrics(null, poseWith([0.3, 0.4], [0.7, 0.4], null), PROFILES.half, 80, 0);
    expect(m.faceOffset).toBe(0);
  });

  it('双肩重合（肩宽≈0）时不产生 NaN', () => {
    const m = computeMetrics(null, poseWith([0.5, 0.4], [0.5, 0.4], [0.6, 0.2]), PROFILES.half, 80, 0);
    expect(Number.isFinite(m.faceOffset)).toBe(true);
    expect(m.faceOffset).toBe(0);
    expect(Number.isFinite(m.scale)).toBe(true);
  });
});

describe('派生量', () => {
  it('dx 正表示人偏右，负表示人偏左', () => {
    const right = computeMetrics(null, poseWith([0.5, 0.4], [0.9, 0.4], [0.7, 0.2]), PROFILES.half, 80, 0);
    const left = computeMetrics(null, poseWith([0.1, 0.4], [0.5, 0.4], [0.3, 0.2]), PROFILES.half, 80, 0);
    expect(dxOf(right, 0.5)).toBeCloseTo(0.2, 6);
    expect(dxOf(left, 0.5)).toBeCloseTo(-0.2, 6);
  });

  it('gapBottom 负表示框底被画面切掉', () => {
    const cut = computeMetrics({ x: 0.2, y: 0.1, w: 0.6, h: 0.95 }, NO_POSE, PROFILES.full_ground, 80, 0);
    const whole = computeMetrics({ x: 0.2, y: 0.1, w: 0.6, h: 0.8 }, NO_POSE, PROFILES.full_ground, 80, 0);
    expect(gapBottomOf(cut)).toBeCloseTo(-0.05, 6);
    expect(gapBottomOf(whole)).toBeCloseTo(0.1, 6);
  });
});
