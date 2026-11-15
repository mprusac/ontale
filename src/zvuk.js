// Zvuk: popis zvučnih zapisa (ugrađeni + oni koje doda administrator), dodjela događajima i gradovima, zadane postavke.
// Preglednik zvukove pušta sam (public/zvuk.js); poslužitelj samo daje konfiguraciju i čuva datoteke.
import fs from 'node:fs';
import path from 'node:path';
import { nowIso, HttpError, bad, randomToken } from './util.js';

const OWN = { license: 'Vlasnikovi zapisi (izvučeni iz videa koje je dao vlasnik ONTALE-a)', source: 'Desktop/videi/*.mp4 → public/zvukovi/gradovi/*.mp3' };
const ORIGINAL = { license: 'CC0 1.0 — izvorni ONTALE zvuk', source: 'Sintetizirano (scripts/zvukovi.py / public/zvuk.js)' };
// Ugrađeni zapisi: „synth:*“ nastaju u pregledniku (Web Audio), „file:*“ su MP3 datoteke u public/zvukovi/.
export const BUILTIN = [
  ['synth:start', 'Paljenje motora', 'start partije'], ['synth:count', 'Odbrojavanje', 'svaka sekunda pripreme'], ['synth:go', 'Kreni!', 'kraj pripreme'],
  ['synth:tick', 'Otkucaj sata', 'zadnjih 5 sekundi'], ['synth:accept', 'Odgovor prihvaćen', 'točan odgovor'], ['synth:wrong', 'Nije prepoznato', 'pogrešan pokušaj'],
  ['synth:zero', 'Radovi na cesti', '0 km / isteklo vrijeme'], ['synth:transport', 'Prijevoz', 'dodjela prijevoza, zvuk ovisi o razini'], ['synth:vehicle', 'Vožnja', 'kretanje po karti'],
  ['synth:station', 'Kolodvorski gong', 'dolazak u grad (zadano)'], ['synth:beyond', 'Dalje od cilja', 'nastavak preko granice nakon cilja'], ['synth:rare', 'Iskrice', 'rijedak odgovor'],
  ['synth:award', 'Medalja', 'osvojena nagrada'], ['synth:win', 'Pobjeda', 'dobiven izazov'], ['synth:message', 'Poruka', 'nova privatna poruka'], ['synth:notify', 'Obavijest', 'važna obavijest'],
  ['file:tramvaj', 'Tramvaj', 'grad s tramvajem'], ['file:brod', 'Brodska sirena', 'lučki grad'], ['file:zvona', 'Zvona', 'stari grad'], ['file:more', 'More i galebovi', 'obala'],
  ['file:planina', 'Rog u planini', 'gorski kraj'], ['file:mandolina', 'Mandolina', 'Dalmacija i Hercegovina'], ['file:granica', 'Pečat na granici', 'prelazak granice'],
  ['file:cilj', 'Fanfara cilja', 'dolazak na 1000 km'], ['file:kraj', 'Kraj partije', 'završena partija'],
  // Zvukovi gradova BiH iz vlasnikovih videa (cijeli isječci, izvučeni iz Desktop/videi)
  ...[['busovaca', 'Busovača'], ['capljina', 'Čapljina'], ['kalesija', 'Kalesija'], ['livno', 'Livno'], ['mostar', 'Mostar'], ['novi-travnik-i-vitez', 'Novi Travnik i Vitez'],
    ['sarajevo', 'Sarajevo'], ['sipovo', 'Šipovo'], ['vlasinje', 'Vlasinje'], ['zenica', 'Zenica'],
    ['zagreb', 'Zagreb'], ['split', 'Split'], ['osijek', 'Osijek'], ['sibenik', 'Šibenik'], ['nova-gradiska', 'Nova Gradiška'], ['gornje-jesenje', 'Gornje Jesenje'], ['piljuzici', 'Piljužići'], ['zadar', 'Zadar']].map(([f, n]) => [`file:gradovi/${f}`, `Grad: ${n}`, 'zvuk dolaska (video vlasnika)', true]),
].map(([slug, name, hint, own]) => ({ slug, name, hint, kind: slug.split(':')[0], url: slug.startsWith('file:') ? `/zvukovi/${slug.slice(5)}.mp3` : null, ...(own ? OWN : ORIGINAL), builtin: true }));

