// Provjera početnog sadržaja: deset pitanja dnevno, raspodjela po kategorijama, izvori, baze odgovora i prepoznavanje.
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';
import { seedBase, seedQuestions, loadQuestions, expandQuestion, validateQuestion } from '../seed/seed.js';
import { matchOpen } from '../src/scoring.js';

const questions = await loadQuestions();

const DAYS = Math.max(...questions.map((q) => q.dan));

test('deset pitanja dnevno: propisana raspodjela kategorija, bez ponavljanja', () => {
  assert.ok(DAYS >= 10, 'najmanje deset dana sadržaja');
  assert.equal(questions.length, DAYS * 10);
  for (let day = 1; day <= DAYS; day++) {
    const list = questions.filter((q) => q.dan === day).sort((a, b) => a.poz - b.poz);
    assert.deepEqual(list.map((q) => q.poz), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], `dan ${day}`);
    assert.deepEqual(list.slice(0, 8).map((q) => q.cat), ['nogomet', 'nogomet', 'kosarka', 'rukomet', 'tenis', 'formula-1', 'borilacki', 'procjene'], `dan ${day}`);
    assert.equal(list[7].type, 'numeric'); assert.equal(list[9].type, 'numeric', `dan ${day}: deseto pitanje je procjena`);
    assert.notEqual(list[8].type, 'numeric', `dan ${day}: deveto pitanje je otvoreno`);
    assert.notEqual(list[7].sport, list[9].sport, `dan ${day}: dvije procjene nisu iz istog sporta`);
  }
  assert.equal(new Set(questions.map((q) => q.text)).size, questions.length, 'nema ponovljenih pitanja');
});

