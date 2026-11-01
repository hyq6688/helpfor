// 三个构图档案。对应 SPEC §4.5 与 §8.3。
// 阈值分三档：[定稿] 不得改；[待校准] 必须按 SPEC §14 真机校准后回写本文并去掉标记。

import {
  BRIGHTNESS_LOW_ENTER,
  BRIGHTNESS_LOW_EXIT,
  ROLL_ENTER_DEG,
  ROLL_EXIT_DEG,
} from './constants';
import { dxOf, gapBottomOf } from './core/metrics';
import type {
  Box,
  ProfileConfig,
  ProfileId,
  RuleConfig,
  SceneId,
  StoredTemplateConfig,
  SubjectMetrics,
  Template,
} from './types';

const TARGET_CENTER_X = 0.5;

function rule(
  id: string,
  copyId: string,
  priority: number,
  color: 'red' | 'yellow',
  enter: (m: SubjectMetrics) => boolean,
  exit: (m: SubjectMetrics) => boolean,
  precondition?: (m: SubjectMetrics) => boolean,
): RuleConfig {
  return { id, copyId, priority, color, enter, exit, precondition };
}

const dark = rule(
  'dark',
  'dark',
  1,
  'red',
  (m) => m.brightness < BRIGHTNESS_LOW_ENTER,
  (m) => m.brightness >= BRIGHTNESS_LOW_EXIT,
);

const noPerson = rule(
  'noPerson',
  'noPerson',
  2,
  'red',
  (m) => !m.hasPerson,
  (m) => m.hasPerson,
);

/** 半身 / 膝上共用：侧身提示（faceOffset 越大越侧身）。 */
const turnToCamera = rule(
  'turnToCamera',
  'turnToCamera',
  10,
  'yellow',
  (m) => m.faceOffset > 0.81, // [待校准] 0.70 × 侧身45° 中位(1.16)
  (m) => m.faceOffset <= 0.65, // [待校准] 0.56 × 侧身45° 中位
  (m) => m.hasPerson && m.hasEdges && m.hasShoulders,
);

const shiftRight = rule(
  'shiftRight',
  'shiftRight',
  30,
  'red',
  (m) => dxOf(m, TARGET_CENTER_X) > 0.1,
  (m) => dxOf(m, TARGET_CENTER_X) <= 0.06,
);

const shiftLeft = rule(
  'shiftLeft',
  'shiftLeft',
  31,
  'red',
  (m) => dxOf(m, TARGET_CENTER_X) < -0.1,
  (m) => dxOf(m, TARGET_CENTER_X) >= -0.06,
);

const headCrop = rule(
  'headCrop',
  'headCrop',
  40,
  'red',
  (m) => m.headTop < 0.04,
  (m) => m.headTop >= 0.07,
  (m) => m.hasEdges,
);

const tilt = rule(
  'tilt',
  'tilt',
  60,
  'yellow',
  (m) => Math.abs(m.rollDeg) > ROLL_ENTER_DEG,
  (m) => Math.abs(m.rollDeg) <= ROLL_EXIT_DEG,
);

const half: ProfileConfig = {
  id: 'half',
  label: '半身照',
  targetBox: { x: 0.2, y: 0.15, w: 0.6, h: 0.7 }, // [定稿]
  targetCenterX: TARGET_CENTER_X,
  scaleSource: 'shoulder',
  silhouettePath: 'half',
  rules: [
    dark,
    noPerson,
    turnToCamera,
    rule(
      'tooFar',
      'tooFar.twoSteps',
      20,
      'red',
      (m) => m.scale < 0.36, // [待校准] 0.80 × target(0.45)
      (m) => m.scale >= 0.4, // [待校准] 0.88 × target
      (m) => m.hasShoulders,
    ),
    rule(
      'tooClose',
      'tooClose.stepBack',
      21,
      'red',
      (m) => m.scale > 0.56, // [待校准] 1.25 × target
      (m) => m.scale <= 0.52, // [待校准] 1.15 × target
      (m) => m.hasShoulders,
    ),
    shiftRight,
    shiftLeft,
    headCrop,
    rule(
      'headGap',
      'headGap',
      41,
      'yellow',
      (m) => m.headTop > 0.22, // [定稿]
      (m) => m.headTop <= 0.17,
      (m) => m.hasEdges,
    ),
    tilt,
  ],
  briefing: [
    '手机举到被拍者胸口高度',
    '人物头部上方留一点空，不要切到头',
    '人物占画面高度约 2/3',
  ],
};

