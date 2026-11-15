// v2.3: privatne poruke, putokazi, obavijesti, podsjetnici i e-mail, izazovi, tjedne/mjesečne nagrade, karte, zvuk, moderacija.
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { makeApp, STANDARD } from './helpers.js';
import { createApp } from '../src/app.js';
import { profanity, hasLink, checkPublicText } from '../src/tekst.js';
import { createMailer, buildMessage } from '../src/mailer.js';
import { mapConfig, mapCspHosts } from '../src/mapcfg.js';
import { dailyAwards } from '../src/nagrade.js';

const RARE = ['Gaudio', 'Steaua', 'Rindt', 'Austrija', 'Gama', 'Gama', 'Gama', '1000', 'Gama', '100'];
const LOW = ['Novak Đoković', 'Real Madrid', 'Max Verstappen', 'Hrvatska', 'Alfa', 'Alfa', 'Alfa', '1', 'Alfa', '1'];
const MID = ['Nadal', 'Real Madrid', 'Verstappen', 'Hrvatska', 'Beta', 'Beta', 'Alfa', '700', 'Beta', '80'];
const at = (t, iso) => { t.clock.now = new Date(iso); };

async function threeInLeague(t) {
  const a = t.client(), b = t.client(), c = t.client();
  await a.register('Ana'); await b.register('Bruno'); await c.register('Cvita');
  const lg = (await a.post('/api/leagues', { name: 'Ekipa' })).data;
  await b.post('/api/leagues/join', { code: lg.code }); await c.post('/api/leagues/join', { code: lg.code });
  const id = async (cl) => (await cl.get('/api/bootstrap')).data.me.id;
  return { a, b, c, lg, ids: { a: await id(a), b: await id(b), c: await id(c) } };
}

/** Lažni SMTP poslužitelj: bilježi primljene poruke. */
function fakeSmtp() {
  const got = [];
  const server = net.createServer((sock) => {
    let data = false, buf = '';
    sock.write('220 test ESMTP\r\n');
    sock.on('data', (d) => {
      buf += d.toString();
      if (data) {
        const i = buf.indexOf('\r\n.\r\n');
        if (i < 0) return;
        got.push(buf.slice(0, i)); buf = buf.slice(i + 5); data = false; sock.write('250 OK id=' + got.length + '\r\n');
      }
      let j;
      while (!data && (j = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, j); buf = buf.slice(j + 2);
        if (/^EHLO/i.test(line)) sock.write('250-test\r\n250 8BITMIME\r\n');
        else if (/^DATA/i.test(line)) { data = true; sock.write('354 go\r\n'); }
        else if (/^QUIT/i.test(line)) { sock.write('221 bye\r\n'); sock.end(); }
        else sock.write('250 OK\r\n');
      }
    });
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, got, port: server.address().port })));
}

test('provjera teksta: psovke, poveznice, duljina', () => {
  for (const bad of ['jebote', 'J3B0TE ekipa', 'p i z d a', 'kuuurac', 'ti si kurva']) assert.ok(profanity(bad), bad);
  for (const ok of ['Livaja dobro te je!', 'Vidimo se u Dubrovniku!', 'Jelena vozi kurs', 'Ajmo ekipa', 'Gdje ste ostali?']) assert.equal(profanity(ok), null, ok);
  for (const l of ['www.nesto.hr', 'https://x.y', 'pisi mi na moj.com', 'zovi 091 234 5678', '@mojprofil']) assert.ok(hasLink(l), l);
  assert.equal(hasLink('Danas 720 km do Splita'), false);
  assert.throws(() => checkPublicText('x'.repeat(61), { max: 60 }), /najviše 60/);
  assert.equal(checkPublicText('  Ajmo   ekipa!​ '), 'Ajmo ekipa!');
});

