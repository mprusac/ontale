// ONTALE — klijentska aplikacija (bez build koraka; čisti ES moduli).
import { createRouteMap } from '/karta.js';
import { flag } from '/zastave.js';
import { sound } from '/zvuk.js';
window.ontaleSound = sound;   // za provjeru u pregledniku (stanje i dnevnik zvukova)

// ---------- Pomoćne funkcije ----------
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
const nf = new Intl.NumberFormat('hr-HR', { maximumFractionDigits: 1 });
const km = (n) => `${nf.format(Math.round(n))} km`;
const num = (n) => nf.format(n);
const big = (n) => new Intl.NumberFormat('hr-HR', { maximumFractionDigits: 2 }).format(n);
const dateLong = (d) => new Intl.DateTimeFormat('hr-HR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
const dateShort = (d) => new Intl.DateTimeFormat('hr-HR', { day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
const dateFull = (d) => new Intl.DateTimeFormat('hr-HR', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const shift = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

class ApiError extends Error { constructor(status, data) { super((data && data.error) || 'Nešto je pošlo po zlu.'); this.status = status; this.data = data || {}; } }
async function api(method, url, body) {
  let res;
  try {
    res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'X-Ontale': '1' }, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' });
  } catch { throw new ApiError(0, { error: 'Nema veze s poslužiteljem. Provjeri internet i pokušaj ponovno.' }); }
  let data = null;
  try { data = await res.json(); } catch { /* prazno tijelo */ }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}
const get = (u) => api('GET', u), post = (u, b = {}) => api('POST', u, b);

function toast(msg) {
  document.querySelector('.toast')?.remove();
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 3200);
}
function emojiOf(t, fallback = '⬛') {
  if (!t) return fallback;
  return t.image ? h('img', { src: t.image, alt: t.name }) : t.emoji || fallback;
}
function avatar(u, cls = '') {
  if (u.avatar) return h('img', { class: 'avatar ' + cls, src: u.avatar, alt: '' });
  return h('span', { class: 'avatar ' + cls, 'aria-hidden': 'true' }, (u.nickname || '?').trim().charAt(0).toUpperCase());
}
/** "## naslov", "- stavka", prazan red = novi odlomak. */
function prose(text) {
  const out = h('div', { class: 'prose' });
  let list = null;
  for (const block of String(text || '').split(/\n\s*\n/)) {
    for (const line of block.split('\n')) {
      if (line.startsWith('## ')) { list = null; out.append(h('h2', {}, line.slice(3))); }
      else if (line.startsWith('- ')) { if (!list) out.append(list = h('ul')); list.append(h('li', {}, line.slice(2))); }
      else if (line.trim()) { list = null; out.append(h('p', {}, line)); }
    }
    list = null;
  }
  return out;
}

// ---------- Stanje i usmjeravanje ----------
const app = document.getElementById('app');
let boot = null, cleanup = null;

async function loadBoot() {
  boot = await get('/api/bootstrap');
  const c = boot.site.colors || {};
  const root = document.documentElement.style;
  if (c.sign) root.setProperty('--sign', c.sign);
  if (c.route) root.setProperty('--route', c.route);
  if (c.alert) root.setProperty('--alert', c.alert);
  document.title = `${boot.site.name} — dnevna sportska igra`;
  sound.configure(boot.site.audio, boot.prefs?.sound);
  sound.onSave = (p) => { if (boot?.me && !boot.me.is_guest) api('PATCH', '/api/me/prefs', { sound: p }).catch(() => {}); };
  if (boot.counts) applyCounts(boot.counts, true);
  return boot;
}
const registered = () => !!(boot?.me && !boot.me.is_guest);
// ---------- Karta: odabrani prikaz (Reljef / Satelit) pamti se lokalno i na profilu ----------
function mapView() {
  const cfg = boot.site.map;
  let v = null;
  try { v = localStorage.getItem('ontale-karta'); } catch { /* nema pohrane */ }
  v = v || boot.prefs?.map_mode || cfg.default_mode;
  return cfg.modes[v] ? v : cfg.default_mode;
}
function setMapView(v) {
  try { localStorage.setItem('ontale-karta', v); } catch { /* nema pohrane */ }
  if (registered()) api('PATCH', '/api/me/prefs', { map_mode: v }).catch(() => {});
}
const mapSpec = () => ({ cfg: boot.site.map, mode: mapView() });
const routes = [
  [/^\/$/, viewHome],
  [/^\/igra\/([a-z0-9-]+)$/, viewGame],
  [/^\/rezultat\/(\d+)$/, viewResult],
  [/^\/ljestvica$/, viewBoard],
  [/^\/lige$/, viewLeagues],
  [/^\/lige\/(\d+)$/, viewLeague],
  [/^\/liga\/([A-Za-z0-9]+)$/, viewJoin],
  [/^\/profil$/, viewProfile],
  [/^\/igrac\/(.+)$/, viewPlayer],
  [/^\/arhiva$/, viewArchive],
  [/^\/prijava$/, viewAuth],
  [/^\/lozinka$/, viewReset],
  [/^\/(pravila|privatnost|uvjeti)$/, viewPage],
  [/^\/poruke$/, viewInbox],
  [/^\/poruke\/(\d+)$/, viewConversation],
  [/^\/obavijesti$/, viewNotifications],
  [/^\/izazovi$/, viewDuels],
  [/^\/odjava-obavijesti$/, viewUnsubscribe],
];
function go(path, replace) {
  if (replace) history.replaceState(null, '', path); else history.pushState(null, '', path);
  render();
}
async function render() {
  if (cleanup) { try { cleanup(); } catch { /* nije bitno */ } cleanup = null; }
  const path = decodeURIComponent(location.pathname);
  const query = Object.fromEntries(new URLSearchParams(location.search));
  const hit = routes.map(([re, fn]) => [path.match(re), fn]).find(([m]) => m);
  window.scrollTo(0, 0);
  try {
    if (!boot) await loadBoot();
    if (!hit) return mount(shell(h('div', { class: 'stack' }, h('h1', {}, 'Ova stranica ne postoji'), h('a', { class: 'btn primary', href: '/' }, 'Natrag na današnju igru'))));
    await hit[1](hit[0].slice(1), query);
  } catch (e) {
    mount(shell(h('div', { class: 'stack' }, h('h1', {}, 'Ne ide'), h('p', { class: 'notice err' }, e.message), h('button', { class: 'btn', onclick: () => { boot = null; render(); } }, 'Pokušaj ponovno'))));
  }
}
function mount(node) { app.replaceChildren(node); }
/** Zamjenjuje sadržaj elementa; preskače null/false (replaceChildren bi ih ispisao kao tekst). */
function fill(el, ...kids) { el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false)); return el; }
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || a.target === '_blank') return;
  const href = a.getAttribute('href');
  if (!href.startsWith('/') || href.startsWith('/admin') || href.startsWith('/api') || href.startsWith('/avatars')) return;
  e.preventDefault();
  go(href);
});
window.addEventListener('popstate', render);

// ---------- Okvir stranice ----------
function logo(big) {
  const text = boot?.site.logo_text || 'Ontale';
  return h('a', { class: 'logo' + (big ? ' big' : ''), href: '/', 'aria-label': `${boot?.site.name || 'ONTALE'} — naslovnica` }, h('span', {}, text));
}
const withFlag = (m, text) => h('span', { class: 'wflag' }, flag(m.flag || m.code || m.slug), text ?? m.name);
function shell(content, { wide, game } = {}) {
  const p = location.pathname;
  const cur = (test) => (test ? 'page' : null);
  const me = boot?.me;
  const links = [
    ['/', 'Danas', '🛣️', p === '/' || p.startsWith('/igra') || p.startsWith('/rezultat')],
    ['/ljestvica', 'Ljestvica', '🏆', p.startsWith('/ljestvica')],
    ['/lige', 'Lige', '👥', p.startsWith('/lig')],
    ['/arhiva', 'Arhiva', '🗓️', p.startsWith('/arhiva')],
    ['/profil', 'Profil', '👤', p.startsWith('/profil') || p.startsWith('/prijava')],
  ];
  return h('div', { class: 'page' + (game ? ' in-game' : '') },
    h('header', { class: 'top' }, h('div', { class: 'top-in' },
      logo(),
      boot?.day_no ? h('span', { class: 'top-meta mono' }, `#${boot.day_no}`, h('br'), dateFull(boot.date)) : null,
      h('nav', { class: 'topnav', 'aria-label': 'Glavna navigacija' },
        links.slice(0, 4).map(([href, label, , on]) => h('a', { class: 'desk', href, 'aria-current': cur(on) }, label)),
        me && !me.is_guest ? h('a', { class: 'desk', href: '/izazovi', 'aria-current': cur(p.startsWith('/izazovi')) }, 'Izazovi') : null,
        soundButton(),
        me && !me.is_guest ? [
          h('a', { class: 'iconbtn hdr', href: '/poruke', 'aria-label': 'Poruke', title: 'Poruke', 'aria-current': cur(p.startsWith('/poruke')) }, '✉️', badge('msg')),
          h('button', { class: 'iconbtn hdr', type: 'button', 'aria-label': 'Obavijesti', title: 'Obavijesti', 'aria-haspopup': 'dialog', onclick: (e) => toggleBell(e.currentTarget) }, '🔔', badge('notif')),
        ] : null,
        me && !me.is_guest ? h('a', { class: 'me', href: '/profil', 'aria-label': 'Moj profil' }, avatar(me)) : h('a', { class: 'btn sm', href: '/prijava', 'aria-current': cur(p === '/prijava') }, 'Prijava')))),
    h('main', { class: 'wrap' + (wide ? ' wide' : '') }, content,
      h('footer', { class: 'footer' },
        h('a', { href: '/pravila' }, 'Pravila igre'), h('a', { href: '/privatnost' }, 'Privatnost'), h('a', { href: '/uvjeti' }, 'Uvjeti korištenja'),
        boot?.site.contact_email ? h('a', { href: `mailto:${boot.site.contact_email}` }, boot.site.contact_email) : null,
        me?.is_admin ? h('a', { href: '/admin' }, 'Administracija') : null)),
    h('nav', { class: 'tabbar', 'aria-label': 'Navigacija' }, links.map(([href, label, icon, on]) => h('a', { href, 'aria-current': cur(on) }, h('span', { 'aria-hidden': 'true' }, icon), label))));
}
function untilText(iso) {
  const s = Math.max(0, Math.floor((new Date(iso) - Date.now()) / 1000));
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function countdown(iso) {
  const el = h('span', { class: 'mono' });
  const tick = () => {
    el.textContent = untilText(iso);
    if (new Date(iso) - Date.now() <= 0) { clearInterval(timer); boot = null; setTimeout(render, 1500); }
  };
  const timer = setInterval(tick, 1000);
  tick();
  const prev = cleanup;
  cleanup = () => { clearInterval(timer); prev && prev(); };
  return el;
}
/** Sedam razina prijevoza: od najčešćeg odgovora (lijevo) do najrjeđeg (desno). */
function transportStrip(list) {
  return h('div', { class: 'tstrip' },
    h('ol', {}, list.map((t) => h('li', { title: t.description || t.name },
      h('span', { class: 'tb l' + t.level, 'aria-hidden': 'true' }, emojiOf(t)),
      h('span', { class: 'tn' }, t.name),
      h('span', { class: 'tk mono' }, `+${nf.format(t.km)}`)))),
    h('div', { class: 'spectrum', 'aria-hidden': 'true' }, h('span', {}, 'češći odgovor'), h('i'), h('span', {}, 'rjeđi odgovor')));
}
const countryOf = (code) => (boot.countries && boot.countries[code]) || { name: code.toUpperCase(), flag: '' };

// ---------- Naslovnica ----------
async function viewHome() {
  await loadBoot();
  const b = boot;
  const total = b.challenge?.questions || b.game.questions_per_day;
  const dest = (m) => {
    const mine = m.mine;
    const href = !m.has_challenge ? null : mine?.finished ? `/rezultat/${mine.session_id}` : `/igra/${m.slug}`;
    const count = mine?.question_count || total;
    const status = !m.has_challenge ? 'Danas nema izazova' : mine?.finished ? (mine.reached_goal ? 'Stigao si do cilja' : 'Odigrano') : mine ? 'U tijeku' : 'Čeka te';
    const cta = !m.has_challenge ? null : mine?.finished ? 'Pogledaj rezultat' : mine ? 'Nastavi' : 'Kreni';
    const pips = [];
    for (let i = 1; i <= count; i++) pips.push(h('i', { class: mine && i <= mine.answered ? 'on' : '' }));
    return h(href ? 'a' : 'div', { class: 'dest' + (mine?.finished ? ' done' : ''), href },
      h('div', { class: 'dest-top' }, h('span', { class: 'dest-country' }, flag(m.flag, m.name), m.name), h('span', { class: 'dest-status' + (mine && !mine.finished ? ' live' : '') }, status)),
      h('div', { class: 'dest-city' }, m.to?.name || m.name),
      h('div', { class: 'dest-route mono' }, `${m.from?.name || ''} → ${m.to?.name || ''} · ${nf.format(m.route_km)} km`),
      m.beyond?.length ? h('div', { class: 'dest-after' }, 'Tko prođe cilj, vozi dalje: ', m.beyond.map((c) => withFlag({ flag: c }, countryOf(c).name))) : null,
      h('div', { class: 'dest-prog' },
        h('div', { class: 'pips', role: 'img', 'aria-label': mine ? `Odgovoreno ${mine.answered} od ${count} pitanja` : `${count} pitanja` }, pips),
        h('span', { class: 'mono' }, mine ? (mine.finished ? km(mine.total_km) : `${mine.answered} / ${count}`) : `0 / ${count}`)),
      mine?.finished && mine.at ? h('div', { class: 'dest-at' }, h('span', { 'aria-hidden': 'true' }, '📍'), mine.at_country && mine.at_country !== m.slug ? flag(mine.at_country, countryOf(mine.at_country).name) : null, h('b', {}, mine.at), h('span', { class: 'sr' }, ' — grad do kojeg si stigao')) : null,
      cta ? h('span', { class: 'btn ' + (mine?.finished ? '' : 'primary') + ' block' }, cta) : null);
  };
  const cats = b.challenge?.categories || [];
  const shortCat = (n) => (n === 'Borilački sportovi' ? 'Borilački' : n);
  const sports = [...new Map(cats.map((c) => [c.name, c])).values()];
  mount(shell(h('div', { class: 'col stack-lg' },
    reminderBanner(b),
    h('div', { class: 'hero' },
      h('p', { class: 'hero-date' }, cap(dateLong(b.date))),
      h('h1', {}, 'Kamo danas voziš?'),
      h('p', { class: 'lead' }, b.site.tagline)),
    h('div', { class: 'dests' }, b.maps.map(dest)),
    b.challenge ? h('section', { class: 'card stack' },
      h('div', { class: 'row spread wrapline' }, h('h2', {}, `Današnjih ${b.challenge.questions} pitanja`), h('span', { class: 'muted small' }, 'Nova ruta za ', countdown(b.next_reset))),
      h('div', { class: 'cats one', role: 'list' }, sports.map((c) => h('span', { role: 'listitem', title: shortCat(c.name) }, c.emoji, h('span', { class: 'cname' }, ' ' + shortCat(c.name))))),
      h('p', { class: 'small muted oneline' }, `Za svako pitanje ${b.game.prep_seconds} s pripreme i ${b.game.answer_seconds} s za odgovor.`, b.game.retries ? ' Ako ne pogodiš, pokušaj ponovno dok traje vrijeme.' : '')) : h('p', { class: 'notice' }, 'Za danas još nema pitanja. Navrati kasnije.'),
    h('section', { class: 'stack' },
      h('h2', {}, 'Što rjeđi odgovor, to brži prijevoz'),
      transportStrip(b.transports),
      h('p', { class: 'small muted' }, 'Bez točnog odgovora: 0 km. U procjenama prijevoz ovisi o tome koliko si blizu stvarnoj brojci.')),
    b.streak && b.streak.best > 0 ? h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('b', {}, b.streak.current), h('span', {}, 'dana zaredom')),
      h('div', { class: 'stat' }, h('b', {}, b.streak.best), h('span', {}, 'najdulji niz'))) : null,
    h('section', { class: 'stack' },
      h('h2', {}, 'Lige i ljestvice'),
      b.leagues.length ? h('div', { class: 'panel flush' }, h('table', { class: 'table' }, h('tbody', {}, b.leagues.map((l) => h('tr', {},
        h('td', {}, h('a', { href: `/lige/${l.id}`, style: 'font-weight:800' }, l.name)),
        h('td', { class: 'r small' }, `danas igralo ${l.played_today} od ${l.members}`)))))) : h('p', { class: 'muted' }, 'Napravi ligu, pošalji prijateljima kod i gledajte tko je dalje stigao.'),
      h('div', { class: 'row wrapline' },
        h('a', { class: 'btn', href: '/lige' }, b.leagues.length ? 'Sve moje lige' : 'Napravi ligu'),
        h('a', { class: 'btn', href: '/ljestvica' }, 'Današnja ljestvica'))))));
}

