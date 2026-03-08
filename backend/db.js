const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, 'dashboard_pnl.sqlite');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS kpi_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric TEXT NOT NULL,
      month TEXT,
      year TEXT,
      value TEXT,
      note_extra TEXT,
      source TEXT DEFAULT 'google-sheet',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(metric, month, year)
    )
  `);

  await run('CREATE INDEX IF NOT EXISTS idx_kpi_year_month ON kpi_history(year, month)');
  await run('CREATE INDEX IF NOT EXISTS idx_kpi_metric ON kpi_history(metric)');
}

module.exports = {
  db,
  run,
  all,
  initDb,
};
