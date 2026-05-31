import { useState } from 'react';
import './AuthModal.css';

interface Props {
  onClose: () => void;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
}

export default function AuthModal({ onClose, onSignIn, onSignUp }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim()) { setError('\u8ACB\u8F38\u5165 Email'); return; }
    if (password.length < 6) { setError('\u5BC6\u78BC\u81F3\u5C11 6 \u4F4D'); return; }

    setLoading(true);
    try {
      if (mode === 'login') {
        await onSignIn(email, password);
        onClose();
      } else {
        await onSignUp(email, password);
        setSuccess('\u8A3B\u518A\u6210\u529F\uFF01\u8ACB\u6AA2\u67E5\u4FE1\u7BB1\u9A57\u8B49\u90F5\u4EF6\uFF0C\u6216\u76F4\u63A5\u767B\u5165\u3002');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '\u767C\u751F\u932F\u8AA4';
      if (msg.includes('Invalid login')) setError('Email \u6216\u5BC6\u78BC\u932F\u8AA4');
      else if (msg.includes('already registered')) setError('\u6B64 Email \u5DF2\u8A3B\u518A');
      else if (msg.includes('valid email')) setError('Email \u683C\u5F0F\u4E0D\u6B63\u78BA');
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose}>{'\u2715'}</button>
        <h2>{mode === 'login' ? '\u767B\u5165' : '\u8A3B\u518A'}</h2>

        <form onSubmit={handleSubmit}>
          <label className="auth-label">
            Email
            <input
              type="email"
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
            />
          </label>
          <label className="auth-label">
            {'\u5BC6\u78BC'}
            <input
              type="password"
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={'\u81F3\u5C11 6 \u4F4D'}
            />
          </label>

          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? '\u8655\u7406\u4E2D\u2026' : mode === 'login' ? '\u767B\u5165' : '\u8A3B\u518A'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <>{'\u9084\u6C92\u6709\u5E33\u865F\uFF1F'} <button onClick={() => { setMode('register'); setError(''); setSuccess(''); }}>{'\u8A3B\u518A'}</button></>
          ) : (
            <>{'\u5DF2\u6709\u5E33\u865F\uFF1F'} <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }}>{'\u767B\u5165'}</button></>
          )}
        </div>
      </div>
    </div>
  );
}