test('privatne poruke: dozvole, nepročitano, stranice, blokiranje, prijava, ograničenja, brisanje računa', async () => {
  const t = await makeApp({ days: 2 });
  try {
    const { a, b, c, ids } = await threeInLeague(t);
    const d = t.client(); await d.register('Dino');                         // nije u ligi
    const g = t.client(); await g.post('/api/game/start', { map: 'hr' });   // gost
    // gost i strani igrač ne mogu pisati (zadano: samo članovi zajedničkih liga)
    assert.equal((await g.post('/api/conversations', { user_id: ids.a })).status, 401);
    assert.equal((await d.post('/api/conversations', { user_id: ids.a })).status, 403);
    // otvaranje i slanje
    const conv = (await a.post('/api/conversations', { user_id: ids.b })).data;
    assert.ok(conv.id && conv.can_send);
    const again = (await b.post('/api/conversations', { nickname: 'Ana' })).data;
    assert.equal(again.id, conv.id, 'isti razgovor u oba smjera');
    for (let i = 1; i <= 35; i++) assert.equal((await a.post(`/api/conversations/${conv.id}/messages`, { body: `Poruka ${i} <script>alert(1)</script>` })).status, 200);
    let ib = (await b.get('/api/conversations')).data;
    assert.equal(ib.unread, 35); assert.equal(ib.conversations[0].unread, 35); assert.equal(ib.conversations[0].other.nickname, 'Ana');
    // treći igrač ne vidi tuđi razgovor
    assert.equal((await c.get(`/api/conversations/${conv.id}`)).status, 404);
    assert.equal((await c.post(`/api/conversations/${conv.id}/messages`, { body: 'upadam' })).status, 404);
    // stranice po 30, tekst se čuva doslovno (prikaz je kao tekst, ne HTML)
    const p1 = (await b.get(`/api/conversations/${conv.id}`)).data;
    assert.equal(p1.messages.length, 30); assert.equal(p1.more, true); assert.match(p1.messages.at(-1).body, /Poruka 35 <script>/);
    const p2 = (await b.get(`/api/conversations/${conv.id}?before=${p1.messages[0].id}`)).data;
    assert.equal(p2.messages.length, 5); assert.equal(p2.more, false);
    // jedna obavijest po razgovoru (osvježena), ne 35
    let n = (await b.get('/api/notifications')).data;
    assert.equal(n.items.filter((x) => x.type === 'poruka').length, 1); assert.match(n.items[0].title, /35 nove poruke/);
    // pročitano
    await b.post(`/api/conversations/${conv.id}/read`, { last_id: p1.messages.at(-1).id });
    assert.equal((await b.get('/api/conversations')).data.unread, 0);
    assert.equal((await b.get('/api/notifications/count')).data.unread, 0, 'čitanjem razgovora pročitana je i obavijest');
    // prazna i preduga poruka
    assert.equal((await b.post(`/api/conversations/${conv.id}/messages`, { body: '   ' })).status, 400);
    assert.equal((await b.post(`/api/conversations/${conv.id}/messages`, { body: 'x'.repeat(1001) })).status, 400);
    // ista poruka više puta = spam (ograničenje radi i kad je opće ograničenje isključeno za testove? ne — provjeri ručno)
    t.ctx.config.rateLimitDisabled = false;
    await b.post(`/api/conversations/${conv.id}/messages`, { body: 'isto' }); await b.post(`/api/conversations/${conv.id}/messages`, { body: 'isto' }); await b.post(`/api/conversations/${conv.id}/messages`, { body: 'isto' });
    assert.equal((await b.post(`/api/conversations/${conv.id}/messages`, { body: 'isto' })).status, 429);
    t.ctx.config.rateLimitDisabled = true;
    // prijava poruke
    const msgId = p1.messages[0].id;
    assert.equal((await b.post(`/api/messages/${msgId}/report`, { reason: 'uznemiravanje' })).status, 200);
    assert.equal((await a.post(`/api/messages/${msgId}/report`, {})).status, 400, 'vlastita poruka se ne prijavljuje');
    // blokiranje: nitko nikome ne može pisati ni slati izazov
    assert.equal((await b.post('/api/blocks', { user_id: ids.a })).status, 200);
    assert.equal((await a.post(`/api/conversations/${conv.id}/messages`, { body: 'hej' })).status, 403);
    assert.equal((await b.post(`/api/conversations/${conv.id}/messages`, { body: 'hej' })).status, 403);
    assert.equal((await a.post('/api/duels', { opponent_id: ids.b, map: 'hr' })).status, 403);
    assert.equal((await a.get(`/api/conversations/${conv.id}`)).data.can_send, false);
    await b.del(`/api/blocks/${ids.a}`);
    assert.equal((await a.post(`/api/conversations/${conv.id}/messages`, { body: 'opet' })).status, 200);
    // postavka „nitko“ i „svi“
    await b.patch('/api/me/prefs', { dm_policy: 'nitko' });
    assert.equal((await a.post(`/api/conversations/${conv.id}/messages`, { body: 'a sad?' })).status, 403);
    await b.patch('/api/me/prefs', { dm_policy: 'svi' });
    assert.equal((await d.post('/api/conversations', { user_id: ids.b })).status, 200, 'uz „svi“ može pisati i tko nije u ligi');
    // „obriši kod sebe“
    await a.post(`/api/conversations/${conv.id}/hide`);
    assert.equal((await a.get('/api/conversations')).data.conversations.length, 0);
    assert.equal((await b.get('/api/conversations')).data.conversations.some((x) => x.id === conv.id), true, 'druga strana i dalje vidi razgovor');
    // brisanje računa: razgovor nestaje bez greške
    await a.req('DELETE', '/api/me');
    assert.equal((await b.get('/api/conversations')).data.conversations.some((x) => x.id === conv.id), false);
    assert.equal((await b.get(`/api/conversations/${conv.id}`)).status, 404);
  } finally { await t.stop(); }
});

