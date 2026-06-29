const sqlite3 = require('sqlite3').verbose();
const bcrypt  = require('bcryptjs');
const path    = require('path');
const fs      = require('fs');
 
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'studybridge.db');
 
// Ensure db directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
 
let db;
 
function getDB() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) console.error('DB connection error:', err);
    });
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');
  }
  return db;
}
 
// Helper: run a query (INSERT, UPDATE, DELETE)
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDB().run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastInsertRowid: this.lastID, changes: this.changes });
    });
  });
}
 
// Helper: get one row
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDB().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}
 
// Helper: get all rows
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDB().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}
 
// Helper: exec (no return)
function exec(sql) {
  return new Promise((resolve, reject) => {
    getDB().exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
 
async function initDB() {
  console.log('📦 Initializing database...');
 
  await exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT
    );
    CREATE TABLE IF NOT EXISTS leads (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      email       TEXT,
      phone       TEXT,
      country     TEXT,
      destination TEXT,
      budget      TEXT,
      message     TEXT,
      source      TEXT DEFAULT 'website',
      status      TEXT DEFAULT 'new',
      assigned_to TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS applications (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id        INTEGER,
      name           TEXT NOT NULL,
      email          TEXT NOT NULL,
      phone          TEXT,
      nationality    TEXT,
      date_of_birth  TEXT,
      destination    TEXT NOT NULL,
      field_of_study TEXT,
      level          TEXT,
      target_year    TEXT,
      budget         TEXT,
      scholarship    INTEGER DEFAULT 0,
      pack_type      TEXT DEFAULT 'basic',
      documents      TEXT,
      notes          TEXT,
      status         TEXT DEFAULT 'pending',
      stage          TEXT DEFAULT 'initial_contact',
      priority       TEXT DEFAULT 'normal',
      created_at     TEXT DEFAULT (datetime('now')),
      updated_at     TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS notes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id   INTEGER NOT NULL,
      content     TEXT NOT NULL,
      author      TEXT DEFAULT 'Admin',
      created_at  TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS email_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      to_email    TEXT NOT NULL,
      subject     TEXT NOT NULL,
      body        TEXT,
      status      TEXT DEFAULT 'sent',
      entity_type TEXT,
      entity_id   INTEGER,
      sent_at     TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS subscribers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      email       TEXT NOT NULL UNIQUE,
      name        TEXT,
      destination TEXT,
      subscribed  INTEGER DEFAULT 1,
      created_at  TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS destinations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      code       TEXT NOT NULL UNIQUE,
      name       TEXT NOT NULL,
      flag       TEXT,
      cost_min   INTEGER,
      cost_max   INTEGER,
      currency   TEXT DEFAULT 'EUR',
      language   TEXT,
      scholarship TEXT,
      visa_level  TEXT,
      programs    TEXT,
      advantages  TEXT,
      active      INTEGER DEFAULT 1
    );
  `);
 
  // Seed admin
  const adminExists = await get('SELECT id FROM users WHERE email = ?', ['admin@studybridgenetwork.com']);
  if (!adminExists) {
    const hash = bcrypt.hashSync('Admin@2025!', 10);
    await run('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      ['Admin', 'admin@studybridgenetwork.com', hash, 'superadmin']);
    console.log('✅ Admin created: admin@studybridgenetwork.com / Admin@2025!');
  }
 
  // Seed destinations
  const destExists = await get('SELECT id FROM destinations LIMIT 1');
  if (!destExists) {
    const dests = [
      ['FR','France','🇫🇷',6000,12000,'French/English','Eiffel Excellence, Campus France','moderate','Business,Law,Arts,Engineering'],
      ['ES','Spain','🇪🇸',3000,8000,'Spanish/English','Erasmus+, MAEC-AECID','easy','Tourism,Business,Architecture'],
      ['DE','Germany','🇩🇪',0,3000,'German/English','DAAD, Deutschlandstipendium','moderate','Engineering,Sciences,Medicine'],
      ['TR','Turkey','🇹🇷',1500,5000,'Turkish/English','Türkiye Burslari (Full)','easy','Medicine,Engineering,Business'],
      ['CY','Cyprus','🇨🇾',4000,9000,'English','University merit scholarships','easy','Business,Law,Hotel Management'],
      ['CN','China','🇨🇳',2000,6000,'Chinese/English','CSC (Fully Funded)','easy','Medicine,Engineering,Business'],
      ['KR','South Korea','🇰🇷',3000,8000,'Korean/English','GKS (Fully Funded)','easy','Technology,Design,Business'],
      ['RU','Russia','🇷🇺',1500,4000,'Russian/English','Russian Government Quotas','easy','Medicine,Engineering,Sciences'],
      ['MA','Morocco','🇲🇦',800,4000,'Arabic/French','Moroccan Government Grants','very_easy','Medicine,Engineering,Business'],
    ];
    for (const d of dests) {
      await run(`INSERT OR IGNORE INTO destinations (code,name,flag,cost_min,cost_max,language,scholarship,visa_level,programs)
                 VALUES (?,?,?,?,?,?,?,?,?)`, d);
    }
    console.log('✅ Destinations seeded');
  }
 
  console.log('✅ Database ready at', DB_PATH);
}
 
module.exports = { getDB, initDB, run, get, all };