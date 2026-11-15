// Čista logika bodovanja: prepoznavanje odgovora, rijetkost, razine prijevoza, procjene.
// Nema pristupa bazi — sve se može jedinično testirati.
import { normalize, editDistance } from './util.js';

// ====================================================================================
// 1. PREPOZNAVANJE OTVORENIH ODGOVORA
// ====================================================================================

/**
 * Gradi indeks za jedno pitanje.
 * answers: [{id, canonical, norm, aliases: [string]}], kind: 'person' | 'team' | 'country' | 'other'
 *
 * Razina 1 (strogi ključevi): kanonski naziv, aliasi, isti tokeni u drugom redoslijedu.
 * Razina 2 (izvedeni ključevi): za osobe prezime i završni dio imena ("Safin", "van Nistelrooy").
 * Ključ koji vodi na više različitih odgovora je DVOSMISLEN — igrač mora precizirati.
 */
export function buildIndex(answers, kind = 'other') {
  const strict = new Map(), derived = new Map();
  const add = (map, key, id) => {
    if (!key) return;
    let set = map.get(key);
    if (!set) map.set(key, set = new Set());
    set.add(id);
  };
  for (const a of answers) {
    const keys = [a.norm || normalize(a.canonical), ...(a.aliases || []).map(normalize)];
    for (const k of keys) {
      add(strict, k, a.id);
      const tokens = k.split(' ');
      if (tokens.length > 1) add(strict, [...tokens].sort().join(' '), a.id);
    }
    if (kind === 'person') {
      // izvedeni ključevi iz kanonskog imena i iz višerječnih aliasa (npr. drugi način pisanja prezimena)
      for (const k of keys) {
        let tokens = k.split(' ');
        // "Roy Jones Jr." se priznaje i kao "Roy Jones" odnosno "Jones"
        if (tokens.length > 2 && ['jr', 'sr', 'ii', 'iii'].includes(tokens[tokens.length - 1])) {
          tokens = tokens.slice(0, -1);
          add(strict, tokens.join(' '), a.id);
        }
        if (tokens.length < 2) continue;
        for (let i = 1; i < tokens.length; i++) {
          const suffix = tokens.slice(i).join(' ');
          if (suffix.length >= 3) add(derived, suffix, a.id);
        }
        // inicijal + prezime: "M. Safin" → "m safin"
        add(derived, tokens[0][0] + ' ' + tokens.slice(1).join(' '), a.id);
      }
    }
  }
  return { strict, derived, kind };
}

function fuzzyLimit(len) {
  if (len < 5) return 0;
  if (len <= 8) return 1;
  if (len <= 14) return 2;
  return 3;
}
const digitsOf = (s) => s.replace(/\D+/g, ' ').trim();

/**
 * Vraća {status: 'match', answerId, via} | {status: 'ambiguous', count} | {status: 'none'}.
 * Fuzzy podudaranje prihvaća se samo ako je JEDAN odgovor najbliži i unutar strogog praga
 * (prag ovisi o kraćem od dvaju nizova, znamenke se moraju potpuno poklapati) — tako
 * "Austrija"/"Australija" ili "Slovenija"/"Slovačka" nikad ne prelaze jedna u drugu.
 */
export function matchOpen(index, input) {
  const norm = normalize(input);
  if (!norm) return { status: 'none', norm };
  const sorted = norm.split(' ').sort().join(' ');
  for (const [map, via] of [[index.strict, 'tocno'], [index.derived, 'prezime']]) {
    const hit = map.get(norm) || (via === 'tocno' ? map.get(sorted) : null);
    if (hit) {
      if (hit.size === 1) return { status: 'match', answerId: [...hit][0], via, norm };
      return { status: 'ambiguous', count: hit.size, norm };
    }
  }
  // Fuzzy
  const best = new Map(); // answerId -> min distance
  const scan = (map) => {
    for (const [key, ids] of map) {
      const limit = fuzzyLimit(Math.min(key.length, norm.length));
      if (!limit) continue;
      if (digitsOf(key) !== digitsOf(norm)) continue;
      const d = editDistance(key, norm, limit);
      if (d > limit) continue;
      for (const id of ids) if (!best.has(id) || best.get(id) > d) best.set(id, d);
    }
  };
  scan(index.strict);
  scan(index.derived);
  if (!best.size) return { status: 'none', norm };
  const min = Math.min(...best.values());
  const winners = [...best].filter(([, d]) => d === min);
  if (winners.length === 1) return { status: 'match', answerId: winners[0][0], via: 'slicno', distance: min, norm };
  return { status: 'ambiguous', count: winners.length, norm };
}

// ====================================================================================
// 2. RIJETKOST
// ====================================================================================
/**
 * Za svaki prihvaćeni odgovor računa rijetkost 0–100.
 *
 *   p0(a) = početna procjena udjela  = prior(a) / Σ prior
 *   s(a)  = (K·p0(a) + n(a)) / (K + N)        ← Bayesovo stapanje procjene i stvarnih igrača
 *           n(a) = broj RAZLIČITIH igrača koji su dali odgovor, N = svi valjani odgovori,
 *           K = "virtualni igrači" početne procjene (podesivo po pitanju)
 *   P(a)  = udio igrača koji su dali popularniji odgovor
 *           + pola udjela ostalih, jednako popularnih odgovora
 *           (maseni percentil: 0 = najčešći, 1 = rijetkost na samom repu)
 *   B(a)  = 1 − min(1, s(a)·M/2), M = 1/Σ s² (efektivni broj odgovora = stvarna širina pitanja)
 *   rijetkost = 100 · (wP·P + wB·B)
 *
 * Mali broj igrača: dok je N ≪ K, vrijedi praktički početna procjena, pa prvi ili slučajni
 * odgovori ne mogu poremetiti bodovanje. Ručno upisana rijetkost ima prednost.
 */