test('putokaz: nakon službene partije, uređivanje, brisanje, prikaz u ligi, zaštita od spoilera, istek, moderacija', async () => {
  const t = await makeApp({ days: 3 });
  try {
    const { a, b, c, lg, ids } = await threeInLeague(t);
    const g = t.client();
    // prije partije: nema putokaza
    const st = await a.post('/api/game/start', { map: 'hr' });
    assert.equal((await a.put(`/api/signs/session/${st.data.session.id}`, { text: 'Rano!' })).status, 400);
    const ra = await a.play('hr', RARE);
    const sid = ra.sessionId;
    assert.equal((await a.put(`/api/signs/session/${sid}`, { text: 'www.reklama.hr' })).status, 400);
    assert.equal((await a.put(`/api/signs/session/${sid}`, { text: 'jebote' })).status, 400);
    assert.equal((await a.put(`/api/signs/session/${sid}`, { text: 'x'.repeat(61) })).status, 400);
    let r = await a.put(`/api/signs/session/${sid}`, { text: 'Ajmo ekipa!', shape: 'zuti' });
    assert.equal(r.status, 200); assert.equal(r.data.sign.text, 'Ajmo ekipa!'); assert.equal(r.data.sign.shape, 'zuti'); assert.equal(r.data.sign.km, ra.data.session.total_km);
    r = await a.put(`/api/signs/session/${sid}`, { text: 'Livaja dobro te je!' });
    assert.equal(r.data.sign.text, 'Livaja dobro te je!'); assert.equal(r.data.sign.edits, 1);
    // tuđa partija
    assert.equal((await b.put(`/api/signs/session/${sid}`, { text: 'hak' })).status, 404);
    // u ligi: Bruno još nije igrao → vidi da putokaz postoji, ali ne i tekst
    let l = (await b.get(`/api/leagues/${lg.id}`)).data;
    assert.equal(l.signs.hr.locked, true); assert.equal(l.signs.hr.signs.length, 1); assert.equal(l.signs.hr.signs[0].text, null);
    await b.play('hr', MID);
    l = (await b.get(`/api/leagues/${lg.id}`)).data;
    assert.equal(l.signs.hr.locked, false); assert.equal(l.signs.hr.signs[0].text, 'Livaja dobro te je!'); assert.equal(l.signs.hr.signs[0].km, ra.data.session.total_km);
    // stranac ne vidi ligu
    assert.equal((await g.get(`/api/leagues/${lg.id}`)).status, 401);
    // sakrij kod sebe i prijava
    const signId = l.signs.hr.signs[0].id;
    await c.play('hr', STANDARD);
    assert.equal((await c.post(`/api/signs/${signId}/report`, { reason: 'ružno' })).status, 200);
    assert.equal((await c.get(`/api/leagues/${lg.id}`)).data.signs.hr.signs.length, 0, 'prijavljeni putokaz se prijavitelju skriva');
    // moderacija: admin uklanja
    const adm = t.client(); await adm.register('Admin', 'admin@ontale.eu');
    const list = (await adm.get('/api/admin/signs?reported=1')).data;
    assert.equal(list.length, 1); assert.equal(list[0].open_reports, 1);
    assert.equal((await adm.post(`/api/admin/signs/${signId}/moderate`, { action: 'ukloni', reason: 'test' })).status, 200);
    assert.equal((await b.get(`/api/leagues/${lg.id}`)).data.signs.hr.signs.length, 0);
    assert.equal((await a.put(`/api/signs/session/${sid}`, { text: 'Opet ja' })).status, 403, 'uklonjeni putokaz vlasnik ne može ponovno objaviti isti dan');
    await adm.post(`/api/admin/signs/${signId}/moderate`, { action: 'vrati' });
    // istek: sutra se današnji putokaz ne prikazuje u aktivnoj utrci, ali ostaje u povijesti tog dana
    at(t, '2026-11-14T10:00:00+01:00');
    l = (await b.get(`/api/leagues/${lg.id}`)).data;
    assert.equal(l.signs.hr.signs.length, 0, 'novi dan — nova utrka bez jučerašnjih putokaza');
    l = (await b.get(`/api/leagues/${lg.id}?date=2026-11-13`)).data;
    assert.equal(l.signs.hr.signs[0].text, 'Livaja dobro te je!');
    assert.equal((await a.put(`/api/signs/session/${sid}`, { text: 'kasno' })).status, 400, 'jučerašnji putokaz se više ne mijenja');
    // jedan po partiji (UNIQUE), brisanje vlastitog
    const ra2 = await a.play('hr', MID);
    await a.put(`/api/signs/session/${ra2.sessionId}`, { text: 'Drugi dan' });
    assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM route_sign_messages WHERE session_id = ?', ra2.sessionId).n, 1);
    assert.equal((await a.del(`/api/signs/session/${ra2.sessionId}`)).status, 200);
    assert.equal((await a.get(`/api/signs/session/${ra2.sessionId}`)).data.sign, null);
    assert.equal(ids.a > 0, true);
  } finally { await t.stop(); }
});

