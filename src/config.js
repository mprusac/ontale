// Konfiguracija iz okoline (.env se učitava bez vanjskih paketa).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ROOT = path.resolve(import.meta.dirname, '..');

function loadDotEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
loadDotEnv();

const env = process.env;
const production = env.NODE_ENV === 'production';
const dataDir = path.resolve(ROOT, env.DATA_DIR || 'data');

if (production && !env.SECRET) {
  throw new Error('U produkciji je obavezna varijabla SECRET (nasumičan niz od barem 32 znaka).');
}

export const config = {
  production,
  port: Number(env.PORT || 3000),
  host: env.HOST || '0.0.0.0',
  baseUrl: (env.BASE_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/$/, ''),
  dataDir,
  dbPath: env.DB_PATH ? path.resolve(ROOT, env.DB_PATH) : path.join(dataDir, 'ontale.db'),
  secret: env.SECRET || crypto.randomBytes(32).toString('hex'),
  trustProxy: env.TRUST_PROXY === '1',
  adminEmails: (env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  google: {
    clientId: env.GOOGLE_CLIENT_ID || '',
    clientSecret: env.GOOGLE_CLIENT_SECRET || '',
  },
  rateLimitDisabled: env.RATE_LIMIT === 'off',
  // E-mail (podsjetnici, sažeci poruka). Bez SMTP_HOST i EMAIL_FROM e-mail se ne šalje — obavijesti u aplikaciji rade i dalje.
  smtp: {
    host: env.SMTP_HOST || '', port: Number(env.SMTP_PORT || 587), user: env.SMTP_USER || '', pass: env.SMTP_PASS || '', from: env.EMAIL_FROM || '',
    secure: env.SMTP_SECURE === undefined || env.SMTP_SECURE === '' ? null : env.SMTP_SECURE === '1', allowInsecureAuth: env.SMTP_ALLOW_INSECURE_AUTH === '1',
  },
  jobsDisabled: env.JOBS === 'off',
  extraCspHosts: env.EXTRA_CSP_HOSTS || '',
};
