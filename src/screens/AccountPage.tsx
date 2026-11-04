// 账号中心：浏览层外壳内，资料 / 安全 / 关于三个 Tab。
// 资料只展示邮箱与登录状态；安全复用现有 SetPasswordModal；关于按 is_admin 显示管理入口。

import { useState } from 'react';
import pkg from '../../package.json';
import { isAdmin, useAuth } from '../context/AuthContext';
import SetPasswordModal from './SetPasswordModal';
import { LoadingState } from '../components/StateFeedback';
import { BRAND_COPY, UI_COPY } from '../copy';

type TabId = 'profile' | 'security' | 'about';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'profile', label: UI_COPY.accountProfile },
  { id: 'security', label: UI_COPY.accountSecurity },
  { id: 'about', label: UI_COPY.accountAbout },
];

function GuestIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4.8 19.5c.7-3.4 3.6-5.2 7.2-5.2s6.5 1.8 7.2 5.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface Props {
  onLogin: () => void;
  onOpenAdmin: () => void;
  onOpenFavorites: () => void;
}

export default function AccountPage({ onLogin, onOpenAdmin, onOpenFavorites }: Props) {
  const { user, loading, signOut } = useAuth();
  const [tab, setTab] = useState<TabId>('profile');
  const [showSetPassword, setShowSetPassword] = useState(false);

  if (loading) {
    return (
      <div className="wf-page wf-accountpage">
        <LoadingState label={UI_COPY.templatesLoading} />
      </div>
    );
  }

  const initial = (user?.email ?? '').charAt(0).toUpperCase();

  return (
    <div className="wf-page wf-accountpage">
      <header className="wf-accountpage__head">
        <div className="wf-avatar" aria-hidden="true">
          {user ? initial : <GuestIcon />}
        </div>
        <div className="wf-accountpage__ident">
          <p className="wf-accountpage__email">{user?.email ?? UI_COPY.accountLoggedOut}</p>
          <p className="wf-accountpage__state">
            {user ? UI_COPY.accountLoggedIn : UI_COPY.accountGuestMode}
          </p>
        </div>
      </header>

      <div className="wf-tabbar" role="tablist" aria-label="账号设置">
        {TABS.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            className={`wf-tab${tab === item.id ? ' wf-tab--on' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <section className="wf-panel" aria-label={UI_COPY.accountProfile}>
          <div className="wf-kv">
            <span className="wf-kv__k">{UI_COPY.accountEmail}</span>
            <span className="wf-kv__v">{user?.email ?? '—'}</span>
          </div>
          <div className="wf-kv">
            <span className="wf-kv__k">{UI_COPY.accountLoginState}</span>
            <span className="wf-kv__v">
              {user ? UI_COPY.accountLoggedIn : UI_COPY.accountLoggedOut}
            </span>
          </div>
          <div className="wf-accountpage__block">
            <h3 className="wf-accountpage__h3">{UI_COPY.favoritesEntry}</h3>
            <p className="wf-accountpage__note">{UI_COPY.accountFavoritesTip}</p>
            <button className="btn btn--ghost" onClick={onOpenFavorites}>
              {UI_COPY.favoritesEntry}
            </button>
          </div>
          {user && <p className="wf-accountpage__note">{UI_COPY.accountAvatarNote}</p>}
          {!user && (
            <>
              <p className="wf-accountpage__note">{UI_COPY.accountGuestHint}</p>
              <div className="wf-accountpage__actions">
                <button className="btn btn--primary" onClick={onLogin}>
                  {UI_COPY.login}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {tab === 'security' && (
        <section className="wf-panel" aria-label={UI_COPY.accountSecurity}>
          {user ? (
            <>
              <div className="wf-accountpage__block">
                <h3 className="wf-accountpage__h3">{UI_COPY.setPasswordEntry}</h3>
                <p className="wf-accountpage__note">{UI_COPY.accountSetPasswordTip}</p>
                <button className="btn btn--ghost" onClick={() => setShowSetPassword(true)}>
                  {UI_COPY.setPasswordEntry}
                </button>
              </div>
              <div className="wf-accountpage__block">
                <h3 className="wf-accountpage__h3">{UI_COPY.logout}</h3>
                <p className="wf-accountpage__note">{UI_COPY.accountSignOutTip}</p>
                <button className="btn btn--danger" onClick={() => void signOut()}>
                  {UI_COPY.logout}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="wf-accountpage__note">{UI_COPY.accountGuestHint}</p>
              <div className="wf-accountpage__actions">
                <button className="btn btn--primary" onClick={onLogin}>
                  {UI_COPY.login}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {tab === 'about' && (
        <section className="wf-panel" aria-label={UI_COPY.accountAbout}>
          <div className="wf-kv">
            <span className="wf-kv__k">{UI_COPY.accountVersion}</span>
            <span className="wf-kv__v">v{pkg.version}</span>
          </div>
          <div className="wf-kv">
            <span className="wf-kv__k">{BRAND_COPY.name}</span>
            <span className="wf-kv__v">{BRAND_COPY.fullName}</span>
          </div>
          <p className="wf-accountpage__note">{UI_COPY.accountAboutBrand}</p>
          {isAdmin(user) && (
            <div className="wf-accountpage__actions">
              <button className="btn btn--primary" onClick={onOpenAdmin}>
                {UI_COPY.accountAdminEntry}
              </button>
            </div>
          )}
        </section>
      )}

      {showSetPassword && <SetPasswordModal onClose={() => setShowSetPassword(false)} />}
    </div>
  );
}
