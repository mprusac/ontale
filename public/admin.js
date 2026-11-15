// ONTALE — administratorsko sučelje. Sve ovlasti provjerava poslužitelj; ovo je samo prikaz.
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
async function api(method, url, body) {
  const res = await fetch('/api/admin' + url, { method, headers: { 'Content-Type': 'application/json', 'X-Ontale': '1' }, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null;
  try { data = await res.json(); } catch { /* prazno */ }
  if (!res.ok) { const e = new Error((data && data.error) || `Greška ${res.status}`); e.status = res.status; e.data = data || {}; throw e; }
  return data;
}
const get = (u) => api('GET', u), post = (u, b = {}) => api('POST', u, b), patch = (u, b) => api('PATCH', u, b), del = (u) => api('DELETE', u);
function toast(msg) { document.querySelector('.toast')?.remove(); const t = h('div', { class: 'toast', role: 'status' }, msg); document.body.append(t); setTimeout(() => t.remove(), 3500); }
const run = (fn, okMsg) => async (...a) => { try { const r = await fn(...a); if (okMsg) toast(okMsg); return r; } catch (e) { toast(e.message); } };
const inp = (value, attrs = {}) => h('input', { class: 'input', value: value ?? '', ...attrs });
const area = (value, attrs = {}) => { const t = h('textarea', { class: 'input', ...attrs }); t.value = value ?? ''; return t; };
const sel = (options, value, attrs = {}) => { const s = h('select', { class: 'input', ...attrs }, options.map(([v, l]) => h('option', { value: v }, l))); s.value = value ?? ''; return s; };
const chk = (on, attrs = {}) => { const c = h('input', { type: 'checkbox', ...attrs }); c.checked = !!on; return c; };
const field = (label, control, note) => h('label', { class: 'field' }, h('span', {}, label), control, note ? h('span', { class: 'small muted', style: 'font-weight:400;margin:2px 0 0' }, note) : null);
const table = (heads, rows, empty = 'Nema podataka.') => rows.length ? h('div', { class: 'panel flush scroll-x' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, heads.map((x) => h('th', {}, x)))), h('tbody', {}, rows))) : h('p', { class: 'notice' }, empty);
const tr = (...cells) => h('tr', {}, cells.map((c) => (c && c.tagName === 'TD' ? c : h('td', {}, c))));
const when = (iso) => (iso ? new Date(iso).toLocaleString('hr-HR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const numOrNull = (v) => (v === '' || v == null ? null : Number(v));
const LEVELS = ['—', '1', '2', '3', '4', '5', '6', '7'];

const app = document.getElementById('app');
let me = null, cats = [], dash = null, modCount = 0;
const NAV = [['', 'Nadzorna ploča'], ['pitanja', 'Pitanja'], ['izazovi', 'Dnevni izazovi'], ['kvaliteta', 'Kvaliteta sadržaja'], ['nepoznati', 'Nepoznati odgovori'], ['karte', 'Karte i gradovi'], ['prijevoz', 'Prijevozna sredstva'], ['korisnici', 'Korisnici'], ['lige', 'Lige i prijave'], ['moderacija', 'Moderacija'], ['obavijesti', 'Obavijesti i e-mail'], ['dvoboji', 'Izazovi prijatelja'], ['zvuk', 'Zvuk'], ['karta', 'Karta i podloge'], ['postavke', 'Postavke'], ['dnevnik', 'Dnevnik izmjena']];

function shell(content) {
  const cur = location.hash.replace(/^#\/?/, '').split('/')[0];
  return h('div', { class: 'adm-shell' },
    h('aside', { class: 'adm-side' },
      h('a', { class: 'logo', href: '/' }, h('span', {}, 'Ontale')),
      h('nav', {}, NAV.map(([k, label]) => h('a', { href: '#/' + k, 'aria-current': cur === k ? 'page' : null }, label, k === 'nepoznati' && dash?.pending_reports ? h('b', {}, dash.pending_reports) : null, k === 'moderacija' && modCount ? h('b', {}, modCount) : null))),
      h('p', { class: 'who' }, 'Prijavljen: ', me.nickname, h('br'), h('a', { href: '/' }, 'Natrag u igru'))),
    h('main', { class: 'adm-main' }, content));
}
const mount = (...content) => app.replaceChildren(shell(content));
const go = (hash) => { if (location.hash === '#/' + hash) render(); else location.hash = '#/' + hash; };

const routes = [
  [/^$/, vDashboard], [/^pitanja$/, vQuestions], [/^pitanja\/(novo|\d+)$/, vQuestion], [/^izazovi$/, vChallenges], [/^izazovi\/(novo|\d+)$/, vChallenge],
  [/^kvaliteta$/, vQuality], [/^nepoznati$/, vUnknown], [/^karte$/, vMaps], [/^prijevoz$/, vTransport], [/^korisnici$/, vUsers], [/^korisnici\/(\d+)$/, vUser], [/^lige$/, vLeagues], [/^postavke$/, vSettings], [/^dnevnik$/, vAudit],
  [/^moderacija$/, vModeration], [/^obavijesti$/, vNotifAdmin], [/^dvoboji$/, vDuelsAdmin], [/^zvuk$/, vAudioAdmin], [/^karta$/, vMapAdmin],
];
async function render() {
  const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  try {
    if (!me) {
      const b = await (await fetch('/api/bootstrap')).json();
      if (!b.me?.is_admin) { app.replaceChildren(h('div', { class: 'wrap stack', style: 'padding-top:40px' }, h('h1', {}, 'Samo za administratore'), h('p', {}, b.me ? 'Tvoj račun nema administratorske ovlasti.' : 'Prijavi se administratorskim računom.'), h('a', { class: 'btn primary', href: '/prijava?novi=0' }, 'Prijava'))); return; }
      me = b.me;
      cats = await get('/categories');
    }
    dash = await get('/dashboard');
    try { const m = await get('/moderation/counts'); modCount = m.messages + m.signs; } catch { modCount = 0; }
    const hit = routes.map(([re, fn]) => [path.match(re), fn]).find(([m]) => m);
    if (!hit) return mount(h('h1', {}, 'Nepoznata stranica'));
    await hit[1](hit[0].slice(1), query);
    window.scrollTo(0, 0);
  } catch (e) { mount(h('h1', {}, 'Greška'), h('p', { class: 'notice err' }, e.message)); }
}
window.addEventListener('hashchange', render);

// ================= Nadzorna ploča =================
async function vDashboard() {
  const d = dash;
  const stat = (v, label) => h('div', { class: 'stat' }, h('b', {}, v), h('span', {}, label));
  mount(h('h1', {}, `Nadzorna ploča — ${d.date}`),
    d.days_scheduled_ahead < 3 ? h('p', { class: 'notice err' }, `Pripremljeno je još samo ${d.days_scheduled_ahead} dana izazova (uključujući današnji). Dodaj nove u "Dnevni izazovi".`) : null,
    h('div', { class: 'stats' }, stat(d.users, 'registriranih korisnika'), stat(d.guests, 'gostiju'), stat(d.active_today, 'aktivnih igrača danas'), stat(d.games_today, 'službenih partija danas'),
      stat(d.games_total, 'partija ukupno'), stat(d.leagues, `aktivnih liga (od ${d.leagues_all})`), stat(d.avg_km_today || d.avg_km, d.avg_km_today ? 'prosjek km danas' : 'prosjek km'), stat(`${d.goals_today} / ${d.goals}`, 'u cilju danas / ukupno'),
      stat(d.pending_reports, 'prijava odgovora čeka'), stat(d.pending_content, 'prijava sadržaja čeka'), stat(d.days_scheduled_ahead, 'pripremljenih dana'), stat(d.seen_24h, 'viđenih u 24 h')),
    h('div', { class: 'grid two' },
      h('div', {}, h('h2', {}, 'Kategorije po prosječnim kilometrima'), table(['Kategorija', 'Odgovora', 'Prosjek km', 'Točnost'], d.categories.map((c) => tr(`${c.emoji} ${c.name}`, c.answers, c.avg_km, c.accuracy + ' %')), 'Još nema odigranih pitanja.')),
      h('div', {}, h('h2', {}, 'Nadolazeći izazovi'), table(['Datum', 'Opseg', 'Pitanja', 'Stanje'], d.upcoming.map((c) => tr(c.date, c.scope, c.questions, c.active ? h('span', { class: 'tag ok' }, 'aktivan') : h('span', { class: 'tag warn' }, 'neaktivan'))))),
      h('div', {}, h('h2', {}, 'Najčešći odgovori'), table(['Odgovor', 'Pitanje', 'Igrača'], d.common.map((c) => tr(h('b', {}, c.canonical), c.question, c.players)), 'Još nema odgovora.')),
      h('div', {}, h('h2', {}, 'Najrjeđi dani odgovori'), table(['Odgovor', 'Pitanje', 'Igrača'], d.rare.map((c) => tr(h('b', {}, c.canonical), c.question, c.players)), 'Još nema odgovora.'))));
}

// ================= Pitanja =================
async function vQuestions(_, q) {
  const data = await get('/questions?' + new URLSearchParams(q));
  const set = (k, v) => { const n = { ...q, [k]: v, page: 1 }; if (!v) delete n[k]; go('pitanja?' + new URLSearchParams(n)); };
  const picked = new Set();
  const search = inp(q.q, { placeholder: 'Tekst ili ID', onkeydown: (e) => { if (e.key === 'Enter') set('q', search.value); } });
  const file = h('input', { type: 'file', accept: '.csv,.json', hidden: true, onchange: run(async () => {
    const f = file.files[0]; if (!f) return;
    const r = await post('/questions/import', { format: f.name.endsWith('.csv') ? 'csv' : 'json', data: await f.text() });
    alert(`Uvezeno pitanja: ${r.imported} (neaktivna, pregledaj ih prije objave).` + (r.errors.length ? `\n\nGreške:\n` + r.errors.map((e) => `Red ${e.row}: ${e.error}`).join('\n') : ''));
    render();
  }) });
  const bulk = (patch, label) => h('button', { class: 'btn xs', onclick: run(async () => { if (!picked.size) return toast('Označi pitanja.'); if (patch.delete && !confirm(`Obrisati ${picked.size} pitanja? Korištena pitanja se preskaču.`)) return; const r = await post('/questions/bulk', { ids: [...picked], patch }); toast(`Izmijenjeno: ${r.changed}`); render(); }) }, label);
  const bulkCat = sel([['', 'Premjesti u kategoriju…'], ...cats.map((c) => [c.id, c.name])], '', { style: 'width:auto', onchange: run(async () => { if (!bulkCat.value || !picked.size) return; await post('/questions/bulk', { ids: [...picked], patch: { category_id: Number(bulkCat.value) } }); render(); }) });
  mount(h('h1', {}, `Pitanja (${data.total})`),
    h('div', { class: 'toolbar' },
      field('Traži', search),
      field('Kategorija', sel([['', 'Sve'], ...cats.map((c) => [c.id, c.name])], q.category, { onchange: (e) => set('category', e.target.value) })),
      field('Vrsta', sel([['', 'Sve'], ['open', 'Otvoreno'], ['numeric', 'Procjena']], q.type, { onchange: (e) => set('type', e.target.value) })),
      field('Stanje', sel([['', 'Sva'], ['1', 'Aktivna'], ['0', 'Neaktivna']], q.active, { onchange: (e) => set('active', e.target.value) })),
      field('Raspored', sel([['', 'Sva'], ['1', 'U izazovu'], ['0', 'Neraspoređena']], q.scheduled, { onchange: (e) => set('scheduled', e.target.value) })),
      h('a', { class: 'btn primary', href: '#/pitanja/novo' }, 'Novo pitanje'), file, h('button', { class: 'btn', onclick: () => file.click() }, 'Uvezi CSV ili JSON')),
    h('div', { class: 'toolbar' }, h('span', { class: 'small', style: 'font-weight:800' }, 'Označena:'), bulk({ active: true }, 'Aktiviraj'), bulk({ active: false }, 'Deaktiviraj'), bulkCat,
      [1, 2, 3, 4, 5].map((n) => bulk({ difficulty: n }, `Težina ${n}`)), bulk({ delete: true }, 'Obriši')),
    table([h('input', { type: 'checkbox', onchange: (e) => { document.querySelectorAll('.pick').forEach((c) => { c.checked = e.target.checked; c.dispatchEvent(new Event('change')); }); } }), 'ID', 'Pitanje', 'Kategorija', 'Vrsta', 'Odgovora', 'Težina', 'Datumi', 'Stanje'],
      data.rows.map((r) => tr(chk(false, { class: 'pick', onchange: (e) => (e.target.checked ? picked.add(r.id) : picked.delete(r.id)) }), r.id,
        h('a', { href: `#/pitanja/${r.id}`, style: 'font-weight:800' }, r.text), `${r.emoji} ${r.category}`, r.type === 'numeric' ? 'procjena' : 'otvoreno', r.type === 'numeric' ? '—' : r.answers, r.difficulty, r.dates || h('span', { class: 'muted' }, 'neraspoređeno'),
        h('span', {}, r.active ? h('span', { class: 'tag ok' }, 'aktivno') : h('span', { class: 'tag' }, 'neaktivno'), r.reports ? h('span', { class: 'tag bad', style: 'margin-left:4px' }, `${r.reports} prijava`) : null)))),
    h('div', { class: 'row', style: 'margin-top:12px' }, data.page > 1 ? h('a', { class: 'btn xs', href: '#/pitanja?' + new URLSearchParams({ ...q, page: data.page - 1 }) }, 'Prethodna') : null, h('span', {}, `Stranica ${data.page} od ${Math.max(1, data.pages)}`), data.page < data.pages ? h('a', { class: 'btn xs', href: '#/pitanja?' + new URLSearchParams({ ...q, page: data.page + 1 }) }, 'Sljedeća') : null),
    h('details', { style: 'margin-top:18px' }, h('summary', { style: 'font-weight:800;cursor:pointer' }, 'Oblik datoteke za uvoz'),
      h('p', {}, 'CSV (odvojen točkom-zarezom), prvi red su nazivi stupaca: kategorija; vrsta; tekst; pojasnjenje; vrsta_odgovora; tezina; odgovori; vrijednost; jedinica; datum; tolerancija; izvor_naziv; izvor_url'),
      h('p', {}, 'U stupcu "odgovori" odgovore dijeli znak |, a aliase znak =, npr. Marin Čilić=Cilic|Goran Ivanišević. Za procjene se popunjavaju vrijednost, jedinica i datum. JSON: popis objekata s poljima category, type, text, hint, answer_kind, answers [{canonical, aliases, prior_popularity, explanation}], target, sources.')));
}

async function vQuestion([id]) {
  const isNew = id === 'novo';
  const q = isNew ? { type: 'open', active: 0, difficulty: 3, answer_kind: 'person', answers: [], sources: [], dates: [] } : await get(`/questions/${id}`);
  const numeric = () => f.type.value === 'numeric';
  const f = {
    category: sel(cats.map((c) => [c.id, `${c.emoji} ${c.name}`]), q.category_id || cats[0]?.id),
    type: sel([['open', 'Otvoreno pitanje (rijetkost)'], ['numeric', 'Brojčana procjena (blizina)']], q.type, { disabled: !isNew, onchange: () => { targetBox.hidden = !numeric(); } }),
    text: area(q.text, { rows: 2 }), hint: inp(q.hint), kind: sel([['person', 'Osoba (prezime je dovoljno)'], ['team', 'Klub ili momčad'], ['country', 'Država ili reprezentacija'], ['other', 'Ostalo']], q.answer_kind),
    sport: inp(q.sport_tag, { placeholder: 'npr. tenis' }), difficulty: sel([1, 2, 3, 4, 5].map((n) => [n, n]), q.difficulty), K: inp(q.prior_strength, { type: 'number', min: 0, step: 1, placeholder: `zadano ${q.default_prior_strength ?? 200}` }),
    verification: inp(q.verification), active: chk(q.active),
  };
  const t = q.target || {};
  const tf = {
    value: inp(t.value, { type: 'number', step: 'any' }), unit: inp(t.unit, { placeholder: 'npr. poena, USD, reketa' }), ref_date: inp(t.ref_date, { type: 'date' }), tolerance: inp(t.tolerance_pct ?? 1, { type: 'number', step: 'any', min: 0 }),
    mode: sel([['pragovi', 'Pragovi pogreške'], ['pragovi+najblizi', 'Pragovi + najbliža procjena dana dobiva najvišu razinu']], t.scoring_mode || 'pragovi'),
    tie: sel([['dijele', 'Jednako bliske procjene dijele bonus'], ['raniji', 'Bonus dobiva ranije poslana procjena']], t.tie_rule || 'dijele'), estimate: chk(t.is_estimate), note: inp(t.note),
    thresholds: inp(t.thresholds_json || '', { placeholder: 'prazno = globalni pragovi; npr. [{"max_pct":3,"level":6},{"max_pct":10,"level":4}]' }), reason: inp('', { placeholder: 'razlog ispravka (bilježi se)' }),
  };
  const targetBox = h('div', { class: 'panel stack', hidden: !numeric() }, h('h2', { style: 'margin-top:0' }, 'Referentna vrijednost'),
    h('div', { class: 'grid' }, field('Točna vrijednost', tf.value), field('Jedinica', tf.unit), field('Stanje na dan', tf.ref_date), field('Tolerancija (%)', tf.tolerance, 'Unutar tolerancije = najviša razina.')),
    h('div', { class: 'grid two' }, field('Način bodovanja', tf.mode), field('Jednake procjene', tf.tie)),
    field('Vlastiti pragovi (JSON)', tf.thresholds, q.default_thresholds ? 'Globalni: ' + q.default_thresholds.map((x) => `≤${x.max_pct} % → ${x.level}`).join(', ') : null),
    h('label', { class: 'row' }, tf.estimate, h('span', {}, 'Vrijednost je procjena, a ne službena statistika (prikazuje se igračima)')), field('Napomena uz vrijednost', tf.note), isNew ? null : field('Razlog promjene vrijednosti', tf.reason));
  const save = run(async () => {
    const body = { category_id: Number(f.category.value), type: f.type.value, text: f.text.value, hint: f.hint.value, answer_kind: f.kind.value, sport_tag: f.sport.value, difficulty: Number(f.difficulty.value), prior_strength: numOrNull(f.K.value), verification: f.verification.value, active: f.active.checked };
    if (numeric()) body.target = { value: numOrNull(tf.value.value), unit: tf.unit.value, ref_date: tf.ref_date.value, tolerance_pct: numOrNull(tf.tolerance.value) ?? 1, scoring_mode: tf.mode.value, tie_rule: tf.tie.value, is_estimate: tf.estimate.checked, note: tf.note.value, thresholds: tf.thresholds.value.trim() ? JSON.parse(tf.thresholds.value) : null, reason: tf.reason.value };
    const r = isNew ? await post('/questions', body) : await patch(`/questions/${id}`, body);
    toast('Pitanje je spremljeno.');
    if (isNew) go(`pitanja/${r.id}`); else render();
  });
  const head = [h('a', { href: '#/pitanja', class: 'small' }, 'Sva pitanja'), h('h1', {}, isNew ? 'Novo pitanje' : `Pitanje #${id}`),
    h('div', { class: 'panel stack' },
      h('div', { class: 'grid two' }, field('Kategorija', f.category), field('Vrsta pitanja', f.type, isNew ? null : 'Vrsta se ne mijenja nakon stvaranja.')),
      field('Tekst pitanja', f.text), field('Pojašnjenje opsega (vidi ga igrač)', f.hint),
      h('div', { class: 'grid' }, field('Vrsta odgovora', f.kind), field('Sport (za procjene)', f.sport), field('Težina', f.difficulty), field('Težina početne procjene K', f.K, 'Koliko "virtualnih igrača" vrijedi početna procjena.')),
      field('Napomena o provjeri sadržaja', f.verification), h('label', { class: 'row' }, f.active, h('span', {}, 'Aktivno (smije u dnevni izazov)'))),
    targetBox,
    h('div', { class: 'row wrapline', style: 'margin-top:12px' }, h('button', { class: 'btn primary', onclick: save }, 'Spremi pitanje'),
      isNew ? null : h('button', { class: 'btn', onclick: run(async () => { const r = await post(`/questions/${id}/copy`); go(`pitanja/${r.id}`); }, 'Kopija je stvorena.') }, 'Kopiraj pitanje'),
      isNew ? null : h('button', { class: 'btn danger', onclick: run(async () => { if (!confirm('Obrisati pitanje?')) return; await del(`/questions/${id}`); go('pitanja'); }) }, 'Obriši'))];
  if (isNew) return mount(...head, h('p', { class: 'small muted', style: 'margin-top:10px' }, 'Odgovori i izvori dodaju se nakon prvog spremanja.'));

  // --- proba, izvori, raspored ---
  const probe = inp('', { placeholder: 'Upiši odgovor kao igrač…' }), probeOut = h('div', { class: 'small' });
  const doProbe = run(async () => {
    const r = await post(`/questions/${id}/test`, { input: probe.value });
    probeOut.replaceChildren(r.status === 'tocno' ? h('span', {}, h('span', { class: 'tag ok' }, 'točno'), q.type === 'numeric' ? ` pogreška ${r.error_pct} %, razina ${r.level} ${r.transport?.emoji || ''}` : ` → ${r.canonical} (${r.via}), rijetkost ${r.rarity}, udio ${r.share} %, razina ${r.level} ${r.transport?.emoji || ''} ${r.transport?.name || ''}`)
      : h('span', {}, h('span', { class: 'tag bad' }, r.status), r.norm ? ` normalizirano: "${r.norm}"` : '', r.count ? ` (${r.count} mogućih odgovora)` : ''));
  });
  probe.addEventListener('keydown', (e) => { if (e.key === 'Enter') doProbe(); });
  const srcTitle = inp('', { placeholder: 'Naziv izvora' }), srcUrl = inp('', { placeholder: 'https://…' });
  const extras = [
    h('h2', {}, 'Proba prepoznavanja'), h('div', { class: 'toolbar' }, h('div', { style: 'flex:1;min-width:220px' }, probe), h('button', { class: 'btn', onclick: doProbe }, 'Provjeri')), probeOut,
    h('h2', {}, 'Izvori za pitanje'),
    table(['Izvor', 'Poveznica', ''], q.sources.map((s) => tr(s.title, s.url ? h('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.url) : '—', h('button', { class: 'btn xs', onclick: run(async () => { await del(`/sources/${s.id}`); render(); }) }, 'Ukloni'))), 'Pitanje još nema izvor.'),
    h('div', { class: 'toolbar', style: 'margin-top:8px' }, srcTitle, srcUrl, h('button', { class: 'btn', onclick: run(async () => { await post(`/questions/${id}/sources`, { title: srcTitle.value, url: srcUrl.value }); render(); }) }, 'Dodaj izvor')),
    h('p', { class: 'small' }, 'U izazovima: ', q.dates.length ? q.dates.map((d) => h('a', { href: `#/izazovi/${d.challenge_id}`, style: 'margin-right:10px' }, `${d.date} (${d.position}.)`)) : 'nije raspoređeno'),
  ];
  if (q.type === 'numeric') {
    const g = await get(`/questions/${id}/guesses`);
    const max = Math.max(1, ...g.bins.map((b) => b.count));
    return mount(...head, ...extras, h('h2', {}, `Pristigle procjene (${g.count} službenih)`),
      g.count ? h('div', { class: 'grid two' },
        h('dl', { class: 'kv panel' }, h('dt', {}, 'Točno'), h('dd', {}, `${g.target.value} ${g.target.unit}`), h('dt', {}, 'Medijan'), h('dd', {}, g.median), h('dt', {}, 'Prosjek'), h('dd', {}, Math.round(g.mean * 100) / 100), h('dt', {}, 'Raspon'), h('dd', {}, `${g.min} – ${g.max}`), h('dt', {}, 'Ispod / iznad'), h('dd', {}, `${g.below} / ${g.above}`)),
        h('div', { class: 'panel' }, g.bins.map((b) => h('div', { class: 'hist' }, h('span', {}, b.label), h('span', { class: 'track' }, h('i', { style: `width:${(b.count / max) * 100}%` })), h('span', {}, b.count))))) : null,
      table(['Igrač', 'Dan', 'Procjena', 'Pogreška', 'Razina', 'Km', 'Vrsta'], g.rows.map((r) => tr(r.nickname, r.date, r.value, (Math.round(r.error_pct * 10) / 10) + ' %', r.level + (r.bonus ? ' ★' : ''), r.km, r.official ? 'službena' : 'neslužbena')), 'Još nema procjena.'),
      h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn', onclick: run(async () => { const r = await post(`/questions/${id}/recalc`, { mode: 'sve' }); toast(`Ponovno obračunato: ${r.changed} odgovora.`); render(); }) }, 'Ponovno obračunaj sve procjene')));
  }

  // --- baza odgovora ---
  const rows = q.answers.map((a) => {
    const c = { canonical: inp(a.canonical), aliases: inp(a.aliases.join('; ')), expl: inp(a.explanation), prior: inp(a.prior_popularity, { type: 'number', step: 'any', min: 0.1, style: 'width:70px' }), manual: inp(a.manual_rarity, { type: 'number', min: 0, max: 100, style: 'width:70px', placeholder: 'auto' }), checked: inp(a.checked_at, { type: 'date' }), active: chk(a.active) };
    const saveBtn = h('button', { class: 'btn xs', disabled: true, onclick: run(async () => {
      await patch(`/answers/${a.id}`, { canonical: c.canonical.value, aliases: c.aliases.value.split(';').map((x) => x.trim()).filter(Boolean), explanation: c.expl.value, prior_popularity: Number(c.prior.value), manual_rarity: numOrNull(c.manual.value), checked_at: c.checked.value || null, active: c.active.checked });
      saveBtn.disabled = true; toast('Spremljeno.');
    }) }, 'Spremi');
    Object.values(c).forEach((el) => el.addEventListener('input', () => { saveBtn.disabled = false; }));
    const row = tr(c.canonical, c.aliases, c.expl, c.prior, c.manual, a.players, a.share + ' %', h('b', {}, a.rarity), a.level, c.checked, c.active,
      h('span', { style: 'white-space:nowrap' }, saveBtn, ' ',
        h('button', { class: 'btn xs', title: a.sources.map((s) => s.url || s.title).join('\n'), onclick: run(async () => { const url = prompt('Poveznica na izvor koji potvrđuje ovaj odgovor:'); if (!url) return; await patch(`/answers/${a.id}`, { source: { title: url, url } }); toast('Izvor je dodan.'); }) }, `Izvor${a.sources.length ? ' (' + a.sources.length + ')' : ''}`), ' ',
        h('button', { class: 'btn xs danger', onclick: run(async () => { if (!confirm(`Obrisati odgovor "${a.canonical}"?`)) return; await del(`/answers/${a.id}`); row.remove(); }) }, '×')));
    row._save = saveBtn;
    return row;
  });
  const na = { canonical: inp('', { placeholder: 'Kanonski naziv' }), aliases: inp('', { placeholder: 'aliasi; nadimci; varijante' }), expl: inp('', { placeholder: 'zašto je točan' }), prior: inp(13, { type: 'number', step: 'any', style: 'width:90px' }), url: inp('', { placeholder: 'izvor (URL)' }) };
  mount(...head, ...extras,
    h('h2', {}, `Baza odgovora (${q.answers.length})`),
    h('p', { class: 'small muted' }, `Glasova igrača: ${q.total_votes}. Efektivna širina: ${q.effective_answers} odgovora. Početna popularnost je relativna težina (npr. 100 = svi ga se sjete, 2 = gotovo nitko). Rijetkost 0–100 računa se iz početne procjene i stvarnih odgovora; ručna rijetkost je nadjačava. Aliasi se odvajaju točkom-zarezom.`),
    h('div', { class: 'toolbar' }, h('button', { class: 'btn', onclick: async () => { for (const r of rows) if (!r._save.disabled) r._save.click(); } }, 'Spremi sve izmjene'),
      h('button', { class: 'btn', onclick: run(async () => { const r = await post(`/questions/${id}/recalc`, { mode: 'novi' }); toast(`Naknadno priznato odgovora: ${r.changed}.`); render(); }) }, 'Priznaj nove odgovore igračima'),
      h('button', { class: 'btn', onclick: run(async () => { if (!confirm('Ponovno bodovati SVE odgovore na ovo pitanje prema trenutnoj bazi i konačnoj učestalosti? Kilometri igrača mogu se promijeniti.')) return; const r = await post(`/questions/${id}/recalc`, { mode: 'sve' }); toast(`Promijenjeno odgovora: ${r.changed}.`); render(); }) }, 'Ponovno izračunaj sve')),
    table(['Odgovor', 'Aliasi', 'Obrazloženje', 'Poč. popularnost', 'Ručna rijetkost', 'Igrača', 'Udio', 'Rijetkost', 'Razina', 'Provjereno', 'Aktivan', ''], rows, 'Baza je prazna — dodaj prve odgovore.'),
    h('h2', {}, 'Dodaj odgovor'),
    h('div', { class: 'toolbar' }, na.canonical, na.aliases, na.expl, field('Popularnost', na.prior), na.url,
      h('button', { class: 'btn primary', onclick: run(async () => { await post(`/questions/${id}/answers`, { canonical: na.canonical.value, aliases: na.aliases.value.split(';').map((x) => x.trim()).filter(Boolean), explanation: na.expl.value, prior_popularity: Number(na.prior.value), sources: na.url.value ? [{ title: na.url.value, url: na.url.value }] : [] }); render(); }, 'Odgovor je dodan.') }, 'Dodaj')));
}

// ================= Dnevni izazovi =================
async function vChallenges() {
  const [list, settings] = await Promise.all([get('/challenges'), get('/settings')]);
  const expected = settings.game?.questions_per_day ?? 10;
  mount(h('h1', {}, 'Dnevni izazovi'),
    h('div', { class: 'toolbar' }, h('a', { class: 'btn primary', href: '#/izazovi/novo' }, 'Novi izazov'),
      h('button', { class: 'btn', onclick: run(async () => { const r = await post('/challenges/compose', {}); toast(`Složen je nacrt za ${r.date} (neaktivan). Pregledaj ga i objavi.`); go(`izazovi/${r.id}`); }) }, 'Složi sljedeći dan iz neraspoređenih pitanja')),
    h('p', { class: 'small' }, `Zadani broj pitanja po danu: ${expected} (mijenja se u Postavkama → Tijek igre). Dani s drukčijim brojem označeni su.`),
    table(['Datum', 'Opseg', 'Naslov', 'Pitanja', 'Partija', 'Prosjek km', 'Stanje', ''], list.map((c) => tr(h('a', { href: `#/izazovi/${c.id}`, style: 'font-weight:800' }, c.date), c.scope === 'sve' ? 'obje karte' : c.scope, c.title || '—', c.questions === expected ? c.questions : h('span', { class: 'tag warn' }, `${c.questions} ≠ ${expected}`), c.plays, c.avg_km ?? '—',
      h('span', {}, c.active ? h('span', { class: 'tag ok' }, 'aktivan') : h('span', { class: 'tag warn' }, 'neaktivan'), c.date === dash.date ? h('span', { class: 'tag warn', style: 'margin-left:4px' }, 'danas') : null, c.finalized_at ? h('span', { class: 'tag', style: 'margin-left:4px' }, 'zaključen') : null),
      h('a', { class: 'btn xs', href: `#/izazovi/${c.id}` }, 'Uredi')))));
}
function pickQuestion(exclude) {
  return new Promise((resolve) => {
    const dlg = h('dialog');
    const search = inp('', { placeholder: 'Traži pitanje…' });
    const cat = sel([['', 'Sve kategorije'], ...cats.map((c) => [c.id, c.name])], '');
    const only = chk(true);
    const list = h('div', { style: 'max-height:50vh;overflow:auto;margin-top:10px' });
    const load = async () => {
      const p = new URLSearchParams({ q: search.value, category: cat.value, active: '1' });
      if (only.checked) p.set('scheduled', '0');
      const d = await get('/questions?' + p);
      list.replaceChildren(table(['Pitanje', 'Kategorija', 'Odgovora', ''], d.rows.filter((r) => !exclude.includes(r.id)).map((r) => tr(r.text, `${r.emoji} ${r.category}`, r.type === 'numeric' ? 'procjena' : r.answers, h('button', { class: 'btn xs primary', onclick: () => { dlg.close(); dlg.remove(); resolve(r); } }, 'Odaberi'))), 'Nema aktivnih pitanja za taj upit.'));
    };
    search.addEventListener('input', load); cat.addEventListener('change', load); only.addEventListener('change', load);
    dlg.append(h('div', { class: 'row spread' }, h('h2', { style: 'margin:0' }, 'Odaberi pitanje'), h('button', { class: 'btn xs', onclick: () => { dlg.close(); dlg.remove(); resolve(null); } }, 'Zatvori')),
      h('div', { class: 'toolbar', style: 'margin-top:10px' }, h('div', { style: 'flex:1' }, search), cat, h('label', { class: 'row small' }, only, 'samo neraspoređena')), list);
    document.body.append(dlg); dlg.showModal(); load();
  });
}
async function vChallenge([id]) {
  const isNew = id === 'novo';
  const maps = await get('/maps');
  const c = isNew ? { date: '', scope: 'sve', active: 1, title: '', questions: [], plays: { n: 0 } } : await get(`/challenges/${id}`);
  let slots = c.questions.map((x) => ({ ...x }));
  const f = { date: inp(c.date, { type: 'date' }), scope: sel([['sve', 'Obje karte (zajednička pitanja)'], ...maps.map((m) => [m.slug, `Samo karta ${m.name}`])], c.scope), title: inp(c.title), active: chk(c.active) };
  const box = h('div', { class: 'panel flush' });
  const paint = () => box.replaceChildren(...(slots.length ? slots.map((s, i) => {
    const probe = inp('', { placeholder: 'proba odgovora', style: 'max-width:170px;min-height:30px;padding:3px 7px' }), out = h('span', { class: 'small' });
    probe.addEventListener('keydown', run(async (e) => { if (e.key !== 'Enter') return; const r = await post(`/questions/${s.id}/test`, { input: probe.value }); out.textContent = r.status === 'tocno' ? ` ✔ ${r.canonical || ''} razina ${r.level}` : ` ✖ ${r.status}`; }));
    return h('div', { class: 'slot' }, h('span', { class: 'n' }, i + 1),
      h('div', {}, h('a', { href: `#/pitanja/${s.id}`, style: 'font-weight:800' }, s.text), h('div', { class: 'small muted' }, `${s.emoji || ''} ${s.category || ''}, ${s.type === 'numeric' ? 'procjena' : `${s.base ?? s.answers ?? '?'} odgovora u bazi`}`, s.stats?.answers ? `, odgovorilo ${s.stats.answers}, točno ${s.stats.correct}, prosjek ${s.stats.avg_km} km` : ''),
        s.stats?.top?.length ? h('div', { class: 'small' }, 'Najčešće: ', s.stats.top.map((t) => `${t.answer}${t.is_correct ? '' : ' ✖'} (${t.n})`).join(', ')) : null, h('div', { class: 'row', style: 'margin-top:4px' }, probe, out)),
      h('span', { style: 'white-space:nowrap' },
        h('button', { class: 'btn xs', disabled: i === 0, 'aria-label': 'Pomakni gore', onclick: () => { [slots[i - 1], slots[i]] = [slots[i], slots[i - 1]]; paint(); } }, '↑'), ' ',
        h('button', { class: 'btn xs', disabled: i === slots.length - 1, 'aria-label': 'Pomakni dolje', onclick: () => { [slots[i + 1], slots[i]] = [slots[i], slots[i + 1]]; paint(); } }, '↓'), ' ',
        h('button', { class: 'btn xs', onclick: async () => { const r = await pickQuestion(slots.map((x) => x.id)); if (r) { slots[i] = { id: r.id, text: r.text, emoji: r.emoji, category: r.category, type: r.type, answers: r.answers }; paint(); } } }, 'Zamijeni'), ' ',
        h('button', { class: 'btn xs danger', onclick: () => { slots.splice(i, 1); paint(); } }, 'Ukloni')));
  }) : [h('p', { style: 'padding:14px' }, 'Izazov još nema pitanja.')]));
  paint();
  const save = async (force, allow_size) => {
    try {
      const body = { date: f.date.value, scope: f.scope.value, title: f.title.value, active: f.active.checked, question_ids: slots.map((s) => s.id), force, allow_size };
      const r = isNew ? await post('/challenges', body) : await patch(`/challenges/${id}`, body);
      toast('Izazov je spremljen.');
      if (isNew) go(`izazovi/${r.id}`); else render();
    } catch (e) {
      if (e.data?.needs_force && confirm(e.message + '\n\nNastaviti i obrisati odigrane partije ovog izazova?')) return save(true, allow_size);
      if (e.data?.needs_allow_size && confirm(e.message + '\n\nSvejedno objaviti ovaj dan s ' + e.data.count + ' pitanja?')) return save(force, true);
      toast(e.message);
    }
  };
  const copyDate = inp('', { type: 'date' });
  mount(h('a', { href: '#/izazovi', class: 'small' }, 'Svi izazovi'), h('h1', {}, isNew ? 'Novi dnevni izazov' : `Izazov ${c.date}`),
    isNew ? null : h('p', { class: 'small' }, `Službenih partija: ${c.plays.n}, prosjek ${c.plays.avg_km ?? '—'} km, u cilju ${c.plays.goals ?? 0}. `, c.finalized_at ? `Zaključen ${when(c.finalized_at)}.` : 'Nije zaključen.'),
    h('div', { class: 'panel stack' }, h('div', { class: 'grid' }, field('Datum objave', f.date), field('Opseg', f.scope), field('Naslov (interno)', f.title)), h('label', { class: 'row' }, f.active, h('span', {}, 'Aktivan (vidljiv igračima na taj datum)'))),
    h('h2', {}, `Pitanja (${slots.length})`), h('p', { class: 'small' }, `Zadano je ${c.expected_questions ?? 10} pitanja po danu: 2 nogomet, košarka, rukomet, tenis, F1, borilački, procjena, dodatno otvoreno pitanje i druga procjena. Aktivan izazov s drukčijim brojem pitanja traži izričitu potvrdu.`), box,
    h('div', { class: 'row wrapline', style: 'margin-top:12px' },
      h('button', { class: 'btn', onclick: async () => { const r = await pickQuestion(slots.map((x) => x.id)); if (r) { slots.push({ id: r.id, text: r.text, emoji: r.emoji, category: r.category, type: r.type, answers: r.answers }); paint(); } } }, 'Dodaj pitanje'),
      h('button', { class: 'btn primary', onclick: () => save(false, false) }, 'Spremi izazov')),
    isNew ? null : h('div', { class: 'stack', style: 'margin-top:22px' }, h('h2', {}, 'Radnje'),
      h('div', { class: 'toolbar' }, field('Kopiraj u datum', copyDate), h('button', { class: 'btn', onclick: run(async () => { const r = await post(`/challenges/${id}/copy`, { date: copyDate.value }); go(`izazovi/${r.id}`); }, 'Kopija je stvorena (neaktivna).') }, 'Kopiraj'),
        h('button', { class: 'btn', onclick: run(async () => { const r = await post(`/challenges/${id}/recalc`, { mode: 'novi' }); toast(`Naknadno priznato: ${r.changed}`); render(); }) }, 'Priznaj nove odgovore'),
        h('button', { class: 'btn', onclick: run(async () => { if (!confirm('Ponovno bodovati sve odgovore ovog izazova?')) return; const r = await post(`/challenges/${id}/recalc`, { mode: 'sve' }); toast(`Promijenjeno: ${r.changed}`); render(); }) }, 'Ponovno izračunaj sve'),
        h('button', { class: 'btn', disabled: !!c.finalized_at, onclick: run(async () => { const r = await post(`/challenges/${id}/finalize`); toast(r.finalized ? `Zaključeno. Bonus za najbližu procjenu: ${r.winners}` : 'Već je zaključen.'); render(); }) }, 'Zaključi dan (bonus za najbližu procjenu)'),
        h('button', { class: 'btn danger', onclick: async () => { if (!confirm('Obrisati izazov?')) return; try { await del(`/challenges/${id}`); go('izazovi'); } catch (e) { if (e.data?.needs_force && confirm(e.message)) { await del(`/challenges/${id}?force=1`); go('izazovi'); } else toast(e.message); } } }, 'Obriši izazov'))));
}

// ================= Kvaliteta sadržaja =================
async function vQuality() {
  const q = await get('/quality');
  const block = (title, list, note) => h('section', { class: 'stack', style: 'margin-bottom:22px' }, h('h2', {}, `${title} (${list.length})`), note ? h('p', { class: 'small' }, note) : null,
    list.length ? table(['Pitanje', 'Kategorija', 'Napomena', ''], list.slice(0, 60).map((x) => tr(x.text, x.category || '—', x.why || (x.other ? `isto kao #${x.other}` : ''), h('a', { class: 'btn xs', href: `#/pitanja/${x.id}` }, 'Otvori')))) : h('p', { class: 'notice ok' }, 'Sve u redu.'));
  mount(h('h1', {}, 'Kvaliteta sadržaja'),
    h('div', { class: 'cards' },
      h('div', { class: 'card' }, h('b', {}, q.totals.open + q.totals.numeric), h('span', {}, `pitanja (${q.totals.open} otvorenih, ${q.totals.numeric} procjena)`)),
      h('div', { class: 'card' }, h('b', {}, q.totals.answers), h('span', {}, `odgovora, ${q.totals.aliases} aliasa`)),
      h('div', { class: 'card' }, h('b', {}, q.days_ahead), h('span', {}, 'objavljenih dana od danas')),
      h('div', { class: 'card' }, h('b', {}, q.totals.unscheduled), h('span', {}, 'neraspoređenih pitanja'))),
    h('div', { class: 'toolbar' }, h('a', { class: 'btn', href: '#/pitanja' }, 'Uvoz pitanja (CSV ili JSON)'),
      h('button', { class: 'btn primary', onclick: run(async () => { const r = await post('/challenges/compose', {}); toast(`Složen je nacrt za ${r.date}.`); go(`izazovi/${r.id}`); }) }, `Složi sljedeći dan (${q.expected} pitanja)`)),
    q.wrong_size_days.length ? h('section', { class: 'stack', style: 'margin-bottom:22px' }, h('h2', {}, `Dani s pogrešnim brojem pitanja (${q.wrong_size_days.length})`),
      table(['Datum', 'Pitanja', 'Zadano', 'Stanje', ''], q.wrong_size_days.map((d) => tr(d.date, d.questions, d.expected, d.active ? 'aktivan' : 'neaktivan', h('a', { class: 'btn xs', href: `#/izazovi/${d.id}` }, 'Otvori'))))) : null,
    block('Dvostruka pitanja', q.duplicates, 'Isti tekst pitanja postoji više puta.'),
    block('Premalo odgovora', q.few_answers, 'Otvorena pitanja s manje od osam točnih odgovora: rijetkost nema dovoljno raspona.'),
    block('Bez aliasa', q.no_aliases, 'Nijedan odgovor nema alias — igrači koji pišu skraćeno ili drukčije neće biti prepoznati.'),
    block('Bez izvora', q.no_sources, 'Svako pitanje treba barem jedan izvor za provjeru.'),
    block('Procjene bez referentne vrijednosti', q.numeric_no_target),
    block('Davno provjereno', q.stale, 'Odgovori provjereni prije više od 180 dana ili nikad: liste koje se mijenjaju (aktivni sportaši, tekuće sezone) treba osvježiti.'),
    block('Bez obrazloženja', q.no_explanations, 'Nijedan odgovor nema obrazloženje koje igrač vidi nakon odgovora.'),
    block('Neraspoređena pitanja', q.unscheduled, 'Aktivna pitanja koja još nisu ni u jednom dnevnom izazovu.'));
}

// ================= Nepoznati odgovori =================
async function vUnknown(_, q) {
  const status = q.status || 'novo';
  const [reports, unknown] = await Promise.all([get('/reports?status=' + status), get('/unknown')]);
  const resolve = async (item) => {
    const full = await get(`/questions/${item.question_id}`);
    const dlg = h('dialog');
    const canonical = inp(item.raw), existing = sel([['', '— novi kanonski odgovor —'], ...full.answers.map((a) => [a.id, a.canonical])], ''), prior = inp(3, { type: 'number', step: 'any' }), expl = inp('', { placeholder: 'zašto je točan' }), url = inp('', { placeholder: 'https://… izvor koji potvrđuje' }), note = inp('', { placeholder: 'napomena (interno)' });
    const act = (action) => run(async () => {
      const r = await post('/reports/resolve', { question_id: item.question_id, norm: item.norm, action, answer_id: existing.value ? Number(existing.value) : null, canonical: canonical.value, prior_popularity: Number(prior.value), explanation: expl.value, source_url: url.value, note: note.value });
      dlg.close(); dlg.remove();
      toast(action === 'odobri' ? `Odobreno. Naknadno priznato odgovora: ${r.recalc?.changed ?? 0}; ažurirano partija: ${r.recalc?.sessions ?? 0}.` : 'Odbijeno.');
      render();
    });
    dlg.append(h('div', { class: 'stack' }, h('h2', { style: 'margin:0' }, `"${item.raw}"`), h('p', {}, full.text), h('p', { class: 'small muted' }, `Upisano ${item.given} puta, prijavljeno ${item.reports} puta.`, item.note ? ` Napomena igrača: ${item.note}` : ''),
      h('a', { href: `https://www.google.com/search?q=${encodeURIComponent(item.raw + ' ' + full.text)}`, target: '_blank', rel: 'noopener' }, 'Potraži izvor na webu'),
      field('Poveži kao alias postojećeg odgovora', existing, 'Ako je to samo drugi zapis odgovora koji već postoji.'),
      h('div', { class: 'grid' }, field('Ili: novi kanonski naziv', canonical), field('Početna popularnost', prior)), field('Obrazloženje', expl), field('Izvor', url), field('Napomena', note),
      h('div', { class: 'row wrapline' }, h('button', { class: 'btn primary', onclick: act('odobri') }, 'Odobri i priznaj kilometre'), h('button', { class: 'btn danger', onclick: act('odbij') }, 'Odbij'), h('button', { class: 'btn', onclick: () => { dlg.close(); dlg.remove(); } }, 'Zatvori'))));
    document.body.append(dlg); dlg.showModal();
  };
  mount(h('h1', {}, 'Nepoznati odgovori'),
    h('div', { class: 'seg', style: 'margin-bottom:12px' }, [['novo', 'Čekaju'], ['odobreno', 'Odobreni'], ['odbijeno', 'Odbijeni']].map(([v, l]) => h('button', { 'aria-pressed': String(v === status), onclick: () => go('nepoznati?status=' + v) }, l))),
    h('h2', {}, 'Prijave igrača'),
    table(['Pitanje', 'Odgovor', 'Prijava', 'Upisano', 'Igrači', 'Zadnja prijava', ''], reports.map((r) => tr(h('a', { href: `#/pitanja/${r.question_id}` }, r.question), h('b', {}, r.raw), r.reports, r.given, r.users || 'gost', when(r.last_at),
      status === 'novo' ? h('button', { class: 'btn xs primary', onclick: () => resolve(r) }, 'Pregledaj') : (r.resolution_note || '—'))), status === 'novo' ? 'Nema prijava koje čekaju.' : 'Nema zapisa.'),
    h('h2', {}, 'Najčešći neprepoznati odgovori (i bez prijave)'),
    table(['Pitanje', 'Odgovor', 'Upisano', 'Prijava', ''], unknown.map((r) => tr(h('a', { href: `#/pitanja/${r.question_id}` }, r.question), h('b', {}, r.raw), r.given, r.reports, h('button', { class: 'btn xs', onclick: () => resolve(r) }, 'Pregledaj'))), 'Igrači još nisu upisali nijedan neprepoznat odgovor.'));
}

// ================= Karte =================
async function vMaps() {
  const [maps, settings] = await Promise.all([get('/maps'), get('/settings')]);
  const COUNTRIES = Object.entries(settings.countries || {});
  const countryRows = COUNTRIES.map(([code, c]) => ({ code, name: c.name, flag: c.flag }));
  const cBody = h('tbody');
  const paintCountries = () => cBody.replaceChildren(...countryRows.map((c, i) => tr(inp(c.code, { style: 'width:70px', maxlength: 3, oninput: (e) => { c.code = e.target.value.toLowerCase(); } }), inp(c.name, { oninput: (e) => { c.name = e.target.value; } }), inp(c.flag, { style: 'width:80px', oninput: (e) => { c.flag = e.target.value; } }), h('button', { class: 'btn xs danger', onclick: () => { countryRows.splice(i, 1); paintCountries(); } }, '×'))));
  paintCountries();
  const editor = (m) => {
    const f = { name: inp(m.name), slug: inp(m.slug), flag: inp(m.flag, { style: 'max-width:90px' }), order: inp(m.sort_order ?? 0, { type: 'number', style: 'max-width:90px' }), active: chk(m.active ?? 1), rname: inp(m.route?.name), total: inp(m.route?.total_km ?? 1000, { type: 'number', step: 'any' }), ext: inp(m.route?.ext_km_set || '', { type: 'number', step: 'any', placeholder: 'automatski' }), real: inp(m.route?.real_km ?? '', { type: 'number', step: 'any' }) };
    let pts = (m.route?.checkpoints || []).map((p) => ({ ...p }));
    const body = h('tbody');
    const paint = () => body.replaceChildren(...pts.map((p, i) => {
      const bind = (key, attrs = {}) => inp(p[key], { ...attrs, oninput: (e) => { p[key] = e.target.value; } });
      const goalRadio = h('input', { type: 'radio', name: 'goal-' + (m.id || 'nova'), title: 'Glavno odredište (cilj)', onchange: () => { pts.forEach((x) => { x.is_goal = 0; }); p.is_goal = 1; paint(); } });
      goalRadio.checked = !!p.is_goal;
      const afterGoal = pts.findIndex((x) => x.is_goal) >= 0 && i > pts.findIndex((x) => x.is_goal);
      return tr(h('td', { class: 'tight' }, i + 1, afterGoal ? h('span', { class: 'tag', style: 'margin-left:4px', title: 'Nastavak iza cilja' }, '+') : null), bind('name'), bind('nickname', { placeholder: 'humoristični naziv' }),
        sel(COUNTRIES.map(([code, c]) => [code, `${c.flag || ''} ${c.name}`]), p.country || m.slug || COUNTRIES[0]?.[0], { style: 'width:150px', onchange: (e) => { p.country = e.target.value; } }),
        goalRadio, chk(p.label === 'granica', { title: 'Granični prijelaz', onchange: (e) => { p.label = e.target.checked ? 'granica' : null; } }), bind('lat', { type: 'number', step: 'any', style: 'width:100px' }), bind('lng', { type: 'number', step: 'any', style: 'width:100px' }),
        chk(p.is_stop ?? 1, { onchange: (e) => { p.is_stop = e.target.checked ? 1 : 0; }, title: 'Postaja (isključeno = samo oblikuje putanju)' }), bind('message', { placeholder: 'poruka pri prolasku' }), h('td', { class: 'tight' }, p.km ?? '—'),
        h('span', { style: 'white-space:nowrap' }, h('button', { class: 'btn xs', disabled: i === 0, onclick: () => { [pts[i - 1], pts[i]] = [pts[i], pts[i - 1]]; paint(); } }, '↑'), ' ', h('button', { class: 'btn xs', disabled: i === pts.length - 1, onclick: () => { [pts[i + 1], pts[i]] = [pts[i], pts[i + 1]]; paint(); } }, '↓'), ' ',
          h('button', { class: 'btn xs', title: 'Umetni točku ispod', onclick: () => { pts.splice(i + 1, 0, { name: '', lat: '', lng: '', is_stop: 1 }); paint(); } }, '+'), ' ', h('button', { class: 'btn xs danger', onclick: () => { pts.splice(i, 1); paint(); } }, '×')));
    }));
    paint();
    return h('section', { class: 'stack', style: 'margin-bottom:34px' }, h('h2', {}, m.id ? `${m.flag || ''} ${m.name}` : 'Nova karta'),
      h('div', { class: 'panel stack' }, h('div', { class: 'grid' }, field('Naziv karte', f.name), field('Oznaka u adresi', f.slug), field('Zastava', f.flag), field('Redoslijed', f.order), field('Naziv rute', f.rname), field('Kilometri igre do cilja', f.total, 'Virtualni kilometri od polazišta do glavnog odredišta (zadano 1000). Nisu cestovna udaljenost.'),
        field('Kilometri igre iza cilja', f.ext, `Duljina nastavka u susjednu državu. Prazno = razmjerno glavnoj ruti. Trenutačno: ${m.route?.ext_km ?? 0} km, kraj karte na ${m.route?.end_km ?? '—'} km.`),
        field('Stvarna cestovna udaljenost (km)', f.real, 'Samo informativno; ne utječe na bodovanje.')), h('label', { class: 'row' }, f.active, h('span', {}, 'Karta je dostupna igračima'))),
      h('div', { class: 'panel flush scroll-x' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ['#', 'Grad / točka', 'Humoristični naziv', 'Država', 'Cilj', 'Granica', 'Širina (lat)', 'Dužina (lng)', 'Postaja', 'Poruka', 'Km igre', ''].map((x) => h('th', {}, x)))), body)),
      h('p', { class: 'small muted' }, 'Prva točka je polazište. Točka označena kao „Cilj“ je glavno odredište; sve točke ispod nje su nastavak rute u susjednu državu (označene znakom +). Bez označenog cilja, cilj je zadnja točka. Točke bez kvačice „Postaja“ samo oblikuju putanju. Koordinate su u decimalnim stupnjevima (WGS84), npr. Zagreb 45.8150, 15.9819. Najbolji mogući rezultat je broj pitanja × kilometri najbržeg prijevoza — kraj karte neka bude barem toliko.'),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { pts.push({ name: '', lat: '', lng: '', is_stop: 1 }); paint(); } }, 'Dodaj točku na kraj'),
        h('button', { class: 'btn primary', onclick: run(async () => { const b = { name: f.name.value, slug: f.slug.value, flag: f.flag.value, sort_order: Number(f.order.value), active: f.active.checked, route: { name: f.rname.value, total_km: Number(f.total.value), ext_km: Number(f.ext.value) || 0, real_km: Number(f.real.value) || null, checkpoints: pts } }; if (m.id) await patch(`/maps/${m.id}`, b); else await post('/maps', b); render(); }, 'Karta je spremljena.') }, 'Spremi kartu i rutu')));
  };
  mount(h('h1', {}, 'Karte i gradovi'), h('p', {}, 'Ovdje mijenjaš polazište, glavno odredište, nastavak rute u susjednu državu, granične prijelaze, humoristične nazive gradova i poruke koje igrač vidi pri prolasku.'), ...maps.map(editor),
    h('section', { class: 'stack', style: 'margin-bottom:34px' }, h('h2', {}, 'Države'), h('p', { class: 'small' }, 'Države kroz koje rute prolaze: oznaka (dva slova), naziv i zastava. Zastava se igračima crta kao slika za hr, ba, me, rs, si, hu, it i al; ostale dobivaju pločicu s oznakom.'),
      h('div', { class: 'panel flush', style: 'max-width:560px' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, ['Oznaka', 'Naziv', 'Zastava (emoji)', ''].map((x) => h('th', {}, x)))), cBody)),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => { countryRows.push({ code: '', name: '', flag: '' }); paintCountries(); } }, 'Dodaj državu'),
        h('button', { class: 'btn primary', onclick: run(async () => { await api('PUT', '/settings', { countries: Object.fromEntries(countryRows.filter((c) => c.code).map((c) => [c.code, { name: c.name, flag: c.flag }])) }); render(); }, 'Države su spremljene.') }, 'Spremi države'))),
    h('details', {}, h('summary', { style: 'font-weight:800;cursor:pointer' }, 'Dodaj novu kartu'), editor({ route: { checkpoints: [{ name: '', lat: '', lng: '', is_stop: 1 }, { name: '', lat: '', lng: '', is_stop: 1 }] } })));
}

