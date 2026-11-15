// Napredna statistika lige, pozivnica s Open Graph podacima, novi gradovi BiH, boje dionica i država na ruti.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeApp, STANDARD } from './helpers.js';
import { weekStart } from '../src/ligastat.js';
import { segmentsOf, countryAt, SEGMENT_COLORS } from '../public/karta.js';

const RARE = ['Gaudio', 'Steaua', 'Rindt', 'Austrija', 'Gama', 'Gama', 'Gama', '1000', 'Gama', '100'];
const MID = ['Nadal', 'Real Madrid', 'Verstappen', 'Hrvatska', 'Beta', 'Beta', 'Alfa', '700', 'Beta', '80'];
const at = (t, iso) => { t.clock.now = new Date(iso); };

test('tjedan počinje ponedjeljkom (datumi igre, Europe/Zagreb)', () => {
  assert.equal(weekStart('2026-11-13'), '2026-11-09');   // petak
  assert.equal(weekStart('2026-11-09'), '2026-11-09');   // ponedjeljak
  assert.equal(weekStart('2026-11-15'), '2026-11-09');   // nedjelja
  assert.equal(weekStart('2026-11-16'), '2026-11-16');
  assert.equal(weekStart('2027-01-01'), '2026-12-28');   // prijelaz godine
});

