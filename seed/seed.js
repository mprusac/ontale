// Puni bazu početnim podacima: postavke, karte, prijevoz, kategorije i 10 dnevnih izazova (80 pitanja).
//   node seed/seed.js                    — prvi dan = današnji datum igre (Europe/Zagreb)
//   node seed/seed.js --start=2026-12-01 — zadani početni datum
//   node seed/seed.js --reset            — briše postojeću bazu i puni je iznova
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { config, ROOT } from '../src/config.js';
import { createApp } from '../src/app.js';
import { normalize, addDays, isDate, nowIso } from '../src/util.js';
import { KATEGORIJE, KARTE, PRIJEVOZ, POSTAVKE } from './osnova.js';
import { PRAVILA, PRIVATNOST, UVJETI } from './tekstovi.js';
import { ALIASI } from './aliasi.js';
import { DATA_VERSION } from '../src/upgrade.js';

// Početna procjena popularnosti po razredima: A = svi ga se sjete … F = gotovo nitko.
export const RAZREDI = { A: 100, B: 55, C: 28, D: 13, E: 5, F: 2 };

/** "Kanonski naziv|alias|alias#obrazloženje" → objekt odgovora. Zajednički aliasi dodaju se iz seed/aliasi.js. */
export function parseAnswer(entry, weight) {
  const [head, explanation] = entry.split('#');
  const [canonical, ...aliases] = head.split('|').map((s) => s.trim()).filter(Boolean);
  const shared = ALIASI[canonical] || [];
  return { canonical, aliases: [...aliases, ...shared], explanation: explanation?.trim() || null, prior_popularity: weight };
}

export function expandQuestion(q) {
  const out = {
    category: q.cat, type: q.type || 'open', text: q.text, hint: q.hint || null, answer_kind: q.kind || 'other', difficulty: q.diff || 3,
    prior_strength: q.K ?? null, sport_tag: q.sport || null, verification: q.provjera || null, active: 1,
    sources: (q.izvori || []).map(([title, url, note]) => ({ title, url, note })),
  };
  if (out.type === 'numeric') out.target = q.target;
  else {
    out.answers = [];
    for (const [tier, list] of Object.entries(q.odgovori || {})) {
      if (!RAZREDI[tier]) throw new Error(`Nepoznat razred "${tier}" u pitanju: ${q.text}`);
      for (const entry of list) out.answers.push(parseAnswer(entry, RAZREDI[tier]));
    }
  }
  return out;
}

/** Provjera baze odgovora prije upisa: duplikati unutar pitanja su greška, zajednički aliasi upozorenje. */
export function validateQuestion(q, expanded) {
  const errors = [], warnings = [];
  if (expanded.type === 'numeric') {
    const t = expanded.target || {};
    if (!Number.isFinite(t.value) || !t.unit || !isDate(t.ref_date)) errors.push('procjena bez vrijednosti, jedinice ili datuma');
    if (!expanded.sources.length) errors.push('procjena bez izvora');
    return { errors, warnings };
  }
  const canon = new Map(), keys = new Map();
  for (const a of expanded.answers) {
    const n = normalize(a.canonical);
    if (canon.has(n)) errors.push(`dvostruki odgovor: ${a.canonical}`);
    canon.set(n, a.canonical);
  }
  for (const a of expanded.answers) {
    for (const al of a.aliases) {
      const n = normalize(al);
      if (canon.has(n) && canon.get(n) !== a.canonical) warnings.push(`alias "${al}" (${a.canonical}) jednak je odgovoru ${canon.get(n)}`);
      if (keys.has(n) && keys.get(n) !== a.canonical) warnings.push(`alias "${al}" dijele ${keys.get(n)} i ${a.canonical} (igra će tražiti pojašnjenje)`);
      keys.set(n, a.canonical);
    }
  }
  if (expanded.answers.length < 8) warnings.push(`samo ${expanded.answers.length} odgovora`);
  if (!expanded.sources.length) errors.push('pitanje bez izvora');
  return { errors, warnings };
}

export async function loadQuestions() {
  const dir = path.join(ROOT, 'seed', 'pitanja');
  const all = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js')).sort()) {
    const mod = await import(pathToFileURL(path.join(dir, f)).href);
    all.push(...mod.default);
  }
  return all;
}

/** Zapis karte iz seed/osnova.js → oblik koji prima admin.saveMap. */
export function mapPayload(m, i = 0) {
  return {
    slug: m.slug, name: m.name, flag: m.flag, sort_order: i + 1,
    route: {
      name: m.route, total_km: m.total_km, ext_km: m.ext_km || 0, real_km: m.real_km || null,
      checkpoints: m.points.map(([name, nickname, lat, lng, is_stop, message, x = {}]) => ({
        name, nickname, lat, lng, is_stop, message, country: x.d || m.slug, is_goal: !!x.cilj, label: x.granica ? 'granica' : null,
      })),
    },
  };
}

