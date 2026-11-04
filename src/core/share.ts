// 模板分享链接：始终指向「全部模板 + 该模板详情」的深链。
// 与 hash 路由保持一致，复制/分享出去的链接可以直接打开详情弹层。

export function buildTemplateShareUrl(
  origin: string,
  pathname: string,
  search: string,
  templateId: string,
): string {
  const base = `${origin}${pathname}${search}`;
  return `${base}#/templates/${encodeURIComponent(templateId)}`;
}

/**
 * 优先系统分享，不支持或用户取消时回退复制链接。
 * 返回值用于界面提示；任何异常都不会向上抛。
 */
export async function shareTemplateLink(
  url: string,
  title: string,
): Promise<'shared' | 'copied' | 'failed' | 'cancelled'> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, url });
      return 'shared';
    } catch (error) {
      // 用户主动取消：不再触发复制，避免「关掉分享却弹出已复制」
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
    }
  }
  return (await copyText(url)) ? 'copied' : 'failed';
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 继续走同步回退
  }
  return fallbackCopy(text);
}

function fallbackCopy(text: string): boolean {
  try {
    if (typeof document === 'undefined') return false;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
