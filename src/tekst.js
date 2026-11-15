// Provjera korisničkog teksta (poruke, putokazi): čišćenje, poveznice, psovke.
// Sav se tekst u pregledniku prikazuje kao čisti tekst (textContent), a ovdje se dodatno uklanjaju kontrolni znakovi.
import { bad } from './util.js';

// Korijeni psovki i uvreda (hr/bs/sr + najčešće engleske). Uspoređuje se s početkom svake riječi nakon normalizacije,
// pa „jebote“, „pi*ka“, „k u r a c“ i „kuuurac“ padaju, a „Jelena“, „kurs“ ili „pickup“ ne.
const ROOTS = ['jeb', 'pizd', 'picka', 'picku', 'picke', 'picki', 'pickom', 'pickin', 'pickic', 'kurac', 'kurca', 'kurcu', 'kurcem', 'kurcin', 'kurv',
  'drolj', 'peder', 'pedercin', 'seronj', 'govnar', 'smece od', 'sisaj', 'fuck', 'motherf', 'shit', 'bitch', 'cunt', 'nigg', 'faggot', 'retard', 'ustase', 'cetnic'];

/** Normalizacija za usporedbu: mala slova, bez dijakritike, leetspeak, ponovljena slova sažeta. */
export function looseNorm(s) {
  let t = String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  t = t.replace(/[0@4]/g, (c) => ({ 0: 'o', '@': 'a', 4: 'a' }[c])).replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/[5$]/g, 's').replace(/7/g, 't');
  t = t.replace(/[^a-z\s]/g, '').replace(/(.)\1{2,}/g, '$1').replace(/(.)\1/g, '$1');
  return t;
}
/** Vraća pronađeni korijen ili null. `extra` = dodatne riječi iz administracije. */
export function profanity(text, extra = []) {
  const n = looseNorm(text);
  const words = n.split(/\s+/).filter(Boolean);
  const joined = n.replace(/\s+/g, '');                     // „k u r a c“ → „kurac“
  const roots = [...ROOTS, ...extra.map(looseNorm).filter((x) => x.length >= 3)].map((r) => r.replace(/(.)\1/g, '$1'));
  for (const r of roots) {
    const compact = r.replace(/\s+/g, '');
    if (r.includes(' ') ? n.includes(r) : words.some((w) => w.startsWith(compact))) return r;
    // razmaknuta slova: svaka „riječ“ je jedno slovo
    if (compact.length >= 4 && words.length >= compact.length && words.every((w) => w.length <= 2) && joined.includes(compact)) return r;
  }
  return null;
}

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]{2,}\s?(\.|\[\.\]|\(dot\)|\s+dot\s+)\s?(com|net|org|hr|ba|rs|me|eu|io|ly|gg|info|xyz|link|app|tv|co)\b|@[a-z0-9_]{3,}\b|\b\d{3}[\s/-]?\d{3}[\s/-]?\d{3,4}\b)/i;
export const hasLink = (s) => LINK.test(String(s || ''));

/** Uklanja kontrolne i nevidljive znakove, sažima razmake. */
export function cleanText(s, { multiline = false } = {}) {
  let t = String(s ?? '').normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁠-⁯﻿]/g, '');
  t = multiline ? t.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') : t.replace(/\s+/g, ' ');
  return t.trim();
}
const graphemes = (s) => [...new Intl.Segmenter('hr', { granularity: 'grapheme' }).segment(s)].length;

/** Provjera javnog kratkog teksta (putokaz): duljina, poveznice, psovke, „vikanje“. */
export function checkPublicText(raw, { max = 60, min = 1, extra = [] } = {}) {
  const t = cleanText(raw);
  const n = graphemes(t);
  if (n < min) throw bad('Poruka je prazna.');
  if (n > max) throw bad(`Poruka može imati najviše ${max} znakova.`);
  if (hasLink(t)) throw bad('Poveznice, adrese i brojevi telefona nisu dopušteni.');
  if (profanity(t, extra)) throw bad('Poruka sadrži nedopuštene riječi.');
  if (/(.)\1{7,}/u.test(t)) throw bad('Previše ponovljenih znakova.');
  const letters = t.replace(/[^\p{L}]/gu, '');
  if (letters.length >= 12 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) return t.charAt(0) + t.slice(1).toLowerCase();   // bez vikanja
  return t;
}
/** Provjera privatne poruke: duljina i kontrolni znakovi; poveznice su dopuštene (prikazuju se kao tekst). */
export function checkPrivateText(raw, { max = 1000 } = {}) {
  const t = cleanText(raw, { multiline: true });
  if (!t) throw bad('Poruka je prazna.');
  if (graphemes(t) > max) throw bad(`Poruka može imati najviše ${max} znakova.`);
  return t;
}
