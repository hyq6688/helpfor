// 多人锁定：倒影与路人不能抢走目标（SPEC §5.4）。

import { describe, expect, it } from 'vitest';
import { selectBox, selectPose, type BoxCandidate, type PoseCandidate } from './tracking';

const boxCand = (index: number, centerX: number, confidence: number): BoxCandidate => ({
  index,
  box: { x: centerX - 0.1, y: 0.1, w: 0.2, h: 0.6 },
  centerX,
  confidence,
});

const poseCand = (index: number, centerX: number, shoulderWidth: number): PoseCandidate => ({
  index,
  centerX,
  shoulderWidth,
});

describe('selectBox', () => {
  it('无人时返回 null', () => {
    expect(selectBox([], null)).toBeNull();
  });

  it('没有历史目标时取置信度最高者', () => {
    const picked = selectBox([boxCand(0, 0.3, 0.5), boxCand(1, 0.7, 0.9)], null);
    expect(picked?.index).toBe(1);
  });

  it('有历史目标时取中心最接近者（即使置信度更低）', () => {
    const picked = selectBox([boxCand(0, 0.42, 0.5), boxCand(1, 0.9, 0.9)], 0.4);
    expect(picked?.index).toBe(0);
  });
});

describe('selectPose', () => {
  it('无人时返回 null', () => {
    expect(selectPose([], null)).toBeNull();
  });

  it('没有历史目标时取肩宽最大者（离镜头最近的人）', () => {
    const picked = selectPose([poseCand(0, 0.2, 0.1), poseCand(1, 0.6, 0.3)], null);
    expect(picked?.index).toBe(1);
  });

  it('优先选与历史目标水平距离 < TRACK_JUMP_MAX 的那一个', () => {
    const picked = selectPose([poseCand(0, 0.55, 0.12), poseCand(1, 0.15, 0.35)], 0.5);
    expect(picked?.index).toBe(0);
  });

  it('所有候选都远离历史目标时退回肩宽最大者（目标切换）', () => {
    const picked = selectPose([poseCand(0, 0.95, 0.15), poseCand(1, 0.6, 0.32)], 0.1);
    expect(picked?.index).toBe(1);
  });
});