export const EVENTS = {
  start: ['Početak partije', 'synth:start'], count: ['Odbrojavanje pripreme', 'synth:count'], go: ['Kraj pripreme', 'synth:go'], tick: ['Zadnjih 5 sekundi', 'synth:tick'],
  accept: ['Odgovor prihvaćen', 'synth:accept'], wrong: ['Netočan pokušaj', 'synth:wrong'], zero: ['0 km (radovi na cesti)', 'synth:zero'], transport: ['Dodijeljen prijevoz', 'synth:transport'],
  vehicle: ['Vozilo kreće', 'synth:vehicle'], arrive: ['Dolazak u grad (zadano)', 'synth:station'], border: ['Prelazak granice', 'file:granica'], goal: ['Cilj (1000 km)', 'file:cilj'],
  beyond: ['Nastavak u drugu državu', 'synth:beyond'], finish: ['Kraj partije', 'file:kraj'], rare: ['Rijedak odgovor', 'synth:rare'], award: ['Nagrada', 'synth:award'],
  win: ['Pobjeda u izazovu', 'synth:win'], message: ['Nova poruka', 'synth:message'], notify: ['Važna obavijest', 'synth:notify'],
};
// Zadana dodjela gradova (admin je može promijeniti). Gradovi bez dodjele koriste zvuk „Dolazak u grad“.
export const CITY_DEFAULTS = {
  // Vlasnikovi zvukovi gradova
  Zagreb: 'file:gradovi/zagreb', Split: 'file:gradovi/split', Osijek: 'file:gradovi/osijek', Šibenik: 'file:gradovi/sibenik',
  'Nova Gradiška': 'file:gradovi/nova-gradiska', 'Gornje Jesenje': 'file:gradovi/gornje-jesenje',
  Busovača: 'file:gradovi/busovaca', Čapljina: 'file:gradovi/capljina', Kalesija: 'file:gradovi/kalesija', Mostar: 'file:gradovi/mostar',
  'Novi Travnik': 'file:gradovi/novi-travnik-i-vitez', Sarajevo: 'file:gradovi/sarajevo', Šipovo: 'file:gradovi/sipovo',
  Vlasinje: 'file:gradovi/vlasinje', Zenica: 'file:gradovi/zenica', Piljužići: 'file:gradovi/piljuzici',
  Zadar: 'file:gradovi/zadar',
  Rijeka: 'file:brod', Ploče: 'file:brod', Bar: 'file:brod', Senj: 'file:brod',
  Dubrovnik: 'file:zvona', Kotor: 'file:zvona', Korčula: 'file:zvona',
  Makarska: 'file:more', Neum: 'file:more', Budva: 'file:more', Pula: 'file:more', Hvar: 'file:more', Ulcinj: 'file:more', Cres: 'file:more', Krk: 'file:more', 'Herceg Novi': 'file:more',
  Gospić: 'file:planina', Žabljak: 'file:planina', Bihać: 'file:planina', Foča: 'file:planina', Drvar: 'file:planina',
  Trebinje: 'file:mandolina', Stolac: 'file:mandolina',
};
export const AUDIO_DEFAULTS = { enabled: true, default_on: true, default_volume: 0.7, events: {}, cities: {}, disabled: [] };

