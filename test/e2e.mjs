// End-to-end test u pravom pregledniku (Playwright, Chromium) nad privremenom bazom s pravim početnim sadržajem.
//   npm i -D playwright && npx playwright install chromium && npm run test:e2e
// Snimke zaslona spremaju se u test/snimke/ (mapa se može obrisati).
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';
import { seedBase, seedQuestions, loadQuestions } from '../seed/seed.js';

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* nije instaliran lokalno */ }
  const require = createRequire(process.env.PLAYWRIGHT_PATH || '/opt/npm-tools/node_modules/');
  return require('playwright');
}
const { chromium } = await loadPlaywright();
const shots = path.join(import.meta.dirname, 'snimke');
fs.mkdirSync(shots, { recursive: true });

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ontale-e2e-'));
const db = openDb(path.join(dir, 'e2e.db'));
// Sat poslužitelja: drugi dan igre (arhiva ima jedan dan), ali otkucava stvarnom brzinom — tajmeri pitanja su pravi.
const t0 = Date.now(), day2 = Date.parse('2026-11-14T10:00:00+01:00');
const app = createApp({ db, dataDir: dir, rateLimitDisabled: true, adminEmails: ['admin@ontale.eu'], now: () => new Date(day2 + Date.now() - t0) });
seedBase(app.ctx);
seedQuestions(app.ctx, await loadQuestions(), '2026-11-13');
app.ctx.settings.set('start_date', '2026-11-13');
const setGame = (patch) => app.ctx.settings.set('game', { ...app.ctx.settings.get('game'), ...patch });
setGame({ prep_seconds: 2 });                                       // kraća priprema da test ne traje predugo; 30 s za odgovor ostaje
await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${app.server.address().port}`;

const browser = await chromium.launch();
const errors = [];
const watch = (page) => {
  page.on('pageerror', (e) => errors.push('JS: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push('console: ' + m.text()); });
};
let step = 0;
const ok = (name) => console.log(`  ✔ ${String(++step).padStart(2)}. ${name}`);
const shot = (page, name, full = false) => page.screenshot({ path: path.join(shots, name + '.png'), fullPage: full });
/** Upisuje odgovor i šalje ga jednim pritiskom — procjena se predaje isto kao svaki odgovor. */
async function answer(page, value) {
  await page.fill('input[name=answer]', value);
  await page.click('.abox button[type=submit]');
}
const nextQuestion = async (page) => { await page.click('.out-next .btn'); await page.waitForSelector('.aform.is-run'); };
const totalKm = async (page) => Number((await page.locator('.arrive-top').innerText()).split('→')[1].replace(/\D/g, ''));

try {
  // ============ Mobitel: gost igra kartu Hrvatske ============
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await phone.newPage(); watch(p);
  await p.goto(base + '/');
  await p.waitForSelector('.dest');
  assert.equal(await p.locator('.dest').count(), 2);
  assert.match(await p.locator('.dest').nth(0).innerText(), /Dubrovnik/);
  assert.match(await p.locator('.dest').nth(1).innerText(), /Neum/);
  assert.equal(await p.locator('.tstrip li').count(), 7);
  assert.equal(await p.locator('.dest .dest-country svg.flag').count(), 2, 'zastave su nacrtane (SVG), a ne ispisane kao "HR"/"BA"');
  assert.match(await p.locator('.hero').innerText(), /10 sportskih pitanja dnevno\./);
  assert.match(await p.locator('.dest').nth(0).innerText(), /Vukovar → Dubrovnik · 1\.000 km/);
  assert.match(await p.locator('.dest').nth(0).innerText(), /Crna Gora/);
  assert.match(await p.locator('.dest').nth(0).innerText(), /0 \/ 10/);
  assert.equal(await p.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(15, 20, 26)', 'tamna tema je zadana');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'nema vodoravnog pomicanja na mobitelu');
  await shot(p, '01-naslovnica', true);
  ok('naslovnica: tamna tema, dvije karte sa zastavama, „10 sportskih pitanja dnevno.“, sedam razina prijevoza');

  await p.locator('.dest').nth(0).click();
  await p.waitForSelector('.intro .btn.primary');
  assert.match(await p.locator('.intro').innerText(), /Vukovar → Dubrovnik/);
  assert.equal(app.ctx.db.get('SELECT COUNT(*) AS n FROM game_sessions').n, 0, 'sat ne kreće prije pritiska na gumb');
  await shot(p, '02-pocetni-zaslon', true);
  await p.click('.intro .btn.primary');
  await p.waitForSelector('.aform.is-prep');
  assert.equal(await p.locator('input[name=answer]').isDisabled(), true, 'upis je zaključan tijekom pripreme');
  assert.equal(await p.locator('.abox button[type=submit]').isDisabled(), true);
  assert.match(await p.locator('.trow').innerText(), /Pripremi se/);
  assert.match(await p.locator('.qhead').innerText(), /1 \/ 10/);
  assert.ok(await p.locator('.stage .map-svg, .stage .map-gl').count() >= 1, 'karta je prikazana');
  await shot(p, '03-priprema');
  await p.waitForSelector('.aform.is-run');
  assert.equal(await p.locator('input[name=answer]').isDisabled(), false);
  assert.match(await p.locator('.clock').innerText(), /^(30|29|28) s$/);
  const dash0 = await p.evaluate(() => parseFloat(document.querySelector('.frame .ring').style.strokeDashoffset));
  ok('početni zaslon, zatim priprema: pitanje vidljivo, upis zaključan, „Pripremi se“; nakon toga 30 s za odgovor');

  // 14. 11. = Dan 2
  const answers = ['Belanov', 'TŠK Topolovac', 'Duje Dukan', 'Redbergslid', 'Evonne Goolagong', 'Maroko', 'hrgovic', '3000', 'Proleter Zrenjanin', '50'];
  // dvosmislen unos ne troši pitanje
  await p.fill('input[name=answer]', 'Ronaldo');
  await p.click('.abox button[type=submit]');
  await p.waitForSelector('.fmsg.warn:not([hidden])');
  assert.match(await p.locator('.fmsg').innerText(), /više osoba/);
  // netočan odgovor: ostaješ na pitanju, sat teče dalje
  await p.fill('input[name=answer]', 'Pero Perić');
  await p.click('.abox button[type=submit]');
  await p.waitForSelector('.fmsg.err:not([hidden])');
  assert.equal(await p.locator('.fmsg').innerText(), 'To nije taj odgovor. Pokušaj ponovno!');
  assert.match(await p.locator('.qhead').innerText(), /1 \/ 10/);
  assert.deepEqual(await p.locator('.misses s').allInnerTexts(), ['Pero Perić']);
  assert.equal(app.ctx.db.get('SELECT COUNT(*) AS n FROM player_answers').n, 0);
  const dash1 = await p.evaluate(() => parseFloat(document.querySelector('.frame .ring').style.strokeDashoffset));
  assert.ok(dash1 > dash0, 'okvir polja za upis nestaje kako vrijeme teče');
  await shot(p, '04-pokusaj-ponovno');
  ok('dvosmislen odgovor traži pojašnjenje; netočan: „To nije taj odgovor. Pokušaj ponovno!“, pitanje ostaje, okvir-tajmer se troši');

  // prekid veze usred pitanja: poruka o grešci, a nakon povratka veze isti odgovor prolazi
  await phone.setOffline(true);
  await p.fill('input[name=answer]', answers[0]);
  await p.click('.abox button[type=submit]');
  await p.waitForFunction(() => /Nema veze/.test(document.querySelector('.fmsg')?.innerText || ''));
  await phone.setOffline(false);
  await p.click('.abox button[type=submit]');
  await p.waitForSelector('.out.ok');
  assert.match(await p.locator('.out').innerText(), /Igor Belanov/);
  assert.match(await p.locator('.out-km').innerText(), /\+\d+/);
  assert.match(await p.locator('.hud-toast').innerText(), /Igor Belanov[\s\S]*\+\d+ km/);
  const kmMid = Number((await p.locator('.gbar > b').innerText()).replace(/\D/g, ''));
  await p.waitForTimeout(5300);                                   // animacija putovanja
  const kmEnd = Number((await p.locator('.gbar > b').innerText()).replace(/\D/g, ''));
  assert.ok(kmEnd >= kmMid && kmEnd > 0, 'brojač kilometara raste tijekom putovanja');
  assert.match(await p.locator('.hud-place').innerText(), /km od starta/);
  await shot(p, '05-ishod');
  ok('prekid veze: jasna poruka; točan odgovor: prijevoz, kilometri, obavijest na karti i animirano putovanje');

  for (let i = 1; i < 10; i++) {
    if (i === 6) {   // sedmo pitanje: samo netočni pokušaji → istek vremena
      setGame({ answer_seconds: 5 });
      await nextQuestion(p);
      setGame({ answer_seconds: 30 });
      await p.fill('input[name=answer]', 'Mirko Filipović'); await p.click('.abox button[type=submit]');
      await p.waitForSelector('.fmsg.err:not([hidden])');
      await p.waitForSelector('.aform.is-over', { timeout: 9000 });
      assert.equal(await p.locator('input[name=answer]').isDisabled(), true, 'upis je zaključan nakon isteka');
      await p.waitForSelector('.out.zero', { timeout: 6000 });
      assert.match(await p.locator('.out').innerText(), /Vrijeme je isteklo[\s\S]*\+0/);
      assert.match(await p.locator('.qhead').innerText(), /7 \/ 10/, 'nema tihog preskakanja — čeka se pritisak na „Dalje“');
      await shot(p, '06-istek-vremena');
      continue;
    }
    await nextQuestion(p);
    if (i === 7) assert.equal(await p.locator('.aform .row .btn').count(), 0, 'nema odvojenog gumba za zaključivanje procjene');
    await answer(p, answers[i]);
    await p.waitForSelector('.out');
    if (i === 7) { assert.match(await p.locator('.qarea').innerText(), /Točno:[\s\S]*golova/, 'procjena odmah pokazuje točan broj'); await shot(p, '07-procjena'); }
  }
  await p.click('.out-next .btn');
  await p.waitForSelector('.arrive');
  const total = await totalKm(p);
  assert.ok(total > 1000, `rijetki odgovori voze dalje od cilja (${total} km)`);
  assert.equal(await p.locator('.rrow').count(), 10);
  assert.equal(await p.locator('.rrow.zero').count(), 1);
  assert.match(await p.locator('main').innerText(), /Prošao si Dubrovnik i nastavio dalje/);
  assert.match(await p.locator('.arrive').innerText(), /Cilj \(Dubrovnik\) dosegnut/);
  assert.match(await p.locator('main').innerText(), /Igraš kao gost/);
  assert.equal(await p.locator('.histo .bars i').count(), 23);
  await p.locator('.rrow.zero summary').click();
  assert.match(await p.locator('.rrow.zero .rmore').innerText(), /Mirko Filipović/);
  await p.locator('.rrow.zero .linkbtn').click();
  await p.waitForFunction(() => /prijavljeno/.test(document.querySelector('.rrow.zero .rmore').innerText));
  assert.match(await p.locator('.sharecard').innerText(), /ONTALE[\s\S]*km — prošao Dubrovnik/);
  await shot(p, '08-rezultat', true);
  ok(`svih deset pitanja: istek vremena, procjena s izmjenom, rezultat ${total} km — put nastavljen iza Dubrovnika; prijava nepriznatog pokušaja`);

  // ponovno otvaranje iste karte ne nudi drugu službenu partiju
  await p.goto(base + '/igra/hr');
  await p.waitForSelector('.arrive');
  ok('druga službena partija istog dana nije moguća — otvara se rezultat');

  // ============ Registracija gosta, ljestvica, liga ============
  await p.goto(base + '/prijava');
  await p.waitForSelector('form');
  await p.locator('input').nth(0).fill('Testni Igrac');
  await p.fill('input[type=email]', 'igrac@test.hr');
  await p.fill('input[type=password]', 'lozinka123');
  await p.click('form .btn.primary');
  await p.waitForSelector('.dest');
  await p.goto(base + '/ljestvica?karta=hr');
  await p.waitForSelector('.table');
  assert.match(await p.locator('.table').first().innerText(), /Testni Igrac/);
  await shot(p, '05-ljestvica');
  ok('gost se registrira, rezultat ostaje njegov i pojavljuje se na ljestvici');

  await p.goto(base + '/lige');
  await p.waitForSelector('form');
  await p.locator('form').nth(0).locator('input').fill('Kvart protiv svih');
  await p.locator('form').nth(0).locator('button').click();
  await p.waitForSelector('.lhead');
  assert.match(await p.locator('h1').innerText(), /Kvart protiv svih/);
  const code = (await p.locator('.lhead').innerText()).match(/kod\s+([A-Z2-9]{6})/)[1];
  const leagueUrl = p.url().split('?')[0];
  assert.equal(await p.locator('.race .racer').count(), 1, 'utrka: moj položaj na vodoravnoj ruti');
  assert.match(await p.locator('.lside').innerText(), /Nagrade dana[\s\S]*Najrjeđi odgovor[\s\S]*Odgovori ekipe[\s\S]*1 \/ 10[\s\S]*Legende lige[\s\S]*Dvorana slavnih/);
  await p.click('.lside .iconbtn[aria-label="Sljedeće pitanje"]');
  assert.match(await p.locator('.lside').innerText(), /2 \/ 10/);
  await p.click('.lhead .btn.primary');
  await p.waitForSelector('dialog.invite[open]');
  assert.match(await p.locator('dialog.invite').innerText(), new RegExp(`Ontale[\\s\\S]*Kvart protiv svih[\\s\\S]*${code}[\\s\\S]*/liga/${code}[\\s\\S]*Kopiraj poveznicu[\\s\\S]*Kopiraj kod`));
  await shot(p, '06b-poziv-u-ligu');
  await p.click('dialog.invite .btn.sm');
  for (const [tab, re] of [['tjedan', /prosjek km po partiji[\s\S]*Pon[\s\S]*Ned/], ['mjesec', /km cijele ekipe/], ['ukupno', /km svih članova/], ['rendgen', /Meta za danas[\s\S]*Dvoboji[\s\S]*Ti prema ligi[\s\S]*Mjesto u ligi/]]) {
    await p.goto(`${leagueUrl}?tab=${tab}`);
    await p.waitForFunction((t) => document.querySelector('.tabs a[aria-selected="true"]')?.getAttribute('href').includes('tab=' + t), tab);
    assert.match(await p.locator('.lmain').innerText(), re, tab);
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `liga/${tab}: nema vodoravnog pomicanja`);
    if (tab === 'tjedan' || tab === 'rendgen') await shot(p, `06-liga-${tab}`, true);
  }
  await p.goto(leagueUrl); await p.waitForSelector('.lhead');
  await shot(p, '06-liga', true);
  ok(`privatna liga s pozivnim kodom (${code}) i prikazom napretka na karti`);

  // ============ Drugi igrač: BiH, ulazak u ligu poveznicom, reakcija ============
  const phone2 = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const q = await phone2.newPage(); watch(q);
  await q.goto(base + '/');
  await q.waitForSelector('.dest');
  await q.locator('.dest').nth(1).click();
  await q.waitForSelector('.intro .btn.primary');
  assert.match(await q.locator('.intro').innerText(), /Bosna i Hercegovina[\s\S]*Bijeljina → Neum/);
  setGame({ prep_seconds: 0.4 });
  await q.click('.intro .btn.primary');
  const common = ['Messi', 'Dinamo', 'Kukoč', 'Zagreb', 'Serena Williams', 'Italija', 'Tyson', '2500', 'Cibona', '45'];
  for (let i = 0; i < 10; i++) {
    await q.waitForSelector('.aform.is-run');
    await answer(q, common[i]);
    await q.waitForSelector('.out');
    await q.click('.out-next .btn');
  }
  await q.waitForSelector('.arrive');
  const total2 = await totalKm(q);
  assert.match(await q.locator('.arrive').innerText(), /Do cilja \(Neum\) još/);
  assert.ok(total2 < total, `najčešći odgovori voze kraće (${total2} < ${total})`);
  ok(`odabir BiH: zasebna partija; najčešći odgovori donose manje (${total2} km)`);
  await q.goto(base + '/liga/' + code);
  await q.waitForSelector('a.btn[href="/prijava"]');
  await q.click('a.btn[href="/prijava"]');
  await q.waitForSelector('form');
  await q.locator('input').nth(0).fill('Druga Igracica');
  await q.fill('input[type=email]', 'druga@test.hr');
  await q.fill('input[type=password]', 'lozinka123');
  await q.click('form .btn.primary');
  await q.waitForFunction(() => /Kvart protiv svih/.test(document.body.innerText) && document.querySelector('.react button'));
  await q.locator('.react button').first().click();
  await q.waitForSelector('.react button.mine');
  ok('pozivna poveznica vodi kroz registraciju ravno u ligu; reakcija na rezultat prijatelja');

  // ============ Arhiva, profil, pravila ============
  await p.goto(base + '/arhiva');
  await p.waitForSelector('.table');
  assert.equal(await p.locator('.table tr').count(), 1);
  await p.locator('.table a').first().click();
  await p.waitForSelector('.intro .btn.primary');
  assert.match(await p.locator('.intro').innerText(), /arhiva[\s\S]*ne računa se/);
  await p.click('.intro .btn.primary');
  await p.waitForSelector('.qtext');
  ok('arhiva: jučerašnji izazov je igriv kao neslužbena partija');
  await p.goto(base + '/profil');
  await p.waitForSelector('.stats');
  assert.match(await p.locator('.stats').first().innerText(), /odigranih partija/);
  await shot(p, '07-profil', true);
  await p.goto(base + '/pravila');
  await p.waitForSelector('.prose h2');
  ok('profil sa statistikom i nizom dana; pravila igre');

  // ============ Admin panel (računalo) ============
  const desk = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const a = await desk.newPage(); watch(a);
  await a.goto(base + '/admin');
  await a.waitForSelector('h1');
  assert.match(await a.locator('h1').innerText(), /Samo za administratore/);
  // običan korisnik ne dobiva ništa ni izravnim pozivom API-ja
  assert.equal((await p.request.get(base + '/api/admin/dashboard')).status(), 403);
  ok('admin panel je zatvoren za goste i obične korisnike (provjera na poslužitelju)');

  await a.goto(base + '/prijava');
  await a.waitForSelector('form');
  await a.locator('input').nth(0).fill('Urednik');
  await a.fill('input[type=email]', 'admin@ontale.eu');
  await a.fill('input[type=password]', 'lozinka123');
  await a.click('form .btn.primary');
  await a.waitForSelector('.dest');
  await a.goto(base + '/admin');
  await a.waitForSelector('.adm-main .stats');
  assert.match(await a.locator('.adm-main').innerText(), /registriranih korisnika/);
  await shot(a, '08-admin-ploca');
  ok('administrator vidi nadzornu ploču');

  await a.goto(base + '/admin#/pitanja');
  await a.waitForFunction(() => /^Pitanja/.test(document.querySelector('.adm-main h1')?.innerText || ''));
  assert.match(await a.locator('.adm-main h1').innerText(), /Pitanja \(100\)/);
  await a.locator('.adm-main .table a', { hasText: 'Zlatne lopte' }).first().click();
  await a.waitForSelector('text=Baza odgovora');
  await a.fill('input[placeholder^="Upiši odgovor kao igrač"]', 'modric');
  await a.keyboard.press('Enter');
  await a.waitForFunction(() => /Luka Modrić/.test(document.querySelector('.adm-main').innerText));
  await shot(a, '09-admin-pitanje');
  // novi odgovor u bazu
  await a.fill('input[placeholder="Kanonski naziv"]', 'Testni Dobitnik');
  await a.locator('.adm-main .btn.primary', { hasText: 'Dodaj' }).click();
  await a.waitForFunction(() => /Testni Dobitnik/.test([...document.querySelectorAll('.adm-main input')].map((i) => i.value).join('|')));
  ok('uređivanje pitanja: baza odgovora, proba prepoznavanja, dodavanje odgovora');

  await a.goto(base + '/admin#/nepoznati');
  await a.waitForFunction(() => /Nepoznati/.test(document.querySelector('.adm-main h1')?.innerText || '') && document.querySelector('.adm-main .table'));
  assert.match(await a.locator('.adm-main').innerText(), /Mirko Filipović/);
  await a.locator('.adm-main .btn.xs.primary').first().click();
  await a.waitForSelector('dialog[open]');
  await a.locator('dialog .btn.primary').click();
  await a.waitForFunction(() => !document.querySelector('dialog[open]'));
  const after = (await p.request.get(base + '/api/leaderboard?map=hr').then((r) => r.json())).rows[0].km;
  assert.ok(after > total, `odobrenje naknadno priznaje kilometre (${total} → ${after})`);
  ok(`prijavljeni odgovor odobren u adminu → rezultat igrača i ljestvica ažurirani (${total} → ${after} km)`);

  await a.goto(base + '/admin#/prijevoz');
  await a.waitForFunction(() => /Prijevozna/.test(document.querySelector('.adm-main h1')?.innerText || '') && document.querySelector('.adm-main section .table'));
  const nameInput = a.locator('.adm-main section').first().locator('tbody tr').nth(6).locator('input').nth(1);
  await nameInput.fill('Helikopter izbornika');
  await a.locator('.adm-main section').first().locator('.btn.primary').click();
  await a.waitForFunction(() => /spremljen/.test(document.querySelector('.toast')?.innerText || ''));
  assert.equal((await a.request.get(base + '/api/bootstrap').then((r) => r.json())).transports[6].name, 'Helikopter izbornika');
  ok('promjena prijevoznog sredstva u adminu odmah vrijedi u igri');

  await a.goto(base + '/admin#/karte');
  await a.waitForFunction(() => /Karte/.test(document.querySelector('.adm-main h1')?.innerText || '') && document.querySelector('.adm-main section .table'));
  const nick = a.locator('.adm-main section').first().locator('tbody tr').nth(0).locator('input').nth(1);
  await nick.fill('Start kod vodotornja');
  await a.locator('.adm-main section').first().locator('.btn.primary').click();
  await a.waitForFunction(() => /spremljena/.test(document.querySelector('.toast')?.innerText || ''));
  assert.equal((await a.request.get(base + '/api/bootstrap').then((r) => r.json())).maps[0].from.nickname, 'Start kod vodotornja');
  const routeAfter = (await a.request.get(base + '/api/map/hr').then((r) => r.json())).route;
  assert.equal(routeAfter.points[routeAfter.goal_index].name, 'Dubrovnik'); assert.equal(routeAfter.points[routeAfter.goal_index].km, 1000);
  assert.ok(routeAfter.end_km >= 2200 && routeAfter.points.at(-1).country === 'me', 'spremanje iz admina čuva cilj i nastavak rute u Crnu Goru');
  assert.match(await a.locator('.adm-main section').first().innerText(), /Kilometri igre iza cilja/);
  await shot(a, '10-admin-karte');
  ok('admin karte: izmjena naziva grada vrijedi odmah; cilj, države, granica i nastavak rute ostaju sačuvani');

  for (const [hash, text] of [['izazovi', 'Dnevni izazovi'], ['korisnici', 'Korisnici'], ['lige', 'Lige i prijave'], ['postavke', 'Postavke'], ['dnevnik', 'Dnevnik izmjena']]) {
    await a.goto(base + '/admin#/' + hash);
    await a.waitForFunction((t) => document.querySelector('.adm-main h1')?.innerText.includes(t), text);
  }
  await a.goto(base + '/admin#/izazovi');
  await a.waitForSelector('.adm-main .table a');
  await a.locator('.adm-main .table a').first().click();
  await a.waitForSelector('.slot');
  assert.equal(await a.locator('.slot').count(), 10);
  await shot(a, '11-admin-izazov');
  ok('ostale admin stranice: izazovi (10 pitanja), korisnici, lige, postavke, dnevnik');

  // postavke tijeka igre
  await a.goto(base + '/admin#/postavke');
  await a.waitForFunction(() => /Tijek igre/.test(document.querySelector('.adm-main')?.innerText || ''));
  const gameInputs = a.locator('.adm-main h2:has-text("Tijek igre") + .panel input[type=number]');
  assert.equal(await gameInputs.nth(0).inputValue(), '10');
  await gameInputs.nth(2).fill('25');
  await a.locator('.savebar .btn.primary').click();
  await a.waitForFunction(() => /spremljene/.test(document.querySelector('.toast')?.innerText || ''));
  assert.equal((await a.request.get(base + '/api/bootstrap').then((r) => r.json())).game.answer_seconds, 25);
  setGame({ answer_seconds: 30 });
  await a.goto(base + '/admin#/kvaliteta');
  await a.waitForFunction(() => /Kvaliteta sadržaja/.test(document.querySelector('.adm-main h1')?.innerText || ''));
  assert.match(await a.locator('.adm-main').innerText(), /100\s*pitanja \(80 otvorenih, 20 procjena\)/);
  await shot(a, '12-admin-kvaliteta', true);
  await a.goto(base + '/admin#/prijevoz');
  await a.waitForSelector('.adm-main details.preview');
  await a.locator('.adm-main details.preview summary').first().click();
  assert.equal(await a.locator('.adm-main details.preview').first().locator('.pv-strip > span').count(), 7);
  await shot(a, '13-admin-prijevoz-pregled');
  ok('admin: trajanje odgovora mijenja se u postavkama i vrijedi u igri; kvaliteta sadržaja; pregled prijevoza');

  // ============ Računalo: igra ============
  const dg = await desk.newPage(); watch(dg);
  await dg.goto(base + '/igra/ba');
  await dg.waitForSelector('.intro .btn.primary');
  await shot(dg, '14-pocetni-zaslon-racunalo', true);
  await dg.click('.intro .btn.primary');
  await dg.waitForSelector('.aform.is-run');
  const boxW = await dg.evaluate(() => document.querySelector('.abox').getBoundingClientRect().width);
  assert.ok(boxW <= 640, `polje za odgovor nije razvučeno preko cijelog zaslona (${Math.round(boxW)} px)`);
  await answer(dg, 'Luis Suárez');
  await dg.waitForSelector('.out');
  await dg.waitForTimeout(4500);
  await shot(dg, '15-igra-racunalo');
  ok('računalo: karta gore, pitanje ispod u središnjem stupcu, polje za odgovor ograničene širine');

  // ============ Računalo: naslovnica ============
  const d = await desk.newPage(); watch(d);
  await d.goto(base + '/');
  await d.waitForSelector('.dest');
  assert.match(await d.locator('.cats.one').innerText(), /Borilački/); assert.equal(/Borilački sportovi/.test(await d.locator('.cats.one').innerText()), false, 'desktop: skraćeni naziv Borilački');
  assert.equal(await d.evaluate(() => { const e = document.querySelector('.cats.one'); return e.scrollWidth > e.clientWidth + 1; }), false, 'desktop: kategorije u jednom redu');
  await shot(d, '16-naslovnica-racunalo', true);

  // ============ Responzivnost: nema vodoravnog prelijevanja ni na jednoj širini ============
  const leaguePath = new URL(leagueUrl).pathname;
  for (const width of [375, 390, 430, 768, 1024, 1440]) {
    await p.setViewportSize({ width, height: 900 });
    for (const pathn of ['/', leaguePath, leaguePath + '?tab=tjedan', leaguePath + '?tab=rendgen', '/ljestvica', '/profil', '/arhiva', '/lige']) {
      await p.goto(base + pathn);
      await p.waitForSelector('main h1, main .dest');
      await p.waitForTimeout(150);
      const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(over <= 0, `${pathn} na ${width} px prelijeva za ${over} px`);
    }
    if (width === 375 || width === 1440) { await p.goto(base + leaguePath + '?tab=tjedan'); await p.waitForSelector('.lhead'); await shot(p, `17-liga-${width}`, true); }
  }
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto(base + '/'); await p.waitForSelector('.cats.one');
  assert.equal(await p.locator('.cats.one > span').count(), 7);
  assert.deepEqual(await p.locator('.cats.one > span').allInnerTexts().then((x) => x.filter((t) => /×/.test(t))), [], 'kategorije bez brojača ×2/×3');
  const catsOne = (page) => page.evaluate(() => { const e = document.querySelector('.cats.one'); return e.scrollWidth > e.clientWidth + 1; });
  assert.equal(await catsOne(p), false, 'mobitel: kategorije u jednom redu bez trake za pomicanje');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.equal(/Stao si kod/.test(await p.locator('main').innerText()), false);
  assert.match(await p.locator('.dest-at').first().innerText(), /📍/);
  assert.equal(await p.locator('.logo').first().innerText(), 'Ontale');
  ok('responzivnost na 375, 390, 430, 768, 1024 i 1440 px (naslovnica, liga i sve kartice, ljestvica, profil, arhiva); naslovnica: kategorije u nizu, grad dolaska, logotip Ontale');

  assert.deepEqual(errors, [], 'bez JavaScript grešaka u pregledniku');
  ok('nijedna JavaScript greška u pregledniku tijekom cijelog prolaza');
  console.log(`\nE2E: svih ${step} koraka je prošlo. Snimke zaslona: test/snimke/`);
} catch (e) {
  console.error('\nE2E PAO:', e.message);
  if (errors.length) console.error('Greške u pregledniku:\n  ' + errors.join('\n  '));
  process.exitCode = 1;
} finally {
  await browser.close();
  await app.close();
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
}
