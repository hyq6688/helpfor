// 多人锁定。对应 SPEC §5.4：摄影师的倒影、路人都不能抢走目标。
// 纯函数，目标「上一帧中心」与「丢失复位」由调用方维护。

import { TRACK_JUMP_MAX } from '../constants';
import type { Box } from '../types';

export interface BoxCandidate {
  index: number;
  box: Box;
  centerX: number;
  confidence: number;
}

export interface PoseCandidate {
  index: number;
  centerX: number;
  shoulderWidth: number;
}

/** 检测框：选中心最接近当前目标中心的；没有目标时取置信度最高的。 */
export function selectBox(cands: BoxCandidate[], targetX: number | null): BoxCandidate | null {
  if (cands.length === 0) return null;
  if (targetX === null) {
    return cands.reduce((a, b) => (b.confidence > a.confidence ? b : a));
  }
  return cands.reduce((a, b) =>
    Math.abs(b.centerX - targetX) < Math.abs(a.centerX - targetX) ? b : a,
  );
}

/**
 * 关键点：优先选与上一帧目标中心水平距离 < TRACK_JUMP_MAX 的那一个；
 * 否则选肩宽最大的（离镜头最近的人）。
 */
export function selectPose(cands: PoseCandidate[], targetX: number | null): PoseCandidate | null {
  if (cands.length === 0) return null;
  if (targetX !== null) {
    const near = cands.filter((c) => Math.abs(c.centerX - targetX) < TRACK_JUMP_MAX);
    if (near.length > 0) {
      return near.reduce((a, b) => (b.shoulderWidth > a.shoulderWidth ? b : a));
    }
  }
  return cands.reduce((a, b) => (b.shoulderWidth > a.shoulderWidth ? b : a));
}
