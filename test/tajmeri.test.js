// Tajmeri, ponovni pokušaji, istek vremena, procjene, deset pitanja i nastavak rute — sve preko HTTP-a, s lažnim satom.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, STANDARD } from './helpers.js';

const TIMED = { prep_seconds: 5, answer_seconds: 30 };
const begin = async (t, map = 'hr') => {
  const c = t.client();
  const st = (await c.post('/api/game/start', { map })).data;
  const id = st.session.id;
  return {
    c, id, st,
    ans: (position, answer, final) => c.post(`/api/game/${id}/answer`, { position, answer, final }),
    next: () => c.post(`/api/game/${id}/next`),
    state: () => c.get(`/api/game/${id}`),
  };
};
const votes = (t, i = 0) => t.ctx.db.get('SELECT COALESCE(SUM(players),0) AS n FROM answer_frequency WHERE question_id = ?', t.questionIds[i]).n;
const voters = (t, i = 0) => t.ctx.db.get('SELECT COUNT(*) AS n FROM frequency_voters WHERE question_id = ?', t.questionIds[i]).n;
const rows = (t, id) => t.ctx.db.all('SELECT * FROM player_answers WHERE session_id = ? ORDER BY position', id);

test('priprema: 5 s zaključanog upisa, zatim 30 s za odgovor; poslužitelj odbija prerani odgovor', async () => {
  const t = await makeApp({ game: TIMED });
  try {
    const g = await begin(t);
    const tm = g.st.timing;
    assert.equal(tm.prep_end - tm.started_at, 5000); assert.equal(tm.deadline - tm.prep_end, 30000);
    assert.equal(g.st.question.position, 1, 'pitanje je vidljivo već tijekom pripreme');
    let r = await g.ans(1, 'Đoković');
    assert.equal(r.status, 425); assert.equal(r.data.too_early, true);
    t.clock.advance(3);
    assert.equal((await g.ans(1, 'Đoković')).status, 425, 'i nakon 3 s priprema još traje');
    assert.equal(rows(t, g.id).length, 0); assert.equal(votes(t), 0);
    assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM answer_attempts').n, 0, 'prerani odgovor se ne bilježi ni kao pokušaj');
    t.clock.advance(2);
    r = await g.ans(1, 'Đoković');
    assert.equal(r.status, 200); assert.equal(r.data.result.correct, true);
    assert.equal(rows(t, g.id)[0].answer_ms, 0, 'vrijeme odgovora mjeri se od kraja pripreme');
  } finally { await t.stop(); }
});

test('osvježavanje stranice i ponovni start ne vraćaju sat na početak', async () => {
  const t = await makeApp({ game: TIMED });
  try {
    const g = await begin(t);
    const t0 = g.st.timing;
    t.clock.advance(17);                                           // 5 s pripreme + 12 s odgovaranja
    const again = (await g.c.post('/api/game/start', { map: 'hr' })).data;
    const viaNext = (await g.next()).data, viaGet = (await g.state()).data;
    for (const x of [again, viaNext, viaGet]) {
      assert.equal(x.session.id, g.id);
      assert.equal(x.timing.started_at, t0.started_at); assert.equal(x.timing.deadline, t0.deadline);
      assert.equal(x.timing.deadline - x.timing.now, 18000, 'ostaje točno 18 s');
      assert.equal(x.question.position, 1);
    }
    // istovremeni pozivi "dalje" ne pokreću pitanje dvaput
    await g.ans(1, 'Đoković');
    const many = await Promise.all(Array.from({ length: 6 }, () => g.next()));
    assert.equal(new Set(many.map((m) => m.data.timing.started_at)).size, 1);
    assert.equal(many[0].data.question.position, 2);
  } finally { await t.stop(); }
});

