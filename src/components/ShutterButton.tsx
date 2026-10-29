// 快门。SPEC §9.3：外层热区 88×88 负责事件，内层 72 只负责视觉；
// 长按只在非绿色时生效，且必须有进度环，否则摄影师不知道自己在触发什么。

import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { LONG_PRESS_MS } from '../constants';

interface Props {
  isGreen: boolean;
  disabled?: boolean;
  onCapture: () => void;
}

const RING_CIRCUMFERENCE = 2 * Math.PI * 42;

export default function ShutterButton({ isGreen, disabled = false, onCapture }: Props) {
  const timerRef = useRef<number | null>(null);
  const suppressTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const [pressing, setPressing] = useState(false);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const suppressNextClick = () => {
    suppressClickRef.current = true;
    // pointerup 之后 click 会立刻到达；万一没到达（手指移出），1s 后自愈
    suppressTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
      suppressTimerRef.current = null;
    }, 1000);
  };

  const handleDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (isGreen) return; // 绿色时只认 click，避免点击 + 长按双触发

    setPressing(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      suppressNextClick();
      setPressing(false);
      onCapture();
    }, LONG_PRESS_MS);
  };

  const handleUp = () => {
    clearTimer();
    setPressing(false);
  };

  const handleClick = () => {
    if (disabled) return;
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      if (suppressTimerRef.current !== null) {
        window.clearTimeout(suppressTimerRef.current);
        suppressTimerRef.current = null;
      }
      return;
    }
    if (isGreen) onCapture();
  };

  return (
    <button
      type="button"
      className={`shutter${disabled ? ' shutter--disabled' : ''}`}
      aria-label="快门"
      disabled={disabled}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onPointerLeave={handleUp}
      onClick={handleClick}
    >
      <svg className="shutter__ring" viewBox="0 0 88 88" aria-hidden="true">
        <circle
          className="shutter__progress"
          cx="44"
          cy="44"
          r="42"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={pressing ? 0 : RING_CIRCUMFERENCE}
          style={
            pressing
              ? { transition: `stroke-dashoffset ${LONG_PRESS_MS}ms linear` }
              : undefined
          }
        />
      </svg>
      <span className="shutter__visual">
        <span className="shutter__dot" />
      </span>
    </button>
  );
}
