// 应用状态机。对应 SPEC §4（PRD §4.1），不使用 URL 路由。

import { resolveProfile } from './profiles';
import type { AppState, SceneId, ScreenId } from './types';

/** 引导层只展示一次；key 带版本后缀便于后续重放（SPEC §9.7）。 */
export const ONBOARDING_KEY = 'shot-guide:onboarding:v1';

function readOnboardingSeen(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(ONBOARDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function markOnboardingSeen(): void {
  try {
    window.localStorage.setItem(ONBOARDING_KEY, '1');
  } catch {
    // 隐私模式等场景写不进去：本次会话内仍隐藏，刷新后重放，不阻塞流程
  }
}

export const initialState: AppState = {
  screen: 'S1',
  sceneId: null,
  includeGround: true,
  profile: null,
  photos: [],
  selectedIndex: 0,
  saveState: 'idle',
  failure: null,
  hasSeenOnboarding: readOnboardingSeen(),
};

export type AppAction =
  | { type: 'SELECT_SCENE'; sceneId: SceneId }
  | { type: 'SET_INCLUDE_GROUND'; includeGround: boolean }
  | { type: 'GOTO'; screen: ScreenId }
  | { type: 'SET_PHOTOS'; photos: Blob[] }
  | { type: 'MODEL_FAILED' }
  | { type: 'RETRY_MODELS' }
  | { type: 'SET_ONBOARDING_SEEN' }
  | { type: 'CAMERA_FAILED'; failure: FailureKind }
  | { type: 'RETRY_CAMERA' }
  | { type: 'BACK_HOME' };

export type FailureKind = NonNullable<AppState['failure']>;

export function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SELECT_SCENE': {
      // 半身跳过 S2，直接交接；全身必须先问「是否拍脚」
      return {
        ...state,
        sceneId: action.sceneId,
        profile: resolveProfile(action.sceneId, state.includeGround),
        screen: action.sceneId === 'half' ? 'S3' : 'S2',
      };
    }
    case 'SET_INCLUDE_GROUND': {
      if (state.sceneId !== 'full') return state;
      return {
        ...state,
        includeGround: action.includeGround,
        profile: resolveProfile(state.sceneId, action.includeGround),
      };
    }
    case 'GOTO':
      return { ...state, screen: action.screen };
    case 'SET_PHOTOS':
      // 新一组照片：选中项回到第一张，保存状态重置
      return { ...state, photos: action.photos, selectedIndex: 0, saveState: 'idle' };
    case 'MODEL_FAILED':
      // 相机正常、识别不可用 → 手动模式（SPEC §11 第 5–7 步）
      // 相机已失败时以相机失败为准，忽略此动作（同一步骤要求「否则 SFallback」）
      if (state.failure) return state;
      return { ...state, screen: 'SManual' };
    case 'RETRY_MODELS':
      // 重试识别 → 回到 S4 重新加载模型
      return { ...state, screen: 'S4' };
    case 'SET_ONBOARDING_SEEN':
      return { ...state, hasSeenOnboarding: true };
    case 'CAMERA_FAILED':
      return { ...state, failure: action.failure, screen: 'SFallback' };
    case 'RETRY_CAMERA':
      // 清掉失败原因并回到 S4，由 S4 重新申请摄像头一次
      return { ...state, failure: null, screen: 'S4' };
    case 'BACK_HOME':
      // 离开 S5 / 回首页时释放照片（PRD §4.5「离开 S5 即释放」）
      return { ...state, screen: 'S1', photos: [], selectedIndex: 0, saveState: 'idle' };
  }
}