test('netočan odgovor: ostaješ na pitanju, sat teče, pokušaji se ne računaju u učestalost ni kilometre', async () => {
  const t = await makeApp({ game: TIMED });
  try {
    const g = await begin(t);
    t.clock.advance(5);
    let r = await g.ans(1, 'Federerić');
    assert.equal(r.status, 200); assert.equal(r.data.retry, true);
    assert.equal(r.data.message, 'To nije taj odgovor. Pokušaj ponovno!');
    assert.equal(r.data.result, undefined); assert.equal(r.data.session.next_position, 1); assert.equal(r.data.session.total_km, 0);
    assert.equal(r.data.question.position, 1); assert.deepEqual(r.data.misses, ['Federerić']);
    assert.equal(r.data.timing.deadline, g.st.timing.deadline, 'pokušaj ne produljuje vrijeme');
    t.clock.advance(8);
    r = await g.ans(1, 'Lendlović'); assert.equal(r.data.retry, true);
    r = await g.ans(1, 'lendlovic'); assert.equal(r.data.retry, true);       // isti pokušaj se ne bilježi dvaput
    assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM answer_attempts').n, 2);
    assert.equal(rows(t, g.id).length, 0, 'nema konačnog zapisa dok pitanje nije zaključeno');
    assert.equal(votes(t), 0); assert.equal(voters(t), 0, 'pokušaji ne ulaze u statistiku rijetkosti');
    t.clock.advance(10);
    r = await g.ans(1, 'Gaudio');
    assert.equal(r.data.result.correct, true); assert.ok(r.data.result.km > 0); assert.equal(r.data.result.attempts, 3);
    assert.equal(r.data.awaiting_next, true);
    const pa = rows(t, g.id);
    assert.equal(pa.length, 1); assert.equal(pa[0].status, 'tocno'); assert.equal(pa[0].answer_ms, 18000);
    assert.equal(votes(t), 1); assert.equal(voters(t), 1, 'samo zaključeni točan odgovor daje jedan glas');
    assert.equal((await g.ans(1, 'Nadal')).data.duplicate, true, 'zaključeno pitanje se ne može ponovno odgovoriti');
    assert.equal(votes(t), 1);
  } finally { await t.stop(); }
});

test('istek vremena: 0 km, jasno stanje, sljedeće pitanje tek na zahtjev; zakašnjeli točan odgovor ne vrijedi', async () => {
  const t = await makeApp({ game: TIMED });
  try {
    const g = await begin(t);
    t.clock.advance(5);
    await g.ans(1, 'Krivić');
    t.clock.advance(30 + 1);                                       // 1 s nakon roka: unutar tolerancije mreže (1,5 s)
    assert.equal((await g.state()).data.question.position, 1, 'tolerancija još traje');
    t.clock.advance(1);                                            // 2 s nakon roka
    let r = await g.ans(1, 'Đoković');
    assert.equal(r.data.timeout, true); assert.equal(r.data.result.status, 'isteklo');
    assert.equal(r.data.result.km, 0); assert.equal(r.data.result.correct, false);
    assert.equal(r.data.session.total_km, 0); assert.equal(r.data.session.next_position, 2);
    assert.equal(r.data.awaiting_next, true); assert.equal(r.data.question, null); assert.equal(r.data.timing, null);
    assert.equal(r.data.upcoming.position, 2);
    assert.equal(votes(t), 0, 'zakašnjeli odgovor ne ulazi u učestalost');
    assert.equal(rows(t, g.id)[0].raw, 'Krivić', 'pamti se zadnji stvarni pokušaj');
    // dugo čekanje prije nastavka ne troši sljedeće pitanje
    t.clock.advance(600);
    r = await g.state();
    assert.equal(r.data.awaiting_next, true); assert.equal(r.data.session.next_position, 2);
    r = await g.next();
    assert.equal(r.data.question.position, 2); assert.equal(r.data.timing.deadline - r.data.timing.now, 35000);
    // igrač koji ništa ne upiše i samo osvježi stranicu također dobiva istek, bez tihog preskakanja
    t.clock.advance(60);
    r = await g.state();
    assert.equal(r.data.answers[1].status, 'isteklo'); assert.equal(r.data.answers[1].raw, ''); assert.equal(r.data.awaiting_next, true);
    assert.equal(r.data.session.next_position, 3, 'istek ne preskače više od jednog pitanja');
  } finally { await t.stop(); }
});

test('odgovor točno na roku prolazi; nakon tolerancije ne', async () => {
  const t = await makeApp({ game: TIMED });
  try {
    const a = await begin(t), b = await begin(t);
    t.clock.advance(35); t.clock.now = new Date(t.clock.now.getTime() + 1400);
    assert.equal((await a.ans(1, 'Gaudio')).data.result.correct, true);
    t.clock.now = new Date(t.clock.now.getTime() + 200);
    assert.equal((await b.ans(1, 'Gaudio')).data.timeout, true);
  } finally { await t.stop(); }
});

