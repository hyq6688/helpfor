// 浏览层主题偏好。只通过 <html data-theme> 切换 --wf-* 变量，
// 相机层使用的 Apple token 与红黄绿语义不受影响。

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'shot-guide:theme:v1';

export function parseTheme(value: string | null | undefined): Theme | null {
  return value === 'light' || value === 'dark' ? value : null;
}

export function readStoredTheme(): Theme | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** 跟随系统：无法读取 matchMedia 时按浅色处理。 */
export function systemTheme(): Theme {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** 初始主题：已保存的偏好优先，否则跟随系统。 */
export function resolveInitialTheme(): Theme {
  return readStoredTheme() ?? systemTheme();
}

export function persistTheme(theme: Theme): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // 忽略
  }
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}
