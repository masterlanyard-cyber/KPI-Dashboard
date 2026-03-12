import React, { useState } from 'react';
import GoogleSheetsProvider from './GoogleSheetsProvider';
import DashboardLayout from './DashboardLayout';
import { AuthProvider, useAuth } from './AuthContext';
import LoginPage from './LoginPage';
import PnlInputPage from './PnlInputPage';

const SHEET_KEY = '1DPHuHqfYMUTQwflRD2FJiPVg1iClFjSfZcpQ9J9qiUg'; // sheetKey dari user
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';

function AppContent() {
  const { isLoggedIn, logout, user } = useAuth();
  const [page, setPage] = useState('dashboard');

  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setPage('dashboard')} />;
  }

  if (page === 'input') {
    return (
      <PnlInputPage
        apiBaseUrl={API_BASE_URL}
        onBack={() => setPage('dashboard')}
      />
    );
  }

  return (
    <GoogleSheetsProvider sheetKey={SHEET_KEY} refreshIntervalMs={15000} apiBaseUrl={API_BASE_URL}>
      <div style={{ position: 'relative' }}>
        <div style={navBarStyle}>
          <span style={navUserStyle}>👤 {user?.username}</span>
          <button style={navBtnStyle} onClick={() => setPage('input')}>📝 Input Data P&amp;L</button>
          <button style={{ ...navBtnStyle, background: 'rgba(220,38,38,0.15)', color: '#dc2626', border: '1.5px solid rgba(220,38,38,0.3)' }} onClick={logout}>Keluar</button>
        </div>
        <DashboardLayout />
      </div>
    </GoogleSheetsProvider>
  );
}

const navBarStyle = {
  position: 'fixed',
  top: 0,
  right: 0,
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 16px',
  background: 'rgba(255,255,255,0.95)',
  backdropFilter: 'blur(8px)',
  borderBottom: '1px solid #e2e8f0',
  borderLeft: '1px solid #e2e8f0',
  borderBottomLeftRadius: 12,
  boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
};

const navUserStyle = {
  fontSize: 13,
  color: '#374151',
  fontWeight: 600,
  marginRight: 4,
};

const navBtnStyle = {
  padding: '6px 14px',
  background: 'rgba(26,86,219,0.1)',
  color: '#1a56db',
  border: '1.5px solid rgba(26,86,219,0.3)',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
};

function App() {
  return (
    <AuthProvider apiBaseUrl={API_BASE_URL}>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