test('procjena: jedan pokušaj, odmah se zaključuje i otkriva točan broj; istek bez procjene = 0 km', async () => {
  const t = await makeApp({ game: TIMED });
  try {
    const g = await begin(t);
    const skip = async (n) => { for (let i = 1; i <= n; i++) { t.clock.advance(5); await g.ans(i, STANDARD[i - 1]); await g.next(); } };
    await skip(7);
    t.clock.advance(5);
    assert.equal((await g.ans(8, 'puno', true)).status, 400);     // mora biti broj
    let r = await g.ans(8, '995', true);                          // predaje se odmah, kao svaki odgovor
    assert.equal(r.data.result.status, 'tocno'); assert.equal(r.data.result.level, 7);
    assert.equal(r.data.result.target, 1000, 'točan broj je odmah vidljiv'); assert.ok(r.data.result.error_pct != null);
    assert.equal(r.data.awaiting_next, true); assert.equal(r.data.session.next_position, 9);
    assert.equal(rows(t, g.id).filter((x) => x.position === 8).length, 1, 'jedan konačni zapis');
    assert.equal((await g.ans(8, '1', true)).data.duplicate, true, 'zaključena procjena se ne mijenja');
    // istek bez ijedne upisane procjene = 0 km
    await g.next(); t.clock.advance(5); await g.ans(9, 'Alfa', true); await g.next();
    t.clock.advance(60);
    r = await g.state();
    assert.equal(r.data.answers[9].status, 'isteklo'); assert.equal(r.data.answers[9].km, 0); assert.equal(r.data.answers[9].guess, null);
    assert.equal(r.data.session.finished, true);
    const res = (await g.c.get(`/api/game/${g.id}/result`)).data;
    assert.equal(res.answers.length, 10);
    assert.equal(res.session.total_km, res.answers.reduce((s, x) => s + x.km, 0));
    assert.equal(res.answers[7].target, 1000, 'na rezultatu je točan broj procjene vidljiv');
  } finally { await t.stop(); }
});

test('procjena: postavka "nula" pri isteku poništava spremljenu procjenu', async () => {
  const t = await makeApp({ game: { ...TIMED, numeric_timeout: 'nula' }, questions: 10 });
  try {
    const g = await begin(t);
    for (let i = 1; i <= 7; i++) { t.clock.advance(5); await g.ans(i, STANDARD[i - 1]); await g.next(); }
    t.clock.advance(5); await g.ans(8, '1000');
    t.clock.advance(60);
    const r = await g.state();
    assert.equal(r.data.answers[7].status, 'isteklo'); assert.equal(r.data.answers[7].km, 0);
  } finally { await t.stop(); }
});

test('dvosmislen odgovor traži pojašnjenje i ne troši ni pitanje ni pokušaj', async () => {
  const t = await makeApp({ game: TIMED });
  try {
    const g = await begin(t);
    t.clock.advance(5); await g.ans(1, 'Nadal'); await g.next();
    t.clock.advance(5); await g.ans(2, 'Real Madrid'); await g.next();
    t.clock.advance(5);
    let r = await g.ans(3, 'Schumacher');
    assert.equal(r.data.ambiguous, true); assert.match(r.data.message, /Dopiši ime/);
    assert.equal(r.data.session.next_position, 3); assert.deepEqual(r.data.misses, []);
    assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM answer_attempts').n, 0);
    r = await g.ans(3, 'Ralf Schumacher');
    assert.equal(r.data.result.canonical, 'Ralf Schumacher'); assert.equal(r.data.result.attempts, 1);
  } finally { await t.stop(); }
});

test('dvostruki klik i istovremeni zahtjevi: jedan zapis, jedan glas, jedni kilometri', async () => {
  const t = await makeApp({ game: TIMED });
  try {
    const g = await begin(t);
    t.clock.advance(5);
    const many = await Promise.all(Array.from({ length: 8 }, () => g.ans(1, 'Gaudio')));
    assert.ok(many.every((m) => m.status === 200));
    assert.equal(many.filter((m) => !m.data.duplicate).length, 1, 'samo prvi zahtjev zaključuje pitanje');
    const km = many[0].data.result.km;
    assert.ok(many.every((m) => m.data.result.km === km));
    assert.equal(rows(t, g.id).length, 1); assert.equal(votes(t), 1);
    assert.equal((await g.state()).data.session.total_km, km);
    // istovremeni istek: više zahtjeva nakon roka daje jedan zapis
    await g.next(); t.clock.advance(60);
    await Promise.all([g.state(), g.ans(2, 'Real Madrid'), g.next(), g.state()]);
    assert.equal(rows(t, g.id).filter((x) => x.position === 2).length, 1);
    assert.equal(rows(t, g.id)[1].status, 'isteklo');
  } finally { await t.stop(); }
});

