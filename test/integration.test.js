// Integracijski testovi: cijeli poslužitelj nad privremenom bazom, preko HTTP-a, s kolačićima.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, STANDARD, DAY1 } from './helpers.js';

// Rijetki (ali točni) odgovori na svih deset pitanja.
const RARE = ['Gaudio', 'Steaua', 'Rindt', 'Austrija', 'Gama', 'Gama', 'Gama', '1000', 'Gama', '100'];

async function admin(t) {
  const a = t.client();
  await a.register('Sef', 'admin@ontale.eu');
  return a;
}

test('naslovnica: obje karte, deset pitanja, sedam razina prijevoza; baza odgovora ne curi klijentu', async () => {
  const t = await makeApp();
  try {
    const c = t.client();
    const b = (await c.get('/api/bootstrap')).data;
    assert.deepEqual(b.maps.map((m) => m.slug), ['hr', 'ba']);
    assert.equal(b.maps[0].from.name, 'Vukovar'); assert.equal(b.maps[0].to.name, 'Dubrovnik');
    assert.equal(b.maps[1].from.name, 'Bijeljina'); assert.equal(b.maps[1].to.name, 'Neum');
    assert.equal(b.challenge.questions, 10); assert.equal(b.maps[0].questions, 10); assert.equal(b.game.questions_per_day, 10);
    assert.deepEqual(b.transports.map((x) => x.km), [12, 30, 54, 84, 120, 150, 220]);
    const start = await c.post('/api/game/start', { map: 'hr' });
    const json = JSON.stringify(start.data);
    assert.ok(!/Đoković|Nadal|Gaudio/.test(json), 'odgovori ne smiju stići klijentu');
    assert.equal(start.data.question.position, 1);
    const map = (await c.get('/api/map/hr')).data;
    assert.equal(map.route.points[0].km, 0);
    const goal = map.route.points[map.route.goal_index];
    assert.equal(goal.name, 'Dubrovnik'); assert.equal(goal.km, 1000, 'cilj ostaje na 1.000 virtualnih kilometara');
    assert.ok(map.route.end_km >= 2200, 'nastavak rute pokriva i najbolji mogući rezultat (10 × 220 km)');
    assert.equal(map.route.points.at(-1).country, 'me');
  } finally { await t.stop(); }
});

test('partija: odgovori, aliasi, dijakritika, dvosmislenost, ponovni pokušaj, bodovanje i kraj', async () => {
  const t = await makeApp();
  try {
    const c = t.client();
    const st = (await c.post('/api/game/start', { map: 'hr' })).data;
    const s = st.session;
    assert.equal(s.question_count, 10); assert.ok(st.timing.deadline > st.timing.now);
    const ans = (position, answer, final) => c.post(`/api/game/${s.id}/answer`, { position, answer, final });
    const next = () => c.post(`/api/game/${s.id}/next`);
    let r = await ans(1, 'cilic');                               // bez dijakritike, samo prezime
    assert.equal(r.data.result.correct, true); assert.equal(r.data.result.canonical, 'Marin Čilić');
    assert.ok(r.data.result.km > 0); assert.ok(r.data.result.transport.name);
    assert.equal(r.data.awaiting_next, true); assert.equal(r.data.question, null, 'sljedeće pitanje ne kreće samo');
    assert.equal((await ans(2, 'Man. United')).status, 409, 'pitanje koje nije pokrenuto ne prima odgovore');
    await next();
    r = await ans(2, 'Man. United');                             // alias kluba
    assert.equal(r.data.result.canonical, 'Manchester United');
    await next();
    r = await ans(3, 'Schumacher');                              // dva Schumachera u bazi
    assert.equal(r.data.ambiguous, true);
    assert.equal((await c.get(`/api/game/${s.id}`)).data.session.next_position, 3, 'dvosmislen unos ne troši pitanje');
    r = await ans(3, 'Michael Schumacher');
    assert.equal(r.data.result.correct, true);
    await next();
    r = await ans(4, 'Australija');                              // slično Austriji, ali drugi pojam
    assert.equal(r.data.retry, true); assert.equal(r.data.result, undefined);
    assert.equal(r.data.session.next_position, 4, 'neprepoznat odgovor ne zaključuje pitanje');
    r = await ans(4, 'Austrija');
    assert.equal(r.data.result.correct, true); assert.equal(r.data.result.attempts, 2);
    r = await ans(6, 'Alfa');                                    // preskakanje pitanja nije moguće
    assert.equal(r.status, 409);
    await next(); await ans(5, 'gama'); await next(); await ans(6, 'Beta'); await next();
    r = await ans(7, 'nešto krivo');
    assert.equal(r.data.retry, true);
    t.clock.advance(40);                                         // vrijeme istekne bez točnog odgovora
    r = await c.get(`/api/game/${s.id}`);
    assert.equal(r.data.answers[6].status, 'isteklo'); assert.equal(r.data.answers[6].km, 0); assert.equal(r.data.awaiting_next, true);
    await next();
    r = await ans(8, 'abc', true);                               // procjena mora biti broj
    assert.equal(r.status, 400);
    r = await ans(8, '1.005', true);                             // jedan pokušaj; 0,5 % pogreške → najviša razina
    assert.equal(r.data.result.level, 7);
    assert.equal(r.data.result.target, 1000, 'točan broj se otkriva odmah nakon procjene');
    assert.ok(r.data.result.error_pct != null);
    assert.equal((await ans(8, '2')).data.duplicate, true, 'zaključena procjena se ne mijenja');
    await next(); await ans(9, 'Alfa'); await next();
    r = await ans(10, '100', true);
    assert.equal(r.data.session.finished, true);
    const res = (await c.get(`/api/game/${s.id}/result`)).data;
    assert.equal(res.answers.length, 10);
    assert.equal(res.session.total_km, res.answers.reduce((a, x) => a + x.km, 0));
    assert.equal(res.comparison.rank, 1);
    assert.deepEqual(res.answers[3].misses.map((m) => m.raw), ['Australija']);
    assert.equal((await ans(10, '5', true)).data.duplicate, true);
  } finally { await t.stop(); }
});

