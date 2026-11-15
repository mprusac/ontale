// Pomoćne funkcije za testove: aplikacija nad privremenom bazom + mali skup pitanja.
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';
import { seedBase } from '../seed/seed.js';
import { addDays } from '../src/util.js';

export const DAY1 = '2026-11-13';

/** Deset pitanja po danu: 1–7 otvorena, 8 procjena (najbliži dobiva bonus), 9 otvoreno, 10 procjena (samo pragovi). */
function fixtureQuestions(admin) {
  const open = (text, kind, answers, category = 'tenis') => admin.saveQuestion(null, null, { category, type: 'open', text, answer_kind: kind, answers, sources: [{ title: 'Test', url: 'https://example.org' }] }).id;
  const ids = [];
  ids.push(open('Navedi tenisača s Grand Slam naslovom.', 'person', [
    { canonical: 'Novak Đoković', aliases: ['Nole'], prior_popularity: 100 },
    { canonical: 'Rafael Nadal', aliases: ['Rafa'], prior_popularity: 100 },
    { canonical: 'Marin Čilić', prior_popularity: 28 },
    { canonical: 'Marat Safin', prior_popularity: 13 },
    { canonical: 'Goran Ivanišević', prior_popularity: 28 },
    { canonical: 'Thomas Johansson', prior_popularity: 2 },
    { canonical: 'Gastón Gaudio', prior_popularity: 2 },
  ]));
  ids.push(open('Navedi klub koji je osvojio Ligu prvaka.', 'team', [
    { canonical: 'Real Madrid', prior_popularity: 100 },
    { canonical: 'Manchester United', aliases: ['Man United', 'Man Utd', 'Man. United'], prior_popularity: 55 },
    { canonical: 'Crvena zvezda', aliases: ['Red Star Belgrade'], prior_popularity: 13 },
    { canonical: 'Steaua București', aliases: ['Steaua Bukurešt', 'Steaua'], prior_popularity: 5 },
    { canonical: 'Nottingham Forest', prior_popularity: 5 },
  ], 'nogomet'));
  ids.push(open('Navedi svjetskog prvaka Formule 1.', 'person', [
    { canonical: 'Michael Schumacher', prior_popularity: 100 },
    { canonical: 'Ralf Schumacher', prior_popularity: 5 },   // namjerno u bazi radi testa dvosmislenosti
    { canonical: 'Jochen Rindt', prior_popularity: 5 },
    { canonical: 'Max Verstappen', prior_popularity: 100 },
  ], 'formula-1'));
  ids.push(open('Navedi reprezentaciju s medaljom na SP-u u rukometu.', 'country', [
    { canonical: 'Hrvatska', aliases: ['Croatia'], prior_popularity: 100 },
    { canonical: 'Austrija', aliases: ['Austria'], prior_popularity: 5 },
    { canonical: 'Slovenija', aliases: ['Slovenia'], prior_popularity: 13 },
    { canonical: 'Francuska', aliases: ['France'], prior_popularity: 100 },
  ], 'rukomet'));
  for (let i = 5; i <= 7; i++) {
    ids.push(open(`Pomoćno pitanje ${i}.`, 'other', [
      { canonical: 'Alfa', prior_popularity: 100 }, { canonical: 'Beta', prior_popularity: 28 }, { canonical: 'Gama', prior_popularity: 5 },
    ], i === 5 ? 'kosarka' : i === 6 ? 'borilacki' : 'nogomet'));
  }
  ids.push(admin.saveQuestion(null, null, {
    category: 'procjene', type: 'numeric', text: 'Koliko je reketa Safin razbio?', sport_tag: 'tenis',
    target: { value: 1000, unit: 'reketa', ref_date: '2009-11-11', tolerance_pct: 1, scoring_mode: 'pragovi+najblizi', tie_rule: 'dijele', is_estimate: 1 },
    sources: [{ title: 'Test', url: 'https://example.org' }],
  }).id);
  ids.push(open('Pomoćno pitanje 9.', 'other', [
    { canonical: 'Alfa', prior_popularity: 100 }, { canonical: 'Beta', prior_popularity: 28 }, { canonical: 'Gama', prior_popularity: 5 },
  ], 'kosarka'));
  ids.push(admin.saveQuestion(null, null, {
    category: 'procjene', type: 'numeric', text: 'Koliko je golova Fontaine zabio na SP-u 1958.?', sport_tag: 'nogomet',
    target: { value: 100, unit: 'golova', ref_date: '1958-06-29', tolerance_pct: 1, scoring_mode: 'pragovi', tie_rule: 'dijele', is_estimate: 0 },
    sources: [{ title: 'Test', url: 'https://example.org' }],
  }).id);
  return ids;
}

