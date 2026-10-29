// 规则引擎单测。对应 SPEC §8.2 判定顺序与 §8.5 null 处理。

import { describe, expect, it } from 'vitest';
import { PROFILES } from '../profiles';
import type { SubjectMetrics } from '../types';
import {
  evaluate,
  initEngineState,
  NO_PERSON_FALLBACK,
  READY_RESULT,
  resolveDisplay,
} from './ruleEngine';

function metrics(patch: Partial<SubjectMetrics> = {}): SubjectMetrics {
  return {
    hasPerson: true,
    hasEdges: true,
    hasShoulders: true,
    headTop: 0.2,
    bottomEdge: 0.9,
    centerX: 0.5,
    shoulderWidth: 0.3,
    faceOffset: 0.1,
    scale: 0.45, // 半身：0.40–0.56 之间，不触发距离规则
    brightness: 80,
    rollDeg: 0,
    ...patch,
  };
}

const half = PROFILES.half;
const fullGround = PROFILES.full_ground;

describe('evaluate', () => {
  it('没人时永远返回 noPerson 红，攒多久都不绿', () => {
    const st = initEngineState();
    const m = metrics({ hasPerson: false, hasEdges: false, hasShoulders: false });
    for (let i = 0; i < 10; i++) {
      const r = evaluate(half, m, st, 200);
      expect(r?.ruleId).toBe('noPerson');
      expect(r?.color).toBe('red');
    }
  });

  it('全部达标需累积 GREEN_HOLD_MS 才判绿', () => {
    const st = initEngineState();
    const m = metrics();
    expect(evaluate(half, m, st, 200)).toBeNull();
    expect(evaluate(half, m, st, 200)).toEqual(READY_RESULT);
  });

  it('判绿后如果又没人，立刻回落红', () => {
    const st = initEngineState();
    expect(evaluate(half, metrics(), st, 400)).toEqual(READY_RESULT);
    const r = evaluate(half, metrics({ hasPerson: false }), st, 200);
    expect(r?.ruleId).toBe('noPerson');
  });

  it('距离规则优先于偏移规则', () => {
    const st = initEngineState();
    const m = metrics({ scale: 0.3, centerX: 0.62 }); // 太远 + 偏右
    const r = evaluate(half, m, st, 300);
    expect(r?.ruleId).toBe('tooFar');
    expect(r?.message).toBe('人太小了，往前走两步');
  });

  it('只偏右时返回 shiftRight', () => {
    const st = initEngineState();
    const r = evaluate(half, metrics({ centerX: 0.62 }), st, 300);
    expect(r?.ruleId).toBe('shiftRight');
  });

  it('进入规则需要 300ms 迟滞', () => {
    const st = initEngineState();
    const m = metrics({ scale: 0.3 });
    expect(evaluate(half, m, st, 100)).toBeNull();
    expect(evaluate(half, m, st, 100)).toBeNull();
    const r = evaluate(half, m, st, 100);
    expect(r?.ruleId).toBe('tooFar');
  });

  it('亮度不足时 dark 压过一切', () => {
    const st = initEngineState();
    const r = evaluate(half, metrics({ brightness: 30 }), st, 300);
    expect(r?.ruleId).toBe('dark');
    expect(r?.color).toBe('red');
  });

  it('亮度回到 50 以上并持续 300ms 才解除 dark', () => {
    const st = initEngineState();
    evaluate(half, metrics({ brightness: 30 }), st, 300);
    expect(evaluate(half, metrics({ brightness: 45 }), st, 300)?.ruleId).toBe('dark');
    const r = evaluate(half, metrics({ brightness: 55 }), st, 300);
    expect(r?.ruleId).not.toBe('dark');
  });

  it('双肩缺失时距离类规则不参与判定', () => {
    const st = initEngineState();
    const m = metrics({ hasShoulders: false, scale: 0.2 });
    expect(evaluate(half, m, st, 300)?.ruleId).not.toBe('tooFar');
  });

  it('检测框缺失时头顶类规则跳过', () => {
    const st = initEngineState();
    const m = metrics({ hasEdges: false, headTop: 0.01 });
    const r = evaluate(half, m, st, 300);
    expect(r?.ruleId).not.toBe('headCrop');
  });

  it('拍脚档案：框底出画面触发 feetCrop', () => {
    const st = initEngineState();
    const m = metrics({ scale: 0.7, headTop: 0.1, bottomEdge: 1.05 });
    const r = evaluate(fullGround, m, st, 300);
    expect(r?.ruleId).toBe('feetCrop');
  });
});

describe('resolveDisplay', () => {
  it('绿后无结论回落为 noPerson 红', () => {
    expect(resolveDisplay(READY_RESULT, null)).toEqual(NO_PERSON_FALLBACK);
  });

  it('非绿色时无结论保持上一帧', () => {
    const prev = { ...NO_PERSON_FALLBACK, ruleId: 'tooFar', message: 'x' };
    expect(resolveDisplay(prev, null)).toBe(prev);
  });

  it('有新结论时直接替换', () => {
    expect(resolveDisplay(NO_PERSON_FALLBACK, READY_RESULT)).toBe(READY_RESULT);
  });
});