test('liga: tjedan, mjesec, ukupno, rendgen, dvoboji, nagrade, odgovori ekipe, legende i dvorana slavnih', async () => {
  const t = await makeApp({ days: 8, start: '2026-11-13' });          // pet 13. 11. … pet 20. 11.
  try {
    const a = t.client(), b = t.client(), c = t.client();
    await a.register('Ana'); await b.register('Bruno'); await c.register('Cvita');
    const lg = (await a.post('/api/leagues', { name: 'Ekipa' })).data;
    await b.post('/api/leagues/join', { code: lg.code }); await c.post('/api/leagues/join', { code: lg.code });
    const S = (cl, extra = '') => cl.get(`/api/leagues/${lg.id}/stats?${extra}`);
    // petak 13.: Ana najdalje, Bruno srednje (obje karte), Cvita ne igra
    const a1 = await a.play('hr', RARE); await b.play('hr', MID); await b.play('ba', STANDARD);
    // zaštita od spoilera: Cvita još nije igrala
    let s = (await S(c, 'period=danas')).data;
    assert.equal(s.answers.locked, true); assert.deepEqual(s.answers.questions, []); assert.deepEqual(s.awards, []);
    assert.equal(JSON.stringify(s).includes('Gaudio'), false, 'tuđi odgovori se ne otkrivaju prije vlastite partije');
    assert.deepEqual(s.race.hr.map((r) => r.nickname), ['Ana', 'Bruno']); assert.deepEqual(s.not_played, ['Cvita']);
    // Ana je odigrala HR, ali ne i BiH
    s = (await S(a, 'period=danas&map=hr')).data;
    assert.equal(s.answers.locked, false); assert.equal(s.answers.questions.length, 10);
    assert.deepEqual(s.answers.questions[0].rows.map((r) => [r.nickname, r.answer]), [['Ana', 'Gastón Gaudio'], ['Bruno', 'Rafael Nadal']]);
    assert.equal(s.answers.questions[7].rows.find((r) => r.self).answer, '1000 reketa'); assert.equal(JSON.stringify(s.answers).includes('target'), false);
    assert.equal((await S(a, 'period=danas&map=ba')).data.answers.locked, true);
    assert.deepEqual(s.awards_hidden, ['Bosna i Hercegovina']);
    const aw = Object.fromEntries(s.awards.map((x) => [x.key, x]));
    assert.equal(aw.najrjedi.players[0].nickname, 'Ana'); assert.ok(aw.najrjedi.value);
    assert.ok(aw.najbrzi, 'vrijeme odgovora se bilježi'); assert.equal(aw.procjena.players.map((p) => p.nickname).join(), 'Ana');
    assert.equal(s.awards.some((x) => x.key === 'ista-misao'), false, 'nitko nije dao isti odgovor na karti koju Ana vidi');
    // subota 14.: sve troje; Cvita kao Ana (ista misao), Bruno bolje od Ane
    at(t, '2026-11-14T10:00:00+01:00');
    await a.play('hr', MID); await b.play('hr', RARE); await c.play('hr', MID);
    s = (await S(c, 'period=danas')).data;
    assert.ok(s.awards.some((x) => x.key === 'ista-misao' && x.players.length === 2));
    // ponedjeljak 16.: novi tjedan
    at(t, '2026-11-16T10:00:00+01:00');
    const a3 = await a.play('hr', RARE); await c.play('hr', MID);
    const kmA = a3.data.session.total_km;
    s = (await S(a, 'period=tjedan')).data;
    assert.equal(s.from, '2026-11-16'); assert.equal(s.to, '2026-11-22'); assert.equal(s.chart.length, 7);
    assert.equal(s.chart[0].games, 2); assert.equal(s.chart[1].avg, null);
    assert.deepEqual(s.table.map((r) => [r.nickname, r.rank, r.days]), [['Ana', 1, 1], ['Cvita', 2, 1], ['Bruno', 3, 0]]);
    assert.equal(s.table[0].km, kmA); assert.equal(s.table[0].wins, 1);
    // mjesec: sve partije studenog
    s = (await S(a, 'period=mjesec')).data;
    assert.equal(s.month, '2026-11'); assert.equal(s.team.games, 8); assert.equal(s.has_prev, false);
    const ana = s.table.find((r) => r.self);
    assert.equal(ana.days, 3); assert.equal(ana.games, 3); assert.equal(ana.wins, 2, 'pet i pon najdalje; sub je Bruno');
    assert.equal(s.team.km, Math.round(s.table.reduce((x, r) => x + r.km, 0)));
    assert.equal((await S(a, 'period=mjesec&month=2026-10')).data.team.games, 0);
    // ukupno
    s = (await S(a, 'period=ukupno')).data;
    assert.equal(s.team.games, 8); assert.equal(s.from, null); assert.ok(s.team.best >= Math.round(kmA));
    // rendgen: dvoboji samo ista karta + isti dan
    s = (await S(a, 'period=rendgen')).data;
    const duel = Object.fromEntries(s.rendgen.duels.map((d) => [d.nickname, d]));
    assert.deepEqual([duel.Bruno.wins, duel.Bruno.losses, duel.Bruno.ties, duel.Bruno.last], [1, 1, 0, ['w', 'l']]);
    assert.deepEqual([duel.Cvita.wins, duel.Cvita.losses, duel.Cvita.ties], [1, 0, 1], 'subota: isti odgovori = neriješeno');
    assert.equal(s.rendgen.metrics.wins, 2); assert.equal(s.rendgen.metrics.losses, 1); assert.equal(s.rendgen.metrics.ties, 1); assert.equal(s.rendgen.metrics.win_pct, 50);
    assert.equal(s.rendgen.metrics.days_top, 2); assert.equal(s.rendgen.metrics.days_played, 3);
    assert.equal(s.rendgen.target.rank, 1); assert.equal(s.rendgen.target.ahead, null); assert.equal(s.rendgen.target.behind.nickname, 'Cvita');
    assert.deepEqual(s.rendgen.history.map((h) => h.rank), [1, 2, 1]);
    assert.ok(s.rendgen.vs_league.find((x) => x.name === 'Tenis').me > 0);
    const sb = (await S(b, 'period=rendgen')).data.rendgen;
    assert.equal(sb.target.rank, 3); assert.equal(sb.target.ahead.nickname, 'Cvita'); assert.equal(sb.target.played_today, false);
    // legende i dvorana slavnih (prošli tjedan 9.–15. 11.)
    assert.equal(s.legends.length, 7); assert.ok(s.legends.find((g) => g.slug === 'tenis').nickname);
    assert.equal(s.hall.length, 1); assert.equal(s.hall[0].from, '2026-11-09'); assert.equal(s.hall[0].winner.nickname, 'Bruno', 'Bruno je prošli tjedan skupio najviše (tri partije)');
    assert.deepEqual(s.crowns, [{ nickname: 'Bruno', n: 1 }]);
    // pristup: nečlan i gost
    const x = t.client(); await x.register('Stranac');
    assert.equal((await S(x)).status, 404); assert.equal((await S(t.client())).status, 401);
    // bodovanje nije dirano: zbroj kilometara odgovora = rezultat partije
    assert.equal(a1.data.session.total_km, a1.data.answers.reduce((z, r) => z + r.km, 0));
  } finally { await t.stop(); }
});

