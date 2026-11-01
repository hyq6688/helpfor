// 屏幕路由。SPEC §2：App 用 useReducer 管理 AppState，screen 决定渲染哪个屏幕，不使用 URL 路由。

import { useCallback, useReducer, useState } from 'react';
import S1TemplateList from './screens/S1TemplateList';
import S2IncludeGround from './screens/S2IncludeGround';
import S3Handoff from './screens/S3Handoff';
import S4Guide from './screens/S4Guide';
import S5Select from './screens/S5Select';
import SFallback from './screens/SFallback';
import SManual from './screens/SManual';
import AdminTemplates from './screens/AdminTemplates';
import LoginModal from './screens/LoginModal';
import SetPasswordModal from './screens/SetPasswordModal';
import type { CameraFailureKind } from './hooks/useCamera';
import { PROFILES } from './profiles';
import { initialState, markOnboardingSeen, reducer } from './state';
import type { ScreenId } from './types';
import { isAdmin, useAuth } from './context/AuthContext';
import { UI_COPY } from './copy';

// 阶段 3 尚未接入的屏幕（S5 起在后续阶段实现），仅占位以免流程断在代码里。
function Pending({ screen }: { screen: ScreenId }) {
  return (
    <div className="screen screen--center">
      <p className="small">{screen} 尚未接入</p>
    </div>
  );
}

/** S1 右上角认证入口：未登录显示「登录」，已登录显示邮箱缩写 + 下拉菜单。 */
function AuthEntry({
  onOpenAdmin,
  onOpenSetPassword,
}: {
  onOpenAdmin: () => void;
  onOpenSetPassword: () => void;
}) {
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  const initial = (user.email ?? '?').charAt(0).toUpperCase();

  return (
    <>
      <button className="auth-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="账户">
        {initial}
      </button>
      {menuOpen && (
        <div className="auth-menu" onMouseLeave={() => setMenuOpen(false)}>
          {isAdmin(user) && (
            <button
              className="auth-menu__item"
              onClick={() => {
                setMenuOpen(false);
                onOpenAdmin();
              }}
            >
              {UI_COPY.adminEntry}
            </button>
          )}
          <button
            className="auth-menu__item"
            onClick={() => {
              setMenuOpen(false);
              onOpenSetPassword();
            }}
          >
            {UI_COPY.setPasswordEntry}
          </button>
          <button
            className="auth-menu__item"
            onClick={() => {
              setMenuOpen(false);
              signOut();
            }}
          >
            {UI_COPY.logout}
          </button>
        </div>
      )}
    </>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [showLogin, setShowLogin] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);
  // 优先用模板带的完整 ProfileConfig（自定义阈值），否则回退到 PROFILES
  const profile = state.templateProfile ?? (state.profile ? PROFILES[state.profile] : null);
  const auth = useAuth();

  // SPEC §11 第 1 步：非安全连接直接进 SFallback，不尝试调用摄像头
  const startGuide = useCallback(() => {
    if (!window.isSecureContext) {
      dispatch({ type: 'CAMERA_FAILED', failure: 'insecure' });
      return;
    }
    dispatch({ type: 'GOTO', screen: 'S4' });
  }, []);

  const onCameraFailure = useCallback((failure: CameraFailureKind) => {
    dispatch({ type: 'CAMERA_FAILED', failure });
  }, []);

  const onCaptured = useCallback((photos: Blob[]) => {
    dispatch({ type: 'SET_PHOTOS', photos });
    dispatch({ type: 'GOTO', screen: 'S5' });
  }, []);

  // 引导只展示一次：写 localStorage 后再更新状态（SPEC §9.7）
  const onOnboardingSeen = useCallback(() => {
    markOnboardingSeen();
    dispatch({ type: 'SET_ONBOARDING_SEEN' });
  }, []);

  const openAdmin = useCallback(() => dispatch({ type: 'GOTO', screen: 'Admin' }), []);

  const showLoginBtn = state.screen === 'S1' && !auth.user;

  switch (state.screen) {
    case 'S1':
      return (
        <>
          <S1TemplateList onSelect={(template) => dispatch({ type: 'SELECT_TEMPLATE', template })} />
          {showLoginBtn && (
            <button className="auth-btn" onClick={() => setShowLogin(true)}>
              {UI_COPY.login}
            </button>
          )}
          {state.screen === 'S1' && (
            <AuthEntry
              onOpenAdmin={openAdmin}
              onOpenSetPassword={() => setShowSetPassword(true)}
            />
          )}
          {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
          {showSetPassword && <SetPasswordModal onClose={() => setShowSetPassword(false)} />}
        </>
      );
    case 'S2':
      return (
        <S2IncludeGround
          includeGround={state.includeGround}
          onChange={(includeGround) => dispatch({ type: 'SET_INCLUDE_GROUND', includeGround })}
          onNext={() => dispatch({ type: 'GOTO', screen: 'S3' })}
        />
      );
    case 'S3':
      return <S3Handoff onStart={startGuide} />;
    case 'S4':
      return profile ? (
        <S4Guide
          profile={profile}
          hasSeenOnboarding={state.hasSeenOnboarding}
          onOnboardingSeen={onOnboardingSeen}
          onBack={() => dispatch({ type: 'BACK_HOME' })}
          onCameraFailure={onCameraFailure}
          onModelFailure={() => dispatch({ type: 'MODEL_FAILED' })}
          onCaptured={onCaptured}
        />
      ) : (
        <Pending screen="S4" />
      );
    case 'S5':
      return (
        <S5Select
          photos={state.photos}
          onRetake={() => {
            dispatch({ type: 'SET_PHOTOS', photos: [] });
            dispatch({ type: 'GOTO', screen: 'S4' });
          }}
          onDone={() => dispatch({ type: 'BACK_HOME' })}
        />
      );
    case 'SManual':
      return profile ? (
        <SManual
          profile={profile}
          onBack={() => dispatch({ type: 'BACK_HOME' })}
          onCameraFailure={onCameraFailure}
          onRetry={() => dispatch({ type: 'RETRY_MODELS' })}
          onCaptured={onCaptured}
        />
      ) : (
        <Pending screen="SManual" />
      );
    case 'SFallback':
      return (
        <SFallback
          failure={state.failure ?? 'notFound'}
          briefing={(profile ?? PROFILES.half).briefing}
          onRetry={() => dispatch({ type: 'RETRY_CAMERA' })}
          onHome={() => dispatch({ type: 'BACK_HOME' })}
        />
      );
    case 'Admin':
      return <AdminTemplates onBack={() => dispatch({ type: 'BACK_HOME' })} />;
    default:
      return <Pending screen={state.screen} />;
  }
}
