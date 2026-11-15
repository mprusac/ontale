// Zastave kao SVG. Windows ne prikazuje emoji zastave (umjesto 🇭🇷 ispiše "HR"), pa ih crtamo sami.
// Pojednostavljeni prikazi u omjeru 3:2; grbovi su svedeni na osnovni oblik.
const NS = 'http://www.w3.org/2000/svg';
const bands = (colors, vertical) => colors.map((c, i) => (vertical
  ? `<rect x="${(30 / colors.length) * i}" width="${30 / colors.length}" height="20" fill="${c}"/>`
  : `<rect y="${(20 / colors.length) * i}" width="30" height="${20 / colors.length}" fill="${c}"/>`)).join('');
function checker() {
  let out = '<path d="M11.5 5.5h7v6.2a3.5 3.5 0 0 1-7 0z" fill="#fff"/>';
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if ((r + c) % 2 === 0) out += `<rect x="${11.5 + c * 1.4}" y="${5.5 + r * 1.4}" width="1.4" height="1.4" fill="#e1251b"/>`;
  return `<clipPath id="zs"><path d="M11.5 5.5h7v6.2a3.5 3.5 0 0 1-7 0z"/></clipPath><g clip-path="url(#zs)">${out}</g><path d="M11.5 5.5h7v6.2a3.5 3.5 0 0 1-7 0z" fill="none" stroke="#b01a13" stroke-width=".4"/>`;
}
const star = (x, y) => `<path transform="translate(${x} ${y}) scale(.95)" d="M0-1.4.33-.45h1L.52.14l.31.96L0 .5l-.83.6.31-.96-.81-.59h1z" fill="#fff"/>`;
const FLAGS = {
  hr: () => bands(['#e1251b', '#fff', '#1f3f95']) + checker(),
  ba: () => `<rect width="30" height="20" fill="#0f2f8f"/><path d="M8 0h16v20z" fill="#fecb00"/>${[0, 1, 2, 3, 4, 5, 6].map((i) => star(6.2 + i * 2.67, 1.2 + i * 3.33)).join('')}`,
  me: () => '<rect width="30" height="20" fill="#d4af37"/><rect x="1.2" y="1.2" width="27.6" height="17.6" fill="#c8102e"/><path d="M15 5.2c1.2 1.1 3.6 1.3 4.6.6-.2 2.6-.9 4.3-1.7 5.2l1 3-2.6-1-1.3 1.6-1.3-1.6-2.6 1 1-3c-.8-.9-1.5-2.6-1.7-5.2 1 .7 3.4.5 4.6-.6z" fill="#d4af37"/><circle cx="15" cy="10" r="1.5" fill="#1d5e91"/>',
  rs: () => bands(['#c6363c', '#0c4076', '#fff']),
  si: () => bands(['#fff', '#0057b8', '#ed1c24']) + '<path d="M5 3h5v4a2.5 2.5 0 0 1-5 0z" fill="#0057b8" stroke="#ed1c24" stroke-width=".5"/>',
  hu: () => bands(['#ce2939', '#fff', '#477050']),
  it: () => bands(['#009246', '#fff', '#ce2b37'], true),
  al: () => '<rect width="30" height="20" fill="#e41e20"/><path d="M15 5l2 2 3-1-2 3 2 2-3 1-2 3-2-3-3-1 2-2-2-3 3 1z" fill="#111"/>',
};
/** Oznaka države iz emoji zastave ("🇭🇷" → "hr"); ako nije emoji zastava, vraća null. */
export function codeFromEmoji(s) {
  const cps = [...String(s || '')].map((ch) => ch.codePointAt(0)).filter((cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff);
  return cps.length === 2 ? cps.map((cp) => String.fromCharCode(cp - 0x1f1e6 + 97)).join('') : null;
}
/** SVG zastava za oznaku države ili emoji; nepoznata država dobiva pločicu s oznakom. */
export function flag(codeOrEmoji, title) {
  const code = (codeFromEmoji(codeOrEmoji) || String(codeOrEmoji || '')).toLowerCase();
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 30 20'); svg.setAttribute('class', 'flag');
  if (title) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', title); } else svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = FLAGS[code] ? FLAGS[code]() : `<rect width="30" height="20" fill="#2a3542"/><text x="15" y="14" text-anchor="middle" font-size="9" font-weight="800" fill="#eef2f5" font-family="Overpass, sans-serif">${code.slice(0, 2).toUpperCase().replace(/[^A-Z]/g, '')}</text>`;
  return svg;
}
