const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { initDb, run, all } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'dashboard-pnl-secret-key-change-in-production';
const SALT_ROUNDS = 10;

if (!process.env.JWT_SECRET) {
  console.warn('[PERINGATAN] JWT_SECRET tidak diatur di environment. Gunakan nilai default yang tidak aman untuk produksi!');
}

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan. Silakan coba lagi setelah 15 menit.' },
});

const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Terlalu banyak permintaan. Silakan coba lagi setelah 1 menit.' },
});

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const DEFAULT_SHEET_TABS = [
  'KPIs',
  'SalesByProduct',
  'ActualVsTarget',
  'SalesByRegion',
  'SalesByChannel',
  'InventoryDays',
  'SalesGrowth',
  'ReceivableDays',
];

const OPTIONAL_SHEET_TABS = ['Branding'];

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.length === 0) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('Origin tidak diizinkan oleh CORS.'));
  },
}));
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'dashboard-pnl-backend',
    message: 'Backend is running. Use /api/health or /api/dashboard-data.',
  });
});

function parseGoogleVizResponse(rawText) {
  const start = rawText.indexOf('(');
  const end = rawText.lastIndexOf(')');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Format respons Google Sheets tidak valid.');
  }
  const jsonText = rawText.slice(start + 1, end);
  return JSON.parse(jsonText);
}

function tableToObjects(table) {
  if (!table?.cols || !table?.rows) return [];
  const headers = table.cols.map((col, index) => col.label || col.id || `Column${index + 1}`);

  return table.rows.map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      const cell = row.c?.[index];
      record[header] = cell?.f ?? cell?.v ?? '';
    });
    return record;
  });
}

