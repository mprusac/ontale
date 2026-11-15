// Administracija: sve promjene idu kroz ovaj modul, provjeravaju se na serveru i bilježe u audit log.
import { nowIso, normalize, HttpError, bad, isDate, round1, addDays } from './util.js';
import { matchOpen, levelForRarity, scoreNumeric, DEFAULT_NUMERIC_THRESHOLDS } from './scoring.js';

const SETTING_KEYS = new Set(['game_name', 'tagline', 'logo_text', 'colors', 'messages', 'rules', 'privacy', 'terms', 'start_date', 'reset_time', 'timezone',
  'rarity', 'numeric_thresholds', 'guests_on_leaderboard', 'reactions', 'map_style', 'contact_email', 'game', 'countries']);

export function createAdmin(ctx) {
  const { db, settings, game, auth } = ctx;
  const touch = () => { ctx.version++; ctx.bumpBoards(); };
  function audit(admin, action, entity, entityId, detail) {
    db.run('INSERT INTO admin_audit_logs (admin_id, action, entity, entity_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      admin?.id ?? null, action, entity || null, entityId == null ? null : String(entityId), detail ? JSON.stringify(detail).slice(0, 4000) : null, nowIso());
  }
  const int = (v, d = 0) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : d);
  const str = (v, max = 500) => (v == null ? null : String(v).trim().slice(0, max) || null);
  const typeId = (slug) => db.get('SELECT id FROM question_types WHERE slug = ?', slug)?.id;
  const categoryId = (v) => (db.get('SELECT id FROM question_categories WHERE id = ? OR slug = ? OR name = ?', int(v, -1), String(v), String(v)))?.id;

  // ================= Nadzorna ploča =================
  function dashboard() {
    const today = game.today();
    const one = (sql, ...p) => db.get(sql, ...p);
    const sinceIso = new Date(Date.now() - 24 * 3600000).toISOString();
    return {
      date: today,
      users: one('SELECT COUNT(*) AS n FROM users WHERE is_guest = 0').n,
      guests: one('SELECT COUNT(*) AS n FROM users WHERE is_guest = 1').n,
      active_today: one(`SELECT COUNT(DISTINCT s.user_id) AS n FROM game_sessions s JOIN daily_challenges c ON c.id = s.challenge_id WHERE c.date = ?`, today).n,
      seen_24h: one('SELECT COUNT(*) AS n FROM users WHERE last_seen_at >= ?', sinceIso).n,
      games_today: one(`SELECT COUNT(*) AS n FROM game_sessions s JOIN daily_challenges c ON c.id = s.challenge_id WHERE c.date = ? AND s.official = 1 AND s.finished_at IS NOT NULL`, today).n,
      games_total: one('SELECT COUNT(*) AS n FROM game_sessions WHERE official = 1 AND finished_at IS NOT NULL').n,
      leagues: one('SELECT COUNT(*) AS n FROM leagues l WHERE (SELECT COUNT(*) FROM league_members m WHERE m.league_id = l.id) > 1').n,
      leagues_all: one('SELECT COUNT(*) AS n FROM leagues').n,
      avg_km: round1(one('SELECT AVG(total_km) AS a FROM game_sessions WHERE official = 1 AND finished_at IS NOT NULL').a || 0),
      avg_km_today: round1(one(`SELECT AVG(s.total_km) AS a FROM game_sessions s JOIN daily_challenges c ON c.id = s.challenge_id WHERE c.date = ? AND s.official = 1 AND s.finished_at IS NOT NULL`, today).a || 0),
      goals: one('SELECT COALESCE(SUM(reached_goal),0) AS n FROM game_sessions WHERE official = 1 AND finished_at IS NOT NULL').n,
      goals_today: one(`SELECT COALESCE(SUM(s.reached_goal),0) AS n FROM game_sessions s JOIN daily_challenges c ON c.id = s.challenge_id WHERE c.date = ? AND s.official = 1`, today).n,
      pending_reports: one("SELECT COUNT(*) AS n FROM answer_reports WHERE status = 'novo'").n,
      pending_content: one("SELECT COUNT(*) AS n FROM content_reports WHERE status = 'novo'").n,
      categories: db.all(`SELECT c.name, c.emoji, COUNT(*) AS answers, ROUND(AVG(pa.km), 1) AS avg_km, ROUND(100.0 * SUM(pa.is_correct) / COUNT(*)) AS accuracy
                          FROM player_answers pa JOIN game_sessions s ON s.id = pa.session_id JOIN questions q ON q.id = pa.question_id
                          JOIN question_categories c ON c.id = q.category_id WHERE s.official = 1 GROUP BY c.id ORDER BY avg_km DESC`),
      common: db.all(`SELECT a.canonical, q.text AS question, f.players FROM answer_frequency f JOIN accepted_answers a ON a.id = f.answer_id
                      JOIN questions q ON q.id = f.question_id WHERE f.players > 0 ORDER BY f.players DESC LIMIT 10`),
      rare: db.all(`SELECT a.canonical, q.text AS question, f.players FROM answer_frequency f JOIN accepted_answers a ON a.id = f.answer_id
                    JOIN questions q ON q.id = f.question_id WHERE f.players > 0 ORDER BY f.players ASC, f.rowid DESC LIMIT 10`),
      upcoming: db.all(`SELECT c.date, c.scope, c.active, (SELECT COUNT(*) FROM daily_challenge_questions x WHERE x.challenge_id = c.id) AS questions
                        FROM daily_challenges c WHERE c.date >= ? ORDER BY c.date LIMIT 14`, today),
      days_scheduled_ahead: one('SELECT COUNT(DISTINCT date) AS n FROM daily_challenges WHERE date >= ? AND active = 1', today).n,
    };
  }

  // ================= Kategorije =================
  const categories = () => db.all('SELECT * FROM question_categories ORDER BY sort_order, id');
  function saveCategory(admin, id, b) {
    const f = { slug: str(b.slug, 40) || normalize(b.name).replace(/ /g, '-'), name: str(b.name, 60), emoji: str(b.emoji, 8), sort_order: int(b.sort_order), active: b.active === false || b.active === 0 ? 0 : 1 };
    if (!f.name) throw bad('Naziv kategorije je obavezan.');
    if (id) db.run('UPDATE question_categories SET slug = ?, name = ?, emoji = ?, sort_order = ?, active = ? WHERE id = ?', f.slug, f.name, f.emoji, f.sort_order, f.active, id);
    else id = db.run('INSERT INTO question_categories (slug, name, emoji, sort_order, active) VALUES (?, ?, ?, ?, ?)', f.slug, f.name, f.emoji, f.sort_order, f.active).id;
    audit(admin, 'spremi', 'kategorija', id, f); touch();
    return { id };
  }

  // ================= Pitanja =================
  function listQuestions({ q, category, type, active, scheduled, page }) {
    const where = [], params = [];
    if (q) { where.push('(q.text LIKE ? OR q.id = ?)'); params.push(`%${q}%`, int(q, -1)); }
    if (category) { where.push('q.category_id = ?'); params.push(int(category)); }
    if (type) { where.push('t.slug = ?'); params.push(type); }
    if (active === '1' || active === '0') { where.push('q.active = ?'); params.push(int(active)); }
    if (scheduled === '0') where.push('NOT EXISTS (SELECT 1 FROM daily_challenge_questions d WHERE d.question_id = q.id)');
    if (scheduled === '1') where.push('EXISTS (SELECT 1 FROM daily_challenge_questions d WHERE d.question_id = q.id)');
    const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const total = db.get(`SELECT COUNT(*) AS n FROM questions q JOIN question_types t ON t.id = q.type_id ${w}`, ...params).n;
    const size = 50, offset = Math.max(0, int(page, 1) - 1) * size;
    const rows = db.all(`SELECT q.id, q.text, q.difficulty, q.active, q.answer_kind, q.sport_tag, t.slug AS type, c.name AS category, c.emoji,
                                (SELECT COUNT(*) FROM accepted_answers a WHERE a.question_id = q.id AND a.active = 1) AS answers,
                                (SELECT GROUP_CONCAT(dc.date, ', ') FROM daily_challenge_questions d JOIN daily_challenges dc ON dc.id = d.challenge_id WHERE d.question_id = q.id) AS dates,
                                (SELECT COUNT(*) FROM answer_reports r WHERE r.question_id = q.id AND r.status = 'novo') AS reports
                         FROM questions q JOIN question_types t ON t.id = q.type_id JOIN question_categories c ON c.id = q.category_id
                         ${w} ORDER BY q.id DESC LIMIT ? OFFSET ?`, ...params, size, offset);
    return { rows, total, page: int(page, 1), pages: Math.ceil(total / size) };
  }

  function getQuestion(id) {
    const q = db.get(`SELECT q.*, t.slug AS type, c.name AS category FROM questions q JOIN question_types t ON t.id = q.type_id
                      JOIN question_categories c ON c.id = q.category_id WHERE q.id = ?`, id);
    if (!q) throw new HttpError(404, 'Pitanje ne postoji.');
    const out = { ...q, sources: db.all('SELECT * FROM answer_sources WHERE question_id = ? AND answer_id IS NULL ORDER BY id', id),
      dates: db.all(`SELECT dc.id AS challenge_id, dc.date, d.position FROM daily_challenge_questions d JOIN daily_challenges dc ON dc.id = d.challenge_id WHERE d.question_id = ? ORDER BY dc.date`, id) };
    if (q.type === 'numeric') {
      out.target = game.numericTarget(id) || null;
      out.default_thresholds = settings.get('numeric_thresholds', DEFAULT_NUMERIC_THRESHOLDS);
    } else {
      const table = game.rarityTable(id);
      const modes = game.transports().modes;
      const aliases = db.all('SELECT al.* FROM answer_aliases al JOIN accepted_answers a ON a.id = al.answer_id WHERE a.question_id = ? ORDER BY al.id', id);
      const srcs = db.all('SELECT * FROM answer_sources WHERE question_id = ? AND answer_id IS NOT NULL', id);
      out.answers = db.all('SELECT * FROM accepted_answers WHERE question_id = ? ORDER BY prior_popularity DESC, canonical', id).map((a) => {
        const r = table.get(a.id);
        return { ...a, aliases: aliases.filter((x) => x.answer_id === a.id).map((x) => x.alias), sources: srcs.filter((s) => s.answer_id === a.id),
          players: r?.players || 0, share: r ? round1(r.share * 100) : null, rarity: r ? Math.round(r.rarity) : null, computed_rarity: r ? Math.round(r.computed) : null,
          level: r ? levelForRarity(r.rarity, modes)?.level : null };
      });
      out.total_votes = table.total;
      out.effective_answers = round1(table.effective);
      out.default_prior_strength = settings.get('rarity', {}).prior_strength ?? 200;
    }
    return out;
  }

  function writeAnswer(questionId, a, checkedAt) {
    const canonical = str(a.canonical, 120);
    if (!canonical) throw bad('Kanonski naziv odgovora je obavezan.');
    const norm = normalize(canonical);
    if (!norm) throw bad(`Odgovor "${canonical}" nema čitljivih znakova.`);
    const id = db.run(`INSERT INTO accepted_answers (question_id, canonical, norm, explanation, prior_popularity, manual_rarity, checked_at, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      questionId, canonical, norm, str(a.explanation, 400), Math.max(0.1, Number(a.prior_popularity) || 10), a.manual_rarity == null || a.manual_rarity === '' ? null : Number(a.manual_rarity), a.checked_at || checkedAt).id;
    writeAliases(id, a.aliases, norm);
    for (const s of a.sources || []) db.run('INSERT INTO answer_sources (question_id, answer_id, title, url, note) VALUES (?, ?, ?, ?, ?)', questionId, id, str(s.title, 200) || 'Izvor', str(s.url, 500), str(s.note, 300));
    return id;
  }
  function writeAliases(answerId, aliases, ownNorm) {
    db.run('DELETE FROM answer_aliases WHERE answer_id = ?', answerId);
    const seen = new Set([ownNorm]);
    for (const al of aliases || []) {
      const alias = str(al, 120), n = normalize(alias);
      if (!alias || !n || seen.has(n)) continue;
      seen.add(n);
      db.run('INSERT INTO answer_aliases (answer_id, alias, norm) VALUES (?, ?, ?)', answerId, alias, n);
    }
  }

  function saveQuestion(admin, id, b) {
    return db.tx(() => {
      const existing = id ? db.get('SELECT q.*, t.slug AS type FROM questions q JOIN question_types t ON t.id = q.type_id WHERE q.id = ?', id) : null;
      if (id && !existing) throw new HttpError(404, 'Pitanje ne postoji.');
      const type = b.type || existing?.type || 'open';
      if (!['open', 'numeric'].includes(type)) throw bad('Vrsta pitanja mora biti "open" ili "numeric".');
      const cat = b.category_id != null || b.category != null ? categoryId(b.category_id ?? b.category) : existing?.category_id;
      if (!cat) throw bad('Odaberi kategoriju.');
      const text = b.text !== undefined ? str(b.text, 500) : existing?.text;
      if (!text) throw bad('Tekst pitanja je obavezan.');
      const f = {
        category_id: cat, type_id: typeId(type), text,
        hint: b.hint !== undefined ? str(b.hint, 500) : existing?.hint ?? null,
        answer_kind: ['person', 'team', 'country', 'other'].includes(b.answer_kind) ? b.answer_kind : existing?.answer_kind || 'other',
        sport_tag: b.sport_tag !== undefined ? str(b.sport_tag, 40) : existing?.sport_tag ?? null,
        difficulty: Math.min(5, Math.max(1, int(b.difficulty ?? existing?.difficulty ?? 3, 3))),
        prior_strength: b.prior_strength === undefined ? existing?.prior_strength ?? null : (b.prior_strength === null || b.prior_strength === '' ? null : Math.max(0, Number(b.prior_strength))),
        verification: b.verification !== undefined ? str(b.verification, 500) : existing?.verification ?? null,
        active: b.active === undefined ? existing?.active ?? 1 : (b.active ? 1 : 0),
      };
      if (id) {
        db.run(`UPDATE questions SET category_id = ?, type_id = ?, text = ?, hint = ?, answer_kind = ?, sport_tag = ?, difficulty = ?, prior_strength = ?, verification = ?, active = ?, updated_at = ? WHERE id = ?`,
          f.category_id, f.type_id, f.text, f.hint, f.answer_kind, f.sport_tag, f.difficulty, f.prior_strength, f.verification, f.active, nowIso(), id);
      } else {
        id = db.run(`INSERT INTO questions (category_id, type_id, text, hint, answer_kind, sport_tag, difficulty, prior_strength, verification, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          f.category_id, f.type_id, f.text, f.hint, f.answer_kind, f.sport_tag, f.difficulty, f.prior_strength, f.verification, f.active, nowIso(), nowIso()).id;
      }
      if (type === 'numeric' && b.target) saveTarget(admin, id, b.target);
      if (type === 'numeric' && !game.numericTarget(id)) throw bad('Procjena mora imati referentnu vrijednost, jedinicu i datum.');
      const today = game.today();
      if (Array.isArray(b.answers)) for (const a of b.answers) writeAnswer(id, typeof a === 'string' ? { canonical: a } : a, today);
      if (Array.isArray(b.sources)) for (const s of b.sources) db.run('INSERT INTO answer_sources (question_id, title, url, note) VALUES (?, ?, ?, ?)', id, str(s.title, 200) || 'Izvor', str(s.url, 500), str(s.note, 300));
      audit(admin, existing ? 'uredi' : 'dodaj', 'pitanje', id, { text: f.text, type });
      touch();
      return { id };
    });
  }

  function saveTarget(admin, questionId, t) {
    const old = game.numericTarget(questionId);
    const value = Number(t.value ?? old?.value);
    if (!Number.isFinite(value)) throw bad('Referentna vrijednost mora biti broj.');
    const unit = str(t.unit ?? old?.unit, 40);
    const ref = t.ref_date ?? old?.ref_date;
    if (!unit) throw bad('Jedinica je obavezna.');
    if (!isDate(ref)) throw bad('Referentni datum je obavezan (GGGG-MM-DD).');
    let thresholds = t.thresholds !== undefined ? t.thresholds : (old?.thresholds_json ? JSON.parse(old.thresholds_json) : null);
    if (thresholds && (!Array.isArray(thresholds) || thresholds.some((x) => !(x.max_pct > 0) || !(x.level >= 1 && x.level <= 7)))) throw bad('Pragovi moraju biti popis {max_pct, level}.');
    const mode = t.scoring_mode ?? old?.scoring_mode ?? 'pragovi';
    const tie = t.tie_rule ?? old?.tie_rule ?? 'dijele';
    if (!['pragovi', 'pragovi+najblizi'].includes(mode) || !['dijele', 'raniji'].includes(tie)) throw bad('Nepoznat način bodovanja.');
    db.run(`INSERT INTO numeric_targets (question_id, value, unit, ref_date, tolerance_pct, scoring_mode, thresholds_json, tie_rule, is_estimate, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(question_id) DO UPDATE SET value = excluded.value, unit = excluded.unit, ref_date = excluded.ref_date, tolerance_pct = excluded.tolerance_pct,
              scoring_mode = excluded.scoring_mode, thresholds_json = excluded.thresholds_json, tie_rule = excluded.tie_rule, is_estimate = excluded.is_estimate, note = excluded.note`,
      questionId, value, unit, ref, Math.max(0, Number(t.tolerance_pct ?? old?.tolerance_pct ?? 1)), mode, thresholds ? JSON.stringify(thresholds) : null, tie,
      (t.is_estimate ?? old?.is_estimate) ? 1 : 0, t.note !== undefined ? str(t.note, 500) : old?.note ?? null);
    if (old && old.value !== value) audit(admin, 'ispravak-vrijednosti', 'procjena', questionId, { staro: old.value, novo: value, razlog: str(t.reason, 300) });
    touch();
  }

  function deleteQuestion(admin, id) {
    if (db.get('SELECT 1 AS x FROM daily_challenge_questions WHERE question_id = ?', id)) throw new HttpError(409, 'Pitanje je dio dnevnog izazova. Makni ga iz izazova ili ga deaktiviraj.');
    if (db.get('SELECT 1 AS x FROM player_answers WHERE question_id = ?', id)) throw new HttpError(409, 'Na pitanje su već odgovarali igrači. Deaktiviraj ga umjesto brisanja.');
    const q = db.get('SELECT text FROM questions WHERE id = ?', id);
    db.run('DELETE FROM questions WHERE id = ?', id);
    audit(admin, 'obrisi', 'pitanje', id, q); touch();
    return { ok: true };
  }

  function copyQuestion(admin, id) {
    const q = getQuestion(id);
    return saveQuestion(admin, null, {
      ...q, text: q.text + ' (kopija)', category_id: q.category_id, active: 0,
      target: q.target ? { ...q.target, thresholds: q.target.thresholds_json ? JSON.parse(q.target.thresholds_json) : null } : undefined,
      answers: (q.answers || []).map((a) => ({ canonical: a.canonical, aliases: a.aliases, explanation: a.explanation, prior_popularity: a.prior_popularity, manual_rarity: a.manual_rarity, checked_at: a.checked_at, sources: a.sources })),
      sources: q.sources,
    });
  }

  function bulkQuestions(admin, { ids, patch }) {
    if (!Array.isArray(ids) || !ids.length || !patch) throw bad('Odaberi pitanja i izmjenu.');
    return db.tx(() => {
      let n = 0;
      for (const id of ids.map(Number)) {
        if (patch.delete) { try { deleteQuestion(admin, id); n++; } catch { /* preskoči korištena */ } continue; }
        const sets = [], params = [];
        if (patch.active !== undefined) { sets.push('active = ?'); params.push(patch.active ? 1 : 0); }
        if (patch.category_id) { sets.push('category_id = ?'); params.push(categoryId(patch.category_id)); }
        if (patch.difficulty) { sets.push('difficulty = ?'); params.push(Math.min(5, Math.max(1, int(patch.difficulty, 3)))); }
        if (patch.prior_strength !== undefined) { sets.push('prior_strength = ?'); params.push(patch.prior_strength === null ? null : Number(patch.prior_strength)); }
        if (!sets.length) continue;
        n += db.run(`UPDATE questions SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`, ...params, nowIso(), id).changes;
      }
      audit(admin, 'masovno', 'pitanje', null, { ids, patch }); touch();
      return { changed: n };
    });
  }

  // ---------- Uvoz (JSON / CSV) ----------
  function parseCsv(text) {
    const delim = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some((c) => c.trim() !== '')) rows.push(row);
        row = [];
      } else cell += ch;
    }
    row.push(cell);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    const head = rows.shift().map((h) => normalize(h).replace(/ /g, '_'));
    return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
  }
  /**
   * CSV stupci: kategorija; vrsta (open|numeric); tekst; pojasnjenje; vrsta_odgovora; tezina;
   *   odgovori ("Marin Čilić=Cilic=Čila|Goran Ivanišević" — | dijeli odgovore, = dijeli aliase);
   *   vrijednost; jedinica; datum; tolerancija; izvor_naziv; izvor_url
   * JSON: popis objekata istog oblika kao u seed datotekama (vidi README).
   */
  function importQuestions(admin, { format, data }) {
    let items;
    try {
      items = format === 'csv' ? parseCsv(String(data || '').replace(/^﻿/, '')).map((r) => ({
        category: r.kategorija, type: r.vrsta || 'open', text: r.tekst, hint: r.pojasnjenje, answer_kind: r.vrsta_odgovora || 'other', difficulty: r.tezina || 3,
        answers: (r.odgovori || '').split('|').map((x) => x.trim()).filter(Boolean).map((x) => { const [canonical, ...aliases] = x.split('=').map((y) => y.trim()); return { canonical, aliases }; }),
        target: r.vrijednost ? { value: Number(String(r.vrijednost).replace(',', '.')), unit: r.jedinica, ref_date: r.datum, tolerance_pct: r.tolerancija ? Number(String(r.tolerancija).replace(',', '.')) : 1 } : undefined,
        sources: r.izvor_naziv || r.izvor_url ? [{ title: r.izvor_naziv || r.izvor_url, url: r.izvor_url }] : [],
      })) : (typeof data === 'string' ? JSON.parse(data) : data);
    } catch (e) { throw bad('Datoteka se ne može pročitati: ' + e.message); }
    if (!Array.isArray(items)) throw bad('Očekujem popis pitanja.');
    const errors = [], ids = [];
    db.tx(() => {
      items.forEach((it, i) => {
        try { ids.push(db.tx(() => saveQuestion(admin, null, { ...it, active: it.active ?? 0 })).id); }
        catch (e) { errors.push({ row: i + 1, text: it?.text, error: e.message }); }
      });
    });
    audit(admin, 'uvoz', 'pitanje', null, { imported: ids.length, errors: errors.length });
    return { imported: ids.length, ids, errors };
  }

  // ---------- Baza odgovora ----------
  function addAnswer(admin, questionId, b) {
    if (!db.get('SELECT 1 AS x FROM questions WHERE id = ?', questionId)) throw new HttpError(404, 'Pitanje ne postoji.');
    if (db.get('SELECT 1 AS x FROM accepted_answers WHERE question_id = ? AND norm = ?', questionId, normalize(b.canonical))) throw new HttpError(409, 'Taj odgovor već postoji u bazi.');
    const id = db.tx(() => writeAnswer(questionId, b, game.today()));
    audit(admin, 'dodaj', 'odgovor', id, { question_id: questionId, canonical: b.canonical }); touch();
    return { id };
  }
  function updateAnswer(admin, id, b) {
    const a = db.get('SELECT * FROM accepted_answers WHERE id = ?', id);
    if (!a) throw new HttpError(404, 'Odgovor ne postoji.');
    db.tx(() => {
      const canonical = b.canonical !== undefined ? str(b.canonical, 120) : a.canonical;
      const norm = normalize(canonical);
      if (!norm) throw bad('Kanonski naziv je obavezan.');
      if (db.get('SELECT 1 AS x FROM accepted_answers WHERE question_id = ? AND norm = ? AND id != ?', a.question_id, norm, id)) throw new HttpError(409, 'Drugi odgovor već ima taj naziv.');
      db.run('UPDATE accepted_answers SET canonical = ?, norm = ?, explanation = ?, prior_popularity = ?, manual_rarity = ?, checked_at = ?, active = ? WHERE id = ?',
        canonical, norm, b.explanation !== undefined ? str(b.explanation, 400) : a.explanation,
        b.prior_popularity !== undefined ? Math.max(0.1, Number(b.prior_popularity) || 10) : a.prior_popularity,
        b.manual_rarity !== undefined ? (b.manual_rarity === null || b.manual_rarity === '' ? null : Math.min(100, Math.max(0, Number(b.manual_rarity)))) : a.manual_rarity,
        b.checked_at !== undefined ? b.checked_at : a.checked_at, b.active === undefined ? a.active : (b.active ? 1 : 0), id);
      if (b.aliases !== undefined) writeAliases(id, b.aliases, norm);
      if (b.source && (b.source.title || b.source.url)) db.run('INSERT INTO answer_sources (question_id, answer_id, title, url, note) VALUES (?, ?, ?, ?, ?)', a.question_id, id, str(b.source.title, 200) || 'Izvor', str(b.source.url, 500), str(b.source.note, 300));
    });
    audit(admin, 'uredi', 'odgovor', id, b); touch();
    return { ok: true };
  }
  function deleteAnswer(admin, id) {
    const a = db.get('SELECT * FROM accepted_answers WHERE id = ?', id);
    if (!a) throw new HttpError(404, 'Odgovor ne postoji.');
    db.run('DELETE FROM accepted_answers WHERE id = ?', id);
    audit(admin, 'obrisi', 'odgovor', id, { question_id: a.question_id, canonical: a.canonical }); touch();
    return { ok: true, question_id: a.question_id };
  }
  function addSource(admin, questionId, b) {
    const id = db.run('INSERT INTO answer_sources (question_id, answer_id, title, url, note) VALUES (?, ?, ?, ?, ?)', questionId, b.answer_id || null, str(b.title, 200) || 'Izvor', str(b.url, 500), str(b.note, 300)).id;
    audit(admin, 'dodaj', 'izvor', id, b);
    return { id };
  }
  function deleteSource(admin, id) { db.run('DELETE FROM answer_sources WHERE id = ?', id); audit(admin, 'obrisi', 'izvor', id); return { ok: true }; }

  /** Proba: kako bi sustav ocijenio upisani odgovor (ništa se ne sprema). */
  function testAnswer(questionId, input) {
    const q = db.get('SELECT t.slug AS type FROM questions q JOIN question_types t ON t.id = q.type_id WHERE q.id = ?', questionId);
    if (!q) throw new HttpError(404, 'Pitanje ne postoji.');
    const modes = game.transports().modes;
    if (q.type === 'numeric') {
      const target = game.numericTarget(questionId);
      const value = Number(String(input).replace(/\s/g, '').replace(',', '.'));
      if (!target || !Number.isFinite(value)) return { status: 'nije-broj' };
      const r = scoreNumeric(target, value, game.thresholdsFor(target));
      return { status: r.level ? 'tocno' : 'predaleko', error_pct: round1(r.errorPct), level: r.level, transport: game.publicMode(modes.find((m) => m.level === r.level)) };
    }
    const base = game.questionBase(questionId);
    const m = matchOpen(base.index, input);
    if (m.status !== 'match') return { status: m.status === 'ambiguous' ? 'dvosmisleno' : 'nepoznato', norm: m.norm, count: m.count };
    const r = game.rarityTable(questionId).get(m.answerId);
    const mode = levelForRarity(r.rarity, modes);
    return { status: 'tocno', via: m.via, norm: m.norm, canonical: base.byId.get(m.answerId).canonical, rarity: Math.round(r.rarity), share: round1(r.share * 100), level: mode.level, transport: game.publicMode(mode) };
  }

  function guesses(questionId) {
    const target = game.numericTarget(questionId);
    if (!target) throw new HttpError(404, 'Pitanje nije procjena.');
    const rows = db.all(`SELECT pa.id, pa.numeric_value AS value, pa.error_pct, pa.level, pa.km, pa.bonus, pa.created_at, s.official, p.nickname, c.date
                         FROM player_answers pa JOIN game_sessions s ON s.id = pa.session_id JOIN profiles p ON p.user_id = s.user_id
                         JOIN daily_challenges c ON c.id = s.challenge_id
                         WHERE pa.question_id = ? AND pa.numeric_value IS NOT NULL ORDER BY pa.error_pct ASC LIMIT 2000`, questionId);
    const vals = rows.filter((r) => r.official).map((r) => r.value).sort((a, b) => a - b);
    const bins = [[0, 1], [1, 2.5], [2.5, 6], [6, 12], [12, 22], [22, 40], [40, 70], [70, Infinity]].map(([lo, hi]) => ({
      label: hi === Infinity ? `> ${lo} %` : `${lo}–${hi} %`, count: rows.filter((r) => r.official && (lo === 0 ? r.error_pct >= 0 : r.error_pct > lo) && r.error_pct <= hi).length,
    }));
    return {
      target, count: vals.length,
      median: vals.length ? vals[Math.floor(vals.length / 2)] : null,
      mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
      min: vals[0] ?? null, max: vals[vals.length - 1] ?? null,
      below: rows.filter((r) => r.official && r.value < target.value).length, above: rows.filter((r) => r.official && r.value > target.value).length,
      bins, rows,
    };
  }

  // ================= Dnevni izazovi =================
  function listChallenges({ from, to }) {
    const a = isDate(from) ? from : addDays(game.today(), -14), b = isDate(to) ? to : addDays(game.today(), 60);
    return db.all(`SELECT c.*, (SELECT COUNT(*) FROM daily_challenge_questions x WHERE x.challenge_id = c.id) AS questions,
                          (SELECT COUNT(*) FROM game_sessions s WHERE s.challenge_id = c.id AND s.official = 1 AND s.finished_at IS NOT NULL) AS plays,
                          (SELECT ROUND(AVG(s.total_km), 1) FROM game_sessions s WHERE s.challenge_id = c.id AND s.official = 1 AND s.finished_at IS NOT NULL) AS avg_km
                   FROM daily_challenges c WHERE c.date BETWEEN ? AND ? ORDER BY c.date, c.scope`, a, b);
  }
  function getChallenge(id) {
    const c = db.get('SELECT * FROM daily_challenges WHERE id = ?', id);
    if (!c) throw new HttpError(404, 'Izazov ne postoji.');
    const questions = game.challengeQuestions(id).map((q) => {
      const agg = db.get(`SELECT COUNT(*) AS n, COALESCE(SUM(pa.is_correct),0) AS ok, ROUND(AVG(pa.km),1) AS avg_km FROM player_answers pa JOIN game_sessions s ON s.id = pa.session_id
                          WHERE pa.question_id = ? AND s.challenge_id = ? AND s.official = 1`, q.id, id);
      const top = q.type === 'open' ? db.all(`SELECT a.canonical AS answer, 1 AS is_correct, COUNT(*) AS n FROM player_answers pa JOIN game_sessions s ON s.id = pa.session_id
                                              JOIN accepted_answers a ON a.id = pa.answer_id WHERE pa.question_id = ? AND s.challenge_id = ? AND s.official = 1
                                              GROUP BY a.id ORDER BY n DESC LIMIT 8`, q.id, id) : [];
      const st = db.get(`SELECT COALESCE(SUM(pa.status = 'isteklo'),0) AS timeouts, ROUND(AVG(pa.attempts),1) AS avg_attempts, ROUND(AVG(CASE WHEN pa.is_correct = 1 THEN pa.answer_ms END) / 1000.0, 1) AS avg_s
                         FROM player_answers pa JOIN game_sessions s ON s.id = pa.session_id WHERE pa.question_id = ? AND s.challenge_id = ? AND s.official = 1`, q.id, id);
      return { position: q.position, id: q.id, text: q.text, type: q.type, category: q.category_name, emoji: q.category_emoji,
        base: q.type === 'open' ? game.questionBase(q.id).answers.length : null, stats: { answers: agg.n, correct: agg.ok, avg_km: agg.avg_km, top, timeouts: st.timeouts, avg_attempts: st.avg_attempts, avg_seconds: st.avg_s } };
    });
    const plays = db.get('SELECT COUNT(*) AS n, ROUND(AVG(total_km),1) AS avg_km, COALESCE(SUM(reached_goal),0) AS goals FROM game_sessions WHERE challenge_id = ? AND official = 1 AND finished_at IS NOT NULL', id);
    return { ...c, questions, plays, expected_questions: game.cfg().questions_per_day };
  }
  function saveChallenge(admin, id, b) {
    return db.tx(() => {
      const existing = id ? db.get('SELECT * FROM daily_challenges WHERE id = ?', id) : null;
      if (id && !existing) throw new HttpError(404, 'Izazov ne postoji.');
      const date = b.date ?? existing?.date;
      if (!isDate(date)) throw bad('Datum izazova je obavezan (GGGG-MM-DD).');
      const scope = b.scope ?? existing?.scope ?? 'sve';
      if (scope !== 'sve' && !db.get('SELECT 1 AS x FROM maps WHERE slug = ?', scope)) throw bad('Opseg mora biti "sve" ili oznaka karte.');
      if (db.get('SELECT 1 AS x FROM daily_challenges WHERE date = ? AND scope = ? AND id != ?', date, scope, id || 0)) throw new HttpError(409, 'Za taj datum i opseg već postoji izazov.');
      const active = b.active === undefined ? existing?.active ?? 1 : (b.active ? 1 : 0);
      if (id) db.run('UPDATE daily_challenges SET date = ?, scope = ?, title = ?, active = ? WHERE id = ?', date, scope, b.title !== undefined ? str(b.title, 120) : existing.title, active, id);
      else id = db.run('INSERT INTO daily_challenges (date, scope, title, active) VALUES (?, ?, ?, ?)', date, scope, str(b.title, 120), active).id;
      if (Array.isArray(b.question_ids)) {
        const ids = b.question_ids.map(Number).filter(Boolean);
        if (new Set(ids).size !== ids.length) throw bad('Isto pitanje je navedeno dvaput.');
        const current = db.all('SELECT question_id FROM daily_challenge_questions WHERE challenge_id = ? ORDER BY position', id).map((r) => r.question_id);
        const changed = current.length !== ids.length || current.some((x, i) => x !== ids[i]);
        if (changed) {
          if (db.get('SELECT 1 AS x FROM game_sessions WHERE challenge_id = ?', id) && !b.force) throw new HttpError(409, 'Izazov se već igra. Izmjena pitanja poništila bi partije — potvrdi s "force" ako to želiš.', { needs_force: true });
          if (b.force) db.run('DELETE FROM game_sessions WHERE challenge_id = ?', id);
          for (const qid of ids) if (!db.get('SELECT 1 AS x FROM questions WHERE id = ?', qid)) throw bad(`Pitanje ${qid} ne postoji.`);
          db.run('DELETE FROM daily_challenge_questions WHERE challenge_id = ?', id);
          ids.forEach((qid, i) => db.run('INSERT INTO daily_challenge_questions (challenge_id, position, question_id) VALUES (?, ?, ?)', id, i + 1, qid));
        }
      }
      // Aktivan (objavljen) izazov mora imati zadani broj pitanja, osim ako administrator izričito potvrdi iznimku.
      const expected = game.cfg().questions_per_day;
      const count = db.get('SELECT COUNT(*) AS n FROM daily_challenge_questions WHERE challenge_id = ?', id).n;
      if (active && count !== expected && !b.allow_size) {
        throw new HttpError(409, `Izazov ima ${count} pitanja, a zadano je ${expected}. Dodaj ili makni pitanja, spremi ga kao neaktivan ili potvrdi iznimku.`, { needs_allow_size: true, count, expected });
      }
      audit(admin, existing ? 'uredi' : 'dodaj', 'izazov', id, { date, scope, active, question_ids: b.question_ids, allow_size: !!b.allow_size }); touch();
      return { id, count, expected };
    });
  }
  function copyChallenge(admin, id, date) {
    const c = db.get('SELECT * FROM daily_challenges WHERE id = ?', id);
    if (!c) throw new HttpError(404, 'Izazov ne postoji.');
    const ids = db.all('SELECT question_id FROM daily_challenge_questions WHERE challenge_id = ? ORDER BY position', id).map((r) => r.question_id);
    return saveChallenge(admin, null, { date, scope: c.scope, title: c.title, active: 0, question_ids: ids });
  }
  function deleteChallenge(admin, id, force) {
    if (db.get('SELECT 1 AS x FROM game_sessions WHERE challenge_id = ?', id) && !force) throw new HttpError(409, 'Izazov ima odigrane partije. Deaktiviraj ga ili potvrdi brisanje zajedno s partijama.', { needs_force: true });
    db.run('DELETE FROM daily_challenges WHERE id = ?', id);
    audit(admin, 'obrisi', 'izazov', id, { force: !!force }); touch();
    return { ok: true };
  }
  function recalcChallenge(admin, id, mode) {
    let changed = 0;
    for (const q of game.challengeQuestions(id)) changed += game.recalcQuestion(q.id, mode === 'sve' ? 'sve' : 'novi').changed;
    audit(admin, 'obracun', 'izazov', id, { mode, changed });
    return { changed };
  }

  // ================= Nepoznati odgovori =================
  function reports({ status }) {
    const st = ['novo', 'odobreno', 'odbijeno'].includes(status) ? status : 'novo';
    return db.all(`SELECT r.question_id, r.norm, MIN(r.raw) AS raw, COUNT(*) AS reports, MIN(r.created_at) AS first_at, MAX(r.created_at) AS last_at,
                          GROUP_CONCAT(DISTINCT p.nickname) AS users, MAX(r.note) AS note, MAX(r.resolution_note) AS resolution_note, q.text AS question,
                          (SELECT COUNT(DISTINCT t.session_id) FROM answer_attempts t WHERE t.question_id = r.question_id AND t.norm = r.norm) AS given
                   FROM answer_reports r JOIN questions q ON q.id = r.question_id LEFT JOIN profiles p ON p.user_id = r.user_id
                   WHERE r.status = ? GROUP BY r.question_id, r.norm ORDER BY reports DESC, last_at DESC LIMIT 300`, st);
  }
  /** Najčešći neprepoznati odgovori (i oni koje nitko nije prijavio). */
  function unknownAnswers({ question_id }) {
    // Izvor su svi neprepoznati pokušaji (i oni nakon kojih je igrač ipak pogodio), osim onih koji su u međuvremenu priznati.
    const where = question_id ? 'AND t.question_id = ?' : '';
    return db.all(`SELECT t.question_id, t.norm, MIN(t.raw) AS raw, COUNT(DISTINCT t.session_id) AS given, q.text AS question,
                          (SELECT COUNT(*) FROM answer_reports r WHERE r.question_id = t.question_id AND r.norm = t.norm) AS reports
                   FROM answer_attempts t JOIN questions q ON q.id = t.question_id
                   WHERE t.resolved = 0 AND t.norm != '' ${where}
                   GROUP BY t.question_id, t.norm ORDER BY given DESC, MAX(t.id) DESC LIMIT 200`, ...(question_id ? [int(question_id)] : []));
  }
  /**
   * Odobri: odgovor se dodaje kao NOVI kanonski odgovor ili kao alias postojećeg, zatim se svim igračima
   * koji su ga upisali naknadno priznaju kilometri (nitko drugi ne gubi ništa).
   */
  function resolveReport(admin, b) {
    const qid = int(b.question_id), norm = String(b.norm || '');
    const sample = db.get('SELECT raw FROM answer_attempts WHERE question_id = ? AND norm = ? LIMIT 1', qid, norm) || db.get('SELECT raw FROM answer_reports WHERE question_id = ? AND norm = ? LIMIT 1', qid, norm);
    if (!sample) throw new HttpError(404, 'Takav odgovor nije zabilježen.');
    let recalc = null;
    db.tx(() => {
      if (b.action === 'odobri') {
        if (b.answer_id) {
          const a = db.get('SELECT * FROM accepted_answers WHERE id = ? AND question_id = ?', int(b.answer_id), qid);
          if (!a) throw bad('Odabrani odgovor ne pripada tom pitanju.');
          db.run('INSERT OR IGNORE INTO answer_aliases (answer_id, alias, norm) VALUES (?, ?, ?)', a.id, sample.raw, norm);
        } else {
          writeAnswer(qid, { canonical: str(b.canonical, 120) || sample.raw, aliases: [sample.raw], explanation: b.explanation, prior_popularity: b.prior_popularity || 3,
            sources: b.source_url || b.source_title ? [{ title: b.source_title || b.source_url, url: b.source_url }] : [] }, game.today());
        }
        touch();
        recalc = game.recalcQuestion(qid, 'novi');
      } else if (b.action === 'odbij') {
        db.run('UPDATE answer_attempts SET resolved = 2 WHERE question_id = ? AND norm = ?', qid, norm);   // 2 = pregledano i odbijeno
      } else throw bad('Radnja mora biti "odobri" ili "odbij".');
      db.run(`UPDATE answer_reports SET status = ?, resolved_at = ?, resolved_by = ?, resolution_note = ? WHERE question_id = ? AND norm = ? AND status = 'novo'`,
        b.action === 'odobri' ? 'odobreno' : 'odbijeno', nowIso(), admin?.id ?? null, str(b.note, 300), qid, norm);
    });
    audit(admin, b.action, 'prijava-odgovora', `${qid}:${norm}`, { ...b, recalc });
    return { ok: true, recalc };
  }

  // ================= Korisnici i lige =================
  function users({ q, page, filter }) {
    const where = ['1=1'], params = [];
    if (q) { where.push('(p.nickname LIKE ? OR u.email LIKE ? OR u.id = ?)'); params.push(`%${q}%`, `%${q}%`, int(q, -1)); }
    if (filter === 'blokirani') where.push('u.is_blocked = 1');
    if (filter === 'gosti') where.push('u.is_guest = 1');
    if (filter !== 'gosti' && filter !== 'svi' && !q) where.push('u.is_guest = 0');
    const size = 50, offset = Math.max(0, int(page, 1) - 1) * size;
    const total = db.get(`SELECT COUNT(*) AS n FROM users u JOIN profiles p ON p.user_id = u.id WHERE ${where.join(' AND ')}`, ...params).n;
    const rows = db.all(`SELECT u.id, u.email, u.is_guest, u.is_blocked, u.block_reason, u.created_at, u.last_seen_at, p.nickname, p.avatar,
                                (SELECT COUNT(*) FROM game_sessions s WHERE s.user_id = u.id AND s.official = 1 AND s.finished_at IS NOT NULL) AS games,
                                (SELECT ROUND(COALESCE(SUM(s.total_km),0)) FROM game_sessions s WHERE s.user_id = u.id AND s.official = 1) AS km,
                                EXISTS(SELECT 1 FROM admin_users a WHERE a.user_id = u.id) AS is_admin
                         FROM users u JOIN profiles p ON p.user_id = u.id WHERE ${where.join(' AND ')} ORDER BY u.id DESC LIMIT ? OFFSET ?`, ...params, size, offset);
    return { rows, total, page: int(page, 1), pages: Math.ceil(total / size) };
  }
  function userDetail(id) {
    const u = db.get(`SELECT u.id, u.email, u.is_guest, u.is_blocked, u.block_reason, u.created_at, u.last_seen_at, p.nickname, p.avatar, p.is_public,
                             EXISTS(SELECT 1 FROM admin_users a WHERE a.user_id = u.id) AS is_admin
                      FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = ?`, id);
    if (!u) throw new HttpError(404, 'Korisnik ne postoji.');
    return {
      ...u, streak: game.streakOf(id),
      sessions: db.all(`SELECT s.id, c.date, m.slug AS map, s.official, s.mode, s.total_km, s.reached_goal, s.started_at, s.finished_at FROM game_sessions s
                        JOIN daily_challenges c ON c.id = s.challenge_id JOIN maps m ON m.id = s.map_id WHERE s.user_id = ? ORDER BY s.id DESC LIMIT 100`, id),
      leagues: db.all('SELECT l.id, l.name FROM leagues l JOIN league_members m ON m.league_id = l.id WHERE m.user_id = ?', id),
      reports: db.all('SELECT * FROM content_reports WHERE target_type = ? AND target_id = ? ORDER BY id DESC', 'korisnik', id),
    };
  }
  function sessionDetail(id) {
    const s = db.get('SELECT s.*, c.date, m.slug AS map FROM game_sessions s JOIN daily_challenges c ON c.id = s.challenge_id JOIN maps m ON m.id = s.map_id WHERE s.id = ?', id);
    if (!s) throw new HttpError(404, 'Partija ne postoji.');
    return { ...s, answers: db.all(`SELECT pa.position, q.text AS question, pa.raw, a.canonical, pa.is_correct, pa.status, pa.attempts, pa.answer_ms, pa.rarity, pa.level, pa.km, pa.numeric_value, pa.error_pct, pa.counted, pa.bonus, pa.created_at
                                    FROM player_answers pa JOIN questions q ON q.id = pa.question_id LEFT JOIN accepted_answers a ON a.id = pa.answer_id WHERE pa.session_id = ? ORDER BY pa.position`, id),
      attempts: db.all('SELECT position, raw, resolved, created_at FROM answer_attempts WHERE session_id = ? ORDER BY id', id) };
  }
  function updateUser(admin, id, b) {
    const u = db.get('SELECT id FROM users WHERE id = ?', id);
    if (!u) throw new HttpError(404, 'Korisnik ne postoji.');
    if (b.nickname !== undefined) {
      const nick = auth.validNickname(b.nickname);
      if (auth.nickTaken(normalize(nick), id)) throw new HttpError(409, 'Taj je nadimak zauzet.');
      db.run('UPDATE profiles SET nickname = ?, nickname_norm = ? WHERE user_id = ?', nick, normalize(nick), id);
    }
    if (b.is_blocked !== undefined) {
      if (b.is_blocked && id === admin.id) throw bad('Ne možeš blokirati vlastiti račun.');
      db.run('UPDATE users SET is_blocked = ?, block_reason = ? WHERE id = ?', b.is_blocked ? 1 : 0, b.is_blocked ? str(b.block_reason, 300) : null, id);
      if (b.is_blocked) db.run('DELETE FROM auth_sessions WHERE user_id = ?', id);
    }
    if (b.remove_avatar) { auth.removeAvatarFile(id); db.run('UPDATE profiles SET avatar = NULL WHERE user_id = ?', id); }
    if (b.is_admin !== undefined) {
      if (!b.is_admin && id === admin.id) throw bad('Ne možeš ukloniti vlastite administratorske ovlasti.');
      if (b.is_admin) db.run('INSERT OR IGNORE INTO admin_users (user_id, created_at) VALUES (?, ?)', id, nowIso());
      else db.run('DELETE FROM admin_users WHERE user_id = ?', id);
    }
    audit(admin, 'uredi', 'korisnik', id, b); touch();
    return { ok: true };
  }
  function deleteUser(admin, id) {
    if (id === admin.id) throw bad('Vlastiti račun briši iz profila.');
    auth.deleteAccount(id);
    audit(admin, 'obrisi', 'korisnik', id);
    return { ok: true };
  }
  function resetLink(admin, id) { audit(admin, 'reset-lozinke', 'korisnik', id); return { url: auth.createResetLink(id) }; }

  function leagues({ q }) {
    return db.all(`SELECT l.*, p.nickname AS owner, (SELECT COUNT(*) FROM league_members m WHERE m.league_id = l.id) AS members,
                          (SELECT COUNT(*) FROM content_reports r WHERE r.target_type = 'liga' AND r.target_id = l.id AND r.status = 'novo') AS reports
                   FROM leagues l JOIN profiles p ON p.user_id = l.owner_id WHERE l.name LIKE ? OR l.code LIKE ? ORDER BY l.id DESC LIMIT 300`, `%${q || ''}%`, `%${q || ''}%`);
  }
  function updateLeague(admin, id, b) {
    if (b.delete) db.run('DELETE FROM leagues WHERE id = ?', id);
    else {
      if (b.name !== undefined) db.run('UPDATE leagues SET name = ? WHERE id = ?', str(b.name, 40) || 'Liga', id);
      if (b.is_hidden !== undefined) db.run('UPDATE leagues SET is_hidden = ? WHERE id = ?', b.is_hidden ? 1 : 0, id);
    }
    audit(admin, b.delete ? 'obrisi' : 'uredi', 'liga', id, b); touch();
    return { ok: true };
  }
  const contentReports = () => db.all(`SELECT r.*, p.nickname AS reporter,
       CASE r.target_type WHEN 'korisnik' THEN (SELECT nickname FROM profiles WHERE user_id = r.target_id) ELSE (SELECT name FROM leagues WHERE id = r.target_id) END AS target_name
     FROM content_reports r LEFT JOIN profiles p ON p.user_id = r.reporter_id ORDER BY r.status = 'novo' DESC, r.id DESC LIMIT 300`);
  function resolveContentReport(admin, id) {
    db.run("UPDATE content_reports SET status = 'rijeseno', resolved_at = ? WHERE id = ?", nowIso(), id);
    audit(admin, 'rijesi', 'prijava-sadrzaja', id);
    return { ok: true };
  }

  // ================= Karte =================
  function maps() {
    return db.all('SELECT * FROM maps ORDER BY sort_order, id').map((m) => {
      const route = db.get('SELECT * FROM routes WHERE map_id = ? ORDER BY active DESC, id LIMIT 1', m.id);
      const checkpoints = route ? db.all(`SELECT rc.position, rc.is_stop, rc.is_goal, rc.message, c.name, c.nickname, c.label, c.lat, c.lng, c.country FROM route_checkpoints rc
                                          JOIN cities c ON c.id = rc.city_id WHERE rc.route_id = ? ORDER BY rc.position`, route.id) : [];
      const computed = game.routeFor(m.id);
      return { ...m, route: route ? { name: route.name, total_km: route.total_km, ext_km: computed?.ext_km ?? route.ext_km, ext_km_set: route.ext_km, end_km: computed?.end_km ?? route.total_km, real_km: route.real_km,
        checkpoints: checkpoints.map((c, i) => ({ ...c, is_goal: computed ? (i === computed.goal_index ? 1 : 0) : c.is_goal, km: computed?.points[i]?.km ?? null })) } : null };
    });
  }
  function saveMap(admin, id, b) {
    return db.tx(() => {
      const existing = id ? db.get('SELECT * FROM maps WHERE id = ?', id) : null;
      const slug = str(b.slug ?? existing?.slug, 30)?.toLowerCase();
      const name = str(b.name ?? existing?.name, 60);
      if (!slug || !/^[a-z0-9-]+$/.test(slug) || !name) throw bad('Karta treba naziv i oznaku (mala slova, brojke, crtica).');
      if (id) db.run('UPDATE maps SET slug = ?, name = ?, flag = ?, active = ?, sort_order = ? WHERE id = ?', slug, name, str(b.flag ?? existing.flag, 16), b.active === undefined ? existing.active : (b.active ? 1 : 0), int(b.sort_order ?? existing.sort_order), id);
      else id = db.run('INSERT INTO maps (slug, name, flag, active, sort_order) VALUES (?, ?, ?, ?, ?)', slug, name, str(b.flag, 16), b.active === false ? 0 : 1, int(b.sort_order)).id;
      if (b.route) {
        const pts = b.route.checkpoints || [];
        if (pts.length < 2) throw bad('Ruta treba barem polazište i odredište.');
        for (const p of pts) {
          if (!str(p.name)) throw bad('Svaka točka treba naziv.');
          if (!(Math.abs(Number(p.lat)) <= 90) || !(Math.abs(Number(p.lng)) <= 180) || p.lat === '' || p.lng === '') throw bad(`Točka "${p.name}" nema ispravne koordinate.`);
        }
        const total = Number(b.route.total_km);
        if (!(total > 0)) throw bad('Duljina rute do cilja (virtualni kilometri) mora biti veća od nule.');
        // Cilj = točka označena kao glavno odredište; sve iza nje je nastavak u susjednu državu.
        let goal = pts.findIndex((p) => p.is_goal === true || p.is_goal === 1 || p.is_goal === '1');
        if (goal < 1) goal = pts.length - 1;
        const extKm = Number(b.route.ext_km) > 0 && goal < pts.length - 1 ? Number(b.route.ext_km) : 0;
        const realKm = Number(b.route.real_km) > 0 ? Number(b.route.real_km) : null;
        db.run('DELETE FROM routes WHERE map_id = ?', id);
        db.run('DELETE FROM cities WHERE map_id = ?', id);
        const routeId = db.run('INSERT INTO routes (map_id, name, total_km, ext_km, real_km, active) VALUES (?, ?, ?, ?, ?, 1)', id, str(b.route.name, 80) || `${pts[0].name} – ${pts[goal].name}`, total, extKm, realKm).id;
        pts.forEach((p, i) => {
          const country = (str(p.country, 4) || slug).toLowerCase();
          const cityId = db.run('INSERT INTO cities (map_id, name, nickname, label, lat, lng, country) VALUES (?, ?, ?, ?, ?, ?, ?)', id, str(p.name, 60), str(p.nickname, 80), str(p.label, 12), Number(p.lat), Number(p.lng), country).id;
          const stop = i === 0 || i === pts.length - 1 || i === goal ? 1 : (p.is_stop === false || p.is_stop === 0 || p.is_stop === '0' ? 0 : 1);
          db.run('INSERT INTO route_checkpoints (route_id, position, city_id, is_stop, is_goal, message) VALUES (?, ?, ?, ?, ?, ?)', routeId, i + 1, cityId, stop, i === goal ? 1 : 0, str(p.message, 200));
        });
      }
      audit(admin, existing ? 'uredi' : 'dodaj', 'karta', id, { slug, name, points: b.route?.checkpoints?.length }); touch();
      return { id };
    });
  }

  // ================= Prijevozna sredstva =================
  function transportSets() {
    return db.all('SELECT * FROM transport_sets ORDER BY active DESC, id').map((s) => ({ ...s, modes: db.all('SELECT * FROM transport_modes WHERE set_id = ? ORDER BY level', s.id) }));
  }
  function saveTransportSet(admin, id, b) {
    return db.tx(() => {
      const name = str(b.name, 80);
      if (!name) throw bad('Naziv seta je obavezan.');
      const modes = b.modes || [];
      if (modes.length !== 7 || new Set(modes.map((m) => int(m.level))).size !== 7 || modes.some((m) => int(m.level) < 1 || int(m.level) > 7)) throw bad('Set mora imati točno sedam razina (1–7).');
      const sorted = [...modes].sort((x, y) => int(x.level) - int(y.level));
      for (let i = 0; i < 7; i++) {
        const m = sorted[i];
        if (!str(m.name)) throw bad(`Razina ${m.level} nema naziv.`);
        if (!(Number(m.km) >= 0)) throw bad(`Razina ${m.level} nema ispravnu kilometražu.`);
        if (!(Number(m.min_rarity) >= 0 && Number(m.min_rarity) <= 100)) throw bad(`Prag rijetkosti razine ${m.level} mora biti 0–100.`);
        if (i && Number(m.min_rarity) < Number(sorted[i - 1].min_rarity)) throw bad('Pragovi rijetkosti moraju rasti s razinom.');
      }
      if (id) db.run('UPDATE transport_sets SET name = ?, description = ? WHERE id = ?', name, str(b.description, 300), id);
      else id = db.run('INSERT INTO transport_sets (name, description, active) VALUES (?, ?, 0)', name, str(b.description, 300)).id;
      db.run('DELETE FROM transport_modes WHERE set_id = ?', id);
      for (const m of sorted) {
        db.run('INSERT INTO transport_modes (set_id, level, name, emoji, image, km, min_rarity, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          id, int(m.level), str(m.name, 60), str(m.emoji, 16), str(m.image, 300000), Number(m.km), Number(m.min_rarity), str(m.description, 200));
      }
      audit(admin, 'spremi', 'prijevoz', id, { name, km: sorted.map((m) => m.km) }); touch();
      return { id };
    });
  }
  function activateTransportSet(admin, id) {
    if (!db.get('SELECT 1 AS x FROM transport_sets WHERE id = ?', id)) throw new HttpError(404, 'Set ne postoji.');
    db.tx(() => { db.run('UPDATE transport_sets SET active = 0'); db.run('UPDATE transport_sets SET active = 1 WHERE id = ?', id); });
    audit(admin, 'aktiviraj', 'prijevoz', id); touch();
    return { ok: true };
  }
  function deleteTransportSet(admin, id) {
    if (db.get('SELECT active FROM transport_sets WHERE id = ?', id)?.active) throw bad('Aktivni set se ne može obrisati.');
    db.run('DELETE FROM transport_sets WHERE id = ?', id);
    audit(admin, 'obrisi', 'prijevoz', id); touch();
    return { ok: true };
  }

  // ================= Postavke =================
  function saveSettings(admin, b) {
    const changed = {};
    for (let [k, v] of Object.entries(b || {})) {
      if (!SETTING_KEYS.has(k)) throw bad(`Nepoznata postavka: ${k}`);
      if (k === 'reset_time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw bad('Vrijeme resetiranja mora biti u obliku HH:MM.');
      if (k === 'start_date' && v && !isDate(v)) throw bad('Datum početka mora biti GGGG-MM-DD.');
      if (k === 'timezone') { try { new Intl.DateTimeFormat('en', { timeZone: v }); } catch { throw bad('Nepoznata vremenska zona.'); } }
      if (k === 'numeric_thresholds' && (!Array.isArray(v) || v.some((x) => !(x.max_pct > 0) || !(x.level >= 1 && x.level <= 7)))) throw bad('Pragovi procjena moraju biti popis {max_pct, level}.');
      if (k === 'rarity' && (typeof v !== 'object' || !(v.prior_strength >= 0) || !(v.w_percentile >= 0) || !(v.w_breadth >= 0))) throw bad('Postavke rijetkosti nisu ispravne.');
      if (k === 'game') {
        const g = v || {};
        const between = (x, lo, hi) => Number.isFinite(Number(x)) && Number(x) >= lo && Number(x) <= hi;
        if (!between(g.questions_per_day, 1, 30)) throw bad('Broj pitanja po danu mora biti između 1 i 30.');
        if (!between(g.prep_seconds, 0, 30)) throw bad('Priprema mora trajati između 0 i 30 sekundi.');
        if (!between(g.answer_seconds, 5, 300)) throw bad('Vrijeme za odgovor mora biti između 5 i 300 sekundi.');
        if (g.max_attempts != null && !between(g.max_attempts, 1, 50)) throw bad('Najveći broj pokušaja mora biti između 1 i 50.');
        if (g.numeric_timeout != null && !['spremljena', 'nula'].includes(g.numeric_timeout)) throw bad('Ponašanje procjene pri isteku mora biti "spremljena" ili "nula".');
        v = { ...game.cfg(), questions_per_day: Math.trunc(Number(g.questions_per_day)), prep_seconds: Number(g.prep_seconds), answer_seconds: Number(g.answer_seconds),
          retries: !!g.retries, ...(g.max_attempts != null ? { max_attempts: Math.trunc(Number(g.max_attempts)) } : {}), ...(g.numeric_timeout ? { numeric_timeout: g.numeric_timeout } : {}) };
      }
      if (k === 'countries' && (typeof v !== 'object' || Array.isArray(v) || Object.entries(v).some(([code, c]) => !/^[a-z]{2,3}$/.test(code) || !c?.name))) throw bad('Države moraju biti zapisane kao { oznaka: { name, flag } }.');
      settings.set(k, v);
      changed[k] = typeof v === 'string' && v.length > 200 ? v.slice(0, 200) + '…' : v;
    }
    audit(admin, 'postavke', 'postavke', null, changed); touch();
    return { ok: true };
  }
  // ================= Kvaliteta sadržaja =================
  /** Pregled baze pitanja: što treba doraditi prije objave. Ništa ne mijenja. */
  function quality() {
    const today = game.today();
    const open = db.all(`SELECT q.id, q.text, q.active, c.name AS category,
                                (SELECT MIN(a.checked_at) FROM accepted_answers a WHERE a.question_id = q.id AND a.active = 1) AS checked_at,
                                (SELECT COUNT(*) FROM accepted_answers a WHERE a.question_id = q.id AND a.active = 1) AS answers,
                                (SELECT COUNT(*) FROM answer_aliases al JOIN accepted_answers a ON a.id = al.answer_id WHERE a.question_id = q.id) AS aliases,
                                (SELECT COUNT(*) FROM answer_sources s WHERE s.question_id = q.id) AS sources,
                                (SELECT COUNT(*) FROM accepted_answers a WHERE a.question_id = q.id AND a.active = 1 AND (a.explanation IS NULL OR a.explanation = '')) AS no_expl,
                                (SELECT COUNT(*) FROM daily_challenge_questions d WHERE d.question_id = q.id) AS scheduled
                         FROM questions q JOIN question_types t ON t.id = q.type_id JOIN question_categories c ON c.id = q.category_id
                         WHERE t.slug = 'open' ORDER BY q.id`);
    const numeric = db.all(`SELECT q.id, q.text, q.active, COALESCE(nt.ref_date, substr(q.updated_at, 1, 10)) AS checked_at, c.name AS category, nt.value, nt.ref_date, nt.is_estimate,
                                   (SELECT COUNT(*) FROM answer_sources s WHERE s.question_id = q.id) AS sources,
                                   (SELECT COUNT(*) FROM daily_challenge_questions d WHERE d.question_id = q.id) AS scheduled
                            FROM questions q JOIN question_types t ON t.id = q.type_id JOIN question_categories c ON c.id = q.category_id
                            LEFT JOIN numeric_targets nt ON nt.question_id = q.id WHERE t.slug = 'numeric' ORDER BY q.id`);
    const seen = new Map(), duplicates = [];
    for (const q of [...open, ...numeric]) {
      const key = normalize(q.text);
      if (seen.has(key)) duplicates.push({ id: q.id, other: seen.get(key), text: q.text }); else seen.set(key, q.id);
    }
    const pick = (q, why) => ({ id: q.id, text: q.text, category: q.category, why });
    const stale = addDays(today, -180);
    const expected = game.cfg().questions_per_day;
    const days = db.all(`SELECT c.id, c.date, c.scope, c.active, (SELECT COUNT(*) FROM daily_challenge_questions x WHERE x.challenge_id = c.id) AS questions
                         FROM daily_challenges c WHERE c.date >= ? ORDER BY c.date`, today);
    return {
      totals: { open: open.length, numeric: numeric.length, scheduled: [...open, ...numeric].filter((q) => q.scheduled).length, unscheduled: [...open, ...numeric].filter((q) => !q.scheduled && q.active).length,
        answers: open.reduce((a, q) => a + q.answers, 0), aliases: open.reduce((a, q) => a + q.aliases, 0) },
      duplicates,
      few_answers: open.filter((q) => q.answers < 8).map((q) => pick(q, `${q.answers} odgovora`)),
      no_aliases: open.filter((q) => q.answers >= 8 && q.aliases === 0).map((q) => pick(q, 'nijedan alias')),
      no_sources: [...open, ...numeric].filter((q) => !q.sources).map((q) => pick(q, 'nema izvora')),
      no_explanations: open.filter((q) => q.no_expl > 0 && q.no_expl === q.answers).map((q) => pick(q, 'odgovori nemaju obrazloženja')),
      numeric_no_target: numeric.filter((q) => q.value == null).map((q) => pick(q, 'nema referentne vrijednosti')),
      // otvorena pitanja: najstarija provjera nekog odgovora; procjene se ne smatraju zastarjelima (vrijede na svoj referentni datum)
      stale: open.filter((q) => !q.checked_at || q.checked_at < stale).map((q) => pick(q, q.checked_at ? `provjereno ${q.checked_at}` : 'nikad provjereno')),
      unscheduled: [...open, ...numeric].filter((q) => !q.scheduled && q.active).map((q) => pick(q, 'nije u rasporedu')),
      wrong_size_days: days.filter((d) => d.questions !== expected).map((d) => ({ ...d, expected })),
      days_ahead: days.filter((d) => d.active).length, expected,
    };
  }
  /** Slaže sljedeći slobodan dan iz neraspoređenih pitanja (različite kategorije, procjene na kraju). Sprema se kao NEAKTIVAN nacrt. */
  function composeChallenge(admin, b = {}) {
    const expected = game.cfg().questions_per_day;
    let date = b.date;
    if (!isDate(date)) {
      const last = db.get("SELECT MAX(date) AS d FROM daily_challenges WHERE scope = 'sve'")?.d;
      date = addDays(last && last >= game.today() ? last : game.today(), 1);
    }
    if (db.get("SELECT 1 AS x FROM daily_challenges WHERE date = ? AND scope = 'sve'", date)) throw new HttpError(409, 'Za taj datum već postoji izazov.');
    const pool = db.all(`SELECT q.id, q.category_id, t.slug AS type FROM questions q JOIN question_types t ON t.id = q.type_id
                         WHERE q.active = 1 AND NOT EXISTS (SELECT 1 FROM daily_challenge_questions d WHERE d.question_id = q.id) ORDER BY q.id`);
    const numeric = pool.filter((q) => q.type === 'numeric'), open = pool.filter((q) => q.type === 'open');
    const wantNumeric = Math.min(numeric.length, expected >= 10 ? 2 : 1);
    const wantOpen = expected - wantNumeric;
    // kružno po kategorijama da dan bude raznolik
    const byCat = new Map();
    for (const q of open) { if (!byCat.has(q.category_id)) byCat.set(q.category_id, []); byCat.get(q.category_id).push(q); }
    const picked = [];
    while (picked.length < wantOpen && [...byCat.values()].some((l) => l.length)) {
      for (const list of byCat.values()) { if (picked.length < wantOpen && list.length) picked.push(list.shift()); }
    }
    const ids = [...picked.map((q) => q.id), ...numeric.slice(0, wantNumeric).map((q) => q.id)];
    if (ids.length < expected) throw new HttpError(409, `Nema dovoljno neraspoređenih pitanja: potrebno ${expected}, dostupno ${ids.length}. Dodaj ili uvezi nova pitanja.`, { available: ids.length, expected });
    const r = saveChallenge(admin, null, { date, scope: 'sve', active: 0, question_ids: ids });
    return { ...r, date, question_ids: ids };
  }

  const auditLog = ({ page }) => db.all(`SELECT a.*, p.nickname FROM admin_audit_logs a LEFT JOIN profiles p ON p.user_id = a.admin_id ORDER BY a.id DESC LIMIT 100 OFFSET ?`, Math.max(0, int(page, 1) - 1) * 100);

  return {
    dashboard, categories, saveCategory, listQuestions, getQuestion, saveQuestion, saveTarget, deleteQuestion, copyQuestion, bulkQuestions, importQuestions,
    addAnswer, updateAnswer, deleteAnswer, addSource, deleteSource, testAnswer, guesses,
    listChallenges, getChallenge, saveChallenge, copyChallenge, deleteChallenge, recalcChallenge,
    reports, unknownAnswers, resolveReport, users, userDetail, sessionDetail, updateUser, deleteUser, resetLink, leagues, updateLeague, contentReports, resolveContentReport,
    quality, composeChallenge, maps, saveMap, transportSets, saveTransportSet, activateTransportSet, deleteTransportSet, saveSettings, auditLog, audit,
  };
}
