// HTTP sloj: usmjerivač, sigurnosna zaglavlja, ograničenje učestalosti, statičke datoteke i sve API rute.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { ROOT, config as defaultConfig } from './config.js';
import { openDb, makeSettings } from './db.js';
import { HttpError, bad, sha256 } from './util.js';
import { createGame } from './game.js';
import { createAuth } from './auth.js';
import { createSocial } from './social.js';
import { createLeagueStats } from './ligastat.js';
import { createAdmin } from './admin.js';
import { createAdmin2 } from './admin2.js';
import { createNotifications } from './obavijesti.js';
import { createMessages } from './poruke.js';
import { createSigns } from './putokazi.js';
import { createDuels } from './izazovi.js';
import { createAwards } from './nagrade.js';
import { createAudio } from './zvuk.js';
import { createJobs } from './poslovi.js';
import { createMailer } from './mailer.js';
import { mapConfig, mapCspHosts } from './mapcfg.js';

const MIME = { '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.webm': 'audio/webm', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };
const PUBLIC = path.join(ROOT, 'public');

export function createApp(overrides = {}) {
  const config = { ...defaultConfig, ...overrides };
  const db = overrides.db || openDb(config.dbPath);
  const ctx = { db, config, settings: makeSettings(db), version: 1, boardVersion: 1, lastSeen: new Map(), now: overrides.now || (() => new Date()) };
  ctx.bumpBoards = () => { ctx.boardVersion++; };
  ctx.game = createGame(ctx);
  ctx.auth = createAuth(ctx);
  ctx.social = createSocial(ctx);
  ctx.leagueStats = createLeagueStats(ctx);
  ctx.mailer = overrides.mailer || createMailer(config.smtp || {});
  ctx.notifications = createNotifications(ctx);
  ctx.messages = createMessages(ctx);
  ctx.signs = createSigns(ctx);
  ctx.duels = createDuels(ctx);
  ctx.awards = createAwards(ctx);
  ctx.audio = createAudio(ctx);
  ctx.jobs = createJobs(ctx);
  ctx.admin = createAdmin(ctx);
  ctx.admin2 = createAdmin2(ctx);
  ctx.mapEnv = overrides.mapEnv || process.env;
  ctx.onSessionFinished = (sessionId) => {
    for (const fn of [ctx.notifications.onSessionFinished, ctx.duels.onSessionFinished]) {
      try { fn(sessionId); } catch (e) { console.error('Događaj nakon partije nije uspio:', e); }
    }
  };
  const { game, auth, social, admin } = ctx;
  const N = ctx.notifications, M = ctx.messages, S = ctx.signs, D = ctx.duels, AW = ctx.awards;

  // ---------- Ograničenje učestalosti (klizni prozor u memoriji) ----------
  const hits = new Map();
  function limit(key, max, windowMs) {
    if (config.rateLimitDisabled) return;
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) throw new HttpError(429, 'Previše zahtjeva. Pričekaj malo pa pokušaj ponovno.');
    arr.push(now);
    hits.set(key, arr);
  }
  const sweep = setInterval(() => { const now = Date.now(); for (const [k, arr] of hits) if (!arr.length || now - arr[arr.length - 1] > 86400000) hits.delete(k); }, 600000);
  sweep.unref();

  // ---------- Rute ----------
  const routes = [];
  const route = (method, pattern, handler, opts = {}) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:([a-z_]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method, re, keys, handler, opts });
  };
  const needUser = (req) => { if (!req.user) throw new HttpError(401, 'Prijavi se.'); return req.user; };
  const needAcc = (req) => { if (!req.user || req.user.is_guest) throw new HttpError(401, 'Ovo je dostupno registriranim igračima. Prijavi se.'); return req.user; };
  const A = (method, pattern, handler) => route(method, '/api/admin' + pattern, handler, { admin: true });
  const id = (req) => { const n = Number(req.params.id); if (!Number.isInteger(n)) throw bad('Neispravan ID.'); return n; };

  // --- javno ---
  route('GET', '/api/bootstrap', (req) => ({
    me: auth.publicMe(req.user), google: auth.googleEnabled(), ...game.bootstrap(req.user),
    site: {
      name: ctx.settings.get('game_name', 'ONTALE'), tagline: ctx.settings.get('tagline', ''), logo_text: ctx.settings.get('logo_text', 'ONTALE'),
      colors: ctx.settings.get('colors', {}), messages: ctx.settings.get('messages', {}), map_style: ctx.settings.get('map_style', 'tamna'),
      reactions: ctx.settings.get('reactions', null), contact_email: ctx.settings.get('contact_email', ''),
      map: mapConfig(ctx.settings, ctx.mapEnv), audio: ctx.audio.publicConfig(), signposts: { max_len: S.cfg().max_len, enabled: S.cfg().enabled },
    },
    leagues: social.myLeagues(req.user),
    ...(req.user && !req.user.is_guest ? { prefs: N.publicPrefs(req.user.id), counts: N.counts(req.user), inactivity: N.inactivity(req.user.id) } : {}),
  }));
  route('GET', '/api/pages/:slug', (req) => {
    if (!['rules', 'privacy', 'terms'].includes(req.params.slug)) throw new HttpError(404, 'Stranica ne postoji.');
    return { slug: req.params.slug, text: ctx.settings.get(req.params.slug, '') };
  });
  route('GET', '/api/map/:slug', (req) => game.publicMap(req.params.slug));

  // --- prijava ---
  route('POST', '/api/auth/register', (req, res) => { limit('auth:' + req.ip, 10, 600000); return { me: auth.publicMe(auth.register(req, res, req.body)) }; });
  route('POST', '/api/auth/login', (req, res) => { limit('auth:' + req.ip, 15, 600000); return { me: auth.publicMe(auth.login(req, res, req.body)) }; });
  route('POST', '/api/auth/logout', (req, res) => { auth.logout(req, res); return { ok: true }; });
  route('POST', '/api/auth/reset', (req) => { limit('auth:' + req.ip, 10, 600000); auth.resetPassword(req.body); return { ok: true }; });
  route('GET', '/api/auth/google', (req, res) => { res.writeHead(302, { Location: auth.googleStart(req, res) }); res.end(); return undefined; }, { raw: true });
  route('GET', '/api/auth/google/callback', async (req, res) => {
    try { await auth.googleCallback(req, res, req.query); res.writeHead(302, { Location: '/' }); }
    catch (e) { res.writeHead(302, { Location: '/prijava?greska=' + encodeURIComponent(e.message) }); }
    res.end();
  }, { raw: true });
  route('PATCH', '/api/me', (req) => ({ me: auth.publicMe(auth.updateMe(needUser(req), req.body)) }));
  route('POST', '/api/me/password', (req) => { auth.changePassword(needUser(req), req.body); return { ok: true }; });
  route('DELETE', '/api/me', (req, res) => { const u = needUser(req); auth.deleteAccount(u.id); auth.logout(req, res); return { ok: true }; });
  route('GET', '/api/me/stats', (req) => social.stats(needUser(req).id));
  route('GET', '/api/me/export', (req) => {   // GDPR: prijenos podataka
    const u = needUser(req);
    return {
      account: auth.publicMe(u), stats: social.stats(u.id),
      sessions: db.all(`SELECT s.id, c.date, m.slug AS map, s.official, s.mode, s.total_km, s.started_at, s.finished_at FROM game_sessions s JOIN daily_challenges c ON c.id = s.challenge_id JOIN maps m ON m.id = s.map_id WHERE s.user_id = ?`, u.id),
      answers: db.all(`SELECT pa.session_id, pa.position, pa.raw, pa.is_correct, pa.km, pa.created_at FROM player_answers pa JOIN game_sessions s ON s.id = pa.session_id WHERE s.user_id = ?`, u.id),
      preferences: u.is_guest ? null : N.publicPrefs(u.id),
      sent_messages: db.all('SELECT conversation_id, body, created_at FROM private_messages WHERE sender_id = ? ORDER BY id', u.id),
      signposts: db.all('SELECT date, km, text, shape, status, created_at FROM route_sign_messages WHERE user_id = ?', u.id),
      challenges: db.all('SELECT id, date, status, outcome, created_at FROM player_challenges WHERE challenger_id = ? OR opponent_id = ?', u.id, u.id),
      blocks: db.all('SELECT blocked_id, created_at FROM user_blocks WHERE blocker_id = ?', u.id),
    };
  });

  // --- igra ---
  route('POST', '/api/game/start', (req, res) => {
    let user = req.user;
    if (!user) { limit('guest:' + req.ip, 30, 86400000); user = auth.ensureUser(req, res); }
    limit('start:' + user.id, 40, 600000);
    return game.start(user, req.body, req.ipHash);
  });
  route('GET', '/api/game/:id', (req) => game.state(needUser(req), id(req)));
  route('POST', '/api/game/:id/answer', (req) => {
    const u = needUser(req);
    limit('ans:' + u.id, 90, 60000);       // ponovni pokušaji i ispravci procjene troše više zahtjeva nego u v1
    limit('ansip:' + req.ip, 400, 60000);
    return game.answer(u, id(req), req.body.position, req.body.answer, { final: !!req.body.final });
  });
  route('POST', '/api/game/:id/next', (req) => { const u = needUser(req); limit('next:' + u.id, 60, 60000); return game.next(u, id(req)); });
  route('POST', '/api/game/:id/report', (req) => { const u = needUser(req); limit('rep:' + u.id, 40, 86400000); return game.report(u, id(req), req.body.position, req.body.raw, req.body.note); });
  route('GET', '/api/game/:id/result', (req) => game.result(needUser(req), id(req)));
  route('GET', '/api/archive', (req) => ({ today: game.today(), days: game.archive(req.user) }));

  // --- ljestvice, profili, lige ---
  route('GET', '/api/leaderboard', (req) => social.daily(req.query.map, req.query.date, req.user));
  route('GET', '/api/leaderboard/total', (req) => social.overall(req.query.map, req.query.period, req.user));
  route('GET', '/api/profile/:nick', (req) => {
    const p = social.profile(decodeURIComponent(req.params.nick), req.user);
    return { ...p, relation: M.relation(req.user, p.id), badges: p.private && !p.self ? [] : AW.badgesOf(p.id) };
  });
  route('GET', '/api/leagues', (req) => ({ leagues: social.myLeagues(req.user) }));
  route('POST', '/api/leagues', (req) => { limit('lg:' + needUser(req).id, 10, 3600000); return social.createLeague(req.user, req.body.name); });
  route('POST', '/api/leagues/join', (req) => { limit('lgj:' + needUser(req).id, 30, 3600000); return social.joinLeague(req.user, req.body.code); });
  route('GET', '/api/leagues/:id', (req) => social.league(needUser(req), id(req), req.query.date));
  route('GET', '/api/leagues/:id/stats', (req) => ctx.leagueStats.stats(needUser(req), id(req), req.query));
  route('PATCH', '/api/leagues/:id', (req) => social.updateLeague(needUser(req), id(req), req.body));
  route('POST', '/api/leagues/:id/leave', (req) => social.leaveLeague(needUser(req), id(req)));
  route('POST', '/api/reactions', (req) => { limit('react:' + needUser(req).id, 120, 3600000); return social.react(req.user, req.body.session_id, req.body.emoji); });
  route('GET', '/api/leagues/:id/awards', (req) => AW.history(needUser(req), id(req)));

  // --- v2.3: postavke, obavijesti ---
  route('GET', '/api/me/prefs', (req) => N.publicPrefs(needAcc(req).id));
  route('PATCH', '/api/me/prefs', (req) => N.updatePrefs(needAcc(req), req.body));
  route('GET', '/api/notifications', (req) => N.list(needUser(req), req.query));
  route('GET', '/api/notifications/count', (req) => N.counts(req.user));
  route('POST', '/api/notifications/read', (req) => N.markRead(needUser(req), req.body));
  route('POST', '/api/unsubscribe', (req) => { limit('unsub:' + req.ip, 30, 3600000); return N.unsubscribe(req.body.token); });

  // --- privatne poruke ---
  route('GET', '/api/conversations', (req) => M.inbox(needAcc(req)));
  route('POST', '/api/conversations', (req) => { limit('conv:' + needAcc(req).id, 40, 3600000); return M.open(req.user, req.body); });
  route('GET', '/api/conversations/:id', (req) => M.messages(needAcc(req), id(req), req.query));
  route('POST', '/api/conversations/:id/messages', (req) => { limit('pm:' + needAcc(req).id, 30, 60000); return M.send(req.user, id(req), req.body.body); });
  route('POST', '/api/conversations/:id/read', (req) => M.markRead(needAcc(req), id(req), req.body.last_id));
  route('POST', '/api/conversations/:id/hide', (req) => M.hide(needAcc(req), id(req)));
  route('POST', '/api/messages/:id/report', (req) => { limit('pmrep:' + needAcc(req).id, 20, 86400000); return M.report(req.user, id(req), req.body.reason); });
  route('GET', '/api/contacts', (req) => M.contacts(needAcc(req)));
  route('GET', '/api/blocks', (req) => M.blocks(needAcc(req)));
  route('POST', '/api/blocks', (req) => M.block(needAcc(req), Number(req.body.user_id)));
  route('DELETE', '/api/blocks/:id', (req) => M.unblock(needAcc(req), id(req)));

  // --- putokazi ---
  route('GET', '/api/signs/session/:id', (req) => S.mine(needAcc(req), id(req)));
  route('PUT', '/api/signs/session/:id', (req) => { limit('sign:' + needAcc(req).id, 30, 3600000); return S.save(req.user, { ...req.body, session_id: id(req) }); });
  route('DELETE', '/api/signs/session/:id', (req) => S.remove(needAcc(req), id(req)));
  route('POST', '/api/signs/:id/hide', (req) => S.hideFor(needAcc(req), id(req)));
  route('POST', '/api/signs/:id/report', (req) => { limit('signrep:' + needAcc(req).id, 20, 86400000); return S.report(req.user, id(req), req.body.reason); });

  // --- izazovi među prijateljima ---
  route('GET', '/api/duels', (req) => D.list(needAcc(req)));
  route('POST', '/api/duels', (req) => { limit('duel:' + needAcc(req).id, 30, 3600000); return D.create(req.user, req.body); });
  route('POST', '/api/duels/:id/accept', (req) => D.respond(needAcc(req), id(req), true));
  route('POST', '/api/duels/:id/decline', (req) => D.respond(needAcc(req), id(req), false));
  route('POST', '/api/duels/:id/cancel', (req) => D.cancel(needAcc(req), id(req)));

  route('POST', '/api/report-content', (req) => { limit('crep:' + req.ip, 10, 86400000); return social.reportContent(req.user, req.body); });

  // --- administracija (ovlast se provjerava na serveru za svaku rutu) ---
  A('GET', '/dashboard', () => admin.dashboard());
  A('GET', '/categories', () => admin.categories());
  A('POST', '/categories', (req) => admin.saveCategory(req.user, null, req.body));
  A('PATCH', '/categories/:id', (req) => admin.saveCategory(req.user, id(req), req.body));
  A('GET', '/questions', (req) => admin.listQuestions(req.query));
  A('POST', '/questions', (req) => admin.saveQuestion(req.user, null, req.body));
  A('POST', '/questions/bulk', (req) => admin.bulkQuestions(req.user, req.body));
  A('POST', '/questions/import', (req) => admin.importQuestions(req.user, req.body));
  A('GET', '/questions/:id', (req) => admin.getQuestion(id(req)));
  A('PATCH', '/questions/:id', (req) => admin.saveQuestion(req.user, id(req), req.body));
  A('DELETE', '/questions/:id', (req) => admin.deleteQuestion(req.user, id(req)));
  A('POST', '/questions/:id/copy', (req) => admin.copyQuestion(req.user, id(req)));
  A('POST', '/questions/:id/test', (req) => admin.testAnswer(id(req), req.body.input));
  A('GET', '/questions/:id/guesses', (req) => admin.guesses(id(req)));
  A('POST', '/questions/:id/recalc', (req) => { const r = game.recalcQuestion(id(req), req.body.mode === 'sve' ? 'sve' : 'novi'); admin.audit(req.user, 'obracun', 'pitanje', id(req), { mode: req.body.mode, ...r }); return r; });
  A('POST', '/questions/:id/answers', (req) => admin.addAnswer(req.user, id(req), req.body));
  A('POST', '/questions/:id/sources', (req) => admin.addSource(req.user, id(req), req.body));
  A('PATCH', '/answers/:id', (req) => admin.updateAnswer(req.user, id(req), req.body));
  A('DELETE', '/answers/:id', (req) => admin.deleteAnswer(req.user, id(req)));
  A('DELETE', '/sources/:id', (req) => admin.deleteSource(req.user, id(req)));
  A('GET', '/challenges', (req) => admin.listChallenges(req.query));
  A('POST', '/challenges', (req) => admin.saveChallenge(req.user, null, req.body));
  A('POST', '/challenges/compose', (req) => admin.composeChallenge(req.user, req.body));
  A('GET', '/quality', () => admin.quality());
  A('GET', '/challenges/:id', (req) => admin.getChallenge(id(req)));
  A('PATCH', '/challenges/:id', (req) => admin.saveChallenge(req.user, id(req), req.body));
  A('DELETE', '/challenges/:id', (req) => admin.deleteChallenge(req.user, id(req), req.query.force === '1'));
  A('POST', '/challenges/:id/copy', (req) => admin.copyChallenge(req.user, id(req), req.body.date));
  A('POST', '/challenges/:id/recalc', (req) => admin.recalcChallenge(req.user, id(req), req.body.mode));
  A('POST', '/challenges/:id/finalize', (req) => { const r = game.finalizeChallenge(id(req)); admin.audit(req.user, 'zakljuci', 'izazov', id(req), r); return r; });
  A('GET', '/reports', (req) => admin.reports(req.query));
  A('GET', '/unknown', (req) => admin.unknownAnswers(req.query));
  A('POST', '/reports/resolve', (req) => admin.resolveReport(req.user, req.body));
  A('GET', '/content-reports', () => admin.contentReports());
  A('POST', '/content-reports/:id/resolve', (req) => admin.resolveContentReport(req.user, id(req)));
  A('GET', '/users', (req) => admin.users(req.query));
  A('GET', '/users/:id', (req) => admin.userDetail(id(req)));
  A('PATCH', '/users/:id', (req) => admin.updateUser(req.user, id(req), req.body));
  A('DELETE', '/users/:id', (req) => admin.deleteUser(req.user, id(req)));
  A('POST', '/users/:id/reset-link', (req) => admin.resetLink(req.user, id(req)));
  A('GET', '/sessions/:id', (req) => admin.sessionDetail(id(req)));
  A('GET', '/leagues', (req) => admin.leagues(req.query));
  A('PATCH', '/leagues/:id', (req) => admin.updateLeague(req.user, id(req), req.body));
  A('GET', '/maps', () => admin.maps());
  A('POST', '/maps', (req) => admin.saveMap(req.user, null, req.body));
  A('PATCH', '/maps/:id', (req) => admin.saveMap(req.user, id(req), req.body));
  A('GET', '/transport-sets', () => admin.transportSets());
  A('POST', '/transport-sets', (req) => admin.saveTransportSet(req.user, null, req.body));
  A('PATCH', '/transport-sets/:id', (req) => admin.saveTransportSet(req.user, id(req), req.body));
  A('POST', '/transport-sets/:id/activate', (req) => admin.activateTransportSet(req.user, id(req)));
  A('DELETE', '/transport-sets/:id', (req) => admin.deleteTransportSet(req.user, id(req)));
  A('GET', '/settings', () => ctx.settings.all());
  A('PUT', '/settings', (req) => admin.saveSettings(req.user, req.body));
  A('GET', '/audit', (req) => admin.auditLog(req.query));
  // v2.3
  const A2 = ctx.admin2;
  A('GET', '/moderation/counts', () => A2.moderationCounts());
  A('GET', '/message-reports', (req) => A2.messageReports(req.query));
  A('GET', '/message-reports/:id/context', (req) => A2.reportContext(id(req)));
  A('POST', '/message-reports/:id/resolve', (req) => A2.resolveMessageReport(req.user, id(req), req.body));
  A('GET', '/signs', (req) => A2.signs(req.query));
  A('POST', '/signs/:id/moderate', (req) => A2.moderateSign(req.user, id(req), req.body));
  A('PUT', '/signs/settings', (req) => A2.saveSignSettings(req.user, req.body));
  A('GET', '/signs/settings', () => ({ max_len: 60, enabled: true, history: true, extra_words: [], ...ctx.settings.get('signposts', {}) }));
  A('GET', '/notifications', () => A2.notificationsOverview());
  A('PUT', '/notifications/reminders', (req) => A2.saveReminderSettings(req.user, req.body));
  A('POST', '/notifications/broadcast', (req) => A2.broadcast(req.user, req.body));
  A('POST', '/notifications/test-email', async (req) => { const r = await ctx.jobs.testEmail(String(req.body.to || req.user.email || '')); admin.audit(req.user, 'probni-email', 'email', null, r); return r; });
  A('POST', '/jobs/run', async (req) => { const r = await ctx.jobs.tick(); admin.audit(req.user, 'pokreni-poslove', 'poslovi', null, r); return r; });
  A('GET', '/duels', (req) => A2.duels(req.query));
  A('POST', '/duels/:id/cancel', (req) => A2.cancelDuel(req.user, id(req), req.body.reason));
  A('GET', '/audio', () => ctx.audio.adminView());
  A('PUT', '/audio', (req) => { const r = ctx.audio.save(req.body); admin.audit(req.user, 'postavke-zvuka', 'zvuk', null, req.body); return r; });
  A('POST', '/audio/upload', (req) => { const r = ctx.audio.upload(req.body); admin.audit(req.user, 'dodaj-zvuk', 'zvuk', null, { name: req.body.name, license: req.body.license }); return r; });
  A('PATCH', '/audio/assets/:id', (req) => ctx.audio.setActive(id(req), !!req.body.active));
  A('GET', '/map-settings', () => A2.mapInfo());
  A('PUT', '/map-settings', (req) => A2.saveMapSettings(req.user, req.body));

  // ---------- Obrada zahtjeva ----------
  const staticCache = new Map();
  function sendStatic(req, res, file, cacheControl) {
    let entry = staticCache.get(file);
    const stat = fs.statSync(file);
    if (!entry || entry.mtime !== stat.mtimeMs) {
      const buf = fs.readFileSync(file);
      const ext = path.extname(file);
      const compressible = /\.(html|js|css|svg|json|txt|webmanifest)$/.test(ext);
      entry = { mtime: stat.mtimeMs, buf, gz: compressible ? zlib.gzipSync(buf) : null, type: MIME[ext] || 'application/octet-stream', etag: '"' + crypto.createHash('sha1').update(buf).digest('base64url') + '"' };
      staticCache.set(file, entry);
    }
    if (req.headers['if-none-match'] === entry.etag) { res.writeHead(304); return res.end(); }
    const gz = entry.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    res.writeHead(200, { 'Content-Type': entry.type, ETag: entry.etag, 'Cache-Control': cacheControl, ...(gz ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}) });
    res.end(req.method === 'HEAD' ? undefined : gz ? entry.gz : entry.buf);
  }
  function safeJoin(base, rel) {
    const p = path.normalize(path.join(base, rel));
    return p.startsWith(base + path.sep) || p === base ? p : null;
  }
  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = []; let size = 0;
      req.on('data', (c) => { size += c.length; if (size > 3 * 1024 * 1024) { reject(new HttpError(413, 'Zahtjev je prevelik.')); req.destroy(); } else chunks.push(c); });
      req.on('end', () => {
        if (!chunks.length) return resolve({});
        try { const v = JSON.parse(Buffer.concat(chunks).toString('utf8')); resolve(v && typeof v === 'object' ? v : {}); }
        catch { reject(bad('Neispravan JSON.')); }
      });
      req.on('error', reject);
    });
  }
  const csp = () => {
    let tileHosts = mapCspHosts(mapConfig(ctx.settings, ctx.mapEnv));
    const style = ctx.settings.get('map_style', 'tamna');
    if (/^https:\/\//.test(style)) { try { const u = new URL(style); tileHosts += ` ${u.origin} https://*.${u.hostname.split('.').slice(-2).join('.')}`; } catch { /* ostaje zadano */ } }
    if (config.extraCspHosts) tileHosts += ' ' + config.extraCspHosts;
    return [
    "default-src 'self'", "script-src 'self' https://unpkg.com", "style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.bunny.net",
    "font-src 'self' https://fonts.bunny.net https://cdn.jsdelivr.net", `img-src 'self' data: blob: ${tileHosts}`, `connect-src 'self' ${tileHosts} https://unpkg.com https://cdn.jsdelivr.net`,
      "worker-src 'self' blob:", "child-src blob:", "media-src 'self' blob: data:", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'",
    ].join('; ');
  };

  async function handle(req, res) {
    const url = new URL(req.url, 'http://x');
    const pathname = decodeURI(url.pathname);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', csp());
    if (config.production) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    if (!pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
      if (pathname.includes('/.')) { res.writeHead(404); return res.end('Not found'); }   // skrivene datoteke se ne poslužuju
      if (pathname.startsWith('/zvukovi-dodani/')) {
        const f = ctx.audio.filePath(pathname.slice(16));
        if (f) return sendStatic(req, res, f, 'public, max-age=31536000, immutable');
        res.writeHead(404); return res.end();
      }
      if (pathname.startsWith('/avatars/')) {
        const f = safeJoin(path.join(config.dataDir, 'avatars'), pathname.slice(9));
        if (f && fs.existsSync(f) && fs.statSync(f).isFile()) return sendStatic(req, res, f, 'public, max-age=31536000, immutable');
        res.writeHead(404); return res.end();
      }
      const f = safeJoin(PUBLIC, pathname === '/' ? 'index.html' : pathname.slice(1));
      if (f && path.extname(f) && fs.existsSync(f) && fs.statSync(f).isFile()) return sendStatic(req, res, f, /\.(html)$/.test(f) ? 'no-cache' : 'public, max-age=300, must-revalidate');
      if (path.extname(pathname)) { res.writeHead(404); return res.end('Not found'); }
      // Pozivnica u ligu: ista ljuska, ali s Open Graph podacima da poveznica u porukama dobije lijep pregled.
      const inv = /^\/liga\/([A-Za-z0-9]{4,12})$/.exec(pathname);
      if (inv) {
        const lg = ctx.db.get('SELECT name FROM leagues WHERE code = ? AND is_hidden = 0', inv[1].toUpperCase());
        const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        const origin = ctx.config?.publicUrl || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
        const title = lg ? `Ontale liga „${lg.name}“ — pridruži se` : 'Ontale — poziv u ligu';
        const desc = lg ? `Pozvan si u ligu ${lg.name}. Deset sportskih pitanja dnevno — tko će dalje stići? Kod: ${inv[1].toUpperCase()}` : 'Deset sportskih pitanja dnevno. Što rjeđi odgovor, to dalje stižeš.';
        const meta = `<title>${esc(title)}</title>\n<meta property="og:type" content="website">\n<meta property="og:site_name" content="Ontale">\n<meta property="og:title" content="${esc(title)}">\n<meta property="og:description" content="${esc(desc)}">\n<meta property="og:url" content="${esc(origin + pathname)}">\n<meta property="og:image" content="${esc(origin)}/og-liga.png">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="description" content="${esc(desc)}">`;
        let html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
        html = html.replace(/[ \t]*<meta (name="description"|property="og:[a-z:_]+"|name="twitter:[a-z]+")[^>]*>\n?/g, '').replace(/<title>[^<]*<\/title>/, meta);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'Content-Security-Policy': csp() });
        return res.end(html);
      }
      // SPA: sve ostale putanje vraćaju ljusku aplikacije
      return sendStatic(req, res, path.join(PUBLIC, pathname.startsWith('/admin') ? 'admin.html' : 'index.html'), 'no-cache');
    }

    // ----- API -----
    const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
    try {
      req.ip = (config.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '0';
      req.ipHash = sha256(config.secret + '|' + req.ip).slice(0, 24);   // IP se nikad ne sprema u čistom obliku
      limit('api:' + req.ip, 300, 60000);
      req.cookies = Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((p) => p[0]).map(([k, ...v]) => [k, v.join('=')]));
      req.query = Object.fromEntries(url.searchParams);
      const match = routes.find((r) => r.method === req.method && r.re.test(pathname));
      if (!match) throw new HttpError(routes.some((r) => r.re.test(pathname)) ? 405 : 404, 'Nepoznata ruta.');
      req.params = {};
      pathname.match(match.re).slice(1).forEach((v, i) => { req.params[match.keys[i]] = v; });
      if (req.method !== 'GET') {
        // CSRF: prilagođeno zaglavlje (ne može se poslati s tuđe stranice bez CORS dopuštenja) + provjera podrijetla
        if (req.headers['x-ontale'] !== '1') throw new HttpError(403, 'Zahtjev nije poslan iz aplikacije.');
        const origin = req.headers.origin;
        if (origin && config.production && origin !== config.baseUrl) throw new HttpError(403, 'Nedopušteno podrijetlo zahtjeva.');
        req.body = await readBody(req);
      } else req.body = {};
      req.user = auth.currentUser(req);
      if (req.user?.is_blocked) { auth.logout(req, res); req.user = null; }
      if (match.opts.admin && !req.user?.is_admin) throw new HttpError(req.user ? 403 : 401, 'Samo za administratore.');
      const out = await match.handler(req, res);
      if (match.opts.raw || res.writableEnded) return;
      send(200, out ?? { ok: true });
    } catch (e) {
      if (res.writableEnded) return;
      if (e instanceof HttpError) return send(e.status, { error: e.message, ...(e.extra || {}) });
      if (/constraint failed/i.test(e.message || '')) return send(409, { error: 'Zapis je u sukobu s postojećim podacima.' });
      console.error(new Date().toISOString(), req.method, pathname, e);
      send(500, { error: 'Dogodila se greška na poslužitelju.' });
    }
  }

  const server = http.createServer((req, res) => { handle(req, res).catch((e) => { console.error(e); if (!res.writableEnded) { res.writeHead(500); res.end(); } }); });
  return { server, ctx, close: () => new Promise((r) => { clearInterval(sweep); server.close(() => { if (!overrides.db) db.close(); r(); }); server.closeAllConnections?.(); }) };
}