/**
 * Aplikacija nad privremenom bazom. Sat je lažan (`clock.now`) i miče se samo kad ga test pomakne.
 * Priprema je u testovima zadano 0 s (odgovor se može poslati odmah); testovi tajmera je sami uključuju preko `game`.
 */
export async function makeApp({ days = 3, start = DAY1, now, game = {}, questions = 10 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ontale-'));
  const clock = { now: now || new Date(`${start}T10:00:00+01:00`) };
  clock.advance = (seconds) => { clock.now = new Date(clock.now.getTime() + seconds * 1000); };
  const db = openDb(path.join(dir, 'test.db'));
  const app = createApp({ db, dataDir: dir, dbPath: path.join(dir, 'test.db'), rateLimitDisabled: true, adminEmails: ['admin@ontale.eu'], production: false, now: () => clock.now });
  seedBase(app.ctx);
  app.ctx.settings.set('game', { ...app.ctx.settings.get('game'), prep_seconds: 0, questions_per_day: questions, ...game });
  const ids = fixtureQuestions(app.ctx.admin).slice(0, questions);
  for (let d = 0; d < days; d++) app.ctx.admin.saveChallenge(null, null, { date: addDays(start, d), scope: 'sve', active: 1, question_ids: ids });
  app.ctx.settings.set('start_date', start);
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  return {
    ...app, base, clock, questionIds: ids, dir,
    client: () => new Client(base, clock),
    async stop() { await app.close(); db.close(); fs.rmSync(dir, { recursive: true, force: true }); },
  };
}

/** Mali HTTP klijent koji čuva kolačiće (jedan klijent = jedan igrač). */
export class Client {
  constructor(base, clock) { this.base = base; this.clock = clock; this.cookies = new Map(); }
  async req(method, url, body) {
    const res = await fetch(this.base + url, {
      method, redirect: 'manual',
      headers: { 'Content-Type': 'application/json', 'X-Ontale': '1', Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const [k, ...v] = kv.split('='); this.cookies.set(k, v.join('=')); }
    let data = null;
    try { data = await res.json(); } catch { /* bez tijela */ }
    return { status: res.status, data };
  }
  get(url) { return this.req('GET', url); }
  post(url, body = {}) { return this.req('POST', url, body); }
  patch(url, body = {}) { return this.req('PATCH', url, body); }
  put(url, body = {}) { return this.req('PUT', url, body); }
  del(url) { return this.req('DELETE', url); }
  async register(nick, email = `${nick.toLowerCase()}@test.hr`) { return this.post('/api/auth/register', { email, password: 'lozinka123', nickname: nick }); }
  /**
   * Odigra cijelu partiju zadanim odgovorima; vraća zadnji odgovor poslužitelja.
   * Procjene se šalju kao konačne. Neprepoznat odgovor ne zaključuje pitanje, pa pomoćnik tada pusti da vrijeme
   * istekne (pomakne lažni sat) — kao igrač koji nije znao bolje. Prazan odgovor (null) = igrač nije ništa upisao.
   */
  async play(map, answers, extra = {}) {
    const start = await this.post('/api/game/start', { map, ...extra });
    if (start.status !== 200) return start;
    const id = start.data.session.id;
    let last = start;
    for (let i = start.data.session.next_position; i <= answers.length; i++) {
      if (!last.data.question) last = await this.post(`/api/game/${id}/next`);
      const a = answers[i - 1];
      if (a != null) last = await this.post(`/api/game/${id}/answer`, { position: i, answer: a, final: true });
      if (a == null || last.data.retry || last.data.ambiguous || last.status === 400) {
        this.clock.advance(60);
        last = await this.get(`/api/game/${id}`);
      }
      if (last.status !== 200) return { ...last, sessionId: id };
    }
    return { ...last, sessionId: id };
  }
}

export const STANDARD = ['Novak Đoković', 'Real Madrid', 'Verstappen', 'Hrvatska', 'Alfa', 'Alfa', 'Alfa', '500', 'Alfa', '50'];
