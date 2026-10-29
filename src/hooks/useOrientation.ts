// 设备方向（水平仪）。对应 SPEC §9.1 的 <LevelIndicator> 与 §8.3 的 tilt 规则。
// 只做竖屏：S4 容器为 100vw × 100dvh，手机左右歪 = gamma 的正负。

import { useEffect, useRef, useState } from 'react';
import { EMA_ALPHA } from '../constants';
import { ema } from '../core/smoothing';

export interface OrientationState {
  rollDeg: number; // 有符号；右倾为正
  available: boolean; // 未授权 / 无传感器时为 false，tilt 规则不触发（SPEC §11 第 8 条）
}

/**
 * iOS 13+ 必须由用户手势触发授权。S3 的「开始取景」点击里调用；
 * 非 iOS（无 requestPermission）直接视为可用。失败不阻塞流程。
 */
export async function requestOrientationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return false;
  const ctor = DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  };
  if (typeof ctor.requestPermission !== 'function') return true;
  try {
    return (await ctor.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

export function useOrientation(): OrientationState {
  const [state, setState] = useState<OrientationState>({ rollDeg: 0, available: false });
  const smoothRef = useRef<number | null>(null);
  const lastAtRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;

    const onOrient = (e: DeviceOrientationEvent) => {
      if (typeof e.gamma !== 'number') return;
      const now = performance.now();
      if (now - lastAtRef.current < 50) return; // 20Hz 足够，省电
      lastAtRef.current = now;
      const roll = ema(smoothRef.current, e.gamma, EMA_ALPHA);
      smoothRef.current = roll;
      setState((prev) =>
        prev.available && Math.abs(prev.rollDeg - roll) < 0.05 ? prev : { rollDeg: roll, available: true },
      );
    };

    window.addEventListener('deviceorientation', onOrient);
    return () => window.removeEventListener('deviceorientation', onOrient);
  }, []);

  return state;
}
