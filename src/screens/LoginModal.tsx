// 登录模态。规格 AC-1~AC-3。
// 邮箱 + 密码 / 邮箱验证码 双模式；手机号占位不实现。

import { useEffect, useRef, useState } from 'react';
import { UI_COPY } from '../copy';
import { useAuth } from '../context/AuthContext';

type Mode = 'otp' | 'password';
type Tab = 'email' | 'phone';

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const { signInWithPassword, signInWithOtp, verifyOtp } = useAuth();
  const [tab, setTab] = useState<Tab>('email');
  const [mode, setMode] = useState<Mode>('otp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleGetOtp = async () => {
    if (!emailValid || countdown > 0) {
      setError(UI_COPY.loginInvalidEmail);
      return;
    }
    setError('');
    setSubmitting(true);
    const { error: err } = await signInWithOtp(email);
    setSubmitting(false);
    if (err) {
      setError(UI_COPY.loginError);
      return;
    }
    setSuccess(UI_COPY.loginOtpSent);
    setCountdown(60);
    timerRef.current = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleSubmitOtp = async () => {
    if (!emailValid || token.length !== 6) {
      setError(UI_COPY.loginOtpError);
      return;
    }
    setError('');
    setSubmitting(true);
    const { error: err } = await verifyOtp(email, token);
    setSubmitting(false);
    if (err) {
      setError(UI_COPY.loginOtpError);
      return;
    }
    onClose();
  };

  const handleSubmitPassword = async () => {
    if (!emailValid || !password) {
      setError(UI_COPY.loginPasswordError);
      return;
    }
    setError('');
    setSubmitting(true);
    const { error: err } = await signInWithPassword(email, password);
    setSubmitting(false);
    if (err) {
      setError(UI_COPY.loginPasswordError);
      return;
    }
    onClose();
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} aria-label="关闭">
          ×
        </button>

        <div className="modal__tabs">
          <button
            className={`modal__tab ${tab === 'email' ? 'modal__tab--on' : ''}`}
            onClick={() => setTab('email')}
          >
            {UI_COPY.loginEmail}
          </button>
          <button
            className={`modal__tab ${tab === 'phone' ? 'modal__tab--on' : ''}`}
            disabled
            title={UI_COPY.loginPhoneSoon}
          >
            {UI_COPY.loginPhone}
          </button>
        </div>
        {tab === 'phone' && <p className="modal__hint">{UI_COPY.loginPhoneSoon}</p>}

        {tab === 'email' && (
          <>
            <div className="modal__subtabs">
              <button
                className={`modal__subtab ${mode === 'otp' ? 'modal__subtab--on' : ''}`}
                onClick={() => {
                  setMode('otp');
                  setError('');
                  setSuccess('');
                }}
              >
                {UI_COPY.loginOtp}
              </button>
              <button
                className={`modal__subtab ${mode === 'password' ? 'modal__subtab--on' : ''}`}
                onClick={() => {
                  setMode('password');
                  setError('');
                  setSuccess('');
                }}
              >
                {UI_COPY.loginPassword}
              </button>
            </div>

            <input
              className="input"
              type="email"
              placeholder={UI_COPY.loginEmailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            {mode === 'otp' ? (
              <>
                <div className="modal__otp-row">
                  <input
                    className="input"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder={UI_COPY.loginOtpPlaceholder}
                    value={token}
                    onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                  />
                  <button
                    className="btn btn--ghost"
                    onClick={handleGetOtp}
                    disabled={countdown > 0 || submitting}
                  >
                    {countdown > 0 ? `${countdown}s` : UI_COPY.loginGetOtp}
                  </button>
                </div>
                <button
                  className="btn btn--primary"
                  onClick={handleSubmitOtp}
                  disabled={submitting}
                >
                  {UI_COPY.loginSubmitOtp}
                </button>
              </>
            ) : (
              <>
                <input
                  className="input"
                  type="password"
                  placeholder={UI_COPY.loginPasswordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitPassword()}
                />
                <button
                  className="btn btn--primary"
                  onClick={handleSubmitPassword}
                  disabled={submitting}
                >
                  {UI_COPY.loginSubmitPassword}
                </button>
              </>
            )}
          </>
        )}

        {success && <p className="modal__ok">{success}</p>}
        {error && <p className="modal__err">{error}</p>}
      </div>
    </div>
  );
}
