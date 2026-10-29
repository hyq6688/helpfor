// 抓帧。对应 SPEC §9.5：cover 裁剪 + dpr 上限，所见即所得。

import { JPEG_QUALITY, MAX_DPR } from '../constants';

export interface SourceRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** 容器（object-fit: cover）里实际可见的那块视频像素区域。 */
export function coverSourceRect(vw: number, vh: number, cw: number, ch: number): SourceRect {
  const scale = Math.max(cw / vw, ch / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const offsetX = (cw - dw) / 2; // 负值
  const offsetY = (ch - dh) / 2;
  const sx = Math.min(Math.max(-offsetX / scale, 0), vw);
  const sy = Math.min(Math.max(-offsetY / scale, 0), vh);
  const sw = Math.min(cw / scale, vw - sx);
  const sh = Math.min(ch / scale, vh - sy);
  return { sx, sy, sw, sh };
}

/** 把当前帧按屏幕所见裁剪成 JPEG。失败（未就绪 / 无 ctx / toBlob 为 null）返回 null。 */
export function grabFrame(video: HTMLVideoElement, dprCap: number = MAX_DPR): Promise<Blob | null> {
  if (video.readyState < 2) return Promise.resolve(null);
  const cw = video.clientWidth;
  const ch = video.clientHeight;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!cw || !ch || !vw || !vh) return Promise.resolve(null);

  const rect = coverSourceRect(vw, vh, cw, ch);
  if (rect.sw <= 0 || rect.sh <= 0) return Promise.resolve(null);

  const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);

  ctx.drawImage(video, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', JPEG_QUALITY);
  });
}
