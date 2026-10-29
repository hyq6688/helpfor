// 保存（SPEC §9.6）：S5 提供「下载到相册」与「系统分享」两个独立动作。
// 必须用 File 而非裸 Blob；返回四种结果之一，文案映射见 PRD §5.6（不得谎报「已保存」）。

import type { AppState } from '../types';

export type SaveOutcome = Exclude<AppState['saveState'], 'idle'>;

function makeFile(blob: Blob): File {
  return new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
}

/**
 * 直接下载到手机（Android 会落到「下载/相册」，iOS 落到「文件」）。
 * @param objectUrl S5 已为这张照片创建的 objectURL；revoke 统一由 S5 卸载时处理。
 */
export function downloadPhoto(blob: Blob, objectUrl: string): SaveOutcome {
  try {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = makeFile(blob).name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

/**
 * 交给系统分享面板。浏览器不支持分享文件时降级为下载（PRD §5.6）。
 */
export async function sharePhoto(blob: Blob, objectUrl: string): Promise<SaveOutcome> {
  const file = makeFile(blob);

  if (typeof navigator === 'undefined' || !navigator.canShare?.({ files: [file] })) {
    return downloadPhoto(blob, objectUrl);
  }

  try {
    await navigator.share({ files: [file] });
    return 'handedToSystem'; // 无法确认用户是否真的点了「存储图像」
  } catch (err) {
    return (err as { name?: string })?.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}