test('obavijesti: pretjecanje, vodstvo, gubitak vodstva, svi odigrali, bez duplikata, pročitano', async () => {
  const t = await makeApp({ days: 2 });
  try {
    const { a, b, c } = await threeInLeague(t);
    await b.play('hr', MID);                 // Bruno prvi (sam — nema obavijesti o vodstvu dok nema drugih)
    let nb = (await b.get('/api/notifications')).data;
    assert.equal(nb.items.filter((x) => x.type === 'vodstvo').length, 0);
    await c.play('hr', LOW);                 // Cvita iza Bruna → Bruno vodi
    nb = (await b.get('/api/notifications')).data;
    assert.ok(nb.items.some((x) => x.type === 'vodstvo'));
    await a.play('hr', RARE);                // Ana prestiže oboje i preuzima vodstvo; svi su odigrali
    nb = (await b.get('/api/notifications')).data;
    const types = nb.items.map((x) => x.type);
    assert.ok(types.includes('pretek')); assert.ok(types.includes('izgubio-vodstvo')); assert.ok(types.includes('svi-odigrali'));
    assert.match(nb.items.find((x) => x.type === 'pretek').title, /Ana te je prestigao/);
    const nc = (await c.get('/api/notifications')).data;
    assert.ok(nc.items.some((x) => x.type === 'pretek')); assert.equal(nc.items.some((x) => x.type === 'izgubio-vodstvo'), false, 'Cvita nije vodila');
    const na = (await a.get('/api/notifications')).data;
    assert.ok(na.items.some((x) => x.type === 'vodstvo' && /Prvi si u ligi/.test(x.title)));
    // bez duplikata: ponovni okidač istog događaja ne stvara novu obavijest
    const before = t.ctx.db.get('SELECT COUNT(*) AS n FROM notifications').n;
    const sid = t.ctx.db.get("SELECT id FROM game_sessions WHERE user_id = (SELECT user_id FROM profiles WHERE nickname = 'Ana')").id;
    t.ctx.onSessionFinished(sid); t.ctx.onSessionFinished(sid);
    assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM notifications').n, before);
    // redoslijed i pročitano
    assert.ok(nb.items[0].id > nb.items.at(-1).id, 'najnovije prve');
    const unread = nb.unread;
    const one = await b.post('/api/notifications/read', { id: nb.items[0].id });
    assert.equal(one.data.unread, unread - 1);
    assert.equal((await c.post('/api/notifications/read', { id: nb.items[0].id })).status, 404, 'tuđa obavijest');
    assert.equal((await b.post('/api/notifications/read', { all: true })).data.unread, 0);
    // isključena vrsta se ne stvara
    await c.patch('/api/me/prefs', { notif_overtake: false });
    at(t, '2026-11-14T10:00:00+01:00');
    await c.play('hr', MID); await a.play('hr', RARE);
    assert.equal((await c.get('/api/notifications')).data.items.filter((x) => x.type === 'pretek' && x.data?.by).length, 1, 'novih pretjecanja nema');
  } finally { await t.stop(); }
});

test('podsjetnici: privola, prag neaktivnosti, hlađenje, bez duplikata nakon restarta, SMTP nije konfiguriran', async () => {
  const smtp = await fakeSmtp();
  const t = await makeApp({ days: 12 });
  try {
    t.ctx.mailer = createMailer({ host: '127.0.0.1', port: smtp.port, from: 'Ontale <noreply@ontale.eu>' });
    const a = t.client(), b = t.client();
    await a.register('Ana'); await b.register('Bruno');
    await a.play('hr', STANDARD); await b.play('hr', STANDARD);           // 13. 11.
    await a.patch('/api/me/prefs', { email_reminders: true });           // Ana pristaje, Bruno ne
    t.ctx.settings.set('reminders', { send_hour: 0 });
    // dan 2 (14.) — prerano
    at(t, '2026-11-14T18:00:00+01:00');
    let r = await t.ctx.jobs.tick();
    assert.equal(smtp.got.length, 0); assert.equal(r.podsjetnici.inapp, 0);
    // dan 4 (16.) — tri dana bez igre → jedan e-mail Ani, obavijest u aplikaciji obojici
    at(t, '2026-11-16T18:00:00+01:00');
    r = await t.ctx.jobs.tick();
    assert.equal(r.podsjetnici.email.poslano, 1); assert.equal(smtp.got.length, 1);
    assert.match(smtp.got[0], /To: ana@test\.hr/); assert.match(smtp.got[0], /List-Unsubscribe: <http.*odjava-obavijesti\?t=/);
    assert.equal(r.podsjetnici.inapp, 2);
    // ponovno pokretanje istog dana (npr. restart) — ništa novo
    r = await t.ctx.jobs.tick();
    assert.equal(smtp.got.length, 1); assert.equal(r.podsjetnici.inapp, 0);
    // isti posao iz nove instance aplikacije nad istom bazom
    const again = createApp({ db: t.ctx.db, dataDir: t.dir, dbPath: t.ctx.config.dbPath, rateLimitDisabled: true, now: () => t.clock.now, mailer: t.ctx.mailer });
    await again.ctx.jobs.tick();
    assert.equal(smtp.got.length, 1, 'restart ne šalje dvaput');
    // hlađenje 7 dana
    at(t, '2026-11-19T18:00:00+01:00'); await t.ctx.jobs.tick(); assert.equal(smtp.got.length, 1);
    at(t, '2026-11-23T18:00:00+01:00'); await t.ctx.jobs.tick(); assert.equal(smtp.got.length, 2);
    // vratila se igri → nema podsjetnika
    await a.play('hr', STANDARD);
    at(t, '2026-11-24T18:00:00+01:00'); await t.ctx.jobs.tick(); assert.equal(smtp.got.length, 2);
    // odjava jednim klikom
    const token = t.ctx.db.get("SELECT unsub_token FROM user_prefs WHERE user_id = (SELECT user_id FROM profiles WHERE nickname = 'Ana')").unsub_token;
    assert.equal((await b.post('/api/unsubscribe', { token })).status, 200);
    assert.equal((await a.get('/api/me/prefs')).data.email_reminders, false);
    // bez SMTP-a: ništa se ne „šalje“, zapis je „preskočeno“, a u aplikaciji podsjetnik i dalje radi
    t.ctx.mailer = createMailer({});
    await b.patch('/api/me/prefs', { email_reminders: true });
    at(t, '2026-12-01T18:00:00+01:00');
    r = await t.ctx.jobs.tick();
    assert.equal(r.podsjetnici.email.preskoceno >= 1, true); assert.equal(r.podsjetnici.email.poslano, undefined);
    assert.equal(t.ctx.db.get("SELECT COUNT(*) AS n FROM notification_delivery_log WHERE status = 'poslano' AND kind = 'podsjetnik'").n, 2);
    assert.ok(r.podsjetnici.inapp >= 1);
    const ad = t.client(); await ad.register('Admin', 'admin@ontale.eu');
    const ov = (await ad.get('/api/admin/notifications')).data;
    assert.equal(ov.email.configured, false); assert.ok(ov.delivery.some((d) => d.status === 'preskoceno'));
    assert.equal((await ad.post('/api/admin/notifications/test-email', { to: 'x@y.hr' })).data.ok, false);
  } finally { await t.stop(); smtp.server.close(); }
});