export function computeRarity(answers, freq, opts = {}) {
  const K = Math.max(0, opts.priorStrength ?? 200);
  const wP = opts.wPercentile ?? 0.7, wB = opts.wBreadth ?? 0.3;
  const priorSum = answers.reduce((t, a) => t + a.prior_popularity, 0) || 1;
  let N = 0;
  for (const a of answers) N += freq.get(a.id) || 0;
  const denom = K + N;
  const rows = answers.map((a) => {
    const p0 = a.prior_popularity / priorSum;
    const n = freq.get(a.id) || 0;
    return { id: a.id, p0, n, share: denom > 0 ? (K * p0 + n) / denom : p0, manual: a.manual_rarity };
  });
  const sumSq = rows.reduce((t, r) => t + r.share * r.share, 0) || 1;
  const M = 1 / sumSq;
  const sorted = [...rows].sort((x, y) => y.share - x.share);
  const EPS = 1e-12;
  let above = 0;
  for (let i = 0; i < sorted.length;) {
    let j = i, tie = 0;
    while (j < sorted.length && Math.abs(sorted[j].share - sorted[i].share) < EPS) { tie += sorted[j].share; j++; }
    for (let k = i; k < j; k++) sorted[k].P = above + (tie - sorted[k].share) / 2;
    above += tie;
    i = j;
  }
  const out = new Map();
  for (const r of rows) {
    const B = 1 - Math.min(1, (r.share * M) / 2);
    const computed = 100 * (wP * r.P + wB * B);
    const rarity = r.manual != null ? r.manual : Math.max(0, Math.min(100, computed));
    out.set(r.id, { rarity, computed, share: r.share, prior: r.p0, players: r.n, percentile: r.P });
  }
  out.total = N;
  out.effective = M;
  return out;
}

/** Najviša razina prijevoza čiji je prag rijetkosti zadovoljen (točan odgovor uvijek dobiva barem najnižu). */
export function levelForRarity(rarity, transports) {
  const sorted = [...transports].sort((a, b) => a.level - b.level);
  let pick = sorted[0];
  for (const t of sorted) if (rarity >= t.min_rarity) pick = t;
  return pick;
}

// ====================================================================================
// 3. BROJČANE PROCJENE
// ====================================================================================
export const DEFAULT_NUMERIC_THRESHOLDS = [
  { max_pct: 2.5, level: 6 }, { max_pct: 6, level: 5 }, { max_pct: 12, level: 4 },
  { max_pct: 22, level: 3 }, { max_pct: 40, level: 2 }, { max_pct: 70, level: 1 },
];

/**
 * Blizina procjene → razina. Unutar tolerancije = najviša razina; dalje po pragovima postotne pogreške.
 * Vraća {absError, errorPct, level, accuracy}. Razina 0 = predaleko (0 km).
 */
export function scoreNumeric(target, guess, thresholds = DEFAULT_NUMERIC_THRESHOLDS, maxLevel = 7) {
  const absError = Math.abs(guess - target.value);
  const base = Math.abs(target.value) || 1;
  const errorPct = (absError / base) * 100;
  let level = 0;
  if (errorPct <= (target.tolerance_pct ?? 1) + 1e-9) level = maxLevel;
  else {
    for (const t of [...thresholds].sort((a, b) => a.max_pct - b.max_pct)) {
      if (errorPct <= t.max_pct + 1e-9) { level = Math.min(t.level, maxLevel); break; }
    }
  }
  return { absError, errorPct, level, accuracy: Math.max(0, 100 - errorPct) };
}

/**
 * Najbliža procjena dana. guesses: [{id, absError, created_at}].
 * tieRule 'dijele' → svi s istom najmanjom pogreškom; 'raniji' → samo najranije poslana.
 */
export function closestGuesses(guesses, tieRule = 'dijele') {
  if (!guesses.length) return [];
  const min = Math.min(...guesses.map((g) => g.absError));
  const tied = guesses.filter((g) => Math.abs(g.absError - min) < 1e-9);
  if (tieRule === 'raniji') {
    tied.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id - b.id));
    return [tied[0].id];
  }
  return tied.map((g) => g.id);
}

// ====================================================================================
// 4. NIZ DANA
// ====================================================================================
/** dates: uzlazno sortirani jedinstveni datumi odigranih službenih dana. */
export function computeStreak(dates, today) {
  if (!dates.length) return { current: 0, best: 0, days: 0, last: null };
  const dayNum = (s) => Math.round(Date.parse(s + 'T00:00:00Z') / 86400000);
  let best = 1, run = 1;
  for (let i = 1; i < dates.length; i++) {
    run = dayNum(dates[i]) - dayNum(dates[i - 1]) === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  const last = dates[dates.length - 1];
  const gap = dayNum(today) - dayNum(last);
  return { current: gap <= 1 ? run : 0, best, days: dates.length, last };
}