const fullGround: ProfileConfig = {
  id: 'full_ground',
  label: '全身照',
  targetBox: { x: 0.22, y: 0.08, w: 0.56, h: 0.84 }, // [定稿]
  targetCenterX: TARGET_CENTER_X,
  scaleSource: 'bboxHeight',
  silhouettePath: 'full',
  rules: [
    dark,
    noPerson,
    rule(
      'tooFar',
      'tooFar.slight',
      20,
      'red',
      (m) => m.scale < 0.62, // [定稿]
      (m) => m.scale >= 0.7,
      (m) => m.hasEdges,
    ),
    rule(
      'tooClose',
      'tooClose.slight',
      21,
      'red',
      (m) => m.scale > 0.95, // [定稿]
      (m) => m.scale <= 0.88,
      (m) => m.hasEdges,
    ),
    shiftRight,
    shiftLeft,
    headCrop,
    rule(
      'headGap',
      'headGap',
      41,
      'yellow',
      (m) => m.headTop > 0.14, // [定稿]
      (m) => m.headTop <= 0.1,
      (m) => m.hasEdges,
    ),
    rule(
      'feetCrop',
      'feetCrop',
      45,
      'red',
      (m) => gapBottomOf(m) < 0, // [定稿] 框底被画面切掉
      (m) => gapBottomOf(m) >= 0.02,
      (m) => m.hasEdges,
    ),
    tilt,
  ],
  briefing: [
    '手机举到被拍者腰部高度',
    '退后直到脚和头顶都在画面内',
    '手机保持竖直，别仰拍',
  ],
};

const fullNoGround: ProfileConfig = {
  id: 'full_noground',
  label: '全身照',
  targetBox: { x: 0.2, y: 0.05, w: 0.6, h: 0.95 }, // [待校准]
  targetCenterX: TARGET_CENTER_X,
  scaleSource: 'shoulder',
  silhouettePath: 'full_crop',
  rules: [
    dark,
    noPerson,
    turnToCamera,
    rule(
      'tooFar',
      'tooFar.twoSteps',
      20,
      'red',
      (m) => m.scale < 0.23, // [待校准] 0.80 × target(0.29)
      (m) => m.scale >= 0.25, // [待校准] 0.88 × target
      (m) => m.hasShoulders,
    ),
    rule(
      'tooClose',
      'tooClose.stepBack',
      21,
      'red',
      (m) => m.scale > 0.36, // [待校准] 1.25 × target
      (m) => m.scale <= 0.33, // [待校准] 1.15 × target
      (m) => m.hasShoulders,
    ),
    shiftRight,
    shiftLeft,
    rule(
      'headCrop',
      'headCrop',
      40,
      'red',
      (m) => m.headTop < 0.04, // [待校准]
      (m) => m.headTop >= 0.07,
      (m) => m.hasEdges,
    ),
    rule(
      'headGap',
      'headGap',
      41,
      'yellow',
      (m) => m.headTop > 0.18, // [待校准]
      (m) => m.headTop <= 0.14,
      (m) => m.hasEdges,
    ),
    tilt,
  ],
  briefing: ['手机举到被拍者腰部高度', '退到能看见膝盖以上', '手机保持竖直，别仰拍'],
};

export const PROFILES: Record<ProfileId, ProfileConfig> = {
  half,
  full_ground: fullGround,
  full_noground: fullNoGround,
};

