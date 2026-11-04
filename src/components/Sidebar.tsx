// 桌面侧栏：268px，可折叠到 76px；移动端由 CSS 隐藏。
// 导航只覆盖浏览类页面，相机流程不经过这里。

import BrandMark from './BrandMark';
import type { BrowseScreen } from './AppShell';

interface Props {
  active: BrowseScreen;
  onNavigate: (screen: BrowseScreen) => void;
  isAdminUser: boolean;
  accountInitial: string | null;
  onOpenAccount: () => void;
  collapsed: boolean;
  onToggle: () => void;
}

const ITEMS: Array<{ id: BrowseScreen; label: string; icon: JSX.Element }> = [
  {
    id: 'S1',
    label: '首页',
    icon: (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path
          d="M3.5 8.2 10 3l6.5 5.2V16a1 1 0 0 1-1 1h-3.6v-4.6H8.1V17H4.5a1 1 0 0 1-1-1V8.2Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'AllTemplates',
    label: '全部模板',
    icon: (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="3" y="3" width="6" height="6" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect x="11" y="3" width="6" height="6" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect x="3" y="11" width="6" height="6" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect x="11" y="11" width="6" height="6" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    id: 'Favorites',
    label: '我的收藏',
    icon: (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path
          d="M10 16.4 4.6 11.2a3.4 3.4 0 0 1 0-4.9 3.6 3.6 0 0 1 5 0l.4.4.4-.4a3.6 3.6 0 0 1 5 0 3.4 3.4 0 0 1 0 4.9Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: 'Admin',
    label: '模板管理',
    icon: (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M4 6h12M4 10h12M4 14h8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="15.5" cy="14" r="1.7" fill="currentColor" />
      </svg>
    ),
  },
];

export default function Sidebar({
  active,
  onNavigate,
  isAdminUser,
  accountInitial,
  onOpenAccount,
  collapsed,
  onToggle,
}: Props) {
  const items = ITEMS.filter((item) => item.id !== 'Admin' || isAdminUser);

  return (
    <aside className="wf-sidebar" aria-label="主导航">
      <div className="wf-sidebar__brand">
        <BrandMark showWord={!collapsed} />
        <button
          className="wf-sidebar__toggle"
          onClick={onToggle}
          aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
          title={collapsed ? '展开侧栏' : '收起侧栏'}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path
              d={collapsed ? 'M7 4l6 6-6 6' : 'M13 4 7 10l6 6'}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <nav className="wf-nav">
        {items.map((item) => (
          <button
            key={item.id}
            className={`wf-nav__item${active === item.id ? ' wf-nav__item--on' : ''}`}
            onClick={() => onNavigate(item.id)}
            title={collapsed ? item.label : undefined}
          >
            <span className="wf-nav__icon">{item.icon}</span>
            <span className="wf-nav__label">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="wf-sidebar__foot">
        <span className="wf-sidebar__kicker">FRAME IT RIGHT</span>
        <button
          className={`wf-sidebar__account${active === 'Account' ? ' wf-sidebar__account--on' : ''}`}
          onClick={onOpenAccount}
          title={collapsed ? '账号' : undefined}
        >
          <span className="wf-sidebar__avatar" aria-hidden="true">
            {accountInitial ?? '我'}
          </span>
          <span className="wf-sidebar__account-label">账号</span>
        </button>
      </div>
    </aside>
  );
}
