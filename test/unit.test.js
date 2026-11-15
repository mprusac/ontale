// Jedinični testovi čiste logike: normalizacija, prepoznavanje, rijetkost, procjene, niz dana, vrijeme.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, editDistance, parseNumber, gameDate, nextReset, addDays } from '../src/util.js';
import { buildIndex, matchOpen, computeRarity, levelForRarity, scoreNumeric, closestGuesses, computeStreak } from '../src/scoring.js';

test('normalizacija: velika slova, dijakritika, interpunkcija, razmaci', () => {
  assert.equal(normalize('  Čilić '), 'cilic');
  assert.equal(normalize('CILIC'), 'cilic');
  assert.equal(normalize('Novak Đoković'), normalize('novak djokovic'));
  assert.equal(normalize('Man. United'), 'man united');
  assert.equal(normalize("N'Golo Kanté"), 'ngolo kante');
  assert.equal(normalize('Saint-Étienne'), 'saint etienne');
  assert.equal(normalize('Thomas Müller'), 'thomas muller');
  assert.equal(normalize('Robert Lewandowski'), normalize('ROBERT   LEWANDOWSKI'));
  assert.equal(normalize('Łukasz Kubot'), 'lukasz kubot');
});

test('normalizacija: klupski prefiksi se zanemaruju, ali ne ostavljaju prazan odgovor', () => {
  assert.equal(normalize('FC Barcelona'), 'barcelona');
  assert.equal(normalize('NK Osijek'), normalize('Osijek'));
  assert.equal(normalize('AC Milan'), 'milan');
  assert.equal(normalize('FC'), 'fc');
});

test('udaljenost uređivanja (Damerau–Levenshtein)', () => {
  assert.equal(editDistance('safin', 'safin'), 0);
  assert.equal(editDistance('safin', 'saffin'), 1);
  assert.equal(editDistance('ivanisevic', 'ivanisevci'), 1); // zamjena susjednih slova
  assert.ok(editDistance('austrija', 'australija', 2) >= 2);
});

const people = [
  { id: 1, canonical: 'Marin Čilić', norm: normalize('Marin Čilić'), aliases: [] },
  { id: 2, canonical: 'Marat Safin', norm: normalize('Marat Safin'), aliases: [] },
  { id: 3, canonical: 'Michael Schumacher', norm: normalize('Michael Schumacher'), aliases: ['Schumi'] },
  { id: 4, canonical: 'Ralf Schumacher', norm: normalize('Ralf Schumacher'), aliases: [] },
  { id: 5, canonical: 'Ruud van Nistelrooy', norm: normalize('Ruud van Nistelrooy'), aliases: [] },
  { id: 6, canonical: 'Ronaldo', norm: 'ronaldo', aliases: ['Ronaldo Nazário', 'R9'] },
  { id: 7, canonical: 'Cristiano Ronaldo', norm: 'cristiano ronaldo', aliases: ['CR7', 'Ronaldo'] },
];
const pIndex = buildIndex(people, 'person');

test('prepoznavanje: prezime, puno ime, obrnuti redoslijed, alias, inicijal', () => {
  assert.equal(matchOpen(pIndex, 'Cilic').answerId, 1);
  assert.equal(matchOpen(pIndex, 'ČILIĆ').answerId, 1);
  assert.equal(matchOpen(pIndex, 'Safin').answerId, 2);
  assert.equal(matchOpen(pIndex, 'Marat Safin').answerId, 2);
  assert.equal(matchOpen(pIndex, 'Safin Marat').answerId, 2);
  assert.equal(matchOpen(pIndex, 'M. Safin').answerId, 2);
  assert.equal(matchOpen(pIndex, 'schumi').answerId, 3);
  assert.equal(matchOpen(pIndex, 'van Nistelrooy').answerId, 5);
  assert.equal(matchOpen(pIndex, 'Nistelrooy').answerId, 5);
});

test('prepoznavanje: sitni tipfeler se prihvaća, drugo ime ne', () => {
  assert.equal(matchOpen(pIndex, 'Saffin').answerId, 2);
  assert.equal(matchOpen(pIndex, 'Marin Cilc').answerId, 1);
  assert.equal(matchOpen(pIndex, 'Nistelroy').answerId, 5);
  assert.equal(matchOpen(pIndex, 'Sampras').status, 'none');
  assert.equal(matchOpen(pIndex, 'Marin').status, 'none');
  assert.equal(matchOpen(pIndex, '').status, 'none');
});

