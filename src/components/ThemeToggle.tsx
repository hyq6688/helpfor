// 浏览层主题切换按钮：浅色默认米白，深色藏青。
// 只切换 <html data-theme>，不影响相机层使用的 Apple token 与红黄绿。

import { useEffect, useState } from 'react';
import { applyTheme, persistTheme, resolveInitialTheme } from '../core/theme';
import type { Theme } from '../core/theme';
import { UI_COPY } from '../copy';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => resolveInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    persistTheme(next);
    setTheme(next);
  };

  return (
    <button
      className="wf-theme__toggle"
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? UI_COPY.themeToLight : UI_COPY.themeToDark}
      title={theme === 'dark' ? UI_COPY.themeToLight : UI_COPY.themeToDark}
      aria-pressed={theme === 'dark'}
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M10 2.2v1.6M10 16.2v1.6M2.2 10h1.6M16.2 10h1.6M4.5 4.5l1.1 1.1M14.4 14.4l1.1 1.1M15.5 4.5l-1.1 1.1M5.6 14.4l-1.1 1.1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="M15.8 12.2A6.4 6.4 0 0 1 7.8 4.2a6.4 6.4 0 1 0 8 8Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
