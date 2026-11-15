// Putokazi: kratka poruka igrača na ruti, vezana uz njegovu službenu partiju dana.
// Vide je članovi zajedničkih liga u utrci tog dana; tekst se otkriva tek kad gledatelj i sam odigra tu kartu (ili dan prođe).
import { nowIso, HttpError, bad, round1 } from './util.js';
import { checkPublicText } from './tekst.js';

export const SHAPES = ['zeleni', 'zuti', 'plavi', 'smedi'];
const MAX_EDITS = 10;

export function createSigns(ctx) {
  const { db, settings, game } = ctx;
  const cfg = () => ({ max_len: 60, enabled: true, history: true, extra_words: [], ...settings.get('signposts', {}) });
  const need = (user) => { if (!user || user.is_guest) throw new HttpError(401, 'Putokaz mogu ostaviti registrirani igrači.'); return user; };

  function ownSession(user, sessionId) {
    const s = db.get(`SELECT s.id, s.user_id, s.official, s.finished_at, s.total_km, s.map_id, c.date, m.slug AS map FROM game_sessions s
                      JOIN daily_challenges c ON c.id = s.challenge_id JOIN maps m ON m.id = s.map_id WHERE s.id = ?`, Number(sessionId));
    if (!s || s.user_id !== user.id) throw new HttpError(404, 'Partija ne postoji.');
    if (!s.official || !s.finished_at) throw bad('Putokaz se ostavlja nakon završene službene partije.');
    return s;
  }
  const view = (r) => r && { id: r.id, session_id: r.session_id, text: r.text, shape: r.shape, km: round1(r.km), date: r.date, edits: r.edits, editable: r.date === game.today(), status: r.status };

  function mine(user, sessionId) {
    need(user);
    const s = ownSession(user, sessionId);
    const r = db.get('SELECT * FROM route_sign_messages WHERE session_id = ?', s.id);
    return { sign: r && r.status === 'aktivan' ? view(r) : null, removed: r?.status === 'uklonjen', can_edit: s.date === game.today() && cfg().enabled, max_len: cfg().max_len, shapes: SHAPES, km: round1(s.total_km) };
  }

  /** Sprema ili mijenja putokaz za partiju. Jedan po službenoj partiji; samo dok traje taj dan. */
  function save(user, { session_id, text, shape }) {
    need(user);
    const c = cfg();
    if (!c.enabled) throw new HttpError(403, 'Putokazi su trenutačno isključeni.');
    const s = ownSession(user, session_id);
    if (s.date !== game.today()) throw bad('Putokaz se može postaviti samo za današnju partiju.');
    const sh = SHAPES.includes(shape) ? shape : 'zeleni';
    const t = checkPublicText(text, { max: c.max_len, extra: c.extra_words || [] });
    const existing = db.get('SELECT * FROM route_sign_messages WHERE session_id = ?', s.id);
    if (existing?.status === 'uklonjen') throw new HttpError(403, 'Administrator je uklonio tvoj današnji putokaz.');
    if (existing && existing.edits >= MAX_EDITS) throw new HttpError(429, 'Putokaz je danas mijenjan previše puta.');
    if (existing) db.run('UPDATE route_sign_messages SET text = ?, shape = ?, km = ?, edits = edits + 1, updated_at = ? WHERE id = ?', t, sh, s.total_km, nowIso(), existing.id);
    else db.run('INSERT INTO route_sign_messages (user_id, session_id, date, map_id, km, text, shape, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', user.id, s.id, s.date, s.map_id, s.total_km, t, sh, nowIso(), nowIso());
    ctx.bumpBoards();
    return mine(user, s.id);
  }
  function remove(user, sessionId) {
    need(user);
    const s = ownSession(user, sessionId);
    const r = db.get('SELECT * FROM route_sign_messages WHERE session_id = ?', s.id);
    if (!r) throw new HttpError(404, 'Putokaz ne postoji.');
    if (r.status === 'uklonjen') throw new HttpError(403, 'Putokaz je uklonio administrator.');
    db.run('DELETE FROM route_sign_messages WHERE id = ?', r.id);
    ctx.bumpBoards();
    return { ok: true };
  }

  /**
   * Putokazi za utrku lige (dan + karta). Tekst se ne šalje gledatelju koji danas još nije odigrao tu kartu,
   * osim njegovog vlastitog. Sakriveni (kod gledatelja) i uklonjeni ne prikazuju se.
   */
  function forLeague(viewer, leagueId, date, mapSlug) {
    const today = game.today();
    if (date < today && !cfg().history) return { signs: [], locked: false };
    const map = game.mapBySlug(mapSlug);
    if (!map) return { signs: [], locked: false };
    const rows = db.all(`SELECT r.*, p.nickname, p.avatar FROM route_sign_messages r JOIN league_members m ON m.user_id = r.user_id AND m.league_id = ?
                         JOIN users u ON u.id = r.user_id JOIN profiles p ON p.user_id = r.user_id
                         WHERE r.date = ? AND r.map_id = ? AND r.status = 'aktivan' AND u.is_blocked = 0
                         AND r.id NOT IN (SELECT sign_id FROM sign_hidden WHERE user_id = ?)
                         AND r.user_id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = ?)`, leagueId, date, map.id, viewer.id, viewer.id);
    const seen = date < today || !!db.get('SELECT 1 AS x FROM leaderboards WHERE user_id = ? AND date = ? AND map = ?', viewer.id, date, mapSlug);
    return {
      locked: !seen,
      signs: rows.map((r) => ({ id: r.id, user_id: r.user_id, nickname: r.nickname, avatar: r.avatar, self: r.user_id === viewer.id, km: round1(r.km), shape: r.shape,
        text: seen || r.user_id === viewer.id ? r.text : null })),
    };
  }
  function hideFor(user, signId) {
    need(user);
    if (!db.get('SELECT 1 AS x FROM route_sign_messages WHERE id = ?', Number(signId))) throw new HttpError(404, 'Putokaz ne postoji.');
    db.run('INSERT OR IGNORE INTO sign_hidden (user_id, sign_id) VALUES (?, ?)', user.id, Number(signId));
    return { ok: true };
  }
  function report(user, signId, reason) {
    need(user);
    const r = db.get('SELECT * FROM route_sign_messages WHERE id = ?', Number(signId));
    if (!r) throw new HttpError(404, 'Putokaz ne postoji.');
    if (r.user_id === user.id) throw bad('Ne možeš prijaviti svoj putokaz.');
    db.run('INSERT OR IGNORE INTO sign_reports (sign_id, reporter_id, reason, created_at) VALUES (?, ?, ?, ?)', r.id, user.id, String(reason || '').trim().slice(0, 300) || null, nowIso());
    db.run('INSERT OR IGNORE INTO sign_hidden (user_id, sign_id) VALUES (?, ?)', user.id, r.id);   // prijavljeni putokaz prijavitelju se odmah skriva
    return { ok: true };
  }

  return { cfg, mine, save, remove, forLeague, hideFor, report };
}
