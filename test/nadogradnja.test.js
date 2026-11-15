// Nadogradnja stvarne baze prve verzije (test/fixtures/v1.db, stvorena kodom v1): migracija + nadogradnja podataka.
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';
import { upgradeData, DATA_VERSION } from '../src/upgrade.js';
import * as seedTools from '../seed/seed.js';
import { Client, DAY1 } from './helpers.js';

const FIXTURE = path.join(import.meta.dirname, 'fixtures', 'v1.db');
const src = [['Test', 'https://example.org']];
// Sadržaj "nove verzije" za ovaj test: dani 1–3 dobivaju 9. i 10. pitanje, dan 4 je potpuno nov.
function content(db) {
  const existing = db.all(`SELECT q.text, dq.position FROM daily_challenge_questions dq JOIN questions q ON q.id = dq.question_id
                           JOIN daily_challenges c ON c.id = dq.challenge_id WHERE c.date = ? ORDER BY dq.position`, DAY1);
  const out = [];
  for (let dan = 1; dan <= 3; dan++) {
    for (const e of existing) out.push({ dan, poz: e.position, cat: 'tenis', text: e.text, odgovori: { A: ['Nebitno'] }, izvori: src });   // već u bazi → ne dira se
    out.push({ dan, poz: 9, cat: 'kosarka', kind: 'team', text: `Deveto pitanje, dan ${dan}?`, odgovori: { A: ['Cibona', 'Zadar'], C: ['Split|Jugoplastika'] }, izvori: src });
    out.push({ dan, poz: 10, cat: 'procjene', type: 'numeric', text: `Deseta procjena, dan ${dan}?`, target: { value: 100, unit: 'kom', ref_date: '2026-01-01', tolerance_pct: 1, scoring_mode: 'pragovi', tie_rule: 'dijele', is_estimate: 0 }, izvori: src });
  }
  for (let poz = 1; poz <= 10; poz++) out.push({ dan: 4, poz, cat: 'nogomet', text: `Novi dan, pitanje ${poz}?`, odgovori: { A: ['Alfa', 'Beta'] }, izvori: src });
  return out;
}

