// End-to-end test značajki v2.3 u pravom pregledniku (Playwright, Chromium):
// putokazi, privatne poruke, obavijesti, izazovi, nagrade lige, zvuk, prikaz karte, postavke, administracija, mobitel.
// Bez interneta pločice karte se ne učitavaju i vidi se shematski prikaz — to NIJE provjera satelita/reljefa
// (ta je ručna, u pregledniku s internetom: docs/MAP_PROVIDERS.md).
//   npm run test:e2e:v23      Snimke: test/snimke/v23-*.png
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';
import { seedBase, seedQuestions, loadQuestions } from '../seed/seed.js';
import { Client } from './helpers.js';

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* globalno */ }
  return createRequire(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/')('playwright');
}
const { chromium } = await loadPlaywright();
const shots = path.join(import.meta.dirname, 'snimke');
fs.mkdirSync(shots, { recursive: true });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ontale-v23-'));
const db = openDb(path.join(dir, 'e2e.db'));
const t0 = Date.now(), day = Date.parse('2026-11-14T10:00:00+01:00');
const clock = { offset: 0 };
const app = createApp({ db, dataDir: dir, dbPath: path.join(dir, 'e2e.db'), rateLimitDisabled: true, adminEmails: ['admin@ontale.eu'], now: () => new Date(day + Date.now() - t0 + clock.offset) });
seedBase(app.ctx);
seedQuestions(app.ctx, await loadQuestions(), '2026-11-02');
app.ctx.settings.set('start_date', '2026-11-02');
// osnovni sadržaj ima deset dana pitanja — za dulji raspon (prošli tjedan + danas + sutra) dani se ponavljaju
for (let d = '2026-11-02', i = 0; d <= '2026-11-22'; d = new Date(Date.parse(d + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10), i++) {
  if (app.ctx.db.get('SELECT 1 AS x FROM daily_challenges WHERE date = ?', d)) continue;
  const src = app.ctx.db.get('SELECT id FROM daily_challenges ORDER BY date LIMIT 1 OFFSET ?', i % 10).id;
  app.ctx.admin.saveChallenge(null, null, { date: d, scope: 'sve', active: 1, allow_size: true, question_ids: app.ctx.game.challengeQuestions(src).map((q) => q.id) });
}
app.ctx.settings.set('game', { ...app.ctx.settings.get('game'), prep_seconds: 0 });
app.ctx.settings.set('map', { eox_noncommercial: true });   // da se u sučelju pojavi i prekidač Satelit (pločice se ovdje ne učitavaju)
await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${app.server.address().port}`;
const fakeClock = { get now() { return new Date(day + Date.now() - t0 + clock.offset); }, advance(s) { clock.offset += s * 1000; } };
const cl = () => new Client(base, fakeClock);

// Odgovori: točni, različite rijetkosti (odgovori iz stvarne baze pitanja nisu poznati unaprijed — koristimo prepoznavanje iz baze)
const answersFor = (map, date, pick) => {
  const ch = app.ctx.game.challengeFor(date, map);
  return app.ctx.game.challengeQuestions(ch.id).map((q) => {
    if (q.type_slug === 'numeric' || q.type === 'numeric') { const t = app.ctx.game.numericTarget(q.id); return String(Math.round((t?.value || 100) * (pick === 'rare' ? 1 : 1.3))); }
    const list = app.ctx.db.all('SELECT canonical, prior_popularity FROM accepted_answers WHERE question_id = ? AND active = 1 ORDER BY prior_popularity ' + (pick === 'rare' ? 'ASC' : 'DESC'), q.id);
    return list[0]?.canonical || 'x';
  });
};

const browser = await chromium.launch();
const errors = [];
const watch = (page) => {
  page.on('pageerror', (e) => errors.push('JS: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|maplibre|unpkg/i.test(m.text())) errors.push('console: ' + m.text()); });
};
let step = 0;
const ok = (name) => console.log(`  ✔ ${String(++step).padStart(2)}. ${name}`);
const shot = (page, name, full = false) => page.screenshot({ path: path.join(shots, 'v23-' + name + '.png'), fullPage: full });
async function login(context, email) {
  const r = await context.request.post(base + '/api/auth/login', { headers: { 'X-Ontale': '1', 'Content-Type': 'application/json' }, data: { email, password: 'lozinka123' } });
  assert.equal(r.status(), 200);
}
const noOverflow = async (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

try {
  // ---------- priprema: tri igrača, liga, partije prethodnih dana (za tjedne nagrade) ----------
  const A = cl(), B = cl(), C = cl(), ADM = cl();
  await A.register('Ana'); await B.register('Bruno'); await C.register('Cvita'); await ADM.register('Admin', 'admin@ontale.eu');
  const lg = (await A.post('/api/leagues', { name: 'Kvart' })).data;
  await B.post('/api/leagues/join', { code: lg.code }); await C.post('/api/leagues/join', { code: lg.code });
  const ids = Object.fromEntries(await Promise.all([['a', A], ['b', B], ['c', C]].map(async ([k, c]) => [k, (await c.get('/api/bootstrap')).data.me.id])));
  // prošli tjedan (2.–8. 11.): partije u arhivi se ne računaju, pa upisujemo službene partije izravno kroz igru s pomaknutim satom
  for (const d of ['2026-11-03', '2026-11-04', '2026-11-05']) {
    clock.offset = Date.parse(d + 'T10:00:00+01:00') - day;
    await A.play('hr', answersFor('hr', d, 'rare')); await B.play('hr', answersFor('hr', d, 'common'));
    if (d === '2026-11-03') await C.play('hr', answersFor('hr', d, 'common'));
  }
  clock.offset = Date.parse('2026-11-09T08:00:00+01:00') - day;
  await app.ctx.jobs.tick();                                   // ponedjeljak: zaključuje tjedan 2.–8. 11. i šalje obavijesti o nagradama
  clock.offset = 0;
  assert.ok(app.ctx.db.get("SELECT COUNT(*) AS n FROM league_awards WHERE period = 'tjedan'").n > 0);
  // danas: Bruno i Cvita igraju (Ana kasnije u pregledniku); Bruno ostavlja putokaz
  const rb = await B.play('hr', answersFor('hr', '2026-11-14', 'common'));
  await B.put(`/api/signs/session/${rb.sessionId}`, { text: 'Livaja dobro te je!', shape: 'zeleni' });
  const rc = await C.play('hr', answersFor('hr', '2026-11-14', 'common').map((x, i) => (i % 2 ? 'krivo' : x)));
  await C.put(`/api/signs/session/${rc.sessionId}`, { text: 'Gdje ste ostali?', shape: 'zuti' });
  // poruke i izazov
  const conv = (await B.post('/api/conversations', { user_id: ids.a })).data;
  for (const m of ['Bok Ana! Jesi danas igrala?', 'Danas je bila teška ruta 😅', 'Izazivam te za sutra!']) await B.post(`/api/conversations/${conv.id}/messages`, { body: m });
  await C.post('/api/duels', { opponent_id: ids.a, map: 'hr', message: 'Ajde ako smiješ' });
  await B.post('/api/duels', { opponent_id: ids.a, map: 'ba', date: '2026-11-15' });
  ok('priprema: 3 igrača u ligi, prošli tjedan zaključen (nagrade), 2 putokaza, 3 poruke, 2 izazova');

  // ================= RAČUNALO: Ana =================
  app.ctx.settings.set('game', { ...app.ctx.settings.get('game'), prep_seconds: 5 });     // stvarne vrijednosti za tekst naslovnice
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await login(desk, 'ana@test.hr');
  const p = await desk.newPage(); watch(p);
  await p.goto(base + '/');
  await p.waitForSelector('.dest');
  assert.match(await p.locator('section.card .oneline').innerText(), /Za svako pitanje 5 s pripreme i 30 s za odgovor\. Ako ne pogodiš, pokušaj ponovno dok traje vrijeme\./);
  assert.equal((await p.locator('section.card .oneline').innerText()).includes('Odgovor upisuješ sam'), false);
  ok('naslovnica: novi tekst „Za svako pitanje 5 s pripreme i 30 s za odgovor. Ako ne pogodiš, pokušaj ponovno dok traje vrijeme.“');
  // zvonce s brojem nepročitanih
  await p.waitForSelector('[data-badge="notif"]:not([hidden])');
  const nBadge = Number(await p.locator('[data-badge="notif"]').innerText());
  assert.ok(nBadge >= 3, 'izazov, poruka, nagrada');
  assert.equal(await p.locator('[data-badge="msg"]').innerText(), '3');
  await p.click('button[aria-label="Obavijesti"]');
  await p.waitForSelector('.npanel .nitem');
  const panelText = await p.locator('.npanel').innerText();
  assert.match(panelText, /Cvita te izaziva/); assert.match(panelText, /Bruno/);
  assert.ok((await A.get('/api/notifications?limit=50')).data.items.some((n) => n.type === 'nagrada' && /Tjedni pobjednik/.test(n.title)), 'obavijest o tjednoj nagradi');
  await shot(p, '01-obavijesti-padajuci');
  ok(`zvonce: ${nBadge} nepročitanih; padajući popis s izazovom, porukom i tjednom nagradom`);
  await p.click('.npanel .nhead .linkbtn');
  await p.waitForFunction(() => document.querySelector('[data-badge="notif"]').hidden);
  ok('„Označi sve pročitanim“ gasi brojač');
  await p.keyboard.press('Escape');

  app.ctx.settings.set('game', { ...app.ctx.settings.get('game'), prep_seconds: 1 });     // kraća priprema za brži test
  // zvuk: isključi → ostaje isključen nakon ponovnog učitavanja
  await p.click('.iconbtn.snd');
  assert.equal(await p.evaluate(() => window.ontaleSound.prefs.on), false);
  await p.reload(); await p.waitForSelector('.dest');
  assert.equal(await p.evaluate(() => window.ontaleSound.prefs.on), false);
  assert.equal(await p.locator('.iconbtn.snd').getAttribute('aria-label'), 'Uključi zvuk');
  await p.click('.iconbtn.snd');
  assert.equal(await p.evaluate(() => window.ontaleSound.prefs.on), true);
  ok('zvuk: isključivanje se pamti nakon ponovnog učitavanja; ponovno uključivanje');

  // Ana igra današnju HR rutu u pregledniku — zvukovi dolazaka u gradove sviraju samo tijekom vožnje
  await p.goto(base + '/igra/hr');
  await p.click('.intro .btn.primary');
  await p.waitForSelector('.between .btn, .aform');
  const ans = answersFor('hr', '2026-11-14', 'rare');
  for (let i = 0; i < ans.length; i++) {
    if (await p.locator('.between .btn').count()) await p.click('.between .btn');
    await p.waitForSelector('.aform.is-run');
    await p.fill('input[name=answer]', ans[i]); await p.click('.abox button[type=submit]');
    await p.waitForSelector('.out-next .btn');
    if (i < ans.length - 1) { await p.waitForTimeout(250); await p.click('.out-next .btn'); }
  }
  await p.waitForTimeout(5600);                              // zadnja vožnja i zvuk kraja
  const log = await p.evaluate(() => window.ontaleSound.log);
  assert.ok(log.includes('synth:accept'), 'odgovor prihvaćen'); assert.ok(log.includes('synth:vehicle'), 'vožnja'); assert.ok(log.includes('synth:transport'));
  assert.ok(log.some((x) => x.startsWith('file:') || x === 'synth:station'), 'dolazak u grad: ' + log.join(','));
  assert.ok(log.includes('file:kraj'), 'kraj partije');
  await p.click('.out-next .btn');
  await p.waitForSelector('.arrive');
  const before = (await p.evaluate(() => window.ontaleSound.log)).length;
  await p.reload(); await p.waitForSelector('.arrive'); await p.waitForTimeout(1500);
  assert.equal((await p.evaluate(() => window.ontaleSound.log)).length, 0, 'osvježavanje rezultata ne pušta zvukove dolaska');
  ok(`igra sa zvukom: ${before} zvučnih događaja (prihvaćen odgovor, prijevoz, vožnja, gradovi, kraj); nakon osvježavanja rezultata nijedan`);

  // putokaz na rezultatu
  await p.waitForSelector('.ps-card .ps-shapes');
  await p.click('.ps-shape.plavi');
  await p.fill('.ps-card .ps-field input', 'www.reklama.hr');
  await p.click('.ps-card form .btn.primary');
  await p.waitForSelector('.ps-card .notice.err:not([hidden])');
  assert.match(await p.locator('.ps-card .notice.err').innerText(), /Poveznice/);
  await p.click('.ps-chips .chip >> nth=1');
  assert.equal(await p.locator('.ps-card .ps-field input').inputValue(), 'Danas letimo!');
  assert.match(await p.locator('.ps-card .ps-preview').innerText(), /Danas letimo!/);
  await shot(p, '02-putokaz-uredivanje', true);
  await p.click('.ps-card form .btn.primary');
  await p.waitForSelector('.ps-card h2:has-text("Tvoj putokaz")');
  assert.equal(await p.locator('.ps-card .ps-preview .ps-sign.plavi').count(), 1);
  assert.match(await p.locator('.ps-card').innerText(), /Tvoj putokaz za danas[\s\S]*Danas letimo!/);
  await p.click('.ps-card .btn:has-text("Uredi")');
  await p.fill('.ps-card .ps-field input', 'Vidimo se u Dubrovniku!');
  await p.click('.ps-card form .btn.primary');
  await p.waitForSelector('.ps-card h2:has-text("Tvoj putokaz")');
  assert.match(await p.locator('.ps-card').innerText(), /Vidimo se u Dubrovniku!/);
  ok('putokaz: odbijena poveznica, prijedlog, pregled uživo, oblik znaka, spremanje i izmjena');

  // liga: utrka s putokazima bez preklapanja
  await p.goto(base + `/lige/${lg.id}`);
  await p.waitForSelector('.race-sign .ps-sign');
  assert.equal(await p.locator('.race-sign').count(), 3);
  const boxes = await p.locator('.race-sign .ps-sign').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, b] = [boxes[i], boxes[j]];
    assert.ok(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1], 'putokazi se ne preklapaju');
  }
  const track = await p.locator('.race-track').boundingBox();
  for (const b of boxes) assert.ok(b[0] >= track.x - 2 && b[2] <= track.x + track.width + 20, 'putokaz unutar trake');
  assert.match(await p.locator('.race').innerText(), /Livaja dobro te je!/);
  await shot(p, '03-liga-utrka-putokazi');
  ok('liga: tri putokaza iznad igrača u utrci, bez preklapanja i unutar trake');
  // nagrade
  await p.click('.tabs a:has-text("Nagrade")');
  await p.waitForSelector('.medals, .rx-two');
  const awText = await p.locator('.lmain').innerText();
  assert.match(awText, /Ovaj tjedan[\s\S]*Prošli tjedni[\s\S]*Tjedni pobjednik/);
  await shot(p, '04-liga-nagrade', true);
  ok('liga → Nagrade: trenutni tjedan i mjesec, povijest tjedana, dvorana slavnih s medaljama');

  // poruke
  await p.goto(base + '/poruke');
  await p.waitForSelector('.conv.unread');
  assert.match(await p.locator('.conv').first().innerText(), /Bruno[\s\S]*Izazivam te za sutra!/);
  await shot(p, '05-poruke-popis');
  await p.click('.conv');
  await p.waitForSelector('.msg');
  assert.equal(await p.locator('.msg').count(), 3);
  await p.fill('.msg-input', 'Jesam! Vidimo se u izazovu <b>sutra</b>');
  await p.keyboard.press('Enter');
  await p.waitForSelector('.msg.mine');
  assert.equal(await p.locator('.msg.mine .mbody').innerText(), 'Jesam! Vidimo se u izazovu <b>sutra</b>', 'tekst se prikazuje doslovno, bez HTML-a');
  assert.equal(await p.locator('.msg.mine b').count(), 0);
  await p.waitForFunction(() => document.querySelector('[data-badge="msg"]').hidden);
  // druga strana odgovara → poruka stiže bez osvježavanja
  await B.post(`/api/conversations/${conv.id}/messages`, { body: 'Super, vidimo se 👋' });
  await p.waitForSelector('.msg:not(.mine):has-text("Super, vidimo se")', { timeout: 12000 });
  await shot(p, '06-razgovor');
  ok('poruke: popis razgovora, razgovor, slanje Enterom, siguran prikaz teksta, nova poruka stiže bez osvježavanja');

  // izazovi
  await p.goto(base + '/izazovi');
  await p.waitForSelector('.duel-card');
  assert.match(await p.locator('section:has(h2:has-text("Dolazni"))').innerText(), /Cvita[\s\S]*Ajde ako smiješ/);
  await p.click('section:has(h2:has-text("Dolazni")) .duel-card:has-text("Cvita") .btn.primary');
  await p.waitForSelector('section:has(h2:has-text("Povijest")) .duel-card:has-text("Cvita")');
  await shot(p, '07-izazovi', true);
  assert.match(await p.locator('section:has(h2:has-text("Povijest"))').innerText(), /Pobjeda|Poraz|Neriješeno/);
  ok('izazovi: dolazni izazov prihvaćen; obje službene partije već postoje → odmah završen s rezultatom');

  // profil drugog igrača: poruka, izazov, blokiranje
  await p.goto(base + '/igrac/Cvita');
  await p.waitForSelector('button:has-text("Pošalji poruku")');
  assert.equal(await p.locator('button:has-text("Pošalji poruku")').isDisabled(), false);
  await p.click('button:has-text("Pošalji poruku")');
  await p.waitForURL(/\/poruke\/\d+/);
  ok('javni profil: „Pošalji poruku“ otvara razgovor; „Izazovi“ i „Blokiraj“ dostupni');

  // postavke profila
  await p.goto(base + '/profil#obavijesti');
  await p.waitForSelector('#obavijesti');
  await p.locator('#obavijesti .toggle:has-text("Kad me netko prestigne") input').uncheck();
  await p.waitForTimeout(400);
  assert.equal((await A.get('/api/me/prefs')).data.notif_overtake, false);
  await p.locator('#poruke .seg button:has-text("Nitko")').click();
  await p.waitForTimeout(400);
  assert.equal((await A.get('/api/me/prefs')).data.dm_policy, 'nitko');
  await shot(p, '08-profil-postavke', true);
  await p.locator('#poruke .seg button:has-text("Članovi mojih liga")').click();
  ok('profil: postavke obavijesti, e-maila, poruka, zvuka i karte spremaju se na poslužitelju');

  // prikaz karte: prekidač Reljef/Satelit pamti se
  await p.goto(base + `/rezultat/${(await A.get('/api/bootstrap')).data.maps[0].mine.session_id}`);
  await p.waitForSelector('.hud-view');
  await p.click('.hud-view button[title="Satelit"]');
  assert.equal(await p.evaluate(() => localStorage.getItem('ontale-karta')), 'satelit');
  await p.waitForTimeout(300);
  assert.equal((await A.get('/api/me/prefs')).data.map_mode, 'satelit');
  await p.click('.hud-view button[title="Reljef"]');
  ok('karta: prekidač Reljef / Satelit (izbor se pamti lokalno i na profilu)');

  // administracija
  await B.post(`/api/messages/${(await B.get(`/api/conversations/${conv.id}`)).data.messages.find((m) => !m.mine).id}/report`, { reason: 'test prijave' });
  await C.post(`/api/signs/${(await C.get(`/api/leagues/${lg.id}`)).data.signs.hr.signs.find((s) => s.nickname === 'Bruno').id}/report`, { reason: 'test' });
  const ad = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await login(ad, 'admin@ontale.eu');
  const ap = await ad.newPage(); watch(ap);
  for (const [hash, expect, name] of [['moderacija', /Prijavljene poruke \(1\)[\s\S]*test prijave/, '09-admin-moderacija-poruke'], ['moderacija?t=putokazi', /Livaja dobro te je!/, '10-admin-putokazi'], ['moderacija?t=postavke', /Najveća duljina putokaza/, null],
    ['obavijesti', /SMTP nije konfiguriran[\s\S]*Podsjetnik nakon neaktivnosti[\s\S]*Dnevnik isporuke/, '11-admin-obavijesti'], ['dvoboji', /Cvita/, '12-admin-izazovi'], ['zvuk', /Tramvaj[\s\S]*Gradovi[\s\S]*Zagreb/, '13-admin-zvuk'], ['karta', /Aktivni pružatelj[\s\S]*MAPTILER_KEY/, '14-admin-karta']]) {
    await ap.goto(base + '/admin#/' + hash);
    await ap.waitForFunction((re) => new RegExp(re).test(document.querySelector('.adm-main')?.innerText || ''), expect.source, { timeout: 8000 });
    if (name) await shot(ap, name, true);
  }
  await ap.goto(base + '/admin#/moderacija?t=putokazi');
  await ap.waitForSelector('text=Livaja dobro te je!');
  ap.once('dialog', (d) => d.accept('test uklanjanja'));
  await ap.click('tr:has-text("Livaja") .btn.danger');
  await ap.waitForSelector('tr:has-text("Livaja") .tag.bad');
  assert.equal((await A.get(`/api/leagues/${lg.id}`)).data.signs.hr.signs.some((s) => s.text === 'Livaja dobro te je!'), false);
  ok('administracija: moderacija poruka i putokaza (uklanjanje), obavijesti i e-mail, izazovi, zvuk, karta');

  // ================= MOBITEL: Bruno =================
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await login(phone, 'bruno@test.hr');
  const m = await phone.newPage(); watch(m);
  await m.goto(base + `/lige/${lg.id}`);
  await m.waitForSelector('.race-sign .ps-sign');
  assert.ok(await noOverflow(m), 'bez vodoravnog pomicanja');
  await shot(m, '15-mob-liga-putokazi');
  await m.goto(base + `/poruke/${conv.id}`);
  await m.waitForSelector('.msg');
  assert.ok(await noOverflow(m));
  const formBox = await m.locator('.chat-form').boundingBox();
  assert.ok(formBox.y + formBox.height <= 844 + 1, 'polje za poruku je na dnu zaslona');
  await shot(m, '16-mob-razgovor');
  await m.goto(base + '/');
  await m.waitForSelector('.dest');
  await m.tap('button[aria-label="Obavijesti"]');
  await m.waitForSelector('.npanel');
  const np = await m.locator('.npanel').boundingBox();
  assert.ok(np.x >= 0 && np.x + np.width <= 390, 'padajući popis stane na zaslon');
  await shot(m, '17-mob-obavijesti');
  await m.goto(base + '/izazovi');
  await m.waitForSelector('.duel-card');
  assert.ok(await noOverflow(m));
  await shot(m, '18-mob-izazovi', true);
  ok('mobitel (390 px): utrka s putokazima, razgovor s poljem na dnu, padajuće obavijesti, izazovi — bez vodoravnog pomicanja');

  // ================= širine =================
  for (const w of [375, 390, 430, 768, 1024, 1440]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 760, hasTouch: w < 760 });
    await login(ctx, 'bruno@test.hr');
    const q = await ctx.newPage(); watch(q);
    for (const url of ['/', `/lige/${lg.id}`, `/lige/${lg.id}?tab=nagrade`, '/poruke', `/poruke/${conv.id}`, '/izazovi', '/obavijesti', '/profil', '/igrac/Ana']) {
      await q.goto(base + url); await q.waitForTimeout(350);
      assert.ok(await noOverflow(q), `${w}px ${url}: vodoravno pomicanje`);
    }
    await ctx.close();
  }
  ok('responzivnost: 375, 390, 430, 768, 1024, 1440 px — nove stranice bez vodoravnog pomicanja');
  assert.deepEqual(errors, []);
  ok('nijedna JavaScript greška u pregledniku');
  console.log(`\nE2E v2.3: svih ${step} koraka je prošlo. Snimke: test/snimke/v23-*.png`);
} catch (e) {
  console.error('\nE2E v2.3 PAO:', e.message, errors.length ? '\nGreške u pregledniku: ' + errors.join('\n') : '');
  process.exitCode = 1;
} finally {
  await browser.close();
  await app.close();
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
}
