// Nadogradnja PODATAKA postojeće baze (shemu nadograđuju migracije u migrations/).
// Pokreće se pri svakom startu poslužitelja; radi samo ono što još nije napravljeno i ništa ne briše:
// korisnici, partije, odgovori, ljestvice, lige i administratorske izmjene ostaju netaknuti.
import crypto from 'node:crypto';
import { backupDb } from './db.js';
import { addDays, nowIso, isDate } from './util.js';
import { KARTE, POSTAVKE, DRZAVE } from '../seed/osnova.js';
import { PRAVILA } from '../seed/tekstovi.js';

export const DATA_VERSION = 7;
const NOVI_BA = ['Novi Travnik', 'Vitez', 'Busovača', 'Široki Brijeg', 'Ljubuški'];   // dodani u verziji 3
const NOVI_BA_4 = ['Kalesija', 'Šipovo', 'Vlasinje'];                                  // dodani u verziji 4 (+ Čapljina postaje postaja)
const NOVI_HR_5 = ['Gornje Jesenje', 'Nova Gradiška'];
const NOVI_BA_5 = ['Piljužići'];
const NOVI_HR_6 = ['Đakovo', 'Ogulin', 'Opatija', 'Obrovac', 'Biograd na Moru', 'Trogir', 'Omiš', 'Metković'];