test('administrator može isključiti ponovne pokušaje i ograničiti njihov broj', async () => {
  const t = await makeApp({ game: { ...TIMED, retries: false } });
  try {
    const g = await begin(t);
    t.clock.advance(5);
    const r = await g.ans(1, 'Krivić');
    assert.equal(r.data.result.status, 'netocno'); assert.equal(r.data.result.km, 0); assert.equal(r.data.awaiting_next, true);
    t.ctx.settings.set('game', { ...t.ctx.settings.get('game'), retries: true, max_attempts: 2 });
    await g.next(); t.clock.advance(5);
    await g.ans(2, 'jedan'); await g.ans(2, 'dva');
    const third = await g.ans(2, 'tri');
    assert.equal(third.data.retry, true); assert.equal(third.data.attempts_left, 0);
    assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM answer_attempts WHERE position = 2').n, 2, 'pokušaji iznad granice se ne gomilaju');
    assert.equal((await g.ans(2, 'Real Madrid')).data.result.correct, true, 'točan odgovor i dalje vrijedi dok traje vrijeme');
  } finally { await t.stop(); }
});

test('deset pitanja: partija, napredak i rezultat; broj pitanja je podesiv', async () => {
  const t = await makeApp();
  try {
    const c = t.client();
    await c.register('Deseti');
    const r = await c.play('hr', STANDARD);
    assert.equal(r.data.session.finished, true); assert.equal(r.data.session.question_count, 10); assert.equal(r.data.answers.length, 10);
    const boot = (await c.get('/api/bootstrap')).data;
    assert.equal(boot.maps[0].mine.answered, 10); assert.equal(boot.maps[0].mine.question_count, 10); assert.equal(boot.challenge.categories.length, 10);
    const res = (await c.get(`/api/game/${r.sessionId}/result`)).data;
    assert.equal(res.answers.length, 10); assert.equal(res.session.question_count, 10);
    assert.equal(res.comparison.bins.reduce((a, b) => a + b.count, 0), 1, 'raspodjela igrača po kilometrima');
    assert.equal((await c.get('/api/me/stats')).data.streak.current, 1);
  } finally { await t.stop(); }
  const small = await makeApp({ questions: 8 });
  try {
    const c = small.client();
    const r = await c.play('hr', STANDARD.slice(0, 8));
    assert.equal(r.data.session.finished, true); assert.equal(r.data.session.question_count, 8);
    assert.equal((await c.get('/api/bootstrap')).data.game.questions_per_day, 8);
  } finally { await small.stop(); }
});

test('nastavak rute: nakon cilja kilometri se i dalje zbrajaju, a položaj prelazi u susjednu državu', async () => {
  const t = await makeApp();
  try {
    const game = t.ctx.game;
    for (const [slug, goalName, beyond, borderName] of [['hr', 'Dubrovnik', 'me', 'Debeli Brijeg'], ['ba', 'Neum', 'hr', 'Zaton Doli']]) {
      const route = game.routeFor(game.mapBySlug(slug).id);
      const goal = route.points[route.goal_index];
      assert.equal(goal.name, goalName); assert.equal(goal.km, 1000); assert.equal(route.total_km, 1000);
      assert.ok(route.end_km >= 2200);
      for (let i = 1; i < route.points.length; i++) assert.ok(route.points[i].km > route.points[i - 1].km, 'kilometri rastu duž cijele rute');
      const bi = route.points.findIndex((p) => p.label === 'granica');
      const border = route.points[bi];
      assert.ok(bi > route.goal_index, 'granični prijelaz je iza cilja');
      assert.equal(border.name, borderName); assert.equal(border.country, beyond); assert.equal(border.is_stop, 1);
      assert.ok(route.points.slice(0, bi).every((p) => p.country === slug), 'do granice je sve u matičnoj državi');
      assert.ok(route.points.slice(bi).every((p) => p.country === beyond), 'nastavak je spojen na cilj i cijeli u susjednoj državi');
      const before = game.locate(route, 950), at = game.locate(route, 1000), after = game.locate(route, 1400), end = game.locate(route, 5000);
      assert.equal(before.beyond, false); assert.equal(before.country.code, slug); assert.equal(before.goal.left, 50);
      assert.equal(at.passed.name, goalName); assert.equal(at.beyond, false);
      assert.equal(after.beyond, true); assert.equal(after.km, 1400, 'položaj se ne zaustavlja na cilju');
      assert.equal(after.country.code, beyond); assert.ok(after.country.flag); assert.equal(after.goal.left, 0);
      assert.equal(end.km, route.end_km); assert.equal(end.at_end, true);
    }
    // cijela partija s najrjeđim odgovorima: rezultat prelazi 1.000 km i položaj ide dalje od cilja
    const c = t.client(); await c.register('Daleki');
    const r = await c.play('hr', ['Gaudio', 'Steaua', 'Rindt', 'Austrija', 'Gama', 'Gama', 'Gama', '1000', 'Gama', '100']);
    assert.ok(r.data.session.total_km > 1000 && r.data.session.total_km <= 2200, `prijeđeno ${r.data.session.total_km} km`);
    assert.equal(r.data.session.reached_goal, true);
    assert.equal(r.data.location.beyond, true); assert.equal(r.data.location.country.code, 'me');
    assert.equal(r.data.location.km, r.data.session.total_km);
    const res = (await c.get(`/api/game/${r.sessionId}/result`)).data;
    assert.equal(res.location.beyond, true); assert.equal(res.comparison.max_km, r.data.session.total_km);
    assert.equal((await c.get('/api/leaderboard?map=hr')).data.rows[0].km, r.data.session.total_km, 'ljestvica računa i kilometre iza cilja');
    assert.deepEqual((await c.get('/api/bootstrap')).data.maps.map((m) => m.beyond), [['me'], ['hr']]);
  } finally { await t.stop(); }
});

