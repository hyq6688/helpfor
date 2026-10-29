import { afterEach, describe, expect, it } from 'vitest';
import { downloadPhoto, sharePhoto } from './save';

const blob = new Blob(['jpeg'], { type: 'image/jpeg' });

function stubShare(impl: (() => Promise<void>) | null, canShare: boolean): void {
  Object.defineProperty(navigator, 'canShare', {
    value: canShare ? () => true : undefined,
    configurable: true,
  });
  Object.defineProperty(navigator, 'share', {
    value: impl ?? undefined,
    configurable: true,
  });
}

function stubDocument(click: () => void): void {
  (globalThis as unknown as { document: unknown }).document = {
    createElement: () => ({
      href: '',
      download: '',
      rel: '',
      click,
      remove() {},
    }),
    body: { appendChild() {} },
  };
}

afterEach(() => {
  Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  delete (globalThis as unknown as { document?: unknown }).document;
});

describe('downloadPhoto', () => {
  it('触发下载 → downloaded', () => {
    const clicked: string[] = [];
    stubDocument(() => clicked.push('click'));
    expect(downloadPhoto(blob, 'blob:x')).toBe('downloaded');
    expect(clicked).toEqual(['click']);
  });

  it('下载抛错 → failed', () => {
    stubDocument(() => {
      throw new Error('blocked');
    });
    expect(downloadPhoto(blob, 'blob:x')).toBe('failed');
  });
});

describe('sharePhoto', () => {
  it('分享面板成功 → handedToSystem', async () => {
    stubShare(async () => undefined, true);
    expect(await sharePhoto(blob, 'blob:x')).toBe('handedToSystem');
  });

  it('用户取消 → cancelled', async () => {
    stubShare(async () => {
      throw Object.assign(new Error('abort'), { name: 'AbortError' });
    }, true);
    expect(await sharePhoto(blob, 'blob:x')).toBe('cancelled');
  });

  it('系统拒绝 → failed', async () => {
    stubShare(async () => {
      throw new TypeError('nope');
    }, true);
    expect(await sharePhoto(blob, 'blob:x')).toBe('failed');
  });

  it('不支持分享 → 下载兜底', async () => {
    stubShare(null, false);
    const clicked: string[] = [];
    stubDocument(() => clicked.push('click'));
    expect(await sharePhoto(blob, 'blob:x')).toBe('downloaded');
    expect(clicked).toEqual(['click']);
  });
});
