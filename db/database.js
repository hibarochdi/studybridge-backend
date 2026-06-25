// ════════════════════════════════════════════════
//  DATABASE — SQLite via better-sqlite3
//  All tables: users, leads, contacts,
//              applications, notes, email_logs
// ════════════════════════════════════════════════
const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');
const path     = require('path');
 
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'studybridge.db');
let db;
 
function getDB() {
  if (!db) {
    db = new Database(DB_PATH, { verbose: process.env.NODE_ENV === 'development' ? console.log : null });
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}
 
async function initDB() {
  const database = getDB();
  console.log('📦 Initializing database...');
 
  // ── ADMIN USERS ──────────────────────────────
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      email       TEXT    NOT NULL UNIQUE,
      password    TEXT    NOT NULL,
      role        TEXT    NOT NULL DEFAULT 'admin',
      created_at  TEXT    DEFAULT (datetime('now')),
      last_login  TEXT
    );
  `);
 
  // ── LEADS (quick contact from site) ──────────
  database.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      email        TEXT,
      phone        TEXT,
      country      TEXT,
      destination  TEXT,
      budget       TEXT,
      message      TEXT,
      source       TEXT    DEFAULT 'website',
      status       TEXT    DEFAULT 'new',
      assigned_to  TEXT,
      created_at   TEXT    DEFAULT (datetime('now')),
      updated_at   TEXT    DEFAULT (datetime('now'))
    );
  `);
 
  // ── FULL APPLICATIONS ─────────────────────────
  database.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id         INTEGER REFERENCES leads(id),
      name            TEXT    NOT NULL,
      email           TEXT    NOT NULL,
      phone           TEXT,
      nationality     TEXT,
      date_of_birth   TEXT,
      destination     TEXT    NOT NULL,
      field_of_study  TEXT,
      level           TEXT,
      target_year     TEXT,
      budget          TEXT,
      scholarship     INTEGER DEFAULT 0,
      pack_type       TEXT    DEFAULT 'basic',
      documents       TEXT,
      notes           TEXT,
      status          TEXT    DEFAULT 'pending',
      stage           TEXT    DEFAULT 'initial_contact',
      priority        TEXT    DEFAULT 'normal',
      created_at      TEXT    DEFAULT (datetime('now')),
      updated_at      TEXT    DEFAULT (datetime('now'))
    );
  `);
 
  // ── NOTES on leads/applications ───────────────
  database.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type    TEXT    NOT NULL,
      entity_id      INTEGER NOT NULL,
      content        TEXT    NOT NULL,
      author         TEXT    DEFAULT 'Admin',
      created_at     TEXT    DEFAULT (datetime('now'))
    );
  `);
 
  // ── EMAIL LOG ─────────────────────────────────
  database.exec(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      to_email    TEXT    NOT NULL,
      subject     TEXT    NOT NULL,
      body        TEXT,
      status      TEXT    DEFAULT 'sent',
      entity_type TEXT,
      entity_id   INTEGER,
      sent_at     TEXT    DEFAULT (datetime('now'))
    );
  `);
 
  // ── NEWSLETTER SUBSCRIBERS ───────────────────
  database.exec(`
    CREATE TABLE IF NOT EXISTS subscribers (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      email        TEXT    NOT NULL UNIQUE,
      name         TEXT,
      destination  TEXT,
      subscribed   INTEGER DEFAULT 1,
      created_at   TEXT    DEFAULT (datetime('now'))
    );
  `);
 
  // ── DESTINATIONS CONFIG ───────────────────────
  database.exec(`
    CREATE TABLE IF NOT EXISTS destinations (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      code         TEXT    NOT NULL UNIQUE,
      name         TEXT    NOT NULL,
      flag         TEXT,
      cost_min     INTEGER,
      cost_max     INTEGER,
      currency     TEXT    DEFAULT 'EUR',
      language     TEXT,
      scholarship  TEXT,
      visa_level   TEXT,
      programs     TEXT,
      advantages   TEXT,
      active       INTEGER DEFAULT 1
    );
  `);
 
  // ── Seed admin user ───────────────────────────
  const adminExists = database.prepare('SELECT id FROM users WHERE email = ?').get('admin@studybridgenetwork.com');
  if (!adminExists) {
    const hash = bcrypt.hashSync('Admin@2025!', 10);
    database.prepare(`
      INSERT INTO users (name, email, password, role)
      VALUES (?, ?, ?, ?)
    `).run('Admin', 'admin@studybridgenetwork.com', hash, 'superadmin');
    console.log('✅ Default admin created: admin@studybridgenetwork.com / Admin@2025!');
  }
 
  // ── Seed destinations ─────────────────────────
  const destExists = database.prepare('SELECT id FROM destinations LIMIT 1').get();
  if (!destExists) {
    const destinations = [
      { code:'FR', name:'France',      flag:'🇫🇷', cost_min:6000,  cost_max:12000, language:'French/English', scholarship:'Eiffel Excellence, Campus France',       visa_level:'moderate', programs:'Business,Law,Arts,Engineering' },
      { code:'ES', name:'Spain',       flag:'🇪🇸', cost_min:3000,  cost_max:8000,  language:'Spanish/English',scholarship:'Erasmus+, MAEC-AECID',                   visa_level:'easy',     programs:'Tourism,Business,Architecture' },
      { code:'DE', name:'Germany',     flag:'🇩🇪', cost_min:0,     cost_max:3000,  language:'German/English', scholarship:'DAAD, Deutschlandstipendium',             visa_level:'moderate', programs:'Engineering,Sciences,Medicine' },
      { code:'TR', name:'Turkey',      flag:'🇹🇷', cost_min:1500,  cost_max:5000,  language:'Turkish/English',scholarship:'Türkiye Burslari (Full)',                 visa_level:'easy',     programs:'Medicine,Engineering,Business' },
      { code:'CY', name:'Cyprus',      flag:'🇨🇾', cost_min:4000,  cost_max:9000,  language:'English',        scholarship:'University merit scholarships',           visa_level:'easy',     programs:'Business,Law,Hotel Management' },
      { code:'CN', name:'China',       flag:'🇨🇳', cost_min:2000,  cost_max:6000,  language:'Chinese/English',scholarship:'CSC (Fully Funded)',                     visa_level:'easy',     programs:'Medicine,Engineering,Business' },
      { code:'KR', name:'South Korea', flag:'🇰🇷', cost_min:3000,  cost_max:8000,  language:'Korean/English', scholarship:'GKS (Fully Funded)',                     visa_level:'easy',     programs:'Technology,Design,Business' },
      { code:'RU', name:'Russia',      flag:'🇷🇺', cost_min:1500,  cost_max:4000,  language:'Russian/English',scholarship:'Russian Government Quotas',              visa_level:'easy',     programs:'Medicine,Engineering,Sciences' },
      { code:'MA', name:'Morocco',     flag:'🇲🇦', cost_min:800,   cost_max:4000,  language:'Arabic/French',  scholarship:'Moroccan Government Grants',             visa_level:'very_easy',programs:'Medicine,Engineering,Business' },
    ];
    const insert = database.prepare(`
      INSERT INTO destinations (code,name,flag,cost_min,cost_max,language,scholarship,visa_level,programs)
      VALUES (@code,@name,@flag,@cost_min,@cost_max,@language,@scholarship,@visa_level,@programs)
    `);
    const insertMany = database.transaction((rows) => rows.forEach(r => insert.run(r)));
    insertMany(destinations);
    console.log('✅ Destinations seeded');
  }
 
  console.log('✅ Database ready at', DB_PATH);
  return database;
}
 
module.exports = { getDB, initDB };
