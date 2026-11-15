// Kartografske podloge: Reljef (teren) i Satelit. Ključevi pružatelja stižu iz okoline (.env), nikad iz koda.
// Vidi docs/MAP_PROVIDERS.md za usporedbu pružatelja, cijene, licence i upute za ključeve.

export const MAP_DEFAULTS = {
  default_mode: 'reljef',          // 'reljef' | 'satelit'
  provider: 'auto',                // 'auto' | 'maptiler' | 'stadia' | 'besplatno' | 'prilagodeno'
  terrain_style_url: '',           // vlastiti MapLibre stil za Reljef (prazno = ugrađeni tamni reljef)
  satellite_url: '',               // vlastiti predložak satelitskih pločica {z}/{x}/{y} ili URL MapLibre stila
  attribution: '',                 // dodatna atribucija (uz obaveznu atribuciju pružatelja)
  eox_noncommercial: false,        // Sentinel-2 cloudless (EOX) — dopušteno samo za NEkomercijalnu uporabu
  fallback_style: 'tamna',         // ako ništa drugo ne radi: dosadašnja tamna OpenFreeMap karta
  satellite_dim: 0.18,             // zatamnjenje satelita (0–0.6) radi čitljivosti rute
};

const OSM = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
const OFM = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a>';
const TERRAIN_AWS = 'Teren: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Mapzen Terrain Tiles</a> (SRTM, EU-DEM © Copernicus i dr.)';
const NE = 'Granice: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>';

/** Javna konfiguracija za preglednik. `env` = { MAPTILER_KEY, STADIA_API_KEY }. */
export function mapConfig(settings, env = process.env) {
  const s = { ...MAP_DEFAULTS, ...settings.get('map', {}) };
  const mt = (env.MAPTILER_KEY || '').trim(), st = (env.STADIA_API_KEY || '').trim();
  let provider = s.provider;
  if (provider === 'auto') provider = mt ? 'maptiler' : st ? 'stadia' : 'besplatno';
  const extra = s.attribution ? [s.attribution.replace(/[<>]/g, '')] : [];

  // ----- Reljef -----
  let reljef;
  if (s.terrain_style_url && /^https:\/\//.test(s.terrain_style_url)) reljef = { kind: 'style', url: s.terrain_style_url, attribution: extra };
  else if (provider === 'maptiler' && mt) reljef = { kind: 'builtin', dem: { tiles: [`https://api.maptiler.com/tiles/terrain-rgb-v2/{z}/{x}/{y}.webp?key=${mt}`], encoding: 'mapbox', tileSize: 512, maxzoom: 12 }, attribution: [OFM, OSM, '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">© MapTiler</a>', NE, ...extra] };
  else reljef = { kind: 'builtin', dem: { tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], encoding: 'terrarium', tileSize: 256, maxzoom: 12 }, attribution: [OFM, OSM, TERRAIN_AWS, NE, ...extra] };

  // ----- Satelit -----
  let satelit = null;
  if (provider === 'maptiler' && mt) satelit = { kind: 'raster', tiles: [`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${mt}`], tileSize: 512, maxzoom: 20, attribution: ['<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">© MapTiler</a>', OFM, OSM, NE, ...extra] };
  else if (provider === 'stadia' && st) satelit = { kind: 'raster', tiles: [`https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}@2x.jpg?api_key=${st}`], tileSize: 256, maxzoom: 20, attribution: ['© <a href="https://stadiamaps.com/" target="_blank" rel="noopener">Stadia Maps</a>', '© <a href="https://www.cnes.fr/" target="_blank" rel="noopener">CNES, Distribution Airbus DS</a>, © Airbus DS, © PlanetObserver (Contains Copernicus Data)', OFM, OSM, NE, ...extra] };
  else if (provider === 'prilagodeno' && /^https:\/\//.test(s.satellite_url)) satelit = /\{z\}/.test(s.satellite_url) ? { kind: 'raster', tiles: [s.satellite_url], tileSize: 256, maxzoom: 19, attribution: [OFM, OSM, NE, ...extra] } : { kind: 'style', url: s.satellite_url, attribution: extra };
  else if (s.eox_noncommercial) satelit = { kind: 'raster', tiles: ['https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/{z}/{y}/{x}.jpg'], tileSize: 256, maxzoom: 14, attribution: ['<a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless — s2maps.eu</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2023)', OFM, OSM, NE, ...extra], noncommercial: true };

  const modes = { reljef, ...(satelit ? { satelit } : {}) };
  const def = modes[s.default_mode] ? s.default_mode : 'reljef';
  return { provider, default_mode: def, modes, dim: Math.max(0, Math.min(0.6, Number(s.satellite_dim) || 0)), fallback: s.fallback_style || 'tamna', vector: 'https://tiles.openfreemap.org/planet', glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf' };
}

/** Domene koje Content-Security-Policy mora dopustiti za odabrane podloge. */
export function mapCspHosts(cfg) {
  const hosts = new Set(['https://tiles.openfreemap.org', 'https://*.openfreemap.org', 'https://*.openstreetmap.org', 'https://s3.amazonaws.com']);
  for (const m of Object.values(cfg.modes)) for (const u of [...(m.tiles || []), ...(m.dem?.tiles || []), m.url].filter(Boolean)) { try { hosts.add(new URL(u.replace(/\{[a-z]\}/g, '0')).origin); } catch { /* neispravan URL */ } }
  return [...hosts].join(' ');
}
/** Pregled za administraciju (bez otkrivanja ključeva). */
export function mapAdminInfo(settings, env = process.env) {
  const c = mapConfig(settings, env);
  return { settings: { ...MAP_DEFAULTS, ...settings.get('map', {}) }, active_provider: c.provider, modes: Object.keys(c.modes),
    keys: { MAPTILER_KEY: !!(env.MAPTILER_KEY || '').trim(), STADIA_API_KEY: !!(env.STADIA_API_KEY || '').trim() },
    satellite_noncommercial: !!c.modes.satelit?.noncommercial };
}