export function createAudio(ctx) {
  const { db, settings, config } = ctx;
  const dir = () => path.join(config.dataDir, 'zvukovi');
  const cfg = () => ({ ...AUDIO_DEFAULTS, ...settings.get('audio', {}) });
  const uploaded = () => db.all('SELECT * FROM audio_assets ORDER BY id').map((a) => ({ slug: 'up:' + a.slug, name: a.name, kind: 'file', url: `/zvukovi-dodani/${a.file}`, license: a.license, source: a.source, active: !!a.active, builtin: false, id: a.id, bytes: a.bytes }));
  const assets = () => [...BUILTIN.map((b) => ({ ...b, active: true })), ...uploaded()];

  /** Konfiguracija za preglednik: samo aktivni zapisi i stvarna dodjela (zadano + izmjene administratora). */
  function publicConfig() {
    const c = cfg();
    const all = assets().filter((a) => a.active && !c.disabled.includes(a.slug));
    const ok = new Set(all.map((a) => a.slug));
    const events = {};
    for (const [k, [, def]] of Object.entries(EVENTS)) {
      const v = c.events[k] ?? def;
      events[k] = v && ok.has(v) ? v : null;                 // '' ili isključen zapis = događaj bez zvuka
    }
    const cities = {};
    for (const [name, v] of Object.entries({ ...CITY_DEFAULTS, ...c.cities })) if (v && ok.has(v)) cities[name] = v;
    return { enabled: !!c.enabled, default_on: !!c.default_on, default_volume: Number(c.default_volume) || 0.7, events, cities,
      files: Object.fromEntries(all.filter((a) => a.url).map((a) => [a.slug, a.url])) };
  }
  function adminView() {
    const c = cfg();
    const cities = db.all(`SELECT DISTINCT c.name FROM route_checkpoints rc JOIN cities c ON c.id = rc.city_id JOIN routes r ON r.id = rc.route_id
                           WHERE r.active = 1 AND rc.is_stop = 1 AND (c.label IS NULL OR c.label != 'granica') ORDER BY c.name`).map((r) => r.name);
    return { settings: c, assets: assets().map((a) => ({ ...a, disabled: c.disabled.includes(a.slug) })), events: Object.fromEntries(Object.entries(EVENTS).map(([k, [label, def]]) => [k, { label, default: def, value: c.events[k] ?? def }])),
      cities: cities.map((name) => ({ name, default: CITY_DEFAULTS[name] || '', value: c.cities[name] ?? CITY_DEFAULTS[name] ?? '' })) };
  }
  function save(b = {}) {
    const c = cfg();
    const known = new Set(assets().map((a) => a.slug));
    const check = (v) => { if (v && !known.has(v)) throw bad(`Nepoznat zvučni zapis: ${v}`); return v || ''; };
    const next = { ...c };
    if (b.enabled !== undefined) next.enabled = !!b.enabled;
    if (b.default_on !== undefined) next.default_on = !!b.default_on;
    if (b.default_volume !== undefined) { const v = Number(b.default_volume); if (!(v >= 0 && v <= 1)) throw bad('Glasnoća mora biti 0–1.'); next.default_volume = v; }
    if (b.events) { next.events = {}; for (const [k, v] of Object.entries(b.events)) { if (!EVENTS[k]) throw bad(`Nepoznat događaj: ${k}`); if (v !== EVENTS[k][1]) next.events[k] = check(v); } }
    if (b.cities) { next.cities = {}; for (const [k, v] of Object.entries(b.cities)) { const name = String(k).slice(0, 80); if ((v || '') !== (CITY_DEFAULTS[name] || '')) next.cities[name] = check(v); } }
    if (b.disabled) next.disabled = [...new Set(b.disabled.map(String))].filter((x) => known.has(x));
    settings.set('audio', next);
    return adminView();
  }
  /** Prijenos MP3/OGG/WAV zapisa (base64, najviše 400 kB) uz obaveznu napomenu o licenci. */
  function upload({ name, data, license, source }) {
    const m = /^data:audio\/(mpeg|mp3|ogg|wav|x-wav|webm);base64,([A-Za-z0-9+/=]+)$/.exec(String(data || ''));
    if (!m) throw bad('Zapis mora biti MP3, OGG, WAV ili WebM.');
    if (!license || String(license).trim().length < 3) throw bad('Upiši licencu zapisa (npr. „CC0“, „vlastita snimka“, „licencirano od …“).');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 400 * 1024) throw bad('Zapis je prevelik (najviše 400 kB). Skrati ga ili smanji kvalitetu.');
    const head = buf.subarray(0, 12);
    const type = head.subarray(0, 3).toString() === 'ID3' || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) ? 'mp3'
      : head.subarray(0, 4).toString() === 'OggS' ? 'ogg' : head.subarray(0, 4).toString() === 'RIFF' && head.subarray(8, 12).toString() === 'WAVE' ? 'wav'
      : head.readUInt32BE(0) === 0x1a45dfa3 ? 'webm' : null;
    if (!type) throw bad('Datoteka nije ispravan zvučni zapis.');
    fs.mkdirSync(dir(), { recursive: true });
    const slug = String(name || 'zapis').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) + '-' + randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, 'x');
    const file = `${slug}.${type}`;
    fs.writeFileSync(path.join(dir(), file), buf);
    db.run('INSERT INTO audio_assets (slug, name, file, bytes, license, source, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', slug, String(name || slug).slice(0, 60), file, buf.length, String(license).slice(0, 200), source ? String(source).slice(0, 300) : null, nowIso());
    return adminView();
  }
  function setActive(id, active) {
    const a = db.get('SELECT * FROM audio_assets WHERE id = ?', Number(id));
    if (!a) throw new HttpError(404, 'Zapis ne postoji.');
    db.run('UPDATE audio_assets SET active = ? WHERE id = ?', active ? 1 : 0, a.id);
    return adminView();
  }
  const filePath = (name) => { const f = path.join(dir(), path.basename(name)); return f.startsWith(dir() + path.sep) && fs.existsSync(f) ? f : null; };
  return { publicConfig, adminView, save, upload, setActive, filePath, cfg };
}