// ================= Prijevoz =================
async function vTransport() {
  const sets = await get('/transport-sets');
  const editor = (s) => {
    const name = inp(s.name), desc = inp(s.description);
    const modes = s.modes.map((m) => ({ ...m }));
    const rows = modes.map((m) => {
      const bind = (key, attrs = {}) => inp(m[key], { ...attrs, oninput: (e) => { m[key] = e.target.value; } });
      const file = h('input', { type: 'file', accept: 'image/png,image/svg+xml,image/webp', hidden: true, onchange: () => { const f = file.files[0]; if (!f) return; if (f.size > 150000) return toast('Slika smije imati najviše 150 kB.'); const rd = new FileReader(); rd.onload = () => { m.image = rd.result; toast('Slika je učitana — spremi set.'); }; rd.readAsDataURL(f); } });
      return tr(h('td', { class: 'tight' }, h('b', {}, m.level)), bind('emoji', { style: 'width:64px' }), bind('name'), bind('description'), bind('km', { type: 'number', step: 'any', style: 'width:90px' }), bind('min_rarity', { type: 'number', min: 0, max: 100, step: 'any', style: 'width:90px' }),
        h('span', { style: 'white-space:nowrap' }, file, m.image ? h('img', { src: m.image, alt: '', style: 'height:26px;vertical-align:middle;margin-right:6px' }) : null, h('button', { class: 'btn xs', onclick: () => file.click() }, m.image ? 'Zamijeni' : 'Učitaj'), m.image ? h('button', { class: 'btn xs', style: 'margin-left:4px', onclick: () => { m.image = null; toast('Slika će se ukloniti pri spremanju.'); } }, 'Ukloni') : null));
    });
    return h('section', { class: 'stack', style: 'margin-bottom:34px' },
      h('h2', {}, s.name || 'Novi set', ' ', s.active ? h('span', { class: 'tag ok' }, 'aktivan u igri') : null),
      h('div', { class: 'grid two' }, field('Naziv seta', name), field('Opis', desc)),
      table(['Razina', 'Emoji', 'Naziv', 'Duhoviti opis', 'Kilometri', 'Prag rijetkosti (0–100)', 'Ilustracija'], rows),
      h('details', { class: 'preview' }, h('summary', { style: 'font-weight:800;cursor:pointer' }, 'Pregled: kako set izgleda igračima'), (() => {
        const badge = (m, cls = '') => h('span', { class: 'pv-badge ' + cls }, m.image ? h('img', { src: m.image, alt: '' }) : m.emoji || '⬛');
        const top = modes[modes.length - 1], mid = modes[Math.floor(modes.length / 2)];
        return h('div', { class: 'pv' },
          h('div', {}, h('h3', {}, 'Naslovnica'), h('div', { class: 'pv-strip' }, modes.map((m) => h('span', {}, badge(m), h('small', {}, m.name), h('b', {}, `+${m.km}`))))),
          h('div', {}, h('h3', {}, 'Nakon točnog odgovora'), h('div', { class: 'pv-out' }, badge(mid, 'big'), h('span', {}, h('b', {}, 'Primjer odgovora'), h('small', {}, `${mid.name} · rijetkost 62 / 100`)), h('b', { class: 'pv-km' }, `+${mid.km}`))),
          h('div', {}, h('h3', {}, 'Marker na karti'), h('div', { class: 'pv-map' }, h('i'), h('span', { class: 'pv-marker' }, top.image ? h('img', { src: top.image, alt: '' }) : top.emoji || '📍'))));
      })()),
      h('p', { class: 'small muted' }, `Najbolji mogući rezultat s ovim setom i 10 pitanja: ${10 * Math.max(...modes.map((m) => Number(m.km) || 0))} km. Kraj karte (cilj + nastavak) treba biti barem toliko.`),
      h('div', { class: 'row wrapline' },
        h('button', { class: 'btn primary', onclick: run(async () => { const b = { name: name.value, description: desc.value, modes: modes.map((m) => ({ ...m, km: Number(m.km), min_rarity: Number(m.min_rarity) })) }; if (s.id) await patch(`/transport-sets/${s.id}`, b); else await post('/transport-sets', b); render(); }, 'Set je spremljen.') }, 'Spremi set'),
        s.id && !s.active ? h('button', { class: 'btn', onclick: run(async () => { await post(`/transport-sets/${s.id}/activate`); render(); }, 'Set je aktiviran.') }, 'Koristi ovaj set u igri') : null,
        s.id && !s.active ? h('button', { class: 'btn danger', onclick: run(async () => { if (!confirm('Obrisati set?')) return; await del(`/transport-sets/${s.id}`); render(); }) }, 'Obriši set') : null));
  };
  const base = sets.find((s) => s.active) || sets[0];
  mount(h('h1', {}, 'Prijevozna sredstva'), h('p', {}, 'Sedam razina: točan odgovor dobiva najvišu razinu čiji je prag rijetkosti dosegnut. Razina 1 uvijek ima prag 0. Promjene vrijede za nove partije; započete partije zadržavaju set s kojim su krenule.'),
    ...sets.map(editor), h('details', {}, h('summary', { style: 'font-weight:800;cursor:pointer' }, 'Novi set (kopija aktivnog)'), editor({ name: '', description: '', modes: (base?.modes || []).map((m) => ({ ...m, id: undefined })) })));
}

