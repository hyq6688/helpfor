// 类型定义。对应 SPEC §3，改动需同步文档。

export type SceneId = 'half' | 'full';
export type ProfileId = 'half' | 'full_ground' | 'full_noground';
export type ScreenId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'SFallback' | 'SManual' | 'Admin';
export type RuleColor = 'red' | 'yellow' | 'green';

export interface AppState {
  screen: ScreenId;
  sceneId: SceneId | null;
  includeGround: boolean; // 仅 full 有意义，默认 true
  profile: ProfileId | null; // 默认档案 key；自定义模板时为骨架 id
  templateProfile: ProfileConfig | null; // 来自模板的完整 ProfileConfig（自定义阈值）
  photos: Blob[];
  selectedIndex: number; // 默认 0
  saveState: 'idle' | 'handedToSystem' | 'downloaded' | 'cancelled' | 'failed';
  failure: 'permission' | 'notFound' | 'insecure' | null;
  hasSeenOnboarding: boolean;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
} // 容器归一化

export interface Point {
  x: number;
  y: number;
}

export interface DetectionState {
  hasPerson: boolean;
  box: Box | null; // 容器归一化；可能 <0 或 >1（被 cover 裁掉的部分）
  confidence: number;
  timestamp: number;
}

export interface PoseState {
  hasPerson: boolean;
  hasShoulders: boolean;
  shoulderL: Point | null; // 容器归一化
  shoulderR: Point | null;
  nose: Point | null; // 正对判断用
  timestamp: number;
}

export interface SubjectMetrics {
  hasPerson: boolean;
  hasEdges: boolean; // 检测框有效
  hasShoulders: boolean; // 双肩关键点 presence 达标
  headTop: number; // 框顶边 → 容器归一化 y
  bottomEdge: number; // 框底边
  centerX: number; // 肩中心 x；无肩时退回框中心
  shoulderWidth: number; // 归一化到容器宽
  faceOffset: number; // |鼻尖x - 肩中心x| / 肩宽；越大越侧身
  scale: number; // 由 profile.scaleSource 决定
  brightness: number;
  rollDeg: number; // 有符号；右倾为正（不取绝对值）
}

export interface RuleResult {
  ruleId: string;
  priority: number;
  color: RuleColor;
  message: string;
  voice: string;
}

export interface RuleConfig {
  id: string;
  copyId: string; // 映射 copy.ts
  priority: number;
  color: 'red' | 'yellow';
  precondition?: (m: SubjectMetrics) => boolean;
  enter: (m: SubjectMetrics) => boolean;
  exit: (m: SubjectMetrics) => boolean;
}

export interface ProfileConfig {
  id: ProfileId;
  label: string;
  targetBox: Box;
  targetCenterX: number;
  scaleSource: 'shoulder' | 'bboxHeight';
  silhouettePath: 'half' | 'full' | 'full_crop';
  rules: RuleConfig[];
  briefing: string[]; // 手动模式 / SFallback 的三句静态指引
}

/**
 * 模板展示元信息 + 一个 ProfileConfig。
 * 模板 = 构图档案 + 名称/封面/简介（规格 §2.2）。
 */
export interface Template {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  profile: ProfileConfig;
  sort: number;
  active: boolean;
}

/**
 * Supabase 存储的 profile_config（JSONB）。
 * RuleConfig 含函数闭包不可序列化，因此只存阈值数字，由 buildProfileFromStored 重建。
 */
export interface StoredTemplateConfig {
  base: ProfileId; // 骨架：half / full_ground / full_noground，决定规则集与 scaleSource
  label: string;
  targetBox: Box;
  tooFarEnter: number; // scale < tooFarEnter 触发
  tooFarExit: number; // scale >= tooFarExit 解除
  tooCloseEnter: number; // scale > tooCloseEnter 触发
  tooCloseExit: number; // scale <= tooCloseExit 解除
  faceOffsetEnter: number; // turnToCamera 触发阈值（仅 half / full_noground）
  faceOffsetExit: number; // turnToCamera 解除阈值
  headCropEnter: number; // headTop < headCropEnter 触发
  headCropExit: number; // headTop >= headCropExit 解除
  headGapEnter: number; // headTop > headGapEnter 触发
  headGapExit: number; // headTop <= headGapExit 解除
  briefing: string[];
}

/** Supabase templates 表返回的原始行。 */
export interface StoredTemplate {
  id: string;
  name: string;
  description: string;
  cover_url: string;
  profile_config: StoredTemplateConfig;
  sort: number;
  active: boolean;
}
