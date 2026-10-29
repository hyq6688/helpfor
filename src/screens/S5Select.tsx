// S5 选片页。PRD §4.5：标题 + 横向缩略图（默认第 1 张）+ 下载/分享/重拍/完成。
// 保存结果按 SPEC §9.6 四种文案展示，不得谎报「已保存」。

import { useEffect, useState } from 'react';
import { SCREEN_COPY, UI_COPY } from '../copy';
import { downloadPhoto, sharePhoto, type SaveOutcome } from '../core/save';

interface Props {
  photos: Blob[];
  onRetake: () => void;
  onDone: () => void;
}

const OUTCOME_COPY: Record<SaveOutcome, string> = {
  handedToSystem: UI_COPY.saveHanded,
  cancelled: UI_COPY.saveCancelled,
  failed: UI_COPY.saveFailed,
  downloaded: UI_COPY.saveDownloaded,
};

export default function S5Select({ photos, onRetake, onDone }: Props) {
  // objectURL 必须在 effect 内创建：StrictMode 会「建 → 清 → 再建」，
  // 放在 useMemo 里时第二轮会复用已被 revoke 的 URL，手机端大图就是白屏。
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const next = photos.map((p) => URL.createObjectURL(p));
    setUrls(next);
    return () => {
      for (const url of next) URL.revokeObjectURL(url);
    };
  }, [photos]);

  const [index, setIndex] = useState(0);
  const [outcome, setOutcome] = useState<SaveOutcome | null>(null);
  const [pending, setPending] = useState<'download' | 'share' | null>(null);

  const safeIndex = photos.length > 0 ? Math.min(index, photos.length - 1) : 0;
  const current = photos[safeIndex] ?? null;
  const previewUrl = urls[safeIndex] ?? null;

  const handleDownload = () => {
    if (!current || !previewUrl || pending) return;
    setPending('download');
    setOutcome(downloadPhoto(current, previewUrl));
    setPending(null);
  };

  const handleShare = async () => {
    if (!current || !previewUrl || pending) return;
    setPending('share');
    setOutcome(await sharePhoto(current, previewUrl));
    setPending(null);
  };

  if (!current) {
    return (
      <div className="screen screen--s5">
        <h1 className="h1">{SCREEN_COPY.s5Title}</h1>
        <p className="s5__empty">{UI_COPY.emptyPhotos}</p>
        <div className="s5__actions">
          <button className="primary" onClick={onRetake}>
            {SCREEN_COPY.s5Retake}
          </button>
          <button className="ghost" onClick={onDone}>
            {SCREEN_COPY.s5Done}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen screen--s5">
      <h1 className="h1">{SCREEN_COPY.s5Title}</h1>

      {previewUrl ? (
        <img className="s5__preview" src={previewUrl} alt="" />
      ) : (
        <div className="s5__preview" />
      )}

      <div className="s5__thumbs" role="listbox" aria-label="本次照片">
        {urls.map((url, i) => (
          <button
            key={url}
            type="button"
            role="option"
            aria-selected={i === safeIndex}
            className={`s5__thumb${i === safeIndex ? ' s5__thumb--on' : ''}`}
            onClick={() => setIndex(i)}
          >
            <img src={url} alt="" />
          </button>
        ))}
      </div>

      <p className="s5__toast">{outcome ? OUTCOME_COPY[outcome] : ' '}</p>

      <div className="s5__actions">
        <button className="primary" onClick={handleDownload} disabled={!previewUrl || !!pending}>
          {SCREEN_COPY.s5Download}
        </button>
        <button className="ghost" onClick={handleShare} disabled={!previewUrl || !!pending}>
          {SCREEN_COPY.s5Share}
        </button>
      </div>
      <div className="s5__actions">
        <button className="ghost" onClick={onRetake}>
          {SCREEN_COPY.s5Retake}
        </button>
        <button className="ghost" onClick={onDone}>
          {SCREEN_COPY.s5Done}
        </button>
      </div>
    </div>
  );
}
