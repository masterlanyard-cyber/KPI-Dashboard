import React, { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children, apiBaseUrl }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('auth_token') || null);

  const normalizedBase = String(apiBaseUrl || '').trim().replace(/\/$/, '');

  const login = useCallback(async (username, password) => {
    const res = await fetch(`${normalizedBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login gagal. Periksa username dan password Anda.');
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_user', JSON.stringify({ username: data.username }));
    setToken(data.token);
    setUser({ username: data.username });
    return data;
  }, [normalizedBase]);

  const register = useCallback(async (username, password) => {
    const res = await fetch(`${normalizedBase}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registrasi gagal. Periksa input Anda dan coba lagi.');
    return data;
  }, [normalizedBase]);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
  }, []);

  const authFetch = useCallback((url, options = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        Authorization: token ? `Bearer ${token}` : '',
      },
    });
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, authFetch, isLoggedIn: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}
