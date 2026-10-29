// 度量。对应 SPEC §7。单位随 scaleSource 变化：
// shoulder → 占容器宽的比例；bboxHeight → 占容器高的比例。阈值不可跨档案复用。

import type { Box, ProfileConfig, PoseState, SubjectMetrics } from '../types';

export function computeMetrics(
  det: Box | null,
  pose: PoseState,
  profile: ProfileConfig,
  brightness: number,
  rollDeg: number,
): SubjectMetrics {
  const hasEdges = !!det;
  const shoulderWidth = pose.hasShoulders
    ? Math.abs(pose.shoulderL!.x - pose.shoulderR!.x)
    : 0;
  const centerX = pose.hasShoulders
    ? (pose.shoulderL!.x + pose.shoulderR!.x) / 2
    : det
      ? det.x + det.w / 2
      : 0.5;
  // 鼻尖相对肩中线的偏移：分母是肩宽，所以与远近无关。
  // nose 缺失时取 0（视为未侧身，宁可漏报不误报）。
  const faceOffset =
    pose.hasShoulders && pose.nose && shoulderWidth > 1e-6
      ? Math.abs(pose.nose.x - centerX) / shoulderWidth
      : 0;

  return {
    hasPerson: hasEdges || pose.hasPerson,
    hasEdges,
    hasShoulders: pose.hasShoulders,
    headTop: det ? det.y : 0,
    bottomEdge: det ? det.y + det.h : 1,
    centerX,
    shoulderWidth,
    faceOffset,
    scale: profile.scaleSource === 'shoulder' ? shoulderWidth : det ? det.h : 0,
    brightness,
    rollDeg,
  };
}

/** 派生量：人物中心相对目标中心的水平偏差（正 = 人偏右）。 */
export function dxOf(m: SubjectMetrics, targetCenterX: number): number {
  return m.centerX - targetCenterX;
}

/** 派生量：人物框底边到画面底边的距离（负 = 脚被切）。 */
export function gapBottomOf(m: SubjectMetrics): number {
  return 1 - m.bottomEdge;
}