/** 档案由场景推导，不单独存（SPEC §4.5）。 */
export function resolveProfile(sceneId: SceneId, includeGround: boolean): ProfileId {
  return sceneId === 'half' ? 'half' : includeGround ? 'full_ground' : 'full_noground';
}

/** 默认模板：把现有 3 个档案直接包装（规格 AC-7、AC-9 兜底）。 */
export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'half',
    name: '半身照',
    description: '胸口以上，人物占画面约 2/3',
    coverUrl: '',
    profile: half,
    sort: 0,
    active: true,
  },
  {
    id: 'full_ground',
    name: '全身照（拍脚）',
    description: '从头到脚连地面一起入镜',
    coverUrl: '',
    profile: fullGround,
    sort: 1,
    active: true,
  },
  {
    id: 'full_noground',
    name: '全身照（不拍脚）',
    description: '拍到小腿，脚不入镜',
    coverUrl: '',
    profile: fullNoGround,
    sort: 2,
    active: true,
  },
];

const TARGET_CENTER_X_LOCAL = 0.5;

/**
 * 由 Supabase 存储的阈值配置重建 ProfileConfig。
 * RuleConfig 的 enter/exit 是闭包不可序列化，所以存数字、这里重建。
 * 共用规则（dark / noPerson / shift / tilt）与默认档案一致，仅可配置项取存储值。
 */
export function buildProfileFromStored(cfg: StoredTemplateConfig): ProfileConfig {
  const base: ProfileId = cfg.base;
  const useFaceOffset = base === 'half' || base === 'full_noground';
  const hasFeetCrop = base === 'full_ground';

  const rules: RuleConfig[] = [
    dark,
    noPerson,
    rule(
      'tooFar',
      base === 'full_ground' ? 'tooFar.slight' : 'tooFar.twoSteps',
      20,
      'red',
      (m) => m.scale < cfg.tooFarEnter,
      (m) => m.scale >= cfg.tooFarExit,
      (m) => (base === 'full_ground' ? m.hasEdges : m.hasShoulders),
    ),
    rule(
      'tooClose',
      base === 'full_ground' ? 'tooClose.slight' : 'tooClose.stepBack',
      21,
      'red',
      (m) => m.scale > cfg.tooCloseEnter,
      (m) => m.scale <= cfg.tooCloseExit,
      (m) => (base === 'full_ground' ? m.hasEdges : m.hasShoulders),
    ),
    shiftRight,
    shiftLeft,
    rule(
      'headCrop',
      'headCrop',
      40,
      'red',
      (m) => m.headTop < cfg.headCropEnter,
      (m) => m.headTop >= cfg.headCropExit,
      (m) => m.hasEdges,
    ),
    rule(
      'headGap',
      'headGap',
      41,
      'yellow',
      (m) => m.headTop > cfg.headGapEnter,
      (m) => m.headTop <= cfg.headGapExit,
      (m) => m.hasEdges,
    ),
  ];

  if (useFaceOffset) {
    rules.splice(
      2,
      0,
      rule(
        'turnToCamera',
        'turnToCamera',
        10,
        'yellow',
        (m) => m.faceOffset > cfg.faceOffsetEnter,
        (m) => m.faceOffset <= cfg.faceOffsetExit,
        (m) => m.hasPerson && m.hasEdges && m.hasShoulders,
      ),
    );
  }

  if (hasFeetCrop) {
    rules.push(
      rule(
        'feetCrop',
        'feetCrop',
        45,
        'red',
        (m) => gapBottomOf(m) < 0,
        (m) => gapBottomOf(m) >= 0.02,
        (m) => m.hasEdges,
      ),
    );
  }

  rules.push(tilt);

  return {
    id: base,
    label: cfg.label,
    targetBox: cfg.targetBox as Box,
    targetCenterX: TARGET_CENTER_X_LOCAL,
    scaleSource: base === 'full_ground' ? 'bboxHeight' : 'shoulder',
    silhouettePath: base === 'half' ? 'half' : base === 'full_ground' ? 'full' : 'full_crop',
    rules,
    briefing: cfg.briefing,
  };
}
