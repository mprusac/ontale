// Nagrade lige: dnevne (računaju se uživo), tjedne i mjesečne (zaključuju se po završetku razdoblja i čuvaju u povijesti).
// Sve se računa samo iz službenih, dovršenih partija; nagrade ne daju nikakvu prednost u igri.
// Tjedan = ponedjeljak–nedjelja, mjesec = kalendarski mjesec, oba po datumu igre (Europe/Zagreb).
import { nowIso, HttpError, addDays, round1 } from './util.js';

const dow = (d) => (new Date(d + 'T12:00:00Z').getUTCDay() + 6) % 7;
export const weekStart = (d) => addDays(d, -dow(d));
const monthStart = (d) => d.slice(0, 8) + '01';
const monthEnd = (d) => { const [y, m] = d.slice(0, 7).split('-').map(Number); return `${d.slice(0, 7)}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`; };
const prevMonthStart = (d) => { const [y, m] = d.slice(0, 7).split('-').map(Number); const t = new Date(Date.UTC(y, m - 2, 1)); return t.toISOString().slice(0, 10); };
const fmtS = (ms) => `${(Math.round(ms / 100) / 10).toLocaleString('hr-HR')} s`;

export const AWARD_META = {
  pobjednik: { emoji: '🏆', tjedan: 'Tjedni pobjednik', mjesec: 'Mjesečni pobjednik', note: 'najviše kilometara (zbroj svih službenih partija)' },
  rijetki: { emoji: '💎', tjedan: 'Najrjeđi odgovor tjedna', mjesec: 'Najrjeđi odgovor mjeseca', note: 'najveća rijetkost točnog odgovora' },
  brzi: { emoji: '⚡', tjedan: 'Najbrži prst tjedna', mjesec: 'Najbrži prst mjeseca', note: 'najbrži točan odgovor' },
  procjena: { emoji: '🎯', tjedan: 'Najbolja procjena tjedna', mjesec: 'Najbolja procjena mjeseca', note: 'najmanja pogreška u procjeni' },
  prosjek: { emoji: '📊', tjedan: 'Najbolji prosjek tjedna', mjesec: 'Najbolji prosjek', note: 'najviše km po partiji' },
  napredak: { emoji: '📈', tjedan: 'Najveći napredak', mjesec: 'Najveći napredak', note: 'rast prosjeka km po partiji prema prethodnom razdoblju' },
  aktivni: { emoji: '🔥', tjedan: 'Najaktivniji igrač', mjesec: 'Najaktivniji igrač', note: 'najviše odigranih dana' },
};
const CATS = { tjedan: ['pobjednik', 'rijetki', 'brzi', 'procjena', 'napredak', 'aktivni'], mjesec: ['pobjednik', 'prosjek', 'rijetki', 'procjena', 'napredak', 'aktivni'] };
const MIN = { tjedan: { napredak: 3, aktivni: 2, prosjek: 3 }, mjesec: { napredak: 6, aktivni: 4, prosjek: 8 } };

/**
 * Dnevne nagrade iz odgovora jednog dana (popravljeno u v2.3): izjednačeni dijele nagradu, nitko nije upisan dvaput,
 * „Ista misao“ broji različite igrače. `answers` su odgovori službenih, dovršenih partija.
 */
