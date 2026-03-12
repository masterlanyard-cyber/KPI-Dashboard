import React, { useState } from 'react';
import { useAuth } from './AuthContext';

export default function LoginPage({ onLogin }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (mode === 'register') {
        if (password !== confirmPassword) {
          setError('Password dan konfirmasi password tidak sama.');
          return;
        }
        await register(username, password);
        setSuccess('Registrasi berhasil! Silakan login.');
        setMode('login');
        setPassword('');
        setConfirmPassword('');
      } else {
        await login(username, password);
        if (onLogin) onLogin();
      }
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.logo}>📊</div>
        <h2 style={styles.title}>Dashboard P&amp;L</h2>
        <p style={styles.subtitle}>{mode === 'login' ? 'Masuk ke akun Anda' : 'Buat akun baru'}</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Masukkan username"
              style={styles.input}
              autoFocus
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password"
              style={styles.input}
              required
            />
          </div>
          {mode === 'register' && (
            <div style={styles.field}>
              <label style={styles.label}>Konfirmasi Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password"
                style={styles.input}
                required
              />
            </div>
          )}

          {error && <div style={styles.error}>{error}</div>}
          {success && <div style={styles.successMsg}>{success}</div>}

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Memproses...' : mode === 'login' ? 'Masuk' : 'Daftar'}
          </button>
        </form>

        <div style={styles.switchRow}>
          {mode === 'login' ? (
            <span>
              Belum punya akun?{' '}
              <button style={styles.linkBtn} onClick={() => { setMode('register'); setError(''); setSuccess(''); }}>
                Daftar sekarang
              </button>
            </span>
          ) : (
            <span>
              Sudah punya akun?{' '}
              <button style={styles.linkBtn} onClick={() => { setMode('login'); setError(''); setSuccess(''); }}>
                Masuk
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #e8f0fe 0%, #f6fafd 60%, #dbeafe 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    background: '#fff',
    borderRadius: 20,
    boxShadow: '0 8px 40px rgba(15,108,189,0.15)',
    padding: '44px 40px 32px',
    maxWidth: 400,
    width: '100%',
    textAlign: 'center',
  },
  logo: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: 800,
    color: '#1a365d',
    margin: '0 0 4px',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 14,
    margin: '0 0 28px',
  },
  form: {
    textAlign: 'left',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    border: '1.5px solid #d1d5db',
    borderRadius: 10,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    marginBottom: 12,
  },
  successMsg: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#16a34a',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    marginBottom: 12,
  },
  button: {
    width: '100%',
    padding: '12px',
    background: 'linear-gradient(135deg, #1a56db, #0f6cbd)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 4,
    transition: 'opacity 0.2s',
  },
  switchRow: {
    marginTop: 20,
    fontSize: 13,
    color: '#64748b',
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: '#1a56db',
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
    fontSize: 13,
  },
};
