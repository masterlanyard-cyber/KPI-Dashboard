// GoogleSheetsProvider.js
// Komponen React untuk fetch data dari Google Sheets (public) menggunakan Tabletop.js
import { useEffect, useState, createContext, useContext } from 'react';

const SHEET_TABS = [
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

const REQUIRED_TAB_RULES = {
  KPIs: {
    requiredAnyOfColumns: [['Metric', 'Revenue', 'Sales', 'Total Sales', 'Net Sales']],
    minRows: 1,
  },
  ActualVsTarget: {
    requiredAnyOfColumns: [['Month', 'Bulan'], ['Actual', 'Revenue', 'Sales'], ['Target', 'Target Revenue', 'Target Sales']],
    minRows: 1,
  },
  SalesByRegion: {
    requiredAnyOfColumns: [['Region', 'Area'], ['Actual', 'Value', 'Revenue', 'Sales', 'Amount']],
    minRows: 1,
  },
  SalesByChannel: {
    requiredAnyOfColumns: [['Channel', 'Category', 'Kategori'], ['Value', 'Revenue', 'Sales', 'Amount']],
    minRows: 1,
  },
  SalesByProduct: {
    requiredAnyOfColumns: [['Product'], ['Category'], ['Unit', 'Revenue']],
    minRows: 1,
  },
  SalesGrowth: {
    requiredAnyOfColumns: [['Month', 'Bulan'], ['Growth', 'Value', 'Revenue Growth']],
    minRows: 0,
  },
  ReceivableDays: {
    requiredAnyOfColumns: [['Month', 'Bulan'], ['Value', 'Receivable Days', 'Days', 'Actual']],
    minRows: 0,
  },
  InventoryDays: {
    requiredAnyOfColumns: [['Month', 'Bulan'], ['Value', 'Inventory Days', 'Days', 'Actual']],
    minRows: 0,
  },
};

const normalizeKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

function collectTabColumns(rows) {
  const columnSet = new Set();
  (rows || []).forEach((row) => {
    Object.keys(row || {}).forEach((key) => columnSet.add(normalizeKey(key)));
  });
  return [...columnSet];
}

function validateDashboardDataShape(data) {
  const issues = [];

  SHEET_TABS.forEach((tabName) => {
    const tabRows = data?.[tabName]?.elements;
    if (!Array.isArray(tabRows)) {
      issues.push({ level: 'error', tab: tabName, message: `Tab ${tabName} tidak terbaca.` });
      return;
    }

    const rule = REQUIRED_TAB_RULES[tabName];
    if (!rule) return;

    if (tabRows.length < (rule.minRows || 0)) {
      issues.push({ level: 'error', tab: tabName, message: `Tab ${tabName} kosong.` });
    }

    if (tabRows.length === 0) return;

    const normalizedColumns = new Set(collectTabColumns(tabRows));

    (rule.requiredAnyOfColumns || []).forEach((candidateGroup) => {
      const hasAnyColumn = candidateGroup.some((candidate) => normalizedColumns.has(normalizeKey(candidate)));
      if (!hasAnyColumn) {
        issues.push({
          level: 'error',
          tab: tabName,
          message: `Tab ${tabName} tidak memiliki kolom wajib (${candidateGroup.join(' / ')}).`,
        });
      }
    });
  });

  return issues;
}

function buildCombinedErrorMessage(parts) {
  return parts
    .filter(Boolean)
    .join(' | ')
    .trim();
}

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
  if (!table?.cols || !table?.rows) {
    return [];
  }

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

async function fetchDashboardDataFromBackend(apiBaseUrl, sheetKey) {
  const trimmedBaseUrl = String(apiBaseUrl || '').trim();
  if (!trimmedBaseUrl) {
    throw new Error('apiBaseUrl belum diatur.');
  }

  const normalizedBaseUrl = trimmedBaseUrl.replace(/\/$/, '');
  const url = `${normalizedBaseUrl}/api/dashboard-data?sheetKey=${encodeURIComponent(sheetKey)}`;
  const response = await fetch(url);

  if (!response.ok) {
    let detail = '';
    try {
      const payload = await response.json();
      detail = payload?.detail || payload?.error || '';
    } catch {
      detail = '';
    }
    throw new Error(detail || `Backend error (HTTP ${response.status}).`);
  }

  const payload = await response.json();
  return {
    data: payload?.data || {},
    warning: payload?.warning || null,
    lastUpdated: payload?.lastUpdated || new Date().toISOString(),
  };
}

async function syncKpiFromBackend(apiBaseUrl, sheetKey) {
  const trimmedBaseUrl = String(apiBaseUrl || '').trim();
  if (!trimmedBaseUrl) {
    throw new Error('apiBaseUrl belum diatur.');
  }

  const normalizedBaseUrl = trimmedBaseUrl.replace(/\/$/, '');
  const url = `${normalizedBaseUrl}/api/kpi/sync`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sheetKey }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const payload = await response.json();
      detail = payload?.detail || payload?.error || '';
    } catch {
      detail = '';
    }
    throw new Error(detail || `Sync KPI gagal (HTTP ${response.status}).`);
  }

  return response.json();
}

const GoogleSheetsContext = createContext();

export function useGoogleSheets() {
  return useContext(GoogleSheetsContext);
}

