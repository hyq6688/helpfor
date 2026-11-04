// 模板详情弹层：桌面居中双栏 Modal，手机全高 Bottom Sheet。
// 只负责展示、收藏、分享；点「开始取景」交回调用方走原有 SELECT_TEMPLATE → S3 流程。

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import TemplateCover from './TemplateCover';
import { templateTags } from '../core/templateFilters';
import { buildTemplateShareUrl, shareTemplateLink } from '../core/share';
import { SCREEN_COPY, UI_COPY } from '../copy';
import type { Template } from '../types';

interface Props {
  template: Template;
  onClose: () => void;
  onStart: (template: Template) => void;
  favorited: boolean;
  onToggleFavorite: (templateId: string) => void;
}

type ShareState = 'idle' | 'copied' | 'failed';

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M10 16.4 4.6 11.2a3.4 3.4 0 0 1 0-4.9 3.6 3.6 0 0 1 5 0l.4.4.4-.4a3.6 3.6 0 0 1 5 0 3.4 3.4 0 0 1 0 4.9Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M10 3v9M10 3 6.4 6.6M10 3l3.6 3.6M4.5 11.5v4a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function TemplateDetailSheet({
  template,
  onClose,
  onStart,
  favorited,
  onToggleFavorite,
}: Props) {
  const [closing, setClosing] = useState(false);
  const [shareState, setShareState] = useState<ShareState>('idle');
  const [shareUrl, setShareUrl] = useState('');
  const [dragging, setDragging] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragRef = useRef<{ startY: number; offset: number } | null>(null);
  const timerRef = useRef<number | null>(null);

  // 关闭统一走退出过渡；reduced-motion 或动画不可用时立即关闭
  const requestClose = useCallback(() => {
    if (closing) return;
    if (prefersReducedMotion()) {
      onClose();
      return;
    }
    setClosing(true);
    timerRef.current = window.setTimeout(onClose, 180);
  }, [closing, onClose]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    document.addEventListener('keydown', onKeyDown);
    // 冻结背后的内容区滚动；相机页不经过这里，不受影响
    const main = document.querySelector<HTMLElement>('.wf-main');
    const previousOverflow = main?.style.overflow;
    if (main) main.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (main) main.style.overflow = previousOverflow ?? '';
    };
  }, [requestClose]);

  const onHandlePointerDown = (event: PointerEvent<HTMLSpanElement>) => {
    if (window.matchMedia('(min-width: 768px)').matches) return;
    dragRef.current = { startY: event.clientY, offset: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onHandlePointerMove = (event: PointerEvent<HTMLSpanElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const offset = Math.max(0, event.clientY - drag.startY);
    drag.offset = offset;
    setDragY(offset);
  };

  const onHandlePointerEnd = (event: PointerEvent<HTMLSpanElement>) => {
    if (!dragRef.current) return;
    const offset = dragRef.current.offset;
    dragRef.current = null;
    setDragging(false);
    if (offset > 120) {
      // 先复位内联位移，再走统一的退出动画，避免从拖拽位置跳到动画起点
      setDragY(0);
      requestClose();
    } else {
      setDragY(0);
    }
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // 指针已释放时忽略
    }
  };

  const onShare = async () => {
    const url = buildTemplateShareUrl(
      window.location.origin,
      window.location.pathname,
      window.location.search,
      template.id,
    );
    setShareUrl(url);
    const result = await shareTemplateLink(url, template.name);
    if (result === 'copied') setShareState('copied');
    else if (result === 'failed') setShareState('failed');
  };

  const steps = template.profile.briefing.slice(0, 3);
  const tags = templateTags(template);

  return (
    <div
      className={`wf-sheet${closing ? ' wf-sheet--closing' : ''}`}
      role="presentation"
      onClick={requestClose}
    >
      <div
        className={`wf-sheet__panel${closing ? ' wf-sheet__panel--closing' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wf-sheet-title"
        onClick={(event) => event.stopPropagation()}
        style={
          dragY > 0
            ? { transform: `translateY(${dragY}px)`, transition: dragging ? 'none' : undefined }
            : undefined
        }
      >
        <span
          className={`wf-sheet__handle${dragging ? ' wf-sheet__handle--dragging' : ''}`}
          aria-hidden="true"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerEnd}
          onPointerCancel={onHandlePointerEnd}
        />
        <button className="wf-sheet__close" onClick={requestClose} aria-label={UI_COPY.close}>
          ×
        </button>

        <div className="wf-sheet__media">
          <TemplateCover url={template.coverUrl} name={template.name} />
        </div>

        <div className="wf-sheet__info">
          <h2 className="wf-sheet__name" id="wf-sheet-title">
            {template.name}
          </h2>
          {template.description && <p className="wf-sheet__desc">{template.description}</p>}

          <div className="wf-sheet__tags">
            {tags.map((tag) => (
              <span className="wf-sheet__tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>

          <p className="wf-sheet__section">{UI_COPY.detailSteps}</p>
          <ol className="wf-sheet__steps">
            {steps.map((step, index) => (
              <li className="wf-sheet__step" key={step}>
                <span className="wf-sheet__num" aria-hidden="true">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <div className="wf-sheet__actions">
            <button
              className="btn btn--primary wf-sheet__start"
              onClick={() => onStart(template)}
            >
              {SCREEN_COPY.s3Start}
            </button>

            <div className="wf-sheet__secondary">
              <button
                className={`btn wf-sheet__fav${favorited ? ' wf-sheet__fav--on' : ''}`}
                onClick={() => onToggleFavorite(template.id)}
                aria-pressed={favorited}
              >
                <HeartIcon filled={favorited} />
                {favorited ? UI_COPY.favorited : UI_COPY.favorite}
              </button>
              <button className="btn btn--ghost wf-sheet__share" onClick={onShare}>
                <ShareIcon />
                {UI_COPY.share}
              </button>
            </div>

            {shareState !== 'idle' && (
              <p
                className={`wf-sheet__toast${
                  shareState === 'failed' ? ' wf-sheet__toast--error' : ''
                }`}
                role="status"
              >
                {shareState === 'failed' ? UI_COPY.shareFailed : UI_COPY.shareCopied}
                {shareState === 'failed' && shareUrl && (
                  <span className="wf-sheet__shareurl">{shareUrl}</span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
