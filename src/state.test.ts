// 状态机单测：阶段 2 的完成标志是「半身跳过 S2、全身显示 S2」。

import { describe, expect, it } from 'vitest';
import { initialState, reducer, type AppAction } from './state';
import { DEFAULT_TEMPLATES } from './profiles';
import type { AppState } from './types';

function run(actions: AppAction[]): AppState {
  return actions.reduce(reducer, initialState);
}

describe('App 状态机', () => {
  it('初始停在 S1，且没有档案', () => {
    expect(initialState.screen).toBe('S1');
    expect(initialState.profile).toBeNull();
    expect(initialState.includeGround).toBe(true);
  });

  it('选半身 → 直接进 S3（不出现 S2）', () => {
    const s = run([{ type: 'SELECT_SCENE', sceneId: 'half' }]);
    expect(s.screen).toBe('S3');
    expect(s.sceneId).toBe('half');
    expect(s.profile).toBe('half');
  });

  it('选全身 → 进入 S2，默认「要拍脚」', () => {
    const s = run([{ type: 'SELECT_SCENE', sceneId: 'full' }]);
    expect(s.screen).toBe('S2');
    expect(s.sceneId).toBe('full');
    expect(s.includeGround).toBe(true);
    expect(s.profile).toBe('full_ground');
  });

  it('全身改选「不要拍脚」→ 档案切到 full_noground，仍停在 S2', () => {
    const s = run([
      { type: 'SELECT_SCENE', sceneId: 'full' },
      { type: 'SET_INCLUDE_GROUND', includeGround: false },
    ]);
    expect(s.screen).toBe('S2');
    expect(s.includeGround).toBe(false);
    expect(s.profile).toBe('full_noground');
  });

  it('S2 下一步 → S3，档案保持不变', () => {
    const s = run([
      { type: 'SELECT_SCENE', sceneId: 'full' },
      { type: 'SET_INCLUDE_GROUND', includeGround: false },
      { type: 'GOTO', screen: 'S3' },
    ]);
    expect(s.screen).toBe('S3');
    expect(s.profile).toBe('full_noground');
  });

  it('S3 开始取景 → S4', () => {
    const s = run([
      { type: 'SELECT_SCENE', sceneId: 'half' },
      { type: 'GOTO', screen: 'S4' },
    ]);
    expect(s.screen).toBe('S4');
  });

  it('未选场景时改拍脚选项不改变状态', () => {
    const s = run([{ type: 'SET_INCLUDE_GROUND', includeGround: false }]);
    expect(s).toBe(initialState);
  });
});

describe('相机降级', () => {
  it('相机失败 → 进 SFallback 并记录原因', () => {
    const s = run([
      { type: 'SELECT_SCENE', sceneId: 'half' },
      { type: 'GOTO', screen: 'S4' },
      { type: 'CAMERA_FAILED', failure: 'permission' },
    ]);
    expect(s.screen).toBe('SFallback');
    expect(s.failure).toBe('permission');
    expect(s.profile).toBe('half'); // 档案不因降级丢失
  });

  it('重试 → 回到 S4 且清掉失败原因', () => {
    const s = run([
      { type: 'SELECT_SCENE', sceneId: 'full' },
      { type: 'CAMERA_FAILED', failure: 'notFound' },
      { type: 'RETRY_CAMERA' },
    ]);
    expect(s.screen).toBe('S4');
    expect(s.failure).toBeNull();
    expect(s.profile).toBe('full_ground');
  });

  it('返回首页 → 回 S1', () => {
    const s = run([
      { type: 'SELECT_SCENE', sceneId: 'half' },
      { type: 'CAMERA_FAILED', failure: 'insecure' },
      { type: 'BACK_HOME' },
    ]);
    expect(s.screen).toBe('S1');
  });

  it('拿到照片 → 选中第 1 张且保存状态复位', () => {
    const photos = [new Blob(['a']), new Blob(['b'])];
    const s = run([
      { type: 'SELECT_SCENE', sceneId: 'half' },
      { type: 'GOTO', screen: 'S5' },
      { type: 'SET_PHOTOS', photos },
    ]);
    expect(s.photos).toHaveLength(2);
    expect(s.selectedIndex).toBe(0);
    expect(s.saveState).toBe('idle');
  });

  it('离开 S5 回首页时释放照片', () => {
    const s = run([
      { type: 'SELECT_SCENE', sceneId: 'half' },
      { type: 'SET_PHOTOS', photos: [new Blob(['a'])] },
      { type: 'GOTO', screen: 'S5' },
      { type: 'BACK_HOME' },
    ]);
    expect(s.photos).toHaveLength(0);
    expect(s.selectedIndex).toBe(0);
  });
});

describe('识别降级（SManual）', () => {
  it('识别不可用 → 进 SManual，档案保持不变', () => {
    const s = run([
      { type: 'SELECT_SCENE', sceneId: 'full' },
      { type: 'GOTO', screen: 'S4' },
      { type: 'MODEL_FAILED' },
    ]);
    expect(s.screen).toBe('SManual');
    expect(s.profile).toBe('full_ground');
  });

  it('重试识别 → 回 S4 重新加载模型', () => {
    const s = run([
      { type: 'SELECT_SCENE', sceneId: 'half' },
      { type: 'MODEL_FAILED' },
      { type: 'RETRY_MODELS' },
    ]);
    expect(s.screen).toBe('S4');
    expect(s.failure).toBeNull();
    expect(s.profile).toBe('half');
  });
});

describe('首次引导（SPEC §9.7）', () => {
  it('确认后标记已看过，且不影响当前屏幕', () => {
    const s = run([
      { type: 'SELECT_SCENE', sceneId: 'half' },
      { type: 'GOTO', screen: 'S4' },
      { type: 'SET_ONBOARDING_SEEN' },
    ]);
    expect(s.hasSeenOnboarding).toBe(true);
    expect(s.screen).toBe('S4');
  });

  it('回首页不会重置已看过标记', () => {
    const s = run([{ type: 'SET_ONBOARDING_SEEN' }, { type: 'BACK_HOME' }]);
    expect(s.screen).toBe('S1');
    expect(s.hasSeenOnboarding).toBe(true);
  });
});

describe('模板选择（SELECT_TEMPLATE）', () => {
  it('选模板 → 直接进 S3，跳过 S2', () => {
    const tpl = DEFAULT_TEMPLATES[0];
    const s = run([{ type: 'SELECT_TEMPLATE', template: tpl }]);
    expect(s.screen).toBe('S3');
    expect(s.profile).toBe(tpl.profile.id);
    expect(s.templateProfile).toBe(tpl.profile);
  });

  it('自定义模板的完整 ProfileConfig 被保留（不回退到 PROFILES）', () => {
    const customTpl = {
      ...DEFAULT_TEMPLATES[1],
      profile: { ...DEFAULT_TEMPLATES[1].profile, label: '自定义全身' },
    };
    const s = run([{ type: 'SELECT_TEMPLATE', template: customTpl }]);
    expect(s.templateProfile?.label).toBe('自定义全身');
  });

  it('回首页时清空 templateProfile', () => {
    const s = run([
      { type: 'SELECT_TEMPLATE', template: DEFAULT_TEMPLATES[0] },
      { type: 'BACK_HOME' },
    ]);
    expect(s.templateProfile).toBeNull();
    expect(s.screen).toBe('S1');
  });
});
