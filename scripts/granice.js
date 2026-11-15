// Pretvara scripts/granice-raw.txt (kompaktni delta zapis) u public/granice.json (GeoJSON).
// Izvor: Natural Earth 1:10m Admin 0 – Countries (javno dobro / public domain), pojednostavljeno (Douglas–Peucker, 0,0012°),
// koordinate na 4 decimale. Zapis: država:prsten;prsten|poligon#država… ; točke „dx,dy“ u desettisućinkama stupnja.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const raw = fs.readFileSync(path.join(root, 'scripts', 'granice-raw.txt'), 'utf8').trim();
const features = raw.split('#').map((f) => {
  const [code, g] = f.split(':');
  const coordinates = g.split('|').map((poly) => poly.split(';').map((ring) => {
    let x = 0, y = 0;
    return ring.trim().split(' ').map((p) => { const [dx, dy] = p.split(',').map(Number); x += dx; y += dy; return [x / 1e4, y / 1e4]; });
  }));
  return { type: 'Feature', properties: { code }, geometry: { type: 'MultiPolygon', coordinates } };
});
const out = { type: 'FeatureCollection', source: 'Natural Earth 1:10m Admin 0 (public domain), pojednostavljeno', features };
fs.writeFileSync(path.join(root, 'public', 'granice.json'), JSON.stringify(out));
console.log('public/granice.json:', features.map((f) => f.properties.code).join(', '), fs.statSync(path.join(root, 'public', 'granice.json')).size, 'B');