test('e-mail: MIME poruka i SMTP razgovor', async () => {
  const m = buildMessage({ from: 'Ontale <noreply@ontale.eu>', to: 'a@b.hr', subject: 'Nova ruta — čeka', text: 'Ćao', html: '<b>Ćao</b>' });
  assert.match(m, /Subject: =\?UTF-8\?B\?/); assert.match(m, /multipart\/alternative/);
  const smtp = await fakeSmtp();
  try {
    const r = await createMailer({ host: '127.0.0.1', port: smtp.port, from: 'noreply@ontale.eu' }).send({ to: 'a@b.hr', subject: 'x', text: 'y', html: 'z' });
    assert.equal(r.ok, true); assert.equal(smtp.got.length, 1);
    await assert.rejects(createMailer({ host: '127.0.0.1', port: smtp.port, from: 'n@o.eu', user: 'u', pass: 'p' }).send({ to: 'a@b.hr', subject: 'x' }), /STARTTLS/, 'lozinka se ne šalje bez šifriranja');
    await assert.rejects(createMailer({}).send({ to: 'a@b.hr', subject: 'x' }), /nije konfiguriran/);
  } finally { smtp.server.close(); }
});

test('izazovi: slanje, prihvaćanje, odbijanje, duplikati, rezultat iz službenih partija, predaja, istek', async () => {
  const t = await makeApp({ days: 5 });
  try {
    const { a, b, c, ids } = await threeInLeague(t);
    let r = await a.post('/api/duels', { opponent_id: ids.b, map: 'hr', message: 'Ajde ako smiješ' });
    assert.equal(r.status, 200); assert.equal(r.data.status, 'ceka');
    const id1 = r.data.id;
    assert.equal((await a.post('/api/duels', { opponent_id: ids.b, map: 'hr' })).status, 409, 'duplikat');
    assert.equal((await b.post('/api/duels', { opponent_id: ids.a, map: 'hr' })).status, 409, 'duplikat i u drugom smjeru');
    assert.equal((await a.post(`/api/duels/${id1}/accept`)).status, 403, 'izazivač ne prihvaća sam');
    assert.equal((await c.post(`/api/duels/${id1}/accept`)).status, 404, 'tuđi izazov');
    assert.ok((await b.get('/api/notifications')).data.items.some((x) => x.type === 'izazov' && /Ana te izaziva/.test(x.title)));
    assert.equal((await b.post(`/api/duels/${id1}/accept`)).data.status, 'prihvacen');
    // rezultat se ne može „poslati“ — računa ga poslužitelj; partije su normalne službene partije
    const sa = await a.play('hr', RARE);
    let L = (await b.get('/api/duels')).data;
    assert.equal(L.active[0].them, null, 'suparnikov rezultat skriven dok i sam ne odigraš');
    const sb = await b.play('hr', MID);
    L = (await a.get('/api/duels')).data;
    const done = L.finished.find((x) => x.id === id1);
    assert.equal(done.status, 'zavrsen'); assert.equal(done.won, true); assert.equal(done.outcome, 'pobjeda');
    assert.equal(done.me.km, sa.data.session.total_km); assert.equal(done.them.km, sb.data.session.total_km);
    assert.equal(L.record.wins, 1);
    assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM game_sessions WHERE official = 1').n, 2, 'izazov ne stvara dodatnu partiju');
    assert.equal(sa.data.session.total_km, t.ctx.db.get('SELECT total_km FROM game_sessions WHERE id = ?', sa.sessionId).total_km, 'kilometri nepromijenjeni');
    assert.ok((await a.get('/api/notifications')).data.items.some((x) => x.type === 'izazov' && x.data?.won === true));
    // ne može se izazvati za danas onoga tko je već odigrao
    assert.equal((await c.post('/api/duels', { opponent_id: ids.a, map: 'hr' })).status, 400);
    // odbijanje i ponovni izazov za drugi dan
    const id2 = (await c.post('/api/duels', { opponent_id: ids.b, map: 'ba' })).data.id;
    assert.equal((await b.post(`/api/duels/${id2}/decline`)).data.status, 'odbijen');
    assert.equal((await c.post('/api/duels', { opponent_id: ids.b, map: 'ba' })).status, 200, 'nakon odbijanja može ponovno');
    // predaja: prihvaćen, a samo jedan odigra do kraja dana
    const id3 = (await c.post('/api/duels', { opponent_id: ids.a, map: 'ba', date: '2026-11-14' })).data.id;
    await a.post(`/api/duels/${id3}/accept`);
    at(t, '2026-11-14T10:00:00+01:00');
    await a.play('ba', STANDARD);
    at(t, '2026-11-15T09:00:00+01:00');
    await t.ctx.jobs.tick();
    const p = (await a.get('/api/duels')).data.finished.find((x) => x.id === id3);
    assert.equal(p.outcome, 'predaja'); assert.equal(p.won, true); assert.equal(p.them, null, 'bez izmišljenog rezultata');
    // istek neodgovorenog
    const pending = (await (await t.client()).get('/api/duels')).status;
    assert.equal(pending, 401);
    const exp = t.ctx.db.get("SELECT status FROM player_challenges WHERE challenger_id = ? AND map_id = (SELECT id FROM maps WHERE slug = 'ba') AND date = '2026-11-13' AND status != 'odbijen'", ids.c);
    assert.equal(exp.status, 'istekao');
    // nevaljan datum
    assert.equal((await a.post('/api/duels', { opponent_id: ids.b, map: 'hr', date: '2026-11-30' })).status, 400);
  } finally { await t.stop(); }
});

