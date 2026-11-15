// Administracija značajki v2.3: moderacija poruka i putokaza, obavijesti i e-mail, izazovi, zvuk, karte.
// Sve radnje bilježe se u dnevnik izmjena (admin_audit_logs) kroz ctx.admin.audit.
import { nowIso, HttpError, bad } from './util.js';
import { mapAdminInfo, MAP_DEFAULTS } from './mapcfg.js';
import { REMINDER_DEFAULTS } from './poslovi.js';

export function createAdmin2(ctx) {
  const { db, settings } = ctx;
  const audit = (...a) => ctx.admin.audit(...a);
  const nick = (id) => (id ? db.get('SELECT nickname FROM profiles WHERE user_id = ?', id)?.nickname || `#${id}` : '—');

  // ---------- Prijave privatnih poruka ----------
  function messageReports({ status } = {}) {
    const rows = db.all(`SELECT r.*, pm.body, pm.sender_id, pm.conversation_id, pm.created_at AS sent_at, pm.removed_at, c.user_a, c.user_b
                         FROM message_reports r JOIN private_messages pm ON pm.id = r.message_id JOIN conversations c ON c.id = pm.conversation_id
                         ${status ? 'WHERE r.status = ?' : ''} ORDER BY r.status = 'novo' DESC, r.id DESC LIMIT 300`, ...(status ? [status] : []));
    return rows.map((r) => ({
      id: r.id, status: r.status, reason: r.reason, created_at: r.created_at, action: r.action, message_id: r.message_id, body: r.body, removed: !!r.removed_at, sent_at: r.sent_at,
      sender: { id: r.sender_id, nickname: nick(r.sender_id) }, recipient: { id: r.sender_id === r.user_a ? r.user_b : r.user_a, nickname: nick(r.sender_id === r.user_a ? r.user_b : r.user_a) },
      reporter: { id: r.reporter_id, nickname: nick(r.reporter_id) },
      sender_reports: db.get('SELECT COUNT(*) AS n FROM message_reports mr JOIN private_messages p ON p.id = mr.message_id WHERE p.sender_id = ?', r.sender_id).n,
    }));
  }
  /** Kontekst prijavljene poruke: samo nekoliko poruka oko nje (ne cijeli razgovor). */
  function reportContext(reportId) {
    const r = db.get('SELECT r.message_id, pm.conversation_id FROM message_reports r JOIN private_messages pm ON pm.id = r.message_id WHERE r.id = ?', Number(reportId));
    if (!r) throw new HttpError(404, 'Prijava ne postoji.');
    const around = db.all(`SELECT id, sender_id, body, created_at, removed_at FROM private_messages WHERE conversation_id = ? AND id BETWEEN ? AND ? ORDER BY id`, r.conversation_id, r.message_id - 200, r.message_id + 200)
      .filter((m, i, arr) => Math.abs(arr.findIndex((x) => x.id === r.message_id) - i) <= 4);
    return { messages: around.map((m) => ({ ...m, sender: nick(m.sender_id), reported: m.id === r.message_id })) };
  }
  function resolveMessageReport(admin, id, { action, note } = {}) {
    const r = db.get('SELECT r.*, pm.sender_id FROM message_reports r JOIN private_messages pm ON pm.id = r.message_id WHERE r.id = ?', Number(id));
    if (!r) throw new HttpError(404, 'Prijava ne postoji.');
    if (!['ukloni', 'odbaci', 'blokiraj'].includes(action)) throw bad('Radnja mora biti: ukloni, odbaci ili blokiraj.');
    db.tx(() => {
      if (action === 'ukloni' || action === 'blokiraj') db.run('UPDATE private_messages SET removed_at = COALESCE(removed_at, ?), removed_by = ? WHERE id = ?', nowIso(), admin.id, r.message_id);
      if (action === 'blokiraj') { db.run('UPDATE users SET is_blocked = 1, block_reason = ? WHERE id = ?', String(note || 'Prijavljene privatne poruke').slice(0, 300), r.sender_id); db.run('DELETE FROM auth_sessions WHERE user_id = ?', r.sender_id); }
      db.run('UPDATE message_reports SET status = ?, action = ?, resolved_at = ?, resolved_by = ? WHERE message_id = ? AND status = ?', action === 'odbaci' ? 'odbaceno' : 'rijeseno', action, nowIso(), admin.id, r.message_id, 'novo');
    });
    audit(admin, 'moderacija-poruke', 'poruka', r.message_id, { action, note });
    ctx.bumpBoards();
    return { ok: true };
  }

  // ---------- Putokazi ----------
  function signs({ q, date, status, reported } = {}) {
    const where = [], args = [];
    if (q) { where.push('(r.text LIKE ? OR p.nickname LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
    if (date) { where.push('r.date = ?'); args.push(date); }
    if (status) { where.push('r.status = ?'); args.push(status); }
    if (reported === '1') where.push("EXISTS (SELECT 1 FROM sign_reports x WHERE x.sign_id = r.id AND x.status = 'novo')");
    return db.all(`SELECT r.id, r.user_id, p.nickname, r.date, m.slug AS map, r.km, r.text, r.shape, r.status, r.edits, r.removed_reason, r.created_at, r.updated_at,
                          (SELECT COUNT(*) FROM sign_reports x WHERE x.sign_id = r.id) AS reports, (SELECT COUNT(*) FROM sign_reports x WHERE x.sign_id = r.id AND x.status = 'novo') AS open_reports,
                          (SELECT group_concat(COALESCE(x.reason, '—'), ' | ') FROM sign_reports x WHERE x.sign_id = r.id) AS reasons
                   FROM route_sign_messages r JOIN profiles p ON p.user_id = r.user_id JOIN maps m ON m.id = r.map_id
                   ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY open_reports DESC, r.id DESC LIMIT 300`, ...args);
  }
  function moderateSign(admin, id, { action, reason } = {}) {
    const s = db.get('SELECT * FROM route_sign_messages WHERE id = ?', Number(id));
    if (!s) throw new HttpError(404, 'Putokaz ne postoji.');
    if (action === 'ukloni') db.run("UPDATE route_sign_messages SET status = 'uklonjen', removed_by = ?, removed_reason = ?, updated_at = ? WHERE id = ?", admin.id, String(reason || '').slice(0, 200) || null, nowIso(), s.id);
    else if (action === 'vrati') db.run("UPDATE route_sign_messages SET status = 'aktivan', removed_by = NULL, removed_reason = NULL, updated_at = ? WHERE id = ?", nowIso(), s.id);
    else if (action !== 'odbaci') throw bad('Radnja mora biti: ukloni, vrati ili odbaci.');
    db.run("UPDATE sign_reports SET status = ?, resolved_at = ? WHERE sign_id = ? AND status = 'novo'", action === 'odbaci' ? 'odbaceno' : 'rijeseno', nowIso(), s.id);
    audit(admin, 'moderacija-putokaza', 'putokaz', s.id, { action, reason, text: s.text });
    ctx.bumpBoards();
    return { ok: true };
  }

  // ---------- Obavijesti i e-mail ----------
  function notificationsOverview() {
    const week = new Date(Date.now() - 7 * 86400000).toISOString();
    return {
      by_type: db.all('SELECT type, COUNT(*) AS n, SUM(read_at IS NULL) AS unread FROM notifications WHERE created_at > ? GROUP BY type ORDER BY n DESC', week),
      reminders: { ...REMINDER_DEFAULTS, ...settings.get('reminders', {}) },
      email: { configured: ctx.mailer.configured(), ...ctx.mailer.info() },
      opted_in: { reminders: db.get('SELECT COUNT(*) AS n FROM user_prefs WHERE email_reminders = 1').n, messages: db.get('SELECT COUNT(*) AS n FROM user_prefs WHERE email_messages = 1').n },
      delivery: db.all(`SELECT d.id, d.user_id, p.nickname, d.kind, d.status, d.detail, d.attempts, d.created_at, d.updated_at FROM notification_delivery_log d
                        LEFT JOIN profiles p ON p.user_id = d.user_id ORDER BY d.id DESC LIMIT 200`),
      failed: db.get("SELECT COUNT(*) AS n FROM notification_delivery_log WHERE status = 'greska'").n,
      jobs: db.all('SELECT * FROM job_runs ORDER BY started_at DESC LIMIT 20'),
    };
  }
  /** Sistemska obavijest svim registriranim igračima (npr. najava novosti). */
  function broadcast(admin, { title, body, link }) {
    const t = String(title || '').trim().slice(0, 120);
    if (t.length < 3) throw bad('Naslov obavijesti je prekratak.');
    if (link && !/^\/[^\s]*$/.test(link)) throw bad('Poveznica mora biti putanja unutar stranice (npr. /lige).');
    const key = `sustav:${Date.now()}`;
    let n = 0;
    for (const u of db.all('SELECT id FROM users WHERE is_guest = 0 AND is_blocked = 0')) if (ctx.notifications.notify(u.id, 'sustav', { emoji: '📣', title: t, body: String(body || '').slice(0, 300) || null, link: link || null, dedupe: key })) n++;
    audit(admin, 'obavijest-svima', 'obavijest', null, { title: t, n });
    return { sent: n };
  }

  // ---------- Izazovi među prijateljima ----------
  function duels({ status, q } = {}) {
    const where = [], args = [];
    if (status) { where.push('c.status = ?'); args.push(status); }
    if (q) { where.push('(a.nickname LIKE ? OR b.nickname LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }
    return db.all(`SELECT c.id, c.date, m.slug AS map, c.status, c.outcome, c.message, c.created_at, c.completed_at, a.nickname AS challenger, b.nickname AS opponent, w.nickname AS winner, c.result
                   FROM player_challenges c JOIN maps m ON m.id = c.map_id LEFT JOIN profiles a ON a.user_id = c.challenger_id LEFT JOIN profiles b ON b.user_id = c.opponent_id LEFT JOIN profiles w ON w.user_id = c.winner_id
                   ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY c.id DESC LIMIT 300`, ...args)
      .map((r) => ({ ...r, result: r.result ? JSON.parse(r.result) : null }));
  }
  function cancelDuel(admin, id, reason) {
    const c = db.get('SELECT * FROM player_challenges WHERE id = ?', Number(id));
    if (!c) throw new HttpError(404, 'Izazov ne postoji.');
    if (!['ceka', 'prihvacen'].includes(c.status)) throw bad('Otkazati se mogu samo izazovi na čekanju ili prihvaćeni.');
    db.run("UPDATE player_challenges SET status = 'otkazan', completed_at = ? WHERE id = ?", nowIso(), c.id);
    db.run('INSERT INTO challenge_events (challenge_id, user_id, event, created_at) VALUES (?, ?, ?, ?)', c.id, admin.id, 'otkazao-admin', nowIso());
    audit(admin, 'otkazi-izazov', 'izazov-prijatelja', c.id, { reason });
    return { ok: true };
  }

  // ---------- Karte ----------
  const mapInfo = () => mapAdminInfo(settings, ctx.mapEnv);
  function saveMapSettings(admin, b = {}) {
    const cur = { ...MAP_DEFAULTS, ...settings.get('map', {}) };
    const next = { ...cur };
    if (b.default_mode !== undefined) { if (!['reljef', 'satelit'].includes(b.default_mode)) throw bad('Zadani prikaz mora biti reljef ili satelit.'); next.default_mode = b.default_mode; }
    if (b.provider !== undefined) { if (!['auto', 'maptiler', 'stadia', 'besplatno', 'prilagodeno'].includes(b.provider)) throw bad('Nepoznat pružatelj.'); next.provider = b.provider; }
    for (const k of ['terrain_style_url', 'satellite_url']) if (b[k] !== undefined) { const v = String(b[k] || '').trim(); if (v && !/^https:\/\/[^\s"'<>]+$/.test(v)) throw bad('Adresa mora počinjati s https:// i ne smije imati razmake.'); if (/[?&](key|api_key|access_token)=/i.test(v)) throw bad('Ključ ne upisuj u adresu — postavi ga u .env (MAPTILER_KEY / STADIA_API_KEY).'); next[k] = v; }
    if (b.attribution !== undefined) next.attribution = String(b.attribution || '').replace(/[<>]/g, '').slice(0, 300);
    if (b.eox_noncommercial !== undefined) next.eox_noncommercial = !!b.eox_noncommercial;
    if (b.fallback_style !== undefined) next.fallback_style = String(b.fallback_style || 'tamna').slice(0, 300);
    if (b.satellite_dim !== undefined) { const v = Number(b.satellite_dim); if (!(v >= 0 && v <= 0.6)) throw bad('Zatamnjenje satelita mora biti 0–0,6.'); next.satellite_dim = v; }
    settings.set('map', next);
    audit(admin, 'postavke-karte', 'postavke', 'map', next);
    return mapInfo();
  }
  function saveSignSettings(admin, b = {}) {
    const cur = { max_len: 60, enabled: true, history: true, extra_words: [], ...settings.get('signposts', {}) };
    const n = Number(b.max_len ?? cur.max_len);
    if (!(n >= 20 && n <= 80)) throw bad('Najveća duljina putokaza mora biti 20–80 znakova.');
    const next = { max_len: Math.round(n), enabled: b.enabled ?? cur.enabled, history: b.history ?? cur.history, extra_words: Array.isArray(b.extra_words) ? b.extra_words.map((w) => String(w).trim()).filter((w) => w.length >= 3).slice(0, 200) : cur.extra_words };
    settings.set('signposts', next);
    audit(admin, 'postavke-putokaza', 'postavke', 'signposts', next);
    return next;
  }
  function saveReminderSettings(admin, b = {}) {
    const cur = { ...REMINDER_DEFAULTS, ...settings.get('reminders', {}) };
    const between = (v, lo, hi, name) => { const x = Number(v); if (!(x >= lo && x <= hi)) throw bad(`${name} mora biti između ${lo} i ${hi}.`); return Math.round(x); };
    const next = { enabled: b.enabled ?? cur.enabled, inactivity_days: between(b.inactivity_days ?? cur.inactivity_days, 2, 14, 'Broj dana neaktivnosti'), cooldown_days: between(b.cooldown_days ?? cur.cooldown_days, 3, 30, 'Razmak između podsjetnika'),
      max_per_streak: between(b.max_per_streak ?? cur.max_per_streak, 1, 10, 'Najviše podsjetnika'), send_hour: between(b.send_hour ?? cur.send_hour, 0, 23, 'Sat slanja'), digest_hours: between(b.digest_hours ?? cur.digest_hours, 1, 48, 'Razmak sažetaka poruka') };
    settings.set('reminders', !!next.enabled === next.enabled ? next : { ...next, enabled: !!next.enabled });
    audit(admin, 'postavke-podsjetnika', 'postavke', 'reminders', next);
    return next;
  }
  function moderationCounts() {
    return { messages: db.get("SELECT COUNT(*) AS n FROM message_reports WHERE status = 'novo'").n, signs: db.get("SELECT COUNT(DISTINCT sign_id) AS n FROM sign_reports WHERE status = 'novo'").n, email_failed: db.get("SELECT COUNT(*) AS n FROM notification_delivery_log WHERE status = 'greska' AND created_at > ?", new Date(Date.now() - 7 * 86400000).toISOString()).n };
  }
  return { messageReports, reportContext, resolveMessageReport, signs, moderateSign, notificationsOverview, broadcast, duels, cancelDuel, mapInfo, saveMapSettings, saveSignSettings, saveReminderSettings, moderationCounts };
}
