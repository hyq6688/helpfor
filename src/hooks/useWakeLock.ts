// 屏幕常亮。SPEC §11 第 8 条：失败一律忽略，不阻塞、不跳页。
// 切后台时系统会自动释放，回到前台需要重新申请。

import { useEffect } from 'react';

export function useWakeLock(active = true): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let cancelled = false;
    let sentinel: WakeLockSentinel | null = null;

    const acquire = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void sentinel.release();
          sentinel = null;
        }
      } catch {
        // 低电量 / 不支持 / 页面不可见：忽略
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release().catch(() => undefined);
      sentinel = null;
    };
  }, [active]);
}
