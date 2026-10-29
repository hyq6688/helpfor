// 拍摄流程（S4 与 SManual 共用）。SPEC §9.4：
// 3 秒倒计时 → 5 张连拍；期间暂停规则播报；15s 看门狗；0 张也交出去（S5 空态）。

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from 'react';
import { BURST_COUNT, BURST_INTERVAL_MS, COUNTDOWN_WATCHDOG_MS } from '../constants';
import { COUNTDOWN_COPY } from '../copy';
import { grabFrame } from '../core/capture';
import { pauseRuleVoice, resumeRuleVoice, speak } from './useSpeech';

export type CapturePhase = 'idle' | 'countdown' | 'burst';

export interface CaptureApi {
  phase: CapturePhase;
  countdown: number | null;
  busy: boolean;
  /** 同步可用：状态更新是异步的，规则/语音拦截必须看 ref。 */
  busyRef: MutableRefObject<boolean>;
  capture: () => void;
}

const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export function useCapture(
  videoRef: RefObject<HTMLVideoElement | null>,
  onCaptured: (photos: Blob[]) => void,
): CaptureApi {
  const [phase, setPhase] = useState<CapturePhase>('idle');
  const [countdown, setCountdown] = useState<number | null>(null);
  const busyRef = useRef(false);
  const aliveRef = useRef(true);
  const onCapturedRef = useRef(onCaptured);
  onCapturedRef.current = onCaptured;

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      resumeRuleVoice(); // 卸载时别把规则播报永久静音
    };
  }, []);

  const capture = useCallback(() => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPhase('countdown');
    pauseRuleVoice();

    let finished = false;
    let watchdog = 0;

    const reset = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(watchdog);
      busyRef.current = false;
      resumeRuleVoice();
      if (!aliveRef.current) return;
      setPhase('idle');
      setCountdown(null);
    };

    watchdog = window.setTimeout(reset, COUNTDOWN_WATCHDOG_MS);

    void (async () => {
      for (const item of COUNTDOWN_COPY) {
        if (!aliveRef.current || finished) {
          reset();
          return;
        }
        setCountdown(Number(item.digit));
        speak(item.voice, { bypassThrottle: true }); // 倒计时通道不受节流影响
        await delay(1000);
        if (finished) return;
      }

      setCountdown(null);
      setPhase('burst');

      const blobs: Blob[] = [];
      for (let i = 0; i < BURST_COUNT; i++) {
        const video = videoRef.current;
        if (!video || !aliveRef.current || finished) break;
        const blob = await grabFrame(video);
        if (blob) blobs.push(blob);
        if (i < BURST_COUNT - 1) await delay(BURST_INTERVAL_MS);
      }

      if (!aliveRef.current || finished) {
        reset();
        return;
      }
      finished = true;
      window.clearTimeout(watchdog);
      busyRef.current = false;
      resumeRuleVoice();
      if (aliveRef.current) {
        setPhase('idle');
        setCountdown(null);
      }
      onCapturedRef.current(blobs); // 0 张也进 S5 空态（SPEC §9.5）
    })();
  }, [videoRef]);

  return { phase, countdown, busy: phase !== 'idle', busyRef, capture };
}