export function seedBase(ctx) {
  const { db, settings, admin } = ctx;
  // Nova baza dobiva sve odjednom u trenutnoj verziji; postojeću bazu nadograđuje src/upgrade.js pri startu poslužitelja.
  if (!db.get('SELECT 1 AS x FROM maps') && !db.get('SELECT 1 AS x FROM questions')) settings.set('data_version', DATA_VERSION);
  db.tx(() => {
    db.run("INSERT OR IGNORE INTO question_types (id, slug, name) VALUES (1, 'open', 'Otvoreno pitanje'), (2, 'numeric', 'Brojčana procjena')");
    for (const c of KATEGORIJE) db.run('INSERT OR IGNORE INTO question_categories (slug, name, emoji, sort_order) VALUES (?, ?, ?, ?)', c.slug, c.name, c.emoji, c.sort_order);
    for (const [k, v] of Object.entries({ ...POSTAVKE, rules: PRAVILA, privacy: PRIVATNOST, terms: UVJETI })) if (settings.get(k) === undefined) settings.set(k, v);
  });
  if (!db.get('SELECT 1 AS x FROM maps')) {
    KARTE.forEach((m, i) => admin.saveMap(null, null, mapPayload(m, i)));
  }
  if (!db.get('SELECT 1 AS x FROM transport_sets')) {
    for (const s of PRIJEVOZ) {
      const { id } = admin.saveTransportSet(null, null, s);
      if (s.active) admin.activateTransportSet(null, id);
    }
  }
}

export function seedQuestions(ctx, questions, startDate) {
  const { db, admin } = ctx;
  const report = { questions: 0, answers: 0, days: 0, warnings: [], errors: [] };
  const byDay = new Map();
  for (const q of questions) {
    const ex = expandQuestion(q);
    const v = validateQuestion(q, ex);
    for (const w of v.warnings) report.warnings.push(`[dan ${q.dan}/${q.poz}] ${q.text.slice(0, 50)}… — ${w}`);
    for (const e of v.errors) report.errors.push(`[dan ${q.dan}/${q.poz}] ${q.text.slice(0, 50)}… — ${e}`);
    if (v.errors.length) continue;
    const { id } = admin.saveQuestion(null, null, ex);
    report.questions++;
    report.answers += ex.answers?.length || 0;
    if (!byDay.has(q.dan)) byDay.set(q.dan, []);
    byDay.get(q.dan).push({ pos: q.poz, id });
  }
  for (const [day, list] of [...byDay].sort((a, b) => a[0] - b[0])) {
    list.sort((a, b) => a.pos - b.pos);
    const expected = ctx.game.cfg().questions_per_day;
    if (list.length !== expected) report.warnings.push(`[dan ${day}] izazov ima ${list.length} pitanja (zadano: ${expected})`);
    admin.saveChallenge(null, null, { date: addDays(startDate, day - 1), scope: 'sve', title: `Dan ${day}`, active: 1, question_ids: list.map((x) => x.id), allow_size: true });
    report.days++;
  }
  db.run('DELETE FROM admin_audit_logs WHERE admin_id IS NULL');
  db.run('INSERT INTO admin_audit_logs (action, entity, detail, created_at) VALUES (?, ?, ?, ?)', 'seed', 'baza', JSON.stringify({ startDate, ...report, warnings: report.warnings.length, errors: report.errors.length }), nowIso());
  return report;
}

// ---------- Pokretanje iz naredbenog retka ----------
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
  if (args.reset) for (const ext of ['', '-wal', '-shm']) fs.rmSync(config.dbPath + ext, { force: true });
  const app = createApp();
  const { ctx } = app;
  seedBase(ctx);
  const start = typeof args.start === 'string' ? args.start : ctx.game.today();
  if (!isDate(start)) throw new Error('--start mora biti u obliku GGGG-MM-DD');
  if (ctx.db.get('SELECT 1 AS x FROM questions')) {
    console.log('Baza već sadrži pitanja — preskačem (koristi --reset za novi početak).');
  } else {
    const report = seedQuestions(ctx, await loadQuestions(), start);
    if (ctx.settings.get('start_date') === undefined) ctx.settings.set('start_date', start);
    console.log(`Upisano: ${report.questions} pitanja, ${report.answers} odgovora, ${report.days} dnevnih izazova od ${start}.`);
    if (report.warnings.length) console.log(`\nUpozorenja (${report.warnings.length}):\n  ` + report.warnings.join('\n  '));
    if (report.errors.length) { console.error(`\nGREŠKE (${report.errors.length}):\n  ` + report.errors.join('\n  ')); process.exitCode = 1; }
  }
  await app.close();
}