export function dailyAwards(answers, person) {
  const out = [];
  const who = (ids) => [...new Set(ids)].map(person);
  const open = answers.filter((a) => a.type === 'open' && a.is_correct);
  const rated = open.filter((a) => a.rarity != null);
  if (rated.length) {
    const top = Math.max(...rated.map((a) => a.rarity));
    const best = rated.filter((a) => a.rarity === top);
    const keys = [...new Set(best.map((a) => a.question_id + ':' + a.answer_id))];
    const winners = open.filter((a) => keys.includes(a.question_id + ':' + a.answer_id));
    out.push({ key: 'najrjedi', emoji: '💎', title: 'Najrjeđi odgovor', players: who(winners.map((a) => a.user_id)), value: [...new Set(best.map((a) => a.canonical))].join(' / '), note: `${best[0].category} · rijetkost ${Math.round(top)} / 100` });
  }
  const groups = new Map();
  for (const a of open) { const k = a.question_id + ':' + a.answer_id; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(a); }
  [...groups.values()].map((g) => ({ g, n: new Set(g.map((a) => a.user_id)).size })).filter((x) => x.n >= 2)
    .sort((a, b) => b.n - a.n || (b.g[0].rarity ?? 0) - (a.g[0].rarity ?? 0)).slice(0, 3)
    .forEach(({ g }) => out.push({ key: 'ista-misao', emoji: '🧠', title: 'Ista misao', players: who(g.map((a) => a.user_id)), value: g[0].canonical, note: g[0].category }));
  const timed = open.filter((a) => a.answer_ms != null);
  if (timed.length) {
    const t = Math.min(...timed.map((a) => a.answer_ms));
    const f = timed.filter((a) => a.answer_ms === t);
    out.push({ key: 'najbrzi', emoji: '⚡', title: 'Najbrži prst', players: who(f.map((a) => a.user_id)), value: [...new Set(f.map((a) => a.canonical))].join(' / '), note: `za ${fmtS(t)} · ${f[0].category}` });
  }
  const est = answers.filter((a) => a.type === 'numeric' && a.error_pct != null);
  if (est.length) {
    const e = Math.min(...est.map((a) => a.error_pct));
    const f = est.filter((a) => a.error_pct === e);
    out.push({ key: 'procjena', emoji: '🎯', title: 'Najbolja procjena', players: who(f.map((a) => a.user_id)), value: [...new Set(f.map((a) => `${a.numeric_value} ${a.unit || ''}`.trim()))].join(' / '), note: `pogreška ${round1(e).toLocaleString('hr-HR')} % · razina ${f[0].level} od 7` });
  }
  const zeros = new Map();
  for (const a of answers) if (!(a.km > 0)) zeros.set(a.user_id, (zeros.get(a.user_id) || 0) + 1);
  const worst = Math.max(0, ...zeros.values());
  if (worst > 0) out.push({ key: 'radovi', emoji: '🚧', title: 'Radovi na cesti', players: who([...zeros].filter(([, n]) => n === worst).map(([u]) => u)), value: `${worst} ${worst === 1 ? 'pitanje' : worst < 5 ? 'pitanja' : 'pitanja'} bez kilometara`, note: 'danas najviše promašaja' });
  return out;
}

