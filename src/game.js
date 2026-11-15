// Dnevna igra: izazovi, partije, tajmeri po pitanju, ponovni pokušaji, bodovanje na serveru, naknadni obračuni.
import { gameDate, nextReset, nowIso, normalize, parseNumber, haversine, round1, HttpError, bad, isDate } from './util.js';
import { buildIndex, matchOpen, computeRarity, levelForRarity, scoreNumeric, closestGuesses, computeStreak, DEFAULT_NUMERIC_THRESHOLDS } from './scoring.js';

export const GAME_DEFAULTS = {
  questions_per_day: 10,     // očekivani broj pitanja u dnevnom izazovu
  prep_seconds: 5,           // priprema: pitanje je vidljivo, upis zaključan
  answer_seconds: 30,        // vrijeme za odgovor
  retries: true,             // neprepoznat odgovor ne troši pitanje dok traje vrijeme
  max_attempts: 15,          // najviše neprepoznatih pokušaja po pitanju
  grace_ms: 1500,            // tolerancija na kašnjenje mreže pri isteku
  numeric_timeout: 'spremljena', // 'spremljena' = pri isteku vrijedi zadnja spremljena procjena; 'nula' = 0 km
};

export function createGame(ctx) {
  const { db, settings } = ctx;
  const memo = new Map(); // predmemorija vezana uz ctx.version (mijenja se pri svakoj admin izmjeni)
  const cached = (key, fn) => {
    const hit = memo.get(key);
    if (hit && hit.v === ctx.version) return hit.value;
    const value = fn();
    memo.set(key, { v: ctx.version, value });
    if (memo.size > 5000) memo.clear();
    return value;
  };

  const tz = () => settings.get('timezone', 'Europe/Zagreb');
  const resetTime = () => settings.get('reset_time', '00:00');
  const today = () => gameDate(ctx.now(), tz(), resetTime());
  const nowMs = () => ctx.now().getTime();
  const cfg = () => ({ ...GAME_DEFAULTS, ...settings.get('game', {}) });

  // ---------- Prijevoz ----------
  function transports(setId) {
    return cached(`tr:${setId || 'active'}`, () => {
      let set = setId ? db.get('SELECT id FROM transport_sets WHERE id = ?', setId) : null;
      if (!set) set = db.get('SELECT id FROM transport_sets WHERE active = 1 ORDER BY id LIMIT 1') || db.get('SELECT id FROM transport_sets ORDER BY id LIMIT 1');
      if (!set) return { setId: null, modes: [] };
      const modes = db.all('SELECT level, name, emoji, image, km, min_rarity, description FROM transport_modes WHERE set_id = ? ORDER BY level', set.id);
      return { setId: set.id, modes };
    });
  }
  const modeByLevel = (setId, level) => transports(setId).modes.find((m) => m.level === level) || null;
  const publicMode = (m) => m && { level: m.level, name: m.name, emoji: m.emoji, image: m.image, km: m.km, description: m.description };

  // ---------- Karte i rute ----------
  function mapBySlug(slug) {
    return cached(`map:${slug}`, () => db.get('SELECT * FROM maps WHERE slug = ? AND active = 1', slug));
  }
  function activeMaps() {
    return cached('maps', () => db.all('SELECT * FROM maps WHERE active = 1 ORDER BY sort_order, id'));
  }
  const countries = () => settings.get('countries', {});

  /**
   * Ruta karte s VIRTUALNIM kilometrima.
   * Glavni dio (polazište → cilj) razvlači se na total_km rute, a nastavak iza cilja (susjedna država) na ext_km —
   * u oba dijela točke dobivaju kilometre razmjerno zračnoj duljini dionica. Kilometri igre nisu cestovna udaljenost.
   */
  function routeFor(mapId) {
    return cached(`route:${mapId}`, () => {
      const route = db.get('SELECT * FROM routes WHERE map_id = ? AND active = 1 ORDER BY id LIMIT 1', mapId);
      if (!route) return null;
      const pts = db.all(`SELECT rc.position, rc.is_stop, rc.is_goal, rc.message, c.name, c.nickname, c.label, c.lat, c.lng, c.country
                          FROM route_checkpoints rc JOIN cities c ON c.id = rc.city_id
                          WHERE rc.route_id = ? ORDER BY rc.position`, route.id);
      if (pts.length < 2) return null;
      let goal = pts.findIndex((p) => p.is_goal);
      if (goal < 1) goal = pts.length - 1;
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + haversine(pts[i - 1], pts[i]));
      const mainLen = cum[goal] || 1, extLen = cum[pts.length - 1] - cum[goal];
      const extKm = extLen > 0 ? (route.ext_km > 0 ? route.ext_km : extLen * (route.total_km / mainLen)) : 0;
      const points = pts.map((p, i) => ({
        ...p, is_goal: i === goal ? 1 : 0,
        km: round1(i <= goal ? (cum[i] / mainLen) * route.total_km : route.total_km + ((cum[i] - cum[goal]) / extLen) * extKm),
      }));
      return { id: route.id, name: route.name, total_km: route.total_km, ext_km: round1(extKm), end_km: round1(route.total_km + extKm), real_km: route.real_km, goal_index: goal, points };
    });
  }
  /** Gdje je igrač za zadane kilometre: zadnja prijeđena postaja, sljedeća postaja, država, je li iza cilja. */
  function locate(route, km) {
    const pts = route.points;
    const k = Math.max(0, Math.min(km, route.end_km));
    let passed = pts[0], next = null;
    for (const p of pts) {
      if (!p.is_stop) continue;
      if (p.km <= k + 1e-6) passed = p; else if (!next) next = p;
    }
    const goal = pts[route.goal_index];
    const c = countries();
    const flagOf = (code) => (code && c[code] ? { code, name: c[code].name, flag: c[code].flag } : code ? { code, name: code.toUpperCase(), flag: '' } : null);
    return {
      km: k, beyond: k > route.total_km + 1e-6, at_end: k >= route.end_km - 1e-6,
      passed: passed && { name: passed.name, nickname: passed.nickname, message: passed.message, km: passed.km, label: passed.label, country: flagOf(passed.country) },
      next: next && { name: next.name, nickname: next.nickname, km: next.km, left: round1(next.km - k), label: next.label, country: flagOf(next.country) },
      goal: { name: goal.name, km: goal.km, left: round1(Math.max(0, goal.km - k)) },
      country: flagOf(passed.country),
    };
  }
  function publicMap(slug) {
    const map = mapBySlug(slug);
    if (!map) throw new HttpError(404, 'Karta ne postoji.');
    const route = routeFor(map.id);
    if (!route) throw new HttpError(404, 'Karta nema rutu.');
    return { slug: map.slug, name: map.name, flag: map.flag, route, countries: countries() };
  }

  // ---------- Izazovi i pitanja ----------
  function challengeFor(date, mapSlug) {
    return cached(`ch:${date}:${mapSlug}`, () =>
      db.get(`SELECT * FROM daily_challenges WHERE date = ? AND active = 1 AND scope IN (?, 'sve')
              ORDER BY CASE scope WHEN 'sve' THEN 1 ELSE 0 END LIMIT 1`, date, mapSlug));
  }
  function challengeQuestions(challengeId) {
    return cached(`cq:${challengeId}`, () => db.all(
      `SELECT dq.position, q.id, q.text, q.hint, q.answer_kind, q.sport_tag, q.prior_strength, q.difficulty,
              t.slug AS type, c.slug AS category_slug, c.name AS category_name, c.emoji AS category_emoji,
              nt.unit, nt.ref_date, nt.is_estimate
       FROM daily_challenge_questions dq
       JOIN questions q ON q.id = dq.question_id
       JOIN question_types t ON t.id = q.type_id
       JOIN question_categories c ON c.id = q.category_id
       LEFT JOIN numeric_targets nt ON nt.question_id = q.id
       WHERE dq.challenge_id = ? ORDER BY dq.position`, challengeId));
  }
  const publicQuestion = (q) => q && {
    position: q.position, text: q.text, hint: q.hint, type: q.type,
    category: { slug: q.category_slug, name: q.category_name, emoji: q.category_emoji },
    sport_tag: q.sport_tag, unit: q.unit || null, ref_date: q.ref_date || null,
  };

  /** Baza odgovora jednog pitanja + indeks za prepoznavanje (nikad se ne šalje klijentu). */
  function questionBase(questionId) {
    return cached(`qb:${questionId}`, () => {
      const q = db.get('SELECT id, answer_kind, prior_strength FROM questions WHERE id = ?', questionId);
      const answers = db.all('SELECT id, canonical, norm, prior_popularity, manual_rarity, explanation FROM accepted_answers WHERE question_id = ? AND active = 1', questionId);
      const byId = new Map(answers.map((a) => [a.id, a]));
      for (const a of answers) a.aliases = [];
      for (const al of db.all(`SELECT al.answer_id, al.alias FROM answer_aliases al JOIN accepted_answers a ON a.id = al.answer_id
                               WHERE a.question_id = ? AND a.active = 1`, questionId)) byId.get(al.answer_id)?.aliases.push(al.alias);
      return { question: q, answers, byId, index: buildIndex(answers, q?.answer_kind) };
    });
  }
  function frequencies(questionId) {
    const m = new Map();
    for (const r of db.all('SELECT answer_id, players FROM answer_frequency WHERE question_id = ?', questionId)) m.set(r.answer_id, r.players);
    return m;
  }
  function rarityTable(questionId) {
    const base = questionBase(questionId);
    const c = settings.get('rarity', {});
    return computeRarity(base.answers, frequencies(questionId), {
      priorStrength: base.question?.prior_strength ?? c.prior_strength ?? 200,
      wPercentile: c.w_percentile ?? 0.7, wBreadth: c.w_breadth ?? 0.3,
    });
  }
  function numericTarget(questionId) {
    return db.get('SELECT * FROM numeric_targets WHERE question_id = ?', questionId);
  }
  function thresholdsFor(target) {
    if (target?.thresholds_json) { try { return JSON.parse(target.thresholds_json); } catch { /* globalni */ } }
    return settings.get('numeric_thresholds', DEFAULT_NUMERIC_THRESHOLDS);
  }

  // ---------- Partije ----------
  const sessionRow = (id) => db.get(
    `SELECT s.*, c.date, c.finalized_at, m.slug AS map_slug FROM game_sessions s
     JOIN daily_challenges c ON c.id = s.challenge_id JOIN maps m ON m.id = s.map_id WHERE s.id = ?`, id);

  function ownSession(user, id) {
    const s = sessionRow(Number(id));
    if (!s || s.user_id !== user.id) throw new HttpError(404, 'Partija ne postoji.');
    return s;
  }

  // ---------- Tajmer pitanja (autoritativan na poslužitelju) ----------
  /** Pokreće sat za trenutno pitanje. Ne radi ništa ako sat već teče — osvježavanje stranice ga ne vraća na početak. */
  function beginQuestion(s) {
    if (s.finished_at || s.q_started_at) return s;
    const c = cfg(), t0 = nowMs();
    const prepEnd = t0 + Math.max(0, c.prep_seconds) * 1000, deadline = prepEnd + Math.max(1, c.answer_seconds) * 1000;
    db.run('UPDATE game_sessions SET q_started_at = ?, q_prep_end = ?, q_deadline = ?, q_draft = NULL WHERE id = ? AND q_started_at IS NULL', t0, prepEnd, deadline, s.id);
    return sessionRow(s.id);
  }
  const timingOf = (s) => (s.q_started_at && !s.finished_at ? { now: nowMs(), started_at: s.q_started_at, prep_end: s.q_prep_end, deadline: s.q_deadline } : null);
  const expired = (s) => !!s.q_started_at && !s.finished_at && nowMs() > s.q_deadline + cfg().grace_ms;

  const attemptsOf = (sessionId, position) => db.all('SELECT id, raw, norm, created_at FROM answer_attempts WHERE session_id = ? AND position = ? ORDER BY id', sessionId, position);

  /** Bilježi glas za statistiku rijetkosti: jedan igrač = jedan glas po pitanju, uz ograničenje po IP adresi. */
  function registerVote(s, questionId, answerId) {
    if (!s.official) return 0;
    if (db.get('SELECT 1 AS x FROM frequency_voters WHERE question_id = ? AND user_id = ?', questionId, s.user_id)) return 0;
    const cap = settings.get('rarity', {}).ip_cap ?? 3;
    if (s.ip_hash) {
      const same = db.get('SELECT COUNT(*) AS n FROM frequency_voters WHERE question_id = ? AND ip_hash = ?', questionId, s.ip_hash).n;
      if (same >= cap) return 0;
    }
    db.run('INSERT INTO frequency_voters (question_id, user_id, answer_id, ip_hash) VALUES (?, ?, ?, ?)', questionId, s.user_id, answerId, s.ip_hash || null);
    if (answerId) bumpFrequency(questionId, answerId, 1);
    return 1;
  }
  function bumpFrequency(questionId, answerId, delta) {
    db.run(`INSERT INTO answer_frequency (question_id, answer_id, players) VALUES (?, ?, MAX(0, ?))
            ON CONFLICT(question_id, answer_id) DO UPDATE SET players = MAX(0, players + ?)`, questionId, answerId, delta, delta);
  }

  /** Zaključuje trenutno pitanje: upisuje jedini konačni zapis, pomiče partiju i gasi sat. */
  function finalize(s, q, r) {
    const attempts = attemptsOf(s.id, q.position).length + (r.status === 'tocno' || r.value != null ? 1 : 0);
    const answerMs = s.q_prep_end ? Math.max(0, Math.min(nowMs(), s.q_deadline) - s.q_prep_end) : null;
    db.run(
      `INSERT INTO player_answers (session_id, question_id, position, raw, norm, answer_id, numeric_value, error_pct, is_correct, rarity, level, km, counted, status, attempts, answer_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      s.id, q.id, q.position, r.raw ?? '', r.norm ?? normalize(r.raw ?? ''), r.answerId ?? null, r.value ?? null, r.errorPct ?? null,
      r.km > 0 || r.status === 'tocno' ? 1 : 0, r.rarity ?? null, r.level || 0, r.km || 0, r.counted ?? 0, r.status, Math.max(1, attempts), answerMs, nowIso());
    const total = s.total_km + (r.km || 0);
    const last = q.position >= s.question_count;
    db.run(`UPDATE game_sessions SET total_km = ?, next_position = ?, reached_goal = ?, finished_at = ?,
              q_started_at = NULL, q_prep_end = NULL, q_deadline = NULL, q_draft = NULL WHERE id = ?`,
      total, q.position + 1, total >= s.route_km - 1e-6 ? 1 : 0, last ? nowIso() : null, s.id);
    if (last && s.official) refreshStreak(s.user_id);
    if (last) ctx.bumpBoards?.();
    if (last && s.official) ctx.onSessionFinished?.(s.id);   // obavijesti lige, izazovi (v2.3) — greška tamo ne smije srušiti igru
  }

  function scoreOpen(s, q, raw) {
    const base = questionBase(q.id);
    const m = matchOpen(base.index, raw);
    if (m.status === 'ambiguous') return { ambiguous: true, count: m.count };
    if (m.status !== 'match') return { correct: false, norm: m.norm };
    const table = rarityTable(q.id);            // rijetkost PRIJE vlastitog glasa
    const rarity = table.get(m.answerId)?.rarity ?? 50;
    const mode = levelForRarity(rarity, transports(s.transport_set_id).modes);
    return { correct: true, norm: m.norm, answerId: m.answerId, rarity, level: mode?.level || 1, km: mode?.km || 0 };
  }
  function scoreGuess(s, q, value) {
    const target = numericTarget(q.id);
    if (!target) throw new HttpError(500, 'Pitanje nema referentnu vrijednost.');
    const modes = transports(s.transport_set_id).modes;
    const maxLevel = modes.length ? Math.max(...modes.map((m) => m.level)) : 7;
    const r = scoreNumeric(target, value, thresholdsFor(target), maxLevel);
    const mode = r.level ? modeByLevel(s.transport_set_id, r.level) : null;
    return { value, errorPct: r.errorPct, rarity: r.accuracy, level: r.level, km: mode?.km || 0 };
  }

  /** Istek vremena: otvoreno pitanje = 0 km; procjena = zadnja spremljena vrijednost (ako je tako podešeno). */
  function finalizeTimeout(s, q) {
    if (q.type === 'numeric') {
      const value = s.q_draft != null ? parseNumber(s.q_draft) : null;
      if (value != null && cfg().numeric_timeout !== 'nula') {
        const sc = scoreGuess(s, q, value);
        return finalize(s, q, { ...sc, raw: s.q_draft, norm: String(value), status: sc.level > 0 ? 'tocno' : 'netocno', counted: s.official ? 1 : 0 });
      }
      return finalize(s, q, { raw: s.q_draft ?? '', status: 'isteklo', km: 0, level: 0 });
    }
    const tries = attemptsOf(s.id, q.position);
    const lastTry = tries[tries.length - 1];
    const counted = registerVote(s, q.id, null);
    finalize(s, q, { raw: lastTry?.raw ?? '', norm: lastTry?.norm ?? '', status: 'isteklo', km: 0, level: 0, counted });
  }
  /** Lijena provjera isteka: poziva se pri svakom dohvaćanju ili slanju, pa osvježavanje ne može produljiti vrijeme. */
  function expireIfNeeded(s) {
    if (!expired(s)) return s;
    const q = challengeQuestions(s.challenge_id).find((x) => x.position === s.next_position);
    if (q) finalizeTimeout(s, q); else db.run('UPDATE game_sessions SET q_started_at = NULL, q_prep_end = NULL, q_deadline = NULL WHERE id = ?', s.id);
    return sessionRow(s.id);
  }

  function start(user, { map: slug, date, replay }, ipHash) {
    if (user.is_blocked) throw new HttpError(403, 'Račun je blokiran.');
    const map = mapBySlug(String(slug || ''));
    if (!map) throw bad('Odaberi kartu.');
    const route = routeFor(map.id);
    if (!route) throw new HttpError(404, 'Karta nema rutu.');
    const now = today();
    const day = date || now;
    if (!isDate(day)) throw bad('Neispravan datum.');
    if (day > now) throw new HttpError(403, 'Taj izazov još nije objavljen.');
    const startDate = settings.get('start_date', null);
    if (startDate && day < startDate) throw new HttpError(404, 'Za taj datum nema izazova.');
    const challenge = challengeFor(day, map.slug);
    if (!challenge) throw new HttpError(404, 'Za taj datum nema izazova.');
    const questions = challengeQuestions(challenge.id);
    if (!questions.length) throw new HttpError(404, 'Izazov nema pitanja.');

    const official = db.get('SELECT id, finished_at FROM game_sessions WHERE user_id = ? AND challenge_id = ? AND map_id = ? AND official = 1', user.id, challenge.id, map.id);
    const wantOfficial = day === now && !replay;
    let id = null;
    if (wantOfficial && official) id = official.id;
    if (day === now && replay && !(official && official.finished_at)) throw new HttpError(409, 'Najprije završi službenu partiju.');
    if (!wantOfficial) {
      const open = db.get(`SELECT id FROM game_sessions WHERE user_id = ? AND challenge_id = ? AND map_id = ? AND official = 0 AND finished_at IS NULL
                           ORDER BY id DESC LIMIT 1`, user.id, challenge.id, map.id);
      if (open) id = open.id;
    }
    if (id == null) {
      const mode = wantOfficial ? 'dnevna' : (day === now ? 'ponovno' : 'arhiva');
      try {
        id = db.run(`INSERT INTO game_sessions (user_id, challenge_id, map_id, official, mode, question_count, route_km, transport_set_id, ip_hash, started_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          user.id, challenge.id, map.id, wantOfficial ? 1 : 0, mode, questions.length, route.total_km, transports().setId, ipHash || null, nowIso()).id;
      } catch (e) {
        // dva istovremena zahtjeva: jedinstveni indeks jamči jednu službenu partiju
        const again = db.get('SELECT id FROM game_sessions WHERE user_id = ? AND challenge_id = ? AND map_id = ? AND official = 1', user.id, challenge.id, map.id);
        if (!again) throw e;
        id = again.id;
      }
    }
    return next(user, id);
  }

  /** Pokreće sljedeće pitanje (ako nijedno ne teče) i vraća stanje. Idempotentno. */
  function next(user, sessionId) {
    db.tx(() => {
      let s = expireIfNeeded(ownSession(user, sessionId));
      if (!s.finished_at) beginQuestion(s);
    });
    return state(user, sessionId);
  }

  function answerView(a, s, q, reveal) {
    const mode = a.level ? modeByLevel(s.transport_set_id, a.level) : null;
    const base = a.answer_id ? questionBase(a.question_id).byId.get(a.answer_id) : null;
    const v = {
      position: a.position, raw: a.raw, correct: !!a.is_correct, status: a.status, level: a.level, km: a.km,
      rarity: a.rarity == null ? null : Math.round(a.rarity), transport: publicMode(mode),
      canonical: base?.canonical || null, explanation: base?.explanation || null,
      bonus: !!a.bonus, type: q?.type, attempts: a.attempts, answer_ms: a.answer_ms,
    };
    if (q?.type === 'numeric') {
      v.guess = a.numeric_value;
      v.unit = q.unit;
      if (reveal) {
        const t = numericTarget(a.question_id);
        if (t) Object.assign(v, { target: t.value, ref_date: t.ref_date, error_pct: a.error_pct == null ? null : round1(a.error_pct), is_estimate: !!t.is_estimate, target_note: t.note });
      }
    } else if (q) {
      const reported = new Set(db.all('SELECT norm FROM answer_reports WHERE session_id = ? AND position = ?', s.id, a.position).map((r) => r.norm));
      v.misses = attemptsOf(s.id, a.position).map((m) => ({ raw: m.raw, norm: m.norm, reported: reported.has(m.norm) }));
    }
    return v;
  }

  /**
   * Smije li igrač vidjeti točne brojke i tuđe odgovore? Tek kad je odigrao službene partije na svim
   * kartama tog dana ili kad je dan završio — inače bi prva karta otkrivala odgovore za drugu.
   */
  function spoilersUnlocked(user, s) {
    if (s.date < today()) return true;
    for (const m of activeMaps()) {
      const ch = challengeFor(s.date, m.slug);
      if (!ch) continue;
      const done = db.get('SELECT 1 AS x FROM game_sessions WHERE user_id = ? AND challenge_id = ? AND map_id = ? AND official = 1 AND finished_at IS NOT NULL', user.id, ch.id, m.id);
      if (!done) return false;
    }
    return true;
  }

  function state(user, sessionId) {
    const s = db.tx(() => expireIfNeeded(ownSession(user, sessionId)));
    const questions = challengeQuestions(s.challenge_id);
    const answers = db.all('SELECT * FROM player_answers WHERE session_id = ? ORDER BY position', s.id);
    const route = routeFor(s.map_id);
    const finished = !!s.finished_at;
    const running = !finished && !!s.q_started_at;
    const current = running ? questions.find((q) => q.position === s.next_position) : null;
    const upcoming = !finished && !running ? questions.find((q) => q.position === s.next_position) : null;
    const draft = current?.type === 'numeric' && s.q_draft != null ? { raw: s.q_draft, value: parseNumber(s.q_draft) } : null;
    return {
      session: {
        id: s.id, official: !!s.official, mode: s.mode, date: s.date, map: s.map_slug,
        next_position: s.next_position, question_count: s.question_count,
        total_km: round1(s.total_km), route_km: s.route_km, finished, reached_goal: !!s.reached_goal,
      },
      location: route ? locate(route, s.total_km) : null,
      question: publicQuestion(current),
      timing: timingOf(s),
      awaiting_next: !finished && !running,
      upcoming: upcoming && { position: upcoming.position, category: { name: upcoming.category_name, emoji: upcoming.category_emoji } },
      draft,
      misses: current && current.type !== 'numeric' ? attemptsOf(s.id, current.position).map((m) => m.raw) : [],
      rules: { retries: !!cfg().retries, max_attempts: cfg().max_attempts },
      answers: answers.map((a) => {
        const q = questions.find((x) => x.position === a.position);
        return { ...answerView(a, s, q, q?.type === 'numeric'), question: q?.text, category: q && { name: q.category_name, emoji: q.category_emoji, slug: q.category_slug } };
      }),
    };
  }

  /**
   * Slanje odgovora.
   *  - prije kraja pripreme: odbija se (425), ništa se ne bilježi;
   *  - neprepoznat odgovor: bilježi se kao pokušaj, pitanje ostaje otvoreno, sat teče dalje;
   *  - dvosmislen odgovor: traži se pojašnjenje, pitanje ostaje otvoreno;
   *  - prepoznat odgovor: pitanje se odmah zaključuje (jedan zapis, jedan glas za rijetkost);
   *  - procjena: sprema se i može se mijenjati; zaključuje se na `final` ili istekom vremena;
   *  - nakon isteka: pitanje se zaključuje s 0 km (odnosno sa spremljenom procjenom).
   */
  function answer(user, sessionId, position, raw, opts = {}) {
    const text = String(raw ?? '').trim().slice(0, 120);
    position = Number(position);
    const out = db.tx(() => {
      let s = ownSession(user, sessionId);
      const questions = challengeQuestions(s.challenge_id);
      const q = questions.find((x) => x.position === position);
      const done = () => db.get('SELECT * FROM player_answers WHERE session_id = ? AND position = ?', s.id, position);
      const existing = done();
      if (existing) return { duplicate: true, result: answerView(existing, s, q, false) };   // dupli klik, povratak veze
      if (s.finished_at) throw new HttpError(409, 'Partija je već završena.');
      if (position !== s.next_position || !q) throw new HttpError(409, 'Pitanje nije na redu.', { next_position: s.next_position });
      if (!s.q_started_at) throw new HttpError(409, 'Pitanje još nije pokrenuto.', { awaiting_next: true });
      if (expired(s)) {
        finalizeTimeout(s, q);
        return { timeout: true, result: answerView(done(), s, q, false) };
      }
      if (nowMs() < s.q_prep_end - 200) throw new HttpError(425, 'Pričekaj kraj pripreme.', { too_early: true, prep_end: s.q_prep_end, now: nowMs() });

      if (q.type === 'numeric') {
        if (text) {
          if (parseNumber(text) == null) throw bad('Upiši broj, npr. 1250 ili 41,5 mil.');
          db.run('UPDATE game_sessions SET q_draft = ? WHERE id = ?', text, s.id);
          s = sessionRow(s.id);
        }
        if (!opts.final) {
          if (!text) throw bad('Upiši procjenu.');
          return { saved: true };
        }
        if (s.q_draft == null) throw bad('Upiši procjenu.');
        const value = parseNumber(s.q_draft);
        const sc = scoreGuess(s, q, value);
        finalize(s, q, { ...sc, raw: s.q_draft, norm: String(value), status: sc.level > 0 ? 'tocno' : 'netocno', counted: s.official ? 1 : 0 });
        return { result: answerView(done(), s, q, true) };
      }

      if (!text) throw bad('Upiši odgovor.');
      const c = cfg();
      const scored = scoreOpen(s, q, text);
      if (scored.ambiguous) return { ambiguous: true, message: `Taj odgovor odgovara više osoba (${scored.count}). Dopiši ime.` };
      if (!scored.correct) {
        const tries = attemptsOf(s.id, position);
        if (!tries.some((t) => t.norm === scored.norm) && tries.length < c.max_attempts) {
          db.run('INSERT INTO answer_attempts (session_id, question_id, position, raw, norm, created_at) VALUES (?, ?, ?, ?, ?, ?)', s.id, q.id, position, text, scored.norm, nowIso());
        }
        if (!c.retries) {
          const counted = registerVote(s, q.id, null);
          finalize(s, q, { raw: text, norm: scored.norm, status: 'netocno', km: 0, level: 0, counted });
          return { result: answerView(done(), s, q, false) };
        }
        const used = attemptsOf(s.id, position).length;
        return { retry: true, message: settings.get('messages', {}).retry || 'To nije taj odgovor. Pokušaj ponovno!', attempts_left: Math.max(0, c.max_attempts - used) };
      }
      const counted = registerVote(s, q.id, scored.answerId);
      finalize(s, q, { ...scored, raw: text, status: 'tocno', counted });
      return { result: answerView(done(), s, q, false) };
    });
    return { ...out, ...state(user, sessionId) };
  }

  function refreshStreak(userId) {
    const dates = db.all(`SELECT DISTINCT c.date FROM game_sessions s JOIN daily_challenges c ON c.id = s.challenge_id
                          WHERE s.user_id = ? AND s.official = 1 AND s.finished_at IS NOT NULL ORDER BY c.date`, userId).map((r) => r.date);
    const st = computeStreak(dates, today());
    db.run(`INSERT INTO daily_streaks (user_id, current_streak, best_streak, last_date, days_played) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET current_streak = excluded.current_streak, best_streak = excluded.best_streak,
              last_date = excluded.last_date, days_played = excluded.days_played`, userId, st.current, st.best, st.last, st.days);
    return st;
  }
  function streakOf(userId) {
    const r = db.get('SELECT * FROM daily_streaks WHERE user_id = ?', userId);
    if (!r) return { current: 0, best: 0, days: 0, last: null };
    const now = today();
    const gap = r.last_date ? Math.round((Date.parse(now) - Date.parse(r.last_date)) / 86400000) : 99;
    return { current: gap <= 1 ? r.current_streak : 0, best: r.best_streak, days: r.days_played, last: r.last_date, played_today: gap === 0 };
  }

  /** Igrač prijavljuje neprepoznat pokušaj za koji misli da je točan (`raw` = koji pokušaj; inače zadnji). */
  function report(user, sessionId, position, raw, note) {
    const s = ownSession(user, sessionId);
    position = Number(position);
    const q = challengeQuestions(s.challenge_id).find((x) => x.position === position);
    if (!q) throw new HttpError(404, 'Pitanje ne postoji.');
    if (q.type !== 'open') throw bad('Prijava je moguća samo za otvorena pitanja.');
    const tries = attemptsOf(s.id, position);
    const norm = raw ? normalize(raw) : tries[tries.length - 1]?.norm;
    const hit = tries.find((t) => t.norm === norm);
    if (!hit) throw new HttpError(404, 'Taj odgovor nije zabilježen u ovoj partiji.');
    if (db.get('SELECT 1 AS x FROM answer_reports WHERE session_id = ? AND position = ? AND norm = ?', s.id, position, hit.norm)) return { ok: true, already: true };
    const pa = db.get('SELECT id FROM player_answers WHERE session_id = ? AND position = ?', s.id, position);
    db.run('INSERT INTO answer_reports (player_answer_id, session_id, position, question_id, user_id, raw, norm, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      pa?.id ?? null, s.id, position, q.id, user.id, hit.raw, hit.norm, String(note || '').slice(0, 300) || null, nowIso());
    return { ok: true };
  }

  // ---------- Rezultat i usporedba ----------
  function result(user, sessionId) {
    const s = db.tx(() => expireIfNeeded(ownSession(user, sessionId)));
    if (!s.finished_at) throw new HttpError(409, 'Partija još nije završena.');
    const questions = challengeQuestions(s.challenge_id);
    const reveal = spoilersUnlocked(user, s);
    const answers = db.all('SELECT * FROM player_answers WHERE session_id = ? ORDER BY position', s.id);
    const perQuestion = new Map(db.all(
      `SELECT pa.position, COUNT(*) AS n, SUM(pa.is_correct) AS ok, AVG(pa.km) AS avg_km
       FROM player_answers pa JOIN game_sessions gs ON gs.id = pa.session_id
       WHERE gs.challenge_id = ? AND gs.official = 1 GROUP BY pa.position`, s.challenge_id).map((r) => [r.position, r]));
    const items = answers.map((a) => {
      const q = questions.find((x) => x.position === a.position);
      const agg = perQuestion.get(a.position);
      const item = {
        ...answerView(a, s, q, reveal || q?.type === 'numeric'), question: q?.text, hint: q?.hint,
        category: q && { name: q.category_name, emoji: q.category_emoji, slug: q.category_slug },
        players: agg?.n || 0, correct_share: agg?.n ? Math.round((agg.ok / agg.n) * 100) : null,
      };
      if (reveal && q?.type === 'open') {
        const top = db.all(`SELECT a.canonical, f.players FROM answer_frequency f JOIN accepted_answers a ON a.id = f.answer_id
                            WHERE f.question_id = ? AND f.players > 0 ORDER BY f.players DESC, a.canonical LIMIT 5`, q.id);
        const totalVotes = db.get('SELECT COALESCE(SUM(players),0) AS n FROM answer_frequency WHERE question_id = ?', q.id).n;
        item.top_answers = top.map((t) => ({ answer: t.canonical, share: totalVotes ? Math.round((t.players / totalVotes) * 100) : 0 }));
        item.base_size = questionBase(q.id).answers.length;
      }
      return item;
    });
    const board = db.get(`SELECT COUNT(*) AS players, AVG(total_km) AS avg_km, SUM(reached_goal) AS goals, MAX(total_km) AS max_km,
                                 SUM(CASE WHEN total_km > ? THEN 1 ELSE 0 END) AS better,
                                 SUM(CASE WHEN total_km < ? THEN 1 ELSE 0 END) AS worse
                          FROM game_sessions WHERE challenge_id = ? AND map_id = ? AND official = 1 AND finished_at IS NOT NULL`,
      s.total_km, s.total_km, s.challenge_id, s.map_id);
    const route = routeFor(s.map_id);
    // Raspodjela: gdje su danas stali igrači (stupci po 100 km do kraja produžene rute).
    const step = 100, binCount = Math.max(1, Math.ceil((route?.end_km || s.route_km) / step));
    const bins = Array.from({ length: binCount }, (_, i) => ({ from: i * step, count: 0 }));
    for (const r of db.all(`SELECT MIN(CAST(total_km / ${step} AS INTEGER), ${binCount - 1}) AS b, COUNT(*) AS n FROM game_sessions
                            WHERE challenge_id = ? AND map_id = ? AND official = 1 AND finished_at IS NOT NULL GROUP BY b`, s.challenge_id, s.map_id)) bins[r.b].count = r.n;
    const others = Math.max(0, board.players - (s.official ? 1 : 0));
    return {
      session: { id: s.id, official: !!s.official, mode: s.mode, date: s.date, map: s.map_slug, total_km: round1(s.total_km), route_km: s.route_km, reached_goal: !!s.reached_goal, finished_at: s.finished_at, question_count: s.question_count },
      location: route ? locate(route, s.total_km) : null,
      answers: items,
      spoilers_unlocked: reveal,
      comparison: {
        players: board.players, avg_km: round1(board.avg_km || 0), goals: board.goals || 0, max_km: round1(board.max_km || 0),
        rank: s.official ? (board.better || 0) + 1 : null,
        would_rank: !s.official ? (board.better || 0) + 1 : null,
        behind: board.worse || 0, ahead: board.better || 0,
        further_than_pct: others > 0 ? Math.round(((board.worse || 0) / others) * 100) : null,
        bins, step,
      },
      streak: streakOf(user.id),
    };
  }

  // ---------- Naknadni obračuni ----------
  function recomputeSessionTotals(sessionIds) {
    for (const id of sessionIds) {
      const s = db.get('SELECT id, route_km, user_id FROM game_sessions WHERE id = ?', id);
      if (!s) continue;
      const total = db.get('SELECT COALESCE(SUM(km),0) AS t FROM player_answers WHERE session_id = ?', id).t;
      db.run('UPDATE game_sessions SET total_km = ?, reached_goal = ? WHERE id = ?', total, total >= s.route_km - 1e-6 ? 1 : 0, id);
    }
    ctx.bumpBoards?.();
  }

  /**
   * Ponovno boduje odgovore na jedno pitanje.
   * mode 'novi' — priznaje samo pitanja koja su igraču dosad bila bez kilometara, a neki od njegovih pokušaja je
   *               sada u bazi (nitko ne gubi kilometre);
   * mode 'sve'  — iznova gradi statistiku učestalosti i boduje sve odgovore prema trenutnoj bazi i postavkama.
   */
  function recalcQuestion(questionId, mode = 'novi') {
    ctx.version++;
    return db.tx(() => {
      const q = db.get('SELECT q.id, t.slug AS type FROM questions q JOIN question_types t ON t.id = q.type_id WHERE q.id = ?', questionId);
      if (!q) throw new HttpError(404, 'Pitanje ne postoji.');
      const rows = db.all(`SELECT pa.*, s.official, s.user_id, s.ip_hash, s.transport_set_id FROM player_answers pa
                           JOIN game_sessions s ON s.id = pa.session_id WHERE pa.question_id = ? ORDER BY pa.created_at, pa.id`, questionId);
      const touched = new Set();
      let changed = 0;
      if (q.type === 'numeric') {
        const target = numericTarget(questionId);
        for (const pa of rows) {
          if (pa.numeric_value == null || !target) continue;
          const modes = transports(pa.transport_set_id).modes;
          const r = scoreNumeric(target, pa.numeric_value, thresholdsFor(target), modes.length ? Math.max(...modes.map((m) => m.level)) : 7);
          let level = r.level;
          if (pa.bonus && mode !== 'sve') level = Math.max(level, pa.level);
          const km = level ? (modeByLevel(pa.transport_set_id, level)?.km || 0) : 0;
          if (level !== pa.level || Math.abs(km - pa.km) > 1e-9 || Math.abs((pa.error_pct ?? -1) - r.errorPct) > 1e-9) {
            db.run('UPDATE player_answers SET error_pct = ?, is_correct = ?, status = ?, rarity = ?, level = ?, km = ?, bonus = ? WHERE id = ?',
              r.errorPct, level > 0 ? 1 : 0, level > 0 ? 'tocno' : 'netocno', r.accuracy, level, km, mode === 'sve' ? 0 : pa.bonus, pa.id);
            touched.add(pa.session_id); changed++;
          }
        }
      } else {
        const base = questionBase(questionId);
        // Kandidati jednog igrača redom kojim ih je upisao: neprepoznati pokušaji pa konačni odgovor.
        const candidates = (pa) => {
          const list = attemptsOf(pa.session_id, pa.position).map((t) => t.raw);
          if (pa.raw && !list.includes(pa.raw)) list.push(pa.raw);
          return list;
        };
        const firstMatch = (pa) => {
          for (const raw of candidates(pa)) {
            const m = matchOpen(base.index, raw);
            if (m.status === 'match') return { answerId: m.answerId, raw, norm: m.norm };
          }
          return null;
        };
        const markResolved = (pa, norm) => db.run('UPDATE answer_attempts SET resolved = 1 WHERE session_id = ? AND position = ? AND norm = ?', pa.session_id, pa.position, norm);
        if (mode === 'sve') {
          db.run('DELETE FROM answer_frequency WHERE question_id = ?', questionId);
          db.run('DELETE FROM frequency_voters WHERE question_id = ?', questionId);
          db.run('UPDATE answer_attempts SET resolved = 0 WHERE question_id = ?', questionId);
          const matches = new Map();
          for (const pa of rows) {
            const m = firstMatch(pa);
            matches.set(pa.id, m);
            const counted = registerVote({ official: pa.official, user_id: pa.user_id, ip_hash: pa.ip_hash }, questionId, m?.answerId ?? null);
            db.run('UPDATE player_answers SET counted = ? WHERE id = ?', counted, pa.id);
          }
          const table = rarityTable(questionId);
          for (const pa of rows) {
            const m = matches.get(pa.id);
            let rarity = null, level = 0, km = 0;
            if (m) {
              rarity = table.get(m.answerId)?.rarity ?? 50;
              const md = levelForRarity(rarity, transports(pa.transport_set_id).modes);
              level = md?.level || 1; km = md?.km || 0;
              markResolved(pa, m.norm);
            }
            if ((m?.answerId ?? null) !== pa.answer_id || level !== pa.level || Math.abs(km - pa.km) > 1e-9) { touched.add(pa.session_id); changed++; }
            const status = m ? 'tocno' : (pa.status === 'isteklo' ? 'isteklo' : 'netocno');
            db.run('UPDATE player_answers SET answer_id = ?, raw = ?, norm = ?, is_correct = ?, status = ?, rarity = ?, level = ?, km = ? WHERE id = ?',
              m?.answerId ?? null, m ? m.raw : pa.raw, m ? m.norm : pa.norm, m ? 1 : 0, status, rarity, level, km, pa.id);
          }
        } else {
          const table = rarityTable(questionId);   // ista tablica za sve naknadno priznate — nitko nije oštećen redoslijedom
          for (const pa of rows) {
            if (pa.is_correct) continue;
            const m = firstMatch(pa);
            if (!m) continue;
            const rarity = table.get(m.answerId)?.rarity ?? 50;
            const md = levelForRarity(rarity, transports(pa.transport_set_id).modes);
            db.run(`UPDATE player_answers SET answer_id = ?, raw = ?, norm = ?, is_correct = 1, status = 'tocno', rarity = ?, level = ?, km = ? WHERE id = ?`,
              m.answerId, m.raw, m.norm, rarity, md?.level || 1, md?.km || 0, pa.id);
            markResolved(pa, m.norm);
            if (pa.counted) {
              db.run('UPDATE frequency_voters SET answer_id = ? WHERE question_id = ? AND user_id = ?', m.answerId, questionId, pa.user_id);
              bumpFrequency(questionId, m.answerId, 1);
            }
            touched.add(pa.session_id); changed++;
          }
          // pokušaji igrača koji su kasnije ipak pogodili drugi odgovor: samo ih označi riješenima
          for (const t of db.all('SELECT id, raw FROM answer_attempts WHERE question_id = ? AND resolved = 0', questionId)) {
            if (matchOpen(base.index, t.raw).status === 'match') db.run('UPDATE answer_attempts SET resolved = 1 WHERE id = ?', t.id);
          }
        }
      }
      recomputeSessionTotals(touched);
      return { changed, sessions: touched.size };
    });
  }

  /** Zaključuje dan: najbliža procjena na pitanjima s načinom 'pragovi+najblizi' dobiva najvišu razinu. */
  function finalizeChallenge(challengeId) {
    return db.tx(() => {
      const ch = db.get('SELECT * FROM daily_challenges WHERE id = ?', challengeId);
      if (!ch || ch.finalized_at) return { finalized: false };
      const touched = new Set();
      let winners = 0;
      for (const q of challengeQuestions(challengeId).filter((x) => x.type === 'numeric')) {
        const target = numericTarget(q.id);
        if (!target || target.scoring_mode !== 'pragovi+najblizi') continue;
        const guesses = db.all(`SELECT pa.id, pa.session_id, pa.numeric_value, pa.created_at, pa.level, s.transport_set_id
                                FROM player_answers pa JOIN game_sessions s ON s.id = pa.session_id
                                WHERE pa.question_id = ? AND s.challenge_id = ? AND s.official = 1 AND pa.numeric_value IS NOT NULL`, q.id, challengeId)
          .map((g) => ({ ...g, absError: Math.abs(g.numeric_value - target.value) }));
        const ids = new Set(closestGuesses(guesses, target.tie_rule));
        for (const g of guesses) {
          if (!ids.has(g.id)) continue;
          const modes = transports(g.transport_set_id).modes;
          const top = modes[modes.length - 1];
          if (!top) continue;
          db.run(`UPDATE player_answers SET bonus = 1, is_correct = 1, status = 'tocno', level = ?, km = ? WHERE id = ?`, top.level, top.km, g.id);
          touched.add(g.session_id); winners++;
        }
      }
      db.run('UPDATE daily_challenges SET finalized_at = ? WHERE id = ?', nowIso(), challengeId);
      recomputeSessionTotals(touched);
      ctx.version++;
      return { finalized: true, winners };
    });
  }
  let lastFinalizeCheck = '';
  function finalizePastDays() {
    const now = today();
    if (lastFinalizeCheck === now) return;
    lastFinalizeCheck = now;
    for (const c of db.all('SELECT id FROM daily_challenges WHERE date < ? AND finalized_at IS NULL', now)) finalizeChallenge(c.id);
  }

  // ---------- Početni podaci za naslovnicu ----------
  function bootstrap(user) {
    finalizePastDays();
    const now = today();
    const startDate = settings.get('start_date', null);
    const dayNo = startDate ? Math.round((Date.parse(now) - Date.parse(startDate)) / 86400000) + 1 : null;
    const maps = activeMaps().map((m) => {
      const route = routeFor(m.id);
      const ch = challengeFor(now, m.slug);
      const stops = route ? route.points.filter((p) => p.is_stop) : [];
      const goal = route ? route.points[route.goal_index] : null;
      const mine = user && ch ? db.get('SELECT id, total_km, finished_at, next_position, question_count, reached_goal FROM game_sessions WHERE user_id = ? AND challenge_id = ? AND map_id = ? AND official = 1', user.id, ch.id, m.id) : null;
      const count = ch ? db.get('SELECT COUNT(*) AS n FROM game_sessions WHERE challenge_id = ? AND map_id = ? AND official = 1 AND finished_at IS NOT NULL', ch.id, m.id).n : 0;
      const where = mine && route ? locate(route, mine.total_km) : null;
      return {
        slug: m.slug, name: m.name, flag: m.flag, route_km: route?.total_km || 0, end_km: route?.end_km || 0,
        from: stops[0] && { name: stops[0].name, nickname: stops[0].nickname },
        to: goal ? { name: goal.name, nickname: goal.nickname } : null,
        beyond: route ? [...new Set(route.points.slice(route.goal_index + 1).map((p) => p.country).filter((c) => c && c !== goal.country))] : [],
        has_challenge: !!ch, questions: ch ? challengeQuestions(ch.id).length : 0, players_today: count,
        mine: mine && { session_id: mine.id, total_km: round1(mine.total_km), finished: !!mine.finished_at, answered: mine.next_position - 1, question_count: mine.question_count, reached_goal: !!mine.reached_goal, at: where?.passed ? (where.passed.label === 'granica' ? `Granica — ${where.passed.country?.name || ''}` : where.passed.name) : null, at_country: where?.passed?.country?.code || null },
      };
    });
    const first = activeMaps()[0];
    const ch = first ? challengeFor(now, first.slug) : null;
    const cats = ch ? challengeQuestions(ch.id).map((q) => ({ name: q.category_name, emoji: q.category_emoji, slug: q.category_slug })) : [];
    const c = cfg();
    return {
      date: now, day_no: dayNo && dayNo > 0 ? dayNo : null, next_reset: nextReset(ctx.now(), tz(), resetTime()), maps,
      challenge: ch ? { questions: cats.length, categories: cats, title: ch.title } : null,
      transports: transports().modes.map(publicMode),
      game: { questions_per_day: c.questions_per_day, prep_seconds: c.prep_seconds, answer_seconds: c.answer_seconds, retries: !!c.retries },
      countries: countries(),
      streak: user ? streakOf(user.id) : null,
    };
  }

  function archive(user) {
    const now = today();
    const startDate = settings.get('start_date', '0000-00-00');
    const days = db.all(`SELECT c.id, c.date, c.scope, c.title FROM daily_challenges c
                         WHERE c.active = 1 AND c.date < ? AND c.date >= ? ORDER BY c.date DESC LIMIT 400`, now, startDate || '0000-00-00');
    const mine = user ? db.all(`SELECT s.challenge_id, m.slug, s.official, MAX(s.total_km) AS km, MAX(s.finished_at IS NOT NULL) AS finished
                                FROM game_sessions s JOIN maps m ON m.id = s.map_id WHERE s.user_id = ? GROUP BY s.challenge_id, m.slug, s.official`, user.id) : [];
    return days.map((d) => ({
      date: d.date, title: d.title, scope: d.scope,
      categories: challengeQuestions(d.id).map((q) => q.category_emoji),
      played: mine.filter((x) => x.challenge_id === d.id && x.finished).map((x) => ({ map: x.slug, official: !!x.official, km: round1(x.km) })),
    }));
  }

  return {
    today, cfg, transports, publicMode, modeByLevel, mapBySlug, activeMaps, routeFor, locate, publicMap, countries,
    challengeFor, challengeQuestions, questionBase, rarityTable, frequencies, numericTarget, thresholdsFor,
    start, next, state, answer, report, result, bootstrap, archive,
    refreshStreak, streakOf, recalcQuestion, finalizeChallenge, finalizePastDays, recomputeSessionTotals, spoilersUnlocked,
  };
}