test('pozivnica: poveznica vraća Open Graph podatke lige, a pridruživanje i dalje radi', async () => {
  const t = await makeApp({ days: 1 });
  try {
    const a = t.client(); await a.register('Ana');
    const lg = (await a.post('/api/leagues', { name: 'Kvartovski <derbi>' })).data;
    const html = await (await fetch(`${t.base}/liga/${lg.code}`)).text();
    assert.match(html, /<meta property="og:title" content="Ontale liga „Kvartovski &lt;derbi&gt;“ — pridruži se">/);
    assert.match(html, new RegExp(`og:description" content="[^"]*Kod: ${lg.code}`)); assert.match(html, /og:image" content="http[^"]+\/og-liga\.png"/);
    assert.equal((html.match(/og:title/g) || []).length, 1); assert.match(html, /<div id="app">/);
    assert.match(await (await fetch(`${t.base}/liga/NEMA99`)).text(), /Ontale — poziv u ligu/);
    assert.equal((await fetch(`${t.base}/og-liga.png`)).headers.get('content-type'), 'image/png');
    const b = t.client(); await b.register('Bruno');
    assert.equal((await b.post('/api/leagues/join', { code: lg.code.toLowerCase() })).status, 200);
    assert.equal((await b.get(`/api/leagues/${lg.id}`)).data.members.length, 2);
    assert.equal((await a.get('/api/bootstrap')).data.site.logo_text, 'Ontale');
  } finally { await t.stop(); }
});

test('ruta BiH: novi gradovi su prave postaje; boje dionica i država slijede položaj', async () => {
  const t = await makeApp({ days: 1 });
  try {
    const g = t.ctx.game, ba = g.routeFor(g.mapBySlug('ba').id), hr = g.routeFor(g.mapBySlug('hr').id);
    const names = ba.points.map((p) => p.name), idx = (n) => names.indexOf(n);
    for (const n of ['Novi Travnik', 'Vitez', 'Busovača', 'Ljubuški', 'Široki Brijeg', 'Travnik', 'Zenica']) {
      const p = ba.points[idx(n)];
      assert.ok(p, n); assert.equal(p.is_stop, 1); assert.ok(p.message && p.km > 0 && p.km < 1000 && p.lat > 42.5 && p.lat < 45.3 && p.lng > 15.7 && p.lng < 19.7, n);
    }
    assert.ok(idx('Bugojno') < idx('Novi Travnik') && idx('Novi Travnik') < idx('Travnik') && idx('Travnik') < idx('Vitez') && idx('Vitez') < idx('Busovača') && idx('Busovača') < idx('Zenica') && idx('Zenica') < idx('Sarajevo'));
    assert.ok(idx('Mostar') < idx('Široki Brijeg') && idx('Široki Brijeg') < idx('Ljubuški') && idx('Ljubuški') < idx('Neum'));
    assert.equal(names[0], 'Bijeljina'); assert.equal(ba.points[ba.goal_index].name, 'Neum'); assert.equal(ba.points[ba.goal_index].km, 1000); assert.equal(ba.end_km, 2250);
    assert.equal(g.locate(ba, ba.points[idx('Vitez')].km).passed.name, 'Vitez');
    // dionice: od postaje do postaje, susjedne različite boje, pokrivaju cijelu rutu
    for (const r of [ba, hr]) {
      const segs = segmentsOf(r);
      assert.equal(segs.length, r.points.filter((p) => p.is_stop).length - 1);
      assert.equal(segs[0].from, 0); assert.equal(segs.at(-1).to, r.end_km);
      segs.forEach((sg, i) => { assert.ok(SEGMENT_COLORS.includes(sg.color)); if (i) { assert.notEqual(sg.color, segs[i - 1].color); assert.equal(sg.from, segs[i - 1].to); } });
    }
    assert.ok(new Set(SEGMENT_COLORS).size >= 8);
    // aktivna država prema položaju
    const border = hr.points.find((p) => p.label === 'granica');
    assert.equal(countryAt(hr, 0), 'hr'); assert.equal(countryAt(hr, 1000), 'hr'); assert.equal(countryAt(hr, border.km - 1), 'hr'); assert.equal(countryAt(hr, border.km), 'me'); assert.equal(countryAt(hr, 2250), 'me');
    assert.equal(countryAt(ba, 999), 'ba'); assert.equal(countryAt(ba, ba.points.find((p) => p.label === 'granica').km + 1), 'hr');
    const boot = (await t.client().get('/api/bootstrap')).data;
    assert.equal(boot.challenge.categories.length, 10);
  } finally { await t.stop(); }
});