// ---------- Igra ----------
/** Položaj na ruti izračunat u pregledniku (za HUD dok animacija traje); poslužitelj ostaje mjerodavan. */
function whereOn(route, k) {
  const stops = route.points.filter((p) => p.is_stop);
  let passed = stops[0];
  for (const p of stops) if (p.km <= k + 1e-6) passed = p;
  return { passed, upcoming: stops.filter((p) => p.km > k + 1e-6).slice(0, 3), beyond: k > route.total_km + 1e-6 };
}
function mapStage(map, { result } = {}) {
  const el = h('div', { class: 'stage-map' });
  const place = h('div', { class: 'hud hud-place' });
  const sign = h('div', { class: 'hud hud-sign' });
  const toastEl = h('div', { class: 'hud hud-toast', hidden: true, role: 'status' });
  const cam = (mode, label) => h('button', { type: 'button', 'aria-pressed': String(mode === (result ? 'overview' : 'follow')), onclick: (e) => {
    rmap.setMode(mode);
    for (const b of e.target.parentNode.children) b.setAttribute('aria-pressed', String(b === e.target));
  } }, label);
  const camBox = h('div', { class: 'hud hud-cam', role: 'group', 'aria-label': 'Prikaz karte' }, cam('follow', 'Kamera prati'), cam('overview', 'Cijela ruta'));
  const arriveEl = h('div', { class: 'hud hud-arrive', hidden: true, role: 'status' });
  const viewBox = viewSwitch(() => rmap);
  const stage = h('div', { class: 'stage' + (result ? ' result' : '') }, el, place, sign, viewBox, camBox, toastEl, arriveEl);
  // Poruka dolaska bez ponovljenog naziva grada (u bazi poruke počinju imenom grada, npr. „Varaždin. Barok…“).
  const arrivalText = (p) => { let m = p.message || ''; for (const lead of [p.name, 'Granica']) { if (lead && m.startsWith(lead)) { m = m.slice(lead.length).replace(/^[\s.!…,–-]+/, ''); break; } } return m; };
  const queue = []; let arriveTimer = 0, showing = false;
  const nextArrival = () => {
    const entry = queue.shift();
    if (!entry) { showing = false; arriveEl.classList.remove('in'); arriveTimer = setTimeout(() => { arriveEl.hidden = true; }, 260); return; }
    showing = true;
    const p = entry.p;
    const border = p.label === 'granica', c = countryOf(p.country);
    fill(arriveEl, h('small', { class: 'mono' }, border ? 'Granica' : p.is_goal ? 'Cilj' : 'Stigao si', ` · ${nf.format(Math.round(p.km))} km`),
      h('b', {}, border || p.country !== map.route.points[0].country ? flag(p.country, c.name) : null, border ? c.name : p.name), (() => { const m = arrivalText(p); return m ? h('span', {}, m) : null; })());
    arriveEl.hidden = false; arriveEl.classList.remove('in'); void arriveEl.offsetWidth; arriveEl.classList.add('in');
    // Ako grad ima vlastiti zvuk, zadrži tablicu duže da se poveže zvuk s gradom (4,6 s umjesto 3,2 s).
    const base = entry.slow ? 4600 : 3200;
    arriveTimer = setTimeout(nextArrival, queue.length > 2 ? 1100 : queue.length ? 1700 : base);
  };
  const rmap = createRouteMap(el, map.route, mapSpec());
  if (result) rmap.setMode('overview');
  const start = map.route.points[0];
  let toastTimer = 0;
  const api = {
    el: stage, rmap,
    /** Osvježava natpise za zadane kilometre. */
    hud(k) {
      const w = whereOn(map.route, k);
      const c = w.passed.country;
      fill(place, flag(c, countryOf(c).name), h('span', {}, h('b', {}, w.passed.label === 'granica' ? `Granica — ${countryOf(c).name}` : w.passed.name), h('small', { class: 'mono' }, `${nf.format(Math.round(k))} km od starta`)));
      sign.hidden = !w.upcoming.length;
      sign.replaceChildren(...w.upcoming.map((p) => h('div', { class: p.is_goal ? 'goal' : '' },
        h('span', {}, p.country !== c ? flag(p.country) : null, p.label === 'granica' ? 'Granica' : p.name, p.is_goal ? ' 🏁' : ''),
        h('b', { class: 'mono' }, nf.format(Math.max(1, Math.round(p.km - k)))))));
    },
    toast(node, ms = 4200) {
      clearTimeout(toastTimer);
      toastEl.replaceChildren(node); toastEl.hidden = false;
      toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms);
    },
    /** Obavijest o dolasku na postaju; više dolazaka u jednom skoku prikazuje se redom, bez preklapanja. */
    arrive(p) { sound.arrive(p); queue.push({ p, slow: sound.cityHasClip?.(p.name) }); while (queue.length > 5) queue.shift(); if (!showing) { clearTimeout(arriveTimer); nextArrival(); } },
    destroy() { clearTimeout(toastTimer); clearTimeout(arriveTimer); rmap.destroy(); },
  };
  api.hud(0);
  return api;
}

async function viewGame([slug], query) {
  if (!boot) await loadBoot();
  const map = await get(`/api/map/${slug}`);
  const info = boot.maps.find((m) => m.slug === slug);
  const side = !!(query.datum || query.ponovno);   // arhiva ili ponovljena partija — ne računa se
  if (!side && info?.mine?.finished) return go(`/rezultat/${info.mine.session_id}`, true);
  const g = boot.game, startCity = map.route.points[0], goalCity = map.route.points[map.route.goal_index];
  const body = { map: slug, date: query.datum || undefined, replay: query.ponovno ? true : undefined };

  // --- Početni zaslon: sat ne kreće dok igrač ne pritisne gumb ---
  const st = await new Promise((resolve) => {
    const err = h('p', { class: 'notice err', hidden: true, role: 'alert' });
    const resume = !side && info?.mine;
    const btn = h('button', { class: 'btn primary block lg', onclick: async () => {
      btn.disabled = true; err.hidden = true;
      sound.play('start');
      try { resolve(await post('/api/game/start', body)); } catch (e) { err.textContent = e.message; err.hidden = false; btn.disabled = false; }
    } }, resume ? `Nastavi vožnju — pitanje ${Math.min(info.mine.answered + 1, info.mine.question_count)} od ${info.mine.question_count}` : `Kreni — polazak: ${startCity.name}`);
    mount(shell(h('div', { class: 'col intro stack-lg' },
      h('div', { class: 'stack' },
        h('p', { class: 'intro-map' }, withFlag(map), side ? h('span', { class: 'tag' }, query.datum ? `arhiva ${dateShort(query.datum)} — ne računa se` : 'ponovljena partija — ne računa se') : null),
        h('h1', {}, `${startCity.name} → ${goalCity.name}`),
        h('p', { class: 'mono amber' }, `${nf.format(map.route.total_km)} km do cilja · ${info?.questions || g.questions_per_day} pitanja`)),
      h('ul', { class: 'rules' },
        h('li', {}, h('b', {}, `${g.prep_seconds} s`), ' da pročitaš pitanje, zatim ', h('b', {}, `${g.answer_seconds} s`), ' za odgovor.'),
        g.retries ? h('li', {}, 'Nije taj odgovor? Pokušaj ponovno dok traje vrijeme — promašaji se ne broje.') : h('li', {}, 'Na svako pitanje imaš jedan odgovor.'),
        h('li', {}, 'Što rjeđi točan odgovor, to brži prijevoz i više kilometara.'),
        map.route.end_km > map.route.total_km ? h('li', {}, `Prođeš li ${goalCity.name}, put se nastavlja preko granice i kilometri se zbrajaju dalje.`) : null),
      transportStrip(boot.transports),
      h('div', { class: 'stack' }, err, btn, h('p', { class: 'small muted center' }, 'Sat kreće čim pritisneš gumb. Između pitanja možeš predahnuti.'))))); 
    btn.focus({ preventScroll: true });
  });
  if (!boot.me) await loadBoot();
  if (st.session.finished) return go(`/rezultat/${st.session.id}`, true);

  // --- Zaslon igre ---
  let state = st, skew = 0, busy = false, raf = 0, expiryTimer = 0, gone = false;
  const id = st.session.id;
  const stage = mapStage(map);
  const steps = h('div', { class: 'pips', role: 'img' });
  const total = h('b', { class: 'mono' });
  const bar = h('div', { class: 'gbar' }, h('a', { class: 'iconbtn', href: '/', 'aria-label': 'Izađi na naslovnicu', title: 'Izađi' }, '✕'), steps, total);
  const area = h('div', { class: 'qarea' });
  const live = h('div', { class: 'sr', 'aria-live': 'polite' });
  mount(shell(h('div', { class: 'game' }, stage.el, h('div', { class: 'gpanel' }, bar, area, live)), { wide: true, game: true }));
  const offline = () => toast('Nema internetske veze. Sat i dalje teče — odgovor pošalji kad se veza vrati.');
  window.addEventListener('offline', offline);
  const stopTimer = () => { cancelAnimationFrame(raf); clearTimeout(expiryTimer); raf = 0; };
  cleanup = () => { gone = true; stopTimer(); stage.destroy(); window.removeEventListener('offline', offline); };

  const lastTransport = () => [...state.answers].reverse().find((a) => a.transport)?.transport || null;
  const sync = (r) => { state = r; if (r.timing) skew = r.timing.now - Date.now(); };
  const showKm = (k) => { total.textContent = km(k); stage.hud(k); };
  function chrome(current) {
    const s = state.session, cells = [];
    for (let i = 1; i <= s.question_count; i++) {
      const a = state.answers.find((x) => x.position === i);
      cells.push(h('i', { class: a ? (a.km > 0 ? (a.level >= 6 ? 'top' : 'on') : 'zero') : i === current ? 'now' : '' }));
    }
    steps.replaceChildren(...cells);
    steps.setAttribute('aria-label', `Odgovoreno ${state.answers.length} od ${s.question_count} pitanja`);
  }
  const qhead = (q, pos) => h('div', { class: 'qhead' }, h('span', { class: 'chip' }, q.category.emoji, ' ', q.category.name), h('span', { class: 'mono muted' }, `${pos} / ${state.session.question_count}`));
  async function refresh() {
    try { sync(await get(`/api/game/${id}`)); } catch (e) { toast(e.message); return; }
    route();
  }
  /** Odlučuje što prikazati za trenutno stanje s poslužitelja. */
  function route(justFinalized) {
    if (gone) return;
    stopTimer();
    if (justFinalized) return paintOutcome(justFinalized);
    if (state.session.finished) return go(`/rezultat/${id}`, true);
    if (state.question) return paintQuestion();
    paintBetween();
  }

  function paintBetween() {
    chrome(null);
    showKm(state.session.total_km);
    const s = state.session, prev = state.answers[state.answers.length - 1];
    const btn = h('button', { class: 'btn primary block lg', onclick: goNext }, s.next_position === 1 ? 'Prvo pitanje' : 'Dalje');
    fill(area, 
      h('div', { class: 'between stack' },
        prev ? h('p', { class: 'muted' }, prev.status === 'isteklo' ? `Na ${prev.position}. pitanju vrijeme je isteklo — 0 km.` : prev.km > 0 ? `${prev.position}. pitanje: +${nf.format(prev.km)} km.` : `${prev.position}. pitanje: 0 km.`) : null,
        h('h1', { class: 'qtext' }, `Pitanje ${s.next_position} od ${s.question_count}`),
        state.upcoming ? h('p', {}, h('span', { class: 'chip' }, state.upcoming.category.emoji, ' ', state.upcoming.category.name)) : null,
        h('p', { class: 'small muted' }, 'Sat kreće kad pritisneš gumb.'), btn));
    btn.focus({ preventScroll: true });
  }
  async function goNext(e) {
    if (busy) return;
    busy = true; if (e?.target) e.target.disabled = true;
    try { sync(await post(`/api/game/${id}/next`)); route(); }
    catch (err) { toast(err.message); if (e?.target) e.target.disabled = false; }
    finally { busy = false; }
  }

  function paintQuestion() {
    const q = state.question, tm = state.timing, numeric = q.type === 'numeric';
    chrome(q.position);
    showKm(state.session.total_km);
    const msg = h('p', { class: 'fmsg', hidden: true, role: 'alert' });
    const input = h('input', { class: 'ainput', name: 'answer', autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', enterkeyhint: 'send', maxlength: 120, disabled: true,
      inputmode: numeric ? 'decimal' : null, placeholder: 'Pročitaj pitanje…', 'aria-label': numeric ? `Procjena (${q.unit})` : 'Tvoj odgovor' });
    const send = h('button', { class: 'btn primary', type: 'submit', disabled: true }, 'Potvrdi');
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'frame'); svg.setAttribute('aria-hidden', 'true');
    const track = document.createElementNS(NS, 'rect'), ring = document.createElementNS(NS, 'rect');
    track.setAttribute('class', 'track'); ring.setAttribute('class', 'ring'); ring.setAttribute('pathLength', '100');
    svg.append(track, ring);
    const box = h('div', { class: 'abox' }, svg, input, numeric ? h('span', { class: 'unit' }, q.unit) : null, send);
    const fit = () => { for (const r of [track, ring]) { r.setAttribute('x', 2); r.setAttribute('y', 2); r.setAttribute('width', Math.max(0, box.clientWidth - 4)); r.setAttribute('height', Math.max(0, box.clientHeight - 4)); r.setAttribute('rx', 13); } };
    const ro = 'ResizeObserver' in window ? new ResizeObserver(fit) : null;
    const clock = h('span', { class: 'clock mono' }), status = h('span', { class: 'tstatus' });
    const misses = h('div', { class: 'misses' });
    const form = h('form', { class: 'aform is-prep', novalidate: true, onsubmit: (e) => { e.preventDefault(); submit(numeric); } },
      box, h('div', { class: 'trow' }, clock, status), msg, misses);
    const paintMisses = () => misses.replaceChildren(...(state.misses || []).map((m) => h('s', {}, m)));
    const say = (text, kind) => { msg.textContent = text; msg.className = 'fmsg ' + (kind || 'err'); msg.hidden = false; form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); };
    fill(area, qhead(q, q.position), h('h1', { class: 'qtext' }, q.text), q.hint ? h('p', { class: 'qhint' }, q.hint) : null,
      numeric ? h('p', { class: 'qhint' }, `Što bliže stvarnoj brojci, to brži prijevoz. Jedan pokušaj. Stanje na dan ${dateFull(q.ref_date)}`) : null, form);
    fit(); ro?.observe(box);
    paintMisses();

    let phase = '', announced = 99;
    async function submit(final) {
      if (busy || phase !== 'run') return;
      const value = input.value.trim();
      if (!value) { input.focus(); return; }
      busy = true; send.disabled = true; msg.hidden = true;
      try {
        const r = await post(`/api/game/${id}/answer`, { position: q.position, answer: value, final: numeric ? final : undefined });
        sync(r);
        if (r.result) { ro?.disconnect(); sound.play(r.result.km > 0 ? 'accept' : 'zero'); return route(r.result); }
        if (r.ambiguous) { say(r.message, 'warn'); input.focus(); }
        else if (r.retry) { sound.play('wrong'); say(r.message, 'err'); paintMisses(); input.focus(); input.select(); }
      } catch (err) {
        if (err.status === 425) say('Još malo — pričekaj kraj pripreme.', 'warn');
        else if (err.status === 409) { ro?.disconnect(); return refresh(); }
        else say(err.message, 'err');
      } finally { busy = false; if (phase === 'run') send.disabled = false; }
    }
    function tick() {
      if (gone) return;
      const now = Date.now() + skew;
      let next;
      if (now < tm.prep_end) next = 'prep'; else if (now < tm.deadline) next = 'run'; else next = 'over';
      if (next !== phase) {
        phase = next;
        form.classList.toggle('is-prep', phase === 'prep'); form.classList.toggle('is-run', phase === 'run'); form.classList.toggle('is-over', phase === 'over');
        if (phase === 'prep') { status.textContent = 'Pripremi se'; }
        if (phase === 'run') {
          sound.play('go');
          input.disabled = false; send.disabled = false;
          input.placeholder = numeric ? 'Tvoja procjena' : 'Upiši odgovor';
          status.textContent = numeric ? 'Što bliže, to brži prijevoz' : 'Rjeđi odgovor = brži prijevoz';
          input.focus({ preventScroll: true });
        }
        if (phase === 'over') {
          input.disabled = true; send.disabled = true;
          clock.textContent = '0 s'; status.textContent = 'Vrijeme je isteklo';
          ring.style.strokeDashoffset = 100;
          live.textContent = 'Vrijeme je isteklo.';
          sound.play('zero');
          ro?.disconnect();
          // poslužitelj zaključuje pitanje nakon kratke tolerancije; tada dohvaćamo ishod
          const wait = Math.max(300, tm.deadline + 1700 - now);
          expiryTimer = setTimeout(async () => {
            try { sync(await get(`/api/game/${id}`)); } catch { return toast('Nema veze s poslužiteljem. Osvježi stranicu kad se veza vrati.'); }
            const a = state.answers.find((x) => x.position === q.position);
            route(a ? { ...a, type: q.type, unit: q.unit } : null);
          }, wait);
          return;
        }
      }
      if (phase === 'prep') {
        const left = Math.ceil((tm.prep_end - now) / 1000);
        if (clock.textContent !== String(left)) sound.play('count');
        clock.textContent = String(left);
        ring.style.strokeDashoffset = 100 - 100 * clamp01((now - tm.started_at) / Math.max(1, tm.prep_end - tm.started_at));   // okvir se iscrtava
      } else {
        const leftMs = tm.deadline - now, left = Math.ceil(leftMs / 1000);
        if (left <= 5 && left > 0 && clock.textContent !== `${left} s`) sound.play('tick');
        clock.textContent = `${left} s`;
        ring.style.strokeDashoffset = 100 * (1 - clamp01(leftMs / Math.max(1, tm.deadline - tm.prep_end)));                    // okvir nestaje
        form.classList.toggle('is-warn', left <= 10 && left > 5);
        form.classList.toggle('is-hot', left <= 5);
        if ((left === 10 || left === 5) && announced !== left) { announced = left; live.textContent = `Još ${left} sekundi.`; }
      }
      raf = requestAnimationFrame(tick);
    }
    tick();
  }

  function paintOutcome(a) {
    const s = state.session;
    chrome(null);
    const q = { category: a.category || state.answers.find((x) => x.position === a.position)?.category || { name: '', emoji: '' } };
    const numeric = a.type === 'numeric', won = a.km > 0, before = s.total_km - a.km;
    const crossedGoal = won && before < s.route_km && s.total_km >= s.route_km;
    const loc = state.location;
    const passedNow = won && loc?.passed && loc.passed.km > before + 1e-6 ? loc.passed : null;
    const borderNow = won && loc?.beyond && whereOn(map.route, before).passed.country !== loc.country?.code;
    const nextBtn = h('button', { class: 'btn primary block lg', onclick: (e) => (s.finished ? go(`/rezultat/${id}`) : goNext(e)) }, s.finished ? 'Pogledaj rezultat' : 'Dalje');
    const title = numeric ? `${big(a.guess)} ${a.unit || ''}` : a.canonical || a.raw || '—';
    let head;
    if (won) {
      head = h('div', { class: 'out ok' },
        h('span', { class: 'tb big l' + a.level, 'aria-hidden': 'true' }, emojiOf(a.transport)),
        h('div', { class: 'out-mid' }, h('b', {}, title), h('span', {}, a.transport?.name, numeric ? '' : a.rarity != null ? ` · rijetkost ${a.rarity} / 100` : '')),
        h('span', { class: 'out-km mono' }, `+${nf.format(a.km)}`));
    } else {
      const why = a.status === 'isteklo' ? 'Vrijeme je isteklo' : numeric ? 'Predaleko od stvarne brojke' : 'Nije prepoznato';
      head = h('div', { class: 'out zero' },
        h('span', { class: 'tb big l0', 'aria-hidden': 'true' }, '🚧'),
        h('div', { class: 'out-mid' }, h('b', {}, why), h('span', {}, 'Radovi na cesti — ostaješ gdje jesi')),
        h('span', { class: 'out-km mono' }, '+0'));
    }
    const tries = (a.misses || []).map((m) => m.raw);
    fill(area, qhead(q, a.position), head,
      won && !numeric && a.explanation ? h('p', { class: 'muted' }, a.explanation) : null,
      numeric && a.target != null ? h('p', {}, 'Točno: ', h('b', {}, `${big(a.target)} ${a.unit}`), a.error_pct != null ? ` — tvoja procjena odstupa ${num(a.error_pct)} %` : '', a.is_estimate ? ' (procijenjena vrijednost)' : '') : null,
      numeric && a.target != null && a.target_note ? h('p', { class: 'small muted' }, a.target_note) : null,
      !won && !numeric && tries.length ? h('p', { class: 'muted' }, 'Upisao si: ', tries.join(', '), '. Ako misliš da je nešto od toga točno, prijavi to na kraju partije.') : null,
      !won && a.status === 'isteklo' && !tries.length && !numeric ? h('p', { class: 'muted' }, 'Nisi poslao nijedan odgovor.') : null,
      won && tries.length ? h('p', { class: 'small muted' }, `Pogođeno iz ${tries.length + 1}. pokušaja.`) : null,
      crossedGoal ? h('p', { class: 'notice goal' }, `🏁 ${map.route.points[map.route.goal_index].name}! Cilj je iza tebe — put ide dalje.`) : null,
      borderNow ? h('p', { class: 'notice' }, flag(loc.country.code), ` Prešao si granicu: ${loc.country.name}.`) : null,
      
      h('div', { class: 'out-next' }, nextBtn));
    if (won) {
      stage.toast(h('div', { class: 'toast-in' }, h('span', { class: 'tb l' + a.level }, emojiOf(a.transport)), h('span', {}, h('b', {}, title), h('small', {}, a.transport?.name || '')), h('b', { class: 'mono amber' }, `+${nf.format(a.km)} km`)), 5200);
      sound.play('transport', { level: a.level });
      if (a.level >= 6) sound.play('rare');
      stage.rmap.travel(s.total_km, a.transport, {
        onStart: (ms) => sound.play('vehicle', { level: a.level, duration: ms / 1000 }), onProgress: showKm,
        onDone: () => { showKm(s.total_km); if (crossedGoal) sound.play('goal'); else if (borderNow) sound.play('beyond'); if (s.finished) setTimeout(() => sound.play('finish'), crossedGoal ? 1400 : 300); },
        onArrive: (p) => stage.arrive(p) });
    } else {
      showKm(s.total_km);
      stage.rmap.setMe(s.total_km, lastTransport());
      if (s.finished) setTimeout(() => sound.play('finish'), 700);
    }
    nextBtn.focus({ preventScroll: true });
  }

  stage.rmap.setMe(state.session.total_km, lastTransport());
  sync(st);
  route();
}