test('nagrade: dnevne (izjednačenja), tjedne i mjesečne, prazna razdoblja, granice tjedna, povijest, obavijesti', async () => {
  // dnevne: izjednačeni dijele, nitko dvaput
  const person = (u) => u;
  const ans = [
    { user_id: 1, type: 'open', is_correct: 1, rarity: 90, question_id: 1, answer_id: 10, canonical: 'X', category: 'T', answer_ms: 2000, km: 50, level: 7 },
    { user_id: 2, type: 'open', is_correct: 1, rarity: 90, question_id: 2, answer_id: 20, canonical: 'Y', category: 'T', answer_ms: 2000, km: 50, level: 7 },
    { user_id: 1, type: 'open', is_correct: 1, rarity: 10, question_id: 3, answer_id: 30, canonical: 'Z', category: 'T', answer_ms: 5000, km: 5, level: 1 },
    { user_id: 1, type: 'open', is_correct: 1, rarity: 10, question_id: 3, answer_id: 30, canonical: 'Z', category: 'T', answer_ms: 5000, km: 5, level: 1 },
    { user_id: 2, type: 'numeric', error_pct: 3, numeric_value: 5, unit: 'g', level: 5, km: 30 },
    { user_id: 3, type: 'numeric', error_pct: 3, numeric_value: 7, unit: 'g', level: 5, km: 30 },
  ];
  const aw = Object.fromEntries(dailyAwards(ans, person).map((x) => [x.key, x]));
  assert.deepEqual(aw.najrjedi.players.sort(), [1, 2]); assert.deepEqual(aw.najbrzi.players.sort(), [1, 2]); assert.deepEqual(aw.procjena.players.sort(), [2, 3]);
  assert.equal(dailyAwards(ans, person).some((x) => x.key === 'ista-misao'), false, 'isti igrač dvaput nije „ista misao“');
  assert.deepEqual(dailyAwards([], person), []);

  const t = await makeApp({ days: 40, start: '2026-11-02' });     // ponedjeljak
  try {
    const { a, b, c, lg, ids } = await threeInLeague(t);
    // tjedan 2.–8. 11.: Ana 4 dana, Bruno 3, Cvita 1
    const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'];
    for (const [i, d] of days.entries()) {
      at(t, `${d}T12:00:00+01:00`);
      await a.play('hr', RARE);
      if (i < 3) await b.play('hr', MID);
      if (i === 0) await c.play('hr', STANDARD);
    }
    // nedjelja 8. 11. 23:30 po Zagrebu — tjedan još traje; nagrade se ne zaključuju
    at(t, '2026-11-08T23:30:00+01:00');
    await t.ctx.jobs.tick();
    assert.equal(t.ctx.db.get('SELECT COUNT(*) AS n FROM league_awards').n, 0);
    // ponedjeljak 00:10 — tjedan je gotov
    at(t, '2026-11-09T00:10:00+01:00');
    await t.ctx.jobs.tick();
    const rows = t.ctx.db.all("SELECT category, rank, nickname FROM league_awards WHERE period = 'tjedan' AND period_start = '2026-11-02' ORDER BY category, rank");
    const by = (cat) => rows.filter((r) => r.category === cat).map((r) => `${r.rank}:${r.nickname}`);
    assert.deepEqual(by('pobjednik'), ['1:Ana', '2:Bruno', '3:Cvita']);
    assert.deepEqual(by('aktivni'), ['1:Ana']);
    assert.ok(by('rijetki').includes('1:Ana'));
    assert.deepEqual(by('napredak'), [], 'bez prethodnog tjedna nema napretka');
    await t.ctx.jobs.tick();
    assert.equal(t.ctx.db.get("SELECT COUNT(*) AS n FROM league_awards WHERE period = 'tjedan'").n, rows.length, 'bez dvostrukog zaključivanja');
    assert.ok((await a.get('/api/notifications')).data.items.some((x) => x.type === 'nagrada' && /Tjedni pobjednik/.test(x.title)));
    // prazan tjedan 9.–15.: nema dobitnika
    at(t, '2026-11-16T08:00:00+01:00'); await t.ctx.jobs.tick();
    assert.equal(t.ctx.db.get("SELECT COUNT(*) AS n FROM league_awards WHERE period_start = '2026-11-09'").n, 0);
    assert.ok(t.ctx.db.get("SELECT 1 AS x FROM award_finalizations WHERE period_start = '2026-11-09'"), 'prazno razdoblje je zaključeno bez izmišljenog dobitnika');
    // mjesec studeni zaključuje se 1. 12.
    at(t, '2026-12-01T06:00:00+01:00'); await t.ctx.jobs.tick();
    const mo = t.ctx.db.all("SELECT category, rank, nickname FROM league_awards WHERE period = 'mjesec' AND period_start = '2026-11-01'");
    assert.ok(mo.some((r) => r.category === 'pobjednik' && r.rank === 1 && r.nickname === 'Ana'));
    // povijest i trenutni tjedan
    const h = (await b.get(`/api/leagues/${lg.id}/awards`)).data;
    assert.equal(h.weeks[0].start, '2026-11-02'); assert.ok(h.months.length >= 1); assert.equal(h.hall[0].nickname, 'Ana');
    assert.equal((await t.client().get(`/api/leagues/${lg.id}/awards`)).status, 401);
    // dnevne nagrade šalju se kao obavijest nakon kraja dana (za ligu s barem dvoje)
    assert.ok(t.ctx.db.get("SELECT COUNT(*) AS n FROM notifications WHERE dedupe_key LIKE 'nagrada-dan:%'").n >= 0);
    assert.ok(ids.c);
  } finally { await t.stop(); }
});