export function createAwards(ctx) {
  const { db, game } = ctx;
  const N = () => ctx.notifications;

  function answersOf(sessionIds) {
    if (!sessionIds.length) return [];
    const out = [];
    for (let i = 0; i < sessionIds.length; i += 400) {
      const ids = sessionIds.slice(i, i + 400);
      out.push(...db.all(`SELECT pa.session_id, pa.question_id, pa.answer_id, pa.numeric_value, pa.error_pct, pa.is_correct, pa.rarity, pa.level, pa.km, pa.answer_ms,
                                 a.canonical, t.slug AS type, c.name AS category, nt.unit, s.user_id
                          FROM player_answers pa JOIN game_sessions s ON s.id = pa.session_id JOIN questions q ON q.id = pa.question_id
                          JOIN question_types t ON t.id = q.type_id JOIN question_categories c ON c.id = q.category_id
                          LEFT JOIN accepted_answers a ON a.id = pa.answer_id LEFT JOIN numeric_targets nt ON nt.question_id = q.id
                          WHERE pa.session_id IN (${ids.map(() => '?').join(',')})`, ...ids));
    }
    return out;
  }
  const leagueRows = (leagueId, from, to) => db.all(`SELECT lb.session_id, lb.user_id, lb.nickname, lb.date, lb.map, lb.total_km AS km FROM leaderboards lb
     JOIN league_members m ON m.user_id = lb.user_id WHERE m.league_id = ? AND lb.date >= ? AND lb.date <= ?`, leagueId, from, to);

  /** Izračun nagrada za razdoblje. Vraća popis dobitnika (izjednačeni dijele mjesto). */
  function compute(leagueId, period, start, end) {
    const rows = leagueRows(leagueId, start, end);
    if (!rows.length) return [];
    const name = new Map(rows.map((r) => [r.user_id, r.nickname]));
    const per = new Map();
    for (const r of rows) { const p = per.get(r.user_id) || { km: 0, games: 0, days: new Set() }; p.km += r.km; p.games++; p.days.add(r.date); per.set(r.user_id, p); }
    const out = [];
    const push = (category, list, valueOf, textOf) => {
      for (const x of list) out.push({ category, rank: x.rank || 1, user_id: x.u, nickname: name.get(x.u) || db.get('SELECT nickname FROM profiles WHERE user_id = ?', x.u)?.nickname || '—', value: valueOf(x), value_text: textOf(x) });
    };
    let ansCache = null;
    const ties = (arr, val) => { const top = val(arr[0]); return arr.filter((x) => val(x) === top); };
    for (const cat of CATS[period]) {
      if (cat === 'pobjednik') {
        const t = [...per].map(([u, p]) => ({ u, km: p.km })).filter((x) => x.km > 0).sort((a, b) => b.km - a.km);
        let rank = 0, prev = null;
        t.forEach((x, i) => { if (x.km !== prev) rank = i + 1; prev = x.km; x.rank = rank; });
        push(cat, t.filter((x) => x.rank <= 3), (x) => round1(x.km), (x) => `${Math.round(x.km).toLocaleString('hr-HR')} km`);
      } else if (cat === 'aktivni') {
        const t = [...per].map(([u, p]) => ({ u, days: p.days.size, games: p.games })).filter((x) => x.days >= MIN[period].aktivni).sort((a, b) => b.days - a.days);
        if (t.length) push(cat, ties(t, (x) => x.days), (x) => x.days, (x) => `${x.days} ${x.days === 1 ? 'dan' : 'dana'} igre`);
      } else if (cat === 'prosjek') {
        const t = [...per].map(([u, p]) => ({ u, avg: p.km / p.games, games: p.games })).filter((x) => x.games >= MIN[period].prosjek).sort((a, b) => b.avg - a.avg);
        if (t.length) push(cat, ties(t, (x) => Math.round(x.avg)), (x) => round1(x.avg), (x) => `${Math.round(x.avg)} km po partiji (${x.games} partija)`);
      } else if (cat === 'napredak') {
        const len = period === 'tjedan' ? 7 : null;
        const pStart = len ? addDays(start, -7) : prevMonthStart(start), pEnd = addDays(start, -1);
        const prev = new Map();
        for (const r of leagueRows(leagueId, pStart, pEnd)) { const p = prev.get(r.user_id) || { km: 0, games: 0 }; p.km += r.km; p.games++; prev.set(r.user_id, p); }
        const m = MIN[period].napredak;
        const t = [...per].filter(([u, p]) => p.games >= m && prev.get(u)?.games >= m).map(([u, p]) => ({ u, gain: p.km / p.games - prev.get(u).km / prev.get(u).games, now: p.km / p.games }))
          .filter((x) => x.gain >= 1).sort((a, b) => b.gain - a.gain);
        if (t.length) push(cat, ties(t, (x) => Math.round(x.gain)), (x) => round1(x.gain), (x) => `+${Math.round(x.gain)} km po partiji (sada ${Math.round(x.now)})`);
      } else {
        const ans = ansCache || (ansCache = answersOf(rows.map((r) => r.session_id)));
        if (cat === 'rijetki') {
          const t = ans.filter((a) => a.type === 'open' && a.is_correct && a.rarity != null).sort((a, b) => b.rarity - a.rarity);
          if (t.length) { const best = ties(t, (a) => a.rarity); const uniq = [...new Map(best.map((a) => [a.user_id, a])).values()]; push(cat, uniq.map((a) => ({ u: a.user_id, a })), (x) => round1(x.a.rarity), (x) => `„${x.a.canonical}“ · rijetkost ${Math.round(x.a.rarity)}`); }
        } else if (cat === 'brzi') {
          const t = ans.filter((a) => a.type === 'open' && a.is_correct && a.answer_ms != null).sort((a, b) => a.answer_ms - b.answer_ms);
          if (t.length) { const best = ties(t, (a) => a.answer_ms); const uniq = [...new Map(best.map((a) => [a.user_id, a])).values()]; push(cat, uniq.map((a) => ({ u: a.user_id, a })), (x) => x.a.answer_ms, (x) => `„${x.a.canonical}“ za ${fmtS(x.a.answer_ms)}`); }
        } else if (cat === 'procjena') {
          const t = ans.filter((a) => a.type === 'numeric' && a.error_pct != null).sort((a, b) => a.error_pct - b.error_pct);
          if (t.length) { const best = ties(t, (a) => a.error_pct); const uniq = [...new Map(best.map((a) => [a.user_id, a])).values()]; push(cat, uniq.map((a) => ({ u: a.user_id, a })), (x) => x.a.error_pct, (x) => `pogreška ${round1(x.a.error_pct).toLocaleString('hr-HR')} %`); }
        }
      }
    }
    return out;
  }

  const periodsBetween = (period, from, today) => {
    const out = [];
    if (period === 'tjedan') { for (let s = weekStart(from); addDays(s, 6) < today; s = addDays(s, 7)) out.push([s, addDays(s, 6)]); }
    else { for (let s = monthStart(from); monthEnd(s) < today; s = addDays(monthEnd(s), 1)) out.push([s, monthEnd(s)]); }
    return out;
  };

  /** Zaključuje sva završena, a još nezaključena razdoblja. Idempotentno (sigurno i nakon restarta). */
  function finalizeDue() {
    const today = game.today();
    let done = 0;
    for (const l of db.all('SELECT id, name FROM leagues WHERE is_hidden = 0')) {
      const first = db.get('SELECT MIN(lb.date) AS d FROM leaderboards lb JOIN league_members m ON m.user_id = lb.user_id WHERE m.league_id = ?', l.id)?.d;
      if (!first) continue;
      for (const period of ['tjedan', 'mjesec']) {
        const all = periodsBetween(period, first, today);
        for (const [start, end] of all) {
          if (db.get('SELECT 1 AS x FROM award_finalizations WHERE league_id = ? AND period = ? AND period_start = ?', l.id, period, start)) continue;
          const list = compute(l.id, period, start, end);
          db.tx(() => {
            if (!db.run('INSERT OR IGNORE INTO award_finalizations (league_id, period, period_start, finalized_at) VALUES (?, ?, ?, ?)', l.id, period, start, nowIso()).changes) return;
            for (const a of list) db.run('INSERT OR IGNORE INTO league_awards (league_id, period, period_start, period_end, category, rank, user_id, nickname, value, value_text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              l.id, period, start, end, a.category, a.rank, a.user_id, a.nickname, a.value, a.value_text, nowIso());
            done++;
            // Obavijest samo za upravo završeno razdoblje (ne za staru povijest pri prvom pokretanju)
            const recent = Date.parse(today) - Date.parse(end) <= 3 * 86400000;
            if (recent) for (const a of list) {
              const meta = AWARD_META[a.category];
              const title = a.category === 'pobjednik' && a.rank > 1 ? `${a.rank === 2 ? '🥈 Drugo' : '🥉 Treće'} mjesto: ${meta[period].toLowerCase()}` : `${meta.emoji} ${meta[period]}!`;
              N().notify(a.user_id, 'nagrada', { emoji: a.rank === 1 ? meta.emoji : a.rank === 2 ? '🥈' : '🥉', title, body: `${l.name}: ${a.value_text}`, link: `/lige/${l.id}?tab=nagrade`, dedupe: `nagrada:${l.id}:${period}:${start}:${a.category}`, data: { league: l.id, period, start } });
            }
          });
        }
      }
    }
    return done;
  }

  /** Obavijesti o dnevnim nagradama za zaključeni dan (nakon ponoći, pa nema otkrivanja odgovora). */
  function notifyDaily(date) {
    let n = 0;
    for (const l of db.all('SELECT id, name FROM leagues WHERE is_hidden = 0')) {
      const rows = leagueRows(l.id, date, date);
      if (new Set(rows.map((r) => r.user_id)).size < 2) continue;
      const list = dailyAwards(answersOf(rows.map((r) => r.session_id)).map((a) => ({ ...a })), (uid) => uid);
      for (const a of list) {
        if (a.key === 'radovi') continue;                                // „nagrada“ za promašaje se ne šalje kao obavijest
        for (const uid of a.players) if (N().notify(uid, 'nagrada', { emoji: a.emoji, title: `${a.emoji} ${a.title} — ${l.name}`, body: `${date.split('-').reverse().join('. ')}.: ${a.value}`, link: `/lige/${l.id}?datum=${date}`, dedupe: `nagrada-dan:${l.id}:${date}:${a.key}` })) n++;
      }
    }
    return n;
  }

  /** Povijest i trenutno razdoblje (privremeno, bez današnjeg dana radi zaštite od otkrivanja odgovora). */
  function history(user, leagueId) {
    if (!user || user.is_guest) throw new HttpError(401, 'Prijavi se.');
    if (!db.get('SELECT 1 AS x FROM league_members m JOIN leagues l ON l.id = m.league_id WHERE m.league_id = ? AND m.user_id = ? AND l.is_hidden = 0', Number(leagueId), user.id)) throw new HttpError(404, 'Liga ne postoji ili nisi član.');
    const rows = db.all('SELECT * FROM league_awards WHERE league_id = ? ORDER BY period_start DESC, category, rank', Number(leagueId));
    const avatars = new Map();
    const group = (period) => {
      const map = new Map();
      for (const r of rows.filter((x) => x.period === period)) {
        if (!map.has(r.period_start)) map.set(r.period_start, { start: r.period_start, end: r.period_end, awards: [] });
        if (!avatars.has(r.user_id)) avatars.set(r.user_id, db.get('SELECT avatar, nickname FROM profiles WHERE user_id = ?', r.user_id) || null);
        const live = avatars.get(r.user_id);
        map.get(r.period_start).awards.push({ category: r.category, ...meta(r.category, period), rank: r.rank, user_id: r.user_id, nickname: live?.nickname || r.nickname, avatar: live?.avatar || null, self: r.user_id === user.id, value_text: r.value_text });
      }
      // periodi bez ijednog dobitnika (zaključeni, ali bez partija) se ne prikazuju
      return [...map.values()].slice(0, period === 'tjedan' ? 26 : 12);
    };
    const today = game.today(), yesterday = addDays(today, -1);
    const ws = weekStart(today), ms = monthStart(today);
    const provisional = (period, start) => (yesterday >= start ? compute(Number(leagueId), period, start, yesterday) : []).map((a) => ({ ...a, ...meta(a.category, period), self: a.user_id === user.id }));
    // medalje po igraču (povijesne pobjede)
    const medals = db.all(`SELECT user_id, nickname, period, category, rank, COUNT(*) AS n FROM league_awards WHERE league_id = ? GROUP BY user_id, period, category, rank`, Number(leagueId));
    const shelf = new Map();
    for (const m of medals) {
      const s = shelf.get(m.user_id) || { user_id: m.user_id, nickname: avatars.get(m.user_id)?.nickname || m.nickname, gold: 0, silver: 0, bronze: 0, badges: 0, weeks: 0, months: 0 };
      if (m.category === 'pobjednik') { s[m.rank === 1 ? 'gold' : m.rank === 2 ? 'silver' : 'bronze'] += m.n; if (m.rank === 1) s[m.period === 'tjedan' ? 'weeks' : 'months'] += m.n; }
      else s.badges += m.n;
      shelf.set(m.user_id, s);
    }
    return {
      weeks: group('tjedan'), months: group('mjesec'),
      current: { week: { start: ws, end: addDays(ws, 6), awards: provisional('tjedan', ws) }, month: { start: ms, end: monthEnd(ms), awards: provisional('mjesec', ms) } },
      hall: [...shelf.values()].sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze || b.badges - a.badges).map((s) => ({ ...s, self: s.user_id === user.id })),
      categories: Object.fromEntries(Object.entries(AWARD_META).map(([k, v]) => [k, { emoji: v.emoji, note: v.note }])),
    };
  }
  const meta = (cat, period) => ({ emoji: AWARD_META[cat]?.emoji || '🏅', title: AWARD_META[cat]?.[period] || cat, note: AWARD_META[cat]?.note || '' });

  /** Značke za javni profil igrača. */
  function badgesOf(userId) {
    return db.all(`SELECT a.period, a.category, a.rank, a.period_start, l.name AS league FROM league_awards a JOIN leagues l ON l.id = a.league_id
                   WHERE a.user_id = ? ORDER BY a.period_start DESC LIMIT 30`, userId).map((b) => ({ ...b, ...meta(b.category, b.period) }));
  }

  return { compute, finalizeDue, notifyDaily, history, badgesOf };
}
