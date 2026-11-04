// 轻量 hash 路由：只覆盖浏览层，相机屏幕不进入 URL。
// 解析与生成都是纯函数，便于单测；App 负责与 useReducer 屏幕状态机同步。

import type { ScreenId } from '../types';

export type RouteName = 'home' | 'templates' | 'account' | 'admin' | 'favorites';

export interface HashRoute {
  name: RouteName;
  /** 仅 templates 路由可能带模板 id，用于深链打开详情弹层。 */
  templateId: string | null;
}

const ROUTE_TO_SCREEN: Record<RouteName, ScreenId> = {
  home: 'S1',
  templates: 'AllTemplates',
  account: 'Account',
  admin: 'Admin',
  favorites: 'Favorites',
};

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** 解析 location.hash；无法识别或空值统一回首页，保证刷新不白屏。 */
export function parseHash(raw: string): HashRoute {
  const clean = raw.replace(/^#/, '').split('?')[0];
  const segments = clean.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);

  if (segments.length === 0) return { name: 'home', templateId: null };

  switch (segments[0]) {
    case 'templates':
      return {
        name: 'templates',
        templateId: segments[1] ? decode(segments[1]) : null,
      };
    case 'account':
      return { name: 'account', templateId: null };
    case 'admin':
      return { name: 'admin', templateId: null };
    case 'favorites':
      return { name: 'favorites', templateId: null };
    default:
      return { name: 'home', templateId: null };
  }
}

/** 路由 → 屏幕；仅浏览层使用，相机屏幕不会调用这里。 */
export function screenForRoute(name: RouteName): ScreenId {
  return ROUTE_TO_SCREEN[name];
}

/** 屏幕/模板 → hash；相机屏幕返回 null，调用方保持原 URL 不变。 */
export function hashFor(name: RouteName, templateId?: string | null): string {
  if (name === 'home') return '#/';
  if (name === 'templates') {
    return templateId ? `#/templates/${encodeURIComponent(templateId)}` : '#/templates';
  }
  return `#/${name}`;
}

/** 浏览屏幕对应的 hash；其它屏幕（S3/S4/S5 等）返回 null。 */
export function hashForScreen(screen: ScreenId, templateId?: string | null): string | null {
  switch (screen) {
    case 'S1':
      return hashFor('home');
    case 'AllTemplates':
      return hashFor('templates', templateId);
    case 'Account':
      return hashFor('account');
    case 'Admin':
      return hashFor('admin');
    case 'Favorites':
      return hashFor('favorites');
    default:
      return null;
  }
}
