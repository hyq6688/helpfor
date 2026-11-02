// 模板封面：轮廓占位打底，有图时叠在上面；图片加载失败只隐藏 img。
// S1 四宫格与「全部模板」页共用。

interface Props {
  url: string;
  name: string;
}

export default function TemplateCover({ url, name }: Props) {
  return (
    <div className="tpl-cover">
      <svg viewBox="0 0 100 140" aria-hidden="true" className="tpl-cover__placeholder">
        <g fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.35">
          <circle cx="50" cy="38" r="16" />
          <path d="M22 130 Q22 92 50 90 Q78 92 78 130" />
        </g>
      </svg>
      {url && (
        <img
          src={url}
          alt={name}
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      )}
    </div>
  );
}