test('rijetki odgovor vozi dalje od čestog; dva igrača s istim odgovorom', async () => {
  const t = await makeApp();
  try {
    const a = t.client(), b = t.client(), c = t.client();
    const ra = await a.play('hr', ['Đoković', 'Real Madrid', 'Verstappen', 'Hrvatska', 'Alfa', 'Alfa', 'Alfa', '1000', 'Alfa', '100']);
    const rb = await b.play('hr', ['Gaudio', 'Steaua', 'Rindt', 'Austria', 'Gama', 'Gama', 'Gama', '1000', 'Gama', '100']);
    assert.ok(rb.data.session.total_km > ra.data.session.total_km * 2);
    const resA = (await a.get(`/api/game/${ra.sessionId}/result`)).data, resB = (await b.get(`/api/game/${rb.sessionId}/result`)).data;
    assert.ok(resB.answers[0].rarity > resA.answers[0].rarity);
    assert.ok(resB.answers[0].level > resA.answers[0].level);
    // isti odgovor drugog igrača i dalje je točan, a učestalost se bilježi po igraču
    const rc = await c.play('hr', ['Gaudio', 'Steaua Bukurešt', 'Rindt', 'Austrija', 'Gama', 'Gama', 'Gama', '1000', 'Gama', '100']);
    assert.equal(rc.data.session.finished, true);
    const q1 = t.questionIds[0];
    const freq = t.ctx.db.get(`SELECT f.players FROM answer_frequency f JOIN accepted_answers x ON x.id = f.answer_id WHERE f.question_id = ? AND x.canonical = 'Gastón Gaudio'`, q1);
    assert.equal(freq.players, 2);
    const steaua = t.ctx.db.get(`SELECT f.players FROM answer_frequency f JOIN accepted_answers x ON x.id = f.answer_id WHERE x.canonical = 'Steaua București'`);
    assert.equal(steaua.players, 2, 'kanonski naziv i alias broje se kao isti odgovor');
  } finally { await t.stop(); }
});

test('jedna službena partija po danu i karti; ponovljena i druga karta ne broje se dvaput', async () => {
  const t = await makeApp();
  try {
    const c = t.client();
    await c.register('Ivo');
    const first = await c.play('hr', STANDARD);
    const again = await c.post('/api/game/start', { map: 'hr' });
    assert.equal(again.data.session.id, first.sessionId, 'ponovni start vraća istu službenu partiju');
    assert.equal(again.data.session.finished, true);
    const replay = await c.play('hr', RARE, { replay: true });
    assert.equal(replay.data.session.official, false);
    assert.ok(replay.data.session.total_km > first.data.session.total_km);
    const board = (await c.get('/api/leaderboard?map=hr')).data;
    assert.equal(board.rows.length, 1);
    assert.equal(board.rows[0].km, first.data.session.total_km, 'ljestvica pamti samo službenu partiju');
    // druga karta je zasebna službena partija, ali glas za rijetkost je već potrošen
    const ba = await c.play('ba', STANDARD);
    assert.equal(ba.data.session.official, true);
    const votes = t.ctx.db.get('SELECT COALESCE(SUM(players),0) AS n FROM answer_frequency WHERE question_id = ?', t.questionIds[0]).n;
    assert.equal(votes, 1, 'isti igrač se za isto pitanje broji jednom');
    assert.equal((await c.get('/api/leaderboard?map=ba')).data.rows.length, 1);
    // istovremeni start ne stvara dvije službene partije
    const d = t.client();
    await d.register('Dupli');
    const many = await Promise.all(Array.from({ length: 6 }, () => d.post('/api/game/start', { map: 'hr' })));
    assert.equal(new Set(many.map((m) => m.data.session.id)).size, 1);
  } finally { await t.stop(); }
});

