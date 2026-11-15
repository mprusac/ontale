// Privatne poruke između registriranih igrača: razgovori, dozvole, blokiranje, prijave, ograničenja.
// Čitati smiju samo sudionici razgovora; sve provjere su na poslužitelju.
import { nowIso, HttpError, bad } from './util.js';
import { checkPrivateText } from './tekst.js';

const MAX_LEN = 1000;
const PAGE = 30;

export function createMessages(ctx) {
  const { db } = ctx;
  const N = () => ctx.notifications;

  const need = (user) => { if (!user || user.is_guest) throw new HttpError(401, 'Poruke su dostupne registriranim igračima. Prijavi se.'); return user; };
  const userRow = (id) => db.get(`SELECT u.id, u.is_guest, u.is_blocked, p.nickname, p.avatar FROM users u JOIN profiles p ON p.user_id = u.id WHERE u.id = ?`, Number(id));
  const blockedEither = (a, b) => !!db.get('SELECT 1 AS x FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)', a, b, b, a);
  const sharesLeague = (a, b) => !!db.get('SELECT 1 AS x FROM league_members x JOIN league_members y ON y.league_id = x.league_id JOIN leagues l ON l.id = x.league_id WHERE x.user_id = ? AND y.user_id = ? AND l.is_hidden = 0', a, b);

  /**
   * Smije li `from` kontaktirati `to` (poruke, izazovi)? Vraća null ili razlog odbijanja.
   * Blokada vrijedi u oba smjera i za sve oblike kontakta.
   */
  function contactDenied(fromId, toId) {
    if (fromId === toId) return 'Ne možeš pisati sam sebi.';
    const to = userRow(toId);
    if (!to || to.is_blocked) return 'Igrač ne postoji.';
    if (to.is_guest) return 'Igrač nema registriran račun.';
    if (blockedEither(fromId, toId)) return 'Ne možete se međusobno kontaktirati.';
    const policy = N().prefs(toId).dm_policy;
    if (policy === 'nitko') return `${to.nickname} ne prima poruke.`;
    if (policy === 'lige' && !sharesLeague(fromId, toId)) return `${to.nickname} prima poruke samo od članova svojih liga.`;
    return null;
  }

  const pair = (a, b) => (a < b ? [a, b] : [b, a]);
  function convFor(user, id) {
    const c = db.get('SELECT * FROM conversations WHERE id = ?', Number(id));
    if (!c || (c.user_a !== user.id && c.user_b !== user.id)) throw new HttpError(404, 'Razgovor ne postoji.');
    return { ...c, other: c.user_a === user.id ? c.user_b : c.user_a };
  }
  const member = (convId, userId) => db.get('SELECT * FROM conversation_members WHERE conversation_id = ? AND user_id = ?', convId, userId);

  /** Otvara (ili pronalazi) razgovor s igračem. Novi razgovor zahtijeva dozvolu primatelja. */
  function open(user, { user_id, nickname }) {
    need(user);
    const target = user_id ? userRow(user_id) : db.get('SELECT u.id FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.nickname = ? COLLATE NOCASE', String(nickname || ''));
    if (!target) throw new HttpError(404, 'Igrač ne postoji.');
    const [a, b] = pair(user.id, target.id);
    const existing = db.get('SELECT id FROM conversations WHERE user_a = ? AND user_b = ?', a, b);
    if (existing) return { id: existing.id, can_send: !contactDenied(user.id, target.id) };
    const why = contactDenied(user.id, target.id);
    if (why) throw new HttpError(403, why);
    return db.tx(() => {
      const id = db.run('INSERT INTO conversations (user_a, user_b, created_at) VALUES (?, ?, ?)', a, b, nowIso()).id;
      db.run('INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)', id, a, id, b);
      return { id, can_send: true };
    });
  }

  function inbox(user) {
    need(user);
    const rows = db.all(`SELECT c.id, c.last_message_at, c.last_message_id, CASE WHEN c.user_a = ? THEN c.user_b ELSE c.user_a END AS other, cm.last_read_id, cm.hidden_before_id
                         FROM conversations c JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ?
                         WHERE (c.user_a = ? OR c.user_b = ?) AND c.last_message_id IS NOT NULL AND c.last_message_id > cm.hidden_before_id
                         ORDER BY c.last_message_at DESC LIMIT 200`, user.id, user.id, user.id, user.id);
    return {
      conversations: rows.map((r) => {
        const o = userRow(r.other);
        const last = db.get('SELECT id, sender_id, body, created_at, removed_at FROM private_messages WHERE id = ?', r.last_message_id);
        const unread = db.get('SELECT COUNT(*) AS n FROM private_messages WHERE conversation_id = ? AND id > ? AND id > ? AND sender_id != ?', r.id, r.last_read_id, r.hidden_before_id, user.id).n;
        const theirRead = db.get('SELECT last_read_id FROM conversation_members WHERE conversation_id = ? AND user_id = ?', r.id, r.other)?.last_read_id || 0;
        return {
          id: r.id, other: { id: o.id, nickname: o.nickname, avatar: o.avatar, blocked: !!o.is_blocked }, unread,
          last: last && { mine: last.sender_id === user.id, preview: last.removed_at ? 'Poruka je uklonjena.' : last.body.slice(0, 90), at: last.created_at, seen: last.sender_id === user.id && theirRead >= last.id },
        };
      }),
      unread: unreadTotal(user.id),
    };
  }
  function unreadTotal(userId) {
    return db.get(`SELECT COUNT(*) AS n FROM private_messages pm JOIN conversation_members cm ON cm.conversation_id = pm.conversation_id AND cm.user_id = ?
                   WHERE pm.id > cm.last_read_id AND pm.id > cm.hidden_before_id AND pm.sender_id != ?`, userId, userId).n;
  }

  const view = (m, userId) => ({ id: m.id, mine: m.sender_id === userId, body: m.removed_at ? null : m.body, removed: !!m.removed_at, at: m.created_at });
  /** Poruke razgovora, od najnovijih; `before` = ID za učitavanje starijih (stranica po 30). */
  function messages(user, convId, { before } = {}) {
    need(user);
    const c = convFor(user, convId);
    const me = member(c.id, user.id);
    const rows = db.all(`SELECT * FROM private_messages WHERE conversation_id = ? AND id > ? ${before ? 'AND id < ?' : ''} ORDER BY id DESC LIMIT ?`,
      ...(before ? [c.id, me.hidden_before_id, Number(before), PAGE + 1] : [c.id, me.hidden_before_id, PAGE + 1]));
    const o = userRow(c.other);
    const theirRead = member(c.id, c.other)?.last_read_id || 0;
    const denied = contactDenied(user.id, c.other);
    return {
      id: c.id, other: { id: o.id, nickname: o.nickname, avatar: o.avatar }, more: rows.length > PAGE,
      messages: rows.slice(0, PAGE).reverse().map((m) => view(m, user.id)), their_read_id: theirRead, my_read_id: me.last_read_id,
      can_send: !denied, cannot_send_reason: denied, i_blocked: !!db.get('SELECT 1 AS x FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?', user.id, c.other),
    };
  }

  // Ograničenja: najviše 12 poruka u minuti, 300 dnevno; ista poruka najviše 3 puta u 10 minuta.
  function rateCheck(userId, body) {
    if (ctx.config.rateLimitDisabled) return;
    const minAgo = new Date(Date.now() - 60000).toISOString(), dayAgo = new Date(Date.now() - 86400000).toISOString(), tenAgo = new Date(Date.now() - 600000).toISOString();
    if (db.get('SELECT COUNT(*) AS n FROM private_messages WHERE sender_id = ? AND created_at > ?', userId, minAgo).n >= 12) throw new HttpError(429, 'Šalješ prebrzo. Pričekaj malo.');
    if (db.get('SELECT COUNT(*) AS n FROM private_messages WHERE sender_id = ? AND created_at > ?', userId, dayAgo).n >= 300) throw new HttpError(429, 'Dosegnuto je dnevno ograničenje poruka.');
    if (db.get('SELECT COUNT(*) AS n FROM private_messages WHERE sender_id = ? AND body = ? AND created_at > ?', userId, body, tenAgo).n >= 3) throw new HttpError(429, 'Ista poruka se ne može slati stalno iznova.');
    // novi razgovori: najviše 20 dnevno (zaštita od masovnih poruka)
    const fresh = db.get(`SELECT COUNT(*) AS n FROM conversations c WHERE (c.user_a = ? OR c.user_b = ?) AND c.created_at > ?
                          AND (SELECT sender_id FROM private_messages WHERE conversation_id = c.id ORDER BY id LIMIT 1) = ?`, userId, userId, dayAgo, userId).n;
    if (fresh > 20) throw new HttpError(429, 'Previše novih razgovora danas.');
  }

  function send(user, convId, rawBody) {
    need(user);
    const c = convFor(user, convId);
    const why = contactDenied(user.id, c.other);
    if (why) throw new HttpError(403, why);
    const body = checkPrivateText(rawBody, { max: MAX_LEN });
    rateCheck(user.id, body);
    const msg = db.tx(() => {
      const at = nowIso();
      const id = db.run('INSERT INTO private_messages (conversation_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)', c.id, user.id, body, at).id;
      db.run('UPDATE conversations SET last_message_id = ?, last_message_at = ? WHERE id = ?', id, at, c.id);
      db.run('UPDATE conversation_members SET last_read_id = ? WHERE conversation_id = ? AND user_id = ?', id, c.id, user.id);
      return db.get('SELECT * FROM private_messages WHERE id = ?', id);
    });
    // Jedna (osvježena) obavijest po razgovoru dok je nepročitana — nema poplave obavijesti.
    const unread = db.get('SELECT COUNT(*) AS n FROM private_messages WHERE conversation_id = ? AND sender_id = ? AND id > ?', c.id, user.id, member(c.id, c.other).last_read_id).n;
    N().notify(c.other, 'poruka', { emoji: '✉️', title: unread > 1 ? `${user.nickname}: ${unread} nove poruke` : `Nova poruka od ${user.nickname}`, body: body.slice(0, 120), link: `/poruke/${c.id}`, dedupe: `poruka:${c.id}`, upsert: true, data: { conversation: c.id, from: user.id } });
    return view(msg, user.id);
  }

  function markRead(user, convId, lastId) {
    need(user);
    const c = convFor(user, convId);
    const max = db.get('SELECT MAX(id) AS id FROM private_messages WHERE conversation_id = ?', c.id).id || 0;
    const upto = Math.min(max, Number(lastId) || max);
    db.run('UPDATE conversation_members SET last_read_id = MAX(last_read_id, ?) WHERE conversation_id = ? AND user_id = ?', upto, c.id, user.id);
    if (upto >= max) db.run("UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE user_id = ? AND dedupe_key = ?", nowIso(), user.id, `poruka:${c.id}`);
    return { unread: unreadTotal(user.id) };
  }
  /** Briše razgovor samo kod sebe (druga strana ga i dalje vidi). Nova poruka ga ponovno otvara. */
  function hide(user, convId) {
    need(user);
    const c = convFor(user, convId);
    const max = db.get('SELECT MAX(id) AS id FROM private_messages WHERE conversation_id = ?', c.id).id || 0;
    db.run('UPDATE conversation_members SET hidden_before_id = ?, last_read_id = MAX(last_read_id, ?) WHERE conversation_id = ? AND user_id = ?', max, max, c.id, user.id);
    return { ok: true };
  }

  function report(user, messageId, reason) {
    need(user);
    const m = db.get('SELECT pm.*, c.user_a, c.user_b FROM private_messages pm JOIN conversations c ON c.id = pm.conversation_id WHERE pm.id = ?', Number(messageId));
    if (!m || (m.user_a !== user.id && m.user_b !== user.id)) throw new HttpError(404, 'Poruka ne postoji.');
    if (m.sender_id === user.id) throw bad('Ne možeš prijaviti vlastitu poruku.');
    db.run('INSERT OR IGNORE INTO message_reports (message_id, reporter_id, reason, created_at) VALUES (?, ?, ?, ?)', m.id, user.id, String(reason || '').trim().slice(0, 300) || null, nowIso());
    return { ok: true };
  }

  // ---------- Blokiranje ----------
  function block(user, targetId) {
    need(user);
    const t = userRow(targetId);
    if (!t || t.id === user.id) throw bad('Taj igrač se ne može blokirati.');
    db.run('INSERT OR IGNORE INTO user_blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)', user.id, t.id, nowIso());
    // Otvoreni izazovi među njima prestaju vrijediti
    db.run(`UPDATE player_challenges SET status = 'otkazan', completed_at = ? WHERE status IN ('ceka','prihvacen')
            AND ((challenger_id = ? AND opponent_id = ?) OR (challenger_id = ? AND opponent_id = ?))`, nowIso(), user.id, t.id, t.id, user.id);
    return { ok: true };
  }
  function unblock(user, targetId) { need(user); db.run('DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?', user.id, Number(targetId)); return { ok: true }; }
  function blocks(user) {
    need(user);
    return { users: db.all('SELECT b.blocked_id AS id, p.nickname, p.avatar, b.created_at FROM user_blocks b JOIN profiles p ON p.user_id = b.blocked_id WHERE b.blocker_id = ? ORDER BY b.created_at DESC', user.id) };
  }
  /** Odnos gledatelja prema igraču (za gumbe na profilu). */
  function relation(viewer, targetId) {
    if (!viewer || viewer.is_guest || viewer.id === targetId) return null;
    return {
      can_message: !contactDenied(viewer.id, targetId), message_denied: contactDenied(viewer.id, targetId),
      i_blocked: !!db.get('SELECT 1 AS x FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?', viewer.id, targetId),
      shares_league: sharesLeague(viewer.id, targetId),
    };
  }

  /** Igrači iz mojih liga (za brzi odabir primatelja i suparnika). */
  function contacts(user) {
    need(user);
    return { players: db.all(`SELECT DISTINCT u.id, p.nickname, p.avatar FROM league_members a JOIN league_members b ON b.league_id = a.league_id JOIN leagues l ON l.id = a.league_id
                              JOIN users u ON u.id = b.user_id JOIN profiles p ON p.user_id = u.id
                              WHERE a.user_id = ? AND b.user_id != ? AND l.is_hidden = 0 AND u.is_blocked = 0 ORDER BY p.nickname COLLATE NOCASE LIMIT 500`, user.id, user.id) };
  }

  return { contacts, open, inbox, messages, send, markRead, hide, report, block, unblock, blocks, relation, contactDenied, unreadTotal, blockedEither, sharesLeague, MAX_LEN };
}
