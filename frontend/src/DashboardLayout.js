import React from 'react';
import './DashboardLayout.css';
import { useGoogleSheets } from './GoogleSheetsProvider';

const MONTH_OPTIONS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const QUARTER_OPTIONS = ['Q1', 'Q2', 'Q3', 'Q4'];
const QUARTER_MONTH_MAP = {
  Q1: ['JAN', 'FEB', 'MAR'],
  Q2: ['APR', 'MAY', 'JUN'],
  Q3: ['JUL', 'AUG', 'SEP'],
  Q4: ['OCT', 'NOV', 'DEC'],
};

const normalizeText = (value) =>
  String(value || '')
    .trim()
    .toUpperCase();

const parseNumber = (value) => {
  if (value === null || value === undefined) return NaN;
  const raw = String(value).trim();
  if (!raw) return NaN;

  const sign = raw.startsWith('-') ? -1 : 1;
  const unsigned = raw.replace(/^[+-]/, '');

  const dotCount = (unsigned.match(/\./g) || []).length;
  const commaCount = (unsigned.match(/,/g) || []).length;
  let normalized = unsigned;

  if (dotCount > 0 && commaCount > 0) {
    if (unsigned.lastIndexOf(',') > unsigned.lastIndexOf('.')) {
      normalized = unsigned.replace(/\./g, '').replace(/,/g, '.');
    } else {
      normalized = unsigned.replace(/,/g, '');
    }
  } else if (dotCount > 1 && commaCount === 0) {
    normalized = unsigned.replace(/\./g, '');
  } else if (commaCount > 1 && dotCount === 0) {
    normalized = unsigned.replace(/,/g, '');
  } else if (commaCount === 1 && dotCount === 0) {
    const decimalPattern = /^\d+,\d{1,2}$/;
    normalized = decimalPattern.test(unsigned)
      ? unsigned.replace(',', '.')
      : unsigned.replace(/,/g, '');
  }

  normalized = normalized.replace(/[^0-9.]/g, '');
  if (!normalized) return NaN;

  const dotIndex = normalized.indexOf('.');
  if (dotIndex !== -1) {
    normalized =
      normalized.slice(0, dotIndex + 1) + normalized.slice(dotIndex + 1).replace(/\./g, '');
  }

  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? NaN : sign * parsed;
};

const formatKpiNumber = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return String(value ?? '-');
  const hasFraction = Math.abs(value % 1) > 0;
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
};

const getRowValue = (row, keys) => {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') {
      return row[key];
    }
  }
  return '';
};

const parsePeriodParts = (periodValue) => {
  const normalized = normalizeText(periodValue);
  if (!normalized) {
    return { month: '', year: '' };
  }

  const yearMatch = normalized.match(/\b(19|20)\d{2}\b/);
  const monthFromWord = MONTH_OPTIONS.find((month) => new RegExp(`\\b${month}\\b`).test(normalized));

  if (monthFromWord || yearMatch) {
    return {
      month: monthFromWord || '',
      year: yearMatch ? yearMatch[0] : '',
    };
  }

  const compact = normalized.replace(/[^A-Z0-9]/g, '');
  const monthFromCompact = MONTH_OPTIONS.find((month) => compact.includes(month));
  const yearFromCompactMatch = compact.match(/(19|20)\d{2}/);

  return {
    month: monthFromCompact || '',
    year: yearFromCompactMatch ? yearFromCompactMatch[0] : '',
  };
};

const getQuarterMonths = (quarter) => QUARTER_MONTH_MAP[normalizeText(quarter)] || [];

const isMonthMatchedByMode = (periodMode, rowMonth, selectedMonth, selectedQuarter) => {
  if (periodMode === 'yearly') return true;
  if (!rowMonth) return true;
  const normalizedRowMonth = normalizeText(rowMonth);
  if (periodMode === 'quarterly') {
    return getQuarterMonths(selectedQuarter).includes(normalizedRowMonth);
  }
  const selectedMonthIndex = MONTH_OPTIONS.indexOf(normalizeText(selectedMonth));
  const rowMonthIndex = MONTH_OPTIONS.indexOf(normalizedRowMonth);
  if (selectedMonthIndex < 0 || rowMonthIndex < 0) {
    return normalizedRowMonth === normalizeText(selectedMonth);
  }
  return rowMonthIndex <= selectedMonthIndex;
};

const buildPieGradientWithGap = (rows, percentKey, colorKey = 'color') => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return 'conic-gradient(#D0D7E2 0% 100%)';
  }

  let cumulative = 0;
  const stops = [];

  rows.forEach((row) => {
    const span = Math.max(0, Number(row?.[percentKey]) || 0);
    if (span <= 0 || cumulative >= 100) return;

    const start = cumulative;
    const end = Math.min(100, start + span);
    const color = row?.[colorKey] || '#2B88D8';

    stops.push(`${color} ${start.toFixed(2)}% ${end.toFixed(2)}%`);

    cumulative = end;
  });

  if (cumulative < 100) {
    stops.push(`#EAF1FB ${cumulative.toFixed(2)}% 100%`);
  }

  return `conic-gradient(${stops.join(', ')})`;
};