function mergeWithOverrides(baseData, dataOverrides) {
  const overrides = dataOverrides || {};
  const merged = { ...baseData };

  Object.entries(overrides).forEach(([tabName, elements]) => {
    if (!Array.isArray(elements)) return;
    merged[tabName] = { elements };
  });

  return merged;
}

async function attachOptionalTabsIfMissing(baseData, sheetKey) {
  const safeBase = baseData || {};
  const missingOptionalTabs = OPTIONAL_SHEET_TABS.filter((tabName) => !safeBase[tabName]);

  if (missingOptionalTabs.length === 0) {
    return safeBase;
  }

  const merged = { ...safeBase };
  const optionalResults = await Promise.allSettled(
    missingOptionalTabs.map((tabName) => fetchSheetTab(sheetKey, tabName))
  );

  optionalResults.forEach((result) => {
    if (result.status === 'fulfilled') {
      Object.assign(merged, result.value);
    }
  });

  return merged;
}

export default function GoogleSheetsProvider({
  sheetKey,
  refreshIntervalMs = 15000,
  dataOverrides,
  apiBaseUrl,
  children,
}) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [validationIssues, setValidationIssues] = useState(() => {
    try {
      const saved = localStorage.getItem('dashboard_validation_issues');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    let isMounted = true;
    const safeRefreshInterval = Math.max(5000, Number(refreshIntervalMs) || 15000);

    function fetchSheets(showLoading = false) {
      if (showLoading) {
        setLoading(true);
      }

      const backendFirst = fetchDashboardDataFromBackend(apiBaseUrl, sheetKey)
        .then(async (payload) => {
          if (!isMounted) return;
          const withOptionalTabs = await attachOptionalTabsIfMissing(payload.data, sheetKey);
          const mergedWithOverrides = mergeWithOverrides(withOptionalTabs, dataOverrides);
          const issues = validateDashboardDataShape(mergedWithOverrides);
          const issueMessage = buildCombinedErrorMessage(issues.map((item) => item.message));

          setData(mergedWithOverrides);
          setLoading(false);
          setLastUpdated(payload.lastUpdated || new Date().toISOString());
          setValidationIssues(issues);
          try {
            localStorage.setItem('dashboard_validation_issues', JSON.stringify(issues));
          } catch {}

          const combinedMessage = buildCombinedErrorMessage([payload.warning, issueMessage]);
          setError(combinedMessage ? new Error(combinedMessage) : null);
        })
        .catch(() => {
          const requiredTabs = SHEET_TABS.map((tabName) => ({ tabName, optional: false }));
          const optionalTabs = OPTIONAL_SHEET_TABS.map((tabName) => ({ tabName, optional: true }));
          const tabRequests = [...requiredTabs, ...optionalTabs];

          return Promise.allSettled(tabRequests.map((item) => fetchSheetTab(sheetKey, item.tabName))).then((results) => {
            if (!isMounted) return;

            const merged = {};
            const errors = [];

            results.forEach((result, index) => {
              const tabItem = tabRequests[index];
              if (result.status === 'fulfilled') {
                Object.assign(merged, result.value);
              } else {
                if (!tabItem.optional) {
                  errors.push(`${tabItem.tabName}: ${result.reason?.message || 'unknown error'}`);
                }
              }
            });

            const mergedWithOverrides = mergeWithOverrides(merged, dataOverrides);
            const issues = validateDashboardDataShape(mergedWithOverrides);
            const issueMessage = buildCombinedErrorMessage(issues.map((item) => item.message));

            if (Object.keys(mergedWithOverrides).length === 0) {
              throw new Error(`Semua tab gagal dibaca. ${errors.join(' | ')}`);
            }

            setData(mergedWithOverrides);
            setLoading(false);
            setLastUpdated(new Date().toISOString());
            setValidationIssues(issues);
            try {
              localStorage.setItem('dashboard_validation_issues', JSON.stringify(issues));
            } catch {}

            const partialErrorMessage = errors.length > 0 ? `Sebagian tab gagal dibaca. ${errors.join(' | ')}` : '';
            const combinedMessage = buildCombinedErrorMessage([partialErrorMessage, issueMessage]);

            if (combinedMessage) {
              setError(new Error(combinedMessage));
            } else {
              setError(null);
            }
          });
        });

      return backendFirst;
    }

    try {
      fetchSheets(true).catch((e) => {
        if (isMounted) {
          setError(e);
          setLoading(false);
        }
      });
    } catch (e) {
      if (isMounted) {
        setError(e);
        setLoading(false);
      }
    }

    const intervalId = setInterval(() => {
      fetchSheets(false).catch((e) => {
        if (isMounted) {
          setError(e);
        }
      });
    }, safeRefreshInterval);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [sheetKey, refreshIntervalMs, dataOverrides, apiBaseUrl, reloadKey]);

  const refreshData = () => {
    setReloadKey((prev) => prev + 1);
  };

  const syncKpiNow = async () => {
    setIsSyncing(true);
    try {
      const result = await syncKpiFromBackend(apiBaseUrl, sheetKey);
      setReloadKey((prev) => prev + 1);
      return result;
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <GoogleSheetsContext.Provider
      value={{ data, loading, error, lastUpdated, refreshData, syncKpiNow, isSyncing, validationIssues }}
    >
      {children}
    </GoogleSheetsContext.Provider>
  );
}
