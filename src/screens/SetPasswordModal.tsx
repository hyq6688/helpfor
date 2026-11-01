// 设置密码模态：已登录用户在此为账号补设密码，之后可用「邮箱 + 密码」登录。

import { useState } from 'react';
import { UI_COPY } from '../copy';
import { useAuth } from '../context/AuthContext';

export default function SetPasswordModal({ onClose }: { onClose: () => void }) {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (password.length < 6) {
      setError(UI_COPY.setPasswordTooShort);
      return;
    }
    if (password !== confirm) {
      setError(UI_COPY.setPasswordMismatch);
      return;
    }
    setError('');
    setSubmitting(true);
    const { error: err } = await updatePassword(password);
    setSubmitting(false);
    if (err) {
      setError(UI_COPY.setPasswordError);
      return;
    }
    setSuccess(UI_COPY.setPasswordSuccess);
    setPassword('');
    setConfirm('');
  };

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} aria-label="关闭">
          ×
        </button>

        <h2 style={{ margin: '0 0 8px', fontSize: 17 }}>{UI_COPY.setPasswordTitle}</h2>
        <p className="modal__hint">{UI_COPY.setPasswordHint}</p>

        <input
          className="input"
          type="password"
          placeholder={UI_COPY.setPasswordPlaceholder}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <input
          className="input"
          type="password"
          placeholder={`${UI_COPY.setPasswordNew}（再输入一次）`}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />

        <button className="btn btn--primary" onClick={handleSubmit} disabled={submitting}>
          {submitting ? '保存中…' : UI_COPY.setPasswordSubmit}
        </button>

        {success && <p className="modal__ok">{success}</p>}
        {error && <p className="modal__err">{error}</p>}
      </div>
    </div>
  );
}
