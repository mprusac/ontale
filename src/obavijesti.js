// Obavijesti u aplikaciji, korisničke postavke obavijesti/zvuka/karte i događaji lige (pretjecanje, vodstvo, svi odigrali).
// Sve obavijesti stvara poslužitelj; jedinstveni ključ (user_id, dedupe_key) sprječava duplikate.
import { nowIso, HttpError, bad, randomToken, round1, addDays } from './util.js';

const PREF_FLAGS = ['notif_inapp', 'notif_messages', 'notif_league', 'notif_overtake', 'notif_challenges', 'notif_awards', 'notif_daily', 'email_reminders', 'email_messages'];
// Vrsta obavijesti → postavka koja je uključuje
const TYPE_PREF = { pretek: 'notif_overtake', vodstvo: 'notif_league', 'izgubio-vodstvo': 'notif_overtake', 'svi-odigrali': 'notif_league', poruka: 'notif_messages', izazov: 'notif_challenges', nagrada: 'notif_awards', podsjetnik: 'notif_daily' };
const MAX_OVERTAKES_PER_DAY = 6;   // zaštita od poplave: više od toga istog dana se ne šalje

export function createNotifications(ctx) {
  const { db, game } = ctx;

  // ---------- Postavke ----------
  function prefs(userId) {
    let p = db.get('SELECT * FROM user_prefs WHERE user_id = ?', userId);
    if (!p) {
      db.run('INSERT OR IGNORE INTO user_prefs (user_id, unsub_token, updated_at) VALUES (?, ?, ?)', userId, randomToken(18), nowIso());
      p = db.get('SELECT * FROM user_prefs WHERE user_id = ?', userId);
    }
    if (!p.unsub_token) { const t = randomToken(18); db.run('UPDATE user_prefs SET unsub_token = ? WHERE user_id = ?', t, userId); p.unsub_token = t; }
    return p;
  }
  function publicPrefs(userId) {
    const p = prefs(userId);
    const out = { dm_policy: p.dm_policy, map_mode: p.map_mode || null };
    for (const k of PREF_FLAGS) out[k] = !!p[k];
    out.sound = { on: p.sound_on == null ? null : !!p.sound_on, volume: p.sound_volume, game: p.sound_game == null ? null : !!p.sound_game, notif: p.sound_notif == null ? null : !!p.sound_notif };
    out.email_configured = !!ctx.mailer?.configured();
    return out;
  }
  function updatePrefs(user, body = {}) {
    if (!user || user.is_guest) throw new HttpError(401, 'Postavke obavijesti su dostupne registriranim igračima.');
    const cur = prefs(user.id);
    const sets = [], vals = [];
    const set = (k, v) => { sets.push(`${k} = ?`); vals.push(v); };
    if (body.dm_policy !== undefined) { if (!['lige', 'svi', 'nitko'].includes(body.dm_policy)) throw bad('Nepoznata postavka poruka.'); set('dm_policy', body.dm_policy); }
    for (const k of PREF_FLAGS) if (body[k] !== undefined) set(k, body[k] ? 1 : 0);
    const turningEmailOn = (body.email_reminders && !cur.email_reminders) || (body.email_messages && !cur.email_messages);
    if (turningEmailOn) {
      if (!db.get('SELECT email FROM users WHERE id = ?', user.id)?.email) throw bad('Za e-mail obavijesti treba e-mail adresa na računu.');
      set('email_consent_at', nowIso());
    }
    if (body.map_mode !== undefined) { if (body.map_mode !== null && !['reljef', 'satelit'].includes(body.map_mode)) throw bad('Nepoznat prikaz karte.'); set('map_mode', body.map_mode); }
    if (body.sound && typeof body.sound === 'object') {
      const s = body.sound;
      if (s.on !== undefined) set('sound_on', s.on == null ? null : s.on ? 1 : 0);
      if (s.volume !== undefined) { const v = Number(s.volume); if (!(v >= 0 && v <= 1)) throw bad('Glasnoća mora biti između 0 i 1.'); set('sound_volume', v); }
      if (s.game !== undefined) set('sound_game', s.game ? 1 : 0);
      if (s.notif !== undefined) set('sound_notif', s.notif ? 1 : 0);
    }
    if (sets.length) db.run(`UPDATE user_prefs SET ${sets.join(', ')}, updated_at = ? WHERE user_id = ?`, ...vals, nowIso(), user.id);
    return publicPrefs(user.id);
  }
  /** Odjava od e-mailova jednim klikom (poveznica iz e-maila; bez prijave). */
  function unsubscribe(token) {
    const p = token && db.get('SELECT user_id FROM user_prefs WHERE unsub_token = ?', String(token));
    if (!p) throw new HttpError(404, 'Poveznica za odjavu nije ispravna.');
    db.run('UPDATE user_prefs SET email_reminders = 0, email_messages = 0, updated_at = ? WHERE user_id = ?', nowIso(), p.user_id);
    return { ok: true };
  }

  // ---------- Stvaranje ----------
  /**
   * Upisuje obavijest ako je korisnik nije isključio. `dedupe` je jedinstven po korisniku.
   * `upsert` = postojeća obavijest s istim ključem se osvježava i ponovno označava nepročitanom (npr. nova poruka u istom razgovoru).
   */
  function notify(userId, type, { title, body = null, link = null, emoji = null, data = null, dedupe, upsert = false } = {}) {
    if (!userId || !dedupe || !title) return false;
    const u = db.get('SELECT is_guest, is_blocked FROM users WHERE id = ?', userId);
    if (!u || u.is_guest || u.is_blocked) return false;
    const p = prefs(userId);
    if (!p.notif_inapp && type !== 'sustav') return false;
    const flag = TYPE_PREF[type];
    if (flag && !p[flag]) return false;
    const json = data ? JSON.stringify(data) : null;
    if (upsert) {
      const r = db.run(`INSERT INTO notifications (user_id, type, emoji, title, body, link, data, dedupe_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(user_id, dedupe_key) DO UPDATE SET title = excluded.title, body = excluded.body, link = excluded.link, data = excluded.data,
                        emoji = excluded.emoji, created_at = excluded.created_at, read_at = NULL`, userId, type, emoji, title, body, link, json, dedupe, nowIso());
      return r.changes > 0;
    }
    return db.run('INSERT OR IGNORE INTO notifications (user_id, type, emoji, title, body, link, data, dedupe_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      userId, type, emoji, title, body, link, json, dedupe, nowIso()).changes > 0;
  }

  // ---------- Čitanje ----------
  const need = (user) => { if (!user || user.is_guest) throw new HttpError(401, 'Prijavi se.'); return user; };
  function list(user, { before, limit } = {}) {
    need(user);
    const lim = Math.min(50, Math.max(1, Number(limit) || 30));
    const rows = db.all(`SELECT id, type, emoji, title, body, link, data, created_at, read_at FROM notifications
                         WHERE user_id = ? ${before ? 'AND id < ?' : ''} ORDER BY id DESC LIMIT ?`, ...(before ? [user.id, Number(before), lim + 1] : [user.id, lim + 1]));
    const more = rows.length > lim;
    return { items: rows.slice(0, lim).map((r) => ({ ...r, data: r.data ? JSON.parse(r.data) : null, read: !!r.read_at })), more, ...counts(user) };
  }
  function counts(user) {
    if (!user || user.is_guest) return { unread: 0, messages_unread: 0 };
    const unread = db.get('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL', user.id).n;
    const messages = ctx.messages ? ctx.messages.unreadTotal(user.id) : 0;
    const top = db.get('SELECT id, type, data FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 1', user.id);
    let won = null; try { won = top?.data ? JSON.parse(top.data).won ?? null : null; } catch { /* bez podataka */ }
    return { unread, messages_unread: messages, last_id: top?.id || 0, last_type: top?.type || null, last_won: won };
  }
  function markRead(user, { id, all } = {}) {
    need(user);
    if (all) db.run('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', nowIso(), user.id);
    else {
      const r = db.run('UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?', nowIso(), Number(id), user.id);
      if (!r.changes) throw new HttpError(404, 'Obavijest ne postoji.');
    }
    return counts(user);
  }

  // ---------- Događaji lige nakon završene službene partije ----------
  const nick = (id) => db.get('SELECT nickname FROM profiles WHERE user_id = ?', id)?.nickname || 'Igrač';
  /** Poredak lige za kartu i dan: km silazno, pa tko je ranije završio. */
  function standings(leagueId, date, mapSlug) {
    return db.all(`SELECT lb.user_id, lb.total_km AS km, lb.finished_at FROM leaderboards lb JOIN league_members m ON m.user_id = lb.user_id
                   WHERE m.league_id = ? AND lb.date = ? AND lb.map = ? ORDER BY lb.total_km DESC, lb.finished_at ASC`, leagueId, date, mapSlug);
  }
  function overtakesToday(userId, date) {
    return db.get("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND type = 'pretek' AND dedupe_key LIKE ?", userId, `pretek:${date}:%`).n;
  }
  /** Poziva se iz igre kad službena partija završi. Usporedba „prije“ i „poslije“ — prava promjena položaja, ne svako osvježavanje. */
  function onSessionFinished(sessionId) {
    const s = db.get(`SELECT s.id, s.user_id, s.total_km, s.finished_at, c.date, m.slug AS map, m.name AS map_name FROM game_sessions s
                      JOIN daily_challenges c ON c.id = s.challenge_id JOIN maps m ON m.id = s.map_id WHERE s.id = ? AND s.official = 1 AND s.finished_at IS NOT NULL`, sessionId);
    if (!s) return;
    const me = db.get('SELECT is_guest FROM users WHERE id = ?', s.user_id);
    if (!me || me.is_guest) return;
    const leagues = db.all('SELECT l.id, l.name FROM leagues l JOIN league_members m ON m.league_id = l.id WHERE m.user_id = ? AND l.is_hidden = 0', s.user_id);
    const meName = nick(s.user_id);
    for (const l of leagues) {
      const after = standings(l.id, s.date, s.map);
      if (after.length < 2) { allDone(l, s.date); continue; }
      const before = after.filter((r) => r.user_id !== s.user_id);
      const myRank = after.findIndex((r) => r.user_id === s.user_id) + 1;
      const link = `/lige/${l.id}?karta=${s.map}`;
      // A) koga sam prestigao: svi koji su bili ispred ili na mom novom mjestu, a sad su iza mene
      const passed = after.slice(myRank).map((r) => r.user_id);
      for (const uid of passed) {
        if (overtakesToday(uid, s.date) >= MAX_OVERTAKES_PER_DAY) continue;
        notify(uid, 'pretek', { emoji: '⚡', title: `${meName} te je prestigao na današnjoj ruti!`, body: `${l.name} · ${s.map_name}: ${Math.round(s.total_km)} km.`, link, dedupe: `pretek:${s.date}:${s.map}:${s.user_id}`, data: { league: l.id, by: s.user_id } });
      }
      // B) vodstvo i C) gubitak vodstva
      // vodeći dobiva obavijest jednom dnevno po karti — čim u utrci postoji netko iza njega
      const lead = after[0];
      notify(lead.user_id, 'vodstvo', { emoji: '🏆', title: 'Prvi si u ligi!', body: `${l.name} · ${s.map_name}: trenutačno vodiš s ${Math.round(lead.km)} km.`, link, dedupe: `vodstvo:${l.id}:${s.date}:${s.map}:${lead.user_id}` });
      if (myRank === 1) {
        const prevLeader = before[0]?.user_id;
        if (prevLeader) notify(prevLeader, 'izgubio-vodstvo', { emoji: '🥈', title: `${meName} ti je preuzeo prvo mjesto.`, body: `${l.name} · ${s.map_name}: ${Math.round(s.total_km)} km, ti ${Math.round(before[0].km)} km.`, link, dedupe: `izgubio:${l.id}:${s.date}:${s.map}:${s.user_id}` });
      }
      allDone(l, s.date);
    }
  }
  /** D) Svi aktivni članovi odigrali današnji izazov (aktivan = igrao u zadnjih 14 dana ili se nedavno pridružio). */
  function allDone(l, date) {
    const since = addDays(date, -14);
    const members = db.all(`SELECT m.user_id, m.joined_at FROM league_members m JOIN users u ON u.id = m.user_id WHERE m.league_id = ? AND u.is_blocked = 0`, l.id);
    const played = new Set(db.all(`SELECT DISTINCT lb.user_id FROM leaderboards lb JOIN league_members m ON m.user_id = lb.user_id WHERE m.league_id = ? AND lb.date = ?`, l.id, date).map((r) => r.user_id));
    const recent = new Set(db.all(`SELECT DISTINCT lb.user_id FROM leaderboards lb JOIN league_members m ON m.user_id = lb.user_id WHERE m.league_id = ? AND lb.date >= ? AND lb.date < ?`, l.id, since, date).map((r) => r.user_id));
    const active = members.filter((m) => recent.has(m.user_id) || played.has(m.user_id) || m.joined_at.slice(0, 10) >= since);
    if (active.length < 2 || !active.every((m) => played.has(m.user_id))) return;
    for (const m of members) notify(m.user_id, 'svi-odigrali', { emoji: '🏁', title: 'Svi članovi lige završili su današnji izazov!', body: `${l.name}: pogledaj tko je stigao najdalje.`, link: `/lige/${l.id}`, dedupe: `svi:${l.id}:${date}` });
  }

  /** Igrač nije završio službenu partiju barem `days` dana (za podsjetnik u aplikaciji i e-mailom). */
  function inactivity(userId) {
    const last = db.get('SELECT MAX(date) AS d FROM leaderboards WHERE user_id = ?', userId)?.d;
    const today = game.today();
    const created = db.get('SELECT created_at FROM users WHERE id = ?', userId)?.created_at?.slice(0, 10) || today;
    const from = last || created;
    const days = Math.round((Date.parse(today) - Date.parse(from)) / 86400000);
    return { last_played: last || null, days, today };
  }

  return { prefs, publicPrefs, updatePrefs, unsubscribe, notify, list, counts, markRead, onSessionFinished, standings, inactivity, round1 };
}
