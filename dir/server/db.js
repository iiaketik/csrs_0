const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "archive.db");

let db;
let persistTimer;

function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
  }, 40);
}

function run(sql, params = []) {
  db.run(sql, params);
  persist();
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  return all(sql, params)[0] || null;
}

const RARITIES = [
  { id: 1, key: "found", label: "FOUND", weight: 45 },
  { id: 2, key: "archive", label: "ARCHIVE", weight: 28 },
  { id: 3, key: "vault", label: "VAULT", weight: 15 },
  { id: 4, key: "atelier", label: "ATELIER", weight: 9 },
  { id: 5, key: "relic", label: "RELIC", weight: 3 }
];

async function initDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER UNIQUE NOT NULL,
      username TEXT,
      first_name TEXT,
      balance INTEGER NOT NULL DEFAULT 0,
      last_free_pull_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      rarity INTEGER NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
      image_path TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      locked INTEGER NOT NULL DEFAULT 0,
      obtained_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      inventory_id INTEGER NOT NULL,
      price INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auctions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      inventory_id INTEGER NOT NULL,
      start_price INTEGER NOT NULL,
      current_bid INTEGER NOT NULL,
      current_bidder_id INTEGER,
      ends_at INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user INTEGER NOT NULL,
      to_user INTEGER NOT NULL,
      from_inv INTEGER NOT NULL,
      to_inv INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS collages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      background_path TEXT,
      music_path TEXT,
      published INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS collage_layers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collage_id INTEGER NOT NULL,
      inventory_id INTEGER NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      scale REAL NOT NULL,
      rotation REAL NOT NULL,
      z INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS collage_likes (
      collage_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (collage_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS favorites (
      user_id INTEGER NOT NULL,
      collage_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, collage_id)
    );
    CREATE TABLE IF NOT EXISTS pulls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      paid INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  persist();
  return { db, run, all, get, persist, RARITIES };
}

module.exports = { initDb, RARITIES };