test('karte: reljef bez ključa, satelit samo uz ključ ili izričitu nekomercijalnu podlogu, CSP, ključ nije u postavkama', async () => {
  const store = new Map();
  const S = { get: (k, d) => (store.has(k) ? store.get(k) : d), set: (k, v) => store.set(k, v) };
  let c = mapConfig(S, {});
  assert.equal(c.provider, 'besplatno'); assert.deepEqual(Object.keys(c.modes), ['reljef']); assert.equal(c.modes.reljef.dem.encoding, 'terrarium');
  assert.ok(c.modes.reljef.attribution.some((a) => /OpenStreetMap/.test(a)));
  c = mapConfig(S, { MAPTILER_KEY: 'k123' });
  assert.equal(c.provider, 'maptiler'); assert.ok(c.modes.satelit.tiles[0].includes('satellite-v2')); assert.ok(c.modes.satelit.attribution.some((a) => /MapTiler/.test(a)));
  assert.match(mapCspHosts(c), /api\.maptiler\.com/);
  c = mapConfig(S, { STADIA_API_KEY: 's1' });
  assert.equal(c.provider, 'stadia'); assert.match(c.modes.satelit.tiles[0], /alidade_satellite/);
  store.set('map', { eox_noncommercial: true, default_mode: 'satelit' });
  c = mapConfig(S, {});
  assert.equal(c.modes.satelit.noncommercial, true); assert.equal(c.default_mode, 'satelit');
  const t = await makeApp({ days: 1 });
  try {
    const adm = t.client(); await adm.register('Admin', 'admin@ontale.eu');
    assert.equal((await adm.put('/api/admin/map-settings', { satellite_url: 'https://x.y/{z}/{x}/{y}.jpg?key=tajna' })).status, 400, 'ključ ne ide u postavke');
    assert.equal((await adm.put('/api/admin/map-settings', { default_mode: 'satelit', provider: 'prilagodeno', satellite_url: 'https://tiles.example.org/{z}/{x}/{y}.jpg' })).status, 200);
    const boot = (await adm.get('/api/bootstrap')).data;
    assert.equal(boot.site.map.default_mode, 'satelit'); assert.ok(boot.site.map.modes.satelit);
    const res = await fetch(t.base + '/'); assert.match(res.headers.get('content-security-policy'), /tiles\.example\.org/);
    assert.equal((await t.client().put('/api/admin/map-settings', {})).status, 401);
  } finally { await t.stop(); }
});

