// Karta putovanja.
// Prava karta: MapLibre GL nad tamnim vektorskim pločicama (OpenFreeMap / OpenStreetMap).
// Ako se biblioteka ili pločice ne učitaju, ista ruta se crta kao SVG SHEMA — jasno označena kao shematski prikaz.
// Kilometri su virtualni (kilometri igre): svaka točka rute nosi svoj `km`, a putanja se zaglađuje radi izgleda.
const MAPLIBRE = 'https://unpkg.com/maplibre-gl@5.20.0/dist/maplibre-gl';
let loader = null;
function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve(true);
  if (!loader) {
    loader = new Promise((resolve) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = MAPLIBRE + '.css';
      document.head.append(css);
      const s = document.createElement('script');
      s.src = MAPLIBRE + '.js'; s.async = true;
      s.onload = () => resolve(!!window.maplibregl);
      s.onerror = () => resolve(false);
      document.head.append(s);
      setTimeout(() => resolve(!!window.maplibregl), 8000);
    });
  }
  return loader;
}

const OSM_ATTR = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
const OSM_STYLE = {
  version: 8,
  sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: OSM_ATTR } },
  layers: [{ id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.8, 'raster-brightness-max': 0.45, 'raster-contrast': 0.15 } }],
};
const STYLES = { tamna: 'https://tiles.openfreemap.org/styles/dark', svijetla: 'https://tiles.openfreemap.org/styles/positron', osm: OSM_STYLE };
const C = { bg: '#0e1319', water: '#152230', road: '#f1f4f6', done: '#ffc928', ext: '#5fb0e6', casing: '#05080b' };

// Boje dionica: svaka dionica između dviju postaja ima svoju boju (ista u svim prikazima karte).
export const SEGMENT_COLORS = ['#ffc928', '#ff8a3d', '#ff5f6d', '#e667d9', '#9b8cff', '#4fa8ff', '#2fd3c9', '#58d66b', '#c6e04a'];
/** Dionice rute: od postaje do postaje, svaka sa svojom bojom. */
export function segmentsOf(route) {
  const stops = route.points.filter((p) => p.is_stop);
  return stops.slice(0, -1).map((p, i) => ({ from: p.km, to: stops[i + 1].km, fromName: p.name, toName: stops[i + 1].name, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }));
}
/** Država u kojoj je igrač za zadani kilometar (prema zadnjoj prijeđenoj točki rute). */
export function countryAt(route, km) {
  let c = route.points[0].country;
  for (const p of route.points) { if (p.km <= km + 1e-6) c = p.country || c; else break; }
  return c;
}
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Zaglađena putanja kroz sve točke rute (Catmull-Rom). Svaka točka putanje ima svoj virtualni kilometar,
 * raspoređen razmjerno duljini luka između dviju susjednih točaka rute.
 */
export function buildPath(route, samples = 14) {
  const P = route.points, n = P.length, out = [];
  const at = (i) => P[clamp(i, 0, n - 1)];
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const seg = [];
    for (let j = 0; j <= samples; j++) {
      const t = j / samples, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      seg.push({ lng: f(p0.lng, p1.lng, p2.lng, p3.lng), lat: f(p0.lat, p1.lat, p2.lat, p3.lat) });
    }
    let len = 0; const cum = [0];
    for (let j = 1; j < seg.length; j++) { len += Math.hypot((seg[j].lng - seg[j - 1].lng) * 0.72, seg[j].lat - seg[j - 1].lat); cum.push(len); }
    for (let j = i === 0 ? 0 : 1; j < seg.length; j++) out.push({ ...seg[j], km: p1.km + (p2.km - p1.km) * (len ? cum[j] / len : j / samples) });
  }
  return out;
}
/** Položaj na putanji za zadani kilometar (ne staje na cilju — ide do kraja produžene rute). */
export function posAt(path, km) {
  const k = clamp(km, 0, path[path.length - 1].km);
  let lo = 0, hi = path.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (path[mid].km <= k) lo = mid; else hi = mid; }
  const a = path[lo], b = path[hi], t = b.km > a.km ? (k - a.km) / (b.km - a.km) : 0;
  return { lng: a.lng + (b.lng - a.lng) * t, lat: a.lat + (b.lat - a.lat) * t, i: lo, bearing: Math.atan2((b.lng - a.lng) * 0.72, b.lat - a.lat) };
}
function slice(path, fromKm, toKm) {
  const out = [], a = posAt(path, fromKm), b = posAt(path, toKm);
  out.push([a.lng, a.lat]);
  for (let i = a.i + 1; i <= b.i; i++) out.push([path[i].lng, path[i].lat]);
  out.push([b.lng, b.lat]);
  return out;
}
const emojiNode = (t) => {
  if (t && t.image) { const img = document.createElement('img'); img.src = t.image; img.alt = ''; return img; }
  return document.createTextNode((t && t.emoji) || '📍');
};
const stopKind = (route, p, i) => (i === 0 ? 'start' : i === route.goal_index ? 'goal' : p.label === 'granica' ? 'border' : i === route.points.length - 1 ? 'end' : i > route.goal_index ? 'abroad' : '');