test('spoileri: točna brojka i tuđi odgovori tek nakon obje karte', async () => {
  const t = await makeApp();
  try {
    const c = t.client();
    const hr = await c.play('hr', STANDARD);
    let res = (await c.get(`/api/game/${hr.sessionId}/result`)).data;
    assert.equal(res.spoilers_unlocked, false);
    assert.equal(res.answers[7].target, 1000, 'točan broj procjene vidljiv odmah — nije spoiler druge karte');
    assert.equal(res.answers[0].top_answers, undefined, 'tuđi najčešći odgovori na otvorena pitanja ostaju skriveni');
    const ba = await c.play('ba', STANDARD);
    res = (await c.get(`/api/game/${ba.sessionId}/result`)).data;
    assert.equal(res.spoilers_unlocked, true);
    assert.equal(res.answers[7].target, 1000);
    assert.ok(res.answers[0].top_answers.length >= 1);
    // tuđu partiju nije moguće čitati
    const other = t.client();
    await other.post('/api/game/start', { map: 'hr' });
    assert.equal((await other.get(`/api/game/${hr.sessionId}/result`)).status, 404);
  } finally { await t.stop(); }
});

test('arhiva: stari izazovi su igrivi, ali ne utječu na ljestvice, niz ni rijetkost', async () => {
  const t = await makeApp({ start: '2026-11-11', now: new Date('2026-11-13T10:00:00+01:00') });
  try {
    const c = t.client();
    await c.register('Arhivar');
    const arch = (await c.get('/api/archive')).data;
    assert.deepEqual(arch.days.map((d) => d.date), ['2026-11-12', '2026-11-11']);
    const old = await c.play('hr', RARE, { date: '2026-11-12' });
    assert.equal(old.data.session.official, false); assert.equal(old.data.session.mode, 'arhiva');
    assert.equal((await c.get('/api/leaderboard?map=hr&date=2026-11-12')).data.rows.length, 0);
    assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM answer_frequency').n, 0);
    assert.equal((await c.get('/api/me/stats')).data.streak.current, 0);
    assert.equal((await c.post('/api/game/start', { map: 'hr', date: '2026-11-14' })).status, 403, 'budući izazov nije dostupan');
    assert.equal((await c.post('/api/game/start', { map: 'hr', date: '2026-11-01' })).status, 404);
  } finally { await t.stop(); }
});

test('niz dana i prelazak na novi dan usred otvorene partije', async () => {
  const t = await makeApp({ days: 4 });
  try {
    const c = t.client();
    await c.register('Nizar');
    await c.play('hr', STANDARD);
    assert.equal((await c.get('/api/me/stats')).data.streak.current, 1);
    t.clock.now = new Date('2026-11-14T23:50:00+01:00');
    const open = (await c.post('/api/game/start', { map: 'hr' })).data.session;
    assert.equal(open.date, '2026-11-14');
    const step = async (i) => { await c.post(`/api/game/${open.id}/next`); return c.post(`/api/game/${open.id}/answer`, { position: i, answer: STANDARD[i - 1], final: true }); };
    for (let i = 1; i <= 4; i++) await step(i);
    t.clock.now = new Date('2026-11-15T00:10:00+01:00');       // ponoć je prošla
    assert.equal((await c.get('/api/bootstrap')).data.date, '2026-11-15');
    let last;
    last = await c.get(`/api/game/${open.id}`);
    assert.equal(last.data.awaiting_next, true, 'između pitanja sat ne teče, pa pauza preko ponoći ne šteti');
    for (let i = 5; i <= 10; i++) last = await step(i);
    assert.equal(last.data.session.finished, true);
    assert.equal(last.data.session.date, '2026-11-14', 'partija ostaje vezana uz dan kad je započeta');
    assert.equal(last.data.session.official, true);
    const today = await c.play('hr', STANDARD);
    assert.equal(today.data.session.date, '2026-11-15');
    const st = (await c.get('/api/me/stats')).data.streak;
    assert.equal(st.current, 3); assert.equal(st.best, 3); assert.equal(st.days, 3);
    t.clock.now = new Date('2026-11-17T09:00:00+01:00');       // preskočen 16.
    assert.equal((await c.get('/api/me/stats')).data.streak.current, 0);
    assert.equal((await c.get('/api/me/stats')).data.streak.best, 3);
  } finally { await t.stop(); }
});

test('gost igra, zatim se registrira i zadržava rezultat; e-mail nije javan', async () => {
  const t = await makeApp();
  try {
    const c = t.client();
    const g = await c.play('hr', STANDARD);
    let boot = (await c.get('/api/bootstrap')).data;
    assert.equal(boot.me.is_guest, true);
    let board = (await c.get('/api/leaderboard?map=hr')).data;
    assert.equal(board.rows.length, 0); assert.equal(board.me.listed, false); assert.equal(board.me.rank, 1);
    assert.equal((await c.post('/api/leagues', { name: 'Gostujuća' })).status, 401);
    const reg = await c.register('Novi Igrac', 'novi@test.hr');
    assert.equal(reg.data.me.is_guest, false);
    board = (await c.get('/api/leaderboard?map=hr')).data;
    assert.equal(board.rows[0].nickname, 'Novi Igrac'); assert.equal(board.rows[0].km, g.data.session.total_km);
    const pub = await t.client().get('/api/profile/' + encodeURIComponent('novi igrac'));
    assert.equal(pub.status, 200);
    assert.ok(!JSON.stringify(pub.data).includes('novi@test.hr'), 'e-mail ne smije biti u javnom profilu');
    assert.equal(pub.data.stats.games, 1);
    // gost koji se prijavi u postojeći račun: partije se spajaju bez dvostruke službene
    const g2 = t.client();
    await g2.play('hr', RARE);
    await g2.post('/api/auth/login', { email: 'novi@test.hr', password: 'lozinka123' });
    assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM game_sessions WHERE official = 1').n, 1);
    assert.equal((await g2.get('/api/leaderboard?map=hr')).data.rows[0].km, g.data.session.total_km);
    // pogrešna lozinka, zauzet nadimak
    assert.equal((await t.client().post('/api/auth/login', { email: 'novi@test.hr', password: 'kriva' })).status, 401);
    assert.equal((await t.client().register('novi igrac', 'drugi@test.hr')).status, 409);
  } finally { await t.stop(); }
});

