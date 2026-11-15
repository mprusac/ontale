// Tanki sloj nad ugrađenim node:sqlite — pripremljeni upiti, transakcije i migracije.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.js';

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = new DatabaseSync(file);
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');
  const cache = new Map();
  const stmt = (sql) => {
    let s = cache.get(sql);
    if (!s) { s = raw.prepare(sql); cache.set(sql, s); }
    return s;
  };
  let depth = 0;
  const db = {
    raw,
    all: (sql, ...p) => stmt(sql).all(...p),
    get: (sql, ...p) => stmt(sql).get(...p),
    run: (sql, ...p) => {
      const r = stmt(sql).run(...p);
      return { changes: Number(r.changes), id: Number(r.lastInsertRowid) };
    },
    exec: (sql) => raw.exec(sql),
    /** Atomarna transakcija; ugniježđeni pozivi koriste SAVEPOINT. */
    tx(fn) {
      const name = `sp_${depth}`;
      raw.exec(depth === 0 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${name}`);
      depth++;
      try {
        const out = fn();
        depth--;
        raw.exec(depth === 0 ? 'COMMIT' : `RELEASE ${name}`);
        return out;
      } catch (e) {
        depth--;
        raw.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${name}; RELEASE ${name}`);
        throw e;
      }
    },
    close: () => raw.close(),
  };
  migrate(db, file);
  return db;
}

/**
 * Primjenjuje migracije koje još nisu primijenjene (redom po nazivu, svaka u svojoj transakciji).
 * Ako baza već ima podatke, PRIJE prve nove migracije sprema se njezina potpuna kopija u `backups/` uz bazu.
 */
export function migrate(db, file) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const dir = path.join(ROOT, 'migrations');
  const done = new Set(db.all('SELECT name FROM schema_migrations').map(r => r.name));
  const pending = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort().filter(f => !done.has(f));
  if (!pending.length) return;
  if (done.size && file && file !== ':memory:') {
    const target = backupDb(db, file, 'prije-' + pending[0].replace(/\.sql$/, ''));
    console.log(`Nadogradnja baze: kopija prije migracije spremljena u ${target}`);
  }
  for (const f of pending) {
    db.tx(() => {
      db.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
      db.run('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)', f, new Date().toISOString());
    });
  }
}

/** Dosljedna kopija cijele baze (VACUUM INTO) u mapu `backups` pokraj datoteke baze. Vraća putanju kopije. */
export function backupDb(db, file, label = 'kopija') {
  const dir = path.join(path.dirname(file), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  let target = path.join(dir, `ontale-${label}-${stamp}.db`);
  for (let i = 2; fs.existsSync(target); i++) target = path.join(dir, `ontale-${label}-${stamp}-${i}.db`);
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  return target;
}

/** Postavke: JSON vrijednosti u tablici settings, s predmemorijom. */
export function makeSettings(db) {
  let cache = null;
  const load = () => {
    cache = {};
    for (const r of db.all('SELECT key, value FROM settings')) {
      try { cache[r.key] = JSON.parse(r.value); } catch { cache[r.key] = r.value; }
    }
  };
  return {
    get(key, fallback) { if (!cache) load(); return cache[key] !== undefined ? cache[key] : fallback; },
    all() { if (!cache) load(); return { ...cache }; },
    set(key, value) {
      db.run(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        key, JSON.stringify(value), new Date().toISOString());
      cache = null;
    },
    invalidate() { cache = null; },
  };
}