// ---------------- SVG shema (rezervni prikaz) ----------------
function svgImpl(el, route, path) {
  const NS = 'http://www.w3.org/2000/svg';
  const lats = path.map((p) => p.lat), lngs = path.map((p) => p.lng);
  const minLng = Math.min(...lngs), maxLat = Math.max(...lats);
  const kx = Math.cos((((Math.min(...lats) + maxLat) / 2) * Math.PI) / 180);
  const X = (lng) => (lng - minLng) * kx * 100, Y = (lat) => (maxLat - lat) * 100;
  const W = (Math.max(...lngs) - minLng) * kx * 100, H = (maxLat - Math.min(...lats)) * 100;
  const pad = Math.max(W, H) * 0.1 + 10;
  const full = { x: -pad, y: -pad, w: W + 2 * pad, h: H + 2 * pad };
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'map-svg'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Shematski prikaz rute ${route.name}`);
  const mk = (tag, attrs, parent = svg) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); parent.append(n); return n; };
  const d = (coords) => coords.map(([lng, lat], i) => `${i ? 'L' : 'M'}${X(lng).toFixed(1)} ${Y(lat).toFixed(1)}`).join('');
  const line = { fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  const casing = mk('path', { ...line, d: d(slice(path, 0, route.end_km)), stroke: C.casing });
  const main = mk('path', { ...line, d: d(slice(path, 0, route.total_km)), stroke: C.road, 'stroke-opacity': 0.6 });
  const ext = route.end_km > route.total_km ? mk('path', { ...line, d: d(slice(path, route.total_km, route.end_km)), stroke: C.ext, 'stroke-opacity': 0.75 }) : null;
  const segs = segmentsOf(route).map((sg) => ({ ...sg, el: mk('path', { ...line, d: '', stroke: sg.color, class: 'seg-done' }) }));
  const stopsG = mk('g', {}), nodes = [];
  route.points.forEach((p, i) => {
    if (!p.is_stop) return;
    const kind = stopKind(route, p, i), major = kind === 'start' || kind === 'goal' || kind === 'end' || kind === 'border';
    const g = mk('g', { class: 'st ' + kind }, stopsG);
    const c = mk('circle', { cx: X(p.lng), cy: Y(p.lat) }, g);
    const t = mk('text', {}, g);
    t.textContent = kind === 'border' ? 'granica' : p.name;
    nodes.push({ g, c, t, km: p.km, major, x: X(p.lng), y: Y(p.lat) });
  });
  const rivalsG = mk('g', {});
  const me = mk('g', { class: 'me' });
  const meC = mk('circle', {}, me);
  const meText = mk('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }, me);
  const note = document.createElement('div');
  note.className = 'map-note'; note.textContent = 'Shematski prikaz — karta u pozadini nije učitana';
  el.append(svg, note);
  let mode = 'follow', at = 0, unit = 0, rivals = [];
  /** Veličine se zadaju u pikselima zaslona, pa natpisi i marker izgledaju isto u oba prikaza. */
  const scale = () => {
    const cw = Math.max(1, el.clientWidth), ch = Math.max(1, el.clientHeight);
    const follow = mode === 'follow';
    const vw = follow ? Math.min(full.w, Math.max(full.w * (cw > 700 ? 0.46 : 0.3), 150)) : full.w, vh = follow ? (vw * ch) / cw : full.h;
    const u = follow ? vw / cw : Math.max(full.w / cw, full.h / ch);       // jedinica SVG-a po pikselu
    if (Math.abs(u - unit) > 1e-6) {
      unit = u;
      casing.setAttribute('stroke-width', 9 * u);
      for (const l of [main, ext]) if (l) { l.setAttribute('stroke-width', 2.6 * u); l.setAttribute('stroke-dasharray', `${0.1 * u} ${6 * u}`); }
      for (const sg of segs) sg.el.setAttribute('stroke-width', 4.5 * u);
      for (const s of nodes) {
        s.c.setAttribute('r', (s.major ? 6 : 4) * u); s.c.setAttribute('stroke-width', 2 * u);
        s.t.setAttribute('x', s.x + 10 * u); s.t.setAttribute('y', s.y + 4 * u);
        s.t.setAttribute('font-size', (s.major ? 13 : 11) * u); s.t.setAttribute('stroke-width', 3 * u);
        s.t.style.display = follow || s.major ? '' : 'none';
      }
      meC.setAttribute('r', 20 * u); meC.setAttribute('stroke-width', 3 * u); meText.setAttribute('font-size', 22 * u);
      paintRivals();
    }
    return { vw, vh, follow };
  };
  const view = (km) => {
    const { vw, vh, follow } = scale();
    svg.setAttribute('preserveAspectRatio', follow ? 'xMidYMid slice' : 'xMidYMid meet');
    if (!follow) return svg.setAttribute('viewBox', `${full.x} ${full.y} ${full.w} ${full.h}`);
    const p = posAt(path, km);
    svg.setAttribute('viewBox', `${X(p.lng) - vw / 2} ${Y(p.lat) - vh / 2} ${vw} ${vh}`);
  };
  const draw = (km) => {
    at = km;
    const p = posAt(path, km);
    me.setAttribute('transform', `translate(${X(p.lng)} ${Y(p.lat)})`);
    for (const sg of segs) sg.el.setAttribute('d', km > sg.from ? d(slice(path, sg.from, Math.min(km, sg.to))) : '');
    for (const s of nodes) s.g.classList.toggle('passed', s.km <= km + 1e-6);
  };
  function paintRivals() {
    rivalsG.replaceChildren();
    for (const r of rivals) {
      const p = posAt(path, r.km);
      mk('circle', { class: r.self ? 'rv self' : 'rv', cx: X(p.lng), cy: Y(p.lat), r: 5 * unit, 'stroke-width': 1.5 * unit }, rivalsG);
      mk('text', { class: 'rvt', x: X(p.lng) + 8 * unit, y: Y(p.lat) - 6 * unit, 'font-size': 11 * unit, 'stroke-width': 3 * unit }, rivalsG).textContent = r.label;
    }
  }
  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => view(at)) : null;
  ro?.observe(el);
  return {
    kind: 'svg',
    place(km, transport) { meText.textContent = (transport && transport.emoji) || '📍'; draw(km); view(km); },
    frame(km) { draw(km); view(km); },
    settle(km) { draw(km); view(km); },
    setMode(m) { mode = m; view(at); },
    setRivals(list) { rivals = list; paintRivals(); },
    destroy() { ro?.disconnect(); svg.remove(); note.remove(); },
  };
}

// ---------------- Podloge: Reljef i Satelit ----------------
const NAME = ['coalesce', ['get', 'name:hr'], ['get', 'name:latin'], ['get', 'name']];
const FONT = ['Noto Sans Regular'];
let bordersP = null;
/** Granice država (Natural Earth, public/granice.json) — za isticanje države u kojoj je igrač. */
function loadBorders() {
  if (!bordersP) bordersP = fetch('/granice.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return bordersP;
}
const EMPTY = { type: 'FeatureCollection', features: [] };
function activeFeatures(borders, code) {
  const f = borders?.features.find((x) => x.properties.code === code);
  if (!f) return { active: EMPTY, mask: EMPTY };
  // maska = cijeli svijet s „rupom“ u obliku aktivne države → ostatak se lagano zatamni
  const holes = f.geometry.coordinates.map((poly) => poly[0]);
  return { active: { type: 'FeatureCollection', features: [f] }, mask: { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], ...holes.map((r) => [...r].reverse())] } }] } };
}
/** Slojevi isticanja države; `below` = id sloja ispod kojeg idu (voda prekriva rub uz obalu, pa je rub točan). */
function countryLayers(mode) {
  const sat = mode === 'satelit';
  return [
    // Satelit: ostale države se zatamne. Reljef: ostale države izblijede (svijetla koprena), aktivna ostaje u punim bojama.
    { id: 'zemlja-maska', type: 'fill', source: 'zemlja-maska', paint: { 'fill-color': sat ? '#000' : '#ffffff', 'fill-opacity': sat ? 0.32 : 0.42 } },
    ...(sat ? [{ id: 'zemlja-ispuna', type: 'fill', source: 'zemlja', paint: { 'fill-color': '#2fbf71', 'fill-opacity': 0.07 } }] : []),
    ...(sat ? [] : [{ id: 'zemlja-rub', type: 'line', source: 'zemlja', paint: { 'line-color': '#1f5f3a', 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.2, 10, 2.6], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.75, 7.5, 0.45, 9.5, 0.15], 'line-blur': 0.6 } }]),   // izbliza rub Natural Earth granice blijedi, a ispunu točno reže sloj vode
  ];
}
const labelLayers = (sat) => [
  { id: 'granice-drzava', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
    paint: { 'line-color': sat ? '#ffffff' : '#4b3b5c', 'line-opacity': sat ? 0.7 : 0.75, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.8, 10, 1.6], 'line-dasharray': [3, 2] } },
  { id: 'mjesta', type: 'symbol', source: 'omt', 'source-layer': 'place', minzoom: 6.2, filter: ['match', ['get', 'class'], ['city', 'town'], true, false],
    layout: { 'text-field': NAME, 'text-font': FONT, 'text-size': ['interpolate', ['linear'], ['zoom'], 6, 10, 10, 13], 'text-max-width': 8, 'symbol-sort-key': ['get', 'rank'] },
    paint: { 'text-color': sat ? '#f3f6f4' : '#1d2428', 'text-halo-color': sat ? 'rgba(0,0,0,.85)' : 'rgba(255,255,255,.8)', 'text-halo-width': 1.4 } },
  { id: 'drzave', type: 'symbol', source: 'omt', 'source-layer': 'place', maxzoom: 8, filter: ['==', ['get', 'class'], 'country'],
    layout: { 'text-field': ['upcase', NAME], 'text-font': FONT, 'text-size': 11, 'text-letter-spacing': 0.25 },
    paint: { 'text-color': sat ? '#e7efe9' : '#3a3040', 'text-halo-color': sat ? 'rgba(0,0,0,.8)' : 'rgba(255,255,255,.7)', 'text-halo-width': 1.2 } },
];
/** Ugrađeni tamni reljef: OpenFreeMap vektori + sjenčanje terena iz visinskog modela (DEM). */
function reliefStyle(cfg, m) {
  return {
    version: 8, glyphs: cfg.glyphs,
    sources: { omt: { type: 'vector', url: cfg.vector }, dem: { type: 'raster-dem', tiles: m.dem.tiles, encoding: m.dem.encoding, tileSize: m.dem.tileSize, maxzoom: m.dem.maxzoom } },
    layers: [
      // klasični hipsometrijski reljef: nizine zelene, brda žućkasta, planine smeđe, vrhovi svijetli; more plavo
      { id: 'podloga', type: 'background', paint: { 'background-color': '#8fb27a' } },
      { id: 'visine', type: 'color-relief', source: 'dem', paint: { 'color-relief-opacity': 1, 'color-relief-color': ['interpolate', ['linear'], ['elevation'], -50, '#7fae6a', 0, '#86b46c', 150, '#9cbf74', 300, '#b9c97f', 500, '#d6d08c', 800, '#d2b97a', 1100, '#bf9a66', 1500, '#a57d58', 1900, '#8c6a50', 2400, '#ece6dc'] } },
      { id: 'suma', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'wood'], paint: { 'fill-color': '#2f6b2a', 'fill-opacity': 0.18 } },
      { id: 'teren', type: 'hillshade', source: 'dem', paint: { 'hillshade-shadow-color': '#3b2f22', 'hillshade-highlight-color': '#fffaf0', 'hillshade-accent-color': '#5a4a38', 'hillshade-exaggeration': 0.55 } },
      { id: '__drzava__', type: 'background', paint: { 'background-opacity': 0 } },     // mjesto za isticanje države
      { id: 'voda', type: 'fill', source: 'omt', 'source-layer': 'water', filter: ['!=', ['get', 'brunnel'], 'tunnel'], paint: { 'fill-color': '#5b9bd5' } },
      { id: 'rijeke', type: 'line', source: 'omt', 'source-layer': 'waterway', minzoom: 6, paint: { 'line-color': '#4a8cc9', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.6, 12, 2] } },
      { id: 'ceste', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 6, filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], true, false], paint: { 'line-color': '#ffffff', 'line-opacity': 0.45, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 12, 2] } },
      ...labelLayers(false),
    ],
  };
}
function satelliteStyle(cfg, m) {
  return {
    version: 8, glyphs: cfg.glyphs,
    sources: { sat: { type: 'raster', tiles: m.tiles, tileSize: m.tileSize, maxzoom: m.maxzoom }, omt: { type: 'vector', url: cfg.vector } },
    layers: [
      { id: 'podloga', type: 'background', paint: { 'background-color': '#0b1014' } },
      { id: 'satelit', type: 'raster', source: 'sat', paint: { 'raster-saturation': -0.08, 'raster-contrast': 0.06, 'raster-brightness-max': 0.95, 'raster-fade-duration': 150 } },
      { id: 'zatamni', type: 'background', paint: { 'background-color': '#05080b', 'background-opacity': cfg.dim ?? 0.18 } },
      { id: '__drzava__', type: 'background', paint: { 'background-opacity': 0 } },
      ...labelLayers(true),
    ],
  };
}
/** Odabir stila za način prikaza. Vraća { style, mode, attribution, restyle }. */
export function styleFor(spec) {
  if (typeof spec === 'string' || !spec?.cfg) {               // stari način: naziv ili URL stila
    const s = typeof spec === 'string' ? spec : spec?.legacy;
    return { style: STYLES[s] || (/^https:\/\//.test(s || '') ? s : STYLES.tamna), mode: 'tamna', attribution: s === 'osm' ? [] : [OSM_ATTR], restyle: true };
  }
  const { cfg } = spec;
  const mode = cfg.modes[spec.mode] ? spec.mode : cfg.default_mode;
  const m = cfg.modes[mode];
  if (m.kind === 'style') return { style: m.url, mode, attribution: m.attribution || [], restyle: false };
  return { style: mode === 'satelit' ? satelliteStyle(cfg, m) : reliefStyle(cfg, m), mode, attribution: m.attribution || [] };
}

// ---------------- MapLibre (prava karta) ----------------
function glImpl(el, route, path, spec, onReady, onFail) {
  const gl = window.maplibregl;
  const holder = document.createElement('div');
  const chosen = styleFor(spec);
  holder.className = 'map-gl mode-' + chosen.mode;
  el.prepend(holder);
  const bounds = (fromKm, toKm) => { const b = new gl.LngLatBounds(); for (const c of slice(path, fromKm, toKm)) b.extend(c); return b; };
  let map;
  try {
    map = new gl.Map({ container: holder, style: chosen.style, bounds: bounds(0, route.total_km), fitBoundsOptions: { padding: 48 }, attributionControl: false, dragRotate: false, pitchWithRotate: false, touchPitch: false, maxZoom: 12, minZoom: 4.5, fadeDuration: 150 });
  } catch { holder.remove(); onFail(); return null; }
  map.addControl(new gl.AttributionControl({ compact: true, customAttribution: chosen.attribution }), 'bottom-left');
  map.touchZoomRotate.disableRotation();
  let ready = false, dead = false, mode = 'follow', at = 0, lastDone = -1, country = null, borders = null;
  const FOLLOW_ZOOM = 8.4;
  const pad = () => { const m = Math.round(Math.min(el.clientWidth, el.clientHeight) * 0.14); return { top: m + 34, bottom: m + 30, left: m, right: m }; };
  const marker = document.createElement('div'); marker.className = 'mk-me'; marker.append(emojiNode(null));
  const me = new gl.Marker({ element: marker, anchor: 'center' });
  const stops = [], rivals = [], segs = segmentsOf(route);
  const fail = setTimeout(() => { if (!ready && !dead) { api.destroy(); onFail(); } }, 12000);

  function restyle() {
    // Stari tamni stil (rezervni): mirna podloga, manje oznaka. Ugrađeni Reljef/Satelit već su složeni za igru.
    if (!chosen.restyle || typeof chosen.style !== 'string' || !/dark/.test(chosen.style)) return;
    for (const l of map.getStyle().layers || []) {
      try {
        const id = l.id.toLowerCase();
        if (l.type === 'background') map.setPaintProperty(l.id, 'background-color', C.bg);
        else if (l.type === 'fill' && /water|ocean|sea/.test(id)) map.setPaintProperty(l.id, 'fill-color', C.water);
        else if (l.type === 'line' && /road|highway|bridge|tunnel|rail|aeroway|transport/.test(id)) map.setPaintProperty(l.id, 'line-opacity', 0.28);
        else if (l.type === 'symbol' && /poi|shield|housenum|airport|road|highway|ferry/.test(id)) map.setLayoutProperty(l.id, 'visibility', 'none');
      } catch { /* sloj nema to svojstvo */ }
    }
  }
  /** Ističe državu u kojoj je igrač (mijenja se pri prelasku granice). */
  function setCountry(code) {
    if (!ready || !borders || code === country) return;
    country = code;
    const f = activeFeatures(borders, code);
    map.getSource('zemlja')?.setData(f.active);
    map.getSource('zemlja-maska')?.setData(f.mask);
  }
  const lineData = (coords) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords.length > 1 ? coords : [coords[0], coords[0]] } });
  const drawDone = (km) => {
    if (!ready) return;
    setCountry(countryAt(route, km));
    if (Math.abs(km - lastDone) < 0.05) return;
    lastDone = km;
    map.getSource('ruta-done')?.setData({ type: 'FeatureCollection', features: segs.filter((sg) => km > sg.from).map((sg) => ({ type: 'Feature', properties: { color: sg.color }, geometry: { type: 'LineString', coordinates: slice(path, sg.from, Math.min(km, sg.to)) } })) });
    for (const s of stops) s.el.classList.toggle('passed', s.km <= km + 1e-6);
  };
  const follow = (km, zoom, animate) => {
    const p = posAt(path, km);
    if (animate) map.easeTo({ center: [p.lng, p.lat], zoom, duration: 700 }); else map.jumpTo({ center: [p.lng, p.lat], zoom });
  };
  const overview = (animate = true) => {
    const b = bounds(0, Math.max(route.total_km, Math.min(route.end_km, at + 60)));
    map.fitBounds(b, { padding: pad(), duration: animate && !reduced() ? 800 : 0, maxZoom: 9 });
  };

  map.on('load', async () => {
    if (dead) return;
    restyle();
    // Isticanje države: ispod vode (ugrađeni stilovi imaju sloj-oznaku), inače ispod rute
    borders = await loadBorders();
    if (dead) return;
    clearTimeout(fail);
    if (borders) {
      map.addSource('zemlja', { type: 'geojson', data: EMPTY });
      map.addSource('zemlja-maska', { type: 'geojson', data: EMPTY });
      const anchor = map.getLayer('__drzava__') ? map.getStyle().layers[map.getStyle().layers.findIndex((l) => l.id === '__drzava__') + 1]?.id : undefined;
      for (const l of countryLayers(chosen.mode)) map.addLayer(l, anchor);
    }
    const layer = (id, coords, paint, extra = {}) => {
      map.addSource(id, { type: 'geojson', data: lineData(coords) });
      map.addLayer({ id, type: 'line', source: id, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint, ...extra });
    };
    const sat = chosen.mode === 'satelit';
    layer('ruta-casing', slice(path, 0, route.end_km), { 'line-color': C.casing, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, sat ? 6 : 5, 10, sat ? 13 : 11], 'line-opacity': sat ? 0.9 : 0.85 });
    layer('ruta-main', slice(path, 0, route.total_km), { 'line-color': C.road, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.6, 10, 3], 'line-opacity': sat ? 0.9 : 0.75, 'line-dasharray': [0.2, 2.2] });
    if (route.end_km > route.total_km) layer('ruta-ext', slice(path, route.total_km, route.end_km), { 'line-color': C.ext, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.6, 10, 3], 'line-opacity': 0.85, 'line-dasharray': [0.2, 2.2] });
    layer('ruta-done', slice(path, 0, 0), { 'line-color': ['coalesce', ['get', 'color'], C.done], 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 3.2, 10, 6] });
    route.points.forEach((p, i) => {
      if (!p.is_stop) return;
      const kind = stopKind(route, p, i);
      const node = document.createElement('div');
      node.className = 'mk-stop ' + kind;
      const dot = document.createElement('i'), name = document.createElement('span');
      name.textContent = kind === 'border' ? 'granica' : p.name;
      node.append(dot, name);
      node.title = p.nickname ? `${p.name} — ${p.nickname}` : p.name;
      stops.push({ el: node, km: p.km, m: new gl.Marker({ element: node, anchor: 'left', offset: [-6, 0] }).setLngLat([p.lng, p.lat]).addTo(map) });
    });
    const zoomClass = () => holder.classList.toggle('far', map.getZoom() < 7.1);
    map.on('zoom', zoomClass); zoomClass();
    me.setLngLat([0, 0]).addTo(map);
    holder.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
    ready = true;
    onReady();
  });
  map.on('error', () => { /* pojedinačne pločice smiju zakazati; karta ostaje */ });
  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { try { map.resize(); } catch { /* uklonjeno */ } }) : null;
  ro?.observe(el);

  const api = {
    kind: 'maplibre', mode: chosen.mode, map,
    place(km, transport) {
      at = km;
      marker.replaceChildren(emojiNode(transport));
      const p = posAt(path, km);
      me.setLngLat([p.lng, p.lat]);
      lastDone = -1; drawDone(km);
      if (mode === 'follow' && km > 0) follow(km, FOLLOW_ZOOM, false); else overview(false);
    },
    /** Jedan kadar putovanja: `t` = 0..1 napredak animacije, `dist` = duljina skoka u km. */
    frame(km, t, dist) {
      at = km;
      const p = posAt(path, km);
      me.setLngLat([p.lng, p.lat]);
      drawDone(km);
      if (mode !== 'follow') return;
      const dip = clamp(Math.log2(Math.max(1, dist) / 30), 0, 3) * 0.55;      // dulji skok = kamera se više odmakne
      map.jumpTo({ center: [p.lng, p.lat], zoom: FOLLOW_ZOOM - dip * Math.sin(Math.PI * t) });
    },
    settle(km) { at = km; drawDone(km); if (mode === 'follow') follow(km, FOLLOW_ZOOM, !reduced()); else overview(); },
    setMode(m) { mode = m; if (!ready) return; if (m === 'follow' && at > 0) follow(at, FOLLOW_ZOOM, !reduced()); else overview(); },
    setRivals(list) {
      for (const r of rivals.splice(0)) r.remove();
      for (const r of list) {
        const node = document.createElement('div');
        node.className = 'mk-rival' + (r.self ? ' self' : '') + (r.sign ? ' has-sign' : '');
        if (r.sign) {
          const sg = document.createElement('div');
          sg.className = 'ps-sign mini ' + (r.sign.shape || 'zeleni');
          sg.textContent = r.sign.text;
          node.append(sg);
        }
        const lab = document.createElement('span'); lab.textContent = r.label; node.append(lab);
        const p = posAt(path, r.km);
        rivals.push(new gl.Marker({ element: node, anchor: 'bottom-left' }).setLngLat([p.lng, p.lat]).addTo(map));
      }
    },
    destroy() { dead = true; clearTimeout(fail); ro?.disconnect(); try { map.remove(); } catch { /* već uklonjeno */ } holder.remove(); },
  };
  return api;
}

/**
 * @param el        spremnik karte
 * @param route     ruta iz /api/map/:slug (točke s virtualnim kilometrima, goal_index, total_km, end_km)
 * @param spec      { cfg: konfiguracija karte s poslužitelja, mode: 'reljef' | 'satelit' } ili stari naziv/URL stila
 * @returns {{ setMe, travel, setMode, setView, setRivals, kind, view, destroy }}
 */
export function createRouteMap(el, route, spec, { onKind } = {}) {
  el.classList.add('map');
  const path = buildPath(route);
  const state = { km: 0, transport: null, mode: 'follow', rivals: [] };
  let impl = svgImpl(el, route, path), raf = 0, destroyed = false;
  impl.place(0, null);
  onKind?.('svg');
  let current = spec, pending = null, triedFallback = false;
  /** Učitava pravu kartu za zadani stil; nova karta zamijeni staru tek kad je spremna (bez treptanja). */
  function mount(s) {
    loadMapLibre().then((ok) => {
      if (!ok || destroyed) return;
      pending?.destroy?.();
      const real = glImpl(el, route, path, s, () => {
        if (destroyed || pending !== real) return real.destroy();
        pending = null;
        impl.destroy();
        impl = real;
        impl.setMode(state.mode);
        impl.place(state.km, state.transport);
        impl.setRivals(state.rivals);
        el.classList.add('is-real');
        onKind?.('maplibre', real.mode);
      }, () => {
        // pružatelj nije odgovorio: jednom probaj rezervnu (dosadašnju tamnu) kartu, inače ostaje shema
        if (pending === real) pending = null;
        if (!triedFallback && s?.cfg && !destroyed) { triedFallback = true; mount(s.cfg.fallback || 'tamna'); }
      });
      pending = real;
    });
  }
  mount(spec);
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
  const api = {
    get kind() { return impl.kind; },
    get km() { return state.km; },
    /** Postavlja položaj bez animacije. */
    setMe(km, transport) { stop(); state.km = km; state.transport = transport || null; impl.place(km, state.transport); },
    /**
     * Animirano putovanje od trenutnog položaja do `km`: marker klizi po ruti, prijeđeni dio se iscrtava,
     * kamera prati i na duljim skokovima se odmakne pa vrati. `onProgress(km)` služi za brojač kilometara.
     */
    travel(km, transport, { onProgress, onDone, onArrive, onStart } = {}) {
      stop();
      const from = state.km, dist = Math.abs(km - from);
      state.km = km; state.transport = transport || state.transport;
      if (reduced() || dist < 0.5) { impl.place(km, state.transport); onProgress?.(km); if (km > from) for (const p of route.points) if (p.is_stop && p.km > from + 1e-6 && p.km <= km + 1e-6) onArrive?.(p); onDone?.(); return; }
      impl.place(from, state.transport);
      const ms = clamp(1500 + dist * 11, 1700, 5200);
      onStart?.(ms);
      const ahead = route.points.filter((p) => p.is_stop && p.km > from + 1e-6 && p.km <= km + 1e-6);   // postaje koje će ovaj skok prijeći
      let t0 = null;
      const tick = (ts) => {
        if (destroyed) return;
        if (t0 === null) t0 = ts;
        const t = Math.min(1, (ts - t0) / ms), now = from + (km - from) * ease(t);
        impl.frame(now, t, dist);
        onProgress?.(now);
        while (ahead.length && ahead[0].km <= now + 1e-6) onArrive?.(ahead.shift());
        if (t < 1) raf = requestAnimationFrame(tick);
        else { raf = 0; impl.settle(km); onProgress?.(km); onDone?.(); }
      };
      raf = requestAnimationFrame(tick);
    },
    /** 'follow' = kamera prati igrača, 'overview' = cijela ruta. */
    setMode(mode) { state.mode = mode; impl.setMode(mode); },
    setRivals(list) { state.rivals = list; impl.setRivals(list); },
    /** Promjena podloge (Reljef / Satelit) bez gubitka položaja, rute i suparnika. */
    setView(mode) { if (!current?.cfg || current.mode === mode) return; current = { ...current, mode }; triedFallback = false; mount(current); },
    get view() { return impl.mode || current?.mode || null; },
    destroy() { destroyed = true; stop(); pending?.destroy?.(); impl.destroy(); el.classList.remove('map', 'is-real'); },
  };
  return api;
}