test('lige: stvaranje, ulazak kodom, tablica, napredak na karti, reakcije', async () => {
  const t = await makeApp();
  try {
    const a = t.client(), b = t.client(), stranger = t.client();
    await a.register('Ana'); await b.register('Bruno'); await stranger.register('Stranac');
    const league = (await a.post('/api/leagues', { name: 'Kvart protiv svih' })).data;
    assert.match(league.code, /^[A-Z2-9]{6}$/);
    assert.equal((await b.post('/api/leagues/join', { code: 'XXXXXX' })).status, 404);
    assert.equal((await b.post('/api/leagues/join', { code: league.code.toLowerCase() })).status, 200);
    const ra = await a.play('hr', STANDARD);
    await b.play('hr', RARE);
    let l = (await a.get(`/api/leagues/${league.id}`)).data;
    assert.deepEqual(l.members.map((m) => m.nickname), ['Bruno', 'Ana']);
    assert.ok(l.members[0].maps.hr.km > l.members[1].maps.hr.km);
    assert.equal((await stranger.get(`/api/leagues/${league.id}`)).status, 404, 'tuđa liga nije vidljiva');
    assert.equal((await b.post('/api/reactions', { session_id: ra.sessionId, emoji: '🔥' })).status, 200);
    assert.equal((await b.post('/api/reactions', { session_id: ra.sessionId, emoji: '💣' })).status, 400);
    assert.equal((await stranger.post('/api/reactions', { session_id: ra.sessionId, emoji: '🔥' })).status, 403);
    l = (await a.get(`/api/leagues/${league.id}`)).data;
    assert.deepEqual(l.members.find((m) => m.self).maps.hr.reactions, [{ emoji: '🔥', count: 1, mine: false }]);
    assert.equal((await a.get('/api/bootstrap')).data.leagues[0].played_today, 2);
    await a.post(`/api/leagues/${league.id}/leave`);
    l = (await b.get(`/api/leagues/${league.id}`)).data;
    assert.equal(l.owner, true, 'liga prelazi na preostalog člana');
  } finally { await t.stop(); }
});

test('prijava nepoznatog odgovora → admin odobri → kilometri i ljestvica se ažuriraju', async () => {
  const t = await makeApp();
  try {
    const adm = await admin(t);
    const p = t.client(), q = t.client();
    await p.register('Prijavitelj'); await q.register('Drugi');
    const answers = ['Đoković', 'Real Madrid', 'Verstappen', 'Hrvatska', 'Alfa', 'Alfa', 'Delta', '1000', 'Alfa', '100'];
    const rp = await p.play('hr', answers);
    const rq = await q.play('hr', answers);
    const before = rp.data.session.total_km;
    assert.equal((await p.post(`/api/game/${rp.sessionId}/report`, { position: 7, note: 'Delta je točno' })).status, 200);
    assert.equal((await p.post(`/api/game/${rp.sessionId}/report`, { position: 7, raw: 'Delta' })).data.already, true, 'isti pokušaj se prijavljuje jednom');
    assert.equal((await p.post(`/api/game/${rp.sessionId}/report`, { position: 1 })).status, 404, 'pitanje bez neprepoznatih pokušaja nema što prijaviti');
    assert.equal((await p.post(`/api/game/${rp.sessionId}/report`, { position: 8 })).status, 400, 'procjene se ne prijavljuju');
    assert.equal((await adm.get('/api/admin/unknown')).data[0].raw, 'Delta');
    assert.equal((await p.get('/api/admin/reports')).status, 403, 'običan korisnik nema pristup');
    const reports = (await adm.get('/api/admin/reports')).data;
    assert.equal(reports.length, 1); assert.equal(reports[0].raw, 'Delta'); assert.equal(reports[0].given, 2);
    const res = await adm.post('/api/admin/reports/resolve', { question_id: reports[0].question_id, norm: reports[0].norm, action: 'odobri', canonical: 'Delta', prior_popularity: 5, source_url: 'https://example.org/delta' });
    assert.equal(res.data.recalc.changed, 2, 'priznaje se svima koji su ga upisali, ne samo prijavitelju');
    const after = (await p.get(`/api/game/${rp.sessionId}/result`)).data;
    assert.ok(after.session.total_km > before);
    assert.equal(after.answers[6].correct, true);
    const board = (await p.get('/api/leaderboard?map=hr')).data;
    assert.equal(board.rows[0].km, after.session.total_km);
    const afterQ = (await q.get(`/api/game/${rq.sessionId}/result`)).data;
    assert.equal(afterQ.answers[6].km, after.answers[6].km, 'oba igrača dobivaju iste kilometre za naknadno priznat odgovor');
    assert.ok(afterQ.session.total_km > rq.data.session.total_km);
    assert.equal((await adm.get('/api/admin/reports')).data.length, 0);
    assert.equal((await adm.get('/api/admin/unknown')).data.length, 0, 'priznati pokušaji nestaju s popisa nepoznatih');
    assert.equal(t.ctx.db.get("SELECT f.players FROM answer_frequency f JOIN accepted_answers a ON a.id = f.answer_id WHERE a.canonical = 'Delta'").players, 2);
  } finally { await t.stop(); }
});

