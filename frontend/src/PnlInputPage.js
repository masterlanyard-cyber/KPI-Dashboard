import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const MONTH_OPTIONS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const EMPTY_FORM = {
  month: 'JAN',
  year: String(new Date().getFullYear()),
  revenue: '',
  cogs: '',
  gross_profit: '',
  opex: '',
  net_profit: '',
  other_income: '',
  notes: '',
};

function autoCalc(form) {
  const revenue = parseFloat(form.revenue) || 0;
  const cogs = parseFloat(form.cogs) || 0;
  const opex = parseFloat(form.opex) || 0;
  const otherIncome = parseFloat(form.other_income) || 0;

  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - opex + otherIncome;

  return { grossProfit, netProfit };
}

export default function PnlInputPage({ apiBaseUrl, onBack }) {
  const { authFetch, user } = useAuth();
  const normalizedBase = String(apiBaseUrl || '').trim().replace(/\/$/, '');

  const [form, setForm] = useState(EMPTY_FORM);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingEntries, setFetchingEntries] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [editingId, setEditingId] = useState(null);
  const [autoFill, setAutoFill] = useState(true);

  const { grossProfit, netProfit } = autoCalc(form);

  const fetchEntries = useCallback(async () => {
    setFetchingEntries(true);
    try {
      const res = await authFetch(`${normalizedBase}/api/pnl`);
      const data = await res.json();
      if (res.ok) {
        setEntries(data.data || []);
      }
    } catch {
      // ignore
    } finally {
      setFetchingEntries(false);
    }
  }, [authFetch, normalizedBase]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };
      if (autoFill && ['revenue', 'cogs', 'opex', 'other_income'].includes(name)) {
        const { grossProfit: gp, netProfit: np } = autoCalc(updated);
        if (!prev.gross_profit || autoFill) updated.gross_profit = isNaN(gp) ? '' : String(gp);
        if (!prev.net_profit || autoFill) updated.net_profit = isNaN(np) ? '' : String(np);
      }
      return updated;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const payload = {
        ...form,
        gross_profit: autoFill ? String(grossProfit) : form.gross_profit,
        net_profit: autoFill ? String(netProfit) : form.net_profit,
      };
      const res = await authFetch(`${normalizedBase}/api/pnl`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan data P&L. Periksa koneksi Anda dan coba lagi.');
      setMessage({ type: 'success', text: data.message || 'Data berhasil disimpan.' });
      setForm(EMPTY_FORM);
      setEditingId(null);
      fetchEntries();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Hapus data P&L ini?')) return;
    try {
      const res = await authFetch(`${normalizedBase}/api/pnl/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus data P&L. Periksa koneksi Anda dan coba lagi.');
      setMessage({ type: 'success', text: 'Data berhasil dihapus.' });
      fetchEntries();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  function handleEdit(entry) {
    setEditingId(entry.id);
    setForm({
      month: entry.month || 'JAN',
      year: entry.year || String(new Date().getFullYear()),
      revenue: entry.revenue != null ? String(entry.revenue) : '',
      cogs: entry.cogs != null ? String(entry.cogs) : '',
      gross_profit: entry.gross_profit != null ? String(entry.gross_profit) : '',
      opex: entry.opex != null ? String(entry.opex) : '',
      net_profit: entry.net_profit != null ? String(entry.net_profit) : '',
      other_income: entry.other_income != null ? String(entry.other_income) : '',
      notes: entry.notes || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setMessage({ type: '', text: '' });
  }

  const fmt = (val) => {
    const n = parseFloat(val);
    if (isNaN(n)) return '-';
    return new Intl.NumberFormat('id-ID').format(n);
  };

  const yearOptions = [];
  const currentYear = new Date().getFullYear();
  for (let i = 4; i >= 0; i--) yearOptions.push(String(currentYear - i));

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button onClick={onBack} style={styles.backBtn}>← Kembali ke Dashboard</button>
        <div>
          <h1 style={styles.pageTitle}>📝 Input Data P&amp;L</h1>
          <p style={styles.pageSubtitle}>Login sebagai: <strong>{user?.username}</strong></p>
        </div>
      </div>

      <div style={styles.container}>
        <div style={styles.formCard}>
          <h2 style={styles.cardTitle}>{editingId ? 'Edit Data P&L' : 'Tambah Data P&L Baru'}</h2>
          <form onSubmit={handleSubmit}>
            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Bulan *</label>
                <select name="month" value={form.month} onChange={handleChange} style={styles.select} required>
                  {MONTH_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Tahun *</label>
                <select name="year" value={form.year} onChange={handleChange} style={styles.select} required>
                  {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Revenue / Sales</label>
                <input type="number" name="revenue" value={form.revenue} onChange={handleChange} placeholder="0" style={styles.input} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>COGS</label>
                <input type="number" name="cogs" value={form.cogs} onChange={handleChange} placeholder="0" style={styles.input} />
              </div>
            </div>

            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>
                  Gross Profit
                  {autoFill && (
                    <span style={styles.autoTag}>
                      Auto: {fmt(grossProfit)}
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  name="gross_profit"
                  value={autoFill ? (isNaN(grossProfit) ? '' : String(grossProfit)) : form.gross_profit}
                  onChange={handleChange}
                  placeholder="0"
                  style={{ ...styles.input, background: autoFill ? '#f8fafc' : '#fff' }}
                  readOnly={autoFill}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>OPEX</label>
                <input type="number" name="opex" value={form.opex} onChange={handleChange} placeholder="0" style={styles.input} />
              </div>
            </div>

            <div style={styles.row}>
              <div style={styles.field}>
                <label style={styles.label}>Other Income / Expenses</label>
                <input type="number" name="other_income" value={form.other_income} onChange={handleChange} placeholder="0" style={styles.input} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>
                  Net Profit
                  {autoFill && (
                    <span style={styles.autoTag}>
                      Auto: {fmt(netProfit)}
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  name="net_profit"
                  value={autoFill ? (isNaN(netProfit) ? '' : String(netProfit)) : form.net_profit}
                  onChange={handleChange}
                  placeholder="0"
                  style={{ ...styles.input, background: autoFill ? '#f8fafc' : '#fff' }}
                  readOnly={autoFill}
                />
              </div>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Catatan</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Catatan tambahan (opsional)"
                rows={2}
                style={{ ...styles.input, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 8 }}>
              <input
                type="checkbox"
                id="autoFill"
                checked={autoFill}
                onChange={(e) => setAutoFill(e.target.checked)}
              />
              <label htmlFor="autoFill" style={{ fontSize: 13, color: '#64748b', cursor: 'pointer' }}>
                Hitung otomatis Gross Profit &amp; Net Profit
              </label>
            </div>

            {message.text && (
              <div style={message.type === 'success' ? styles.success : styles.error}>
                {message.text}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" style={styles.submitBtn} disabled={loading}>
                {loading ? 'Menyimpan...' : editingId ? 'Update Data' : 'Simpan Data'}
              </button>
              {editingId && (
                <button type="button" style={styles.cancelBtn} onClick={handleCancelEdit}>
                  Batal
                </button>
              )}
            </div>
          </form>
        </div>

        <div style={styles.tableCard}>
          <h2 style={styles.cardTitle}>Data P&amp;L Tersimpan</h2>
          {fetchingEntries ? (
            <p style={{ color: '#64748b' }}>Memuat data...</p>
          ) : entries.length === 0 ? (
            <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Belum ada data P&L yang disimpan.</p>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['Bulan', 'Tahun', 'Revenue', 'COGS', 'Gross Profit', 'OPEX', 'Net Profit', 'Other Income', 'Catatan', 'Oleh', 'Aksi'].map((h) => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} style={styles.tr}>
                      <td style={styles.td}>{entry.month}</td>
                      <td style={styles.td}>{entry.year}</td>
                      <td style={styles.td}>{fmt(entry.revenue)}</td>
                      <td style={styles.td}>{fmt(entry.cogs)}</td>
                      <td style={{ ...styles.td, color: entry.gross_profit >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                        {fmt(entry.gross_profit)}
                      </td>
                      <td style={styles.td}>{fmt(entry.opex)}</td>
                      <td style={{ ...styles.td, color: entry.net_profit >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                        {fmt(entry.net_profit)}
                      </td>
                      <td style={styles.td}>{fmt(entry.other_income)}</td>
                      <td style={{ ...styles.td, maxWidth: 120, wordBreak: 'break-word' }}>{entry.notes || '-'}</td>
                      <td style={styles.td}>{entry.created_by || '-'}</td>
                      <td style={styles.td}>
                        <button onClick={() => handleEdit(entry)} style={styles.editBtn}>Edit</button>
                        <button onClick={() => handleDelete(entry.id)} style={styles.deleteBtn}>Hapus</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f0f4f8',
    padding: '0 0 48px',
  },
  header: {
    background: 'linear-gradient(135deg, #1a56db, #0f6cbd)',
    padding: '20px 32px',
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    color: '#fff',
  },
  backBtn: {
    background: 'rgba(255,255,255,0.15)',
    border: '1.5px solid rgba(255,255,255,0.4)',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  pageTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
  },
  pageSubtitle: {
    margin: '4px 0 0',
    fontSize: 13,
    opacity: 0.85,
  },
  container: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '32px 24px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
  },
  formCard: {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 4px 20px rgba(15,108,189,0.10)',
    padding: '28px 32px',
  },
  tableCard: {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 4px 20px rgba(15,108,189,0.10)',
    padding: '28px 32px',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: '#1a365d',
    margin: '0 0 20px',
  },
  row: {
    display: 'flex',
    gap: 16,
    marginBottom: 0,
    flexWrap: 'wrap',
  },
  field: {
    flex: 1,
    minWidth: 160,
    marginBottom: 14,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 5,
  },
  input: {
    width: '100%',
    padding: '9px 12px',
    border: '1.5px solid #d1d5db',
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '9px 12px',
    border: '1.5px solid #d1d5db',
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    background: '#fff',
  },
  autoTag: {
    marginLeft: 8,
    fontSize: 11,
    color: '#0f6cbd',
    fontWeight: 400,
  },
  success: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#16a34a',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    marginBottom: 12,
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
  submitBtn: {
    padding: '10px 28px',
    background: 'linear-gradient(135deg, #1a56db, #0f6cbd)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '10px 20px',
    background: '#f1f5f9',
    color: '#374151',
    border: '1.5px solid #d1d5db',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    background: '#f0f4f8',
    padding: '10px 12px',
    textAlign: 'left',
    fontWeight: 700,
    color: '#1a365d',
    borderBottom: '2px solid #d1d5db',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '9px 12px',
    borderBottom: '1px solid #e5e7eb',
    color: '#374151',
    whiteSpace: 'nowrap',
  },
  tr: {
    transition: 'background 0.15s',
  },
  editBtn: {
    background: '#eff6ff',
    color: '#1a56db',
    border: '1px solid #bfdbfe',
    padding: '4px 10px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    marginRight: 6,
  },
  deleteBtn: {
    background: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca',
    padding: '4px 10px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
};