// ================= Korisnici =================
async function vUsers(_, q) {
  const d = await get('/users?' + new URLSearchParams(q));
  const search = inp(q.q, { placeholder: 'Nadimak, e-mail ili ID', onkeydown: (e) => { if (e.key === 'Enter') go('korisnici?' + new URLSearchParams({ q: search.value })); } });
  mount(h('h1', {}, `Korisnici (${d.total})`),
    h('div', { class: 'toolbar' }, field('Traži', search), field('Prikaz', sel([['', 'Registrirani'], ['svi', 'Svi'], ['gosti', 'Gosti'], ['blokirani', 'Blokirani']], q.filter, { onchange: (e) => go('korisnici?' + new URLSearchParams({ filter: e.target.value })) }))),
    table(['ID', 'Nadimak', 'E-mail', 'Partija', 'Km', 'Registriran', 'Zadnji put', 'Stanje'], d.rows.map((u) => tr(u.id, h('a', { href: `#/korisnici/${u.id}`, style: 'font-weight:800' }, u.nickname), u.email || '—', u.games, u.km, when(u.created_at), when(u.last_seen_at),
      h('span', {}, u.is_guest ? h('span', { class: 'tag' }, 'gost') : null, u.is_admin ? h('span', { class: 'tag ok' }, 'admin') : null, u.is_blocked ? h('span', { class: 'tag bad' }, 'blokiran') : null)))),
    h('div', { class: 'row', style: 'margin-top:12px' }, d.page > 1 ? h('a', { class: 'btn xs', href: '#/korisnici?' + new URLSearchParams({ ...q, page: d.page - 1 }) }, 'Prethodna') : null, h('span', {}, `Stranica ${d.page} od ${Math.max(1, d.pages)}`), d.page < d.pages ? h('a', { class: 'btn xs', href: '#/korisnici?' + new URLSearchParams({ ...q, page: d.page + 1 }) }, 'Sljedeća') : null));
}
async function vUser([id]) {
  const u = await get(`/users/${id}`);
  const nick = inp(u.nickname), reason = inp(u.block_reason, { placeholder: 'razlog blokade' });
  const upd = (body, msg) => run(async () => { await patch(`/users/${id}`, body()); render(); }, msg);
  const showSession = run(async (sid) => {
    const s = await get(`/sessions/${sid}`);
    const dlg = h('dialog');
    dlg.append(h('div', { class: 'row spread' }, h('h2', { style: 'margin:0' }, `Partija #${sid} — ${s.date}, ${s.map}`), h('button', { class: 'btn xs', onclick: () => { dlg.close(); dlg.remove(); } }, 'Zatvori')),
      table(['#', 'Pitanje', 'Upisano', 'Priznato', 'Rijetkost', 'Razina', 'Km'], s.answers.map((a) => tr(a.position, a.question, a.raw, a.is_correct ? (a.canonical || 'da') : '✖', a.rarity == null ? '—' : Math.round(a.rarity), a.level + (a.bonus ? ' ★' : ''), a.km))));
    document.body.append(dlg); dlg.showModal();
  });
  mount(h('a', { href: '#/korisnici', class: 'small' }, 'Svi korisnici'), h('h1', {}, u.nickname),
    h('div', { class: 'grid two' },
      h('dl', { class: 'kv panel' }, h('dt', {}, 'ID'), h('dd', {}, u.id), h('dt', {}, 'E-mail'), h('dd', {}, u.email || '— (gost)'), h('dt', {}, 'Registriran'), h('dd', {}, when(u.created_at)), h('dt', {}, 'Zadnji put'), h('dd', {}, when(u.last_seen_at)),
        h('dt', {}, 'Niz dana'), h('dd', {}, `${u.streak.current} (najdulji ${u.streak.best})`), h('dt', {}, 'Lige'), h('dd', {}, u.leagues.map((l) => l.name).join(', ') || '—'), h('dt', {}, 'Stanje'), h('dd', {}, u.is_blocked ? `blokiran: ${u.block_reason || ''}` : 'aktivan', u.is_admin ? ', administrator' : '')),
      h('div', { class: 'panel stack' },
        h('div', { class: 'toolbar' }, field('Nadimak', nick), h('button', { class: 'btn', onclick: upd(() => ({ nickname: nick.value }), 'Nadimak je promijenjen.') }, 'Spremi nadimak')),
        h('div', { class: 'toolbar' }, field('Blokada', reason), u.is_blocked ? h('button', { class: 'btn', onclick: upd(() => ({ is_blocked: false }), 'Korisnik je odblokiran.') }, 'Odblokiraj') : h('button', { class: 'btn danger', onclick: upd(() => ({ is_blocked: true, block_reason: reason.value }), 'Korisnik je blokiran.') }, 'Blokiraj')),
        h('div', { class: 'row wrapline' },
          u.avatar ? h('button', { class: 'btn', onclick: upd(() => ({ remove_avatar: true }), 'Slika je uklonjena.') }, 'Ukloni profilnu sliku') : null,
          u.is_guest ? null : h('button', { class: 'btn', onclick: run(async () => { const r = await post(`/users/${id}/reset-link`); prompt('Pošalji korisniku ovu poveznicu (vrijedi 48 sati):', r.url); }) }, 'Poveznica za novu lozinku'),
          u.is_guest ? null : h('button', { class: 'btn', onclick: upd(() => ({ is_admin: !u.is_admin }), 'Ovlasti su promijenjene.') }, u.is_admin ? 'Ukloni admin ovlasti' : 'Dodijeli admin ovlasti'),
          h('button', { class: 'btn danger', onclick: run(async () => { if (!confirm('Trajno obrisati korisnika i sve njegove partije?')) return; await del(`/users/${id}`); go('korisnici'); }) }, 'Obriši korisnika')))),
    h('h2', {}, 'Partije'),
    table(['ID', 'Dan', 'Karta', 'Vrsta', 'Km', 'Cilj', 'Početak', 'Kraj', ''], u.sessions.map((s) => tr(s.id, s.date, s.map, s.official ? 'službena' : s.mode, Math.round(s.total_km), s.reached_goal ? '🏁' : '', when(s.started_at), when(s.finished_at), h('button', { class: 'btn xs', onclick: () => showSession(s.id) }, 'Odgovori'))), 'Korisnik još nije igrao.'),
    u.reports.length ? h('div', {}, h('h2', {}, 'Prijave ovog profila'), table(['Kada', 'Razlog', 'Stanje'], u.reports.map((r) => tr(when(r.created_at), r.reason || '—', r.status)))) : null);
}