test('admin: zaštita, uređivanje pitanja i baze odgovora, proba, uvoz, masovno uređivanje', async () => {
  const t = await makeApp();
  try {
    const anon = t.client(), user = t.client();
    await user.register('Obican');
    for (const c of [anon, user]) {
      assert.ok([401, 403].includes((await c.get('/api/admin/dashboard')).status));
      assert.ok([401, 403].includes((await c.post('/api/admin/questions', { text: 'x' })).status));
      assert.ok([401, 403].includes((await c.put('/api/admin/settings', { game_name: 'Hak' })).status));
    }
    const adm = await admin(t);
    assert.equal((await adm.get('/api/admin/dashboard')).status, 200);
    const qid = t.questionIds[0];
    let q = (await adm.get(`/api/admin/questions/${qid}`)).data;
    assert.equal(q.answers.length, 7);
    assert.ok(q.answers.every((a) => a.rarity != null && a.level >= 1));
    // novi odgovor + alias + proba
    assert.equal((await adm.post(`/api/admin/questions/${qid}/test`, { input: 'Kuerten' })).data.status, 'nepoznato');
    const added = await adm.post(`/api/admin/questions/${qid}/answers`, { canonical: 'Gustavo Kuerten', aliases: ['Guga'], prior_popularity: 13, sources: [{ title: 'ITF', url: 'https://www.itftennis.com' }] });
    assert.equal(added.status, 200);
    assert.equal((await adm.post(`/api/admin/questions/${qid}/answers`, { canonical: 'gustavo kuerten' })).status, 409);
    assert.equal((await adm.post(`/api/admin/questions/${qid}/test`, { input: 'guga' })).data.canonical, 'Gustavo Kuerten');
    await adm.patch(`/api/admin/answers/${added.data.id}`, { manual_rarity: 99, aliases: ['Guga', 'Kuerten G.'] });
    const probe = (await adm.post(`/api/admin/questions/${qid}/test`, { input: 'Kuerten' })).data;
    assert.equal(probe.rarity, 99); assert.equal(probe.level, 7);
    // igrač odmah vidi učinak
    const p = t.client();
    const s = (await p.post('/api/game/start', { map: 'hr' })).data.session;
    assert.equal((await p.post(`/api/game/${s.id}/answer`, { position: 1, answer: 'Guga' })).data.result.km, 220);
    // novo pitanje, uređivanje, kopija, brisanje
    const created = await adm.post('/api/admin/questions', { category: 'tenis', type: 'open', text: 'Novo pitanje?', answer_kind: 'person', answers: ['Roger Federer'] });
    assert.equal((await adm.patch(`/api/admin/questions/${created.data.id}`, { text: 'Izmijenjeno?', difficulty: 5, active: false })).status, 200);
    q = (await adm.get(`/api/admin/questions/${created.data.id}`)).data;
    assert.equal(q.text, 'Izmijenjeno?'); assert.equal(q.difficulty, 5); assert.equal(q.active, 0);
    const copy = await adm.post(`/api/admin/questions/${created.data.id}/copy`);
    assert.equal((await adm.get(`/api/admin/questions/${copy.data.id}`)).data.answers[0].canonical, 'Roger Federer');
    assert.equal((await adm.del(`/api/admin/questions/${copy.data.id}`)).status, 200);
    assert.equal((await adm.del(`/api/admin/questions/${qid}`)).status, 409, 'pitanje iz izazova se ne briše');
    assert.equal((await adm.post('/api/admin/questions', { category: 'procjene', type: 'numeric', text: 'Bez vrijednosti?' })).status, 400);
    // uvoz CSV + JSON
    const csv = 'kategorija;vrsta;tekst;vrsta_odgovora;odgovori;vrijednost;jedinica;datum;izvor_url\nTenis;open;"Navedi tenisača, bilo kojeg";person;Marin Čilić=Cilic|Borna Ćorić;;;;https://atptour.com\nProcjene;numeric;Koliko asova?;;;13728;asova;2021-01-01;https://atptour.com\nNepostojeća;open;Krivo;;;;;;';
    const imp = (await adm.post('/api/admin/questions/import', { format: 'csv', data: csv })).data;
    assert.equal(imp.imported, 2); assert.equal(imp.errors.length, 1);
    q = (await adm.get(`/api/admin/questions/${imp.ids[0]}`)).data;
    assert.equal(q.text, 'Navedi tenisača, bilo kojeg'); assert.deepEqual(q.answers.map((a) => a.canonical).sort(), ['Borna Ćorić', 'Marin Čilić']);
    assert.equal((await adm.get(`/api/admin/questions/${imp.ids[1]}`)).data.target.value, 13728);
    const impJson = (await adm.post('/api/admin/questions/import', { format: 'json', data: JSON.stringify([{ category: 'nogomet', text: 'JSON pitanje?', answers: [{ canonical: 'Luka Modrić', aliases: ['Lukita'] }] }]) })).data;
    assert.equal(impJson.imported, 1);
    const bulk = (await adm.post('/api/admin/questions/bulk', { ids: [...imp.ids, ...impJson.ids], patch: { active: true, difficulty: 2 } })).data;
    assert.equal(bulk.changed, 3);
    assert.ok((await adm.get('/api/admin/audit')).data.length > 5, 'promjene se bilježe');
  } finally { await t.stop(); }
});