test('nadogradnja baze v1: kopija prije izmjena, podaci igrača netaknuti, dani dopunjeni na 10 pitanja, nove rute', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ontale-up-'));
  const file = path.join(dir, 'ontale.db');
  fs.copyFileSync(FIXTURE, file);
  const before = (() => {                         // stanje prije: čita se bez migracije
    const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
    const raw = new DatabaseSync(file, { readOnly: true });
    const snap = {
      users: raw.prepare('SELECT id, email, is_guest, password_hash FROM users ORDER BY id').all(),
      profiles: raw.prepare('SELECT user_id, nickname FROM profiles ORDER BY user_id').all(),
      sessions: raw.prepare('SELECT id, user_id, official, total_km, next_position, question_count, finished_at, reached_goal FROM game_sessions ORDER BY id').all(),
      answers: raw.prepare('SELECT id, session_id, position, raw, answer_id, is_correct, km, level FROM player_answers ORDER BY id').all(),
      freq: raw.prepare('SELECT * FROM answer_frequency ORDER BY question_id, answer_id').all(),
      leagues: raw.prepare('SELECT id, name, code FROM leagues').all(),
      reports: raw.prepare('SELECT question_id, raw, norm, status FROM answer_reports').all(),
      questions: raw.prepare('SELECT COUNT(*) AS n FROM questions').get().n,
      migrations: raw.prepare('SELECT name FROM schema_migrations').all().map((r) => r.name),
    };
    raw.close();
    return snap;
  })();
  assert.deepEqual(before.migrations, ['001_init.sql']);
  const clock = { now: new Date(`${DAY1}T12:00:00+01:00`) };
  const db = openDb(file);                                         // primjenjuje migraciju 002
  const app = createApp({ db, dataDir: dir, dbPath: file, rateLimitDisabled: true, adminEmails: ['admin@ontale.eu'], production: false, now: () => clock.now });
  try {
    const { ctx } = app;
    // 1) kopija prije migracije postoji i sadrži staru shemu
    const backups = fs.readdirSync(path.join(dir, 'backups'));
    assert.equal(backups.filter((f) => f.includes('prije-002')).length, 1);
    // 2) migracija: stari netočni odgovori postali su pokušaji, statusi su popunjeni
    assert.deepEqual(db.all('SELECT name FROM schema_migrations ORDER BY name').map((r) => r.name).slice(0, 2), ['001_init.sql', '002_tajmeri_rute.sql']);
    assert.equal(db.get("SELECT COUNT(*) AS n FROM player_answers WHERE status = 'netocno' AND is_correct = 1").n, 0);
    assert.ok(db.get("SELECT COUNT(*) AS n FROM answer_attempts WHERE raw = 'Delta'").n === 1);

    const up = upgradeData(ctx, { questions: content(db), seedTools });
    assert.equal(up.ran, true);
    assert.ok(fs.existsSync(up.backup), 'kopija prije nadogradnje podataka');
    assert.equal(fs.readdirSync(path.join(dir, 'backups')).length, 2);
    assert.equal(upgradeData(ctx, { questions: content(db), seedTools }).ran, false, 'nadogradnja se izvodi samo jednom');
    assert.equal(ctx.settings.get('data_version'), DATA_VERSION);

    // 3) podaci igrača su isti kao prije
    assert.deepEqual(db.all('SELECT id, email, is_guest, password_hash FROM users ORDER BY id'), before.users);
    assert.deepEqual(db.all('SELECT user_id, nickname FROM profiles ORDER BY user_id'), before.profiles);
    assert.deepEqual(db.all('SELECT id, session_id, position, raw, answer_id, is_correct, km, level FROM player_answers ORDER BY id'), before.answers);
    assert.deepEqual(db.all('SELECT * FROM answer_frequency ORDER BY question_id, answer_id'), before.freq);
    assert.deepEqual(db.all('SELECT id, name, code FROM leagues'), before.leagues);
    assert.deepEqual(db.all('SELECT question_id, raw, norm, status FROM answer_reports'), before.reports);
    const after = db.all('SELECT id, user_id, official, total_km, next_position, question_count, finished_at, reached_goal FROM game_sessions ORDER BY id');
    for (const [i, s] of before.sessions.entries()) {
      const a = after[i];
      assert.deepEqual({ ...a, question_count: 0 }, { ...s, question_count: 0 });
      assert.equal(a.question_count, s.finished_at ? 8 : 10, 'dovršene partije ostaju na 8 pitanja, nedovršena se produljuje na 10');
    }
    // 4) administratorske postavke ostaju, zadane se ažuriraju
    assert.equal(ctx.settings.get('game_name'), 'ONTALE moj'); assert.equal(ctx.settings.get('contact_email'), 'ja@ontale.eu');
    assert.equal(ctx.settings.get('tagline'), '10 sportskih pitanja dnevno.');
    assert.equal(ctx.settings.get('game').questions_per_day, 10); assert.equal(ctx.settings.get('game').answer_seconds, 30);
    assert.match(ctx.settings.get('rules'), /deset novih sportskih pitanja/);
    // 5) sadržaj: ništa obrisano, dani 1–3 imaju 10 pitanja (stara na istim pozicijama), dan 4 je nov
    assert.equal(db.get('SELECT COUNT(*) AS n FROM questions').n, before.questions + 6 + 10);
    for (let d = 0; d < 4; d++) {
      const date = new Date(Date.parse(DAY1) + d * 86400000).toISOString().slice(0, 10);
      const qs = db.all(`SELECT dq.position, q.text FROM daily_challenge_questions dq JOIN questions q ON q.id = dq.question_id JOIN daily_challenges c ON c.id = dq.challenge_id WHERE c.date = ? ORDER BY dq.position`, date);
      assert.deepEqual(qs.map((q) => q.position), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], date);
      if (d < 3) { assert.equal(qs[7].text, 'Koliko je reketa Safin razbio?'); assert.equal(qs[8].text, `Deveto pitanje, dan ${d + 1}?`); }
    }
    // 6) rute: cilj i dalje 1.000 km, nova šira putanja i nastavak
    const hr = ctx.game.routeFor(ctx.game.mapBySlug('hr').id), ba = ctx.game.routeFor(ctx.game.mapBySlug('ba').id);
    assert.equal(hr.points[hr.goal_index].name, 'Dubrovnik'); assert.equal(hr.points[hr.goal_index].km, 1000); assert.ok(hr.end_km >= 2200);
    assert.ok(hr.points.some((p) => p.name === 'Varaždin') && hr.points.some((p) => p.name === 'Kotor'));
    assert.equal(ba.points[ba.goal_index].name, 'Neum'); assert.ok(ba.points.some((p) => p.name === 'Trebinje') && ba.points.at(-1).country === 'hr');

    // 7) igra radi nad nadograđenom bazom: stari igrač vidi svoj rezultat, nedovršena partija se nastavlja do 10. pitanja
    await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    clock.advance = (s) => { clock.now = new Date(clock.now.getTime() + s * 1000); };
    ctx.settings.set('game', { ...ctx.settings.get('game'), prep_seconds: 0 });
    const marin = new Client(base, clock);
    assert.equal((await marin.post('/api/auth/login', { email: 'admin@ontale.eu', password: 'lozinka123' })).status, 200, 'stara lozinka i dalje vrijedi');
    const boot = (await marin.get('/api/bootstrap')).data;
    assert.equal(boot.me.nickname, 'Marin'); assert.equal(boot.me.is_admin, true);
    assert.equal(boot.maps[0].mine.finished, true); assert.equal(boot.maps[0].mine.total_km, 114); assert.equal(boot.maps[0].questions, 10);
    const res = (await marin.get(`/api/game/${boot.maps[0].mine.session_id}/result`)).data;
    assert.equal(res.answers.length, 8); assert.equal(res.session.total_km, 114);
    assert.equal((await marin.get('/api/leaderboard?map=hr')).data.rows.length, 2);
    const ivana = new Client(base, clock);
    await ivana.post('/api/auth/login', { email: 'ivana@test.hr', password: 'lozinka123' });
    const cont = (await ivana.post('/api/game/start', { map: 'ba' })).data;
    assert.equal(cont.session.id, 3); assert.equal(cont.session.next_position, 4); assert.equal(cont.session.question_count, 10);
    assert.equal(cont.session.total_km, 24); assert.equal(cont.question.position, 4);
    const done = await ivana.play('ba', ['', '', '', 'Hrvatska', 'Alfa', 'Alfa', 'Alfa', '1000', 'Cibona', '100']);
    assert.equal(done.data.session.finished, true); assert.equal(done.data.answers.length, 10);
    // prijava iz v1 i dalje se može odobriti, a kilometri se priznaju
    const reports = (await marin.get('/api/admin/reports')).data;
    assert.equal(reports.length, 1); assert.equal(reports[0].raw, 'Delta'); assert.equal(reports[0].given, 1);
    const ok = await marin.post('/api/admin/reports/resolve', { question_id: reports[0].question_id, norm: reports[0].norm, action: 'odobri', canonical: 'Delta' });
    assert.equal(ok.data.recalc.changed, 1);
    assert.ok(db.get('SELECT total_km FROM game_sessions WHERE id = 2').total_km > 1404);
  } finally { await app.close(); db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
