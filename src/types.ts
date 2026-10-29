// 类型定义。对应 SPEC §3，改动需同步文档。

export type SceneId = 'half' | 'full';
export type ProfileId = 'half' | 'full_ground' | 'full_noground';
export type ScreenId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'SFallback' | 'SManual';
export type RuleColor = 'red' | 'yellow' | 'green';

export interface AppState {
  screen: ScreenId;
  sceneId: SceneId | null;
  includeGround: boolean; // 仅 full 有意义，默认 true
  profile: ProfileId | null;
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
