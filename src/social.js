// Ljestvice, profili i statistika, lige s prijateljima, reakcije, prijave sadržaja.
import { nowIso, normalize, leagueCode, round1, HttpError, bad, isDate, addDays } from './util.js';

const REACTIONS_DEFAULT = ['👏', '🔥', '😂', '😱', '🐐', '🧱'];

export function createSocial(ctx) {
  const { db, settings, game } = ctx;
  const boards = new Map();
  const boardCache = (key, fn) => {
    const hit = boards.get(key);
    if (hit && hit.v === ctx.boardVersion && Date.now() - hit.t < 15000) return hit.value;
    const value = fn();
    boards.set(key, { v: ctx.boardVersion, t: Date.now(), value });
    if (boards.size > 500) boards.clear();
    return value;
  };
  const guestsListed = () => !!settings.get('guests_on_leaderboard', false);

  // ---------- Globalne ljestvice ----------
  function daily(mapSlug, date, user) {
    const day = date && isDate(date) ? date : game.today();
    if (day > game.today()) throw new HttpError(403, 'Taj dan još nije odigran.');
    const map = game.mapBySlug(mapSlug);
    if (!map) throw bad('Nepoznata karta.');
    const guestFilter = guestsListed() ? '' : 'AND is_guest = 0';
    const data = boardCache(`d:${mapSlug}:${day}`, () => {
      const rows = db.all(`SELECT session_id, user_id, nickname, avatar, total_km, reached_goal, finished_at FROM leaderboards
                           WHERE date = ? AND map = ? ${guestFilter} ORDER BY total_km DESC, finished_at ASC LIMIT 100`, day, mapSlug);
      const total = db.get(`SELECT COUNT(*) AS n FROM leaderboards WHERE date = ? AND map = ? ${guestFilter}`, day, mapSlug).n;
      return { rows: rows.map((r, i) => ({ rank: i + 1, session_id: r.session_id, user_id: r.user_id, nickname: r.nickname, avatar: r.avatar, km: round1(r.total_km), reached_goal: !!r.reached_goal })), total };
    });
    let me = null;
    if (user) {
      const mine = db.get('SELECT total_km, finished_at, is_guest FROM leaderboards WHERE date = ? AND map = ? AND user_id = ?', day, mapSlug, user.id);
      if (mine) {
        const better = db.get(`SELECT COUNT(*) AS n FROM leaderboards WHERE date = ? AND map = ? ${guestFilter}
                               AND (total_km > ? OR (total_km = ? AND finished_at < ?))`, day, mapSlug, mine.total_km, mine.total_km, mine.finished_at).n;
        me = { rank: better + 1, km: round1(mine.total_km), listed: guestsListed() || !mine.is_guest };
      }
    }
    return { date: day, map: mapSlug, ...data, me };
  }

  function overall(mapSlug, period, user) {
    const map = mapSlug && mapSlug !== 'sve' ? game.mapBySlug(mapSlug) : null;
    const since = period === 'mjesec' ? game.today().slice(0, 8) + '01' : '0000-00-00';
    const guestFilter = guestsListed() ? '' : 'AND is_guest = 0';
    const key = `o:${map?.slug || 'sve'}:${since}`;
    const data = boardCache(key, () => {
      const rows = db.all(`SELECT user_id, nickname, avatar, SUM(total_km) AS km, COUNT(*) AS games, SUM(reached_goal) AS goals, MAX(total_km) AS best
                           FROM leaderboards WHERE date >= ? ${map ? 'AND map = ?' : ''} ${guestFilter}
                           GROUP BY user_id ORDER BY km DESC LIMIT 100`, ...(map ? [since, map.slug] : [since]));
      return rows.map((r, i) => ({ rank: i + 1, user_id: r.user_id, nickname: r.nickname, avatar: r.avatar, km: round1(r.km), games: r.games, goals: r.goals, best: round1(r.best), avg: round1(r.km / r.games) }));
    });
    return { map: map?.slug || 'sve', period: period === 'mjesec' ? 'mjesec' : 'sve', rows: data, me: user ? data.find((r) => r.user_id === user.id) || null : null };
  }

  // ---------- Profil i statistika ----------
  function stats(userId) {
    const today = game.today();
    const base = db.get('SELECT * FROM user_statistics WHERE user_id = ?', userId) || { games: 0, total_km: 0, avg_km: 0, best_km: 0, goals_reached: 0 };
    const perMap = db.all(`SELECT m.slug, m.name, m.flag, COUNT(*) AS games, SUM(s.total_km) AS km, MAX(s.total_km) AS best, SUM(s.reached_goal) AS goals
                           FROM game_sessions s JOIN maps m ON m.id = s.map_id
                           WHERE s.user_id = ? AND s.official = 1 AND s.finished_at IS NOT NULL GROUP BY m.id`, userId);
    const levels = db.all(`SELECT pa.level, COUNT(*) AS n FROM player_answers pa JOIN game_sessions s ON s.id = pa.session_id
                           WHERE s.user_id = ? AND s.official = 1 GROUP BY pa.level ORDER BY pa.level`, userId);
    const modes = game.transports().modes;
    const transportCounts = levels.filter((l) => l.level > 0).map((l) => ({ level: l.level, count: l.n, transport: game.publicMode(modes.find((m) => m.level === l.level)) }));
    const favourite = [...transportCounts].sort((a, b) => b.count - a.count)[0] || null;
    const categories = db.all(`SELECT c.slug, c.name, c.emoji, COUNT(*) AS answers, SUM(pa.is_correct) AS correct, AVG(pa.km) AS avg_km, SUM(pa.km) AS km
                               FROM player_answers pa JOIN game_sessions s ON s.id = pa.session_id
                               JOIN questions q ON q.id = pa.question_id JOIN question_categories c ON c.id = q.category_id
                               WHERE s.user_id = ? AND s.official = 1 GROUP BY c.id ORDER BY c.sort_order`, userId)
      .map((c) => ({ ...c, avg_km: round1(c.avg_km), km: round1(c.km), accuracy: c.answers ? Math.round((c.correct / c.answers) * 100) : 0 }));
    // Najrjeđi odgovori — samo iz završenih dana, da profil ne otkriva današnje odgovore.
    const rarest = db.all(`SELECT a.canonical, q.text AS question, pa.rarity, pa.level, c.date
                           FROM player_answers pa JOIN game_sessions s ON s.id = pa.session_id
                           JOIN daily_challenges c ON c.id = s.challenge_id JOIN questions q ON q.id = pa.question_id
                           JOIN accepted_answers a ON a.id = pa.answer_id JOIN question_types t ON t.id = q.type_id
                           WHERE s.user_id = ? AND s.official = 1 AND pa.is_correct = 1 AND t.slug = 'open' AND c.date < ?
                           ORDER BY pa.rarity DESC, c.date DESC LIMIT 8`, userId, today)
      .map((r) => ({ answer: r.canonical, question: r.question, rarity: Math.round(r.rarity), date: r.date, transport: game.publicMode(modes.find((m) => m.level === r.level)) }));
    const history = db.all(`SELECT s.id, c.date, m.slug AS map, m.flag, s.total_km, s.reached_goal
                            FROM game_sessions s JOIN daily_challenges c ON c.id = s.challenge_id JOIN maps m ON m.id = s.map_id
                            WHERE s.user_id = ? AND s.official = 1 AND s.finished_at IS NOT NULL ORDER BY c.date DESC, m.sort_order LIMIT 60`, userId)
      .map((h) => ({ ...h, total_km: round1(h.total_km), reached_goal: !!h.reached_goal }));
    const monthly = db.all(`SELECT substr(c.date, 1, 7) AS month, COUNT(*) AS games, SUM(s.total_km) AS km, AVG(s.total_km) AS avg, MAX(s.total_km) AS best, SUM(s.reached_goal) AS goals,
                                   COUNT(DISTINCT c.date) AS days
                            FROM game_sessions s JOIN daily_challenges c ON c.id = s.challenge_id
                            WHERE s.user_id = ? AND s.official = 1 AND s.finished_at IS NOT NULL GROUP BY month ORDER BY month DESC LIMIT 12`, userId)
      .map((m) => ({ ...m, km: round1(m.km), avg: round1(m.avg), best: round1(m.best) }));
    const days = db.all(`SELECT DISTINCT c.date FROM game_sessions s JOIN daily_challenges c ON c.id = s.challenge_id
                         WHERE s.user_id = ? AND s.official = 1 AND s.finished_at IS NOT NULL AND c.date >= ? ORDER BY c.date`, userId, addDays(today, -55)).map((r) => r.date);
    return {
      games: base.games, total_km: round1(base.total_km), avg_km: round1(base.avg_km), best_km: round1(base.best_km), goals_reached: base.goals_reached,
      streak: game.streakOf(userId), per_map: perMap.map((m) => ({ ...m, km: round1(m.km), best: round1(m.best) })),
      transports: transportCounts, favourite_transport: favourite, categories, rarest, history, monthly, streak_days: days,
    };
  }

  function profile(nickname, viewer) {
    const row = db.get(`SELECT u.id, u.is_guest, u.is_blocked, u.created_at, p.nickname, p.avatar, p.is_public
                        FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.nickname_norm = ?`, normalize(nickname));
    if (!row || row.is_blocked) throw new HttpError(404, 'Igrač ne postoji.');
    const self = viewer && viewer.id === row.id;
    const head = { id: row.id, nickname: row.nickname, avatar: row.avatar, member_since: row.created_at.slice(0, 10), is_guest: !!row.is_guest, self };
    if (!row.is_public && !self) return { ...head, private: true };
    return { ...head, private: false, stats: stats(row.id) };
  }

  // ---------- Lige ----------
  const leagueName = (name) => {
    const n = String(name || '').trim().replace(/\s+/g, ' ');
    if (n.length < 3 || n.length > 40) throw bad('Naziv lige mora imati 3–40 znakova.');
    return n;
  };
  const needAccount = (user) => { if (!user || user.is_guest) throw new HttpError(401, 'Za lige se trebaš registrirati ili prijaviti.'); };
  const membership = (leagueId, userId) => db.get('SELECT 1 AS x FROM league_members WHERE league_id = ? AND user_id = ?', leagueId, userId);

  function createLeague(user, name) {
    needAccount(user);
    const n = leagueName(name);
    if (db.get('SELECT COUNT(*) AS c FROM league_members WHERE user_id = ?', user.id).c >= 20) throw bad('Možeš biti u najviše 20 liga.');
    return db.tx(() => {
      let code, tries = 0;
      do { code = leagueCode(); tries++; } while (db.get('SELECT 1 AS x FROM leagues WHERE code = ?', code) && tries < 20);
      const id = db.run('INSERT INTO leagues (name, code, owner_id, created_at) VALUES (?, ?, ?, ?)', n, code, user.id, nowIso()).id;
      db.run('INSERT INTO league_members (league_id, user_id, joined_at) VALUES (?, ?, ?)', id, user.id, nowIso());
      return { id, name: n, code };
    });
  }
  function joinLeague(user, code) {
    needAccount(user);
    const l = db.get('SELECT * FROM leagues WHERE code = ? AND is_hidden = 0', String(code || '').trim().toUpperCase());
    if (!l) throw new HttpError(404, 'Liga s tim kodom ne postoji.');
    if (db.get('SELECT COUNT(*) AS c FROM league_members WHERE league_id = ?', l.id).c >= 200) throw bad('Liga je puna (200 članova).');
    if (db.get('SELECT COUNT(*) AS c FROM league_members WHERE user_id = ?', user.id).c >= 20 && !membership(l.id, user.id)) throw bad('Možeš biti u najviše 20 liga.');
    db.run('INSERT OR IGNORE INTO league_members (league_id, user_id, joined_at) VALUES (?, ?, ?)', l.id, user.id, nowIso());
    return { id: l.id, name: l.name, code: l.code };
  }
  function myLeagues(user) {
    if (!user || user.is_guest) return [];
    const today = game.today();
    return db.all(`SELECT l.id, l.name, l.code, l.owner_id, (SELECT COUNT(*) FROM league_members x WHERE x.league_id = l.id) AS members
                   FROM leagues l JOIN league_members m ON m.league_id = l.id WHERE m.user_id = ? AND l.is_hidden = 0 ORDER BY l.name`, user.id)
      .map((l) => {
        const played = db.get(`SELECT COUNT(DISTINCT lb.user_id) AS n FROM leaderboards lb JOIN league_members m ON m.user_id = lb.user_id
                               WHERE m.league_id = ? AND lb.date = ?`, l.id, today).n;
        return { id: l.id, name: l.name, code: l.code, members: l.members, played_today: played, owner: l.owner_id === user.id };
      });
  }
  function league(user, id, date) {
    needAccount(user);
    const l = db.get('SELECT * FROM leagues WHERE id = ? AND is_hidden = 0', Number(id));
    if (!l || !membership(l.id, user.id)) throw new HttpError(404, 'Liga ne postoji ili nisi član.');
    const today = game.today();
    const day = date && isDate(date) && date <= today ? date : today;
    const members = db.all(`SELECT u.id, p.nickname, p.avatar, m.joined_at FROM league_members m JOIN users u ON u.id = m.user_id
                            JOIN profiles p ON p.user_id = u.id WHERE m.league_id = ? AND u.is_blocked = 0`, l.id);
    const sessions = db.all(`SELECT lb.session_id, lb.user_id, lb.map, lb.total_km, lb.reached_goal FROM leaderboards lb
                             JOIN league_members m ON m.user_id = lb.user_id WHERE m.league_id = ? AND lb.date = ?`, l.id, day);
    const totals = new Map(db.all(`SELECT lb.user_id, SUM(lb.total_km) AS km, COUNT(*) AS games, SUM(lb.reached_goal) AS goals FROM leaderboards lb
                                   JOIN league_members m ON m.user_id = lb.user_id WHERE m.league_id = ? GROUP BY lb.user_id`, l.id).map((r) => [r.user_id, r]));
    const reacts = sessions.length ? db.all(`SELECT r.session_id, r.emoji, COUNT(*) AS n, MAX(r.user_id = ?) AS mine FROM reactions r
                                             WHERE r.session_id IN (${sessions.map(() => '?').join(',')}) GROUP BY r.session_id, r.emoji`, user.id, ...sessions.map((s) => s.session_id)) : [];
    const maps = game.activeMaps().map((m) => ({ slug: m.slug, name: m.name, flag: m.flag, route_km: game.routeFor(m.id)?.total_km || 0 }));
    const rows = members.map((mem) => {
      const mine = sessions.filter((s) => s.user_id === mem.id);
      const byMap = {};
      for (const s of mine) {
        byMap[s.map] = { session_id: s.session_id, km: round1(s.total_km), reached_goal: !!s.reached_goal,
          reactions: reacts.filter((r) => r.session_id === s.session_id).map((r) => ({ emoji: r.emoji, count: r.n, mine: !!r.mine })) };
      }
      const t = totals.get(mem.id);
      return {
        user_id: mem.id, nickname: mem.nickname, avatar: mem.avatar, self: mem.id === user.id, owner: mem.id === l.owner_id,
        day_km: round1(mine.reduce((a, s) => a + s.total_km, 0)), maps: byMap,
        total_km: round1(t?.km || 0), games: t?.games || 0, goals: t?.goals || 0, streak: game.streakOf(mem.id),
      };
    }).sort((a, b) => b.day_km - a.day_km || b.total_km - a.total_km);
    const signs = ctx.signs ? Object.fromEntries(maps.map((m) => [m.slug, ctx.signs.forLeague(user, l.id, day, m.slug)])) : {};
    return { id: l.id, name: l.name, code: l.code, owner: l.owner_id === user.id, date: day, today, maps, members: rows, reactions: settings.get('reactions', REACTIONS_DEFAULT), signs };
  }
  function leaveLeague(user, id) {
    needAccount(user);
    const l = db.get('SELECT * FROM leagues WHERE id = ?', Number(id));
    if (!l || !membership(l.id, user.id)) throw new HttpError(404, 'Liga ne postoji.');
    db.tx(() => {
      db.run('DELETE FROM league_members WHERE league_id = ? AND user_id = ?', l.id, user.id);
      const heir = db.get('SELECT user_id FROM league_members WHERE league_id = ? ORDER BY joined_at LIMIT 1', l.id);
      if (!heir) db.run('DELETE FROM leagues WHERE id = ?', l.id);
      else if (l.owner_id === user.id) db.run('UPDATE leagues SET owner_id = ? WHERE id = ?', heir.user_id, l.id);
    });
    return { ok: true };
  }
  function updateLeague(user, id, body) {
    needAccount(user);
    const l = db.get('SELECT * FROM leagues WHERE id = ?', Number(id));
    if (!l || l.owner_id !== user.id) throw new HttpError(403, 'Ligu može uređivati samo njezin osnivač.');
    if (body.delete) { db.run('DELETE FROM leagues WHERE id = ?', l.id); return { deleted: true }; }
    if (body.name !== undefined) db.run('UPDATE leagues SET name = ? WHERE id = ?', leagueName(body.name), l.id);
    if (body.remove_user) db.run('DELETE FROM league_members WHERE league_id = ? AND user_id = ? AND user_id != ?', l.id, Number(body.remove_user), l.owner_id);
    return { ok: true };
  }

  // ---------- Reakcije ----------
  function react(user, sessionId, emoji) {
    needAccount(user);
    const allowed = settings.get('reactions', REACTIONS_DEFAULT);
    const s = db.get('SELECT id, user_id, official, finished_at FROM game_sessions WHERE id = ?', Number(sessionId));
    if (!s || !s.official || !s.finished_at) throw new HttpError(404, 'Rezultat ne postoji.');
    const shared = db.get(`SELECT 1 AS x FROM league_members a JOIN league_members b ON b.league_id = a.league_id WHERE a.user_id = ? AND b.user_id = ?`, user.id, s.user_id);
    if (!shared) throw new HttpError(403, 'Reagirati možeš na rezultate igrača iz svojih liga.');
    if (!emoji) { db.run('DELETE FROM reactions WHERE session_id = ? AND user_id = ?', s.id, user.id); return { ok: true }; }
    if (!allowed.includes(emoji)) throw bad('Nepoznata reakcija.');
    db.run(`INSERT INTO reactions (session_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)
            ON CONFLICT(session_id, user_id) DO UPDATE SET emoji = excluded.emoji, created_at = excluded.created_at`, s.id, user.id, emoji, nowIso());
    return { ok: true };
  }

  function reportContent(user, { target_type, target_id, reason }) {
    if (!['korisnik', 'liga'].includes(target_type)) throw bad('Nepoznata vrsta prijave.');
    db.run('INSERT INTO content_reports (reporter_id, target_type, target_id, reason, created_at) VALUES (?, ?, ?, ?, ?)',
      user?.id || null, target_type, Number(target_id) || 0, String(reason || '').slice(0, 300), nowIso());
    return { ok: true };
  }

  return { daily, overall, stats, profile, createLeague, joinLeague, myLeagues, league, leaveLeague, updateLeague, react, reportContent };
}