// ================= Lige i prijave sadržaja =================
async function vLeagues(_, q) {
  const [leagues, reports] = await Promise.all([get('/leagues?' + new URLSearchParams(q)), get('/content-reports')]);
  const search = inp(q.q, { placeholder: 'Naziv ili kod', onkeydown: (e) => { if (e.key === 'Enter') go('lige?' + new URLSearchParams({ q: search.value })); } });
  const upd = (id, body, msg) => run(async () => { await patch(`/leagues/${id}`, body); render(); }, msg);
  mount(h('h1', {}, 'Lige i prijave sadržaja'),
    h('h2', {}, 'Prijave neprimjerenog sadržaja'),
    table(['Kada', 'Vrsta', 'Na koga / što', 'Razlog', 'Prijavio', 'Stanje', ''], reports.map((r) => tr(when(r.created_at), r.target_type, r.target_type === 'korisnik' ? h('a', { href: `#/korisnici/${r.target_id}` }, r.target_name || `#${r.target_id}`) : (r.target_name || `#${r.target_id}`), r.reason || '—', r.reporter || 'gost',
      r.status === 'novo' ? h('span', { class: 'tag bad' }, 'novo') : h('span', { class: 'tag' }, 'riješeno'), r.status === 'novo' ? h('button', { class: 'btn xs', onclick: run(async () => { await post(`/content-reports/${r.id}/resolve`); render(); }) }, 'Označi riješenim') : '')), 'Nema prijava.'),
    h('h2', {}, `Lige (${leagues.length})`), h('div', { class: 'toolbar' }, field('Traži', search)),
    table(['ID', 'Naziv', 'Kod', 'Osnivač', 'Članova', 'Stanje', ''], leagues.map((l) => tr(l.id, h('b', {}, l.name), l.code, l.owner, l.members, h('span', {}, l.is_hidden ? h('span', { class: 'tag bad' }, 'skrivena') : h('span', { class: 'tag ok' }, 'vidljiva'), l.reports ? h('span', { class: 'tag bad', style: 'margin-left:4px' }, `${l.reports} prijava`) : null),
      h('span', { style: 'white-space:nowrap' }, h('button', { class: 'btn xs', onclick: () => { const n = prompt('Novi naziv lige', l.name); if (n) upd(l.id, { name: n }, 'Liga je preimenovana.')(); } }, 'Preimenuj'), ' ',
        h('button', { class: 'btn xs', onclick: upd(l.id, { is_hidden: !l.is_hidden }, 'Spremljeno.') }, l.is_hidden ? 'Prikaži' : 'Sakrij'), ' ', h('button', { class: 'btn xs danger', onclick: () => { if (confirm('Obrisati ligu?')) upd(l.id, { delete: true }, 'Liga je obrisana.')(); } }, 'Obriši'))))));
}