test('admin: prijevozna sredstva i gradovi odmah mijenjaju igru', async () => {
  const t = await makeApp();
  try {
    const adm = await admin(t);
    const sets = (await adm.get('/api/admin/transport-sets')).data;
    const active = sets.find((s) => s.active);
    const modes = active.modes.map((m) => ({ ...m, km: m.km * 2, name: m.level === 7 ? 'Helikopter predsjednika kluba' : m.name }));
    assert.equal((await adm.patch(`/api/admin/transport-sets/${active.id}`, { name: active.name, modes: modes.slice(0, 6) })).status, 400, 'mora biti sedam razina');
    assert.equal((await adm.patch(`/api/admin/transport-sets/${active.id}`, { name: active.name, modes })).status, 200);
    const boot = (await adm.get('/api/bootstrap')).data;
    assert.equal(boot.transports[6].km, 440); assert.equal(boot.transports[6].name, 'Helikopter predsjednika kluba');
    const other = sets.find((s) => !s.active);
    await adm.post(`/api/admin/transport-sets/${other.id}/activate`);
    assert.equal((await adm.get('/api/bootstrap')).data.transports[0].name, other.modes[0].name);
    assert.equal((await adm.del(`/api/admin/transport-sets/${other.id}`)).status, 400, 'aktivni set se ne briše');
    // gradovi: novo odredište, nadimak i kraća ruta
    const maps = (await adm.get('/api/admin/maps')).data;
    const hr = maps.find((m) => m.slug === 'hr');
    assert.equal(hr.route.total_km, 1000); assert.equal(hr.route.checkpoints.filter((c) => c.is_goal).length, 1);
    const pts = hr.route.checkpoints.slice(0, 5).map((c) => ({ ...c, is_goal: 0 }));
    pts[0].nickname = 'Start kod vodotornja'; pts[4].name = 'Požega'; pts[4].message = 'Stigao u Zlatnu dolinu.';
    assert.equal((await adm.patch(`/api/admin/maps/${hr.id}`, { route: { total_km: 300, checkpoints: [pts[0]] } })).status, 400);
    assert.equal((await adm.patch(`/api/admin/maps/${hr.id}`, { route: { total_km: 300, checkpoints: pts } })).status, 200);
    const b2 = (await adm.get('/api/bootstrap')).data.maps[0];
    assert.equal(b2.to.name, 'Požega'); assert.equal(b2.route_km, 300); assert.equal(b2.from.nickname, 'Start kod vodotornja');
    const map = (await adm.get('/api/map/hr')).data;
    assert.equal(map.route.points.at(-1).km, 300); assert.equal(map.route.end_km, 300, 'ruta bez nastavka završava na cilju');
    // nastavak u susjednu državu: cilj je treća točka, ostatak je produžetak s vlastitim kilometrima
    const ext = pts.map((c, i) => ({ ...c, is_goal: i === 2 ? 1 : 0, country: i > 2 ? 'me' : 'hr' }));
    assert.equal((await adm.patch(`/api/admin/maps/${hr.id}`, { route: { total_km: 300, ext_km: 500, real_km: 222, checkpoints: ext } })).status, 200);
    const m2 = (await adm.get('/api/map/hr')).data;
    assert.equal(m2.route.goal_index, 2); assert.equal(m2.route.points[2].km, 300); assert.equal(m2.route.end_km, 800);
    assert.equal(m2.route.points.at(-1).km, 800); assert.equal(m2.route.points.at(-1).country, 'me');
    assert.equal((await adm.get('/api/bootstrap')).data.maps[0].to.name, pts[2].name);
    // postavke: validacija i spremanje
    assert.equal((await adm.put('/api/admin/settings', { reset_time: '25:00' })).status, 400);
    assert.equal((await adm.put('/api/admin/settings', { nepoznato: 1 })).status, 400);
    assert.equal((await adm.put('/api/admin/settings', { game_name: 'ONTALE test', reset_time: '06:00' })).status, 200);
    assert.equal((await adm.get('/api/bootstrap')).data.site.name, 'ONTALE test');
  } finally { await t.stop(); }
});

