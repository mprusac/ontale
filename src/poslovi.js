// Zakazani poslovi: zaključivanje dana, izazova i nagrada, obavijesti o dnevnim nagradama, podsjetnici i sažeci poruka.
// Svaki posao je idempotentan i stanje drži u bazi (job_runs, notification_delivery_log, award_finalizations),
// pa ponovno pokretanje poslužitelja ne šalje ništa dvaput.
import { nowIso, addDays } from './util.js';
import { emailLayout } from './mailer.js';

export const REMINDER_DEFAULTS = { enabled: true, inactivity_days: 3, cooldown_days: 7, max_per_streak: 3, send_hour: 17, digest_hours: 6 };

export function createJobs(ctx) {
  const { db, settings, game, config } = ctx;
  const N = () => ctx.notifications;
  const rcfg = () => ({ ...REMINDER_DEFAULTS, ...settings.get('reminders', {}) });
  const hourIn = (tz) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(ctx.now()));
  const claim = (name, key) => db.run('INSERT OR IGNORE INTO job_runs (name, run_key, started_at) VALUES (?, ?, ?)', name, key, nowIso()).changes > 0;
  const finish = (name, key, result) => db.run('UPDATE job_runs SET finished_at = ?, result = ? WHERE name = ? AND run_key = ?', nowIso(), JSON.stringify(result ?? null).slice(0, 2000), name, key);

  // ---------- e-mail s dnevnikom isporuke ----------
  /** Šalje točno jednom za `key`. Vraća 'poslano' | 'greska' | 'preskoceno' | 'vec'. */
  const nowT = () => ctx.now().toISOString();
  async function deliver(userId, kind, key, build) {
    const exists = db.get('SELECT status FROM notification_delivery_log WHERE dedupe_key = ?', key);
    if (exists) return 'vec';
    const u = db.get('SELECT email, is_blocked, is_guest FROM users WHERE id = ?', userId);
    if (!u?.email || u.is_blocked || u.is_guest) return 'preskoceno';
    if (!ctx.mailer.configured()) {
      db.run('INSERT OR IGNORE INTO notification_delivery_log (user_id, channel, kind, dedupe_key, status, detail, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        userId, 'email', kind, key, 'preskoceno', 'SMTP nije konfiguriran — e-mail nije poslan.', nowT(), nowIso());
      return 'preskoceno';
    }
    if (!db.run("INSERT OR IGNORE INTO notification_delivery_log (user_id, channel, kind, dedupe_key, status, created_at, updated_at) VALUES (?, 'email', ?, ?, 'slanje', ?, ?)", userId, kind, key, nowT(), nowIso()).changes) return 'vec';
    try {
      const msg = build(u);
      const r = await ctx.mailer.send({ to: u.email, ...msg });
      db.run("UPDATE notification_delivery_log SET status = 'poslano', detail = ?, updated_at = ? WHERE dedupe_key = ?", String(r.id || '').slice(0, 300), nowIso(), key);
      return 'poslano';
    } catch (e) {
      db.run("UPDATE notification_delivery_log SET status = 'greska', detail = ?, updated_at = ? WHERE dedupe_key = ?", String(e.message).slice(0, 500), nowIso(), key);
      return 'greska';
    }
  }
  const links = (userId) => {
    const p = N().prefs(userId);
    return { game: config.baseUrl + '/', prefs: config.baseUrl + '/profil#obavijesti', unsub: `${config.baseUrl}/odjava-obavijesti?t=${p.unsub_token}` };
  };
  const listHeaders = (l) => ({ 'List-Unsubscribe': `<${l.unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });

  // ---------- podsjetnik nakon neaktivnosti ----------
  async function reminders() {
    const c = rcfg();
    if (!c.enabled) return { skipped: 'iskljuceno' };
    if (hourIn(settings.get('timezone', 'Europe/Zagreb')) < c.send_hour) return { skipped: 'prerano' };
    const today = game.today();
    const out = { inapp: 0, email: {} };
    const cutoff = addDays(today, -c.inactivity_days);
    // kandidati: registrirani, nisu blokirani, zadnja službena partija (ili otvaranje računa) prije praga
    const users = db.all(`SELECT u.id, u.created_at, (SELECT MAX(lb.date) FROM leaderboards lb WHERE lb.user_id = u.id) AS last
                          FROM users u WHERE u.is_guest = 0 AND u.is_blocked = 0`);
    for (const u of users) {
      const last = u.last || u.created_at.slice(0, 10);
      if (last > cutoff) continue;
      const p = N().prefs(u.id);
      const since = new Date(ctx.now().getTime() - c.cooldown_days * 86400000).toISOString();
      // u aplikaciji: najviše jednom u razdoblju hlađenja (ključ sadrži datum igre)
      if (p.notif_daily && !db.get("SELECT 1 AS x FROM notifications WHERE user_id = ? AND type = 'podsjetnik' AND dedupe_key > ?", u.id, `podsjetnik:${addDays(today, -c.cooldown_days)}`)) {
        if (N().notify(u.id, 'podsjetnik', { emoji: '🏎️', title: 'Nova ruta te čeka!', body: 'Vrijeme je da ponovno sjedneš za volan.', link: '/', dedupe: `podsjetnik:${today}` })) out.inapp++;
      }
      // e-mail: samo uz izričitu privolu; hlađenje; najviše N podsjetnika dok se igrač ne vrati
      if (!p.email_reminders) continue;
      if (db.get("SELECT 1 AS x FROM notification_delivery_log WHERE user_id = ? AND kind = 'podsjetnik' AND status IN ('poslano','slanje') AND created_at > ?", u.id, since)) continue;
      const sentStreak = db.get("SELECT COUNT(*) AS n FROM notification_delivery_log WHERE user_id = ? AND kind = 'podsjetnik' AND status = 'poslano' AND created_at > ?", u.id, last + 'T00:00:00Z').n;
      if (sentStreak >= c.max_per_streak) continue;
      const l = links(u.id);
      const r = await deliver(u.id, 'podsjetnik', `podsjetnik:${u.id}:${today}`, () => {
        const { html, text } = emailLayout({ title: '🏎️ Nova ruta te čeka!', lead: 'Nekoliko dana nisi odigrao Ontale. Današnjih deset sportskih pitanja te čeka — vrijeme je da ponovno sjedneš za volan.', button: 'Igraj današnju rutu', url: l.game,
          footer: 'Ovaj podsjetnik primaš jer si ga uključio u postavkama profila. Šaljemo ga najviše jednom tjedno i samo dok ne igraš.', prefsUrl: l.prefs, unsubUrl: l.unsub });
        return { subject: 'Nova ruta te čeka — Ontale', html, text, headers: listHeaders(l) };
      });
      out.email[r] = (out.email[r] || 0) + 1;
    }
    return out;
  }

  // ---------- sažetak nepročitanih poruka e-mailom (najviše jednom u N sati) ----------
  async function messageDigests() {
    const c = rcfg();
    const out = {};
    const users = db.all('SELECT user_id FROM user_prefs WHERE email_messages = 1');
    const window = Math.floor(Date.now() / (c.digest_hours * 3600000));
    for (const { user_id } of users) {
      const oldEnough = new Date(Date.now() - 15 * 60000).toISOString();
      const unread = db.get(`SELECT COUNT(*) AS n FROM private_messages pm JOIN conversation_members cm ON cm.conversation_id = pm.conversation_id AND cm.user_id = ?
                             WHERE pm.id > cm.last_read_id AND pm.id > cm.hidden_before_id AND pm.sender_id != ? AND pm.created_at < ? AND pm.removed_at IS NULL`, user_id, user_id, oldEnough).n;
      if (!unread) continue;
      if (db.get("SELECT 1 AS x FROM notification_delivery_log WHERE user_id = ? AND kind = 'poruke' AND created_at > ?", user_id, new Date(Date.now() - c.digest_hours * 3600000).toISOString())) continue;
      const l = links(user_id);
      const r = await deliver(user_id, 'poruke', `poruke:${user_id}:${window}`, () => {
        const { html, text } = emailLayout({ title: `✉️ Imaš ${unread === 1 ? 'novu poruku' : `${unread} nepročitanih poruka`}`, lead: 'Netko iz tvojih liga ti je pisao na Ontaleu. Sadržaj poruka ne šaljemo e-mailom — pročitaj ih u aplikaciji.', button: 'Otvori poruke', url: config.baseUrl + '/poruke',
          footer: 'Ove obavijesti primaš jer si ih uključio u postavkama. Šaljemo najviše jedan sažetak u nekoliko sati.', prefsUrl: l.prefs, unsubUrl: l.unsub });
        return { subject: 'Nove poruke na Ontaleu', html, text, headers: listHeaders(l) };
      });
      out[r] = (out[r] || 0) + 1;
    }
    return out;
  }

  let running = false;
  /** Jedan prolaz svih poslova. Sigurno ga je zvati često (svakih nekoliko minuta) i iz više mjesta. */
  async function tick() {
    if (running) return { busy: true };
    running = true;
    const res = {};
    const step = async (name, fn) => { try { res[name] = await fn(); } catch (e) { res[name] = { error: e.message }; console.error(`Posao ${name}:`, e); } };
    try {
      await step('dani', () => game.finalizePastDays());
      await step('izazovi', () => ctx.duels.sweep());
      await step('nagrade', () => ctx.awards.finalizeDue());
      const y = addDays(game.today(), -1);
      await step('dnevne-nagrade', () => { if (!claim('dnevne-nagrade', y)) return 'vec'; const n = ctx.awards.notifyDaily(y); finish('dnevne-nagrade', y, n); return n; });
      await step('podsjetnici', reminders);
      await step('poruke', messageDigests);
    } finally { running = false; }
    return res;
  }
  /** Probni e-mail iz administracije (provjera SMTP postavki). */
  async function testEmail(to) {
    if (!ctx.mailer.configured()) return { ok: false, error: 'SMTP nije konfiguriran.' };
    const key = `test:${Date.now()}`;
    db.run("INSERT INTO notification_delivery_log (user_id, channel, kind, dedupe_key, status, detail, created_at, updated_at) VALUES (NULL, 'email', 'test', ?, 'slanje', ?, ?, ?)", key, to, nowIso(), nowIso());
    try {
      const { html, text } = emailLayout({ title: 'Probni e-mail', lead: 'Ako ovo čitaš, SMTP postavke Ontalea rade.', button: 'Otvori Ontale', url: config.baseUrl, footer: 'Poslano iz administracije.', prefsUrl: config.baseUrl + '/profil', unsubUrl: config.baseUrl + '/profil' });
      const r = await ctx.mailer.send({ to, subject: 'Ontale — probni e-mail', html, text });
      db.run("UPDATE notification_delivery_log SET status = 'poslano', detail = ?, updated_at = ? WHERE dedupe_key = ?", `${to} · ${r.id}`.slice(0, 300), nowIso(), key);
      return { ok: true, id: r.id };
    } catch (e) {
      db.run("UPDATE notification_delivery_log SET status = 'greska', detail = ?, updated_at = ? WHERE dedupe_key = ?", `${to} · ${e.message}`.slice(0, 500), nowIso(), key);
      return { ok: false, error: e.message };
    }
  }
  return { tick, reminders, messageDigests, deliver, testEmail, rcfg };
}
