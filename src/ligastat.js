// Napredna statistika lige: razdoblja (danas, tjedan, mjesec, ukupno), Rendgen, nagrade dana, odgovori ekipe,
// legende, dvorana slavnih i utrka. Sve se računa na poslužitelju iz službenih, dovršenih partija.
// Datumi su datumi igre (Europe/Zagreb); tjedan počinje ponedjeljkom.
import { HttpError, round1, isDate, addDays } from './util.js';
import { dailyAwards } from './nagrade.js';

const dow = (d) => (new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7;          // 0 = ponedjeljak
export const weekStart = (d) => addDays(d, -dow(d));
const monthOf = (d) => d.slice(0, 7);
const monthEnd = (ym) => { const [y, m] = ym.split('-').map(Number); return `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`; };
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);

export function createLeagueStats(ctx) {
  const { db, game } = ctx;

  function load(user, id) {
    if (!user || user.is_guest) throw new HttpError(401, 'Za lige se treba prijaviti.');
    const l = db.get('SELECT * FROM leagues WHERE id = ? AND is_hidden = 0', Number(id));
    if (!l || !db.get('SELECT 1 AS x FROM league_members WHERE league_id = ? AND user_id = ?', l.id, user.id)) throw new HttpError(404, 'Liga ne postoji ili nisi član.');
    const members = db.all(`SELECT u.id, p.nickname, p.avatar FROM league_members m JOIN users u ON u.id = m.user_id JOIN profiles p ON p.user_id = u.id
                            WHERE m.league_id = ? AND u.is_blocked = 0`, l.id);
    const rows = db.all(`SELECT lb.session_id, lb.user_id, lb.date, lb.map, lb.total_km AS km, lb.reached_goal AS goal FROM leaderboards lb
                         JOIN league_members m ON m.user_id = lb.user_id WHERE m.league_id = ? ORDER BY lb.date`, l.id);
    return { l, members, rows };
  }
  /** Dnevni zbroj po igraču (sve karte tog dana) i tko je taj dan stigao najdalje. */
  function days(rows) {
    const byDate = new Map();
    for (const r of rows) {
      if (!byDate.has(r.date)) byDate.set(r.date, new Map());
      const m = byDate.get(r.date);
      m.set(r.user_id, (m.get(r.user_id) || 0) + r.km);
    }
    return byDate;
  }
  const winnersOf = (dayMap) => { const top = Math.max(...dayMap.values()); return top > 0 ? [...dayMap].filter(([, k]) => k === top).map(([u]) => u) : []; };

  function table(members, rows, user) {
    const byDate = days(rows);
    const wins = new Map();
    for (const m of byDate.values()) for (const u of winnersOf(m)) wins.set(u, (wins.get(u) || 0) + 1);
    const list = members.map((mem) => {
      const mine = rows.filter((r) => r.user_id === mem.id);
      const km = sum(mine, (r) => r.km);
      return {
        user_id: mem.id, nickname: mem.nickname, avatar: mem.avatar, self: mem.id === user.id,
        km: round1(km), days: new Set(mine.map((r) => r.date)).size, games: mine.length,
        avg: mine.length ? round1(km / mine.length) : 0, best: round1(Math.max(0, ...mine.map((r) => r.km))),
        wins: wins.get(mem.id) || 0, goals: sum(mine, (r) => r.goal), streak: game.streakOf(mem.id).current,
      };
    }).sort((a, b) => b.km - a.km || b.best - a.best || a.nickname.localeCompare(b.nickname, 'hr'));
    let rank = 0, prev = null;
    list.forEach((r, i) => { if (prev === null || r.km !== prev) rank = i + 1; prev = r.km; r.rank = rank; });
    return list;
  }
  function chart(rows, dates) {
    return dates.map((d) => { const x = rows.filter((r) => r.date === d); return { date: d, avg: x.length ? Math.round(sum(x, (r) => r.km) / x.length) : null, games: x.length }; });
  }
  const range = (from, to) => { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; };

  /** Smije li gledatelj vidjeti tuđe odgovore za tu kartu i dan: dan je prošao ili je sam završio službenu partiju. */
  function canSee(user, date, map, today) {
    if (date < today) return true;
    return !!db.get('SELECT 1 AS x FROM leaderboards WHERE user_id = ? AND date = ? AND map = ?', user.id, date, map);
  }
  function dayAnswers(sessionIds) {
    if (!sessionIds.length) return [];
    return db.all(`SELECT pa.session_id, pa.position, pa.question_id, pa.raw, pa.answer_id, pa.numeric_value, pa.error_pct, pa.is_correct, pa.status, pa.rarity, pa.level, pa.km, pa.answer_ms, pa.attempts,
                          a.canonical, q.text, t.slug AS type, c.name AS category, c.emoji AS category_emoji, c.slug AS category_slug, nt.unit, s.transport_set_id, s.user_id
                   FROM player_answers pa JOIN game_sessions s ON s.id = pa.session_id JOIN questions q ON q.id = pa.question_id
                   JOIN question_types t ON t.id = q.type_id JOIN question_categories c ON c.id = q.category_id
                   LEFT JOIN accepted_answers a ON a.id = pa.answer_id LEFT JOIN numeric_targets nt ON nt.question_id = q.id
                   WHERE pa.session_id IN (${sessionIds.map(() => '?').join(',')}) ORDER BY pa.position`, ...sessionIds);
  }
  const shown = (a) => (a.type === 'numeric' ? (a.numeric_value != null ? `${a.numeric_value} ${a.unit || ''}`.trim() : null) : a.is_correct ? a.canonical : (a.raw || null));

  function stats(user, id, q = {}) {
    const { l, members, rows } = load(user, id);
    const today = game.today();
    const period = ['danas', 'tjedan', 'mjesec', 'ukupno', 'rendgen'].includes(q.period) ? q.period : 'danas';
    const date = isDate(q.date) && q.date <= today ? q.date : today;
    const maps = game.activeMaps().map((m) => ({ slug: m.slug, name: m.name, flag: m.flag }));
    const map = maps.some((m) => m.slug === q.map) ? q.map : maps[0]?.slug;
    const nameOf = new Map(members.map((m) => [m.id, m]));
    const person = (uid) => ({ user_id: uid, nickname: nameOf.get(uid)?.nickname || '—', avatar: nameOf.get(uid)?.avatar || null, self: uid === user.id });
    const ws = weekStart(today);
    const out = { id: l.id, name: l.name, code: l.code, period, date, today, maps, map, members: members.length };

    // ----- razdoblje -----
    let from = null, to = today, dates = [];
    if (period === 'danas') { from = date; to = date; dates = [date]; }
    else if (period === 'tjedan' || period === 'rendgen') { from = ws; to = addDays(ws, 6); dates = range(from, to); }
    else if (period === 'mjesec') {
      const ym = /^\d{4}-\d{2}$/.test(q.month || '') && q.month <= monthOf(today) ? q.month : monthOf(today);
      from = ym + '-01'; to = monthEnd(ym); dates = range(from, to);
      const first = rows[0]?.date;
      out.month = ym; out.months = [...new Set([...rows.map((r) => monthOf(r.date)), monthOf(today)])].sort().reverse();
      out.has_prev = !!first && monthOf(first) < ym;
    }
    const inPeriod = from ? rows.filter((r) => r.date >= from && r.date <= to) : rows;
    out.from = from; out.to = from ? to : null;
    out.table = table(members, inPeriod, user);
    out.team = { km: Math.round(sum(inPeriod, (r) => r.km)), games: inPeriod.length, avg: inPeriod.length ? Math.round(sum(inPeriod, (r) => r.km) / inPeriod.length) : 0,
      best: Math.round(Math.max(0, ...inPeriod.map((r) => r.km))), goals: sum(inPeriod, (r) => r.goal), played_today: new Set(rows.filter((r) => r.date === today).map((r) => r.user_id)).size };
    if (period === 'ukupno') { const all = [...new Set(rows.map((r) => r.date))].slice(-30); out.chart = chart(rows, all); out.team.best_streak = Math.max(0, ...members.map((m) => game.streakOf(m.id).best)); }
    else if (period !== 'danas') out.chart = chart(inPeriod, dates.filter((d) => d <= today || period !== 'mjesec'));

    // ----- utrka dana (po karti) -----
    const daySessions = rows.filter((r) => r.date === date);
    out.race = Object.fromEntries(maps.map((m) => [m.slug, daySessions.filter((r) => r.map === m.slug).map((r) => ({ ...person(r.user_id), km: round1(r.km), goal: !!r.goal })).sort((a, b) => b.km - a.km)]));
    out.not_played = members.filter((m) => !daySessions.some((r) => r.user_id === m.id)).map((m) => m.nickname);

    // ----- nagrade dana i odgovori ekipe (uz zaštitu od spoilera) -----
    const visibleMaps = maps.filter((m) => canSee(user, date, m.slug, today)).map((m) => m.slug);
    const visible = dayAnswers(daySessions.filter((r) => visibleMaps.includes(r.map)).map((r) => r.session_id));
    out.awards = dailyAwards(visible, person);
    out.played_today_count = new Set(daySessions.map((r) => r.user_id)).size;
    out.awards_hidden = maps.filter((m) => !visibleMaps.includes(m.slug)).map((m) => m.name);
    const mapSessions = new Map(daySessions.filter((r) => r.map === map).map((r) => [r.session_id, r]));
    out.answers = { map, locked: !visibleMaps.includes(map), questions: [] };
    if (!out.answers.locked) {
      const byPos = new Map();
      for (const a of visible.filter((x) => mapSessions.has(x.session_id))) {
        if (!byPos.has(a.position)) byPos.set(a.position, { position: a.position, category: a.category, emoji: a.category_emoji, text: a.text, type: a.type, rows: [] });
        const mode = a.level ? game.modeByLevel(a.transport_set_id, a.level) : null;
        byPos.get(a.position).rows.push({ ...person(a.user_id), answer: shown(a), status: a.status, km: a.km, level: a.level, transport: mode && { name: mode.name, emoji: mode.emoji, image: mode.image } });
      }
      out.answers.questions = [...byPos.values()].sort((a, b) => a.position - b.position);
      for (const qn of out.answers.questions) qn.rows.sort((a, b) => b.km - a.km);
    }

    // ----- legende (30 dana) i dvorana slavnih (dovršeni tjedni) -----
    const since = addDays(today, -29);
    const recent = rows.filter((r) => r.date >= since && (r.date < today || visibleMaps.includes(r.map)));
    const recentAnswers = dayAnswers(recent.map((r) => r.session_id));
    const TITLES = { nogomet: 'Legenda nogometa', kosarka: 'Legenda košarke', rukomet: 'Rukometna legenda', tenis: 'Teniska legenda', 'formula-1': 'Kralj Formule 1', borilacki: 'Borilačka legenda', procjene: 'Kralj procjena' };
    out.legends = Object.entries(TITLES).map(([slug, title]) => {
      const per = new Map();
      let emoji = '';
      for (const a of recentAnswers.filter((x) => x.category_slug === slug)) { emoji = a.category_emoji; const p = per.get(a.user_id) || { km: 0, n: 0 }; p.km += a.km; p.n++; per.set(a.user_id, p); }
      const best = [...per].filter(([, p]) => p.n >= 3).map(([u, p]) => ({ u, avg: p.km / p.n, n: p.n })).sort((a, b) => b.avg - a.avg)[0];
      return best ? { slug, title, emoji, ...person(best.u), avg: Math.round(best.avg), answers: best.n } : { slug, title, emoji, empty: true };
    });
    out.legends_rule = 'Najviše kilometara po pitanju u toj kategoriji u zadnjih 30 dana (najmanje 3 odgovora).';
    const weeks = new Map();
    for (const r of rows) { const w = weekStart(r.date); if (w < ws) { if (!weeks.has(w)) weeks.set(w, []); weeks.get(w).push(r); } }
    out.hall = [...weeks].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 26).map(([w, wr]) => {
      const t = table(members, wr, user).filter((x) => x.km > 0);
      return { from: w, to: addDays(w, 6), winner: { ...person(t[0].user_id), km: t[0].km, days: t[0].days, best: t[0].best }, podium: t.slice(1, 3).map((x) => ({ nickname: x.nickname, km: x.km })) };
    });
    const crowns = new Map();
    for (const h of out.hall) crowns.set(h.winner.nickname, (crowns.get(h.winner.nickname) || 0) + 1);
    out.crowns = [...crowns].map(([nickname, n]) => ({ nickname, n })).sort((a, b) => b.n - a.n);

    // ----- Rendgen -----
    if (period === 'rendgen') {
      const t = out.table, i = t.findIndex((x) => x.self), me = t[i];
      const mineAll = rows.filter((r) => r.user_id === user.id);
      const byDate = days(rows);
      const r30 = rows.filter((r) => r.date >= since), mine30 = r30.filter((r) => r.user_id === user.id);
      const duels = members.filter((m) => m.id !== user.id).map((m) => {
        const theirs = new Map(rows.filter((r) => r.user_id === m.id).map((r) => [r.date + r.map, r.km]));
        const shared = mineAll.filter((r) => theirs.has(r.date + r.map)).map((r) => ({ date: r.date, map: r.map, res: r.km > theirs.get(r.date + r.map) ? 'w' : r.km < theirs.get(r.date + r.map) ? 'l' : 't' }));
        return { ...person(m.id), wins: shared.filter((x) => x.res === 'w').length, losses: shared.filter((x) => x.res === 'l').length, ties: shared.filter((x) => x.res === 't').length, last: shared.slice(-10).map((x) => x.res) };
      }).sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses) || b.wins - a.wins);
      const W = sum(duels, (d) => d.wins), L = sum(duels, (d) => d.losses), T = sum(duels, (d) => d.ties);
      const cats = new Map();
      for (const a of dayAnswers(r30.filter((r) => r.date < today || visibleMaps.includes(r.map)).map((r) => r.session_id))) {
        const c = cats.get(a.category_slug) || { name: a.category, emoji: a.category_emoji, me: 0, meN: 0, all: 0, allN: 0 };
        c.all += a.km; c.allN++; if (a.user_id === user.id) { c.me += a.km; c.meN++; }
        cats.set(a.category_slug, c);
      }
      const history = [...byDate].filter(([d]) => d >= since).map(([d, m]) => {
        if (!m.has(user.id)) return { date: d, rank: null, of: m.size };
        const mineKm = m.get(user.id);
        return { date: d, rank: 1 + [...m.values()].filter((k) => k > mineKm).length, of: m.size };
      });
      const leagueAvg = r30.length ? sum(r30, (r) => r.km) / r30.length : null, myAvg = mine30.length ? sum(mine30, (r) => r.km) / mine30.length : null;
      out.rendgen = {
        target: me ? { rank: me.rank, of: t.length, km: me.km, ahead: i > 0 ? { nickname: t[i - 1].nickname, gap: round1(t[i - 1].km - me.km) } : null,
          behind: t[i + 1] ? { nickname: t[i + 1].nickname, gap: round1(me.km - t[i + 1].km) } : null, leader: { nickname: t[0].nickname, km: t[0].km, gap: round1(t[0].km - me.km) },
          today_km: round1(byDate.get(today)?.get(user.id) || 0), played_today: !!byDate.get(today)?.has(user.id) } : null,
        metrics: { avg_km: myAvg == null ? null : Math.round(myAvg), league_avg: leagueAvg == null ? null : Math.round(leagueAvg), days_played: new Set(mineAll.map((r) => r.date)).size,
          days_top: [...byDate.values()].filter((m) => winnersOf(m).includes(user.id)).length, best_day: Math.round(Math.max(0, ...[...byDate.values()].map((m) => m.get(user.id) || 0))),
          wins: W, losses: L, ties: T, win_pct: W + L + T ? Math.round((W / (W + L + T)) * 100) : null },
        duels: duels.filter((d) => d.wins + d.losses + d.ties > 0), duels_without: duels.filter((d) => d.wins + d.losses + d.ties === 0).map((d) => d.nickname),
        vs_league: [...cats.values()].map((c) => ({ name: c.name, emoji: c.emoji, me: c.meN ? Math.round(c.me / c.meN) : null, league: Math.round(c.all / c.allN), answers: c.meN })),
        history,
      };
    }
    return out;
  }
  return { stats };
}