test('procjene: najbliža procjena dana, jednake udaljenosti, ispravak referentne vrijednosti', async () => {
  const t = await makeApp({ days: 2 });
  try {
    const adm = await admin(t);
    const mk = async (nick, guess) => { const c = t.client(); await c.register(nick); const r = await c.play('hr', [...STANDARD.slice(0, 7), guess, 'Alfa', '100']); return { c, id: r.sessionId, km: r.data.session.total_km }; };
    const a = await mk('Ispod', '900'), b = await mk('Iznad', '1100'), far = await mk('Daleko', '300');
    const kmBefore = a.km;
    t.clock.now = new Date('2026-11-14T08:00:00+01:00');
    await adm.get('/api/bootstrap');                            // prvi posjet novog dana zaključuje jučerašnji
    const ra = (await a.c.get(`/api/game/${a.id}/result`)).data, rb = (await b.c.get(`/api/game/${b.id}/result`)).data, rf = (await far.c.get(`/api/game/${far.id}/result`)).data;
    assert.equal(ra.answers[7].bonus, true); assert.equal(rb.answers[7].bonus, true, 'jednako udaljene procjene dijele bonus');
    assert.equal(ra.answers[7].level, 7); assert.equal(rf.answers[7].bonus, false);
    assert.ok(ra.session.total_km > kmBefore);
    assert.equal(ra.answers[7].target, 1000); assert.equal(ra.answers[7].is_estimate, true);
    // administrator ispravlja referentnu vrijednost → ponovni obračun + trag u dnevniku
    const qid = t.questionIds[7];
    assert.equal((await adm.patch(`/api/admin/questions/${qid}`, { target: { value: 300, reason: 'novi izvor' } })).status, 200);
    await adm.post(`/api/admin/questions/${qid}/recalc`, { mode: 'sve' });
    const rf2 = (await far.c.get(`/api/game/${far.id}/result`)).data;
    assert.equal(rf2.answers[7].level, 7); assert.equal(rf2.answers[7].target, 300);
    const log = (await adm.get('/api/admin/audit')).data.find((x) => x.action === 'ispravak-vrijednosti');
    assert.match(log.detail, /"staro":1000/);
    const g = (await adm.get(`/api/admin/questions/${qid}/guesses`)).data;
    assert.equal(g.count, 3); assert.equal(g.median, 900);
  } finally { await t.stop(); }
});

test('admin: dnevni izazovi — stvaranje, redoslijed, zamjena, kopiranje, aktivacija', async () => {
  const t = await makeApp({ days: 1 });
  try {
    const adm = await admin(t);
    const ids = t.questionIds;
    const made = await adm.post('/api/admin/challenges', { date: '2026-11-20', question_ids: [...ids].reverse(), active: false });
    assert.equal(made.status, 200);
    assert.equal((await adm.post('/api/admin/challenges', { date: '2026-11-20', question_ids: ids })).status, 409, 'jedan izazov po datumu i opsegu');
    let ch = (await adm.get(`/api/admin/challenges/${made.data.id}`)).data;
    assert.equal(ch.questions[0].id, ids[9]);
    await adm.patch(`/api/admin/challenges/${made.data.id}`, { question_ids: ids, active: true });
    ch = (await adm.get(`/api/admin/challenges/${made.data.id}`)).data;
    assert.equal(ch.questions[0].id, ids[0]); assert.equal(ch.active, 1);
    const copy = await adm.post(`/api/admin/challenges/${made.data.id}/copy`, { date: '2026-11-21' });
    assert.equal((await adm.get(`/api/admin/challenges/${copy.data.id}`)).data.questions.length, 10);
    // poseban set samo za kartu BiH ima prednost pred zajedničkim
    const short = await adm.post('/api/admin/challenges', { date: DAY1, scope: 'ba', question_ids: ids.slice(0, 3) });
    assert.equal(short.status, 409, 'aktivan izazov s brojem pitanja različitim od zadanog traži izričitu potvrdu');
    assert.equal(short.data.needs_allow_size, true); assert.equal(short.data.expected, 10);
    assert.equal((await adm.get('/api/admin/challenges')).data.filter((c) => c.scope === 'ba').length, 0, 'odbijeni izazov nije spremljen');
    const baOnly = await adm.post('/api/admin/challenges', { date: DAY1, scope: 'ba', question_ids: ids.slice(0, 3), allow_size: true });
    assert.equal(baOnly.status, 200);
    const p = t.client();
    assert.equal((await p.post('/api/game/start', { map: 'ba' })).data.session.question_count, 3);
    assert.equal((await p.post('/api/game/start', { map: 'hr' })).data.session.question_count, 10);
    // izmjena pitanja izazova koji se igra traži potvrdu
    const todays = (await adm.get('/api/admin/challenges')).data.find((c) => c.date === DAY1 && c.scope === 'sve');
    const blocked = await adm.patch(`/api/admin/challenges/${todays.id}`, { question_ids: ids.slice(0, 9) });
    assert.equal(blocked.status, 409); assert.equal(blocked.data.needs_force, true);
    // deaktiviran izazov nestaje igračima
    await adm.patch(`/api/admin/challenges/${todays.id}`, { active: false });
    assert.equal((await t.client().post('/api/game/start', { map: 'hr' })).status, 404);
  } finally { await t.stop(); }
});

