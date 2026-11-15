// Sigurnosna kopija baze (dosljedna i dok poslužitelj radi):  npm run backup
// Kopije se spremaju u DATA_DIR/backups; zadržava se zadnjih 14.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../src/config.js';

const dir = path.join(config.dataDir, 'backups');
fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
const target = path.join(dir, `ontale-${stamp}.db`);
const db = new DatabaseSync(config.dbPath);
db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
db.close();
const all = fs.readdirSync(dir).filter((f) => /^ontale-.*\.db$/.test(f)).sort();
for (const old of all.slice(0, Math.max(0, all.length - 14))) fs.rmSync(path.join(dir, old));
console.log(`Kopija spremljena: ${target} (${(fs.statSync(target).size / 1024 / 1024).toFixed(1)} MB)`);