test('prepoznavanje: isto prezime kod dvaju odgovora traži pojašnjenje', () => {
  assert.equal(matchOpen(pIndex, 'Schumacher').status, 'ambiguous');
  assert.equal(matchOpen(pIndex, 'Michael Schumacher').answerId, 3);
  assert.equal(matchOpen(pIndex, 'R. Schumacher').answerId, 4);
  assert.equal(matchOpen(pIndex, 'Ronaldo').status, 'ambiguous');
  assert.equal(matchOpen(pIndex, 'Cristiano Ronaldo').answerId, 7);
  assert.equal(matchOpen(pIndex, 'CR7').answerId, 7);
});

test('prepoznavanje: slični, ali različiti pojmovi se NE spajaju', () => {
  const idx = buildIndex([
    { id: 1, canonical: 'Austrija', norm: 'austrija', aliases: ['Austria'] },
    { id: 2, canonical: 'Slovenija', norm: 'slovenija', aliases: ['Slovenia'] },
    { id: 3, canonical: 'Schalke 04', norm: 'schalke 04', aliases: [] },
    { id: 4, canonical: 'Manchester United', norm: 'manchester united', aliases: ['Man United', 'Man Utd'] },
    { id: 5, canonical: 'Iran', norm: 'iran', aliases: [] },
  ], 'team');
  assert.equal(matchOpen(idx, 'Australija').status, 'none');
  assert.equal(matchOpen(idx, 'Australia').status, 'none');
  assert.equal(matchOpen(idx, 'Slovačka').status, 'none');
  assert.equal(matchOpen(idx, 'Slovakia').status, 'none');
  assert.equal(matchOpen(idx, 'Irak').status, 'none');
  assert.equal(matchOpen(idx, 'Schalke 05').status, 'none');
  assert.equal(matchOpen(idx, 'Manchester City').status, 'none');
  assert.equal(matchOpen(idx, 'Man. United').answerId, 4);
  assert.equal(matchOpen(idx, 'manchester utd').status, 'none'); // nije alias ni tipfeler — mora u bazu ili kroz prijavu
  assert.equal(matchOpen(idx, 'Mancester United').answerId, 4);
  assert.equal(matchOpen(idx, 'United').status, 'none');          // za klubove nema izvedenih ključeva
});

const answers = [
  { id: 1, prior_popularity: 100 }, { id: 2, prior_popularity: 100 }, { id: 3, prior_popularity: 55 },
  { id: 4, prior_popularity: 28 }, { id: 5, prior_popularity: 13 }, { id: 6, prior_popularity: 5 }, { id: 7, prior_popularity: 2 },
];
const transports = [12, 30, 54, 84, 120, 150, 220].map((km, i) => ({ level: i + 1, km, min_rarity: [0, 30, 48, 63, 76, 87, 95][i] }));

test('rijetkost: početna procjena daje smislen poredak i raspon razina', () => {
  const t = computeRarity(answers, new Map(), { priorStrength: 40 });
  const r = answers.map((a) => t.get(a.id).rarity);
  for (let i = 1; i < r.length; i++) assert.ok(r[i] >= r[i - 1], 'rjeđi odgovor ne smije imati manju rijetkost');
  assert.equal(levelForRarity(r[0], transports).level, 1);
  assert.ok(levelForRarity(r[6], transports).level >= 6);
  assert.ok(r[6] <= 100 && r[0] >= 0);
});

test('rijetkost: nekoliko prvih odgovora ne može poremetiti bodovanje', () => {
  const before = computeRarity(answers, new Map(), { priorStrength: 40 });
  const after = computeRarity(answers, new Map([[7, 2]]), { priorStrength: 40 }); // dva igrača odmah daju najrjeđi odgovor
  assert.ok(levelForRarity(after.get(7).rarity, transports).level >= levelForRarity(before.get(7).rarity, transports).level - 1);
  assert.equal(levelForRarity(after.get(1).rarity, transports).level, 1);
});

test('rijetkost: stvarni igrači s vremenom nadjačaju početnu procjenu', () => {
  const freq = new Map([[7, 400], [1, 5]]); // "rijedak" odgovor zapravo svi daju
  const t = computeRarity(answers, freq, { priorStrength: 40 });
  assert.equal(levelForRarity(t.get(7).rarity, transports).level, 1);
  assert.ok(t.get(1).rarity > t.get(7).rarity);
  assert.equal(t.total, 405);
});

test('rijetkost: K je podesiv, ručna rijetkost ima prednost, jedan odgovor ne ruši račun', () => {
  const freq = new Map([[7, 30]]);
  const weak = computeRarity(answers, freq, { priorStrength: 5 }).get(7).rarity;
  const strong = computeRarity(answers, freq, { priorStrength: 500 }).get(7).rarity;
  assert.ok(strong > weak);
  const manual = computeRarity([{ id: 1, prior_popularity: 100, manual_rarity: 99 }, { id: 2, prior_popularity: 1 }], new Map());
  assert.equal(manual.get(1).rarity, 99);
  const single = computeRarity([{ id: 1, prior_popularity: 10 }], new Map());
  assert.ok(Number.isFinite(single.get(1).rarity));
});

