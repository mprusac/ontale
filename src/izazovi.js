// Izazovi među prijateljima: dvoboj na službenoj dnevnoj partiji istog dana i iste karte.
// Ne mijenja igru: nema dodatnih kilometara ni dodatne partije. Rezultat računa isključivo poslužitelj iz službenih partija.
import { nowIso, HttpError, bad, isDate, addDays, round1 } from './util.js';
import { cleanText, hasLink, profanity } from './tekst.js';

const ACTIVE = ['ceka', 'prihvacen'];

export function createDuels(ctx) {
  const { db, game } = ctx;
  const N = () => ctx.notifications;
  const need = (user) => { if (!user || user.is_guest) throw new HttpError(401, 'Izazovi su dostupni registriranim igračima.'); return user; };
  const nick = (id) => db.get('SELECT nickname FROM profiles WHERE user_id = ?', id)?.nickname || 'Igrač';
  const event = (id, userId, ev) => db.run('INSERT INTO challenge_events (challenge_id, user_id, event, created_at) VALUES (?, ?, ?, ?)', id, userId, ev, nowIso());

  /** Službeni rezultat igrača za dan i kartu (ili null ako nije završio). */
  function official(userId, date, mapId) {
    const s = db.get(`SELECT s.id, s.total_km, s.reached_goal, s.finished_at FROM game_sessions s JOIN daily_challenges c ON c.id = s.challenge_id
                      WHERE s.user_id = ? AND c.date = ? AND s.map_id = ? AND s.official = 1 AND s.finished_at IS NOT NULL`, userId, date, mapId);
    if (!s) return null;
    const rare = db.get("SELECT COUNT(*) AS n FROM player_answers WHERE session_id = ? AND is_correct = 1 AND level >= 6", s.id).n;
    const map = db.get('SELECT slug FROM maps WHERE id = ?', mapId).slug;
    const better = db.get('SELECT COUNT(*) AS n FROM leaderboards WHERE date = ? AND map = ? AND is_guest = 0 AND (total_km > ? OR (total_km = ? AND finished_at < ?))', date, map, s.total_km, s.total_km, s.finished_at).n;
    return { session_id: s.id, km: round1(s.total_km), reached_goal: !!s.reached_goal, rare, rank: better + 1, finished_at: s.finished_at };
  }

  function create(user, { opponent_id, nickname, map, date, message }) {
    need(user);
    const opp = opponent_id ? db.get('SELECT u.id FROM users u WHERE u.id = ?', Number(opponent_id)) : db.get('SELECT user_id AS id FROM profiles WHERE nickname = ? COLLATE NOCASE', String(nickname || ''));
    if (!opp) throw new HttpError(404, 'Igrač ne postoji.');
    const why = ctx.messages.contactDenied(user.id, opp.id);
    if (why) throw new HttpError(403, why.replace('prima poruke', 'prima izazove'));
    const m = game.mapBySlug(map);
    if (!m) throw bad('Odaberi kartu.');
    const today = game.today();
    const day = date && isDate(date) ? date : today;
    if (day < today || day > addDays(today, 7)) throw bad('Izazov može biti za danas ili za jedan od sljedećih sedam dana.');
    let msg = message ? cleanText(message).slice(0, 140) : null;
    if (msg && (hasLink(msg) || profanity(msg))) throw bad('Poruka uz izazov ne smije imati poveznice ni psovke.');
    // Bez duplikata: jedan aktivan izazov po paru, karti i danu (u bilo kojem smjeru)
    const dup = db.get(`SELECT id FROM player_challenges WHERE map_id = ? AND date = ? AND status IN ('ceka','prihvacen')
                        AND ((challenger_id = ? AND opponent_id = ?) OR (challenger_id = ? AND opponent_id = ?))`, m.id, day, user.id, opp.id, opp.id, user.id);
    if (dup) throw new HttpError(409, 'Već postoji izazov između vas za taj dan i kartu.');
    // Protiv navaljivanja: najviše 15 izazova dnevno; nakon 3 odbijena od istog igrača u 7 dana — pauza
    if (!ctx.config.rateLimitDisabled && db.get('SELECT COUNT(*) AS n FROM player_challenges WHERE challenger_id = ? AND created_at > ?', user.id, new Date(Date.now() - 86400000).toISOString()).n >= 15) throw new HttpError(429, 'Danas si poslao dovoljno izazova.');
    if (db.get("SELECT COUNT(*) AS n FROM player_challenges WHERE challenger_id = ? AND opponent_id = ? AND status = 'odbijen' AND responded_at > ?", user.id, opp.id, new Date(Date.now() - 7 * 86400000).toISOString()).n >= 3) throw new HttpError(429, `${nick(opp.id)} je odbio nekoliko tvojih izazova. Pokušaj za koji dan.`);
    const already = official(opp.id, day, m.id);
    if (already && day === today) throw bad(`${nick(opp.id)} je danas već odigrao tu kartu. Izazovi ga za neki od sljedećih dana.`);
    const id = db.run('INSERT INTO player_challenges (challenger_id, opponent_id, map_id, date, message, created_at) VALUES (?, ?, ?, ?, ?, ?)', user.id, opp.id, m.id, day, msg, nowIso()).id;
    event(id, user.id, 'poslan');
    N().notify(opp.id, 'izazov', { emoji: '🥊', title: `${user.nickname} te izaziva!`, body: `${m.name}, ${day === today ? 'danas' : day}${msg ? ` — „${msg}“` : ''}`, link: '/izazovi', dedupe: `izazov:${id}:poslan`, data: { challenge: id } });
    return get(user, id);
  }

  function load(user, id) {
    const c = db.get('SELECT * FROM player_challenges WHERE id = ?', Number(id));
    if (!c || (c.challenger_id !== user.id && c.opponent_id !== user.id)) throw new HttpError(404, 'Izazov ne postoji.');
    return c;
  }
  function respond(user, id, accept) {
    need(user);
    const c = load(user, id);
    if (c.opponent_id !== user.id) throw new HttpError(403, 'Na izazov odgovara izazvani igrač.');
    if (c.status !== 'ceka') throw new HttpError(409, 'Na ovaj izazov više se ne može odgovoriti.');
    if (c.date < game.today()) { expire(c); throw new HttpError(409, 'Izazov je istekao.'); }
    if (accept && ctx.messages.blockedEither(c.challenger_id, c.opponent_id)) throw new HttpError(403, 'Ne možete se međusobno izazivati.');
    db.run('UPDATE player_challenges SET status = ?, responded_at = ? WHERE id = ? AND status = ?', accept ? 'prihvacen' : 'odbijen', nowIso(), c.id, 'ceka');
    event(c.id, user.id, accept ? 'prihvacen' : 'odbijen');
    const m = db.get('SELECT name FROM maps WHERE id = ?', c.map_id).name;
    N().notify(c.challenger_id, 'izazov', accept
      ? { emoji: '🥊', title: `${user.nickname} prihvaća izazov!`, body: `${m}, ${c.date}. Neka bolji stigne dalje.`, link: '/izazovi', dedupe: `izazov:${c.id}:prihvacen` }
      : { emoji: '❌', title: `${user.nickname} je odbio izazov.`, body: `${m}, ${c.date}.`, link: '/izazovi', dedupe: `izazov:${c.id}:odbijen` });
    if (accept) resolve(c.id);
    return get(user, c.id);
  }
  function cancel(user, id) {
    need(user);
    const c = load(user, id);
    if (c.challenger_id !== user.id) throw new HttpError(403, 'Izazov može otkazati samo onaj tko ga je poslao.');
    if (c.status !== 'ceka') throw new HttpError(409, 'Prihvaćen ili završen izazov se ne može otkazati.');
    db.run("UPDATE player_challenges SET status = 'otkazan', completed_at = ? WHERE id = ?", nowIso(), c.id);
    event(c.id, user.id, 'otkazan');
    return get(user, c.id);
  }
  function expire(c) {
    if (c.status !== 'ceka') return;
    db.run("UPDATE player_challenges SET status = 'istekao', completed_at = ? WHERE id = ? AND status = 'ceka'", nowIso(), c.id);
    event(c.id, null, 'istekao');
  }

  /**
   * Određuje ishod prihvaćenog izazova. Dok dan traje i netko još nije igrao — čeka.
   * Kad oba završe: veći službeni km pobjeđuje (jednako = neriješeno). Nakon kraja dana: tko nije igrao, gubi predajom.
   */
  function resolve(id) {
    const c = db.get('SELECT * FROM player_challenges WHERE id = ?', id);
    if (!c || c.status !== 'prihvacen') return null;
    const a = official(c.challenger_id, c.date, c.map_id), b = official(c.opponent_id, c.date, c.map_id);
    const over = c.date < game.today();
    if (!(a && b) && !over) return null;
    let winner = null, outcome;
    if (a && b) { outcome = a.km === b.km ? 'nerijeseno' : 'pobjeda'; winner = a.km > b.km ? c.challenger_id : b.km > a.km ? c.opponent_id : null; }
    else if (a || b) { outcome = 'predaja'; winner = a ? c.challenger_id : c.opponent_id; }
    else outcome = 'nitko';
    const changed = db.run("UPDATE player_challenges SET status = 'zavrsen', winner_id = ?, outcome = ?, result = ?, completed_at = ? WHERE id = ? AND status = 'prihvacen'",
      winner, outcome, JSON.stringify({ challenger: a, opponent: b }), nowIso(), c.id).changes;
    if (!changed) return null;
    event(c.id, null, 'zavrsen');
    const m = db.get('SELECT name FROM maps WHERE id = ?', c.map_id).name;
    for (const [me, other, mine, theirs] of [[c.challenger_id, c.opponent_id, a, b], [c.opponent_id, c.challenger_id, b, a]]) {
      const on = nick(other);
      const kmTxt = mine && theirs ? ` ${Math.round(mine.km)} : ${Math.round(theirs.km)} km` : '';
      const n = winner === me ? { emoji: '🏆', title: outcome === 'predaja' ? `Pobjeda predajom protiv ${on}` : `Pobijedio si u izazovu protiv ${on}!`, body: `${m}, ${c.date}.${kmTxt}` }
        : winner === other ? { emoji: '🥊', title: outcome === 'predaja' ? `Izazov protiv ${on} izgubljen predajom` : `${on} je dobio izazov.`, body: `${m}, ${c.date}.${kmTxt}` }
        : { emoji: '🤝', title: outcome === 'nitko' ? `Izazov s ${on}: nitko nije odigrao` : `Neriješeno s ${on}!`, body: `${m}, ${c.date}.${kmTxt}` };
      N().notify(me, 'izazov', { ...n, link: '/izazovi', dedupe: `izazov:${c.id}:kraj`, data: { challenge: c.id, won: winner === me } });
    }
    return outcome;
  }
  /** Poziva se kad netko završi službenu partiju. */
  function onSessionFinished(sessionId) {
    const s = db.get('SELECT s.user_id, s.map_id, c.date FROM game_sessions s JOIN daily_challenges c ON c.id = s.challenge_id WHERE s.id = ? AND s.official = 1', sessionId);
    if (!s) return;
    for (const c of db.all("SELECT id FROM player_challenges WHERE status = 'prihvacen' AND date = ? AND map_id = ? AND (challenger_id = ? OR opponent_id = ?)", s.date, s.map_id, s.user_id, s.user_id)) resolve(c.id);
  }
  /** Periodički posao: istek neodgovorenih i zaključivanje prošlih dana. */
  function sweep() {
    const today = game.today();
    let n = 0;
    for (const c of db.all("SELECT * FROM player_challenges WHERE status = 'ceka' AND date < ?", today)) { expire(c); n++; }
    for (const c of db.all("SELECT id FROM player_challenges WHERE status = 'prihvacen' AND date < ?", today)) { if (resolve(c.id)) n++; }
    return n;
  }

  function present(c, userId) {
    const mine = c.challenger_id === userId;
    const other = mine ? c.opponent_id : c.challenger_id;
    const op = db.get('SELECT p.nickname, p.avatar FROM profiles p WHERE p.user_id = ?', other) || { nickname: 'obrisan igrač' };
    const m = db.get('SELECT slug, name, flag FROM maps WHERE id = ?', c.map_id);
    const res = c.result ? JSON.parse(c.result) : null;
    const today = game.today();
    // Prije kraja dana rezultat suparnika vidi se samo ako si i sam odigrao (bez otkrivanja dok igraš)
    const myRes = c.status === 'zavrsen' ? (mine ? res?.challenger : res?.opponent) : official(userId, c.date, c.map_id);
    const theirRes = c.status === 'zavrsen' ? (mine ? res?.opponent : res?.challenger) : (myRes || c.date < today ? official(other, c.date, c.map_id) : null);
    return {
      id: c.id, outgoing: mine, status: c.status, date: c.date, map: m, message: c.message, created_at: c.created_at,
      opponent: { id: other, nickname: op.nickname, avatar: op.avatar },
      me: myRes ? { km: myRes.km, rank: myRes.rank, rare: myRes.rare, reached_goal: myRes.reached_goal } : null,
      them: theirRes ? { km: theirRes.km, rank: theirRes.rank, rare: theirRes.rare, reached_goal: theirRes.reached_goal } : null,
      them_played: !!official(other, c.date, c.map_id),
      outcome: c.outcome, won: c.status === 'zavrsen' ? (c.winner_id === userId ? true : c.winner_id ? false : null) : null,
      can_respond: !mine && c.status === 'ceka' && c.date >= today, can_cancel: mine && c.status === 'ceka',
    };
  }
  function get(user, id) { need(user); return present(load(user, id), user.id); }
  function list(user) {
    need(user);
    sweep();
    const rows = db.all('SELECT * FROM player_challenges WHERE challenger_id = ? OR opponent_id = ? ORDER BY date DESC, id DESC LIMIT 200', user.id, user.id).map((c) => present(c, user.id));
    const done = rows.filter((c) => c.status === 'zavrsen');
    return {
      incoming: rows.filter((c) => !c.outgoing && c.status === 'ceka'),
      outgoing: rows.filter((c) => c.outgoing && c.status === 'ceka'),
      active: rows.filter((c) => c.status === 'prihvacen'),
      finished: rows.filter((c) => !ACTIVE.includes(c.status)),
      record: { wins: done.filter((c) => c.won === true).length, losses: done.filter((c) => c.won === false).length, draws: done.filter((c) => c.outcome === 'nerijeseno').length },
      maps: game.activeMaps().map((m) => ({ slug: m.slug, name: m.name, flag: m.flag })), today: game.today(),
    };
  }
  return { create, respond, cancel, list, get, resolve, sweep, onSessionFinished, official };
}
