// EMA 平滑。对应 SPEC §5.1：平滑必须在「视频 → 容器」换算之后，
// 否则 dx/dy 的物理含义会被缩放比例污染。纯函数，便于单测。

import { EMA_ALPHA } from '../constants';
import type { Box, Point } from '../types';

export function ema(prev: number | null, next: number, alpha = EMA_ALPHA): number {
  return prev === null ? next : prev * (1 - alpha) + next * alpha;
}

export function emaBox(prev: Box | null, next: Box, alpha = EMA_ALPHA): Box {
  if (!prev) return next;
  return {
    x: ema(prev.x, next.x, alpha),
    y: ema(prev.y, next.y, alpha),
    w: ema(prev.w, next.w, alpha),
    h: ema(prev.h, next.h, alpha),
  };
}

export function emaPoint(prev: Point | null, next: Point, alpha = EMA_ALPHA): Point {
  if (!prev) return next;
  return { x: ema(prev.x, next.x, alpha), y: ema(prev.y, next.y, alpha) };
}