function KPIPanel({ selectedMonth, selectedQuarter, selectedYear, periodMode }) {
  const { data, loading, error, lastUpdated } = useGoogleSheets();
  if (loading) return <div>Loading...</div>;

  const kpiRawRows = data['KPIs']?.elements || [];
  const actualVsTargetRawRows = data['ActualVsTarget']?.elements || [];

  const canonicalMetric = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

  const monthIndex = (monthText) => MONTH_OPTIONS.indexOf(normalizeText(monthText));

  const toNumber = parseNumber;

  const aliases = {
    revenue: 'revenue',
    sales: 'revenue',
    totalsales: 'revenue',
    netsales: 'revenue',
    cogs: 'cogs',
    opex: 'opex',
    grossprofit: 'grossprofit',
    operatingexpense: 'opex',
    operatingexpenses: 'opex',
    operationalexpense: 'opex',
    operationalexpenses: 'opex',
    netprofit: 'netprofit',
    otherincome: 'otherincomeexpenses',
    otherincomeexpenses: 'otherincomeexpenses',
    otherincomeexpense: 'otherincomeexpenses',
    otherexpensesincome: 'otherincomeexpenses',
    doubtful: 'doubtful',
    doubtfull: 'doubtful',
    doubtfulexpense: 'doubtful',
    doubtfulexpenses: 'doubtful',
  };

  const mappedKpiRowsLong = kpiRawRows
    .map((row) => {
      const periodParts = parsePeriodParts(
        getRowValue(row, ['Period', 'PERIOD', 'Periode', 'periode', 'MonthYear', 'MONTHYEAR', 'YearMonth', 'YEARMONTH'])
      );

      const month = normalizeText(getRowValue(row, ['Month', 'MONTH', 'Bulan', 'month'])) || periodParts.month;
      const year = String(getRowValue(row, ['Year', 'YEAR', 'Tahun', 'year']) || '').trim() || periodParts.year;

      return {
        metric: String(getRowValue(row, ['Metric', 'METRIC', 'metric']) || '').trim(),
        value: getRowValue(row, ['Value', 'VALUE', 'value']),
        note: getRowValue(row, ['Note/Extra', 'Note', 'NOTE', 'note']),
        month,
        year,
      };
    })
    .filter((row) => row.metric);

  const wideMetricDefinitions = [
    { metric: 'Revenue', keys: ['Revenue', 'Sales', 'Total Sales', 'Net Sales'] },
    { metric: 'COGS', keys: ['COGS'] },
    { metric: 'OPEX', keys: ['OPEX', 'Operating Expenses', 'Operational Expenses'] },
    { metric: 'Gross Profit', keys: ['Gross Profit'] },
    { metric: 'Net Profit', keys: ['Net Profit'] },
    { metric: 'Other Income/Expenses', keys: ['Other Income', 'Other Income/Expenses'] },
    { metric: 'Doubtful', keys: ['Doubtful'] },
  ];

  const mappedKpiRowsWide = kpiRawRows.flatMap((row) => {
    if (String(getRowValue(row, ['Metric', 'METRIC', 'metric']) || '').trim()) {
      return [];
    }

    const periodParts = parsePeriodParts(
      getRowValue(row, ['Period', 'PERIOD', 'Periode', 'periode', 'MonthYear', 'MONTHYEAR', 'YearMonth', 'YEARMONTH'])
    );

    const month = normalizeText(getRowValue(row, ['Month', 'MONTH', 'Bulan', 'month'])) || periodParts.month;
    const year = String(getRowValue(row, ['Year', 'YEAR', 'Tahun', 'year']) || '').trim() || periodParts.year;
    const note = getRowValue(row, ['Note/Extra', 'Note', 'NOTE', 'note']);

    const normalizedKeyMap = Object.keys(row || {}).reduce((acc, rawKey) => {
      acc[canonicalMetric(rawKey)] = rawKey;
      return acc;
    }, {});

    return wideMetricDefinitions
      .map((definition) => {
        const matchedRawKey = definition.keys
          .map((candidateKey) => normalizedKeyMap[canonicalMetric(candidateKey)])
          .find(Boolean);

        if (!matchedRawKey) return null;

        const value = row?.[matchedRawKey];
        if (value === undefined || value === null || String(value).trim() === '') {
          return null;
        }

        return {
          metric: definition.metric,
          value,
          note,
          month,
          year,
        };
      })
      .filter(Boolean);
  });

  const mappedKpiRows = (() => {
    const merged = new Map();

    const rowScore = (row) => {
      const valueText = String(row?.value ?? '').trim();
      const noteText = String(row?.note ?? '').trim();
      const hasValue = valueText !== '' ? 1 : 0;
      const hasPeriod = (row?.month ? 1 : 0) + (row?.year ? 1 : 0);
      const hasNote = noteText !== '' ? 1 : 0;
      return hasValue * 10 + hasPeriod * 2 + hasNote;
    };

    [...mappedKpiRowsLong, ...mappedKpiRowsWide].forEach((row) => {
      const key = `${canonicalMetric(row.metric)}|${row.year || ''}|${row.month || ''}`;
      const current = merged.get(key);
      if (!current || rowScore(row) >= rowScore(current)) {
        merged.set(key, row);
      }
    });

    return [...merged.values()];
  })();

  const kpiHasYear = mappedKpiRows.some((row) => row.year);
  const kpiHasMonth = mappedKpiRows.some((row) => row.month);

  const kpiRowsByPeriod = mappedKpiRows.filter((row) => {
    const yearOk = kpiHasYear ? row.year === String(selectedYear) : true;
    const monthOk = kpiHasMonth ? isMonthMatchedByMode(periodMode, row.month, selectedMonth, selectedQuarter) : true;
    return yearOk && monthOk;
  });

  const kpiRowsToUse = kpiHasYear
    ? kpiRowsByPeriod
    : (kpiRowsByPeriod.length > 0 ? kpiRowsByPeriod : mappedKpiRows);

  const renderWithBoldPercent = (textValue) => {
    const text = String(textValue ?? '');
    const percentRegex = /(-?\d+(?:[.,]\d+)?%)/g;
    const percentTokenRegex = /^-?\d+(?:[.,]\d+)?%$/;
    const parts = text.split(percentRegex);

    return parts.map((part, index) => {
      if (percentTokenRegex.test(part)) {
        return (
          <span key={`pct-${index}`} className="kpi-percent-bold">
            {part}
          </span>
        );
      }

      return <React.Fragment key={`txt-${index}`}>{part}</React.Fragment>;
    });
  };

  const kpiSheet = (periodMode === 'yearly' || periodMode === 'quarterly' || periodMode === 'ytd')
    ? Object.values(
        kpiRowsToUse.reduce((acc, row) => {
          const key = canonicalMetric(row.metric);
          if (!acc[key]) {
            acc[key] = {
              metric: row.metric,
              sumValue: 0,
              hasNumeric: false,
              lastValue: row.value,
              lastNote: row.note,
              lastMonthIndex: monthIndex(row.month),
            };
          }

          const parsed = toNumber(row.value);
          if (!Number.isNaN(parsed)) {
            acc[key].sumValue += parsed;
            acc[key].hasNumeric = true;
          } else {
            acc[key].lastValue = row.value;
          }

          const currentIndex = monthIndex(row.month);
          if ((row.note || row.note === 0) && currentIndex >= acc[key].lastMonthIndex) {
            acc[key].lastNote = row.note;
            acc[key].lastMonthIndex = currentIndex;
          }

          return acc;
        }, {})
      ).map((entry) => ({
        Metric: entry.metric,
        Value: entry.hasNumeric ? entry.sumValue : entry.lastValue,
        'Note/Extra': entry.lastNote ?? '',
      }))
    : kpiRowsToUse.map((row) => ({
        Metric: row.metric,
        Value: row.value,
        'Note/Extra': row.note,
      }));

  const metricRows = new Map();
  const extraRows = [];
  let targetSalesValue = NaN;

  kpiSheet.forEach((row) => {
    const normalized = canonicalMetric(row?.Metric);
    const canonical = aliases[normalized];

    if (
      Number.isNaN(targetSalesValue) &&
      ['targetsales', 'salestarget', 'revenuetarget', 'targetrevenue'].includes(normalized)
    ) {
      targetSalesValue = toNumber(row?.Value);
    }

    if (canonical && !metricRows.has(canonical)) {
      metricRows.set(canonical, row);
    } else {
      extraRows.push(row);
    }
  });

  if (Number.isNaN(targetSalesValue)) {
    const mappedTargets = actualVsTargetRawRows
      .map((row) => ({
        month: normalizeText(getRowValue(row, ['Month', 'MONTH', 'Bulan', 'month'])),
        year: String(getRowValue(row, ['Year', 'YEAR', 'Tahun', 'year']) || '').trim(),
        target: toNumber(
          getRowValue(row, ['Target', 'TARGET', 'Target Sales', 'Target Revenue', 'target'])
        ),
      }))
      .filter((row) => !Number.isNaN(row.target));

    const hasYearTarget = mappedTargets.some((row) => row.year);
    const hasMonthTarget = mappedTargets.some((row) => row.month);

    const targetsByYear = hasYearTarget
      ? mappedTargets.filter((row) => row.year === String(selectedYear))
      : mappedTargets;

    if (periodMode === 'yearly') {
      targetSalesValue = targetsByYear.reduce((sum, row) => sum + row.target, 0);
    } else if (periodMode === 'quarterly') {
      const quarterMonths = getQuarterMonths(selectedQuarter);
      const quarterTargets = hasMonthTarget
        ? targetsByYear.filter((row) => quarterMonths.includes(row.month))
        : targetsByYear;
      targetSalesValue = quarterTargets.reduce((sum, row) => sum + row.target, 0);
    } else if (periodMode === 'ytd') {
      const selectedMonthIndex = MONTH_OPTIONS.indexOf(normalizeText(selectedMonth));
      const ytdTargets = hasMonthTarget
        ? targetsByYear.filter((row) => {
            const monthIndex = MONTH_OPTIONS.indexOf(normalizeText(row.month));
            return monthIndex >= 0 && (selectedMonthIndex < 0 || monthIndex <= selectedMonthIndex);
          })
        : targetsByYear;
      targetSalesValue = ytdTargets.reduce((sum, row) => sum + row.target, 0);
    } else {
      const selectedTarget = hasMonthTarget
        ? targetsByYear.find((row) => row.month === normalizeText(selectedMonth))
        : targetsByYear[0];
      targetSalesValue = selectedTarget ? selectedTarget.target : NaN;
    }
  }

  const preferredOrder = [
    { key: 'revenue', label: 'Revenue' },
    { key: 'cogs', label: 'COGS' },
    { key: 'grossprofit', label: 'Gross Profit' },
    { key: 'opex', label: 'OPEX' },
    { key: 'netprofit', label: 'Net Profit' },
    { key: 'otherincomeexpenses', label: 'Other Income/Expenses' },
    { key: 'doubtful', label: 'Doubtful' },
  ];

  const orderedCoreRows = preferredOrder.map(({ key, label }) => {
    const found = metricRows.get(key);
    const baseRow = found || { Metric: label, Value: '-', 'Note/Extra': '' };
    const revenueBaseValue = toNumber(metricRows.get('revenue')?.Value);
    const cogsBaseValue = toNumber(metricRows.get('cogs')?.Value);

    if (key === 'revenue') {
      const revenueValue = toNumber(baseRow?.Value);
      let achievementText = '';
      if (!Number.isNaN(revenueValue) && !Number.isNaN(targetSalesValue) && targetSalesValue !== 0) {
        const achievement = (revenueValue / targetSalesValue) * 100;
        achievementText = `${achievement.toFixed(1)}% achievement vs target`;
      }
      return {
        ...baseRow,
        Metric: 'Revenue',
        'Note/Extra': achievementText || '-',
      };
    }

    if (key === 'opex') {
      const opexValue = toNumber(baseRow?.Value);
      let opexRatioText = '-';

      if (!Number.isNaN(opexValue) && !Number.isNaN(revenueBaseValue) && revenueBaseValue !== 0) {
        const ratio = (opexValue / revenueBaseValue) * 100;
        opexRatioText = `${ratio.toFixed(1)}% of revenue`;
      }

      return {
        ...baseRow,
        Metric: 'OPEX',
        'Note/Extra': opexRatioText,
      };
    }

    if (key === 'cogs') {
      const cogsValue = toNumber(baseRow?.Value);
      let cogsRatioText = '-';

      if (!Number.isNaN(cogsValue) && !Number.isNaN(revenueBaseValue) && revenueBaseValue !== 0) {
        const ratio = (cogsValue / revenueBaseValue) * 100;
        cogsRatioText = `${ratio.toFixed(1)}% of revenue`;
      }

      return {
        ...baseRow,
        Metric: 'COGS',
        'Note/Extra': cogsRatioText,
      };
    }

    if (key === 'grossprofit') {
      const providedGrossProfit = toNumber(baseRow?.Value);
      const canDeriveFromRevenueCogs = !Number.isNaN(revenueBaseValue) && !Number.isNaN(cogsBaseValue);
      const grossProfitValue = !Number.isNaN(providedGrossProfit)
        ? providedGrossProfit
        : canDeriveFromRevenueCogs
          ? revenueBaseValue - cogsBaseValue
          : NaN;

      if (Number.isNaN(grossProfitValue)) {
        return {
          Metric: 'Gross Profit',
          Value: '-',
          'Note/Extra': baseRow?.['Note/Extra'] || '-',
        };
      }

      const grossMargin = revenueBaseValue !== 0 ? (grossProfitValue / revenueBaseValue) * 100 : NaN;

      return {
        Metric: 'Gross Profit',
        Value: grossProfitValue,
        'Note/Extra': Number.isNaN(grossMargin) ? '-' : `${grossMargin.toFixed(1)}% gross margin`,
      };
    }

    if (key === 'netprofit') {
      const netProfitValue = toNumber(baseRow?.Value);
      let netProfitRatioText = '-';

      if (!Number.isNaN(netProfitValue) && !Number.isNaN(revenueBaseValue) && revenueBaseValue !== 0) {
        const ratio = (netProfitValue / revenueBaseValue) * 100;
        netProfitRatioText = `${ratio.toFixed(1)}% of revenue`;
      }

      return {
        ...baseRow,
        Metric: 'Net Profit',
        'Note/Extra': netProfitRatioText,
      };
    }

    return baseRow;
  });

  const reorderedRows = [...orderedCoreRows];

  if (reorderedRows.length === 0) {
    return <div style={{ color: '#C50F1F' }}>Data KPI belum terbaca. Pastikan tab `KPIs` ada dan dapat diakses publik.</div>;
  }

  return (
    <div className="kpi-panel-stack">
      {error && (
        <div style={{ color: '#5E6A7D', fontSize: 12, marginBottom: 8 }}>
          Ada tab yang gagal diupdate, tapi data utama tetap ditampilkan.
        </div>
      )}
      {reorderedRows.map((row, i) => (
        <div className="kpi-panel" key={i}>
          {(() => {
            const metricText = String(row?.Metric || '').toLowerCase();
            const rawValue = row.Value ?? '-';
            let displayValue = rawValue;
            const rawNumeric = toNumber(rawValue);

            if (!Number.isNaN(rawNumeric)) {
              displayValue = formatKpiNumber(rawNumeric);
            }

            if (metricText.includes('target') && metricText.includes('achievement')) {
              const valueText = String(rawValue || '').trim();
              if (!valueText.includes('%')) {
                const numeric = toNumber(valueText);
                if (!Number.isNaN(numeric)) {
                  const percentValue = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
                  displayValue = `${percentValue.toFixed(1)}%`;
                }
              }
            }

            const displayNumeric = !Number.isNaN(rawNumeric) ? rawNumeric : toNumber(displayValue);
            const valueClass = `kpi-value${!Number.isNaN(displayNumeric) && displayNumeric < 0 ? ' negative' : ''}`;

            return (
              <>
          <div className="kpi-label">{row.Metric ?? '-'}</div>
          <div className={valueClass}>{displayValue}</div>
          {row['Note/Extra'] !== undefined && row['Note/Extra'] !== null && (() => {
            const noteText = String(row['Note/Extra']);
            const isRevenue = String(row?.Metric || '').toLowerCase() === 'revenue';
            const baseClass = "kpi-extra" + (noteText.includes('-') ? ' red' : '') + (isRevenue ? ' revenue-extra' : '');

            if (!isRevenue) {
              return <div className={baseClass}>{renderWithBoldPercent(noteText)}</div>;
            }

            const percentMatch = noteText.match(/-?\d+(?:[.,]\d+)?%/);
            if (!percentMatch) {
              return <div className={baseClass}>{renderWithBoldPercent(noteText)}</div>;
            }

            const percentValue = percentMatch[0];
            const labelText = noteText.replace(percentValue, '').trim() || 'achievement vs target';

            return (
              <div className={baseClass}>
                <div className="revenue-extra-percent">{percentValue}</div>
                <div className="revenue-extra-label">{labelText}</div>
              </div>
            );
          })()}
              </>
            );
          })()}
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, children, style, className = '' }) {
  return (
    <div className={`chart-card ${className}`.trim()} style={style}>
      <div className="chart-title">{title}</div>
      {children || <div style={{color:'#8AA0BE',textAlign:'center',marginTop:30}}>[Chart Placeholder]</div>}
    </div>
  );
}

function ActualVsTargetCard({ selectedMonth, selectedQuarter, selectedYear, periodMode }) {
  const { data, loading } = useGoogleSheets();
  const rawRows = data['ActualVsTarget']?.elements || [];

  if (loading) {
    return <div className="card-message">Loading data...</div>;
  }

  if (rawRows.length === 0) {
    return <div className="card-message">Data `ActualVsTarget` belum tersedia.</div>;
  }

  const mappedRows = rawRows.map((row) => {
    const month = normalizeText(getRowValue(row, ['Month', 'MONTH', 'Bulan', 'month']));
    const yearRaw = getRowValue(row, ['Year', 'YEAR', 'Tahun', 'year']);
    const actual = parseNumber(getRowValue(row, ['Actual', 'ACTUAL', 'Revenue', 'Sales', 'actual']));
    const target = parseNumber(getRowValue(row, ['Target', 'TARGET', 'Target Revenue', 'Target Sales', 'target']));

    return {
      month,
      year: String(yearRaw || '').trim(),
      actual,
      target,
    };
  });

  const hasYearData = mappedRows.some((row) => row.year);
  const rowsByYear = hasYearData
    ? mappedRows.filter((row) => row.year === String(selectedYear))
    : mappedRows;

  const validRows = rowsByYear
    .filter((row) => !Number.isNaN(row.actual) && !Number.isNaN(row.target))
    .map((row) => ({
      ...row,
      monthIndex: MONTH_OPTIONS.indexOf(row.month),
    }));

  const sortedRows = validRows
    .filter((row) => row.monthIndex >= 0)
    .sort((a, b) => a.monthIndex - b.monthIndex);

  const monthlyRows = (() => {
    if (periodMode === 'yearly') {
      return sortedRows;
    }

    if (periodMode === 'quarterly') {
      const quarterMonths = getQuarterMonths(selectedQuarter);
      return sortedRows.filter((row) => quarterMonths.includes(row.month));
    }

    const selectedMonthIndex = MONTH_OPTIONS.indexOf(normalizeText(selectedMonth));
    return sortedRows.filter((row) => row.monthIndex >= 0 && (selectedMonthIndex < 0 || row.monthIndex <= selectedMonthIndex));
  })();

  if (monthlyRows.length === 0) {
    return (
      <div className="card-message">
        Data Actual/Target untuk {periodMode === 'yearly' ? `Year ${selectedYear}` : periodMode === 'quarterly' ? `${selectedQuarter} ${hasYearData ? selectedYear : ''}` : `${selectedMonth} ${hasYearData ? selectedYear : ''}`} belum ditemukan.
      </div>
    );
  }

  const selectedRow = {
    actual: monthlyRows.reduce((sum, row) => sum + row.actual, 0),
    target: monthlyRows.reduce((sum, row) => sum + row.target, 0),
  };

  const achievement = selectedRow.target !== 0 ? (selectedRow.actual / selectedRow.target) * 100 : 0;
  const variance = selectedRow.actual - selectedRow.target;
  const maxValue = Math.max(
    1,
    ...monthlyRows.map((row) => Math.max(row.actual, row.target))
  );
  const statusText = selectedRow.actual >= selectedRow.target ? 'On Track' : 'Below Target';
  const statusClass = selectedRow.actual >= selectedRow.target ? 'status-good' : 'status-bad';
  const visibleCount = monthlyRows.length;
  const dynamicTrackMaxWidth = visibleCount <= 3 ? 'none' : visibleCount <= 5 ? '72px' : visibleCount <= 8 ? '48px' : '24px';
  const dynamicTrackWidth = visibleCount <= 5 ? 44 : visibleCount <= 8 ? 42 : 38;
  const dynamicPairGap = visibleCount <= 5 ? 6 : visibleCount <= 8 ? 4 : 2;

  return (
    <div className="actual-target-wrap">
      <div className="actual-target-mini-chart">
        <div className="mini-vertical-legend">
          <span className="legend-item"><span className="legend-dot actual" />Actual</span>
          <span className="legend-item"><span className="legend-dot target" />Target</span>
        </div>
        <div
          className="mini-vertical-chart monthly"
          style={{
            '--mini-track-max': dynamicTrackMaxWidth,
            '--mini-track-width': `${dynamicTrackWidth}%`,
            '--mini-pair-gap': `${dynamicPairGap}px`,
          }}
        >
          {monthlyRows.map((row) => {
            const actualHeight = (row.actual / maxValue) * 100;
            const targetHeight = (row.target / maxValue) * 100;
            const actualClass = row.actual >= row.target ? 'actual-good' : 'actual-bad';

            return (
              <div className="mini-vertical-col monthly" key={`${row.year || 'NA'}-${row.month}`}>
                <div className="mini-vertical-pair">
                  <div className="mini-vertical-track monthly">
                    <div className={`mini-vertical-fill ${actualClass}`} style={{ height: `${actualHeight}%` }} />
                  </div>
                  <div className="mini-vertical-track monthly">
                    <div className="mini-vertical-fill target" style={{ height: `${targetHeight}%` }} />
                  </div>
                </div>
                <span className="mini-vertical-label">{row.month}</span>
              </div>
            );
          })}
        </div>
        <div className={`actual-target-status ${statusClass}`}>{statusText}</div>
      </div>

      <div className="actual-target-grid">
        <div className="actual-target-item actual-target-item-3d">
          <div className="actual-target-label">Actual Revenue</div>
          <div className="actual-target-value">{selectedRow.actual.toLocaleString()}</div>
        </div>
        <div className="actual-target-item actual-target-item-3d">
          <div className="actual-target-label">Target Revenue</div>
          <div className="actual-target-value">{selectedRow.target.toLocaleString()}</div>
        </div>
        <div className="actual-target-item actual-target-item-3d">
          <div className="actual-target-label">Target Achievement</div>
          <div className="actual-target-value">{achievement.toFixed(1)}%</div>
        </div>
        <div className="actual-target-item actual-target-item-3d">
          <div className="actual-target-label">Variance</div>
          <div className={`actual-target-value ${variance < 0 ? 'negative' : 'positive'}`}>
            {variance.toLocaleString()}
            </div>
        </div>
        </div>
    </div>
  );
}

function RevenueByProductCard({ selectedMonth, selectedQuarter, selectedYear, periodMode }) {
  const { data, loading } = useGoogleSheets();
  const rawRows = data['SalesByProduct']?.elements || [];

  const getProductColor = (productName) => {
    const normalized = String(productName || '').trim().toLowerCase();
    if (normalized.includes('supplement')) return '#0F6CBD';
    if (normalized.includes('equipment')) return '#2B88D8';
    if (normalized.includes('apparel')) return '#6CAEF2';
    if (normalized.includes('accessor')) return '#8FBCE6';

    const palette = ['#0F6CBD', '#2B88D8', '#6CAEF2', '#8FBCE6', '#A7C8EE', '#C7DCF5'];
    let hash = 0;
    for (let i = 0; i < normalized.length; i += 1) {
      hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
    }
    return palette[hash % palette.length];
  };

  if (loading) {
    return <div className="card-message">Loading data...</div>;
  }

  if (rawRows.length === 0) {
    return <div className="card-message">Data `SalesByProduct` belum tersedia.</div>;
  }

  const mappedRows = rawRows.map((row) => {
    const product = String(getRowValue(row, ['Product', 'PRODUCT', 'Category', 'CATEGORY', 'Kategori']) || '-').trim();
    const explicitValue = parseNumber(getRowValue(row, ['Value', 'VALUE', 'Revenue', 'Sales', 'Amount', 'Actual']));
    const aboveTarget = parseNumber(getRowValue(row, ['AboveTarget', 'ABOVETARGET', 'Above Target']));
    const belowTarget = parseNumber(getRowValue(row, ['BelowTarget', 'BELOWTARGET', 'Below Target']));
    const month = normalizeText(getRowValue(row, ['Month', 'MONTH', 'Bulan', 'month']));
    const year = String(getRowValue(row, ['Year', 'YEAR', 'Tahun', 'year']) || '').trim();

    const value = !Number.isNaN(explicitValue)
      ? explicitValue
      : ((Number.isNaN(aboveTarget) ? 0 : aboveTarget) + (Number.isNaN(belowTarget) ? 0 : belowTarget));

    return { product, value, month, year };
  }).filter((row) => row.product && !Number.isNaN(row.value));

  const hasMonthData = mappedRows.some((row) => row.month);
  const hasYearData = mappedRows.some((row) => row.year);

  const filteredRows = mappedRows.filter((row) => {
    const monthOk = hasMonthData ? isMonthMatchedByMode(periodMode, row.month, selectedMonth, selectedQuarter) : true;
    const yearOk = hasYearData ? row.year === String(selectedYear) : true;
    return monthOk && yearOk;
  });

  const rowsToUse = hasYearData
    ? filteredRows
    : (filteredRows.length > 0 ? filteredRows : mappedRows);

  const totalsByProduct = rowsToUse.reduce((acc, row) => {
    acc[row.product] = (acc[row.product] || 0) + row.value;
    return acc;
  }, {});

  const HERO_PRODUCT_LIMIT = 5;

  const allProductRows = Object.entries(totalsByProduct)
    .map(([product, value]) => ({ product, value }))
    .filter((row) => row.value > 0);

  const totalAllProductsValue = allProductRows.reduce((sum, row) => sum + row.value, 0);

  const productRows = allProductRows
    .sort((a, b) => b.value - a.value)
    .slice(0, HERO_PRODUCT_LIMIT);

  if (productRows.length === 0) {
    return <div className="card-message">Data product/category tidak ditemukan untuk filter saat ini.</div>;
  }

  if (totalAllProductsValue <= 0) {
    return <div className="card-message">Total revenue product bernilai 0.</div>;
  }

  const productWithPercent = productRows.map((row) => ({
    ...row,
    percent: (row.value / totalAllProductsValue) * 100,
    color: getProductColor(row.product),
  }));

  const top5Value = productRows.reduce((sum, row) => sum + row.value, 0);
  const othersValue = Math.max(0, totalAllProductsValue - top5Value);
  const othersPercent = totalAllProductsValue > 0 ? (othersValue / totalAllProductsValue) * 100 : 0;

  const maxValue = Math.max(...productWithPercent.map((row) => row.value), 1);

  return (
    <div className="product-card-wrap">
      <div className="product-vertical-chart">
        {productWithPercent.map((row) => (
          <div key={row.product} className="product-vertical-item">
            <div className="product-vertical-percent">{row.percent.toFixed(1)}%</div>
            <div className="product-vertical-track">
              <div
                className="product-vertical-fill"
                style={{
                  height: `${(row.value / maxValue) * 100}%`,
                  backgroundColor: row.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="product-full-legend">
        {productWithPercent.map((row) => (
          <div key={`product-legend-${row.product}`} className="product-full-legend-row">
            <span className="channel-dot" style={{ backgroundColor: row.color }} />
            <span className="product-full-legend-name">{row.product}</span>
            <span className="channel-percent">{row.percent.toFixed(1)}%</span>
            <span className="channel-amount">{row.value.toLocaleString()}</span>
          </div>
        ))}
        {othersValue > 0 && (
          <div className="product-full-legend-row product-full-legend-row-others">
            <span className="channel-dot" style={{ backgroundColor: '#D0DDF0' }} />
            <span className="product-full-legend-name">Others</span>
            <span className="channel-percent">{othersPercent.toFixed(1)}%</span>
            <span className="channel-amount">{othersValue.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function RevenueByChannelCard({ selectedMonth, selectedQuarter, selectedYear, periodMode }) {
  const { data, loading } = useGoogleSheets();
  const rawRows = data['SalesByChannel']?.elements || [];
  const pastelPalette = ['#0B4F94', '#1264B3', '#1F78C8', '#2A86D6', '#3A94E2', '#4BA3EE'];

  if (loading) {
    return <div className="card-message">Loading data...</div>;
  }

  if (rawRows.length === 0) {
    return <div className="card-message">Data `SalesByChannel` belum tersedia.</div>;
  }

  const mappedRows = rawRows.map((row) => {
    const channel = String(getRowValue(row, ['Channel', 'CHANNEL', 'channel', 'Kategori', 'Category']) || '-').trim();
    const value = parseNumber(getRowValue(row, ['Value', 'VALUE', 'Revenue', 'Sales', 'Amount', 'value']));
    const month = normalizeText(getRowValue(row, ['Month', 'MONTH', 'Bulan', 'month']));
    const year = String(getRowValue(row, ['Year', 'YEAR', 'Tahun', 'year']) || '').trim();

    return { channel, value, month, year };
  }).filter((row) => row.channel && !Number.isNaN(row.value));

  const hasMonthData = mappedRows.some((row) => row.month);
  const hasYearData = mappedRows.some((row) => row.year);

  const filteredRows = mappedRows.filter((row) => {
    const monthOk = hasMonthData ? isMonthMatchedByMode(periodMode, row.month, selectedMonth, selectedQuarter) : true;
    const yearOk = hasYearData ? row.year === String(selectedYear) : true;
    return monthOk && yearOk;
  });

  const rowsToUse = hasYearData
    ? filteredRows
    : (filteredRows.length > 0 ? filteredRows : mappedRows);

  const totalsByChannel = rowsToUse.reduce((acc, row) => {
    acc[row.channel] = (acc[row.channel] || 0) + row.value;
    return acc;
  }, {});

  const channelRows = Object.entries(totalsByChannel)
    .map(([channel, value]) => ({ channel, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  if (channelRows.length === 0) {
    return <div className="card-message">Data channel tidak ditemukan untuk filter saat ini.</div>;
  }

  const totalValue = channelRows.reduce((sum, row) => sum + row.value, 0);
  if (totalValue <= 0) {
    return <div className="card-message">Total revenue channel bernilai 0.</div>;
  }

  const channelWithPercent = channelRows.map((row, index) => ({
    ...row,
    percent: (row.value / totalValue) * 100,
    color: pastelPalette[index % pastelPalette.length],
  }));

  const pieStyle = {
    background: buildPieGradientWithGap(channelWithPercent, 'percent'),
  };

  return (
    <div className="channel-card-wrap">
      <div className="channel-pie-layout">
        <div className="channel-pie" style={pieStyle} />
        <div className="channel-legend">
          {channelWithPercent.map((row) => (
            <div key={row.channel} className="channel-legend-row">
              <span className="channel-dot" style={{ backgroundColor: row.color }} />
              <span className="channel-name">{row.channel}</span>
              <span className="channel-percent">{row.percent.toFixed(1)}%</span>
              <span className="channel-amount">{row.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RevenueByRegionCard({ selectedMonth, selectedQuarter, selectedYear, periodMode }) {
  const { data, loading } = useGoogleSheets();
  const rawRows = data['SalesByRegion']?.elements || [];

  if (loading) {
    return <div className="card-message">Loading data...</div>;
  }

  if (rawRows.length === 0) {
    return <div className="card-message">Data `SalesByRegion` belum tersedia.</div>;
  }

  const mappedRows = rawRows.map((row) => {
    const region = String(getRowValue(row, ['Region', 'REGION', 'region', 'Area']) || '-').trim();
    const actual = parseNumber(getRowValue(row, ['Actual', 'ACTUAL', 'Value', 'VALUE', 'Revenue', 'Sales', 'Amount']));
    const target = parseNumber(getRowValue(row, ['Target', 'TARGET', 'Target Revenue', 'Target Sales', 'Plan']));
    const month = normalizeText(getRowValue(row, ['Month', 'MONTH', 'Bulan', 'month']));
    const year = String(getRowValue(row, ['Year', 'YEAR', 'Tahun', 'year']) || '').trim();

    return { region, actual, target, month, year };
  }).filter((row) => row.region && (!Number.isNaN(row.actual) || !Number.isNaN(row.target)));

  const hasMonthData = mappedRows.some((row) => row.month);
  const hasYearData = mappedRows.some((row) => row.year);

  const filteredRows = mappedRows.filter((row) => {
    const monthOk = hasMonthData ? isMonthMatchedByMode(periodMode, row.month, selectedMonth, selectedQuarter) : true;
    const yearOk = hasYearData ? row.year === String(selectedYear) : true;
    return monthOk && yearOk;
  });

  const rowsToUse = hasYearData
    ? filteredRows
    : (filteredRows.length > 0 ? filteredRows : mappedRows);

  const totalsByRegion = rowsToUse.reduce((acc, row) => {
    if (!acc[row.region]) {
      acc[row.region] = { actual: 0, target: 0 };
    }
    acc[row.region].actual += Number.isNaN(row.actual) ? 0 : row.actual;
    acc[row.region].target += Number.isNaN(row.target) ? 0 : row.target;
    return acc;
  }, {});

  const regionRows = Object.entries(totalsByRegion)
    .map(([region, totals]) => ({
      region,
      actual: totals.actual,
      target: totals.target,
    }))
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 5);

  if (regionRows.length === 0) {
    return <div className="card-message">Data region tidak ditemukan untuk filter saat ini.</div>;
  }

  const totalActual = regionRows.reduce((sum, row) => sum + row.actual, 0);
  if (totalActual <= 0) {
    return <div className="card-message">Total actual region bernilai 0.</div>;
  }

  const pastelPalette = ['#0F6CBD', '#2B88D8', '#6CAEF2', '#8FBCE6', '#A7C8EE', '#C7DCF5'];

  const colorForIndex = (index) => pastelPalette[index % pastelPalette.length];

  const regionWithPercent = regionRows.map((row, index) => ({
    ...row,
    actualPercent: (row.actual / totalActual) * 100,
    color: colorForIndex(index),
  }));

  const splitIndex = (() => {
    if (regionWithPercent.length <= 3) {
      return regionWithPercent.length;
    }

    let cumulative = 0;
    let index = 0;
    for (let i = 0; i < regionWithPercent.length; i += 1) {
      cumulative += regionWithPercent[i].actualPercent;
      index = i + 1;
      if (cumulative >= 58) {
        break;
      }
    }

    return Math.min(Math.max(index, 2), regionWithPercent.length - 1);
  })();

  const topGroupItems = regionWithPercent.slice(0, splitIndex);
  const bottomItems = regionWithPercent.slice(splitIndex);
  const topPercent = topGroupItems.reduce((sum, row) => sum + row.actualPercent, 0);
  const bottomPercent = bottomItems.reduce((sum, row) => sum + row.actualPercent, 0);

  return (
    <div className="region-card-wrap">
      <div className="region-content-layout">
        <div className="region-treemap-layout">
          <div className="region-treemap-row top" style={{ flexGrow: Math.max(1, topPercent) }}>
            {topGroupItems.map((row) => (
              <div
                key={`top-${row.region}`}
                className="region-treemap-tile"
                style={{ backgroundColor: row.color, flexGrow: Math.max(1, row.actualPercent) }}
              >
                <div className="region-treemap-inline">
                  <span className="region-treemap-name">{row.region}</span>
                  <span className="region-treemap-amount">{row.actual.toLocaleString('id-ID')}</span>
                  <span className="region-treemap-percent">{row.actualPercent.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>

          {bottomItems.length > 0 && (
            <div className="region-treemap-row bottom" style={{ flexGrow: Math.max(1, bottomPercent) }}>
              {bottomItems.map((row) => (
                <div
                  key={`bottom-${row.region}`}
                  className="region-treemap-tile"
                  style={{ backgroundColor: row.color, flexGrow: Math.max(1, row.actualPercent) }}
                >
                  <div className="region-treemap-inline">
                    <span className="region-treemap-name">{row.region}</span>
                    <span className="region-treemap-amount">{row.actual.toLocaleString('id-ID')}</span>
                    <span className="region-treemap-percent">{row.actualPercent.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RevenueGrowthCard({ selectedMonth, selectedQuarter, selectedYear, periodMode }) {
  const { data, loading } = useGoogleSheets();
  const [growthView, setGrowthView] = React.useState('mom');
  const rawRows = data['ActualVsTarget']?.elements || [];

  if (loading) {
    return <div className="card-message">Loading data...</div>;
  }

  if (rawRows.length === 0) {
    return <div className="card-message">Data `ActualVsTarget` belum tersedia.</div>;
  }

  const mappedRows = rawRows.map((row) => {
    const month = normalizeText(getRowValue(row, ['Month', 'MONTH', 'Bulan', 'month']));
    const year = String(getRowValue(row, ['Year', 'YEAR', 'Tahun', 'year']) || '').trim();
    const actual = parseNumber(getRowValue(row, ['Actual', 'ACTUAL', 'Revenue', 'Sales', 'actual']));

    return { month, year, actual };
  }).filter((row) => row.month && !Number.isNaN(row.actual));

  const hasYearData = mappedRows.some((row) => row.year);
  const rowsByYear = hasYearData
    ? mappedRows.filter((row) => row.year === String(selectedYear))
    : mappedRows;

  const selectedMonthIndex = MONTH_OPTIONS.indexOf(normalizeText(selectedMonth));
  const sortedByMonth = [...rowsByYear].sort((a, b) => MONTH_OPTIONS.indexOf(a.month) - MONTH_OPTIONS.indexOf(b.month));

  const ytdRows = sortedByMonth.filter((row) => {
    const monthIndex = MONTH_OPTIONS.indexOf(row.month);
    return monthIndex >= 0 && (selectedMonthIndex < 0 || monthIndex <= selectedMonthIndex);
  });

  const quarterMonths = getQuarterMonths(selectedQuarter);
  const quarterlyRows = sortedByMonth.filter((row) => quarterMonths.includes(row.month));

  const rowsToUse = periodMode === 'yearly'
    ? sortedByMonth
    : periodMode === 'quarterly'
      ? (quarterlyRows.length > 0 ? quarterlyRows : sortedByMonth)
      : (ytdRows.length > 0 ? ytdRows : sortedByMonth);

  if (rowsToUse.length === 0) {
    return <div className="card-message">Data revenue tidak ditemukan untuk filter saat ini.</div>;
  }

  const rowLookup = mappedRows.reduce((acc, row) => {
    if (row.year) {
      acc[`${row.year}-${row.month}`] = row;
    }
    return acc;
  }, {});

  const momGrowthRows = rowsToUse.map((row, index) => {
    if (hasYearData) {
      const monthIndex = MONTH_OPTIONS.indexOf(row.month);
      const yearNumber = Number(row.year);

      if (monthIndex >= 0 && Number.isFinite(yearNumber)) {
        const prevMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1;
        const prevYear = monthIndex === 0 ? yearNumber - 1 : yearNumber;
        const prevMonth = MONTH_OPTIONS[prevMonthIndex];
        const prevKey = `${prevYear}-${prevMonth}`;
        const prevRow = rowLookup[prevKey];

        if (prevRow && prevRow.actual) {
          const growth = ((row.actual - prevRow.actual) / prevRow.actual) * 100;
          return { ...row, growth };
        }
      }
    }

    if (index === 0) {
      return { ...row, growth: null };
    }

    const prev = rowsToUse[index - 1].actual;
    if (!prev) {
      return { ...row, growth: null };
    }

    const growth = ((row.actual - prev) / prev) * 100;
    return { ...row, growth };
  });

  const quarterlyTotals = rowsToUse.reduce((acc, row) => {
    const monthIndex = MONTH_OPTIONS.indexOf(row.month);
    if (monthIndex < 0) {
      return acc;
    }
    const quarter = Math.floor(monthIndex / 3) + 1;
    acc[quarter] = (acc[quarter] || 0) + row.actual;
    return acc;
  }, {});

  const quarterRows = Object.entries(quarterlyTotals)
    .map(([quarter, actual]) => ({ period: `Q${quarter}`, actual }))
    .sort((a, b) => Number(a.period.slice(1)) - Number(b.period.slice(1)));

  const qoqGrowthRows = quarterRows.map((row, index) => {
    if (index === 0) {
      return { ...row, growth: null };
    }
    const prev = quarterRows[index - 1].actual;
    if (!prev) {
      return { ...row, growth: null };
    }
    const growth = ((row.actual - prev) / prev) * 100;
    return { ...row, growth };
  });

  const displayRows = growthView === 'qoq'
    ? qoqGrowthRows.map((row) => ({ ...row, label: row.period }))
    : momGrowthRows.map((row) => ({ ...row, label: row.month }));

  const computedGrowthValues = displayRows
    .map((row) => row.growth)
    .filter((value) => typeof value === 'number' && Number.isFinite(value));

  const maxAbsGrowth = Math.max(...computedGrowthValues.map((value) => Math.abs(value)), 1);

  return (
    <div className="growth-card-wrap">
      <div className="growth-view-toggle">
        <button
          type="button"
          className={`growth-toggle-btn ${growthView === 'mom' ? 'active' : ''}`}
          onClick={() => setGrowthView('mom')}
        >
          MoM
        </button>
        <button
          type="button"
          className={`growth-toggle-btn ${growthView === 'qoq' ? 'active' : ''}`}
          onClick={() => setGrowthView('qoq')}
        >
          QoQ
        </button>
      </div>

      <div
        className="growth-column-chart"
        style={{ gridTemplateColumns: `repeat(${Math.max(displayRows.length, 1)}, minmax(20px, 1fr))` }}
      >
      {displayRows.map((row) => {
        const hasGrowth = typeof row.growth === 'number' && Number.isFinite(row.growth);
        const isPositive = hasGrowth ? row.growth >= 0 : false;
        const height = hasGrowth ? (Math.abs(row.growth) / maxAbsGrowth) * 100 : 0;

        return (
          <div key={`${row.label}-${row.year || selectedYear || 'na'}`} className="growth-col-item">
            <div className="growth-col-value">{hasGrowth ? `${row.growth.toFixed(1)}%` : 'N/A'}</div>
            <div className="growth-col-track">
              <div className="growth-col-half top">
                {hasGrowth && isPositive && (
                  <div className="growth-col-bar positive" style={{ height: `${height}%` }} />
                )}
              </div>
              <div className="growth-col-half bottom">
                {hasGrowth && !isPositive && (
                  <div className="growth-col-bar negative" style={{ height: `${height}%` }} />
                )}
              </div>
              <div className="growth-col-zero" />
            </div>
            <div className="growth-col-month">{row.label}</div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

function ReceivableDaysCard({ selectedMonth, selectedQuarter, selectedYear, periodMode }) {
  const { data, loading } = useGoogleSheets();
  const rawRows = data['ReceivableDays']?.elements || [];

  if (loading) {
    return <div className="card-message">Loading data...</div>;
  }

  if (rawRows.length === 0) {
    return <div className="card-message">Data `ReceivableDays` belum tersedia.</div>;
  }

  const mappedRows = rawRows
    .map((row) => ({
      month: normalizeText(getRowValue(row, ['Month', 'MONTH', 'Bulan', 'month'])),
      year: String(getRowValue(row, ['Year', 'YEAR', 'Tahun', 'year']) || '').trim(),
      value: parseNumber(getRowValue(row, ['Value', 'VALUE', 'Receivable Days', 'Days', 'Actual', 'value'])),
      target: parseNumber(getRowValue(row, ['Target', 'TARGET', 'target'])),
      lastYear: parseNumber(getRowValue(row, ['LastYear', 'Last Year', 'LASTYEAR', 'lastyear', 'LY', 'Last_Year'])),
    }))
    .filter((row) => !Number.isNaN(row.value) || !Number.isNaN(row.target) || !Number.isNaN(row.lastYear));

  if (mappedRows.length === 0) {
    return <div className="card-message">Nilai receivable days belum ditemukan.</div>;
  }

  const hasYearData = mappedRows.some((row) => row.year);
  const rowsByYear = hasYearData
    ? mappedRows.filter((row) => row.year === String(selectedYear))
    : mappedRows;

  const baseRows = hasYearData ? rowsByYear : mappedRows;
  const hasMonthData = baseRows.some((row) => row.month);

  const rowsByPeriod = (() => {
    if (!hasMonthData) return baseRows;

    if (periodMode === 'yearly') {
      return baseRows;
    }

    if (periodMode === 'quarterly') {
      const quarterMonths = getQuarterMonths(selectedQuarter);
      return baseRows.filter((row) => quarterMonths.includes(row.month));
    }

    const selectedMonthIndex = MONTH_OPTIONS.indexOf(normalizeText(selectedMonth));
    return baseRows.filter((row) => {
      const monthIndex = MONTH_OPTIONS.indexOf(row.month);
      if (monthIndex < 0) return false;
      return selectedMonthIndex < 0 || monthIndex <= selectedMonthIndex;
    });
  })();

  const rowsToUse = (rowsByPeriod.length > 0 ? rowsByPeriod : baseRows)
    .map((row) => ({ ...row, monthIndex: MONTH_OPTIONS.indexOf(row.month) }))
    .sort((a, b) => a.monthIndex - b.monthIndex);

  const selectedRow = rowsToUse[rowsToUse.length - 1];
  const currentValue = selectedRow?.value;
  const targetValue = selectedRow?.target;
  const lastYearValue = selectedRow?.lastYear;

  if (Number.isNaN(currentValue)) {
    return <div className="card-message">Value receivable days belum tersedia.</div>;
  }

  const scaleCandidates = [currentValue, targetValue, lastYearValue]
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.abs(value));

  const maxBase = Math.max(1, ...scaleCandidates);
  const maxScale = Math.max(maxBase * 1.2, Number.isFinite(targetValue) ? targetValue * 1.5 : 0, 30);

  const clamp01 = (value) => Math.max(0, Math.min(1, value));
  const normalizedValue = clamp01(currentValue / maxScale);
  const normalizedTarget = Number.isFinite(targetValue) ? clamp01(targetValue / maxScale) : null;
  const needleDegrees = 180 * (1 - normalizedValue);

  const angleFromRatio = (ratio) => Math.PI * (1 - ratio);

  const targetAngle = normalizedTarget !== null ? angleFromRatio(normalizedTarget) : null;
  const targetX1 = targetAngle !== null ? 80 + Math.cos(targetAngle) * 52 : null;
  const targetY1 = targetAngle !== null ? 80 - Math.sin(targetAngle) * 52 : null;
  const targetX2 = targetAngle !== null ? 80 + Math.cos(targetAngle) * 62 : null;
  const targetY2 = targetAngle !== null ? 80 - Math.sin(targetAngle) * 62 : null;

  const onTarget = Number.isFinite(targetValue) ? currentValue <= targetValue : null;
  const statusClass = onTarget === null ? 'neutral' : onTarget ? 'good' : 'bad';
  const statusText = onTarget === null ? 'No Target' : onTarget ? 'On Target' : 'Above Target';

  const formatDay = (value) => {
    if (!Number.isFinite(value)) return '-';
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: Math.abs(value % 1) > 0 ? 1 : 0,
      maximumFractionDigits: 1,
    }).format(value);
  };

  return (
    <div className="receivable-gauge-wrap">
      <div className="receivable-gauge-chart">
        <svg viewBox="0 0 160 92" className="receivable-gauge-svg" aria-label="Receivable Days gauge">
          <path d="M20 80 A60 60 0 0 1 140 80" className="receivable-gauge-track" />
          <path
            d="M20 80 A60 60 0 0 1 140 80"
            className={`receivable-gauge-fill ${statusClass}`}
            style={{ strokeDasharray: `${(Math.PI * 60 * normalizedValue).toFixed(2)} ${(Math.PI * 60).toFixed(2)}` }}
          />
          {targetAngle !== null && (
            <line
              x1={targetX1}
              y1={targetY1}
              x2={targetX2}
              y2={targetY2}
              className="receivable-gauge-target-marker"
            />
          )}
          <g
            className="receivable-gauge-needle-group"
            style={{ transform: `rotate(${needleDegrees}deg)`, transformOrigin: '80px 80px' }}
          >
            <line x1="80" y1="80" x2="128" y2="80" className="receivable-gauge-needle" />
          </g>
          <circle cx="80" cy="80" r="4" className="receivable-gauge-center" />
        </svg>

        <div className="receivable-gauge-value">{formatDay(currentValue)} days</div>
        <div className={`receivable-gauge-status ${statusClass}`}>{statusText}</div>
      </div>

      <div className="receivable-gauge-metrics">
        <div className="receivable-gauge-metric-item">
          <span>Target</span>
          <strong>{formatDay(targetValue)} days</strong>
        </div>
        <div className="receivable-gauge-metric-item">
          <span>Last Year</span>
          <strong>{formatDay(lastYearValue)} days</strong>
        </div>
      </div>
    </div>
  );
}

function InventoryDaysCard({ selectedMonth, selectedQuarter, selectedYear, periodMode }) {
  const { data, loading } = useGoogleSheets();
  const rawRows = data['InventoryDays']?.elements || [];

  if (loading) {
    return <div className="card-message">Loading data...</div>;
  }

  if (rawRows.length === 0) {
    return <div className="card-message">Data `InventoryDays` belum tersedia.</div>;
  }

  const mappedRows = rawRows
    .map((row) => ({
      month: normalizeText(getRowValue(row, ['Month', 'MONTH', 'Bulan', 'month'])),
      year: String(getRowValue(row, ['Year', 'YEAR', 'Tahun', 'year']) || '').trim(),
      value: parseNumber(getRowValue(row, ['Value', 'VALUE', 'Inventory Days', 'Days', 'Actual', 'value'])),
      target: parseNumber(getRowValue(row, ['Target', 'TARGET', 'target'])),
      lastYear: parseNumber(getRowValue(row, ['LastYear', 'Last Year', 'LASTYEAR', 'lastyear', 'LY', 'Last_Year'])),
    }))
    .filter((row) => !Number.isNaN(row.value) || !Number.isNaN(row.target) || !Number.isNaN(row.lastYear));

  if (mappedRows.length === 0) {
    return <div className="card-message">Nilai inventory days belum ditemukan.</div>;
  }

  const hasYearData = mappedRows.some((row) => row.year);
  const rowsByYear = hasYearData
    ? mappedRows.filter((row) => row.year === String(selectedYear))
    : mappedRows;

  const baseRows = hasYearData ? rowsByYear : mappedRows;
  const hasMonthData = baseRows.some((row) => row.month);

  const rowsByPeriod = (() => {
    if (!hasMonthData) return baseRows;

    if (periodMode === 'yearly') {
      return baseRows;
    }

    if (periodMode === 'quarterly') {
      const quarterMonths = getQuarterMonths(selectedQuarter);
      return baseRows.filter((row) => quarterMonths.includes(row.month));
    }

    const selectedMonthIndex = MONTH_OPTIONS.indexOf(normalizeText(selectedMonth));
    return baseRows.filter((row) => {
      const monthIndex = MONTH_OPTIONS.indexOf(row.month);
      if (monthIndex < 0) return false;
      return selectedMonthIndex < 0 || monthIndex <= selectedMonthIndex;
    });
  })();

  const rowsToUse = (rowsByPeriod.length > 0 ? rowsByPeriod : baseRows)
    .map((row) => ({ ...row, monthIndex: MONTH_OPTIONS.indexOf(row.month) }))
    .sort((a, b) => a.monthIndex - b.monthIndex);

  const selectedRow = rowsToUse[rowsToUse.length - 1];
  const currentValue = selectedRow?.value;
  const targetValue = selectedRow?.target;
  const lastYearValue = selectedRow?.lastYear;

  if (Number.isNaN(currentValue)) {
    return <div className="card-message">Value inventory days belum tersedia.</div>;
  }

  const scaleCandidates = [currentValue, targetValue, lastYearValue]
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.abs(value));

  const maxBase = Math.max(1, ...scaleCandidates);
  const maxScale = Math.max(maxBase * 1.2, Number.isFinite(targetValue) ? targetValue * 1.5 : 0, 30);

  const clamp01 = (value) => Math.max(0, Math.min(1, value));
  const normalizedValue = clamp01(currentValue / maxScale);
  const normalizedTarget = Number.isFinite(targetValue) ? clamp01(targetValue / maxScale) : null;
  const needleDegrees = 180 * (1 - normalizedValue);

  const angleFromRatio = (ratio) => Math.PI * (1 - ratio);

  const targetAngle = normalizedTarget !== null ? angleFromRatio(normalizedTarget) : null;
  const targetX1 = targetAngle !== null ? 80 + Math.cos(targetAngle) * 52 : null;
  const targetY1 = targetAngle !== null ? 80 - Math.sin(targetAngle) * 52 : null;
  const targetX2 = targetAngle !== null ? 80 + Math.cos(targetAngle) * 62 : null;
  const targetY2 = targetAngle !== null ? 80 - Math.sin(targetAngle) * 62 : null;

  const onTarget = Number.isFinite(targetValue) ? currentValue <= targetValue : null;
  const statusClass = onTarget === null ? 'neutral' : onTarget ? 'good' : 'bad';
  const statusText = onTarget === null ? 'No Target' : onTarget ? 'On Target' : 'Above Target';

  const formatDay = (value) => {
    if (!Number.isFinite(value)) return '-';
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: Math.abs(value % 1) > 0 ? 1 : 0,
      maximumFractionDigits: 1,
    }).format(value);
  };

  return (
    <div className="receivable-gauge-wrap">
      <div className="receivable-gauge-chart">
        <svg viewBox="0 0 160 92" className="receivable-gauge-svg" aria-label="Inventory Days gauge">
          <path d="M20 80 A60 60 0 0 1 140 80" className="receivable-gauge-track" />
          <path
            d="M20 80 A60 60 0 0 1 140 80"
            className={`receivable-gauge-fill ${statusClass}`}
            style={{ strokeDasharray: `${(Math.PI * 60 * normalizedValue).toFixed(2)} ${(Math.PI * 60).toFixed(2)}` }}
          />
          {targetAngle !== null && (
            <line
              x1={targetX1}
              y1={targetY1}
              x2={targetX2}
              y2={targetY2}
              className="receivable-gauge-target-marker"
            />
          )}
          <g
            className="receivable-gauge-needle-group"
            style={{ transform: `rotate(${needleDegrees}deg)`, transformOrigin: '80px 80px' }}
          >
            <line x1="80" y1="80" x2="128" y2="80" className="receivable-gauge-needle" />
          </g>
          <circle cx="80" cy="80" r="4" className="receivable-gauge-center" />
        </svg>

        <div className="receivable-gauge-value">{formatDay(currentValue)} days</div>
        <div className={`receivable-gauge-status ${statusClass}`}>{statusText}</div>
      </div>

      <div className="receivable-gauge-metrics">
        <div className="receivable-gauge-metric-item">
          <span>Target</span>
          <strong>{formatDay(targetValue)} days</strong>
        </div>
        <div className="receivable-gauge-metric-item">
          <span>Last Year</span>
          <strong>{formatDay(lastYearValue)} days</strong>
        </div>
      </div>
    </div>
  );
}

function YearOnYearKpiCard() {
  const { data, loading } = useGoogleSheets();
  const kpiRows = data['KPIs']?.elements || [];

  if (loading) {
    return <div className="card-message">Loading YoY KPI...</div>;
  }

  if (kpiRows.length === 0) {
    return <div className="card-message">Data `KPIs` belum tersedia.</div>;
  }

  const normalizeMetric = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

  const metricAlias = {
    rev: 'rev',
    revenue: 'rev',
    sales: 'rev',
    totalsales: 'rev',
    netsales: 'rev',
    opex: 'opex',
    operatingexpense: 'opex',
    operatingexpenses: 'opex',
    operationalexpense: 'opex',
    operationalexpenses: 'opex',
    gross: 'gross',
    grossprofit: 'gross',
    net: 'nett',
    nett: 'nett',
    netprofit: 'nett',
  };

  const longRows = kpiRows
    .map((row) => {
      const periodParts = parsePeriodParts(
        getRowValue(row, ['Period', 'PERIOD', 'Periode', 'periode', 'MonthYear', 'MONTHYEAR', 'YearMonth', 'YEARMONTH'])
      );
      const metric = String(getRowValue(row, ['Metric', 'METRIC', 'metric']) || '').trim();
      const value = parseNumber(getRowValue(row, ['Value', 'VALUE', 'value']));
      const year = String(getRowValue(row, ['Year', 'YEAR', 'Tahun', 'year']) || '').trim() || periodParts.year;
      return { metric, value, year };
    })
    .filter((row) => row.metric && !Number.isNaN(row.value) && /^\d{4}$/.test(row.year));

  const wideMetricDefinitions = [
    { key: 'rev', columns: ['Revenue', 'Sales', 'Total Sales', 'Net Sales'] },
    { key: 'opex', columns: ['OPEX', 'Operating Expenses', 'Operational Expenses'] },
    { key: 'gross', columns: ['Gross Profit', 'Gross'] },
    { key: 'nett', columns: ['Net Profit', 'Net', 'Nett'] },
  ];

  const wideRows = kpiRows.flatMap((row) => {
    const metricCell = String(getRowValue(row, ['Metric', 'METRIC', 'metric']) || '').trim();
    if (metricCell) {
      return [];
    }

    const periodParts = parsePeriodParts(
      getRowValue(row, ['Period', 'PERIOD', 'Periode', 'periode', 'MonthYear', 'MONTHYEAR', 'YearMonth', 'YEARMONTH'])
    );
    const year = String(getRowValue(row, ['Year', 'YEAR', 'Tahun', 'year']) || '').trim() || periodParts.year;
    if (!/^\d{4}$/.test(year)) {
      return [];
    }

    return wideMetricDefinitions
      .map(({ key, columns }) => {
        const raw = getRowValue(row, columns);
        const value = parseNumber(raw);
        if (Number.isNaN(value)) {
          return null;
        }
        return { metric: key, value, year, normalized: key };
      })
      .filter(Boolean);
  });

  const normalizedLongRows = longRows
    .map((row) => {
      const normalized = metricAlias[normalizeMetric(row.metric)];
      if (!normalized) {
        return null;
      }
      return { ...row, normalized };
    })
    .filter(Boolean);

  const mergedRows = [...normalizedLongRows, ...wideRows];
  if (mergedRows.length === 0) {
    return <div className="card-message">Data KPI achievement belum ditemukan.</div>;
  }

  const totalsByYearMetric = mergedRows.reduce((acc, row) => {
    if (!acc[row.year]) {
      acc[row.year] = {};
    }
    acc[row.year][row.normalized] = (acc[row.year][row.normalized] || 0) + row.value;
    return acc;
  }, {});

  const currentYear = new Date().getFullYear();
  const staticYears = Array.from({ length: 5 }, (_, index) => String(currentYear - 4 + index));

  const metricList = [
    { key: 'rev', label: 'Revenue' },
    { key: 'opex', label: 'OPEX' },
    { key: 'gross', label: 'Gross Profit' },
    { key: 'nett', label: 'Net Profit' },
  ];

  const metricRows = metricList.map(({ key, label }) => {
    const points = staticYears.map((year) => {
      const value = totalsByYearMetric[year]?.[key];
      const hasValue = typeof value === 'number' && Number.isFinite(value);
      return { year, value: hasValue ? value : null };
    });

    return {
      key,
      label,
      points,
    };
  });

  const metricValues = metricRows
    .flatMap((row) => row.points.map((point) => point.value))
    .filter((value) => typeof value === 'number' && Number.isFinite(value));

  if (metricValues.length === 0) {
    return <div className="card-message">Achievement 5 tahun terakhir belum tersedia.</div>;
  }

  const formatCompact = (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
    return new Intl.NumberFormat('id-ID', {
      notation: 'compact',
      compactDisplay: 'short',
      maximumFractionDigits: 1,
    }).format(value);
  };

  return (
    <div className="yoy-kpi-wrap">
      <div className="yoy-kpi-grid">
        {metricRows.map((row) => {
          const rowMaxAbsValue = Math.max(
            1,
            ...row.points
              .map((point) => point.value)
              .filter((value) => typeof value === 'number' && Number.isFinite(value))
              .map((value) => Math.abs(value))
          );

          return (
            <div key={row.key} className={`yoy-kpi-item yoy-kpi-item-${row.key}`}>
              <div className="yoy-kpi-label">{row.label}</div>
              <div
                className="yoy-kpi-series"
                style={{ gridTemplateColumns: `repeat(${Math.max(row.points.length, 1)}, minmax(22px, 1fr))` }}
              >
                {row.points.map((point) => {
                  const hasValue = typeof point.value === 'number' && Number.isFinite(point.value);
                  const isPositive = hasValue ? point.value >= 0 : false;
                  const height = hasValue ? (Math.abs(point.value) / rowMaxAbsValue) * 100 : 0;
                  const valueClass = hasValue
                    ? (point.value >= 0 ? 'positive' : 'negative')
                    : '';

                  return (
                    <div key={`${row.key}-${point.year}`} className="yoy-kpi-point">
                      <div className={`yoy-kpi-point-value achievement ${valueClass}`}>
                        {formatCompact(point.value)}
                      </div>
                      <div className="yoy-kpi-point-track">
                        <div className="yoy-kpi-point-half top">
                          {hasValue && isPositive && <div className="yoy-kpi-point-bar positive" style={{ height: `${height}%` }} />}
                        </div>
                        <div className="yoy-kpi-point-half bottom">
                          {hasValue && !isPositive && <div className="yoy-kpi-point-bar negative" style={{ height: `${height}%` }} />}
                        </div>
                        <div className="yoy-kpi-point-zero" />
                      </div>
                      <div className="yoy-kpi-point-year">{String(point.year).slice(2)}</div>
                    </div>
                  );
                })}
              </div>
              <div className="yoy-kpi-note">
                Achievement per tahun (5 tahun terakhir, statis)
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnnualReportCard({ selectedYear }) {
  const { data, loading } = useGoogleSheets();
  const actualVsTargetRows = data['ActualVsTarget']?.elements || [];

  if (loading) {
    return <div className="card-message">Loading annual report...</div>;
  }

  const mappedActualTarget = actualVsTargetRows.map((row) => ({
    month: normalizeText(getRowValue(row, ['Month', 'MONTH', 'Bulan', 'month'])),
    year: String(getRowValue(row, ['Year', 'YEAR', 'Tahun', 'year']) || '').trim(),
    actual: parseNumber(getRowValue(row, ['Actual', 'ACTUAL', 'Revenue', 'Sales', 'actual'])),
    target: parseNumber(getRowValue(row, ['Target', 'TARGET', 'Target Revenue', 'Target Sales', 'target'])),
  })).filter((row) => !Number.isNaN(row.actual) || !Number.isNaN(row.target));

  const hasYearActualTarget = mappedActualTarget.some((row) => row.year);
  const yearlyActualTarget = hasYearActualTarget
    ? mappedActualTarget.filter((row) => row.year === String(selectedYear))
    : mappedActualTarget;

  const totalActual = yearlyActualTarget.reduce((sum, row) => sum + (Number.isNaN(row.actual) ? 0 : row.actual), 0);
  const totalTarget = yearlyActualTarget.reduce((sum, row) => sum + (Number.isNaN(row.target) ? 0 : row.target), 0);
  const annualAchievement = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
  const annualVariance = totalActual - totalTarget;

  const monthlyActualMap = yearlyActualTarget.reduce((acc, row) => {
    const month = normalizeText(row.month);
    const monthIndex = MONTH_OPTIONS.indexOf(month);
    if (monthIndex < 0 || Number.isNaN(row.actual)) {
      return acc;
    }
    const prevValue = acc[monthIndex]?.actual || 0;
    acc[monthIndex] = {
      month,
      monthIndex,
      actual: prevValue + row.actual,
    };
    return acc;
  }, {});

  const sortedMonthlyActual = Object.values(monthlyActualMap).sort((a, b) => a.monthIndex - b.monthIndex);
  const yearlyGrowth = [];
  for (let i = 1; i < sortedMonthlyActual.length; i += 1) {
    const prevActual = sortedMonthlyActual[i - 1].actual;
    const currentActual = sortedMonthlyActual[i].actual;
    if (prevActual === 0) {
      continue;
    }
    yearlyGrowth.push({
      month: sortedMonthlyActual[i].month,
      growth: ((currentActual - prevActual) / prevActual) * 100,
    });
  }

  const avgGrowth = yearlyGrowth.length > 0
    ? yearlyGrowth.reduce((sum, row) => sum + row.growth, 0) / yearlyGrowth.length
    : NaN;

  const sortedGrowth = [...yearlyGrowth].sort((a, b) => b.growth - a.growth);
  const bestGrowth = sortedGrowth[0];
  const worstGrowth = sortedGrowth[sortedGrowth.length - 1];

  return (
    <div className="annual-report-wrap">
      <div className="annual-report-grid">
        <div className="annual-report-item annual-report-item-3d">
          <div className="annual-report-label">Total Actual Revenue</div>
          <div className="annual-report-value">{totalActual.toLocaleString()}</div>
        </div>
        <div className="annual-report-item annual-report-item-3d">
          <div className="annual-report-label">Total Target Revenue</div>
          <div className="annual-report-value">{totalTarget.toLocaleString()}</div>
        </div>
        <div className="annual-report-item annual-report-item-3d">
          <div className="annual-report-label">Annual Achievement</div>
          <div className="annual-report-value">{Number.isFinite(annualAchievement) ? `${annualAchievement.toFixed(1)}%` : '-'}</div>
        </div>
        <div className="annual-report-item annual-report-item-3d">
          <div className="annual-report-label">Annual Variance</div>
          <div className={`annual-report-value ${annualVariance < 0 ? 'negative' : 'positive'}`}>
            {annualVariance.toLocaleString()}
          </div>
        </div>
        <div className="annual-report-item annual-report-item-3d">
          <div className="annual-report-label">Avg Revenue Growth</div>
          <div className="annual-report-value">{Number.isNaN(avgGrowth) ? '-' : `${avgGrowth.toFixed(1)}%`}</div>
        </div>
        <div className="annual-report-item annual-report-item-3d">
          <div className="annual-report-label">Best / Worst Month</div>
          <div className="annual-report-value annual-report-small">
            {bestGrowth ? `${bestGrowth.month} ${bestGrowth.growth.toFixed(1)}%` : '-'}
            {' / '}
            {worstGrowth ? `${worstGrowth.month} ${worstGrowth.growth.toFixed(1)}%` : '-'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout() {
  const { data, syncKpiNow, isSyncing, lastUpdated, validationIssues } = useGoogleSheets();
  const [selectedMonth, setSelectedMonth] = React.useState('JUN');
  const [selectedQuarter, setSelectedQuarter] = React.useState('Q2');
  const [selectedYear, setSelectedYear] = React.useState(String(new Date().getFullYear()));
  const [periodMode, setPeriodMode] = React.useState('ytd');
  const [syncStatus, setSyncStatus] = React.useState('');
  const [lastManualSyncAt, setLastManualSyncAt] = React.useState('');
  const [showQualityPopup, setShowQualityPopup] = React.useState(false);

  const handleSyncKpiNow = async () => {
    setSyncStatus('Syncing KPI...');
    try {
      const result = await syncKpiNow();
      const syncedRows = Number(result?.syncedRows) || 0;
      setSyncStatus(`Sync selesai (${syncedRows} rows).`);
      setLastManualSyncAt(new Date().toISOString());
    } catch (error) {
      setSyncStatus(`Sync gagal: ${error?.message || 'unknown error'}`);
    }
  };

  const lastSyncSource = lastManualSyncAt || lastUpdated;
  const lastSyncText = lastSyncSource
    ? new Date(lastSyncSource).toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    : '-';

  const yearOptions = React.useMemo(() => {
    const years = new Set([String(selectedYear)]);
    const sourceTabs = ['ActualVsTarget', 'KPIs', 'SalesByRegion', 'SalesByChannel', 'SalesGrowth', 'SalesByProduct'];

    sourceTabs.forEach((tabName) => {
      const rows = data?.[tabName]?.elements || [];
      rows.forEach((row) => {
        const yearValue = String(getRowValue(row, ['Year', 'YEAR', 'Tahun', 'year']) || '').trim();
        if (/^\d{4}$/.test(yearValue)) {
          years.add(yearValue);
        }
      });
    });

    if (years.size <= 1) {
      ['2023', '2024', '2025', '2026'].forEach((year) => years.add(year));
    }

    return [...years].sort((a, b) => Number(a) - Number(b));
  }, [data, selectedYear]);

  const periodContextText = periodMode === 'yearly'
    ? `Full Year ${selectedYear}`
    : periodMode === 'quarterly'
      ? `${selectedQuarter} ${selectedYear}`
      : `YTD up to ${selectedMonth} ${selectedYear}`;

  const qualityIssueCount = Array.isArray(validationIssues) ? validationIssues.length : 0;
  const qualityLabel = qualityIssueCount > 0 ? `Needs Attention (${qualityIssueCount})` : 'Healthy';
  const qualityClass = qualityIssueCount > 0 ? 'warning' : 'healthy';
  const qualityDetail = qualityIssueCount > 0
    ? validationIssues.map((item) => item?.message).filter(Boolean).join(' | ')
    : 'Semua tab utama valid.';

  const brandingRows = data?.Branding?.elements || [];
  const brandingKeys = [
    'Organization',
    'ORGANIZATION',
    'Org',
    'ORG',
    'Brand',
    'BRAND',
    'Title',
    'TITLE',
    'Company',
    'COMPANY',
    'Name',
    'NAME',
  ];

  const headerLikeValue = (text) => /^(organization|org|brand|title|company|name)$/i.test(String(text || '').trim());

  const organizationTitle = (() => {
    for (const row of brandingRows) {
      const fromNamedColumn = String(getRowValue(row, brandingKeys) || '').trim();
      if (fromNamedColumn && !headerLikeValue(fromNamedColumn)) {
        return fromNamedColumn;
      }
    }

    for (const row of brandingRows) {
      const cellValues = Object.values(row || {})
        .map((value) => String(value || '').trim())
        .filter(Boolean);
      const fromAnyCell = cellValues.find((value) => !headerLikeValue(value));
      if (fromAnyCell) {
        return fromAnyCell;
      }
    }

    return 'Sport & Wellness';
  })();

  return (
    <div className="dashboard-root">
      <div className="dashboard-header">
        <div className="dashboard-title-wrap">
          <span>{`${organizationTitle} | ${periodMode === 'yearly' ? 'Annual Report' : periodMode === 'quarterly' ? 'Quarterly Report' : 'YTD Report'}`}</span>
          <span className="dashboard-period-context">{periodContextText}</span>
        </div>
        <div className="filter-bar">
          <span>Mode</span>
          <select value={periodMode} onChange={(e) => setPeriodMode(e.target.value)}>
            <option value="ytd">YTD</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
          <span>Select Year</span>
          <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
            {yearOptions.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          {periodMode === 'ytd' && (
            <>
              <span>Select Month</span>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                {MONTH_OPTIONS.map((month) => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </>
          )}
          {periodMode === 'quarterly' && (
            <>
              <span>Select Quarter</span>
              <select value={selectedQuarter} onChange={(e) => setSelectedQuarter(e.target.value)}>
                {QUARTER_OPTIONS.map((quarter) => (
                  <option key={quarter} value={quarter}>{quarter}</option>
                ))}
              </select>
            </>
          )}
          <button
            type="button"
            className="sync-kpi-btn"
            onClick={handleSyncKpiNow}
            disabled={isSyncing}
          >
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
          <span
            className={`data-quality-chip ${qualityClass}`}
            title={qualityDetail}
            style={{ cursor: qualityIssueCount > 0 ? 'pointer' : 'default', position: 'relative' }}
            onClick={() => qualityIssueCount > 0 && setShowQualityPopup((v) => !v)}
            tabIndex={qualityIssueCount > 0 ? 0 : -1}
            role={qualityIssueCount > 0 ? 'button' : undefined}
            aria-haspopup={qualityIssueCount > 0 ? 'dialog' : undefined}
            aria-expanded={showQualityPopup}
          >
            Data Quality: {qualityLabel}
            {showQualityPopup && qualityIssueCount > 0 && (
              <div className="data-quality-popup">
                <div className="data-quality-popup-title">Data Quality Issues</div>
                <ul className="data-quality-popup-list">
                  {validationIssues.map((item, idx) => (
                    <li key={idx} className="data-quality-popup-item">{item?.message || 'Unknown issue'}</li>
                  ))}
                </ul>
                <button className="data-quality-popup-close" onClick={(e) => { e.stopPropagation(); setShowQualityPopup(false); }}>Close</button>
              </div>
            )}
          </span>
          <span className="sync-kpi-last">Last sync: {lastSyncText}</span>
          {syncStatus && <span className="sync-kpi-status">{syncStatus}</span>}
        </div>
      </div>
      <div className="dashboard-content">
        {/* KPI Column */}
        <div className="dashboard-side-panel" style={{gridRow:'1 / span 7'}}>
          <KPIPanel selectedMonth={selectedMonth} selectedQuarter={selectedQuarter} selectedYear={selectedYear} periodMode={periodMode} />
        </div>
        {/* Chart Grid */}
        <ChartCard
          title={(
            <span className="chart-title-inline">
              <span>Actual Revenue vs Target</span>
              <span className="chart-title-context-inline">{periodContextText}</span>
            </span>
          )}
          className="chart-card-3d"
          style={{gridColumn:'2 / span 3',gridRow:'1'}}
        >
          <ActualVsTargetCard selectedMonth={selectedMonth} selectedQuarter={selectedQuarter} selectedYear={selectedYear} periodMode={periodMode} />
        </ChartCard>
        <ChartCard
          title="Yearly Achievement"
          className="yearly-achievement-card"
          style={{gridColumn:'2 / span 3',gridRow: periodMode === 'yearly' ? '3' : '2',minHeight:'220px'}}
        >
          <YearOnYearKpiCard />
        </ChartCard>
        <ChartCard title="Sales by Region" style={{gridColumn:'2 / span 2',gridRow: periodMode === 'yearly' ? '4' : '3',minHeight:'360px'}}>
          <RevenueByRegionCard selectedMonth={selectedMonth} selectedQuarter={selectedQuarter} selectedYear={selectedYear} periodMode={periodMode} />
        </ChartCard>
        <ChartCard title="Revenue by Channel" style={{gridColumn:'4',gridRow: periodMode === 'yearly' ? '4' : '3',minHeight:'300px'}}>
          <RevenueByChannelCard selectedMonth={selectedMonth} selectedQuarter={selectedQuarter} selectedYear={selectedYear} periodMode={periodMode} />
        </ChartCard>
        <ChartCard title="Revenue Growth" style={{gridColumn:'2 / span 3',gridRow: periodMode === 'yearly' ? '5' : '4',minHeight:'260px'}}>
          <RevenueGrowthCard selectedMonth={selectedMonth} selectedQuarter={selectedQuarter} selectedYear={selectedYear} periodMode={periodMode} />
        </ChartCard>
        <ChartCard
          title={(
            <>
              Revenue by Product
              <span className="chart-title-subtle">Top 5</span>
            </>
          )}
          style={{gridColumn:'2 / span 3',gridRow: periodMode === 'yearly' ? '6' : '5',minHeight:'320px'}}
        >
          <RevenueByProductCard selectedMonth={selectedMonth} selectedQuarter={selectedQuarter} selectedYear={selectedYear} periodMode={periodMode} />
        </ChartCard>
        <ChartCard title="Receivable Days Outstanding" style={{gridColumn:'2',gridRow: periodMode === 'yearly' ? '7' : '6',minHeight:'190px'}}>
          <ReceivableDaysCard selectedMonth={selectedMonth} selectedQuarter={selectedQuarter} selectedYear={selectedYear} periodMode={periodMode} />
        </ChartCard>
        <ChartCard title="Inventory Days Outstanding" style={{gridColumn:'3',gridRow: periodMode === 'yearly' ? '7' : '6',minHeight:'190px'}}>
          <InventoryDaysCard selectedMonth={selectedMonth} selectedQuarter={selectedQuarter} selectedYear={selectedYear} periodMode={periodMode} />
        </ChartCard>
        {periodMode === 'yearly' && (
          <ChartCard title={`Annual Report ${selectedYear}`} style={{ gridColumn: '2 / span 3', gridRow: '2' }}>
            <AnnualReportCard selectedYear={selectedYear} />
          </ChartCard>
        )}
      </div>
    </div>
  );
}