async function fetchSheetTab(sheetKey, tabName) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetKey}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tabName)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Gagal load tab ${tabName} (HTTP ${response.status}).`);
  }

  const text = await response.text();
  const parsed = parseGoogleVizResponse(text);
  if (parsed.status !== 'ok') {
    throw new Error(`Google Sheets mengembalikan status ${parsed.status} untuk tab ${tabName}.`);
  }

  return {
    [tabName]: {
      elements: tableToObjects(parsed.table),
    },
  };
}

function pickValue(row, keys) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') {
      return row[key];
    }
  }
  return '';
}

function normalizeMonth(month) {
  return String(month || '').trim().toUpperCase();
}

function normalizeMetricKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function pickValueByNormalizedPrefix(row, prefixes) {
  const prefixList = (prefixes || []).map((prefix) => normalizeMetricKey(prefix));
  const keys = Object.keys(row || {});

  for (const rawKey of keys) {
    const normalizedKey = normalizeMetricKey(rawKey);
    if (prefixList.some((prefix) => normalizedKey.startsWith(prefix))) {
      const value = row?.[rawKey];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return value;
      }
    }
  }

  return '';
}

const WIDE_METRIC_DEFINITIONS = [
  { metric: 'Revenue', keys: ['Revenue', 'Sales', 'Total Sales', 'Net Sales'] },
  { metric: 'COGS', keys: ['COGS'] },
  { metric: 'OPEX', keys: ['OPEX', 'Operating Expenses', 'Operational Expenses'] },
  { metric: 'Gross Profit', keys: ['Gross Profit'] },
  { metric: 'Net Profit', keys: ['Net Profit'] },
  { metric: 'Other Income/Expenses', keys: ['Other Income', 'Other Income/Expenses'] },
  { metric: 'Doubtful', keys: ['Doubtful'] },
];

function extractNormalizedKpiRows(rows) {
  const output = [];

  for (const row of rows || []) {
    const yearRaw = pickValue(row, ['Year', 'YEAR', 'year', 'Tahun'])
      || pickValueByNormalizedPrefix(row, ['year']);
    const monthRaw = pickValue(row, ['Month', 'MONTH', 'month', 'Bulan'])
      || pickValueByNormalizedPrefix(row, ['month', 'bulan']);

    const periodParts = parseKpiPeriod(
      pickValue(row, ['Period', 'PERIOD', 'Periode', 'periode', 'MonthYear', 'MONTHYEAR', 'YearMonth', 'YEARMONTH'])
    );
    const month = normalizeMonth(monthRaw) || periodParts.month;
    const year = String(yearRaw || '').trim() || periodParts.year;
    const noteExtra = String(pickValue(row, ['Note/Extra', 'Note', 'NOTE', 'note'])).trim();
    const metric = String(pickValue(row, ['Metric', 'METRIC', 'metric'])).trim();

    if (metric) {
      output.push({
        metric,
        month,
        year,
        value: pickValue(row, ['Value', 'VALUE', 'value']),
        noteExtra,
      });
      continue;
    }

    const normalizedKeyMap = Object.keys(row || {}).reduce((acc, rawKey) => {
      acc[normalizeMetricKey(rawKey)] = rawKey;
      return acc;
    }, {});

    WIDE_METRIC_DEFINITIONS.forEach((definition) => {
      const matchedRawKey = definition.keys
        .map((candidateKey) => normalizedKeyMap[normalizeMetricKey(candidateKey)])
        .find(Boolean);

      if (!matchedRawKey) return;

      output.push({
        metric: definition.metric,
        month,
        year,
        value: row?.[matchedRawKey],
        noteExtra,
      });
    });
  }

  return output;
}

async function upsertSingleKpiRecord({ metric, month, year, value, noteExtra }) {
  if (!metric) return;
  const trimmedValue = String(value ?? '').trim();
  if (!trimmedValue) return;

  await run(
    `
    INSERT INTO kpi_history (metric, month, year, value, note_extra, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(metric, month, year)
    DO UPDATE SET
      value = excluded.value,
      note_extra = excluded.note_extra,
      updated_at = CURRENT_TIMESTAMP
    `,
    [metric, month, year, trimmedValue, String(noteExtra || '').trim()]
  );
}

function parseKpiPeriod(periodValue) {
  const normalized = String(periodValue || '').trim().toUpperCase();
  if (!normalized) {
    return { month: '', year: '' };
  }

  const monthOptions = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const yearMatch = normalized.match(/\b(19|20)\d{2}\b/);
  const monthByWord = monthOptions.find((month) => new RegExp(`\\b${month}\\b`).test(normalized));

  if (monthByWord || yearMatch) {
    return {
      month: monthByWord || '',
      year: yearMatch ? yearMatch[0] : '',
    };
  }

  const compact = normalized.replace(/[^A-Z0-9]/g, '');
  const monthByCompact = monthOptions.find((month) => compact.includes(month));
  const yearByCompact = compact.match(/(19|20)\d{2}/);

  return {
    month: monthByCompact || '',
    year: yearByCompact ? yearByCompact[0] : '',
  };
}

async function upsertKpiRows(rows) {
  const normalizedRows = extractNormalizedKpiRows(rows);
  for (const row of normalizedRows) {
    await upsertSingleKpiRecord(row);
  }
}

function mergeKpiRowsWithPriority(baseRows, priorityRows) {
  const merged = new Map();

  (baseRows || []).forEach((row) => {
    const metric = String(row?.Metric || '').trim();
    const month = String(row?.Month || '').trim().toUpperCase();
    const year = String(row?.Year || '').trim();
    if (!metric) return;
    merged.set(`${metric}|${month}|${year}`, {
      Metric: metric,
      Value: row?.Value ?? '',
      'Note/Extra': row?.['Note/Extra'] ?? '',
      Month: month,
      Year: year,
    });
  });

  (priorityRows || []).forEach((row) => {
    const metric = String(row?.metric || '').trim();
    const month = String(row?.month || '').trim().toUpperCase();
    const year = String(row?.year || '').trim();
    if (!metric) return;
    merged.set(`${metric}|${month}|${year}`, {
      Metric: metric,
      Value: row?.value ?? '',
      'Note/Extra': row?.noteExtra ?? '',
      Month: month,
      Year: year,
    });
  });

  return [...merged.values()];
}

async function getAllKpisFromDb() {
  const rows = await all(
    `
    SELECT metric, month, year, value, note_extra
    FROM kpi_history
    ORDER BY CAST(year AS INTEGER) ASC, 
      CASE month
        WHEN 'JAN' THEN 1 WHEN 'FEB' THEN 2 WHEN 'MAR' THEN 3 WHEN 'APR' THEN 4
        WHEN 'MAY' THEN 5 WHEN 'JUN' THEN 6 WHEN 'JUL' THEN 7 WHEN 'AUG' THEN 8
        WHEN 'SEP' THEN 9 WHEN 'OCT' THEN 10 WHEN 'NOV' THEN 11 WHEN 'DEC' THEN 12
        ELSE 99
      END ASC,
      metric ASC
    `
  );

  return rows.map((row) => ({
    Metric: row.metric,
    Value: row.value,
    'Note/Extra': row.note_extra,
    Month: row.month,
    Year: row.year,
  }));
}

async function buildDashboardData(sheetKey) {
  const merged = {};
  const errors = [];
  const tabRequests = [
    ...DEFAULT_SHEET_TABS.map((tabName) => ({ tabName, optional: false })),
    ...OPTIONAL_SHEET_TABS.map((tabName) => ({ tabName, optional: true })),
  ];

  const results = await Promise.allSettled(
    tabRequests.map((item) => fetchSheetTab(sheetKey, item.tabName))
  );

  results.forEach((result, index) => {
    const tabItem = tabRequests[index];
    if (result.status === 'fulfilled') {
      Object.assign(merged, result.value);
      return;
    }
    if (!tabItem.optional) {
      errors.push(`${tabItem.tabName}: ${result.reason?.message || 'unknown error'}`);
    }
  });

  const liveKpiRows = merged.KPIs?.elements?.length
    ? extractNormalizedKpiRows(merged.KPIs.elements)
    : [];

  if (merged.KPIs?.elements?.length) {
    await upsertKpiRows(merged.KPIs.elements);
  }

  const storedKpis = await getAllKpisFromDb();
  merged.KPIs = { elements: mergeKpiRowsWithPriority(storedKpis, liveKpiRows) };

  if (Object.keys(merged).length === 0) {
    throw new Error(`Semua tab gagal dibaca. ${errors.join(' | ')}`);
  }

  return {
    data: merged,
    warning: errors.length ? `Sebagian tab gagal dibaca. ${errors.join(' | ')}` : null,
    lastUpdated: new Date().toISOString(),
  };
}

app.get('/api/health', async (_req, res) => {
  const row = await all('SELECT COUNT(*) as total FROM kpi_history');
  res.json({ ok: true, kpiRows: row[0]?.total || 0 });
});

app.get('/api/dashboard-data', async (req, res) => {
  try {
    const sheetKey = String(req.query.sheetKey || '').trim();
    if (!sheetKey) {
      return res.status(400).json({ error: 'sheetKey wajib diisi.' });
    }

    const payload = await buildDashboardData(sheetKey);
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({
      error: 'Gagal memuat data dashboard.',
      detail: error?.message || 'unknown error',
    });
  }
});

app.post('/api/kpi/sync', async (req, res) => {
  try {
    const sheetKey = String(req.body?.sheetKey || req.query?.sheetKey || '').trim();
    if (!sheetKey) {
      return res.status(400).json({ error: 'sheetKey wajib diisi.' });
    }

    const kpiTab = await fetchSheetTab(sheetKey, 'KPIs');
    const rows = kpiTab.KPIs?.elements || [];

    await upsertKpiRows(rows);
    const total = await all('SELECT COUNT(*) as total FROM kpi_history');

    return res.json({
      ok: true,
      syncedRows: rows.length,
      totalRowsInSystem: total[0]?.total || 0,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Sinkronisasi KPI gagal.',
      detail: error?.message || 'unknown error',
    });
  }
});

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token tidak ditemukan. Silakan login.' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: 'Token tidak valid atau sudah expired.' });
  }
}

app.post('/api/auth/register', authRateLimiter, async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '').trim();

    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password wajib diisi.' });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: 'Username minimal 3 karakter.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password minimal 6 karakter.' });
    }

    const existing = await all('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Username sudah terdaftar.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, passwordHash]);

    return res.status(201).json({ ok: true, message: 'Registrasi berhasil.' });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal registrasi.', detail: error?.message || 'unknown error' });
  }
});

app.post('/api/auth/login', authRateLimiter, async (req, res) => {
  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '').trim();

    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password wajib diisi.' });
    }

    const rows = await all('SELECT id, username, password_hash FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Username atau password salah.' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Username atau password salah.' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
    return res.json({ ok: true, token, username: user.username });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal login.', detail: error?.message || 'unknown error' });
  }
});

app.get('/api/pnl', apiRateLimiter, authMiddleware, async (_req, res) => {
  try {
    const rows = await all(`
      SELECT id, month, year, revenue, cogs, gross_profit, opex, net_profit, other_income, notes, created_by, created_at, updated_at
      FROM pnl_entries
      ORDER BY CAST(year AS INTEGER) DESC,
        CASE month
          WHEN 'JAN' THEN 1 WHEN 'FEB' THEN 2 WHEN 'MAR' THEN 3 WHEN 'APR' THEN 4
          WHEN 'MAY' THEN 5 WHEN 'JUN' THEN 6 WHEN 'JUL' THEN 7 WHEN 'AUG' THEN 8
          WHEN 'SEP' THEN 9 WHEN 'OCT' THEN 10 WHEN 'NOV' THEN 11 WHEN 'DEC' THEN 12
          ELSE 99
        END DESC
    `);
    return res.json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal mengambil data P&L.', detail: error?.message || 'unknown error' });
  }
});

app.post('/api/pnl', apiRateLimiter, authMiddleware, async (req, res) => {
  try {
    const { month, year, revenue, cogs, gross_profit, opex, net_profit, other_income, notes } = req.body || {};

    if (!month || !year) {
      return res.status(400).json({ error: 'Bulan dan tahun wajib diisi.' });
    }

    const VALID_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const normalizedMonth = String(month).trim().toUpperCase();
    if (!VALID_MONTHS.includes(normalizedMonth)) {
      return res.status(400).json({ error: 'Format bulan tidak valid. Gunakan JAN-DEC.' });
    }

    const normalizedYear = String(year).trim();
    if (!/^\d{4}$/.test(normalizedYear)) {
      return res.status(400).json({ error: 'Format tahun tidak valid. Gunakan 4 digit angka.' });
    }

    const toNum = (val) => {
      const n = parseFloat(String(val ?? '').replace(/,/g, ''));
      return Number.isNaN(n) ? null : n;
    };

    await run(
      `INSERT INTO pnl_entries (month, year, revenue, cogs, gross_profit, opex, net_profit, other_income, notes, created_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(month, year)
       DO UPDATE SET
         revenue = excluded.revenue,
         cogs = excluded.cogs,
         gross_profit = excluded.gross_profit,
         opex = excluded.opex,
         net_profit = excluded.net_profit,
         other_income = excluded.other_income,
         notes = excluded.notes,
         created_by = excluded.created_by,
         updated_at = CURRENT_TIMESTAMP`,
      [
        normalizedMonth,
        normalizedYear,
        toNum(revenue),
        toNum(cogs),
        toNum(gross_profit),
        toNum(opex),
        toNum(net_profit),
        toNum(other_income),
        String(notes || '').trim(),
        req.user.username,
      ]
    );

    return res.json({ ok: true, message: 'Data P&L berhasil disimpan.' });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal menyimpan data P&L.', detail: error?.message || 'unknown error' });
  }
});

app.delete('/api/pnl/:id', apiRateLimiter, authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID tidak valid.' });
    }
    await run('DELETE FROM pnl_entries WHERE id = ?', [id]);
    return res.json({ ok: true, message: 'Data P&L berhasil dihapus.' });
  } catch (error) {
    return res.status(500).json({ error: 'Gagal menghapus data P&L.', detail: error?.message || 'unknown error' });
  }
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend berjalan di http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Gagal inisialisasi database:', err);
    process.exit(1);
  });
