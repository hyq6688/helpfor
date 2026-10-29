// 规则引擎。对应 SPEC §8.2 的八步判定与 §8.5 的 null 处理。
// 纯函数 + 显式 EngineState：方便单测，也避免把计时散在组件里。

import { GREEN_HOLD_MS, HYSTERESIS_MS } from '../constants';
import { RULE_COPY, type CopyLine } from '../copy';
import type { ProfileConfig, RuleConfig, RuleResult, SubjectMetrics } from '../types';

const COPY = RULE_COPY as Record<string, CopyLine>;

export interface RuleRuntimeState {
  active: boolean;
  enterAcc: number; // 进规则的条件累计毫秒（采样时钟）
  exitAcc: number;
}

export interface EngineState {
  rules: Record<string, RuleRuntimeState>;
  readyAcc: number;
}

export function initEngineState(): EngineState {
  return { rules: {}, readyAcc: 0 };
}

/** 绿后无结论时回落到的提示（SPEC §8.5 的 NO_PERSON_FALLBACK）。 */
export const NO_PERSON_FALLBACK: RuleResult = {
  ruleId: 'noPerson',
  priority: 2,
  color: 'red',
  message: RULE_COPY.noPerson.text,
  voice: RULE_COPY.noPerson.voice,
};

export const READY_RESULT: RuleResult = {
  ruleId: 'ready',
  priority: 999,
  color: 'green',
  message: RULE_COPY.ready.text,
  voice: RULE_COPY.ready.voice,
};

function toResult(rule: RuleConfig): RuleResult {
  const copy = COPY[rule.copyId] ?? COPY.noPerson;
  return {
    ruleId: rule.id,
    priority: rule.priority,
    color: rule.color,
    message: copy.text,
    voice: copy.voice,
  };
}

function runtimeOf(st: EngineState, id: string): RuleRuntimeState {
  let s = st.rules[id];
  if (!s) {
    s = { active: false, enterAcc: 0, exitAcc: 0 };
    st.rules[id] = s;
  }
  return s;
}

function isActive(st: EngineState, id: string): boolean {
  return st.rules[id]?.active === true;
}

/** 单条规则的状态推进：precondition → 累计 → 迟滞翻转。 */
function step(rule: RuleConfig, m: SubjectMetrics, dt: number, st: EngineState): void {
  const s = runtimeOf(st, rule.id);

  if (rule.precondition && !rule.precondition(m)) {
    s.active = false;
    s.enterAcc = 0;
    s.exitAcc = 0;
    return;
  }

  if (rule.enter(m)) s.enterAcc += dt;
  else s.enterAcc = 0;

  if (rule.exit(m)) s.exitAcc += dt;
  else s.exitAcc = 0;

  if (!s.active && s.enterAcc >= HYSTERESIS_MS) {
    s.active = true;
    s.enterAcc = 0;
  } else if (s.active && s.exitAcc >= HYSTERESIS_MS) {
    s.active = false;
    s.exitAcc = 0;
  }
}

export function evaluate(
  profile: ProfileConfig,
  m: SubjectMetrics,
  st: EngineState,
  dt: number,
): RuleResult | null {
  const delta = Math.max(0, dt);
  const rules = [...profile.rules].sort((a, b) => a.priority - b.priority);
  const dark = rules.find((r) => r.id === 'dark');

  // 1. 亮度规则无论有没有人都要更新：否则暗光下会陷入「请人站中间 → 人来了仍看不见」
  if (dark) step(dark, m, delta, st);

  // 2. 没人：dark → noPerson，永不绿
  if (!m.hasPerson) {
    st.readyAcc = 0;
    if (dark && isActive(st, dark.id)) return toResult(dark);
    const noPerson = rules.find((r) => r.id === 'noPerson');
    if (!noPerson) return null;
    step(noPerson, m, delta, st);
    return toResult(noPerson);
  }

  // 3. 有人：按 priority 升序更新全部（dark 已在第 1 步更新过）
  for (const r of rules) {
    if (r.id === 'dark') continue;
    step(r, m, delta, st);
  }

  const active = rules.filter((r) => isActive(st, r.id));

  // 5. 距离规则（20/21）只返回它自己：其余规则照常评估，但不抢提示
  const distance = active.filter((r) => r.priority === 20 || r.priority === 21);
  if (distance.length > 0) {
    st.readyAcc = 0;
    return toResult(distance[0]);
  }

  // 6. 其他激活规则：取 priority 最小者
  if (active.length > 0) {
    st.readyAcc = 0;
    return toResult(active[0]);
  }

  // 7. 无结论：攒够 GREEN_HOLD_MS 才判绿，否则交给 UI 保持上一帧
  st.readyAcc += delta;
  return st.readyAcc >= GREEN_HOLD_MS ? READY_RESULT : null;
}

/** UI 侧的 null 处理（SPEC §8.5）：绿后无结论必须回落红，其余保持上一帧。 */
export function resolveDisplay(prev: RuleResult, next: RuleResult | null): RuleResult {
  if (next) return next;
  return prev.color === 'green' ? NO_PERSON_FALLBACK : prev;
}