// ================= Postavke =================
async function vSettings() {
  const s = await get('/settings');
  const col = s.colors || {}, msg = s.messages || {}, rar = s.rarity || {}, gm = s.game || {};
  const f = {
    game_name: inp(s.game_name), logo_text: inp(s.logo_text), tagline: inp(s.tagline), contact: inp(s.contact_email, { type: 'email' }),
    sign: inp(col.sign || '#0c7a55', { type: 'color' }), route: inp(col.route || '#ffc928', { type: 'color' }), alert: inp(col.alert || '#e5553a', { type: 'color' }),
    goal: inp(msg.goal), short: inp(msg.short), wrong: inp(msg.wrong), share: inp(msg.share),
    start: inp(s.start_date, { type: 'date' }), reset: inp(s.reset_time || '00:00', { type: 'time' }), tz: inp(s.timezone || 'Europe/Zagreb'),
    K: inp(rar.prior_strength ?? 200, { type: 'number', min: 0 }), wP: inp(rar.w_percentile ?? 0.7, { type: 'number', step: 0.05, min: 0, max: 1 }), wB: inp(rar.w_breadth ?? 0.3, { type: 'number', step: 0.05, min: 0, max: 1 }), cap: inp(rar.ip_cap ?? 3, { type: 'number', min: 1 }),
    guests: chk(s.guests_on_leaderboard), reactions: inp((s.reactions || []).join(' ')), map_style: inp(s.map_style || 'tamna'),
    qn: inp(gm.questions_per_day ?? 10, { type: 'number', min: 1, max: 30 }), prep: inp(gm.prep_seconds ?? 5, { type: 'number', min: 0, max: 30, step: 'any' }), ans: inp(gm.answer_seconds ?? 30, { type: 'number', min: 5, max: 300 }), retries: chk(gm.retries ?? true), maxTry: inp(gm.max_attempts ?? 15, { type: 'number', min: 1, max: 50 }), numOut: sel([['spremljena', 'vrijedi zadnja spremljena procjena'], ['nula', '0 km (procjena mora biti zaključena na vrijeme)']], gm.numeric_timeout || 'spremljena'),
    retry: inp(msg.retry), timeout: inp(msg.timeout), beyond: inp(msg.beyond),
    rules: area(s.rules, { rows: 14 }), privacy: area(s.privacy, { rows: 14 }), terms: area(s.terms, { rows: 14 }),
  };
  const th = (s.numeric_thresholds || []).map((t) => ({ ...t }));
  const thRows = () => th.map((t, i) => tr(inp(t.max_pct, { type: 'number', step: 'any', oninput: (e) => { t.max_pct = Number(e.target.value); } }), sel([1, 2, 3, 4, 5, 6, 7].map((n) => [n, `razina ${n}`]), t.level, { onchange: (e) => { t.level = Number(e.target.value); } }), h('button', { class: 'btn xs danger', onclick: () => { th.splice(i, 1); thBody.replaceChildren(...thRows()); } }, '×')));
  const thBody = h('tbody', {}, thRows());
  const save = run(async () => {
    await api('PUT', '/settings', {
      game_name: f.game_name.value, logo_text: f.logo_text.value, tagline: f.tagline.value, contact_email: f.contact.value,
      colors: { ...col, sign: f.sign.value, route: f.route.value, alert: f.alert.value }, messages: { ...msg, goal: f.goal.value, short: f.short.value, wrong: f.wrong.value, share: f.share.value, retry: f.retry.value, timeout: f.timeout.value, beyond: f.beyond.value },
      game: { questions_per_day: Number(f.qn.value), prep_seconds: Number(f.prep.value), answer_seconds: Number(f.ans.value), retries: f.retries.checked, max_attempts: Number(f.maxTry.value), numeric_timeout: f.numOut.value },
      start_date: f.start.value, reset_time: f.reset.value, timezone: f.tz.value,
      rarity: { prior_strength: Number(f.K.value), w_percentile: Number(f.wP.value), w_breadth: Number(f.wB.value), ip_cap: Number(f.cap.value) },
      numeric_thresholds: [...th].sort((a, b) => a.max_pct - b.max_pct), guests_on_leaderboard: f.guests.checked, reactions: [...f.reactions.value.trim().split(/\s+/)].filter(Boolean), map_style: f.map_style.value.trim() || 'tamna',
      rules: f.rules.value, privacy: f.privacy.value, terms: f.terms.value,
    });
    render();
  }, 'Postavke su spremljene.');
  mount(h('h1', {}, 'Postavke'),
    h('h2', {}, 'Identitet'), h('div', { class: 'panel grid' }, field('Naziv igre', f.game_name), field('Tekst logotipa', f.logo_text), field('Slogan na naslovnici', f.tagline), field('Kontakt e-mail', f.contact), field('Boja ploče', f.sign), field('Boja rute', f.route), field('Boja upozorenja', f.alert)),
    h('h2', {}, 'Tijek igre'), h('div', { class: 'panel stack' },
      h('div', { class: 'grid' }, field('Pitanja po danu', f.qn, 'Aktivan dnevni izazov mora imati točno toliko pitanja (ili izričitu potvrdu iznimke).'), field('Priprema (s)', f.prep, 'Pitanje je vidljivo, upis je zaključan.'), field('Vrijeme za odgovor (s)', f.ans), field('Najviše pokušaja po pitanju', f.maxTry), field('Procjena kad vrijeme istekne', f.numOut)),
      h('label', { class: 'row' }, f.retries, h('span', {}, 'Ponovni pokušaji: neprepoznat odgovor ne zaključuje pitanje dok traje vrijeme')),
      h('p', { class: 'small muted' }, 'Kad vrijeme istekne bez točnog odgovora, pitanje donosi 0 km i igrač sam pokreće sljedeće. Vrijeme mjeri poslužitelj. Izmjene vrijede od sljedećeg pokrenutog pitanja.'),
      h('p', { class: 'small muted' }, 'Ciljna udaljenost (kilometri igre do cilja i iza njega) uređuje se na stranici Karte i gradovi, a kilometri i pragovi rijetkosti po prijevozu na stranici Prijevozna sredstva.')),
    h('h2', {}, 'Poruke'), h('div', { class: 'panel grid two' }, field('Dolazak do cilja', f.goal), field('Kad se cilj ne dosegne', f.short), field('Neprepoznat odgovor (ponovni pokušaj)', f.retry), field('Istek vremena', f.timeout), field('Prolazak cilja', f.beyond), field('Netočan odgovor (bez ponovnih pokušaja)', f.wrong), field('Tekst uz dijeljenje', f.share)),
    h('h2', {}, 'Vrijeme'), h('div', { class: 'panel grid' }, field('Datum početka igre', f.start, 'Raniji dani nisu dostupni ni u arhivi.'), field('Dnevno resetiranje', f.reset), field('Vremenska zona', f.tz)),
    h('h2', {}, 'Algoritam rijetkosti'), h('div', { class: 'panel stack' },
      h('p', { class: 'small' }, 'Udio odgovora = (K × početna procjena + broj igrača) / (K + svi točni odgovori). Rijetkost = 100 × (udio percentila × P + udio širine × B). Veći K znači da početna procjena dulje prevladava nad stvarnim odgovorima.'),
      h('div', { class: 'grid' }, field('K — težina početne procjene', f.K, 'Globalno; svako pitanje može imati svoj K.'), field('Udio percentila (P)', f.wP), field('Udio širine baze (B)', f.wB), field('Glasova po IP adresi i pitanju', f.cap)),
      h('label', { class: 'row' }, f.guests, h('span', {}, 'Gosti se prikazuju na globalnim ljestvicama'))),
    h('h2', {}, 'Globalno bodovanje procjena'), h('p', { class: 'small' }, 'Postotna pogreška do zadane granice daje navedenu razinu prijevoza. Unutar tolerancije pitanja uvijek je najviša razina; iznad zadnje granice 0 km.'),
    h('div', { class: 'panel flush', style: 'max-width:520px' }, h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Pogreška do (%)'), h('th', {}, 'Razina'), h('th', {}, ''))), thBody)),
    h('button', { class: 'btn xs', style: 'margin-top:8px', onclick: () => { th.push({ max_pct: 100, level: 1 }); thBody.replaceChildren(...thRows()); } }, 'Dodaj prag'),
    h('h2', {}, 'Ostalo'), h('div', { class: 'panel grid two' }, field('Reakcije (odvojene razmakom)', f.reactions), field('Rezervna kartografska podloga (stari način)', f.map_style, 'Koristi se samo ako je u „Karta i podloge“ isključen novi prikaz. Glavne postavke karte (Reljef/Satelit) su na stranici Karta i podloge.')),
    h('h2', {}, 'Tekstovi'), h('p', { class: 'small' }, '"## " započinje naslov, "- " stavku popisa, prazan red novi odlomak.'),
    h('div', { class: 'stack' }, field('Pravila igre', f.rules), field('Privatnost', f.privacy), field('Uvjeti korištenja', f.terms)),
    h('div', { class: 'savebar' }, h('button', { class: 'btn primary', onclick: save }, 'Spremi sve postavke')));
}

async function vAudit(_, q) {
  const rows = await get('/audit?' + new URLSearchParams(q));
  mount(h('h1', {}, 'Dnevnik izmjena'), table(['Kada', 'Tko', 'Radnja', 'Što', 'ID', 'Detalji'], rows.map((r) => tr(when(r.created_at), r.nickname || 'sustav', r.action, r.entity || '—', r.entity_id || '—', h('code', { style: 'font-size:.78rem;word-break:break-all' }, (r.detail || '').slice(0, 300)))), 'Još nema zapisa.'),
    h('div', { class: 'row', style: 'margin-top:12px' }, h('a', { class: 'btn xs', href: '#/dnevnik?page=' + (Number(q.page || 1) + 1) }, 'Stariji zapisi')));
}


// ================= v2.3: moderacija, obavijesti i e-mail, izazovi prijatelja, zvuk, karta =================
const tag = (cls, text) => h('span', { class: 'tag ' + cls }, text);
const subnav = (items, current, base) => h('div', { class: 'row', style: 'flex-wrap:wrap;gap:6px;margin:6px 0 14px' }, items.map(([k, label]) => h('a', { class: 'btn xs' + (k === current ? ' primary' : ''), href: `#/${base}${k ? '?t=' + k : ''}` }, label)));

async function vModeration(_, q) {
  const t = q.t || 'poruke';
  const counts = await get('/moderation/counts');
  const nav = subnav([['poruke', `Prijavljene poruke (${counts.messages})`], ['putokazi', `Putokazi (${counts.signs} prijava)`], ['postavke', 'Postavke putokaza']], t, 'moderacija');
  if (t === 'poruke') {
    const rows = await get('/message-reports');
    const ctxDialog = async (r) => {
      const c = await get(`/message-reports/${r.id}/context`);
      const dlg = h('dialog', { class: 'adm-dlg' }, h('h2', {}, 'Kontekst prijavljene poruke'), h('p', { class: 'small muted' }, 'Prikazane su samo poruke neposredno oko prijavljene (privatnost razgovora).'),
        h('div', { class: 'stack' }, c.messages.map((m) => h('div', { class: 'panel', style: m.reported ? 'border-color:#e5553a' : '' }, h('small', { class: 'muted' }, `${m.sender} · ${when(m.created_at)}${m.removed_at ? ' · uklonjeno' : ''}`), h('div', { style: 'white-space:pre-wrap' }, m.body)))),
        h('button', { class: 'btn', style: 'margin-top:12px', onclick: () => dlg.close() }, 'Zatvori'));
      dlg.addEventListener('close', () => dlg.remove()); document.body.append(dlg); dlg.showModal();
    };
    const act = (r, action) => run(async () => { const note = action === 'blokiraj' ? prompt('Razlog blokiranja (vidljiv u administraciji)?', r.reason || '') : null; if (action === 'blokiraj' && note == null) return; await post(`/message-reports/${r.id}/resolve`, { action, note }); render(); }, 'Spremljeno.');
    return mount(h('h1', {}, 'Moderacija'), nav,
      table(['Kada', 'Pošiljatelj', 'Primatelj', 'Poruka', 'Razlog', 'Prijavio', 'Stanje', ''], rows.map((r) => tr(when(r.created_at),
        h('a', { href: `#/korisnici/${r.sender.id}` }, r.sender.nickname, r.sender_reports > 1 ? tag('bad', ` ${r.sender_reports}×`) : ''), h('a', { href: `#/korisnici/${r.recipient.id}` }, r.recipient.nickname),
        h('div', { style: 'max-width:340px;white-space:pre-wrap' }, r.removed ? h('s', {}, r.body) : r.body), r.reason || '—', r.reporter.nickname,
        r.status === 'novo' ? tag('bad', 'novo') : tag('', r.status + (r.action ? ` · ${r.action}` : '')),
        h('div', { class: 'row', style: 'flex-wrap:wrap;gap:4px' }, h('button', { class: 'btn xs', onclick: () => ctxDialog(r) }, 'Kontekst'),
          r.status === 'novo' ? [h('button', { class: 'btn xs danger', onclick: act(r, 'ukloni') }, 'Ukloni poruku'), h('button', { class: 'btn xs danger', onclick: act(r, 'blokiraj') }, 'Ukloni + blokiraj pošiljatelja'), h('button', { class: 'btn xs', onclick: act(r, 'odbaci') }, 'Odbaci')] : null))), 'Nema prijavljenih poruka.'),
      h('p', { class: 'small muted' }, 'Administrator vidi samo prijavljene poruke i nekoliko poruka oko njih — ne i cijele razgovore. Sve radnje bilježe se u dnevnik izmjena.'));
  }
  if (t === 'putokazi') {
    const qq = inp(q.q || '', { placeholder: 'Traži tekst ili nadimak' }), dd = inp(q.datum || '', { type: 'date' }), rep = chk(q.prijave === '1');
    const rows = await get('/signs?' + new URLSearchParams({ q: q.q || '', date: q.datum || '', reported: q.prijave === '1' ? '1' : '' }));
    const act = (s, action) => run(async () => { const reason = action === 'ukloni' ? prompt('Razlog uklanjanja?', '') : null; if (action === 'ukloni' && reason == null) return; await post(`/signs/${s.id}/moderate`, { action, reason }); render(); }, 'Spremljeno.');
    return mount(h('h1', {}, 'Moderacija'), nav,
      h('form', { class: 'row', style: 'flex-wrap:wrap;gap:8px;margin-bottom:12px', onsubmit: (e) => { e.preventDefault(); go(`moderacija?t=putokazi&q=${encodeURIComponent(qq.value)}&datum=${dd.value}${rep.checked ? '&prijave=1' : ''}`); } }, qq, dd, h('label', { class: 'row' }, rep, h('span', {}, 'samo prijavljeni')), h('button', { class: 'btn xs primary' }, 'Traži')),
      table(['Dan', 'Karta', 'Igrač', 'Putokaz', 'Km', 'Izmjena', 'Prijave', 'Stanje', ''], rows.map((s) => tr(s.date, s.map, h('a', { href: `#/korisnici/${s.user_id}` }, s.nickname),
        h('b', {}, s.text), Math.round(s.km), s.edits, s.reports ? h('span', { title: s.reasons || '' }, tag(s.open_reports ? 'bad' : '', `${s.reports}${s.open_reports ? ' nove' : ''}`)) : '—',
        s.status === 'aktivan' ? tag('ok', 'aktivan') : tag('bad', 'uklonjen' + (s.removed_reason ? `: ${s.removed_reason}` : '')),
        h('div', { class: 'row', style: 'gap:4px' }, s.status === 'aktivan' ? h('button', { class: 'btn xs danger', onclick: act(s, 'ukloni') }, 'Ukloni') : h('button', { class: 'btn xs', onclick: act(s, 'vrati') }, 'Vrati'), s.open_reports ? h('button', { class: 'btn xs', onclick: act(s, 'odbaci') }, 'Odbaci prijave') : null))), 'Nema putokaza za taj upit.'));
  }
  const s = await get('/signs/settings');
  const f = { max: inp(s.max_len, { type: 'number', min: 20, max: 80 }), en: chk(s.enabled), hist: chk(s.history), words: area((s.extra_words || []).join('\n'), { rows: 6 }) };
  mount(h('h1', {}, 'Moderacija'), nav,
    h('div', { class: 'panel stack', style: 'max-width:640px' },
      field('Najveća duljina putokaza (znakova)', f.max, 'Preporuka 60. Dopušteno 20–80.'),
      h('label', { class: 'row' }, f.en, h('span', {}, 'Putokazi uključeni')),
      h('label', { class: 'row' }, f.hist, h('span', {}, 'Prošli putokazi vidljivi u povijesti lige (pregled ranijih dana)')),
      field('Dodatne zabranjene riječi (jedna po retku)', f.words, 'Uz ugrađeni popis psovki. Uspoređuje se početak riječi, bez obzira na kvačice i velika slova.'),
      h('p', { class: 'small muted' }, 'Istek: putokaz vrijedi za dan svoje partije; kad krene novi dnevni izazov, nestaje iz aktivne utrke. Vidljivost: članovi liga u kojima je igrač, tek kad i sami odigraju tu kartu.'),
      h('button', { class: 'btn primary', onclick: run(async () => { await api('PUT', '/signs/settings', { max_len: Number(f.max.value), enabled: f.en.checked, history: f.hist.checked, extra_words: f.words.value.split('\n') }); render(); }, 'Spremljeno.') }, 'Spremi')));
}

async function vNotifAdmin() {
  const d = await get('/notifications');
  const r = d.reminders;
  const f = { en: chk(r.enabled), days: inp(r.inactivity_days, { type: 'number', min: 2, max: 14 }), cool: inp(r.cooldown_days, { type: 'number', min: 3, max: 30 }), max: inp(r.max_per_streak, { type: 'number', min: 1, max: 10 }), hour: inp(r.send_hour, { type: 'number', min: 0, max: 23 }), dig: inp(r.digest_hours, { type: 'number', min: 1, max: 48 }) };
  const to = inp(me.email || '', { type: 'email', placeholder: 'adresa za probu' });
  const bt = inp('', { placeholder: 'Naslov (npr. Nova karta je stigla!)' }), bb = inp('', { placeholder: 'Kratak tekst (neobavezno)' }), bl = inp('', { placeholder: '/lige (neobavezno)' });
  mount(h('h1', {}, 'Obavijesti i e-mail'),
    h('div', { class: 'grid two' },
      h('div', { class: 'panel stack' }, h('h2', {}, 'E-mail poslužitelj'),
        d.email.configured ? h('p', {}, tag('ok', 'konfiguriran'), ` ${d.email.host}:${d.email.port} · pošiljatelj ${d.email.from}`) : h('p', { class: 'notice' }, 'SMTP nije konfiguriran (SMTP_HOST, EMAIL_FROM u .env). E-mail se ne šalje; obavijesti u aplikaciji rade normalno.'),
        h('p', { class: 'small' }, `Privola za podsjetnike: ${d.opted_in.reminders} · za sažetke poruka: ${d.opted_in.messages}`),
        h('div', { class: 'row', style: 'gap:6px;flex-wrap:wrap' }, to, h('button', { class: 'btn xs', onclick: run(async () => { const x = await post('/notifications/test-email', { to: to.value }); toast(x.ok ? `Poslano (${x.id || 'OK'}).` : `Nije poslano: ${x.error}`); render(); }) }, 'Pošalji probni e-mail')),
        h('button', { class: 'btn xs', onclick: run(async () => { const x = await post('/jobs/run'); toast('Poslovi su pokrenuti: ' + JSON.stringify(x).slice(0, 160)); render(); }) }, 'Pokreni zakazane poslove sada')),
      h('div', { class: 'panel stack' }, h('h2', {}, 'Podsjetnik nakon neaktivnosti'),
        h('label', { class: 'row' }, f.en, h('span', {}, 'Podsjetnici uključeni (u aplikaciji uvijek; e-mailom samo uz privolu igrača)')),
        h('div', { class: 'grid' }, field('Dana bez igre', f.days), field('Razmak između podsjetnika (dana)', f.cool), field('Najviše podsjetnika dok se ne vrati', f.max), field('Sat slanja (Europe/Zagreb)', f.hour), field('Sažetak poruka najviše svakih (sati)', f.dig)),
        h('button', { class: 'btn primary', onclick: run(async () => { await api('PUT', '/notifications/reminders', { enabled: f.en.checked, inactivity_days: f.days.value, cooldown_days: f.cool.value, max_per_streak: f.max.value, send_hour: f.hour.value, digest_hours: f.dig.value }); render(); }, 'Spremljeno.') }, 'Spremi'))),
    h('h2', {}, 'Vrste obavijesti (zadnjih 7 dana)'),
    table(['Vrsta', 'Poslano', 'Nepročitano'], d.by_type.map((x) => tr(x.type, x.n, x.unread)), 'Još nema obavijesti.'),
    h('p', { class: 'small muted' }, 'Vrste: pretek (netko te prestigao), vodstvo, izgubio-vodstvo, svi-odigrali, poruka, izazov, nagrada, podsjetnik, sustav. Igrači svaku vrstu mogu isključiti u profilu.'),
    h('h2', {}, 'Obavijest svim igračima'),
    h('div', { class: 'panel stack', style: 'max-width:640px' }, bt, bb, bl, h('button', { class: 'btn', onclick: run(async () => { if (!confirm('Poslati obavijest svim registriranim igračima?')) return; const x = await post('/notifications/broadcast', { title: bt.value, body: bb.value, link: bl.value || null }); toast(`Poslano: ${x.sent}`); }) }, 'Pošalji u aplikaciji')),
    h('h2', {}, `Dnevnik isporuke e-maila ${d.failed ? `(${d.failed} neuspjelih)` : ''}`),
    table(['Kada', 'Igrač', 'Vrsta', 'Stanje', 'Detalji'], d.delivery.map((x) => tr(when(x.created_at), x.nickname || '—', x.kind, x.status === 'poslano' ? tag('ok', 'poslano') : x.status === 'greska' ? tag('bad', 'greška') : tag('warn', x.status), h('code', { style: 'font-size:.75rem' }, x.detail || ''))), 'Još nije bilo slanja.'),
    h('h2', {}, 'Zakazani poslovi'),
    table(['Posao', 'Ključ', 'Početak', 'Kraj', 'Rezultat'], d.jobs.map((j) => tr(j.name, j.run_key, when(j.started_at), when(j.finished_at), j.result || '')), 'Još nema zapisa.'));
}

async function vDuelsAdmin(_, q) {
  const rows = await get('/duels?' + new URLSearchParams({ status: q.status || '', q: q.q || '' }));
  const qq = inp(q.q || '', { placeholder: 'Nadimak' }), st = sel([['', 'svi'], ['ceka', 'čeka'], ['prihvacen', 'prihvaćen'], ['zavrsen', 'završen'], ['odbijen', 'odbijen'], ['istekao', 'istekao'], ['otkazan', 'otkazan']], q.status || '');
  mount(h('h1', {}, 'Izazovi prijatelja'),
    h('p', { class: 'small muted' }, 'Dvoboji uspoređuju službene partije istog dana i karte. Rezultat računa poslužitelj; izazov ne daje kilometre.'),
    h('form', { class: 'row', style: 'gap:8px;margin-bottom:12px', onsubmit: (e) => { e.preventDefault(); go(`dvoboji?q=${encodeURIComponent(qq.value)}&status=${st.value}`); } }, qq, st, h('button', { class: 'btn xs primary' }, 'Traži')),
    table(['ID', 'Dan', 'Karta', 'Izazivač', 'Suparnik', 'Stanje', 'Ishod', 'Rezultat', 'Poruka', ''], rows.map((c) => tr(c.id, c.date, c.map, c.challenger || '—', c.opponent || '—', c.status, c.outcome ? `${c.outcome}${c.winner ? ' · ' + c.winner : ''}` : '—',
      c.result ? `${c.result.challenger ? Math.round(c.result.challenger.km) : '—'} : ${c.result.opponent ? Math.round(c.result.opponent.km) : '—'} km` : '—', c.message || '',
      ['ceka', 'prihvacen'].includes(c.status) ? h('button', { class: 'btn xs danger', onclick: run(async () => { const reason = prompt('Razlog otkazivanja?'); if (reason == null) return; await post(`/duels/${c.id}/cancel`, { reason }); render(); }, 'Otkazano.') }, 'Otkaži') : '')), 'Nema izazova.'));
}

let adminSound = null;
async function vAudioAdmin() {
  if (!adminSound) { const m = await import('/zvuk.js'); adminSound = m.createSound(); }
  const d = await get('/audio');
  const cfgPublic = (await (await fetch('/api/bootstrap')).json()).site.audio;
  adminSound.configure({ ...cfgPublic, enabled: true }, { on: true });
  const s = d.settings;
  const opts = [['', '— bez zvuka —'], ...d.assets.filter((a) => !a.disabled && a.active).map((a) => [a.slug, `${a.name} (${a.slug})`])];
  const evSel = Object.fromEntries(Object.entries(d.events).map(([k, e]) => [k, sel(opts, e.value)]));
  const citySel = Object.fromEntries(d.cities.map((c) => [c.name, sel([['', '— zadani „Dolazak u grad“ —'], ...opts.slice(1)], c.value)]));
  const f = { en: chk(s.enabled), on: chk(s.default_on), vol: inp(s.default_volume, { type: 'number', min: 0, max: 1, step: 0.05 }) };
  const disabled = new Set(s.disabled || []);
  const play = (slug) => h('button', { class: 'btn xs', type: 'button', title: 'Preslušaj', onclick: () => adminSound.preview(slug, { level: 5, duration: 2 }) }, '▶');
  const file = h('input', { type: 'file', accept: 'audio/mpeg,audio/ogg,audio/wav,audio/webm' }), nm = inp('', { placeholder: 'Naziv' }), lic = inp('', { placeholder: 'Licenca (obavezno), npr. CC0 / vlastita snimka' }), src = inp('', { placeholder: 'Izvor / autor (neobavezno)' });
  const save = run(async () => {
    await api('PUT', '/audio', { enabled: f.en.checked, default_on: f.on.checked, default_volume: Number(f.vol.value), events: Object.fromEntries(Object.entries(evSel).map(([k, x]) => [k, x.value])), cities: Object.fromEntries(Object.entries(citySel).map(([k, x]) => [k, x.value])), disabled: [...disabled] });
    render();
  }, 'Zvuk je spremljen.');
  mount(h('h1', {}, 'Zvuk'),
    h('div', { class: 'panel stack', style: 'max-width:640px' },
      h('label', { class: 'row' }, f.en, h('span', {}, 'Zvučni efekti uključeni na stranici')), h('label', { class: 'row' }, f.on, h('span', {}, 'Novim posjetiteljima zvuk je zadano uključen (svira tek nakon prvog dodira/klika)')),
      field('Zadana glasnoća (0–1)', f.vol)),
    h('h2', {}, 'Zvučni zapisi'),
    table(['', 'Naziv', 'Oznaka', 'Vrsta', 'Licenca / izvor', 'Uključen'], d.assets.map((a) => tr(play(a.slug), h('b', {}, a.name), h('code', {}, a.slug), a.kind === 'synth' ? 'sinteza u pregledniku' : `datoteka${a.bytes ? ` · ${Math.round(a.bytes / 1024)} kB` : ''}`, h('small', {}, a.license, h('br'), a.source || ''),
      a.builtin ? chk(!disabled.has(a.slug), { onchange: (e) => { if (e.target.checked) disabled.delete(a.slug); else disabled.add(a.slug); } }) : chk(a.active, { onchange: run(async (e) => { await api('PATCH', `/audio/assets/${a.id}`, { active: e.target.checked }); }, 'Spremljeno.') })))),
    h('h2', {}, 'Događaji u igri'),
    table(['Događaj', 'Zvuk', ''], Object.entries(d.events).map(([k, e]) => tr(e.label, evSel[k], h('button', { class: 'btn xs', onclick: () => evSel[k].value && adminSound.preview(evSel[k].value, { level: 5, duration: 2 }) }, '▶')))),
    h('h2', {}, 'Gradovi'),
    h('p', { class: 'small muted' }, 'Zvuk dolaska svira samo tijekom vožnje kroz grad (ne pri ponovnom otvaranju rezultata). Gradovi bez dodjele koriste događaj „Dolazak u grad“.'),
    table(['Grad', 'Zvuk', ''], d.cities.map((c) => tr(c.name, citySel[c.name], h('button', { class: 'btn xs', onclick: () => citySel[c.name].value && adminSound.preview(citySel[c.name].value) }, '▶')))),
    h('h2', {}, 'Dodaj zvučni zapis'),
    h('div', { class: 'panel stack', style: 'max-width:640px' }, h('p', { class: 'small muted' }, 'MP3/OGG/WAV/WebM do 400 kB. Dodaj samo zapise koje smiješ koristiti i upiši licencu — ne preuzimaj zvukove s drugih stranica bez dopuštenja.'), file, nm, lic, src,
      h('button', { class: 'btn', onclick: run(async () => {
        const fl = file.files[0]; if (!fl) throw new Error('Odaberi datoteku.');
        const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).replace(/^data:audio\/[a-z0-9.-]+;/, (m) => (/mpeg|mp3/.test(m) ? 'data:audio/mpeg;' : m))); r.onerror = rej; r.readAsDataURL(fl); });
        await post('/audio/upload', { name: nm.value || fl.name, data, license: lic.value, source: src.value }); render();
      }, 'Zapis je dodan.') }, 'Dodaj')),
    h('div', { class: 'savebar' }, h('button', { class: 'btn primary', onclick: save }, 'Spremi postavke zvuka')));
}