test('admin: postavke igre se provjeravaju; kvaliteta sadržaja i slaganje novog dana', async () => {
  const t = await makeApp({ days: 1 });
  try {
    const adm = t.client(); await adm.register('Sef', 'admin@ontale.eu');
    const put = (game) => adm.put('/api/admin/settings', { game });
    assert.equal((await put({ questions_per_day: 0, prep_seconds: 5, answer_seconds: 30 })).status, 400);
    assert.equal((await put({ questions_per_day: 10, prep_seconds: 99, answer_seconds: 30 })).status, 400);
    assert.equal((await put({ questions_per_day: 10, prep_seconds: 5, answer_seconds: 2 })).status, 400);
    assert.equal((await put({ questions_per_day: 10, prep_seconds: 3, answer_seconds: 20, retries: false })).status, 200);
    const g = (await adm.get('/api/bootstrap')).data.game;
    assert.deepEqual(g, { questions_per_day: 10, prep_seconds: 3, answer_seconds: 20, retries: false });
    const st = (await adm.post('/api/game/start', { map: 'hr' })).data;
    assert.equal(st.timing.prep_end - st.timing.started_at, 3000); assert.equal(st.timing.deadline - st.timing.prep_end, 20000);
    // kvaliteta: fixture pitanja imaju malo odgovora i nisu provjeravana
    const q = (await adm.get('/api/admin/quality')).data;
    assert.equal(q.totals.open, 8); assert.equal(q.totals.numeric, 2); assert.equal(q.expected, 10);
    assert.ok(q.few_answers.length >= 4); assert.equal(q.unscheduled.length, 0); assert.equal(q.wrong_size_days.length, 0);
    // slaganje dana: bez neraspoređenih pitanja javlja jasnu grešku
    const none = await adm.post('/api/admin/challenges/compose', {});
    assert.equal(none.status, 409); assert.equal(none.data.available, 0);
    for (let i = 0; i < 9; i++) await adm.post('/api/admin/questions', { category: i % 2 ? 'tenis' : 'nogomet', type: 'open', text: `Novo pitanje ${i}?`, answers: ['A', 'B'] });
    for (let i = 0; i < 2; i++) await adm.post('/api/admin/questions', { category: 'procjene', type: 'numeric', text: `Nova procjena ${i}?`, target: { value: 10 + i, unit: 'kom', ref_date: '2026-01-01' } });
    const made = await adm.post('/api/admin/challenges/compose', {});
    assert.equal(made.status, 200); assert.equal(made.data.question_ids.length, 10); assert.equal(made.data.date, '2026-11-14');
    const ch = (await adm.get(`/api/admin/challenges/${made.data.id}`)).data;
    assert.equal(ch.active, 0, 'složeni dan je nacrt dok ga administrator ne objavi');
    assert.deepEqual(ch.questions.slice(-2).map((x) => x.type), ['numeric', 'numeric']);
    assert.equal((await adm.get('/api/admin/quality')).data.unscheduled.length, 1);
  } finally { await t.stop(); }
});
