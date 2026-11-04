// 品牌标识：蓝色方框 + 白色取景角 + 字标「无所谓风」。
// P0 只用于浏览层（侧栏 / 首页品牌头 / 登录页），相机层不出现。

interface Props {
  /** 紧凑模式：更小的标记与字号，用于首页品牌头与登录卡片。 */
  compact?: boolean;
  /** 是否显示中文wordmark；false 时只显示方标。 */
  showWord?: boolean;
}

export default function BrandMark({ compact = false, showWord = true }: Props) {
  return (
    <span className={`wf-brand${compact ? ' wf-brand--compact' : ''}`}>
      <svg className="wf-brand__mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#3347FF" />
        <path
          d="M9 14V10.5A1.5 1.5 0 0 1 10.5 9H14M18 9h3.5A1.5 1.5 0 0 1 23 10.5V14M23 18v3.5a1.5 1.5 0 0 1-1.5 1.5H18M14 23h-3.5A1.5 1.5 0 0 1 9 21.5V18"
          fill="none"
          stroke="#FEFEFB"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="16" cy="16" r="2.2" fill="#FEFEFB" />
      </svg>
      {showWord && <span className="wf-brand__word">无所谓风</span>}
    </span>
  );
}