// ---------- Rezultat ----------
function shareText(r, map) {
  const stops = r.answers.map((a) => (a.km > 0 ? a.transport?.emoji || '🟩' : '🚧')).join('');
  const startName = map.route.points[0].name;
  const goalName = map.route.points[map.route.goal_index].name, at = r.location?.passed;
  const atName = at ? (at.label === 'granica' ? `granica (${at.country?.name || ''})` : at.name) : '';
  const where = r.location?.beyond ? `prošao ${goalName} i vozio još ${nf.format(Math.round(r.session.total_km - map.route.total_km))} km${atName && atName !== goalName ? ` — do: ${atName} ${at.country?.flag || ''}` : ''}`
    : r.session.reached_goal ? `stigao u ${goalName} 🏁` : `${startName} → ${atName}`;
  return `${boot.site.name} ${map.flag} ${dateShort(r.session.date)}\n${nf.format(Math.round(r.session.total_km))} km — ${where}\n${stops}\n${location.origin}`;
}
async function viewResult([id]) {
  if (!boot) await loadBoot();
  const r = await get(`/api/game/${id}/result`);
  const map = await get(`/api/map/${r.session.map}`);
  const s = r.session, c = r.comparison, loc = r.location, route = map.route;
  const startCity = route.points[0], goalCity = route.points[route.goal_index];
  const abroad = !!loc?.country && loc.country.code !== goalCity.country;
  const stage = mapStage(map, { result: true });
  const text = shareText(r, map);
  const share = async () => {
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); toast('Rezultat je kopiran. Zalijepi ga prijateljima.'); } }
    catch { /* korisnik je odustao */ }
  };
  const report = (a, m) => h('button', { class: 'linkbtn', onclick: async (e) => { try { await post(`/api/game/${id}/report`, { position: a.position, raw: m.raw }); e.target.replaceWith(h('span', { class: 'muted' }, 'prijavljeno')); } catch (err) { toast(err.message); } } }, 'prijavi kao točan');
  const item = (a) => {
    const numeric = a.type === 'numeric', won = a.km > 0;
    const extra = [];
    if (numeric && a.target != null) extra.push(h('p', {}, `${a.is_estimate ? 'Procijenjena vrijednost' : 'Točno'}: `, h('b', {}, `${big(a.target)} ${a.unit}`), ` (stanje ${dateFull(a.ref_date)})`, a.error_pct != null ? `, tvoja pogreška ${num(a.error_pct)} %` : '', a.bonus ? ' — najbliža procjena dana' : ''));
    if (numeric && a.target == null) extra.push(h('p', { class: 'muted' }, 'Točna brojka stiže kad odigraš obje karte ili u ponoć.'));
    if (!numeric && won && a.explanation) extra.push(h('p', { class: 'muted' }, a.explanation));
    if (!numeric && won && a.rarity != null) extra.push(h('p', {}, `Rijetkost ${a.rarity} / 100`, a.attempts > 1 ? ` · pogođeno iz ${a.attempts}. pokušaja` : '', a.answer_ms != null ? ` · ${num(Math.round(a.answer_ms / 100) / 10)} s` : ''));
    if (a.misses?.length) extra.push(h('p', {}, 'Nepriznato: ', a.misses.map((m, i) => [i ? ', ' : '', h('span', {}, `„${m.raw}“ `), m.reported ? h('span', { class: 'muted' }, '(prijavljeno)') : won ? null : report(a, m)])));
    if (a.top_answers?.length) extra.push(h('p', {}, 'Najčešće: ', a.top_answers.map((t) => `${t.answer} ${t.share} %`).join(', '), `. U bazi je ${a.base_size} točnih odgovora.`));
    if (a.correct_share != null && a.players > 1) extra.push(h('p', { class: 'muted' }, `Točno je odgovorilo ${a.correct_share} % igrača.`));
    const answer = numeric ? (a.guess != null ? `${big(a.guess)} ${a.unit}` : 'bez procjene') : won ? a.canonical : a.status === 'isteklo' ? (a.misses?.length ? 'vrijeme je isteklo' : 'bez odgovora') : a.raw || 'bez odgovora';
    return h('details', { class: 'rrow' + (won ? '' : ' zero') },
      h('summary', {},
        h('span', { class: 'tb l' + (won ? a.level : 0), 'aria-hidden': 'true' }, won ? emojiOf(a.transport) : '🚧'),
        h('span', { class: 'rmid' }, h('small', {}, `${a.position}. ${a.category?.name || ''}`), h('b', {}, answer), won ? h('small', { class: 'muted' }, a.transport?.name) : null),
        h('span', { class: 'rkm mono' }, `+${nf.format(a.km)}`)),
      h('div', { class: 'rmore' }, h('p', { class: 'rq' }, a.question), extra));
  };
  // Raspodjela: gdje su danas stali igrači
  const maxBin = Math.max(1, ...c.bins.map((b) => b.count));
  const myBin = Math.min(c.bins.length - 1, Math.floor(s.total_km / c.step));
  const marks = [[0, startCity.name], [route.total_km, goalCity.name]];
  if (route.end_km > route.total_km) marks.push([route.end_km, route.points[route.points.length - 1].name]);
  const histo = h('div', { class: 'histo' },
    h('div', { class: 'bars', role: 'img', 'aria-label': `Raspodjela ${c.players} igrača po prijeđenim kilometrima` }, c.bins.map((b, i) => h('i', { class: (i === myBin ? 'me' : '') + (b.from >= route.total_km ? ' ext' : ''), style: `height:${b.count ? 12 + (b.count / maxBin) * 88 : 3}%`, title: `${b.from}–${b.from + c.step} km: ${b.count}` }))),
    h('div', { class: 'axis mono' }, marks.map(([k, name]) => h('span', { style: `left:${(k / (c.bins.length * c.step)) * 100}%` }, name, h('small', {}, nf.format(k))))));
  const other = boot.maps.find((m) => m.slug !== s.map && m.has_challenge);
  const headline = loc?.beyond ? `Prošao si ${goalCity.name} i nastavio dalje` : s.reached_goal ? (boot.site.messages.goal || 'Stigao si do cilja!') : 'Kraj puta za danas';
  const sub = loc?.at_end ? 'Došao si do kraja karte. Dalje se danas ne može.'
    : loc?.next ? `Do sljedeće postaje (${loc.next.label === 'granica' ? `granica — ${loc.next.country?.name}` : loc.next.name}) falilo je ${km(loc.next.left)}.` : '';
  const better = c.further_than_pct;
  const replayBtn = h('button', { class: 'btn sm', onclick: () => replay() }, '↻ Ponovi vožnju');
  mount(shell(h('div', { class: 'col stack-lg' },
    h('div', { class: 'stage-wrap' }, stage.el, h('div', { class: 'stage-actions' }, replayBtn)),
    h('div', { class: 'row spread wrapline' }, h('p', { class: 'kicker' }, headline), h('p', { class: 'small muted' }, s.official ? ['Nova ruta za ', countdown(boot.next_reset)] : (s.mode === 'arhiva' ? `Arhiva ${dateShort(s.date)} — ne računa se` : 'Ponovljena partija — ne računa se'))),
    h('div', { class: 'arrive' },
      h('div', { class: 'arrive-top mono' }, withFlag(map, ''), `${startCity.name} → ${nf.format(Math.round(s.total_km))} km`),
      h('div', { class: 'arrive-town' }, abroad ? flag(loc.country.code, loc.country.name) : null, loc?.passed?.label === 'granica' ? 'Granica' : loc?.passed?.name || startCity.name),
      loc?.passed?.nickname ? h('div', { class: 'arrive-nick' }, loc.passed.nickname) : null,
      h('div', { class: 'arrive-facts' },
        h('span', {}, s.reached_goal ? `🏁 Cilj (${goalCity.name}) dosegnut` : `Do cilja (${goalCity.name}) još ${km(loc?.goal?.left ?? 0)}`),
        loc?.beyond ? (abroad ? h('span', {}, flag(loc.country.code), ` Nastavio u: ${loc.country.name} — ${km(s.total_km - route.total_km)} iza cilja`) : h('span', {}, `${km(s.total_km - route.total_km)} iza cilja, prema granici`)) : null)),
    sub ? h('p', { class: 'muted' }, sub) : null,
    h('div', { class: 'row wrapline' },
      h('button', { class: 'btn amber', onclick: share }, 'Podijeli rezultat'),
      s.official && other && !other.mine?.finished ? h('a', { class: 'btn primary', href: `/igra/${other.slug}` }, withFlag(other, `Odigraj i kartu ${other.name}`)) : null,
      h('a', { class: 'btn', href: `/igra/${s.map}?ponovno=1${s.official || s.mode === 'ponovno' ? '' : '&datum=' + s.date}` }, 'Igraj ponovno (ne računa se)')),
    s.official && s.date === boot.date ? signpostCard(s) : null,
    boot.me?.is_guest && s.official ? h('div', { class: 'card stack' }, h('h3', {}, 'Igraš kao gost'), h('p', {}, c.rank ? `S ovim rezultatom danas si ${c.rank}. od ${c.players}. ` : '', 'Registriraj se i ovaj rezultat ostaje na tvom računu, a niz dana ti se počinje brojati.'), h('a', { class: 'btn', href: '/prijava' }, 'Spremi rezultat na račun')) : null,
    c.players ? h('section', { class: 'card stack' },
      h('h2', {}, better != null ? `Stigao si dalje od ${better} % igrača` : 'Prvi si danas na ovoj ruti'),
      h('p', { class: 'small muted' }, 'Gdje su danas stali igrači'),
      histo,
      h('div', { class: 'stats' },
        h('div', { class: 'stat' }, h('b', {}, `${s.official ? c.rank : c.would_rank}.`), h('span', {}, s.official ? `mjesto od ${c.players}` : 'bio bi u službenoj ljestvici')),
        h('div', { class: 'stat' }, h('b', {}, nf.format(Math.round(c.avg_km))), h('span', {}, 'prosjek igrača (km)')),
        h('div', { class: 'stat' }, h('b', {}, nf.format(Math.round(c.max_km))), h('span', {}, 'najdalje danas (km)')),
        h('div', { class: 'stat' }, h('b', {}, r.streak.current), h('span', {}, 'dana zaredom')))) : null,
    h('section', { class: 'stack' }, h('h2', {}, `Tvojih ${r.answers.length} odgovora`),
      h('div', { class: 'rlist' }, r.answers.map(item)),
      r.spoilers_unlocked ? null : h('p', { class: 'small muted' }, 'Najčešće odgovore drugih igrača i točne brojke vidiš kad odigraš obje karte ili kad dan završi.')),
    h('section', { class: 'card stack' }, h('h2', {}, 'Kartica rezultata'), h('pre', { class: 'sharecard mono' }, text), h('div', { class: 'row' }, h('button', { class: 'btn amber', onclick: share }, navigator.share ? 'Podijeli' : 'Kopiraj'))),
    h('div', { class: 'row wrapline' }, h('a', { class: 'btn', href: '/ljestvica?karta=' + s.map + (s.official ? '' : '&datum=' + s.date) }, 'Ljestvica dana'), h('a', { class: 'btn', href: '/' }, 'Naslovnica')))));
  const lastT = [...r.answers].reverse().find((a) => a.transport)?.transport || null;
  stage.rmap.setMe(s.total_km, lastT);
  stage.hud(s.total_km);
  let timers = [];
  /** Ponavlja cijelo putovanje: skok po skok, redom kojim su pitanja odgovorena. */
  function replay() {
    timers.forEach(clearTimeout); timers = [];
    const hops = r.answers.filter((a) => a.km > 0);
    stage.rmap.setMe(0, hops[0]?.transport || null); stage.hud(0);
    let at = 0;
    const step = (i) => {
      if (i >= hops.length) { sound.play('finish'); timers.push(setTimeout(() => stage.rmap.setMode('overview'), 600)); return; }
      const a = hops[i]; at += a.km;
      stage.toast(h('div', { class: 'toast-in' }, h('span', { class: 'tb l' + a.level }, emojiOf(a.transport)), h('span', {}, h('b', {}, a.type === 'numeric' ? `${big(a.guess)} ${a.unit}` : a.canonical), h('small', {}, a.transport?.name || '')), h('b', { class: 'mono amber' }, `+${nf.format(a.km)} km`)), 2600);
      stage.rmap.travel(at, a.transport, { onStart: (ms) => sound.play('vehicle', { level: a.level, duration: ms / 1000 }), onProgress: (k) => stage.hud(k), onArrive: (p) => stage.arrive(p), onDone: () => timers.push(setTimeout(() => step(i + 1), 500)) });
    };
    stage.rmap.setMode('follow');
    timers.push(setTimeout(() => step(0), 500));
  }
  cleanup = () => { timers.forEach(clearTimeout); stage.destroy(); };
  loadBoot().catch(() => {});
}

// ---------- Ljestvica ----------
function whoCell(row) { return h('div', { class: 'who' }, avatar(row), h('a', { href: `/igrac/${encodeURIComponent(row.nickname)}` }, row.nickname)); }
async function viewBoard(_, query) {
  const mapSlug = query.karta || boot.maps[0]?.slug;
  const period = query.razdoblje || 'dan';
  const date = query.datum || boot.date;
  const link = (o) => { const q = new URLSearchParams({ karta: mapSlug, razdoblje: period, datum: date, ...o }); if (q.get('datum') === boot.date) q.delete('datum'); return '/ljestvica?' + q; };
  const seg = (items, current, key) => h('div', { class: 'seg', role: 'group' }, items.map(([v, label]) => h('button', { 'aria-pressed': String(v === current), onclick: () => go(link({ [key]: v }), true) }, label)));
  let table;
  if (period === 'dan') {
    const d = await get(`/api/leaderboard?map=${mapSlug}&date=${date}`);
    table = h('div', { class: 'stack' },
      h('div', { class: 'row spread' }, h('a', { class: 'btn sm', href: link({ datum: shift(date, -1) }) }, 'Dan prije'), h('b', {}, cap(dateLong(date))), date < boot.date ? h('a', { class: 'btn sm', href: link({ datum: shift(date, 1) }) }, 'Dan poslije') : h('span', { style: 'width:88px' })),
      d.me ? h('p', { class: 'notice' }, d.me.listed ? `Ti si ${d.me.rank}. od ${d.total} s ${km(d.me.km)}.` : `Kao gost nisi na ljestvici. S ${km(d.me.km)} bio bi ${d.me.rank}. — `, d.me.listed ? null : h('a', { href: '/prijava' }, 'registriraj se')) : null,
      d.rows.length ? h('div', { class: 'panel flush scroll-x' }, h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Igrač'), h('th', { class: 'r' }, 'Prijeđeno'))),
        h('tbody', {}, d.rows.map((r) => h('tr', { class: boot.me && r.user_id === boot.me.id ? 'me' : null }, h('td', { class: 'rank' }, r.rank + '.'), h('td', {}, whoCell(r)), h('td', { class: 'r num' }, km(r.km), r.reached_goal ? ' 🏁' : ''))))))
        : h('p', {}, date === boot.date ? 'Još nitko nije završio današnju rutu na ovoj karti. Budi prvi.' : 'Taj dan nitko nije igrao ovu kartu.'));
  } else {
    const d = await get(`/api/leaderboard/total?map=${mapSlug}&period=${period === 'mjesec' ? 'mjesec' : 'sve'}`);
    table = d.rows.length ? h('div', { class: 'panel flush scroll-x' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Igrač'), h('th', { class: 'r' }, 'Ukupno'), h('th', { class: 'r' }, 'Partija'), h('th', { class: 'r' }, 'Prosjek'), h('th', { class: 'r' }, 'U cilju'))),
      h('tbody', {}, d.rows.map((r) => h('tr', { class: boot.me && r.user_id === boot.me.id ? 'me' : null }, h('td', { class: 'rank' }, r.rank + '.'), h('td', {}, whoCell(r)), h('td', { class: 'r num' }, km(r.km)), h('td', { class: 'r' }, r.games), h('td', { class: 'r' }, nf.format(Math.round(r.avg))), h('td', { class: 'r' }, r.goals))))))
      : h('p', {}, 'Još nema odigranih partija u ovom razdoblju.');
  }
  mount(shell(h('div', { class: 'stack' }, h('h1', {}, 'Ljestvica'),
    h('div', { class: 'row wrapline' }, seg(boot.maps.map((m) => [m.slug, withFlag(m)]), mapSlug, 'karta'), seg([['dan', 'Dan'], ['mjesec', 'Mjesec'], ['sve', 'Ukupno']], period, 'razdoblje')),
    table, h('p', { class: 'small muted' }, 'Na ljestvicu ulazi samo prva, službena partija dana registriranih igrača.'))));
}