test('svako pitanje ima izvore, napomenu o provjeri i bazu bez dvostrukih odgovora', () => {
  let answers = 0;
  for (const q of questions) {
    const ex = expandQuestion(q);
    const v = validateQuestion(q, ex);
    assert.deepEqual(v.errors, [], q.text);
    assert.ok(ex.sources.length >= 1 && ex.sources.every((s) => /^https:\/\//.test(s.url)), `izvor: ${q.text}`);
    assert.ok(q.provjera, `napomena o provjeri: ${q.text}`);
    assert.ok(q.hint, `pojašnjenje opsega: ${q.text}`);
    if (ex.type === 'open') {
      answers += ex.answers.length;
      assert.ok(ex.answers.length >= 11, `premalo odgovora (${ex.answers.length}): ${q.text}`);
      assert.ok(new Set(ex.answers.map((a) => a.prior_popularity)).size >= 3, `premalo razreda popularnosti: ${q.text}`);
    } else {
      assert.ok(ex.target.unit && ex.target.ref_date && Number.isFinite(ex.target.value), q.text);
    }
  }
  assert.ok(answers > 2500, `ukupno odgovora: ${answers}`);
  const open = questions.filter((q) => (q.type || 'open') === 'open');
  const sizes = open.map((q) => expandQuestion(q).answers.length);
  assert.ok(sizes.filter((n) => n >= 30).length >= 40, 'barem 40 pitanja ima 30+ odgovora');
});

test('seed u bazu + prepoznavanje stvarnih odgovora i rijetkost', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ontale-seed-'));
  const db = openDb(path.join(dir, 's.db'));
  const app = createApp({ db, dataDir: dir, rateLimitDisabled: true });
  try {
    seedBase(app.ctx);
    const report = seedQuestions(app.ctx, questions, '2026-11-13');
    assert.deepEqual(report.errors, []);
    assert.equal(report.days, DAYS); assert.deepEqual(report.warnings.filter((w) => /izazov ima/.test(w)), []);
    assert.equal(db.get('SELECT COUNT(*) AS n FROM daily_challenges').n, DAYS);
    assert.equal(db.get('SELECT COUNT(*) AS n FROM daily_challenge_questions').n, DAYS * 10);
    assert.equal(db.get('SELECT MIN(n) AS lo FROM (SELECT COUNT(*) AS n FROM daily_challenge_questions GROUP BY challenge_id)').lo, 10);
    assert.ok(db.get('SELECT COUNT(*) AS n FROM answer_sources').n >= DAYS * 16);
    const find = (text) => db.get('SELECT id FROM questions WHERE text LIKE ?', `%${text}%`).id;
    const check = (text, input, expected) => {
      const base = app.ctx.game.questionBase(find(text));
      const m = matchOpen(base.index, input);
      if (expected === null) return assert.notEqual(m.status, 'match', `${input} ne smije proći`);
      if (expected === '?') return assert.equal(m.status, 'ambiguous', `${input} treba pojašnjenje`);
      assert.equal(m.status, 'match', `"${input}" nije prepoznat u: ${text}`);
      assert.equal(base.byId.get(m.answerId).canonical, expected);
    };
    check('Grand Slam turnir u Open eri', 'cilic', 'Marin Čilić');
    check('Grand Slam turnir u Open eri', 'Djokovic', 'Novak Đoković');
    check('Grand Slam turnir u Open eri', 'SAFIN', 'Marat Safin');
    check('Grand Slam turnir u Open eri', 'Sampras Pete', 'Pete Sampras');
    check('Grand Slam turnir u Open eri', 'Marcelo Rios', null);
    check('finale Kupa prvaka', 'Man. United', 'Manchester United');
    check('finale Kupa prvaka', 'psg', 'Paris Saint-Germain');
    check('finale Kupa prvaka', 'FC Bayern', 'Bayern München');
    check('finale Kupa prvaka', 'Zvezda', 'Crvena zvezda');
    check('finale Kupa prvaka', 'Dinamo Zagreb', null);
    check('dobitnika Zlatne lopte', 'Ronaldo', '?');
    check('dobitnika Zlatne lopte', 'Cristiano Ronaldo', 'Cristiano Ronaldo');
    check('dobitnika Zlatne lopte', 'modric', 'Luka Modrić');
    check('pobijedio na utrci Formule 1.', 'Schumacher', '?');
    check('pobijedio na utrci Formule 1.', 'Ralf Schumacher', 'Ralf Schumacher');
    check('pobijedio na utrci Formule 1.', 'raikkonen', 'Kimi Räikkönen');
    check('medalju na Svjetskom prvenstvu u rukometu', 'Croatia', 'Hrvatska');
    check('medalju na Svjetskom prvenstvu u rukometu', 'Slovačka', 'Čehoslovačka');
    check('medalju na Svjetskom prvenstvu u rukometu', 'Island', null);
    check('svjetski prvak u teškoj kategoriji', 'Klitschko', '?');
    check('svjetski prvak u teškoj kategoriji', 'hrgovic', 'Filip Hrgović');
    check('svjetski prvak u teškoj kategoriji', 'Roy Jones', 'Roy Jones Jr.');
    check('svjetski prvak u teškoj kategoriji', 'Ruiz', '?');
    check('NBA naslov', 'Lakersi', 'Los Angeles Lakers');   // hrvatska množina prolazi kao tipfeler
    check('NBA naslov', 'lakers', 'Los Angeles Lakers');
    check('igrao u Prvoj HNL', 'Hajduk', 'Hajduk Split');
    check('igrao u Prvoj HNL', 'NK Varteks', 'Varaždin');
    // nova pitanja (pozicija 9)
    check('prvak Italije', 'AC Milan', 'Milan');
    check('prvak Italije', 'Verona', 'Hellas Verona');
    check('prvak Italije', 'Atalanta', null);
    check('prvak Jugoslavije u košarci', 'Split', 'Jugoplastika');
    check('prvak Jugoslavije u košarci', 'Šibenka', null);
    check('finale US Opena', 'del potro', 'Juan Martín del Potro');
    check('finale US Opena', 'Ivanišević', null);
    check('prvak Jugoslavije u nogometu', 'Dinamo', 'Dinamo Zagreb');
    check('prvak Jugoslavije u nogometu', 'Zeljo', 'Željezničar');
    check('igra u NBA ligi', 'sixers', 'Philadelphia 76ers');
    check('igra u NBA ligi', 'Seattle SuperSonics', null);
    check('prvak Njemačke u Bundesligi', 'Bayern', 'Bayern München');
    check('prvak Njemačke u Bundesligi', 'Schalke', null);
    check('Muhammad Ali', 'Foster', '?');
    check('Muhammad Ali', 'frazier', 'Joe Frazier');
    check('Muhammad Ali', 'Tyson', null);
    check('najboljeg strijelca nekog Svjetskog prvenstva', 'Müller', '?');
    check('najboljeg strijelca nekog Svjetskog prvenstva', 'suker', 'Davor Šuker');
    check('najboljeg strijelca nekog Svjetskog prvenstva', 'Messi', null);
    check('olimpijsko srebro u Barceloni', 'Kukoč', 'Toni Kukoč');
    check('olimpijsko srebro u Barceloni', 'Drazen', 'Dražen Petrović');
    // rijetkost: očiti odgovor vozi najkraće, opskurni najdalje
    const modes = app.ctx.game.transports().modes;
    const { levelForRarity } = await import('../src/scoring.js');
    const level = (text, canonical) => {
      const qid = find(text);
      const a = db.get('SELECT id FROM accepted_answers WHERE question_id = ? AND canonical = ?', qid, canonical);
      return levelForRarity(app.ctx.game.rarityTable(qid).get(a.id).rarity, modes).level;
    };
    assert.equal(level('Grand Slam turnir u Open eri', 'Novak Đoković'), 1);
    assert.ok(level('Grand Slam turnir u Open eri', 'Mark Edmondson') >= 6);
    assert.equal(level('finale Kupa prvaka', 'Real Madrid'), 1);
    assert.ok(level('finale Kupa prvaka', 'Malmö FF') >= 6);
    // raspon razina po pitanju: svako otvoreno pitanje nudi i kratku i dugu vožnju
    for (const q of db.all("SELECT q.id, q.text FROM questions q JOIN question_types t ON t.id = q.type_id WHERE t.slug = 'open'")) {
      const table = app.ctx.game.rarityTable(q.id);
      const levels = app.ctx.game.questionBase(q.id).answers.map((a) => levelForRarity(table.get(a.id).rarity, modes).level);
      assert.equal(Math.min(...levels), 1, `najčešći odgovor mora biti razina 1: ${q.text}`);
      assert.ok(Math.max(...levels) >= 5, `nema dovoljno rijetkih odgovora (${Math.max(...levels)}): ${q.text}`);
    }
  } finally { await app.close(); db.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