test('rijetkost: dva igrača s istim odgovorom smanjuju njegovu rijetkost', () => {
  const a = computeRarity(answers, new Map([[5, 1]]), { priorStrength: 10 }).get(5).rarity;
  const b = computeRarity(answers, new Map([[5, 6]]), { priorStrength: 10 }).get(5).rarity;
  assert.ok(b < a);
});

test('procjene: pogreška, tolerancija i pragovi', () => {
  const target = { value: 1000, tolerance_pct: 1 };
  assert.equal(scoreNumeric(target, 1000).level, 7);
  assert.equal(scoreNumeric(target, 1009).level, 7);
  assert.equal(scoreNumeric(target, 1020).level, 6);
  assert.equal(scoreNumeric(target, 950).level, 5);
  assert.equal(scoreNumeric(target, 1100).level, 4);
  assert.equal(scoreNumeric(target, 800).level, 3);
  assert.equal(scoreNumeric(target, 1400).level, 2);
  assert.equal(scoreNumeric(target, 400).level, 1);
  assert.equal(scoreNumeric(target, 5000).level, 0);
  const s = scoreNumeric(target, 900);
  assert.equal(s.absError, 100);
  assert.equal(Math.round(s.errorPct), 10);
  assert.equal(scoreNumeric(target, 900, [{ max_pct: 15, level: 7 }]).level, 7);
});

test('procjene: dvije jednako udaljene procjene', () => {
  const g = [{ id: 1, absError: 50, created_at: '2026-01-01T10:00:00Z' }, { id: 2, absError: 50, created_at: '2026-01-01T09:00:00Z' }, { id: 3, absError: 70, created_at: '2026-01-01T08:00:00Z' }];
  assert.deepEqual(closestGuesses(g, 'dijele').sort(), [1, 2]);
  assert.deepEqual(closestGuesses(g, 'raniji'), [2]);
  assert.deepEqual(closestGuesses([], 'dijele'), []);
});

test('čitanje brojeva u hrvatskom i engleskom zapisu', () => {
  assert.equal(parseNumber('1055'), 1055);
  assert.equal(parseNumber('1.055'), 1055);
  assert.equal(parseNumber('1 055'), 1055);
  assert.equal(parseNumber('42.184'), 42184);
  assert.equal(parseNumber('38,5'), 38.5);
  assert.equal(parseNumber('1.234.567,5'), 1234567.5);
  assert.equal(parseNumber('1,234,567'), 1234567);
  assert.equal(parseNumber('41,5 mil'), 41500000);
  assert.equal(parseNumber('30 milijuna'), 30000000);
  assert.equal(parseNumber('42k'), 42000);
  assert.equal(parseNumber('3.5'), 3.5);
  assert.equal(parseNumber('puno'), null);
  assert.equal(parseNumber(''), null);
});

test('niz dana', () => {
  assert.deepEqual(computeStreak([], '2026-11-13'), { current: 0, best: 0, days: 0, last: null });
  const s = computeStreak(['2026-11-09', '2026-11-10', '2026-11-12', '2026-11-13'], '2026-11-13');
  assert.equal(s.current, 2); assert.equal(s.best, 2); assert.equal(s.days, 4);
  assert.equal(computeStreak(['2026-11-10', '2026-11-11', '2026-11-12'], '2026-11-13').current, 3); // jučer igrao — niz još živi
  assert.equal(computeStreak(['2026-11-10', '2026-11-11'], '2026-11-13').current, 0);              // preskočen dan
  assert.equal(computeStreak(['2026-10-31', '2026-11-01'], '2026-11-01').current, 2);              // prijelaz mjeseca
});

test('datum igre prati ponoć u Zagrebu, i ljeti i zimi', () => {
  assert.equal(gameDate(new Date('2026-11-13T22:59:00Z')), '2026-11-13'); // 23:59 CET
  assert.equal(gameDate(new Date('2026-11-13T23:00:00Z')), '2026-11-14'); // 00:00 CET
  assert.equal(gameDate(new Date('2026-07-01T21:59:00Z')), '2026-07-01'); // 23:59 CEST
  assert.equal(gameDate(new Date('2026-07-01T22:00:00Z')), '2026-07-02'); // 00:00 CEST
  assert.equal(gameDate(new Date('2026-11-13T23:30:00Z'), 'Europe/Zagreb', '06:00'), '2026-11-13'); // reset u 6 ujutro
  assert.equal(nextReset(new Date('2026-11-13T12:00:00Z')), '2026-11-13T23:00:00.000Z');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});