// ---------- Lige ----------
const needAccount = (what) => h('div', { class: 'board stack' }, h('h2', {}, 'Treba ti račun'), h('p', {}, what), h('a', { class: 'btn', href: '/prijava' }, 'Prijavi se ili registriraj'));
async function viewLeagues() {
  if (!boot.me || boot.me.is_guest) return mount(shell(h('div', { class: 'stack' }, h('h1', {}, 'Lige s prijateljima'), needAccount('Lige čuvaju rezultate tebe i tvojih prijatelja iz dana u dan, pa za njih treba račun. Dosadašnje partije ostaju tvoje.'))));
  const { leagues } = await get('/api/leagues');
  const name = h('input', { class: 'input', maxlength: 40, placeholder: 'npr. Kvart protiv svih', 'aria-label': 'Naziv nove lige' });
  const code = h('input', { class: 'input', maxlength: 8, placeholder: 'Kod, npr. K7M2QX', style: 'text-transform:uppercase', 'aria-label': 'Pozivni kod' });
  mount(shell(h('div', { class: 'stack-lg' }, h('h1', {}, 'Lige s prijateljima'),
    leagues.length ? h('div', { class: 'panel flush' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Liga'), h('th', { class: 'r' }, 'Članova'), h('th', { class: 'r' }, 'Igralo danas'))),
      h('tbody', {}, leagues.map((l) => h('tr', {}, h('td', {}, h('a', { href: `/lige/${l.id}`, style: 'font-weight:800' }, l.name)), h('td', { class: 'r' }, l.members), h('td', { class: 'r' }, l.played_today))))))
      : h('p', {}, 'Još nisi ni u jednoj ligi. Napravi svoju ili upiši kod koji ti je poslao prijatelj.'),
    h('form', { class: 'panel stack', onsubmit: async (e) => { e.preventDefault(); try { const l = await post('/api/leagues', { name: name.value }); go(`/lige/${l.id}`); } catch (err) { toast(err.message); } } },
      h('h2', {}, 'Napravi ligu'), h('label', { class: 'field' }, h('span', {}, 'Naziv lige'), name), h('button', { class: 'btn primary' }, 'Napravi ligu')),
    h('form', { class: 'panel stack', onsubmit: async (e) => { e.preventDefault(); try { const l = await post('/api/leagues/join', { code: code.value }); go(`/lige/${l.id}`); } catch (err) { toast(err.message); } } },
      h('h2', {}, 'Pridruži se ligi'), h('label', { class: 'field' }, h('span', {}, 'Pozivni kod'), code), h('button', { class: 'btn' }, 'Pridruži se')))));
}
async function viewJoin([code]) {
  if (!boot.me || boot.me.is_guest) { sessionStorage.setItem('ont_join', code); return mount(shell(h('div', { class: 'stack' }, h('h1', {}, 'Pozvan si u ligu'), needAccount('Prijavi se ili registriraj i odmah ulaziš u ligu.')))); }
  const l = await post('/api/leagues/join', { code });
  toast(`Ušao si u ligu ${l.name}.`);
  go(`/lige/${l.id}`, true);
}
/** Prozor s pozivnicom u ligu: kod, poveznica, dijeljenje preko sustava uređaja ili kopiranje. */
function inviteDialog(l) {
  const link = `${location.origin}/liga/${l.code}`;
  const text = `Pozivam te u moju Ontale ligu „${l.name}“! Pridruži se ekipi i natječimo se tko će dalje stići. Kod: ${l.code}`;
  const copy = async (value, msg) => { try { await navigator.clipboard.writeText(value); toast(msg); } catch { toast('Kopiranje nije uspjelo — označi tekst i kopiraj ručno.'); } };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: `Ontale liga ${l.name}`, text, url: link }); } catch { /* odustao */ } }
    else copy(`${text}\n${link}`, 'Poziv je kopiran. Zalijepi ga u poruku.');
  };
  const dlg = h('dialog', { class: 'invite', 'aria-label': 'Pozovi ekipu' },
    h('div', { class: 'inv-card' }, logo(), h('small', {}, 'Poziv u ligu'), h('b', { class: 'inv-name' }, l.name), h('div', { class: 'inv-code mono', 'aria-label': 'Pozivni kod' }, l.code), h('span', { class: 'inv-link mono' }, link.replace(/^https?:\/\//, ''))),
    h('p', { class: 'small muted' }, 'Prijatelj otvori poveznicu i prijavi se — odmah je u ligi. Može i ručno: Lige → „Imam kod“ → upiše kod.'),
    h('div', { class: 'stack' },
      h('button', { class: 'btn primary block', onclick: share }, navigator.share ? 'Podijeli poziv' : 'Kopiraj cijeli poziv'),
      h('div', { class: 'row' }, h('button', { class: 'btn', style: 'flex:1', onclick: () => copy(link, 'Poveznica je kopirana.') }, 'Kopiraj poveznicu'), h('button', { class: 'btn', style: 'flex:1', onclick: () => copy(l.code, 'Kod je kopiran.') }, 'Kopiraj kod')),
      h('button', { class: 'btn sm', onclick: () => dlg.close() }, 'Zatvori')));
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  document.body.append(dlg);
  dlg.showModal();
}
const medal = (rank) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`);
const DAYS = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned'];
const who = (p) => h('span', { class: 'who' + (p.self ? ' self' : '') }, avatar(p), h('span', {}, p.self ? 'Ti' : p.nickname));

async function viewLeague([id], query) {
  if (!boot) await loadBoot();
  const tab = query.tab || 'danas', date = query.datum;
  const qs = (o) => { const p = { tab, karta: query.karta, datum: date, mjesec: query.mjesec, ...o }; return `/lige/${id}?` + Object.entries(p).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&'); };
  const [l, st, aw] = await Promise.all([
    get(`/api/leagues/${id}${date ? '?date=' + date : ''}`),
    get(`/api/leagues/${id}/stats?period=${tab === 'nagrade' ? 'danas' : tab}${query.karta ? '&map=' + query.karta : ''}${date ? '&date=' + date : ''}${query.mjesec ? '&month=' + query.mjesec : ''}`),
    tab === 'nagrade' ? get(`/api/leagues/${id}/awards`) : null]);
  const mapSlug = st.map;
  const map = await get(`/api/map/${mapSlug}`);
  const route = map.route, end = route.end_km;
  const mapEl = h('div', { class: 'mapbox' });
  const mapSeg = h('div', { class: 'seg' }, st.maps.map((m) => h('button', { 'aria-pressed': String(m.slug === mapSlug), onclick: () => go(qs({ karta: m.slug }), true) }, withFlag(m))));

  // ----- utrka: vodoravna ruta s položajima članova -----
  const racers = st.race[mapSlug] || [];
  const far = Math.max(route.total_km, ...racers.map((r) => r.km));
  const span = far > route.total_km ? Math.min(end, Math.ceil((far + 80) / 100) * 100) : route.total_km;
  const pct = (k) => `${Math.min(100, (k / span) * 100)}%`;
  const majors = route.points.filter((p, i) => p.is_stop && p.km <= span && (i === 0 || p.is_goal || p.label === 'granica' || ['Zagreb', 'Pula', 'Split', 'Zadar', 'Banja Luka', 'Bihać', 'Sarajevo', 'Mostar', 'Dubrovnik', 'Budva', 'Podgorica', 'Rijeka'].includes(p.name)));
  for (let i = majors.length - 2; i > 0; i--) if (!majors[i].is_goal && (majors[i + 1].km - majors[i].km) / span < 0.075 || (majors[i].km - majors[i - 1].km) / span < 0.06 && !majors[i].is_goal) majors.splice(i, 1);   // bez preklapanja natpisa
  if (majors.length > 2 && !majors.at(-1).is_goal && (majors.at(-1).km - majors.at(-2).km) / span < 0.14) majors.pop();   // zadnja postaja preblizu cilju
  const signInfo = l.signs?.[mapSlug] || { signs: [], locked: false };
  const signOf = new Map(signInfo.signs.map((x) => [x.user_id, x]));
  const raceTrack = h('div', { class: 'race-track' + (signInfo.signs.length ? ' with-signs' : ''), role: 'img', 'aria-label': `Položaji članova lige na ruti ${route.name}` },
      h('i', { class: 'race-line' }), span > route.total_km ? h('i', { class: 'race-line ext', style: `left:${pct(route.total_km)}` }) : null,
      racers.map((r, i) => {
        const sg = signOf.get(r.user_id);
        return [sg ? h('div', { class: 'race-sign', style: `left:${pct(sg.km)}`, title: sg.text ? `${r.nickname}: ${sg.text}` : `${r.nickname} je ostavio putokaz` }, roadSign(sg.text ?? '🪧 · · ·', sg.shape, { mini: true, placeholder: !sg.text }), h('i', { class: 'ps-pole' })) : null,
          h('span', { class: 'racer' + (r.self ? ' self' : '') + (i % 2 && !sg ? ' low' : ''), style: `left:${pct(r.km)}`, title: `${r.nickname} — ${km(r.km)}` }, avatar(r))];
      }));
  const race = h('div', { class: 'race' },
    raceTrack,
    h('div', { class: 'race-stops' }, majors.map((p, i) => h('span', { style: `left:${pct(p.km)}`, class: p.is_goal ? 'goal' : i === 0 || i === majors.length - 1 ? '' : 'minor' }, p.country !== route.points[0].country ? flag(p.country) : null, p.label === 'granica' ? 'granica' : p.name))),
    h('div', { class: 'race-list' }, racers.map((r) => h('span', { class: 'rchip' + (r.self ? ' self' : '') }, avatar(r), h('b', {}, r.self ? 'Ti' : r.nickname), h('span', { class: 'mono' }, km(r.km)), r.goal ? ' 🏁' : '')),
      st.not_played.length ? h('span', { class: 'rchip muted' }, 'Još nisu igrali: ', st.not_played.slice(0, 8).join(', '), st.not_played.length > 8 ? '…' : '') : null),
    signInfo.locked && signInfo.signs.some((x) => !x.text) ? h('p', { class: 'small muted' }, '🪧 ', signInfo.signs.filter((x) => !x.text).map((x) => x.nickname).join(', '), signInfo.signs.filter((x) => !x.text).length > 1 ? ' su ostavili putokaze.' : ' je ostavio putokaz.', ' Odigraj današnju partiju na ovoj karti da ih vidiš.') : null,
    signInfo.signs.some((x) => x.text && !x.self) ? h('details', { class: 'ps-list' }, h('summary', { class: 'small muted' }, `Putokazi (${signInfo.signs.filter((x) => x.text).length})`),
      signInfo.signs.filter((x) => x.text).map((x) => h('div', { class: 'row spread wrapline ps-row' }, h('span', { class: 'who' }, avatar(x), h('b', {}, x.self ? 'Ti' : x.nickname), ' ', roadSign(x.text, x.shape, { mini: true })),
        x.self ? null : h('span', { class: 'row' }, h('button', { class: 'linkbtn', onclick: async () => { await post(`/api/signs/${x.id}/hide`); toast('Putokaz je sakriven.'); render(); } }, 'sakrij'),
          h('button', { class: 'linkbtn', onclick: async () => { const reason = prompt('Što nije u redu s ovim putokazom?'); if (reason == null) return; await post(`/api/signs/${x.id}/report`, { reason }); toast('Prijavljeno. Putokaz ti je sakriven.'); render(); } }, 'prijavi'))))) : null);

  // ----- tablica razdoblja -----
  const leaderKm = st.table[0]?.km || 0;
  const periodTable = (cols) => h('div', { class: 'panel flush scroll-x' }, h('table', { class: 'table ltable' },
    h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Igrač'), cols.map(([label, , title]) => h('th', { class: 'r', title }, label)))),
    h('tbody', {}, st.table.map((r) => h('tr', { class: r.self ? 'me' : null }, h('td', { class: 'rank' }, r.km > 0 ? medal(r.rank) : '—'),
      h('td', {}, h('span', { class: 'who' }, avatar(r), h('a', { href: `/igrac/${encodeURIComponent(r.nickname)}` }, r.nickname), r.km > 0 && r.km === leaderKm ? h('span', { title: 'Vodi' }, ' 👑') : null)),
      cols.map(([, f]) => h('td', { class: 'r num' }, f(r))))))));
  const COLS = { km: ['km', (r) => nf.format(Math.round(r.km))], days: ['dana', (r) => r.days], avg: ['prosjek', (r) => nf.format(Math.round(r.avg)), 'Prosjek po partiji'], best: ['najbolje', (r) => nf.format(Math.round(r.best)), 'Najbolja partija'],
    wins: ['🏆', (r) => r.wins, 'Dani kad je stigao najdalje u ligi'], goals: ['🏁', (r) => r.goals, 'Dolasci do cilja'], streak: ['🔥', (r) => r.streak, 'Niz dana'], games: ['partija', (r) => r.games] };
  const bars = (items, label) => {
    const max = Math.max(1, ...items.map((x) => x.avg || 0));
    return h('div', { class: 'vbars', role: 'img', 'aria-label': 'Prosjek kilometara po danu' }, items.map((x, i) => h('div', { class: 'vb' + (x.date === st.today ? ' today' : '') + (x.avg == null ? ' none' : '') },
      h('b', { class: 'mono' }, x.avg == null ? '' : nf.format(x.avg)), h('i', { style: `height:${x.avg == null ? 2 : Math.max(4, (x.avg / max) * 100)}%` }), h('span', {}, label(x, i)))));
  };
  const teamCards = (items) => h('div', { class: 'stats' }, items.map(([v, t]) => h('div', { class: 'stat' }, h('b', {}, v), h('span', {}, t))));
  const empty = (t) => h('p', { class: 'notice' }, t);
  let body;
  if (tab === 'danas') {
    const reactCell = (m, slug) => {
      const s = m.maps[slug];
      if (!s) return h('span', { class: 'muted' }, '—');
      const mine = s.reactions.find((r) => r.mine)?.emoji;
      const btns = m.self ? s.reactions.map((r) => h('span', { class: 'small' }, `${r.emoji} ${r.count} `)) : l.reactions.map((em) => {
        const cnt = s.reactions.find((r) => r.emoji === em)?.count || 0;
        return h('button', { class: mine === em ? 'mine' : '', 'aria-label': `Reakcija ${em}`, onclick: async () => { try { await post('/api/reactions', { session_id: s.session_id, emoji: mine === em ? null : em }); render(); } catch (e) { toast(e.message); } } }, em, cnt ? ' ' + cnt : '');
      });
      return h('div', {}, h('span', { class: 'num' }, km(s.km)), s.reached_goal ? ' 🏁' : '', h('div', { class: 'react', style: 'margin-top:4px' }, btns));
    };
    body = [h('div', { class: 'row spread' }, h('a', { class: 'btn sm', href: qs({ datum: shift(l.date, -1) }) }, 'Dan prije'), h('b', {}, cap(dateLong(l.date))), l.date < l.today ? h('a', { class: 'btn sm', href: qs({ datum: shift(l.date, 1) === l.today ? null : shift(l.date, 1) }) }, 'Dan poslije') : h('span', { style: 'width:88px' })),
      h('p', { class: 'small muted' }, `Odigralo ${l.members.filter((m) => Object.keys(m.maps).length).length} od ${l.members.length} članova.`),
      h('div', { class: 'panel flush scroll-x' }, h('table', { class: 'table ltable' },
        h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Igrač'), l.maps.map((m) => h('th', {}, withFlag(m))), h('th', { class: 'r' }, 'Dan'), h('th', { 'aria-label': 'Radnje' }))),
        h('tbody', {}, l.members.map((m, i) => h('tr', { class: m.self ? 'me' : null }, h('td', { class: 'rank' }, m.day_km > 0 ? medal(i + 1) : '—'), h('td', {}, whoCell(m)), l.maps.map((mp) => h('td', {}, reactCell(m, mp.slug))), h('td', { class: 'r num' }, km(m.day_km)),
          h('td', { class: 'acts' }, m.self ? null : [h('button', { class: 'iconbtn sm', title: `Pošalji poruku: ${m.nickname}`, 'aria-label': `Pošalji poruku igraču ${m.nickname}`, onclick: () => openConversationWith(m.user_id) }, '✉️'),
            h('a', { class: 'iconbtn sm', href: `/izazovi?protiv=${encodeURIComponent(m.nickname)}&karta=${mapSlug}`, title: `Izazovi: ${m.nickname}`, 'aria-label': `Izazovi igrača ${m.nickname}` }, '🥊')]))))))];
  } else if (tab === 'tjedan') {
    body = [h('p', { class: 'small muted' }, `Tjedan ${dateShort(st.from)} – ${dateShort(st.to)} · prosjek km po partiji, po danu`), bars(st.chart, (x, i) => DAYS[i]),
      st.team.games ? periodTable([COLS.km, COLS.days, COLS.avg, COLS.best, COLS.wins, COLS.streak]) : empty('Ovaj tjedan još nitko nije odigrao partiju.')];
  } else if (tab === 'mjesec') {
    const prev = (ym, d) => { const [y, m] = ym.split('-').map(Number); const dt = new Date(Date.UTC(y, m - 1 + d, 1)); return dt.toISOString().slice(0, 7); };
    const name = cap(new Intl.DateTimeFormat('hr-HR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(st.month + '-15T00:00:00Z')));
    body = [h('div', { class: 'row spread' }, st.has_prev ? h('a', { class: 'btn sm', href: qs({ mjesec: prev(st.month, -1) }) }, 'Prethodni') : h('span', { style: 'width:88px' }), h('b', {}, name), st.month < st.today.slice(0, 7) ? h('a', { class: 'btn sm', href: qs({ mjesec: prev(st.month, 1) }) }, 'Sljedeći') : h('span', { style: 'width:88px' })),
      teamCards([[nf.format(st.team.km), 'km cijele ekipe'], [st.team.games, 'odigranih partija'], [nf.format(st.team.avg), 'prosjek po partiji'], [st.team.goals, '🏁 dolazaka do cilja']]),
      st.team.games ? [bars(st.chart, (x) => Number(x.date.slice(8))), periodTable([COLS.km, COLS.days, COLS.avg, COLS.best, COLS.goals, COLS.wins])] : empty('U ovom mjesecu nema odigranih partija.')];
  } else if (tab === 'ukupno') {
    body = [teamCards([[nf.format(st.team.km), 'km svih članova'], [st.team.games, 'odigranih partija'], [nf.format(st.team.avg), 'prosjek po partiji'], [nf.format(st.team.best), 'najbolja partija (km)'], [st.team.goals, '🏁 dolazaka do cilja'], [st.team.best_streak, '🔥 najdulji niz dana']]),
      st.team.games ? periodTable([COLS.km, COLS.games, COLS.avg, COLS.best, COLS.goals, COLS.wins, COLS.streak]) : empty('Liga još nema odigranih partija.')];
  } else if (tab === 'nagrade') {
    body = awardsBody(aw);
  } else {
    const x = st.rendgen, t = x.target, m = x.metrics;
    const dots = (last) => h('span', { class: 'dots' }, last.map((r) => h('i', { class: r })));
    const hist = x.history.filter((p) => p.rank != null);
    const worst = Math.max(2, ...hist.map((p) => p.of));
    const pts = hist.map((p, i) => `${hist.length > 1 ? (i / (hist.length - 1)) * 300 : 150},${8 + ((p.rank - 1) / (worst - 1)) * 84}`).join(' ');
    body = [
      h('div', { class: 'card stack' }, h('h3', {}, 'Meta za danas · tjedna tablica'),
        !t || !st.team.games ? h('p', { class: 'muted' }, 'Ovaj tjedan još nema rezultata. Odigraj današnju partiju pa se vrati.') : [
          h('p', { class: 'rx-big mono' }, t.ahead ? `+${nf.format(Math.floor(t.ahead.gap) + 1)} km` : '👑 Vodiš'),
          h('p', {}, t.ahead ? `toliko ti treba da prestigneš igrača ${t.ahead.nickname} i dođeš na ${t.rank - 1}. mjesto.` : t.behind ? `Prednost pred igračem ${t.behind.nickname}: ${km(t.behind.gap)}.` : 'Jedini si s rezultatom ovaj tjedan.'),
          h('p', { class: 'small muted' }, `Sada si ${t.rank}. od ${t.of} s ${km(t.km)}. `, t.ahead ? `Vodeći ${t.leader.nickname} ima ${km(t.leader.km)} (${km(t.leader.gap)} više). ` : '', t.played_today ? `Danas: ${km(t.today_km)}.` : 'Danas još nisi igrao.')]),
      teamCards([[m.avg_km == null ? '—' : nf.format(m.avg_km), m.league_avg == null ? 'tvoj prosjek po partiji' : `tvoj prosjek · liga ${nf.format(m.league_avg)}`], [`🏆 ${m.days_top}`, `dana najdalje u ligi od ${m.days_played}`], [nf.format(m.best_day), 'najbolji dan (km)'], [`${m.wins} : ${m.losses}`, m.win_pct == null ? 'dvoboji' : `dvoboji · ${m.win_pct} % pobjeda${m.ties ? ` · ${m.ties} neriješeno` : ''}`]]),
      h('div', { class: 'card stack' }, h('h3', {}, 'Dvoboji'), h('p', { class: 'small muted' }, 'Ista karta i isti dan, kad ste obojica igrali. Točkice: zadnjih deset.'),
        x.duels.length ? h('div', { class: 'duels' }, x.duels.map((d) => { const n = d.wins + d.losses + d.ties; return h('div', { class: 'duel' }, who(d),
          h('span', { class: 'dbar', role: 'img', 'aria-label': `${d.wins} pobjeda, ${d.ties} neriješeno, ${d.losses} poraza` }, h('i', { class: 'w', style: `width:${(d.wins / n) * 100}%` }), h('i', { class: 't', style: `width:${(d.ties / n) * 100}%` }), h('i', { class: 'l', style: `width:${(d.losses / n) * 100}%` })),
          dots(d.last), h('b', { class: 'mono' }, `${d.wins} : ${d.losses}`)); })) : h('p', { class: 'muted' }, 'Još nema dana u kojima si igrao istu kartu kad i netko iz lige.'),
        x.duels_without.length ? h('p', { class: 'small muted' }, 'Bez zajedničkih partija: ', x.duels_without.join(', ')) : null),
      h('div', { class: 'rx-two' },
        h('div', { class: 'card stack' }, h('h3', {}, 'Ti prema ligi'), h('p', { class: 'small muted' }, 'Kilometri po pitanju, zadnjih 30 dana.'),
          x.vs_league.some((c) => c.me != null) ? x.vs_league.filter((c) => c.me != null).map((c) => { const diff = c.me - c.league; return h('div', { class: 'vs' }, h('span', {}, c.emoji, ' ', c.name, h('small', { class: 'mono' }, ` ${c.me} / ${c.league}`)), h('span', { class: 'vsbar' }, h('i', { class: diff >= 0 ? 'up' : 'down', style: `width:${Math.min(50, Math.abs(diff) / 2.2)}%` })), h('b', { class: 'mono ' + (diff >= 0 ? 'up' : 'down') }, (diff >= 0 ? '+' : '') + diff)); }) : h('p', { class: 'muted' }, 'Nema dovoljno podataka.')),
        h('div', { class: 'card stack' }, h('h3', {}, 'Mjesto u ligi po danima'), h('p', { class: 'small muted' }, 'Dnevni poredak, zadnjih 30 dana.'),
          hist.length >= 2 ? [(() => { const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 300 100'); svg.setAttribute('class', 'rankline'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Graf mjesta u ligi'); svg.innerHTML = `<polyline points="${pts}" fill="none" stroke="#ffc928" stroke-width="2.5" stroke-linejoin="round"/>` + hist.map((p, i) => `<circle cx="${(i / (hist.length - 1)) * 300}" cy="${8 + ((p.rank - 1) / (worst - 1)) * 84}" r="3.5" fill="#ffc928"><title>${dateShort(p.date)}: ${p.rank}. od ${p.of}</title></circle>`).join(''); return svg; })(),
            h('p', { class: 'small muted' }, `Zadnji dan: ${hist[hist.length - 1].rank}. mjesto. Najbolje: ${Math.min(...hist.map((p) => p.rank))}. (${hist.length} odigranih dana)`)] : h('p', { class: 'muted' }, 'Graf se pojavi nakon dva odigrana dana.')))];
  }

  // ----- desni stupac: nagrade, odgovori ekipe, legende, dvorana slavnih -----
  const qn = st.answers.questions, qi = Math.min(Math.max(1, Number(query.pitanje) || 1), Math.max(1, qn.length)), cur = qn[qi - 1];
  const ansBox = h('div', { class: 'stack' });
  const paintAnswers = (i) => {
    const c = qn[i - 1];
    fill(ansBox, h('div', { class: 'row spread' }, h('button', { class: 'iconbtn', disabled: i <= 1, 'aria-label': 'Prethodno pitanje', onclick: () => paintAnswers(i - 1) }, '‹'),
        h('div', { class: 'center' }, h('b', {}, c.emoji, ' ', c.category), h('div', { class: 'mono small muted' }, `${i} / ${qn.length}`)),
        h('button', { class: 'iconbtn', disabled: i >= qn.length, 'aria-label': 'Sljedeće pitanje', onclick: () => paintAnswers(i + 1) }, '›')),
      h('p', { class: 'small' }, c.text),
      h('div', { class: 'tanswers' }, c.rows.map((r, k) => h('div', { class: 'ta' + (r.self ? ' self' : '') }, h('span', { class: 'mono muted' }, `${k + 1}.`), avatar(r),
        h('span', { class: 'ta-mid' }, h('b', {}, r.self ? 'Ti' : r.nickname), h('span', { class: r.km > 0 ? '' : 'muted' }, r.answer || (r.status === 'isteklo' ? 'bez odgovora' : '—'))),
        h('span', { title: r.transport?.name || 'Radovi na cesti' }, r.km > 0 ? emojiOf(r.transport) : '🚧'), h('b', { class: 'mono' }, nf.format(r.km))))));
  };
  if (cur) paintAnswers(qi);
  const side = [
    h('section', { class: 'card stack' }, h('h3', {}, 'Nagrade dana'),
      st.awards.length ? st.awards.map((a) => h('div', { class: 'award' }, h('span', { class: 'aw-ic', 'aria-hidden': 'true' }, a.emoji), h('div', {}, h('small', {}, a.title), h('div', {}, h('b', {}, a.players.map((p) => (p.self ? 'Ti' : p.nickname)).join(', ')), a.value ? [': ', `„${a.value}“`] : null), h('small', { class: 'muted' }, a.note))))
        : h('p', { class: 'muted small' }, st.awards_hidden.length && st.played_today_count ? 'Nagrade vidiš kad odigraš današnju partiju.' : st.played_today_count ? 'Danas još nema dovoljno točnih odgovora za nagrade.' : 'Danas još nema odigranih partija.'),
      st.awards.length && st.awards_hidden.length ? h('p', { class: 'small muted' }, `Bez karte ${st.awards_hidden.join(', ')} — nju još nisi odigrao.`) : null),
    h('section', { class: 'card stack' }, h('div', { class: 'row spread wrapline' }, h('h3', {}, 'Odgovori ekipe'), st.maps.length > 1 ? h('span', { class: 'small muted' }, withFlag(st.maps.find((m) => m.slug === mapSlug))) : null),
      st.answers.locked ? h('p', { class: 'muted small' }, 'Odgovore ekipe za ovu kartu vidiš kad je i sam odigraš — tako nitko nikome ne otkriva odgovore.') : cur ? ansBox : h('p', { class: 'muted small' }, 'Na ovoj karti danas još nitko iz lige nije igrao.')),
    h('section', { class: 'card stack' }, h('h3', {}, 'Legende lige'),
      st.legends.some((g) => !g.empty) ? st.legends.filter((g) => !g.empty).map((g) => h('div', { class: 'legend' }, h('span', {}, g.emoji, ' ', g.title), who(g), h('b', { class: 'mono' }, `${g.avg} km`))) : h('p', { class: 'muted small' }, 'Legende se biraju kad netko skupi barem tri odgovora u kategoriji.'),
      h('p', { class: 'small muted' }, st.legends_rule)),
    h('section', { class: 'card stack' }, h('h3', {}, 'Dvorana slavnih'),
      st.crowns.length ? h('div', { class: 'row wrapline' }, st.crowns.map((c) => h('span', { class: 'chip' }, c.nickname, ' 👑×', c.n))) : null,
      st.hall.length ? st.hall.map((w) => h('div', { class: 'hallrow' }, h('small', { class: 'mono muted' }, `tjedan ${dateShort(w.from)} – ${dateShort(w.to)}`),
        h('div', { class: 'row spread' }, h('span', { class: 'who' }, '🏆 ', avatar(w.winner), h('b', {}, w.winner.nickname)), h('b', { class: 'mono' }, km(w.winner.km))),
        h('small', { class: 'muted' }, `${w.winner.days} dana · najbolja partija ${km(w.winner.best)}`, w.podium.length ? ' · ' + w.podium.map((p, i) => `${i ? '🥉' : '🥈'} ${p.nickname} ${nf.format(Math.round(p.km))}`).join(' ') : '')))
        : h('p', { class: 'muted small' }, 'Prvi pobjednik upisuje se kad završi prvi cijeli tjedan lige.'))];

  const tabs = [['danas', 'Danas'], ['tjedan', 'Tjedan'], ['mjesec', 'Mjesec'], ['ukupno', 'Ukupno'], ['nagrade', 'Nagrade'], ['rendgen', 'Rendgen']];
  mount(shell(h('div', { class: 'league stack-lg' },
    h('section', { class: 'card stack lhead' },
      h('div', { class: 'row spread wrapline' }, h('div', {}, h('a', { href: '/lige', class: 'small muted' }, 'Sve lige'), h('h1', {}, l.name), h('p', { class: 'small muted' }, `${l.members.length} članova · danas igralo ${st.team.played_today}`)),
        h('div', { class: 'row wrapline' }, h('button', { class: 'btn primary', onclick: () => inviteDialog(l) }, 'Pozovi ekipu'), h('span', { class: 'small muted' }, 'kod ', h('b', { class: 'mono', style: 'color:var(--ink)' }, l.code)))),
      h('div', { class: 'row spread wrapline' }, h('h3', {}, st.date === st.today ? 'Danas na ruti' : `Na ruti ${dateShort(st.date)}`), mapSeg),
      racers.length ? race : h('p', { class: 'muted' }, 'Na ovoj karti još nitko iz lige nije završio partiju.'),
      h('p', { class: 'small muted' }, '👥 Zajedno ', tab === 'danas' ? 'taj dan' : tab === 'mjesec' ? 'u mjesecu' : tab === 'ukupno' ? 'ukupno' : 'ovaj tjedan', ': ', h('b', { class: 'mono', style: 'color:var(--ink)' }, km(st.team.km)), st.team.km > 0 ? ` — to je ${num(Math.round((st.team.km / route.total_km) * 10) / 10)} puta ${route.name.replace(' – ', ' → ')}.` : '.')),
    h('div', { class: 'lgrid' },
      h('section', { class: 'card stack lmain' }, h('div', { class: 'tabs', role: 'tablist' }, tabs.map(([k, label]) => h('a', { role: 'tab', href: qs({ tab: k, mjesec: null, datum: k === 'danas' ? date : null }), 'aria-selected': String(k === tab) }, label))), body),
      h('div', { class: 'stack lside' }, side)),
    h('section', { class: 'stack' }, h('h2', {}, 'Tko je dokle stigao'), mapEl),
    h('div', { class: 'row wrapline' },
      h('button', { class: 'btn danger', onclick: async () => { if (!confirm('Izaći iz lige?')) return; try { await post(`/api/leagues/${id}/leave`); go('/lige'); } catch (e) { toast(e.message); } } }, 'Izađi iz lige'),
      l.owner ? h('button', { class: 'btn', onclick: async () => { const n = prompt('Novi naziv lige', l.name); if (!n) return; try { await api('PATCH', `/api/leagues/${id}`, { name: n }); render(); } catch (e) { toast(e.message); } } }, 'Preimenuj') : null,
      h('button', { class: 'btn', onclick: async () => { const reason = prompt('Što nije u redu s ovom ligom?'); if (reason == null) return; await post('/api/report-content', { target_type: 'liga', target_id: Number(id), reason }); toast('Prijava je poslana.'); } }, 'Prijavi ligu'))), { wide: true }));
  const rmap = createRouteMap(mapEl, route, mapSpec());
  rmap.setMode('overview');
  rmap.setRivals(racers.map((r) => ({ km: r.km, label: `${r.nickname} ${nf.format(Math.round(r.km))}`, self: r.self, sign: signOf.get(r.user_id)?.text ? { text: signOf.get(r.user_id).text, shape: signOf.get(r.user_id).shape } : null })));
  rmap.setMe(racers.find((r) => r.self)?.km || 0, null);
  const vs = viewSwitch(() => rmap);
  if (vs) mapEl.append(vs);
  const lay = () => layoutRaceSigns(raceTrack);
  requestAnimationFrame(lay);
  const ro = 'ResizeObserver' in window ? new ResizeObserver(lay) : null;
  ro?.observe(raceTrack);
  cleanup = () => { ro?.disconnect(); rmap.destroy(); };
}

// ---------- Profil ----------
function statsBlocks(st) {
  const maxCat = Math.max(1, ...st.categories.map((c) => c.avg_km));
  const maxTr = Math.max(1, ...st.transports.map((t) => t.count));
  const today = boot.date;
  const days = [];
  for (let i = 55; i >= 0; i--) { const d = shift(today, -i); days.push(h('i', { class: (st.streak_days.includes(d) ? 'on' : '') + (d === today ? ' today' : ''), title: dateShort(d) })); }
  return [
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('b', {}, st.games), h('span', {}, 'odigranih partija')),
      h('div', { class: 'stat' }, h('b', {}, nf.format(Math.round(st.total_km))), h('span', {}, 'ukupno kilometara')),
      h('div', { class: 'stat' }, h('b', {}, nf.format(Math.round(st.avg_km))), h('span', {}, 'prosjek po partiji')),
      h('div', { class: 'stat' }, h('b', {}, nf.format(Math.round(st.best_km))), h('span', {}, 'najbolji rezultat')),
      h('div', { class: 'stat' }, h('b', {}, st.goals_reached), h('span', {}, 'dolazaka do cilja')),
      h('div', { class: 'stat' }, h('b', {}, st.streak.current), h('span', {}, 'dana zaredom')),
      h('div', { class: 'stat' }, h('b', {}, st.streak.best), h('span', {}, 'najdulji niz')),
      h('div', { class: 'stat' }, h('b', {}, st.streak.days), h('span', {}, 'odigranih dana'))),
    h('section', { class: 'stack' }, h('h2', {}, 'Zadnjih osam tjedana'), h('div', { class: 'days', role: 'img', 'aria-label': `Odigrano ${st.streak_days.length} od zadnjih 56 dana` }, days)),
    st.categories.length ? h('section', { class: 'stack' }, h('h2', {}, 'Po sportovima'), h('p', { class: 'small muted' }, 'Prosječni kilometri po pitanju i postotak točnih odgovora.'),
      h('div', { class: 'panel' }, st.categories.map((c) => h('div', { class: 'bar' }, h('span', {}, `${c.emoji} ${c.name}`), h('span', { class: 'track' }, h('i', { style: `width:${(c.avg_km / maxCat) * 100}%` })), h('span', { class: 'v' }, `${nf.format(Math.round(c.avg_km))} km`), h('span', {}), h('span', { class: 'small muted', style: 'grid-column:2 / 4' }, `${c.accuracy} % točnih, ${c.answers} odgovora`))))) : null,
    st.transports.length ? h('section', { class: 'stack' }, h('h2', {}, 'Čime se najčešće voziš'),
      h('div', { class: 'panel' }, st.transports.map((t) => h('div', { class: 'bar' }, h('span', {}, emojiOf(t.transport), ' ', t.transport?.name || `Razina ${t.level}`), h('span', { class: 'track' }, h('i', { style: `width:${(t.count / maxTr) * 100}%` })), h('span', { class: 'v' }, t.count + '×'))))) : null,
    st.rarest.length ? h('section', { class: 'stack' }, h('h2', {}, 'Najrjeđi odgovori'),
      h('div', { class: 'panel flush' }, h('ul', { class: 'reslist' }, st.rarest.map((r) => h('li', {}, h('span', { class: 'em' }, emojiOf(r.transport)), h('div', {}, h('div', { class: 'q' }, r.question), h('div', { class: 'a' }, r.answer)), h('div', { class: 'kmv' }, r.rarity, h('small', {}, 'rijetkost'))))))) : null,
    st.per_map.length ? h('section', { class: 'stack' }, h('h2', {}, 'Po kartama'),
      h('div', { class: 'panel flush scroll-x' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Karta'), h('th', { class: 'r' }, 'Partija'), h('th', { class: 'r' }, 'Ukupno'), h('th', { class: 'r' }, 'Najbolje'), h('th', { class: 'r' }, 'U cilju'))),
        h('tbody', {}, st.per_map.map((m) => h('tr', {}, h('td', {}, withFlag(m)), h('td', { class: 'r' }, m.games), h('td', { class: 'r num' }, km(m.km)), h('td', { class: 'r num' }, km(m.best)), h('td', { class: 'r' }, m.goals))))))) : null,
    st.monthly.length ? h('section', { class: 'stack' }, h('h2', {}, 'Po mjesecima'),
      h('div', { class: 'panel flush scroll-x' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Mjesec'), h('th', { class: 'r' }, 'Dana'), h('th', { class: 'r' }, 'Partija'), h('th', { class: 'r' }, 'Ukupno'), h('th', { class: 'r' }, 'Prosjek'), h('th', { class: 'r' }, 'U cilju'))),
        h('tbody', {}, st.monthly.map((m) => h('tr', {}, h('td', {}, `${m.month.slice(5)}/${m.month.slice(0, 4)}.`), h('td', { class: 'r' }, m.days), h('td', { class: 'r' }, m.games), h('td', { class: 'r num' }, km(m.km)), h('td', { class: 'r' }, nf.format(Math.round(m.avg))), h('td', { class: 'r' }, m.goals))))))) : null,
    st.history.length ? h('section', { class: 'stack' }, h('h2', {}, 'Povijest partija'),
      h('div', { class: 'panel flush scroll-x' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Dan'), h('th', {}, 'Karta'), h('th', { class: 'r' }, 'Prijeđeno'))),
        h('tbody', {}, st.history.map((g) => h('tr', {}, h('td', {}, dateFull(g.date)), h('td', {}, flag(g.flag)), h('td', { class: 'r num' }, km(g.total_km), g.reached_goal ? ' 🏁' : ''))))))) : null,
  ];
}
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 256, c = document.createElement('canvas');
      c.width = c.height = size;
      const s = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('Slika se ne može pročitati.'));
    img.src = URL.createObjectURL(file);
  });
}
async function viewProfile() {
  await loadBoot();
  const me = boot.me;
  if (!me) return go('/prijava', true);
  const [st, prefs, blocks] = await Promise.all([get('/api/me/stats'), me.is_guest ? null : get('/api/me/prefs'), me.is_guest ? { users: [] } : get('/api/blocks')]);
  const save = async (body, msg) => { try { await api('PATCH', '/api/me', body); await loadBoot(); toast(msg); render(); } catch (e) { toast(e.message); } };
  const nick = h('input', { class: 'input', value: me.nickname, maxlength: 20 });
  const file = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async () => { if (file.files[0]) save({ avatar: await resizeImage(file.files[0]) }, 'Slika je spremljena.'); } });
  const cur = h('input', { class: 'input', type: 'password', autocomplete: 'current-password' }), nw = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', minlength: 8 });
  mount(shell(h('div', { class: 'stack-lg' },
    h('div', { class: 'row' }, avatar(me, 'lg'), h('div', {}, h('h1', {}, me.nickname), h('p', { class: 'muted' }, me.is_guest ? 'Igraš kao gost' : me.email))),
    me.is_guest ? h('div', { class: 'board stack' }, h('h2', {}, 'Spremi svoj napredak'), h('p', {}, 'Rezultati su zasad vezani samo uz ovaj uređaj. Registracijom ostaju tvoji, ulaziš u ljestvice i možeš u lige.'), h('a', { class: 'btn', href: '/prijava' }, 'Registriraj se')) : null,
    ...statsBlocks(st),
    h('section', { class: 'panel stack' }, h('h2', {}, 'Postavke profila'),
      h('label', { class: 'field' }, h('span', {}, 'Nadimak'), nick), h('button', { class: 'btn', onclick: () => save({ nickname: nick.value }, 'Nadimak je spremljen.') }, 'Spremi nadimak'),
      me.is_guest ? null : h('div', { class: 'row wrapline' }, file, h('button', { class: 'btn', onclick: () => file.click() }, me.avatar ? 'Promijeni sliku' : 'Dodaj profilnu sliku'), me.avatar ? h('button', { class: 'btn', onclick: () => save({ avatar: null }, 'Slika je uklonjena.') }, 'Ukloni sliku') : null),
      h('label', { class: 'row' }, h('input', { type: 'checkbox', checked: me.is_public, onchange: (e) => save({ is_public: e.target.checked }, e.target.checked ? 'Profil je javan.' : 'Profil je privatan.') }), h('span', {}, 'Drugi igrači mogu vidjeti moju statistiku')),
      h('p', { class: 'small muted' }, 'E-mail adresa nikad nije javna.')),
    me.is_guest ? null : h('div', { class: 'row wrapline' }, h('a', { class: 'btn', href: '/poruke' }, '✉️ Poruke'), h('a', { class: 'btn', href: '/izazovi' }, '🥊 Moji izazovi'), h('a', { class: 'btn', href: '/obavijesti' }, '🔔 Obavijesti')),
    ...(me.is_guest ? [] : settingsBlocks(prefs, blocks.users)),
    me.is_guest ? null : h('form', { class: 'panel stack', onsubmit: async (e) => { e.preventDefault(); try { await post('/api/me/password', { current: cur.value, password: nw.value }); toast('Lozinka je promijenjena.'); cur.value = nw.value = ''; } catch (err) { toast(err.message); } } },
      h('h2', {}, me.has_password ? 'Promjena lozinke' : 'Postavi lozinku'), me.has_password ? h('label', { class: 'field' }, h('span', {}, 'Trenutna lozinka'), cur) : null, h('label', { class: 'field' }, h('span', {}, 'Nova lozinka (barem 8 znakova)'), nw), h('button', { class: 'btn' }, 'Spremi lozinku')),
    h('section', { class: 'panel stack' }, h('h2', {}, 'Račun i podaci'),
      h('div', { class: 'row wrapline' },
        h('a', { class: 'btn', href: `/igrac/${encodeURIComponent(me.nickname)}` }, 'Moj javni profil'),
        h('a', { class: 'btn', href: '/api/me/export', target: '_blank', download: 'ontale-moji-podaci.json' }, 'Preuzmi moje podatke'),
        me.is_guest ? null : h('button', { class: 'btn', onclick: async () => { await post('/api/auth/logout'); boot = null; go('/'); } }, 'Odjavi se'),
        h('button', { class: 'btn danger', onclick: async () => { if (!confirm('Obrisati račun, sve partije i statistiku? Ovo se ne može poništiti.')) return; await api('DELETE', '/api/me'); boot = null; toast('Račun je obrisan.'); go('/'); } }, 'Obriši račun'))))));
  if (location.hash) requestAnimationFrame(() => document.querySelector(location.hash)?.scrollIntoView({ block: 'start' }));
}
async function viewPlayer([nick]) {
  const p = await get(`/api/profile/${encodeURIComponent(nick)}`);
  mount(shell(h('div', { class: 'stack-lg' },
    h('div', { class: 'row' }, avatar(p, 'lg'), h('div', {}, h('h1', {}, p.nickname), h('p', { class: 'muted' }, `Na ruti od ${dateFull(p.member_since)}`))),
    p.relation ? h('div', { class: 'row wrapline' },
      h('button', { class: 'btn primary', disabled: !p.relation.can_message, title: p.relation.message_denied || '', onclick: () => openConversationWith(p.id) }, '✉️ Pošalji poruku'),
      h('a', { class: 'btn', href: `/izazovi?protiv=${encodeURIComponent(p.nickname)}` }, '🥊 Izazovi'),
      p.relation.i_blocked ? h('button', { class: 'btn sm', onclick: async () => { await api('DELETE', `/api/blocks/${p.id}`); toast('Igrač je odblokiran.'); render(); } }, 'Odblokiraj')
        : h('button', { class: 'btn sm', onclick: async () => { if (!confirm(`Blokirati igrača ${p.nickname}? Više ti neće moći pisati ni slati izazove.`)) return; await post('/api/blocks', { user_id: p.id }); toast('Igrač je blokiran.'); render(); } }, 'Blokiraj')) : null,
    p.relation && !p.relation.can_message ? h('p', { class: 'small muted' }, p.relation.message_denied) : null,
    p.badges?.length ? h('section', { class: 'stack' }, h('h2', {}, 'Nagrade u ligama'), h('div', { class: 'badges' }, p.badges.map((b) => h('span', { class: 'chip', title: `${b.league} · ${b.title} · ${dateShort(b.period_start)}` }, b.rank === 2 ? '🥈' : b.rank === 3 ? '🥉' : b.emoji, ' ', b.title)))) : null,
    p.private ? h('p', { class: 'notice' }, 'Ovaj igrač drži statistiku privatnom.') : statsBlocks(p.stats),
    p.self ? h('a', { class: 'btn', href: '/profil' }, 'Uredi profil') : h('button', { class: 'btn sm', onclick: async () => { const reason = prompt('Što nije u redu s ovim profilom (nadimak, slika)?'); if (reason == null) return; await post('/api/report-content', { target_type: 'korisnik', target_id: p.id, reason }); toast('Prijava je poslana.'); } }, 'Prijavi profil'))));
}

// ---------- Arhiva ----------
async function viewArchive() {
  const a = await get('/api/archive');
  mount(shell(h('div', { class: 'stack' }, h('h1', {}, 'Arhiva'), h('p', {}, 'Odigraj propuštene dane. Arhivske partije su za zabavu: ne ulaze u ljestvice, niz dana ni rijetkost odgovora.'),
    a.days.length ? h('div', { class: 'panel flush' }, h('table', { class: 'table' }, h('tbody', {}, a.days.map((d) => h('tr', {},
      h('td', {}, h('b', {}, cap(dateLong(d.date))), h('div', { class: 'small muted' }, d.categories.join(' '))),
      h('td', { class: 'r' }, h('div', { class: 'row', style: 'justify-content:flex-end;flex-wrap:wrap' }, boot.maps.map((m) => {
        const played = d.played.filter((x) => x.map === m.slug).sort((x, y) => y.official - x.official)[0];
        return h('a', { class: 'btn sm', href: `/igra/${m.slug}?datum=${d.date}` }, flag(m.flag, m.name), played ? ` ${nf.format(Math.round(played.km))} km` : ' Igraj');
      })))))))) : h('p', { class: 'notice' }, 'Arhiva se puni od sutra — danas je tek prvi dan.'))));
}

// ---------- Prijava ----------
async function viewAuth(_, query) {
  await loadBoot();
  if (boot.me && !boot.me.is_guest) return go('/profil', true);
  let mode = query.novi === '0' ? 'login' : 'register';
  const box = h('div');
  const done = async () => { await loadBoot(); const code = sessionStorage.getItem('ont_join'); if (code) { sessionStorage.removeItem('ont_join'); return go(`/liga/${code}`, true); } go('/'); };
  const paint = () => {
    const email = h('input', { class: 'input', type: 'email', autocomplete: 'email', required: true });
    const pass = h('input', { class: 'input', type: 'password', autocomplete: mode === 'register' ? 'new-password' : 'current-password', required: true, minlength: mode === 'register' ? 8 : null });
    const nick = h('input', { class: 'input', maxlength: 20, minlength: 3, required: true, value: boot.me?.is_guest ? '' : '' });
    const err = h('p', { class: 'notice err', hidden: true, role: 'alert' });
    box.replaceChildren(h('form', { class: 'panel stack', onsubmit: async (e) => {
      e.preventDefault(); err.hidden = true;
      try { await post(mode === 'register' ? '/api/auth/register' : '/api/auth/login', { email: email.value, password: pass.value, nickname: nick.value }); toast(mode === 'register' ? 'Račun je otvoren.' : 'Prijavljen si.'); await done(); }
      catch (ex) { err.textContent = ex.message; err.hidden = false; }
    } },
      h('div', { class: 'seg' }, h('button', { type: 'button', 'aria-pressed': String(mode === 'register'), onclick: () => { mode = 'register'; paint(); } }, 'Novi račun'), h('button', { type: 'button', 'aria-pressed': String(mode === 'login'), onclick: () => { mode = 'login'; paint(); } }, 'Već imam račun')),
      mode === 'register' ? h('label', { class: 'field' }, h('span', {}, 'Nadimak (vidljiv drugima)'), nick) : null,
      h('label', { class: 'field' }, h('span', {}, 'E-mail'), email),
      h('label', { class: 'field' }, h('span', {}, mode === 'register' ? 'Lozinka (barem 8 znakova)' : 'Lozinka'), pass),
      err,
      h('button', { class: 'btn primary block' }, mode === 'register' ? 'Otvori račun' : 'Prijavi se'),
      mode === 'register' ? h('p', { class: 'small muted' }, 'Otvaranjem računa prihvaćaš ', h('a', { href: '/uvjeti' }, 'uvjete korištenja'), ' i ', h('a', { href: '/privatnost' }, 'pravila privatnosti'), '.') : h('p', { class: 'small muted' }, 'Zaboravio si lozinku? Javi se na ', boot.site.contact_email || 'kontakt adresu', ' i poslat ćemo ti poveznicu za novu.')));
  };
  paint();
  mount(shell(h('div', { class: 'stack' }, h('h1', {}, 'Prijava'),
    boot.me?.is_guest ? h('p', { class: 'notice' }, 'Partije koje si odigrao kao gost prenose se na tvoj račun.') : null,
    query.greska ? h('p', { class: 'notice err' }, query.greska) : null,
    boot.google ? h('a', { class: 'btn block', href: '/api/auth/google' }, 'Nastavi s Google računom') : null,
    box, h('a', { href: '/' }, 'Nastavi kao gost'))));
}
async function viewReset(_, query) {
  const pass = h('input', { class: 'input', type: 'password', minlength: 8, required: true, autocomplete: 'new-password' });
  mount(shell(h('form', { class: 'panel stack', onsubmit: async (e) => { e.preventDefault(); try { await post('/api/auth/reset', { token: query.token, password: pass.value }); toast('Lozinka je spremljena. Prijavi se.'); go('/prijava?novi=0'); } catch (err) { toast(err.message); } } },
    h('h1', {}, 'Nova lozinka'), h('label', { class: 'field' }, h('span', {}, 'Nova lozinka (barem 8 znakova)'), pass), h('button', { class: 'btn primary' }, 'Spremi lozinku'))));
}
async function viewPage([slug]) {
  const key = { pravila: 'rules', privatnost: 'privacy', uvjeti: 'terms' }[slug];
  const title = { pravila: 'Pravila igre', privatnost: 'Privatnost', uvjeti: 'Uvjeti korištenja' }[slug];
  const p = await get(`/api/pages/${key}`);
  mount(shell(h('div', { class: 'stack' }, h('h1', {}, title), prose(p.text), boot.site.contact_email ? h('p', {}, 'Kontakt: ', h('a', { href: `mailto:${boot.site.contact_email}` }, boot.site.contact_email)) : null)));
}


// =====================================================================
// v2.3 — obavijesti, poruke, putokazi, izazovi, nagrade, zvuk, prikaz karte
// =====================================================================
const timeAgo = (iso) => {
  const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'upravo';
  if (s < 3600) return `prije ${Math.floor(s / 60)} min`;
  if (s < 86400) return `prije ${Math.floor(s / 3600)} h`;
  const d = new Date(iso);
  return s < 7 * 86400 ? new Intl.DateTimeFormat('hr-HR', { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(d) : new Intl.DateTimeFormat('hr-HR', { day: 'numeric', month: 'numeric', year: '2-digit' }).format(d);
};
const clockTime = (iso) => new Intl.DateTimeFormat('hr-HR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

// ---------- Brojači (zvonce, poruke) i lagano prozivanje ----------
const counts = { notif: 0, msg: 0, last_id: 0 };
function badge(kind) {
  const n = kind === 'notif' ? counts.notif : counts.msg;
  return h('b', { class: 'badge', 'data-badge': kind, hidden: !n, 'aria-label': `${n} nepročitanih` }, n > 99 ? '99+' : String(n));
}
function applyCounts(c, initial) {
  const grewMsg = c.messages_unread > counts.msg, grewNotif = c.last_id > counts.last_id && c.unread > 0;
  if (!initial && counts.last_id) {
    if (grewMsg) sound.play('message');
    else if (grewNotif) sound.play(c.last_type === 'nagrada' ? 'award' : c.last_type === 'izazov' && c.last_won === true ? 'win' : 'notify');
  }
  counts.notif = c.unread; counts.msg = c.messages_unread; counts.last_id = Math.max(counts.last_id, c.last_id || 0);
  for (const el of document.querySelectorAll('[data-badge]')) {
    const n = el.dataset.badge === 'notif' ? counts.notif : counts.msg;
    el.hidden = !n; el.textContent = n > 99 ? '99+' : String(n);
  }
  document.title = (counts.notif + counts.msg ? `(${counts.notif + counts.msg}) ` : '') + `${boot?.site.name || 'ONTALE'} — dnevna sportska igra`;
  window.dispatchEvent(new CustomEvent('ontale:counts', { detail: { ...counts, grewMsg } }));
}
let pollTimer = 0;
async function poll() {
  clearTimeout(pollTimer);
  if (registered() && !document.hidden) { try { applyCounts(await get('/api/notifications/count')); } catch { /* bez veze — pokušaj kasnije */ } }
  pollTimer = setTimeout(poll, document.hidden ? 300000 : 45000);   // 45 s dok je kartica vidljiva, inače pauza
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
setTimeout(poll, 4000);

// ---------- Padajući popis obavijesti ----------
function notifItem(n, onOpen) {
  return h('a', { class: 'nitem' + (n.read ? '' : ' unread'), href: n.link || '/obavijesti', onclick: async () => { if (!n.read) { try { applyCounts(await post('/api/notifications/read', { id: n.id })); } catch { /* svejedno otvori */ } } onOpen?.(); } },
    h('span', { class: 'nicon', 'aria-hidden': 'true' }, n.emoji || '🔔'),
    h('span', { class: 'nmid' }, h('b', {}, n.title), n.body ? h('span', {}, n.body) : null, h('small', { class: 'muted' }, timeAgo(n.created_at))),
    n.read ? null : h('i', { class: 'ndot', 'aria-label': 'nepročitano' }));
}
function toggleBell(anchor) {
  const open = document.querySelector('.npanel');
  if (open) { open.remove(); return; }
  const panel = h('div', { class: 'npanel', role: 'dialog', 'aria-label': 'Obavijesti' }, h('p', { class: 'muted small', style: 'padding:14px' }, 'Učitavam…'));
  document.body.append(panel);
  const place = () => { const r = anchor.getBoundingClientRect(); panel.style.top = `${r.bottom + 8}px`; if (innerWidth < 600) { panel.style.left = '8px'; panel.style.right = '8px'; panel.style.width = 'auto'; } else panel.style.right = `${Math.max(8, innerWidth - r.right - 6)}px`; };
  place();
  const close = (e) => { if (e.type === 'keydown' ? e.key === 'Escape' : !panel.contains(e.target) && !anchor.contains(e.target)) { panel.remove(); off(); } };
  const off = () => { document.removeEventListener('pointerdown', close, true); document.removeEventListener('keydown', close); window.removeEventListener('popstate', done); };
  const done = () => { panel.remove(); off(); };
  document.addEventListener('pointerdown', close, true); document.addEventListener('keydown', close); window.addEventListener('popstate', done);
  get('/api/notifications?limit=8').then((d) => {
    applyCounts(d);
    fill(panel,
      h('div', { class: 'nhead' }, h('b', {}, 'Obavijesti'), d.unread ? h('button', { class: 'linkbtn', onclick: async () => { applyCounts(await post('/api/notifications/read', { all: true })); done(); toggleBell(anchor); } }, 'Označi sve pročitanim') : null),
      d.items.length ? h('div', { class: 'nlist' }, d.items.map((n) => notifItem(n, done))) : h('p', { class: 'muted small', style: 'padding:14px' }, 'Još nema obavijesti. Javit ćemo ti kad te netko prestigne, izazove ili ti pošalje poruku.'),
      h('a', { class: 'nall', href: '/obavijesti', onclick: done }, 'Sve obavijesti i postavke'));
  }).catch((e) => fill(panel, h('p', { class: 'notice err' }, e.message)));
}
async function viewNotifications() {
  if (!registered()) return mount(shell(h('div', { class: 'stack' }, h('h1', {}, 'Obavijesti'), needAccount('Obavijesti o ligi, porukama i izazovima dobivaju registrirani igrači.'))));
  let items = [], more = false;
  const list = h('div', { class: 'nlist page-list' });
  const moreBtn = h('button', { class: 'btn', onclick: () => load(items.at(-1)?.id) }, 'Starije obavijesti');
  async function load(before) {
    const d = await get('/api/notifications?limit=30' + (before ? '&before=' + before : ''));
    items = before ? [...items, ...d.items] : d.items; more = d.more;
    fill(list, items.length ? items.map((n) => notifItem(n)) : h('p', { class: 'muted', style: 'padding:16px' }, 'Još nema obavijesti.'));
    moreBtn.hidden = !more;
    applyCounts(d);
  }
  mount(shell(h('div', { class: 'col stack' },
    h('div', { class: 'row spread wrapline' }, h('h1', {}, 'Obavijesti'), h('button', { class: 'btn sm', onclick: async () => { applyCounts(await post('/api/notifications/read', { all: true })); load(); } }, 'Označi sve pročitanim')),
    h('div', { class: 'panel flush' }, list), moreBtn,
    h('p', { class: 'small muted' }, 'Što ti javljamo, biraš u ', h('a', { href: '/profil#obavijesti' }, 'postavkama profila'), '.'))));
  await load();
}

// ---------- Zvuk: gumb u zaglavlju ----------
function soundButton() {
  if (!sound.available) return null;
  const btn = h('button', { class: 'iconbtn hdr snd', type: 'button' });
  const paint = (p) => { btn.textContent = p.on ? '🔊' : '🔇'; btn.setAttribute('aria-label', p.on ? 'Isključi zvuk' : 'Uključi zvuk'); btn.title = p.on ? 'Zvuk je uključen (klik za isključivanje)' : 'Zvuk je isključen'; btn.setAttribute('aria-pressed', String(p.on)); };
  paint(sound.prefs);
  btn.addEventListener('click', () => { const on = !sound.prefs.on; sound.set({ on }); if (on) setTimeout(() => sound.preview('synth:accept'), 120); toast(on ? 'Zvuk je uključen.' : 'Zvuk je isključen.'); });
  const unsub = sound.subscribe(paint);
  new MutationObserver((_, o) => { if (!btn.isConnected) { unsub(); o.disconnect(); } }).observe(document.body, { childList: true, subtree: true });
  return btn;
}

// ---------- Karta: prekidač Reljef / Satelit ----------
function viewSwitch(getMap) {
  const cfg = boot.site.map;
  if (!cfg?.modes?.satelit) return null;
  const opts = [['reljef', '⛰️', 'Reljef'], ['satelit', '🛰️', 'Satelit']];
  const box = h('div', { class: 'hud hud-view', role: 'group', 'aria-label': 'Vrsta karte' });
  const paint = () => fill(box, opts.map(([v, ic, label]) => h('button', { type: 'button', 'aria-pressed': String(mapView() === v), title: label, onclick: () => { setMapView(v); getMap().setView(v); paint(); } }, h('span', { 'aria-hidden': 'true' }, ic), h('span', { class: 'lbl' }, label))));
  paint();
  return box;
}

// ---------- Podsjetnik u aplikaciji ----------
function reminderBanner(b) {
  if (!registered() || !b.inactivity || b.inactivity.days < 3 || b.maps.some((m) => m.mine)) return null;
  try { if (sessionStorage.getItem('ont_podsjetnik')) return null; sessionStorage.setItem('ont_podsjetnik', '1'); } catch { /* bez pohrane prikaži jednom po učitavanju */ }
  const el = h('div', { class: 'reminder', role: 'status' }, h('span', { 'aria-hidden': 'true' }, '🏎️'), h('div', {}, h('b', {}, 'Nova ruta te čeka!'), h('span', {}, ' Vrijeme je da ponovno sjedneš za volan.')),
    h('button', { class: 'iconbtn', 'aria-label': 'Zatvori', onclick: () => el.remove() }, '✕'));
  return el;
}

// ---------- Putokaz ----------
const SHAPE_NAMES = { zeleni: 'Autocesta', zuti: 'Obilazak', plavi: 'Državna cesta', smedi: 'Turistički' };
const SIGN_IDEAS = ['Ajmo ekipa!', 'Danas letimo!', 'Vidimo se u Dubrovniku!', 'Gdje ste ostali?', 'Dobro te je!', 'Lagano do cilja 🏁'];
function roadSign(text, shape = 'zeleni', { mini, placeholder } = {}) {
  return h('div', { class: `ps-sign ${shape}${mini ? ' mini' : ''}${placeholder ? ' ph' : ''}` }, h('span', {}, text));
}
function signpostCard(s) {
  const box = h('section', { class: 'card stack ps-card' });
  if (!registered()) return fill(box, h('h2', {}, '🪧 Ostavi poruku na putokazu'), h('p', { class: 'small muted' }, 'Putokaz s porukom vide tvoji suigrači iz lige na današnjoj utrci. Za to treba račun.'), h('a', { class: 'btn', href: '/prijava' }, 'Registriraj se')) && box;
  const paint = (d, editing) => {
    if (!d.can_edit && !d.sign) return fill(box, h('h2', {}, '🪧 Putokaz'), h('p', { class: 'muted small' }, d.removed ? 'Današnji putokaz uklonio je administrator.' : 'Putokazi su trenutačno isključeni.'));
    if (d.sign && !editing) {
      return fill(box,
        h('div', { class: 'row spread wrapline' }, h('h2', {}, '🪧 Tvoj putokaz za danas'), h('span', { class: 'small muted mono' }, `na ${km(d.sign.km)}`)),
        h('div', { class: 'ps-preview' }, roadSign(d.sign.text, d.sign.shape), h('i', { class: 'ps-pole' })),
        h('p', { class: 'small muted' }, 'Vide ga članovi tvojih liga u današnjoj utrci (tek kad i sami odigraju). Vrijedi do ponoći.'),
        d.can_edit ? h('div', { class: 'row wrapline' }, h('button', { class: 'btn', onclick: () => paint(d, true) }, 'Uredi'),
          h('button', { class: 'btn danger', onclick: async () => { if (!confirm('Maknuti putokaz?')) return; try { await api('DELETE', `/api/signs/session/${s.id}`); paint({ ...d, sign: null }, false); toast('Putokaz je maknut.'); } catch (e) { toast(e.message); } } }, 'Makni putokaz')) : null);
    }
    let shape = d.sign?.shape || 'zeleni';
    const input = h('input', { class: 'input', maxlength: d.max_len + 10, value: d.sign?.text || '', placeholder: 'Što poručuješ ekipi?', 'aria-label': 'Poruka na putokazu', enterkeyhint: 'done', autocomplete: 'off' });
    const counter = h('span', { class: 'ps-count mono' });
    const err = h('p', { class: 'notice err', hidden: true, role: 'alert' });
    const preview = h('div', { class: 'ps-preview' });
    const shapes = h('div', { class: 'ps-shapes', role: 'radiogroup', 'aria-label': 'Oblik znaka' });
    const update = () => {
      const n = [...input.value.trim()].length;
      counter.textContent = `${n}/${d.max_len}`; counter.classList.toggle('over', n > d.max_len);
      fill(preview, roadSign(input.value.trim() || 'Tvoja poruka', shape, { placeholder: !input.value.trim() }), h('i', { class: 'ps-pole' }));
      fill(shapes, Object.entries(SHAPE_NAMES).map(([k, label]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(k === shape), class: 'ps-shape ' + k, onclick: () => { shape = k; update(); } }, h('i'), label)));
    };
    input.addEventListener('input', () => { err.hidden = true; update(); });
    const save = async (e) => {
      e?.preventDefault(); err.hidden = true;
      try { const r = await api('PUT', `/api/signs/session/${s.id}`, { text: input.value, shape }); toast('Putokaz je postavljen.'); sound.play('accept'); paint(r, false); }
      catch (ex) { err.textContent = ex.message; err.hidden = false; }
    };
    fill(box,
      h('h2', {}, '🪧 Ostavi poruku na putokazu'),
      h('p', { class: 'small muted' }, `Kratka poruka (do ${d.max_len} znakova) stoji iznad tvog markera u današnjoj utrci lige, na ${km(d.km)}. Bez poveznica i psovki.`),
      h('span', { class: 'eyebrow' }, 'Oblik znaka'), shapes,
      h('form', { class: 'stack', onsubmit: save }, h('div', { class: 'ps-field' }, input, counter),
        h('div', { class: 'ps-chips' }, SIGN_IDEAS.map((t) => h('button', { type: 'button', class: 'chip', onclick: () => { input.value = t; update(); input.focus(); } }, t))),
        h('span', { class: 'eyebrow' }, 'Pregled'), preview, err,
        h('div', { class: 'row wrapline' }, h('button', { class: 'btn primary' }, d.sign ? 'Spremi promjenu' : 'Postavi putokaz'), d.sign ? h('button', { type: 'button', class: 'btn', onclick: () => paint(d, false) }, 'Odustani') : null)));
    update();
  };
  get(`/api/signs/session/${s.id}`).then((d) => paint(d, false)).catch(() => box.remove());
  return box;
}
/** Raspored putokaza iznad vodoravne utrke: bez preklapanja (više redova), unutar širine trake. */
function layoutRaceSigns(track) {
  const items = [...track.querySelectorAll('.race-sign')];
  if (!items.length) return;
  const W = track.clientWidth;
  const rows = [];
  items.map((el) => ({ el, x: el.offsetLeft, w: el.querySelector('.ps-sign').offsetWidth })).sort((a, b) => a.x - b.x).forEach((it) => {
    const half = it.w / 2;
    const shift = Math.max(-it.x + 4 + half, Math.min(W - it.x - 4 - half, 0));   // ostaje unutar trake
    const left = it.x - half + shift, right = it.x + half + shift;
    let row = rows.findIndex((r) => r.every(([a, b]) => right + 6 < a || left - 6 > b));
    if (row < 0) { rows.push([]); row = rows.length - 1; }
    rows[row].push([left, right]);
    it.el.style.setProperty('--row', row);
    it.el.querySelector('.ps-sign').style.transform = `translateX(calc(-50% + ${shift}px))`;
  });
  track.style.setProperty('--sign-rows', rows.length);
  // igrači preblizu jedan drugome: svaki drugi ide ispod crte, da se avatari ne prekrivaju
  let lastX = -1e9, flip = false;
  for (const r of [...track.querySelectorAll('.racer')].sort((a, b) => a.offsetLeft - b.offsetLeft)) {
    const close = r.offsetLeft - lastX < 38;
    flip = close ? !flip : false;
    r.classList.toggle('low', flip);
    if (!flip) lastX = r.offsetLeft;
  }
}

// ---------- Poruke ----------
async function viewInbox() {
  if (!registered()) return mount(shell(h('div', { class: 'stack' }, h('h1', {}, 'Poruke'), needAccount('Privatne poruke mogu slati i primati registrirani igrači.'))));
  const [d, c] = await Promise.all([get('/api/conversations'), get('/api/contacts')]);
  const pick = h('input', { class: 'input', list: 'kontakti', placeholder: 'Nadimak igrača', 'aria-label': 'Kome pišeš', autocomplete: 'off' });
  const startForm = h('form', { class: 'row wrapline', onsubmit: async (e) => { e.preventDefault(); try { const r = await post('/api/conversations', { nickname: pick.value.trim() }); go(`/poruke/${r.id}`); } catch (err) { toast(err.message); } } },
    pick, h('datalist', { id: 'kontakti' }, c.players.map((p) => h('option', { value: p.nickname }))), h('button', { class: 'btn primary' }, 'Nova poruka'));
  mount(shell(h('div', { class: 'col stack' },
    h('h1', {}, 'Poruke'),
    startForm,
    d.conversations.length ? h('div', { class: 'panel flush inbox' }, d.conversations.map((cv) => h('a', { class: 'conv' + (cv.unread ? ' unread' : ''), href: `/poruke/${cv.id}` },
      avatar(cv.other), h('span', { class: 'cmid' }, h('b', {}, cv.other.nickname), h('span', { class: 'cprev' }, cv.last?.mine ? 'Ti: ' : '', cv.last?.preview || '')),
      h('span', { class: 'cside' }, h('small', { class: 'muted' }, cv.last ? timeAgo(cv.last.at) : ''), cv.unread ? h('b', { class: 'badge static' }, cv.unread) : cv.last?.mine && cv.last.seen ? h('small', { class: 'muted' }, '✓ pročitano') : null))))
      : h('p', { class: 'notice' }, 'Još nemaš poruka. Napiši nekome iz svoje lige — gumb „Pošalji poruku“ je i na svakom profilu.'),
    h('p', { class: 'small muted' }, 'Tko ti smije pisati, biraš u ', h('a', { href: '/profil#poruke' }, 'postavkama'), '. E-mail adrese se nikad ne prikazuju.'))));
}
async function viewConversation([id]) {
  if (!registered()) return go('/poruke', true);
  let d = await get(`/api/conversations/${id}`);
  let oldest = d.messages[0]?.id, more = d.more, newest = d.messages.at(-1)?.id || 0;
  const list = h('div', { class: 'msgs', 'aria-live': 'polite' });
  const older = h('button', { class: 'btn sm', hidden: !more, onclick: loadOlder }, 'Starije poruke');
  const input = h('textarea', { class: 'input msg-input', rows: 1, maxlength: 1000, placeholder: d.can_send ? 'Napiši poruku…' : d.cannot_send_reason || 'Ne možeš slati poruke ovom igraču.', disabled: !d.can_send, 'aria-label': 'Poruka', enterkeyhint: 'send' });
  const sendBtn = h('button', { class: 'btn primary', disabled: !d.can_send }, 'Pošalji');
  const bubble = (m) => h('div', { class: 'msg' + (m.mine ? ' mine' : '') + (m.removed ? ' removed' : ''), 'data-id': m.id },
    h('div', { class: 'mbody' }, m.removed ? 'Poruku je uklonio administrator.' : m.body),
    h('div', { class: 'mmeta' }, h('time', { datetime: m.at, title: new Date(m.at).toLocaleString('hr-HR') }, clockTime(m.at)),
      !m.mine && !m.removed ? h('button', { class: 'linkbtn', onclick: async (e) => { const reason = prompt('Zašto prijavljuješ ovu poruku?'); if (reason == null) return; try { await post(`/api/messages/${m.id}/report`, { reason }); e.target.replaceWith(h('span', {}, 'prijavljeno')); toast('Hvala, administrator će pregledati poruku.'); } catch (err) { toast(err.message); } } }, 'prijavi') : null,
      m.mine && m.id === newest && d.their_read_id >= m.id ? h('span', {}, '· pročitano') : null));
  const dayOf = (iso) => new Intl.DateTimeFormat('hr-HR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));
  const render_ = (msgs) => { const out = []; let day = ''; for (const m of msgs) { const dd = dayOf(m.at); if (dd !== day) { day = dd; out.push(h('div', { class: 'mday' }, dd)); } out.push(bubble(m)); } return out; };
  let all = d.messages;
  const paint = (keep) => { const fromBottom = list.scrollHeight - list.scrollTop; fill(list, older, render_(all)); if (keep) list.scrollTop = list.scrollHeight - fromBottom; else list.scrollTop = list.scrollHeight; };
  async function loadOlder() { const o = await get(`/api/conversations/${id}?before=${oldest}`); all = [...o.messages, ...all]; oldest = all[0]?.id; more = o.more; older.hidden = !more; paint(true); }
  const markRead = () => { if (newest) post(`/api/conversations/${id}/read`, { last_id: newest }).then((r) => applyCounts({ ...counts, unread: counts.notif, messages_unread: r.unread, last_id: counts.last_id }, true)).catch(() => {}); };
  async function refresh() {
    if (document.hidden) return;
    try {
      const n = await get(`/api/conversations/${id}`);
      const fresh = n.messages.filter((m) => m.id > newest);
      d = { ...d, their_read_id: n.their_read_id, can_send: n.can_send, cannot_send_reason: n.cannot_send_reason };
      if (fresh.length) { all = [...all, ...fresh]; newest = all.at(-1).id; paint(false); markRead(); if (fresh.some((m) => !m.mine)) sound.play('message'); }
      else paint(true);
    } catch { /* bez veze — idući put */ }
  }
  const send = async (e) => {
    e?.preventDefault();
    const body = input.value.trim();
    if (!body) return;
    sendBtn.disabled = true;
    try { const m = await post(`/api/conversations/${id}/messages`, { body }); input.value = ''; input.style.height = ''; all = [...all, m]; newest = m.id; paint(false); }
    catch (err) { toast(err.message); }
    finally { sendBtn.disabled = !d.can_send; input.focus(); }
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer: coarse)').matches) send(e); });
  input.addEventListener('input', () => { input.style.height = ''; input.style.height = Math.min(140, input.scrollHeight) + 'px'; });
  const menu = h('details', { class: 'cmenu' }, h('summary', { class: 'iconbtn', 'aria-label': 'Više mogućnosti' }, '⋯'),
    h('div', { class: 'cmenu-in' },
      h('a', { href: `/igrac/${encodeURIComponent(d.other.nickname)}` }, 'Profil igrača'),
      h('a', { href: `/izazovi?protiv=${encodeURIComponent(d.other.nickname)}` }, '🥊 Izazovi na dvoboj'),
      h('button', { onclick: async () => { if (!confirm('Obrisati razgovor kod sebe? Druga strana ga i dalje vidi.')) return; await post(`/api/conversations/${id}/hide`); go('/poruke'); } }, 'Obriši razgovor kod sebe'),
      d.i_blocked ? h('button', { onclick: async () => { await api('DELETE', `/api/blocks/${d.other.id}`); toast('Igrač je odblokiran.'); render(); } }, 'Odblokiraj')
        : h('button', { onclick: async () => { if (!confirm(`Blokirati igrača ${d.other.nickname}? Više ti neće moći pisati ni slati izazove.`)) return; await post('/api/blocks', { user_id: d.other.id }); toast('Igrač je blokiran.'); render(); } }, 'Blokiraj'),
      h('button', { onclick: async () => { const reason = prompt('Što nije u redu s ovim igračem?'); if (reason == null) return; await post('/api/report-content', { target_type: 'korisnik', target_id: d.other.id, reason }); toast('Prijava je poslana.'); } }, 'Prijavi igrača')));
  mount(shell(h('div', { class: 'chat' },
    h('div', { class: 'chat-head' }, h('a', { class: 'iconbtn', href: '/poruke', 'aria-label': 'Natrag na poruke' }, '‹'), avatar(d.other), h('a', { class: 'chat-name', href: `/igrac/${encodeURIComponent(d.other.nickname)}` }, d.other.nickname), menu),
    list,
    h('form', { class: 'chat-form', onsubmit: send }, input, sendBtn),
    d.can_send ? null : h('p', { class: 'small muted chat-note' }, d.cannot_send_reason)), { game: true }));
  paint(false);
  markRead();
  const timer = setInterval(refresh, 6000);
  cleanup = () => clearInterval(timer);
  if (d.can_send && !matchMedia('(pointer: coarse)').matches) input.focus();
}

// ---------- Izazovi ----------
const DUEL_LABEL = { ceka: '⏳ Čeka odgovor', prihvacen: '🥊 U tijeku', odbijen: '❌ Odbijen', istekao: '⌛ Istekao', otkazan: '✖ Otkazan', zavrsen: 'Završen' };
async function viewDuels(_, query) {
  if (!registered()) return mount(shell(h('div', { class: 'stack' }, h('h1', {}, '🥊 Izazovi'), needAccount('Izazovi su dvoboji na službenoj dnevnoj partiji. Za njih treba račun.'))));
  const [d, c] = await Promise.all([get('/api/duels'), get('/api/contacts')]);
  const opp = h('input', { class: 'input', list: 'suparnici', value: query.protiv || '', placeholder: 'Nadimak suparnika', 'aria-label': 'Suparnik', autocomplete: 'off', required: true });
  const mapSel = h('select', { class: 'input', 'aria-label': 'Karta' }, d.maps.map((m) => h('option', { value: m.slug }, `${m.name}`)));
  if (query.karta) mapSel.value = query.karta;
  const dates = []; for (let i = 0; i < 8; i++) dates.push(shift(d.today, i));
  const dateSel = h('select', { class: 'input', 'aria-label': 'Dan' }, dates.map((x, i) => h('option', { value: x }, i === 0 ? 'Danas' : i === 1 ? 'Sutra' : cap(dateLong(x)))));
  const msg = h('input', { class: 'input', maxlength: 140, placeholder: 'Poruka uz izazov (neobavezno)', 'aria-label': 'Poruka uz izazov' });
  const form = h('form', { class: 'panel stack', onsubmit: async (e) => { e.preventDefault(); try { await post('/api/duels', { nickname: opp.value.trim(), map: mapSel.value, date: dateSel.value, message: msg.value }); toast('Izazov je poslan.'); go('/izazovi', true); } catch (err) { toast(err.message); } } },
    h('h2', {}, 'Novi izazov'),
    h('div', { class: 'grid-form' }, h('label', { class: 'field' }, h('span', {}, 'Suparnik'), opp), h('label', { class: 'field' }, h('span', {}, 'Karta'), mapSel), h('label', { class: 'field' }, h('span', {}, 'Dan'), dateSel)),
    h('label', { class: 'field' }, h('span', {}, 'Poruka'), msg), h('datalist', { id: 'suparnici' }, c.players.map((p) => h('option', { value: p.nickname }))),
    h('p', { class: 'small muted' }, 'Oboje igrate svoju normalnu službenu partiju tog dana. Pobjeđuje tko stigne dalje — izazov ne daje kilometre ni dodatnu partiju.'),
    h('button', { class: 'btn primary' }, '🥊 Pošalji izazov'));
  const res = (x) => (x ? `${nf.format(Math.round(x.km))} km · ${x.rank}. mjesto${x.rare ? ` · 💎 ${x.rare}` : ''}${x.reached_goal ? ' · 🏁' : ''}` : null);
  const card = (x) => {
    const head = x.status === 'zavrsen' ? (x.won === true ? '🏆 Pobjeda' : x.won === false ? '🥊 Poraz' : x.outcome === 'nitko' ? '🤷 Nitko nije igrao' : '🤝 Neriješeno') : DUEL_LABEL[x.status];
    return h('article', { class: 'duel-card ' + x.status + (x.won === true ? ' won' : x.won === false ? ' lost' : '') },
      h('div', { class: 'row spread' }, h('span', { class: 'who' }, avatar(x.opponent), h('a', { href: `/igrac/${encodeURIComponent(x.opponent.nickname)}` }, x.opponent.nickname)), h('b', { class: 'dstatus' }, head)),
      h('div', { class: 'small muted' }, withFlag(x.map), ' · ', x.date === d.today ? 'danas' : dateShort(x.date), ' · ', x.outgoing ? 'ti si izazvao' : 'izazvao te'),
      x.message ? h('p', { class: 'small' }, `„${x.message}“`) : null,
      x.me || x.them || x.status === 'zavrsen' ? h('div', { class: 'dscore' },
        h('div', {}, h('small', {}, 'Ti'), h('b', {}, res(x.me) || (x.status === 'zavrsen' ? 'nije odigrano' : 'još nisi odigrao'))),
        h('div', {}, h('small', {}, x.opponent.nickname), h('b', {}, res(x.them) || (x.status === 'zavrsen' ? 'nije odigrano' : x.them_played ? 'odigrao (vidiš kad i ti odigraš)' : 'još nije odigrao')))) : null,
      x.outcome === 'predaja' ? h('p', { class: 'small muted' }, 'Završeno predajom: jedna strana nije odigrala tog dana.') : null,
      h('div', { class: 'row wrapline' },
        x.can_respond ? [h('button', { class: 'btn primary sm', onclick: async () => { try { await post(`/api/duels/${x.id}/accept`); sound.play('accept'); render(); } catch (e) { toast(e.message); } } }, 'Prihvati'), h('button', { class: 'btn sm', onclick: async () => { await post(`/api/duels/${x.id}/decline`); render(); } }, 'Odbij')] : null,
        x.can_cancel ? h('button', { class: 'btn sm', onclick: async () => { await post(`/api/duels/${x.id}/cancel`); render(); } }, 'Otkaži') : null,
        x.status === 'prihvacen' && !x.me && x.date === d.today ? h('a', { class: 'btn primary sm', href: `/igra/${x.map.slug}` }, 'Igraj sada') : null,
        !['ceka', 'prihvacen'].includes(x.status) ? h('a', { class: 'btn sm', href: `/izazovi?protiv=${encodeURIComponent(x.opponent.nickname)}&karta=${x.map.slug}` }, 'Izazovi ponovno') : null,
        h('a', { class: 'btn sm', href: '#', onclick: async (e) => { e.preventDefault(); try { const r = await post('/api/conversations', { user_id: x.opponent.id }); go(`/poruke/${r.id}`); } catch (err) { toast(err.message); } } }, '✉️')));
  };
  const section = (title, list, empty) => h('section', { class: 'stack' }, h('h2', {}, title, list.length ? h('span', { class: 'muted' }, ` (${list.length})`) : null), list.length ? h('div', { class: 'duels-grid' }, list.map(card)) : h('p', { class: 'muted small' }, empty));
  mount(shell(h('div', { class: 'stack-lg' },
    h('div', { class: 'row spread wrapline' }, h('h1', {}, '🥊 Moji izazovi'),
      h('div', { class: 'stats mini' }, h('div', { class: 'stat' }, h('b', {}, `🏆 ${d.record.wins}`), h('span', {}, 'pobjeda')), h('div', { class: 'stat' }, h('b', {}, `🤝 ${d.record.draws}`), h('span', {}, 'neriješeno')), h('div', { class: 'stat' }, h('b', {}, d.record.losses), h('span', {}, 'poraza')))),
    section('Dolazni', d.incoming, 'Nitko te trenutno ne izaziva.'),
    section('U tijeku', d.active, 'Nema aktivnih dvoboja.'),
    form,
    section('Poslani', d.outgoing, 'Nema poslanih izazova na čekanju.'),
    section('Povijest', d.finished, 'Još nema završenih izazova.'))));
  if (query.protiv) form.scrollIntoView({ block: 'center' });
}
async function viewUnsubscribe(_, query) {
  let msg;
  try { await post('/api/unsubscribe', { token: query.t }); msg = h('p', { class: 'notice ok' }, 'Odjavljen si s e-mail obavijesti Ontalea. Više ti nećemo slati podsjetnike ni sažetke poruka.'); }
  catch (e) { msg = h('p', { class: 'notice err' }, e.message); }
  mount(shell(h('div', { class: 'col stack' }, h('h1', {}, 'E-mail obavijesti'), msg, h('p', { class: 'small muted' }, 'Ako se predomisliš, e-mail obavijesti ponovno uključuješ u postavkama profila.'), h('a', { class: 'btn', href: '/' }, 'Na naslovnicu'))));
}

// ---------- Postavke profila: obavijesti, e-mail, poruke, zvuk, karta, blokirani ----------
function settingsBlocks(prefs, blocks) {
  const toggle = (key, label, note) => {
    const c = h('input', { type: 'checkbox', checked: !!prefs[key], onchange: async (e) => { try { const r = await api('PATCH', '/api/me/prefs', { [key]: e.target.checked }); Object.assign(prefs, r); toast('Spremljeno.'); } catch (err) { e.target.checked = !e.target.checked; toast(err.message); } } });
    return h('label', { class: 'toggle' }, c, h('span', {}, h('b', {}, label), note ? h('small', { class: 'muted' }, note) : null));
  };
  const policy = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Tko mi smije pisati' }, [['lige', 'Članovi mojih liga'], ['svi', 'Svi registrirani'], ['nitko', 'Nitko']].map(([v, l]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(prefs.dm_policy === v), 'aria-pressed': String(prefs.dm_policy === v), onclick: async (e) => { const r = await api('PATCH', '/api/me/prefs', { dm_policy: v }); Object.assign(prefs, r); for (const b of e.target.parentNode.children) { b.setAttribute('aria-pressed', String(b === e.target)); b.setAttribute('aria-checked', String(b === e.target)); } toast('Spremljeno.'); } }, l)));
  const sp = sound.prefs;
  const vol = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: sp.volume, 'aria-label': 'Glasnoća', oninput: (e) => sound.set({ volume: Number(e.target.value) }) });
  const sndToggle = (k, label) => h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: sp[k], onchange: (e) => sound.set({ [k]: e.target.checked }) }), h('span', {}, h('b', {}, label)));
  const cfg = boot.site.map;
  return [
    h('section', { class: 'panel stack', id: 'obavijesti' }, h('h2', {}, '🔔 Obavijesti u aplikaciji'),
      toggle('notif_inapp', 'Obavijesti uključene', 'Glavni prekidač za zvonce.'),
      h('div', { class: 'toggles' }, toggle('notif_messages', 'Nove privatne poruke'), toggle('notif_league', 'Liga: vodstvo i „svi su odigrali“'), toggle('notif_overtake', 'Kad me netko prestigne'), toggle('notif_challenges', 'Izazovi'), toggle('notif_awards', 'Nagrade (dnevne, tjedne, mjesečne)'), toggle('notif_daily', 'Podsjetnik kad nekoliko dana ne igram'))),
    h('section', { class: 'panel stack' }, h('h2', {}, '✉️ E-mail'),
      prefs.email_configured ? null : h('p', { class: 'notice' }, 'Slanje e-maila još nije uključeno na poslužitelju. Postavka se pamti i počinje vrijediti kad se uključi.'),
      toggle('email_reminders', 'Podsjetnik e-mailom nakon nekoliko dana bez igre', 'Najviše jednom tjedno, samo dok ne igraš. Bez reklama.'),
      toggle('email_messages', 'Sažetak nepročitanih poruka', 'Najviše jedan e-mail u nekoliko sati, bez sadržaja poruka.'),
      h('p', { class: 'small muted' }, 'Uključivanjem pristaješ da ti na adresu računa šaljemo samo ove obavijesti. Odjava je jednim klikom u svakom e-mailu.')),
    h('section', { class: 'panel stack', id: 'poruke' }, h('h2', {}, '💬 Tko mi smije pisati i slati izazove'), policy,
      blocks.length ? [h('h3', {}, 'Blokirani igrači'), h('div', { class: 'stack' }, blocks.map((b) => h('div', { class: 'row spread' }, h('span', { class: 'who' }, avatar(b), b.nickname), h('button', { class: 'btn sm', onclick: async () => { await api('DELETE', `/api/blocks/${b.id}`); toast('Odblokirano.'); render(); } }, 'Odblokiraj'))))] : h('p', { class: 'small muted' }, 'Nemaš blokiranih igrača.')),
    sound.available ? h('section', { class: 'panel stack', id: 'zvuk' }, h('h2', {}, '🔊 Zvuk'),
      sndToggle('on', 'Zvuk uključen'), h('label', { class: 'field' }, h('span', {}, 'Glasnoća'), vol),
      h('div', { class: 'toggles' }, sndToggle('game', 'Zvukovi igre (odbrojavanje, vožnja, gradovi)'), sndToggle('notif', 'Zvukovi obavijesti i poruka')),
      h('div', { class: 'row wrapline' }, h('button', { class: 'btn sm', onclick: () => sound.preview('synth:accept') }, '▶ Probaj'), h('button', { class: 'btn sm', onclick: () => sound.preview('file:tramvaj') }, '▶ Dolazak u Zagreb'), h('button', { class: 'btn sm', onclick: () => sound.preview('synth:notify') }, '▶ Obavijest')),
      h('p', { class: 'small muted' }, 'Sve što zvuk javlja vidi se i na zaslonu. Postavka se pamti na ovom uređaju i na tvom računu.')) : null,
    cfg.modes.satelit ? h('section', { class: 'panel stack' }, h('h2', {}, '🗺️ Karta'),
      h('div', { class: 'seg' }, [['reljef', '⛰️ Reljef'], ['satelit', '🛰️ Satelit']].map(([v, l]) => h('button', { type: 'button', 'aria-pressed': String(mapView() === v), onclick: (e) => { setMapView(v); for (const b of e.target.parentNode.children) b.setAttribute('aria-pressed', String(b === e.target)); toast('Spremljeno.'); } }, l)))) : null,
  ];
}
// ---------- Nagrade lige (kartica „Nagrade“) ----------
function awardsBody(aw) {
  const row = (a) => h('div', { class: 'award' + (a.self ? ' self' : '') }, h('span', { class: 'aw-ic', 'aria-hidden': 'true' }, a.rank === 2 ? '🥈' : a.rank === 3 ? '🥉' : a.emoji),
    h('div', {}, h('small', {}, a.rank > 1 ? `${a.rank}. mjesto · ${a.title}` : a.title), h('div', {}, h('a', { href: `/igrac/${encodeURIComponent(a.nickname)}` }, h('b', {}, a.self ? 'Ti' : a.nickname))), h('small', { class: 'muted' }, a.value_text)));
  const period = (p, label) => h('div', { class: 'card stack' }, h('h3', {}, label, h('span', { class: 'small muted' }, ` · ${dateShort(p.start)} – ${dateShort(p.end)}`)), p.awards.length ? p.awards.map(row) : h('p', { class: 'muted small' }, 'Nema dovoljno službenih partija za nagrade.'));
  return [
    h('p', { class: 'small muted' }, 'Tjedne nagrade dodjeljuju se u ponedjeljak, mjesečne prvog dana u mjesecu. Računaju se samo službene partije; nagrade ne donose kilometre.'),
    h('div', { class: 'rx-two' }, period(aw.current.week, 'Ovaj tjedan (zasad)'), period(aw.current.month, 'Ovaj mjesec (zasad)')),
    aw.hall.length ? h('div', { class: 'card stack' }, h('h3', {}, '🏛️ Dvorana slavnih — medalje'), h('div', { class: 'medals' }, aw.hall.map((m) => h('div', { class: 'medal-row' + (m.self ? ' self' : '') }, h('b', {}, m.self ? 'Ti' : m.nickname), h('span', {}, `🥇 ${m.gold}`), h('span', {}, `🥈 ${m.silver}`), h('span', {}, `🥉 ${m.bronze}`), h('span', { title: 'Ostale nagrade' }, `🏅 ${m.badges}`))))) : null,
    h('h3', {}, 'Prošli tjedni'), aw.weeks.length ? aw.weeks.map((w) => period(w, 'Tjedan')) : h('p', { class: 'muted small' }, 'Prvi tjedan lige još nije završio.'),
    h('h3', {}, 'Prošli mjeseci'), aw.months.length ? aw.months.map((m) => period(m, cap(new Intl.DateTimeFormat('hr-HR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(m.start + 'T12:00:00Z'))))) : h('p', { class: 'muted small' }, 'Prvi mjesec lige još nije završio.'),
  ];
}
async function openConversationWith(userId) { try { const r = await post('/api/conversations', { user_id: userId }); go(`/poruke/${r.id}`); } catch (e) { toast(e.message); } }

render();
