// 取景轮廓。SPEC §9.2：位置由 targetBox × 容器尺寸决定，虚线只做对齐参考，不接收事件。
//
// viewBox 的纵向高度按目标框的实际像素纵横比换算（100 × boxH·ch / boxW·cw），
// 配合 preserveAspectRatio="none"，使 x / y 两个方向的缩放比例相同：
// 头部圆形不会被拉成椭圆，同时轮廓正好铺满目标框。

import { useEffect, useState } from 'react';
import type { ProfileConfig } from '../types';

export default function Silhouette({ profile }: { profile: ProfileConfig }) {
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const box = profile.targetBox;
  const aspect = vp.w > 0 ? 100 * ((box.h * vp.h) / (box.w * vp.w)) : 100;
  const a = aspect;

  const head =
    profile.silhouettePath === 'half'
      ? { cy: 0.15 * a, r: 0.075 * a }
      : { cy: 0.075 * a, r: 0.055 * a };

  return (
    <svg
      className="silhouette"
      style={{
        left: `${box.x * 100}%`,
        top: `${box.y * 100}%`,
        width: `${box.w * 100}%`,
        height: `${box.h * 100}%`,
      }}
      viewBox={`0 0 100 ${a}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeDasharray="5 4"
        strokeLinecap="round"
      >
        <circle cx="50" cy={head.cy} r={head.r} />

        {profile.silhouettePath === 'half' && (
          <path
            d={`M 10 ${a} C 10 ${0.52 * a} 24 ${0.3 * a} 50 ${0.3 * a} C 76 ${0.3 * a} 90 ${0.52 * a} 90 ${a}`}
          />
        )}

        {profile.silhouettePath !== 'half' && (
          <>
            <path d={`M 50 ${0.13 * a} V ${0.45 * a}`} />
            <path d={`M 16 ${0.38 * a} L 50 ${0.21 * a} L 84 ${0.38 * a}`} />
            {profile.silhouettePath === 'full' ? (
              <>
                <path d={`M 50 ${0.45 * a} L 32 ${0.94 * a} M 50 ${0.45 * a} L 68 ${0.94 * a}`} />
                <path d={`M 26 ${0.96 * a} L 36 ${0.94 * a} M 64 ${0.94 * a} L 74 ${0.96 * a}`} />
                <path d={`M 8 ${0.975 * a} H 92`} />
              </>
            ) : (
              // 不拍脚：腿线在框底保持开口，不画脚
              <path d={`M 50 ${0.45 * a} L 30 ${a} M 50 ${0.45 * a} L 70 ${a}`} />
            )}
          </>
        )}
      </g>
    </svg>
  );
}