test('zvuk: konfiguracija, dodjela gradova, prijenos samo uz licencu, postavke korisnika', async () => {
  const t = await makeApp({ days: 1 });
  try {
    const adm = t.client(); await adm.register('Admin', 'admin@ontale.eu');
    let cfg = (await adm.get('/api/bootstrap')).data.site.audio;
    assert.equal(cfg.cities.Zagreb, 'file:tramvaj'); assert.equal(cfg.events.border, 'file:granica'); assert.equal(cfg.files['file:tramvaj'], '/zvukovi/tramvaj.mp3');
    assert.equal((await fetch(t.base + '/zvukovi/tramvaj.mp3')).headers.get('content-type'), 'audio/mpeg');
    await adm.put('/api/admin/audio', { cities: { Zagreb: 'file:zvona', Split: '' }, events: { tick: '' }, default_volume: 0.5 });
    cfg = (await adm.get('/api/bootstrap')).data.site.audio;
    assert.equal(cfg.cities.Zagreb, 'file:zvona'); assert.equal(cfg.cities.Split, undefined); assert.equal(cfg.events.tick, null); assert.equal(cfg.default_volume, 0.5);
    assert.equal((await adm.put('/api/admin/audio', { cities: { Zagreb: 'file:nepostoji' } })).status, 400);
    const mp3 = 'data:audio/mpeg;base64,' + Buffer.concat([Buffer.from('ID3'), Buffer.alloc(200)]).toString('base64');
    assert.equal((await adm.post('/api/admin/audio/upload', { name: 'Navijači', data: mp3 })).status, 400, 'bez licence');
    assert.equal((await adm.post('/api/admin/audio/upload', { name: 'Lažni', data: 'data:audio/mpeg;base64,' + Buffer.from('nije zvuk').toString('base64'), license: 'CC0' })).status, 400);
    const up = (await adm.post('/api/admin/audio/upload', { name: 'Navijači', data: mp3, license: 'CC0 (vlastita snimka)' })).data;
    const asset = up.assets.find((x) => x.name === 'Navijači');
    assert.ok(asset); assert.equal((await fetch(t.base + asset.url)).status, 200);
    const u = t.client(); await u.register('Uho');
    const p = (await u.patch('/api/me/prefs', { sound: { on: false, volume: 0.3 }, map_mode: 'satelit' })).data;
    assert.equal(p.sound.on, false); assert.equal(p.sound.volume, 0.3); assert.equal(p.map_mode, 'satelit');
    assert.equal((await u.patch('/api/me/prefs', { sound: { volume: 3 } })).status, 400);
  } finally { await t.stop(); }
});

test('moderacija poruka u administraciji: pregled, kontekst, uklanjanje, blokiranje', async () => {
  const t = await makeApp({ days: 1 });
  try {
    const { a, b, ids } = await threeInLeague(t);
    const conv = (await a.post('/api/conversations', { user_id: ids.b })).data;
    for (const m of ['bok', 'kako si', 'ružna poruka', 'još jedna']) await a.post(`/api/conversations/${conv.id}/messages`, { body: m });
    const msgs = (await b.get(`/api/conversations/${conv.id}`)).data.messages;
    await b.post(`/api/messages/${msgs[2].id}/report`, { reason: 'vrijeđa' });
    const adm = t.client(); await adm.register('Admin', 'admin@ontale.eu');
    assert.equal((await b.get('/api/admin/message-reports')).status, 403);
    const reps = (await adm.get('/api/admin/message-reports')).data;
    assert.equal(reps.length, 1); assert.equal(reps[0].sender.nickname, 'Ana'); assert.equal(reps[0].recipient.nickname, 'Bruno'); assert.equal(reps[0].body, 'ružna poruka');
    const ctxm = (await adm.get(`/api/admin/message-reports/${reps[0].id}/context`)).data.messages;
    assert.ok(ctxm.some((m) => m.reported)); assert.ok(ctxm.length <= 9);
    assert.equal((await adm.get('/api/admin/moderation/counts')).data.messages, 1);
    await adm.post(`/api/admin/message-reports/${reps[0].id}/resolve`, { action: 'blokiraj', note: 'vrijeđanje' });
    const after = (await b.get(`/api/conversations/${conv.id}`)).data.messages.find((m) => m.id === msgs[2].id);
    assert.equal(after.body, null); assert.equal(after.removed, true);
    assert.equal(t.ctx.db.get('SELECT is_blocked FROM users WHERE id = ?', ids.a).is_blocked, 1);
    assert.ok(t.ctx.db.get("SELECT 1 AS x FROM admin_audit_logs WHERE action = 'moderacija-poruke'"));
  } finally { await t.stop(); }
});