async function vMapAdmin() {
  const d = await get('/map-settings');
  const s = d.settings;
  const f = {
    mode: sel([['reljef', 'Reljef'], ['satelit', 'Satelit']], s.default_mode), prov: sel([['auto', 'Automatski (MapTiler → Stadia → besplatno)'], ['maptiler', 'MapTiler'], ['stadia', 'Stadia Maps'], ['besplatno', 'Besplatno (bez ključa, samo Reljef)'], ['prilagodeno', 'Prilagođeno (vlastiti URL)']], s.provider),
    terr: inp(s.terrain_style_url, { placeholder: 'https://…/style.json (prazno = ugrađeni tamni reljef)' }), sat: inp(s.satellite_url, { placeholder: 'https://…/{z}/{x}/{y}.jpg ili style.json' }),
    attr: inp(s.attribution), eox: chk(s.eox_noncommercial), fb: inp(s.fallback_style), dim: inp(s.satellite_dim, { type: 'number', min: 0, max: 0.6, step: 0.02 }),
  };
  mount(h('h1', {}, 'Karta i podloge'),
    h('div', { class: 'panel stack', style: 'max-width:760px' },
      h('p', {}, 'Aktivni pružatelj: ', h('b', {}, d.active_provider), ' · dostupni prikazi: ', h('b', {}, d.modes.join(', ')), d.satellite_noncommercial ? [' ', tag('warn', 'satelit samo za nekomercijalnu uporabu')] : ''),
      h('p', { class: 'small' }, 'Ključevi (postavljaju se u .env, ne ovdje): MAPTILER_KEY ', d.keys.MAPTILER_KEY ? tag('ok', 'postavljen') : tag('', 'nije postavljen'), ' · STADIA_API_KEY ', d.keys.STADIA_API_KEY ? tag('ok', 'postavljen') : tag('', 'nije postavljen')),
      h('div', { class: 'grid two' }, field('Zadani prikaz', f.mode, 'Ako satelit nije dostupan, koristi se Reljef.'), field('Pružatelj', f.prov)),
      field('Vlastiti stil za Reljef (neobavezno)', f.terr), field('Vlastiti satelit (samo uz „Prilagođeno“)', f.sat, 'Bez ključa u adresi — ključ ide u .env.'),
      field('Dodatna atribucija', f.attr), field('Zatamnjenje satelita (0–0,6)', f.dim, 'Malo zatamnjenje čini rutu i oznake čitljivijima.'), field('Rezervna podloga', f.fb, '"tamna" (OpenFreeMap) ili URL stila; koristi se ako pružatelj ne odgovori.'),
      h('label', { class: 'row' }, f.eox, h('span', {}, 'Sentinel-2 cloudless (EOX) kao satelit bez ključa — ', h('b', {}, 'samo za nekomercijalnu uporabu'), ' (CC BY-NC-SA). Za komercijalnu stranicu koristi MapTiler ili Stadia.')),
      h('p', { class: 'small muted' }, 'Detalji, cijene i upute za ključeve: docs/MAP_PROVIDERS.md.'),
      h('button', { class: 'btn primary', onclick: run(async () => { await api('PUT', '/map-settings', { default_mode: f.mode.value, provider: f.prov.value, terrain_style_url: f.terr.value, satellite_url: f.sat.value, attribution: f.attr.value, eox_noncommercial: f.eox.checked, fallback_style: f.fb.value, satellite_dim: Number(f.dim.value) }); render(); }, 'Spremljeno.') }, 'Spremi')));
}

render();
