// 统一状态组件：加载中（转圈，不用骨架屏）、空态、错误提示。
// 全部模板页与管理页复用，避免各页各写一套。

import type { ReactNode } from 'react';

export function LoadingState({ label = '正在加载…' }: { label?: string }) {
  return (
    <div className="wf-state" role="status" aria-live="polite">
      <span className="wf-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  text?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

/** 默认图标：虚线取景框，与模板主题一致。 */
function DefaultEmptyIcon() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <rect
        x="7"
        y="7"
        width="26"
        height="26"
        rx="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M14 25l5-6 4 5 3-3 4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function EmptyState({ title, text, actionLabel, onAction, icon }: EmptyStateProps) {
  return (
    <div className="wf-empty">
      <div className="wf-empty__icon" aria-hidden="true">
        {icon ?? <DefaultEmptyIcon />}
      </div>
      <p className="wf-empty__title">{title}</p>
      {text && <p className="wf-empty__text">{text}</p>}
      {actionLabel && onAction && (
        <button className="btn btn--ghost wf-empty__action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

interface ErrorNoticeProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** 行内错误提示，可选「重试」；不遮挡页面其他内容。 */
export function ErrorNotice({ message, actionLabel, onAction }: ErrorNoticeProps) {
  return (
    <div className="wf-notice wf-notice--error" role="alert">
      <span className="wf-notice__mark" aria-hidden="true">
        !
      </span>
      <span className="wf-notice__text">{message}</span>
      {actionLabel && onAction && (
        <button className="wf-notice__action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
