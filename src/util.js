import crypto from 'node:crypto';

export const nowIso = () => new Date().toISOString();

// ---------- Vrijeme (Europe/Zagreb) ----------
const fmtCache = new Map();
function partsIn(tz, date) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    fmtCache.set(tz, f);
  }
  const o = {};
  for (const p of f.formatToParts(date)) o[p.type] = p.value;
  return o;
}
const resetMinutes = (reset) => { const [h, m] = String(reset || '00:00').split(':').map(Number); return (h || 0) * 60 + (m || 0); };

/** Datum igre (YYYY-MM-DD): lokalni datum u zoni, pomaknut za vrijeme dnevnog resetiranja. */
export function gameDate(now = new Date(), tz = 'Europe/Zagreb', reset = '00:00') {
  const p = partsIn(tz, new Date(now.getTime() - resetMinutes(reset) * 60000));
  return `${p.year}-${p.month}-${p.day}`;
}
/** Trenutak sljedećeg resetiranja (ISO). */
export function nextReset(now = new Date(), tz = 'Europe/Zagreb', reset = '00:00') {
  const p = partsIn(tz, now);
  const mins = Number(p.hour) * 60 + Number(p.minute);
  let diff = (resetMinutes(reset) - mins + 1440) % 1440;
  if (diff === 0) diff = 1440;
  const t = new Date(now.getTime() + diff * 60000);
  t.setSeconds(0, 0);
  return t.toISOString();
}
export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));

// ---------- Normalizacija odgovora ----------
const CHAR_MAP = { 'đ': 'd', 'ð': 'd', 'ł': 'l', 'ø': 'o', 'æ': 'ae', 'œ': 'oe', 'ß': 'ss', 'ı': 'i', 'þ': 'th' };
// Klupski prefiksi/sufiksi koji ne nose značenje ("FC Barcelona" = "Barcelona").
const CLUB_TOKENS = new Set(['fc', 'cf', 'nk', 'fk', 'hnk', 'gnk', 'hsk', 'rk', 'kk', 'bc', 'afc', 'ssc', 'ac', 'as', 'sc']);

/**
 * Normalizira tekst za usporedbu: mala slova, bez dijakritike, interpunkcije i suvišnih razmaka.
 * "Čilić" → "cilic", "Đoković"/"Djokovic" → "dokovic", "Man. United" → "man united".
 */
export function normalize(input) {
  let s = String(input ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/[đðłøæœßıþ]/g, (c) => CHAR_MAP[c]);
  s = s.replace(/&/g, ' and ').replace(/['’`´]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  s = s.replace(/dj/g, 'd');
  let tokens = s.split(' ').filter(Boolean);
  if (tokens.length > 1) {
    const kept = tokens.filter((t) => !CLUB_TOKENS.has(t));
    if (kept.length) tokens = kept;
  }
  return tokens.join(' ');
}

/** Damerau–Levenshtein (OSA) udaljenost s ranim prekidom iznad `max`. */
export function editDistance(a, b, max = 3) {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  let prev2 = null, prev = new Array(lb + 1), cur = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= lb; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev; prev = cur; cur = new Array(lb + 1);
  }
  return prev[lb];
}

/**
 * Čita brojčanu procjenu u hrvatskom ili engleskom zapisu:
 * "1.055", "1 055", "41,5 mil", "42k", "38,5". Vraća null ako nije broj.
 */
export function parseNumber(input) {
  let s = String(input ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
  if (!s) return null;
  let mult = 1;
  const suffix = s.match(/(mlrd|milijard[aie]?|mil\.?|milijun[aie]?|mio|tis\.?|tisuc[aie]?|tisuć[aie]?|k|m)\s*$/);
  if (suffix) {
    const w = suffix[1];
    mult = /^(mlrd|milijard)/.test(w) ? 1e9 : /^(mil|mio|m$)/.test(w) ? 1e6 : 1e3;
    s = s.slice(0, suffix.index).trim();
  }
  s = s.replace(/[€$%]/g, '').replace(/\s/g, '');
  if (!/^-?[\d.,]+$/.test(s)) return null;
  const dots = (s.match(/\./g) || []).length, commas = (s.match(/,/g) || []).length;
  if (dots && commas) {
    // zadnji separator je decimalni
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (commas) {
    s = commas === 1 && !/,\d{3}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  } else if (dots) {
    if (dots > 1 || /^-?\d{1,3}\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n * mult : null;
}

// ---------- Sigurnost ----------
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}
export function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, saltB64, hashB64] = stored.split('$');
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, actual);
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function leagueCode(len = 6) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}
export const bad = (msg, extra) => new HttpError(400, msg, extra);
export const round1 = (n) => Math.round(n * 10) / 10;

/** Udaljenost dviju točaka na Zemlji u km. */
export function haversine(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
