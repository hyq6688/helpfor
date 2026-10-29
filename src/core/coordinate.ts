// 坐标换算：视频归一化 → 容器归一化（object-fit: cover）。对应 SPEC §6。
// 任何依赖朝向的假设都不允许出现，一律用 videoEl.videoWidth / videoHeight 的实际值。

import type { Box, Point } from '../types';

export function videoBoxToContainer(
  box: Box,
  vw: number,
  vh: number,
  cw: number,
  ch: number,
): Box {
  const scale = Math.max(cw / vw, ch / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const offsetX = (cw - dw) / 2; // 负值
  const offsetY = (ch - dh) / 2;
  const px = box.x * vw;
  const py = box.y * vh;
  const pw = box.w * vw;
  const ph = box.h * vh;
  const cx = px * scale + offsetX;
  const cy = py * scale + offsetY;
  return { x: cx / cw, y: cy / ch, w: (pw * scale) / cw, h: (ph * scale) / ch };
}

export function videoPointToContainer(
  p: Point,
  vw: number,
  vh: number,
  cw: number,
  ch: number,
): Point {
  const scale = Math.max(cw / vw, ch / vh);
  const offsetX = (cw - vw * scale) / 2;
  const offsetY = (ch - vh * scale) / 2;
  return { x: (p.x * vw * scale + offsetX) / cw, y: (p.y * vh * scale + offsetY) / ch };
}