test('korisnici: blokada, uređivanje nadimka, brisanje računa, sigurnosne provjere', async () => {
  const t = await makeApp();
  try {
    const adm = await admin(t);
    const u = t.client();
    const me = (await u.register('Nezgodni')).data.me;
    await u.play('hr', STANDARD);
    assert.equal((await adm.patch(`/api/admin/users/${me.id}`, { nickname: 'Pristojni' })).status, 200);
    assert.equal((await u.get('/api/leaderboard?map=hr')).data.rows[0].nickname, 'Pristojni');
    await adm.patch(`/api/admin/users/${me.id}`, { is_blocked: true, block_reason: 'bot' });
    assert.equal((await u.get('/api/bootstrap')).data.me, null, 'blokirani korisnik je odjavljen');
    assert.equal((await u.get('/api/leaderboard?map=hr')).data.rows.length, 0, 'rezultat blokiranog nije na ljestvici');
    assert.equal((await u.post('/api/auth/login', { email: 'nezgodni@test.hr', password: 'lozinka123' })).status, 200);
    assert.equal((await u.get('/api/bootstrap')).data.me, null);
    await adm.patch(`/api/admin/users/${me.id}`, { is_blocked: false });
    // zahtjev bez CSRF zaglavlja se odbija
    const raw = await fetch(t.base + '/api/auth/logout', { method: 'POST' });
    assert.equal(raw.status, 403);
    // SQL injection pokušaj je samo tekst
    const inj = t.client();
    const s = (await inj.post('/api/game/start', { map: 'hr' })).data.session;
    const r = await inj.post(`/api/game/${s.id}/answer`, { position: 1, answer: "'; DROP TABLE users; --" });
    assert.equal(r.data.retry, true);
    assert.ok(t.ctx.db.get('SELECT COUNT(*) AS n FROM users').n > 0);
    assert.equal((await inj.get('/api/leaderboard?map=' + encodeURIComponent("hr' OR 1=1"))).status, 400);
    // klijent ne može sam sebi upisati kilometre
    await inj.post(`/api/game/${s.id}/answer`, { position: 1, answer: 'Đoković', km: 9999, level: 7, total_km: 9999 });
    assert.ok((await inj.get(`/api/game/${s.id}`)).data.session.total_km < 100);
    // brisanje računa uklanja partije i podatke
    const d = t.client();
    const dm = (await d.register('Odlazim')).data.me;
    await d.play('hr', STANDARD);
    assert.equal((await d.del('/api/me')).status, 200);
    assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM game_sessions WHERE user_id = ?', dm.id).n, 0);
    assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM users WHERE id = ?', dm.id).n, 0);
    assert.equal((await d.get('/api/bootstrap')).data.me, null);
  } finally { await t.stop(); }
});

test('više istovremenih igrača: 40 partija paralelno bez gubitka ili dupliranja', async () => {
  const t = await makeApp();
  try {
    t.ctx.settings.set('rarity', { prior_strength: 200, w_percentile: 0.7, w_breadth: 0.3, ip_cap: 1000 }); // svi testni igrači dijele jednu IP adresu
    const pool = ['Đoković', 'Nadal', 'Čilić', 'Safin', 'Ivanišević', 'Johansson', 'Gaudio'];
    const players = await Promise.all(Array.from({ length: 40 }, async (_, i) => { const c = t.client(); await c.register(`Igrac${i}`); return c; }));
    const results = await Promise.all(players.map((c, i) => c.play(i % 2 ? 'hr' : 'ba', [pool[i % pool.length], 'Real Madrid', 'Verstappen', 'Hrvatska', 'Alfa', 'Beta', 'Gama', String(800 + i * 10), 'Beta', String(60 + i)])));
    assert.ok(results.every((r) => r.data.session.finished));
    assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM game_sessions WHERE official = 1 AND finished_at IS NOT NULL').n, 40);
    assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM player_answers').n, 400);
    assert.equal(t.ctx.db.get('SELECT SUM(players) AS n FROM answer_frequency WHERE question_id = ?', t.questionIds[0]).n, 40);
    const hr = (await players[1].get('/api/leaderboard?map=hr')).data, ba = (await players[0].get('/api/leaderboard?map=ba')).data;
    assert.equal(hr.total, 20); assert.equal(ba.total, 20);
    for (let i = 1; i < hr.rows.length; i++) assert.ok(hr.rows[i - 1].km >= hr.rows[i].km);
    const sums = t.ctx.db.all('SELECT s.total_km, (SELECT SUM(km) FROM player_answers pa WHERE pa.session_id = s.id) AS sum FROM game_sessions s');
    assert.ok(sums.every((x) => Math.abs(x.total_km - x.sum) < 1e-6), 'zbroj kilometara po odgovorima odgovara ukupnom rezultatu');
    const total = (await players[0].get('/api/leaderboard/total?map=sve')).data;
    assert.equal(total.rows.length, 40);
  } finally { await t.stop(); }
});

test('ograničenje glasova po IP adresi štiti rijetkost od farme gostiju', async () => {
  const t = await makeApp();
  try {
    for (let i = 0; i < 6; i++) await t.client().play('hr', ['Gaudio', 'Real Madrid', 'Verstappen', 'Hrvatska', 'Alfa', 'Alfa', 'Alfa', '1000', 'Alfa', '100']);
    const votes = t.ctx.db.get(`SELECT f.players FROM answer_frequency f JOIN accepted_answers a ON a.id = f.answer_id WHERE a.canonical = 'Gastón Gaudio'`).players;
    assert.equal(votes, 3, 'najviše tri glasa s iste adrese po pitanju');
  } finally { await t.stop(); }
});