// Zadane vrijednosti prve verzije — mijenjaju se samo ako ih administrator nije dirao.
const V1 = {
  tagline: 'Osam sportskih pitanja dnevno. Što rjeđi odgovor, to dalje stižeš.',
  rulesHash: '8267eaf3dfed6a29',
  colors: { sign: '#0b6b4f', route: '#ffd21f', ink: '#101418', alert: '#d92b2b' },
  routes: {
    hr: ['Vukovar', 'Osijek', 'Đakovo', 'Slavonski Brod', 'Nova Gradiška', 'Kutina', 'Zagreb', 'Karlovac', 'Gospić', 'Sveti Rok', 'Zadar', 'Šibenik', 'Split', 'Makarska', 'Ploče', 'Dubrovnik'],
    ba: ['Bijeljina', 'Brčko', 'Tuzla', 'Doboj', 'Banja Luka', 'Prijedor', 'Bihać', 'Ključ', 'Jajce', 'Travnik', 'Zenica', 'Sarajevo', 'Konjic', 'Mostar', 'Čapljina', 'Neum'],
  },
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * @returns {{ran:boolean, backup?:string, notes:string[]}}
 * `questions` = pitanja iz seed/pitanja (učitava ih pozivatelj jer je učitavanje asinkrono).
 */
export function upgradeData(ctx, { questions = [], seedTools, backup = true, log = () => {} } = {}) {
  const { db, settings, admin } = ctx;
  const notes = [];
  const version = settings.get('data_version', null);
  if (version >= DATA_VERSION) return { ran: false, notes };
  if (!db.get('SELECT 1 AS x FROM maps') && !db.get('SELECT 1 AS x FROM questions')) return { ran: false, notes };   // prazna baza: seed upisuje sve odjednom

  let backupFile = null;
  if (backup && ctx.config?.dbPath && ctx.config.dbPath !== ':memory:') {
    backupFile = backupDb(db, ctx.config.dbPath, 'prije-nadogradnje-v' + DATA_VERSION);
    notes.push(`Sigurnosna kopija baze: ${backupFile}`);
  }

  db.tx(() => {
    if (!(version >= 2)) {
    // ---------- 1. Postavke ----------
    if (settings.get('game') === undefined) { settings.set('game', POSTAVKE.game); notes.push('Dodane postavke igre: 10 pitanja, 5 s pripreme, 30 s za odgovor, ponovni pokušaji uključeni.'); }
    if (settings.get('countries') === undefined) settings.set('countries', DRZAVE);
    if (settings.get('tagline') === V1.tagline) { settings.set('tagline', POSTAVKE.tagline); notes.push('Slogan na naslovnici: „10 sportskih pitanja dnevno.“'); }
    const rules = settings.get('rules');
    if (typeof rules === 'string' && crypto.createHash('sha256').update(rules).digest('hex').slice(0, 16) === V1.rulesHash) { settings.set('rules', PRAVILA); notes.push('Pravila igre ažurirana (tajmeri, ponovni pokušaji, nastavak rute).'); }
    else if (rules !== PRAVILA) notes.push('Pravila igre su ručno mijenjana — nisam ih dirao. Dopuni ih u adminu (Postavke → Tekstovi).');
    if (same(settings.get('colors'), V1.colors)) settings.set('colors', POSTAVKE.colors);
    if (settings.get('map_style') === 'osm') { settings.set('map_style', 'tamna'); notes.push('Stil karte: tamna karta (može se vratiti u adminu).'); }
    settings.set('messages', { ...POSTAVKE.messages, ...settings.get('messages', {}), retry: settings.get('messages', {}).retry || POSTAVKE.messages.retry, timeout: settings.get('messages', {}).timeout || POSTAVKE.messages.timeout, beyond: settings.get('messages', {}).beyond || POSTAVKE.messages.beyond });

    // ---------- 2. Rute: šira putanja + nastavak u susjednu državu ----------
    for (const [i, m] of KARTE.entries()) {
      const map = db.get('SELECT * FROM maps WHERE slug = ?', m.slug);
      if (!map) continue;
      const route = db.get('SELECT * FROM routes WHERE map_id = ? AND active = 1 ORDER BY id LIMIT 1', map.id);
      const names = route ? db.all('SELECT c.name FROM route_checkpoints rc JOIN cities c ON c.id = rc.city_id WHERE rc.route_id = ? ORDER BY rc.position', route.id).map((r) => r.name) : [];
      if (route && same(names, V1.routes[m.slug]) && route.total_km === m.total_km) {
        const payload = seedTools.mapPayload(m, i);
        admin.saveMap(null, map.id, { ...payload, flag: map.flag, name: map.name, sort_order: map.sort_order, active: !!map.active });
        notes.push(`Karta ${map.name}: nova šira ruta do cilja (${m.total_km} km) i nastavak iza cilja (${m.ext_km} km).`);
      } else if (route) {
        notes.push(`Karta ${map.name}: ruta je ručno mijenjana — geometrija nije dirana. Nastavak iza cilja dodaj u adminu (Karte).`);
      }
    }

    // ---------- 3. Sadržaj: nova pitanja + dopuna dana na zadani broj pitanja ----------
    const start = settings.get('start_date', null);
    if (!questions.length || !isDate(start)) {
      if (questions.length) notes.push('Datum početka igre nije postavljen — nova pitanja nisu raspoređena po danima.');
    } else {
      const idByText = new Map(db.all('SELECT id, text FROM questions').map((q) => [q.text, q.id]));
      const byDay = new Map();
      let added = 0;
      for (const q of questions) {
        let id = idByText.get(q.text);
        if (!id) {
          const ex = seedTools.expandQuestion(q);
          const v = seedTools.validateQuestion(q, ex);
          if (v.errors.length) { notes.push(`Preskočeno pitanje (dan ${q.dan}/${q.poz}): ${v.errors.join('; ')}`); continue; }
          id = admin.saveQuestion(null, null, ex).id;
          idByText.set(q.text, id); added++;
        }
        if (!byDay.has(q.dan)) byDay.set(q.dan, []);
        byDay.get(q.dan).push({ pos: q.poz, id });
      }
      if (added) notes.push(`Dodano novih pitanja u bazu: ${added}.`);
      let extended = 0, created = 0;
      for (const [day, list] of [...byDay].sort((a, b) => a[0] - b[0])) {
        list.sort((a, b) => a.pos - b.pos);
        const date = addDays(start, day - 1);
        const ch = db.get("SELECT * FROM daily_challenges WHERE date = ? AND scope = 'sve'", date);
        if (!ch) {
          admin.saveChallenge(null, null, { date, scope: 'sve', title: `Dan ${day}`, active: 1, question_ids: list.map((x) => x.id), allow_size: true });
          created++;
          continue;
        }
        const current = db.all('SELECT question_id FROM daily_challenge_questions WHERE challenge_id = ? ORDER BY position', ch.id).map((r) => r.question_id);
        const seedIds = list.map((x) => x.id);
        if (!current.some((id) => seedIds.includes(id))) { notes.push(`Dan ${date}: izazov je ručno složen — nije mijenjan.`); continue; }
        const missing = seedIds.filter((id) => !current.includes(id));
        if (!missing.length) continue;
        // Pitanja se samo DODAJU na kraj: postojeće partije i odgovori ostaju vezani uz ista pitanja i pozicije.
        missing.forEach((id, k) => db.run('INSERT INTO daily_challenge_questions (challenge_id, position, question_id) VALUES (?, ?, ?)', ch.id, current.length + k + 1, id));
        // Nedovršene partije nastavljaju do novog kraja; dovršene ostaju kakve jesu.
        db.run('UPDATE game_sessions SET question_count = ? WHERE challenge_id = ? AND finished_at IS NULL', current.length + missing.length, ch.id);
        extended++;
      }
      if (extended) notes.push(`Postojećih dana dopunjeno na ${ctx.game.cfg().questions_per_day} pitanja: ${extended}.`);
      if (created) notes.push(`Dodano novih dnevnih izazova: ${created}.`);
    }

    }
    // ---------- Verzija 3: logotip „Ontale“ i novi gradovi na ruti BiH ----------
    if (settings.get('logo_text') === 'ONTALE') { settings.set('logo_text', 'Ontale'); notes.push('Logotip: „Ontale“.'); }
    if (version >= 2) {
      const m = KARTE.find((k) => k.slug === 'ba'), map = db.get("SELECT * FROM maps WHERE slug = 'ba'");
      const route = map && db.get('SELECT * FROM routes WHERE map_id = ? AND active = 1 ORDER BY id LIMIT 1', map.id);
      const names = route ? db.all('SELECT c.name FROM route_checkpoints rc JOIN cities c ON c.id = rc.city_id WHERE rc.route_id = ? ORDER BY rc.position', route.id).map((r) => r.name) : [];
      if (version === 3) { /* v3 je već imao gradove iz verzije 3 — vidi korak 4 */ }
      else if (route && same(names, m.points.map((p) => p[0]).filter((n) => !NOVI_BA.includes(n) && !NOVI_BA_4.includes(n)))) {
        admin.saveMap(null, map.id, { ...seedTools.mapPayload(m, 1), flag: map.flag, name: map.name, sort_order: map.sort_order, active: !!map.active });
        notes.push('Karta BiH: dodani Novi Travnik, Vitez, Busovača, Široki Brijeg i Ljubuški (cilj i kilometri igre nepromijenjeni).');
      } else if (route && !NOVI_BA.every((n) => names.includes(n))) notes.push('Karta BiH je ručno mijenjana — nove gradove dodaj u adminu (Karte).');
    }
    // ---------- Verzija 4: Kalesija, Šipovo, Vlasinje; Čapljina postaje postaja ----------
    if (version >= 2) {
      const m = KARTE.find((k) => k.slug === 'ba'), map = db.get("SELECT * FROM maps WHERE slug = 'ba'");
      const route = map && db.get('SELECT * FROM routes WHERE map_id = ? AND active = 1 ORDER BY id LIMIT 1', map.id);
      const names = route ? db.all('SELECT c.name FROM route_checkpoints rc JOIN cities c ON c.id = rc.city_id WHERE rc.route_id = ? ORDER BY rc.position', route.id).map((r) => r.name) : [];
      if (route && same(names, m.points.map((p) => p[0]).filter((n) => !NOVI_BA_4.includes(n) && !NOVI_BA_5.includes(n)))) {
        admin.saveMap(null, map.id, { ...seedTools.mapPayload(m, 1), flag: map.flag, name: map.name, sort_order: map.sort_order, active: !!map.active });
        notes.push('Karta BiH: dodane Kalesija, Šipovo i Vlasinje; Čapljina je sada postaja (cilj Neum i 1000 km nepromijenjeni).');
      } else if (route && !NOVI_BA_4.every((n) => names.includes(n))) notes.push('Karta BiH je ručno mijenjana — Kalesiju, Šipovo i Vlasinje dodaj u adminu (Karte).');
    }
    // ---------- Verzija 5: Gornje Jesenje, Nova Gradiška (HR) i Piljužići (BiH) ----------
    if (version >= 2) {
      for (const slug of ['hr', 'ba']) {
        const m = KARTE.find((k) => k.slug === slug), map = db.get('SELECT * FROM maps WHERE slug = ?', slug);
        const route = map && db.get('SELECT * FROM routes WHERE map_id = ? AND active = 1 ORDER BY id LIMIT 1', map.id);
        const names = route ? db.all('SELECT c.name FROM route_checkpoints rc JOIN cities c ON c.id = rc.city_id WHERE rc.route_id = ? ORDER BY rc.position', route.id).map((r) => r.name) : [];
        const novi = slug === 'hr' ? NOVI_HR_5 : NOVI_BA_5;
        const kasnije = slug === 'hr' ? NOVI_HR_6 : [];
        const expected = m.points.map((p) => p[0]).filter((n) => !novi.includes(n) && !kasnije.includes(n));
        if (route && same(names, expected)) {
          admin.saveMap(null, map.id, { ...seedTools.mapPayload(m, slug === 'hr' ? 0 : 1), flag: map.flag, name: map.name, sort_order: map.sort_order, active: !!map.active });
          notes.push(`Karta ${map.name}: dodani ${novi.join(', ')} (cilj i ukupni kilometri nepromijenjeni).`);
        } else if (route && !novi.every((n) => names.includes(n))) notes.push(`Karta ${map.name} je ručno mijenjana — ${novi.join(', ')} dodaj u adminu.`);
      }
    }
    // ---------- Verzija 6: 8 novih postaja na HR ruti ----------
    if (version >= 2) {
      const m = KARTE.find((k) => k.slug === 'hr'), map = db.get("SELECT * FROM maps WHERE slug = 'hr'");
      const route = map && db.get('SELECT * FROM routes WHERE map_id = ? AND active = 1 ORDER BY id LIMIT 1', map.id);
      const names = route ? db.all('SELECT c.name FROM route_checkpoints rc JOIN cities c ON c.id = rc.city_id WHERE rc.route_id = ? ORDER BY rc.position', route.id).map((r) => r.name) : [];
      const expected = m.points.map((p) => p[0]).filter((n) => !NOVI_HR_6.includes(n));
      if (route && same(names, expected)) {
        admin.saveMap(null, map.id, { ...seedTools.mapPayload(m, 0), flag: map.flag, name: map.name, sort_order: map.sort_order, active: !!map.active });
        notes.push(`Karta Hrvatska: dodane postaje ${NOVI_HR_6.join(', ')} (cilj i ukupni kilometri nepromijenjeni).`);
      } else if (route && !NOVI_HR_6.every((n) => names.includes(n))) notes.push('Karta Hrvatska je ručno mijenjana — nove postaje dodaj u adminu.');
    }
    // ---------- Verzija 7: nove sportske metrike prijevoza (samo ako set nije ručno mijenjan) ----------
    {
      const set = db.get("SELECT id FROM transport_sets WHERE name = 'Navijački karavan'");
      const level1 = set && db.get('SELECT name FROM transport_modes WHERE set_id = ? AND level = 1', set.id);
      if (set && level1?.name === 'Sudačka šetnja') {
        const NOVE = [
          [1, '🚩', 'Sudački trk', 'Uz aut-liniju, oko na ofsajdu.'],
          [2, '⚡', 'Bolt na 100 m', '9,58 sekundi. Munja na stazi.'],
          [3, '🏇', 'Konj na Sinjskoj alci', 'U sridu, pa u galop.'],
          [4, '🚍', 'Klupski autobus s rotirkom', 'Policijska pratnja, zelena svjetla.'],
          [5, '🏍️', 'MotoGP rekord', 'Preko 350 na sat na ravnini, koljeno po asfaltu.'],
          [6, '🎾', 'Goranov as', 'Preko 200 na sat. Taj se ne vraća.'],
          [7, '🏎️', 'Bolid na magistrali', 'DRS otvoren, cijela ravnina je njegova.'],
        ];
        for (const [lvl, emoji, name, desc] of NOVE) db.run('UPDATE transport_modes SET emoji = ?, name = ?, image = NULL, description = ? WHERE set_id = ? AND level = ?', emoji, name, desc, set.id, lvl);
        db.run("UPDATE transport_sets SET name = 'Sportski tempo', description = 'Od sudačkog trka do bolida na magistrali.' WHERE id = ?", set.id);
        notes.push('Prijevoz: nove sportske metrike (Sudački trk → Bolt → Konj na Alci → Klupski autobus → MotoGP rekord → Goranov as → Bolid na magistrali).');
      } else if (set) notes.push('Set prijevoza je ručno mijenjan — nove sportske metrike po želji unesi u adminu (Prijevoz).');
    }
    settings.set('data_version', DATA_VERSION);
    db.run('INSERT INTO admin_audit_logs (action, entity, detail, created_at) VALUES (?, ?, ?, ?)', 'nadogradnja', 'baza', JSON.stringify({ version: DATA_VERSION, backup: backupFile, notes }).slice(0, 4000), nowIso());
  });
  ctx.version++; ctx.bumpBoards?.();
  for (const n of notes) log(n);
  return { ran: true, backup: backupFile, notes };
}
