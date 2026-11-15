// Korisnici: gosti, registracija, prijava, Google OAuth, profil, brisanje računa.
import fs from 'node:fs';
import path from 'node:path';
import { nowIso, normalize, randomToken, sha256, hashPassword, verifyPassword, HttpError, bad } from './util.js';

const SESSION_DAYS = 180;
const COOKIE = 'ont_s';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NICK_RE = /^[\p{L}\p{N} _.\-]{3,20}$/u;

export function createAuth(ctx) {
  const { db, config } = ctx;

  const userById = (id) => db.get(
    `SELECT u.id, u.email, u.is_guest, u.is_blocked, u.google_sub IS NOT NULL AS has_google, u.password_hash IS NOT NULL AS has_password,
            u.created_at, p.nickname, p.avatar, p.is_public, a.user_id IS NOT NULL AS is_admin
     FROM users u JOIN profiles p ON p.user_id = u.id LEFT JOIN admin_users a ON a.user_id = u.id WHERE u.id = ?`, id);

  const publicMe = (u) => u && {
    id: u.id, nickname: u.nickname, avatar: u.avatar, is_guest: !!u.is_guest, is_admin: !!u.is_admin,
    is_public: !!u.is_public, email: u.email || null, has_google: !!u.has_google, has_password: !!u.has_password,
  };

  // ---------- Kolačić sesije ----------
  function setCookie(res, token, maxAgeSec) {
    const parts = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSec}`];
    if (config.production) parts.push('Secure');
    res.appendHeader('Set-Cookie', parts.join('; '));
  }
  function openSession(res, userId) {
    const token = randomToken(32);
    const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
    db.run('INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)', sha256(token), userId, nowIso(), expires);
    setCookie(res, token, SESSION_DAYS * 86400);
  }
  function currentUser(req) {
    const token = req.cookies[COOKIE];
    if (!token) return null;
    const row = db.get('SELECT user_id, expires_at FROM auth_sessions WHERE token_hash = ?', sha256(token));
    if (!row || row.expires_at < nowIso()) return null;
    const u = userById(row.user_id);
    if (!u) return null;
    const seen = ctx.lastSeen.get(u.id) || 0;
    if (Date.now() - seen > 300000) { ctx.lastSeen.set(u.id, Date.now()); db.run('UPDATE users SET last_seen_at = ? WHERE id = ?', nowIso(), u.id); }
    return u;
  }
  function logout(req, res) {
    const token = req.cookies[COOKIE];
    if (token) db.run('DELETE FROM auth_sessions WHERE token_hash = ?', sha256(token));
    setCookie(res, '', 0);
  }

  // ---------- Nadimci ----------
  function validNickname(nick) {
    const n = String(nick || '').trim().replace(/\s+/g, ' ');
    if (!NICK_RE.test(n)) throw bad('Nadimak mora imati 3–20 znakova (slova, brojke, razmak, točka, crtica).');
    return n;
  }
  const nickTaken = (norm, exceptId) => !!db.get('SELECT 1 AS x FROM profiles WHERE nickname_norm = ? AND user_id != ?', norm, exceptId || 0);
  function freeNickname(base) {
    let b = String(base || 'Igrac').replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 16) || 'Igrac';
    if (b.length < 3) b = b + 'ONT';
    let candidate = b;
    for (let i = 0; i < 50 && nickTaken(normalize(candidate)); i++) candidate = `${b}${Math.floor(10 + Math.random() * 9990)}`;
    return candidate;
  }
  function insertUser({ email = null, passwordHash = null, googleSub = null, nickname, isGuest }) {
    return db.tx(() => {
      const id = db.run('INSERT INTO users (email, password_hash, google_sub, is_guest, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)',
        email, passwordHash, googleSub, isGuest ? 1 : 0, nowIso(), nowIso()).id;
      db.run('INSERT INTO profiles (user_id, nickname, nickname_norm) VALUES (?, ?, ?)', id, nickname, normalize(nickname));
      grantAdminIfListed(id, email);
      return id;
    });
  }
  function grantAdminIfListed(id, email) {
    if (email && config.adminEmails.includes(String(email).toLowerCase())) {
      db.run('INSERT OR IGNORE INTO admin_users (user_id, created_at) VALUES (?, ?)', id, nowIso());
    }
  }

  /** Gost: pravi korisnički zapis bez e-maila, kako bi se rezultat kasnije mogao povezati s računom. */
  function ensureUser(req, res) {
    const u = currentUser(req);
    if (u) return u;
    const id = insertUser({ nickname: freeNickname(`Gost ${Math.floor(1000 + Math.random() * 9000)}`), isGuest: true });
    openSession(res, id);
    return userById(id);
  }

  /** Spaja gosta u postojeći račun: partije se prenose, a službena partija se ne duplicira. */
  function mergeGuest(guestId, targetId) {
    if (!guestId || guestId === targetId) return;
    db.tx(() => {
      for (const s of db.all('SELECT id, challenge_id, map_id, official FROM game_sessions WHERE user_id = ?', guestId)) {
        const clash = s.official && db.get('SELECT 1 AS x FROM game_sessions WHERE user_id = ? AND challenge_id = ? AND map_id = ? AND official = 1', targetId, s.challenge_id, s.map_id);
        if (clash) db.run("UPDATE game_sessions SET user_id = ?, official = 0, mode = 'ponovno' WHERE id = ?", targetId, s.id);
        else db.run('UPDATE game_sessions SET user_id = ? WHERE id = ?', targetId, s.id);
      }
      db.run('UPDATE OR IGNORE frequency_voters SET user_id = ? WHERE user_id = ?', targetId, guestId);
      db.run('UPDATE answer_reports SET user_id = ? WHERE user_id = ?', targetId, guestId);
      db.run('DELETE FROM users WHERE id = ? AND is_guest = 1', guestId);
    });
    ctx.game.refreshStreak(targetId);
    ctx.bumpBoards();
  }

  function register(req, res, { email, password, nickname }) {
    email = String(email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 200) throw bad('Upiši ispravnu e-mail adresu.');
    if (String(password || '').length < 8 || password.length > 200) throw bad('Lozinka mora imati barem 8 znakova.');
    const nick = validNickname(nickname);
    if (db.get('SELECT 1 AS x FROM users WHERE email = ?', email)) throw new HttpError(409, 'Račun s tom e-mail adresom već postoji. Prijavi se.');
    const me = currentUser(req);
    if (nickTaken(normalize(nick), me?.id)) throw new HttpError(409, 'Taj je nadimak zauzet.');
    const hash = hashPassword(password);
    if (me && me.is_guest) {   // gost postaje registrirani korisnik — partije ostaju njegove
      db.tx(() => {
        db.run('UPDATE users SET email = ?, password_hash = ?, is_guest = 0 WHERE id = ?', email, hash, me.id);
        db.run('UPDATE profiles SET nickname = ?, nickname_norm = ? WHERE user_id = ?', nick, normalize(nick), me.id);
        grantAdminIfListed(me.id, email);
      });
      ctx.bumpBoards();
      return userById(me.id);
    }
    const id = insertUser({ email, passwordHash: hash, nickname: nick, isGuest: false });
    openSession(res, id);
    return userById(id);
  }

  function login(req, res, { email, password }) {
    email = String(email || '').trim().toLowerCase();
    const row = db.get('SELECT id, password_hash, is_blocked FROM users WHERE email = ?', email);
    if (!row || !verifyPassword(String(password || ''), row.password_hash)) throw new HttpError(401, 'Pogrešan e-mail ili lozinka.');
    const me = currentUser(req);
    grantAdminIfListed(row.id, email);
    logout(req, res);
    openSession(res, row.id);
    if (me && me.is_guest) mergeGuest(me.id, row.id);
    return userById(row.id);
  }

  // ---------- Google OAuth 2.0 (authorization code) ----------
  const googleEnabled = () => !!(config.google.clientId && config.google.clientSecret);
  function googleStart(req, res) {
    if (!googleEnabled()) throw new HttpError(503, 'Google prijava nije konfigurirana.');
    const state = randomToken(16);
    res.appendHeader('Set-Cookie', `ont_oauth=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${config.production ? '; Secure' : ''}`);
    const q = new URLSearchParams({
      client_id: config.google.clientId, redirect_uri: `${config.baseUrl}/api/auth/google/callback`,
      response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }
  async function googleCallback(req, res, { code, state }) {
    if (!googleEnabled()) throw new HttpError(503, 'Google prijava nije konfigurirana.');
    if (!code || !state || state !== req.cookies.ont_oauth) throw bad('Prijava je istekla. Pokušaj ponovno.');
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: config.google.clientId, client_secret: config.google.clientSecret, redirect_uri: `${config.baseUrl}/api/auth/google/callback`, grant_type: 'authorization_code' }),
    });
    if (!r.ok) throw new HttpError(502, 'Google nije potvrdio prijavu.');
    const tok = await r.json();
    // id_token stiže izravno od Googlea preko TLS-a, pa se smije pročitati bez dodatne provjere potpisa (OIDC Core 3.1.3.7).
    const claims = JSON.parse(Buffer.from(String(tok.id_token).split('.')[1], 'base64url').toString('utf8'));
    if (claims.aud !== config.google.clientId || !claims.sub || !claims.email || claims.email_verified === false) throw new HttpError(401, 'Google račun nije potvrđen.');
    return loginWithGoogle(req, res, { sub: claims.sub, email: String(claims.email).toLowerCase(), name: claims.given_name || claims.name });
  }
  function loginWithGoogle(req, res, { sub, email, name }) {
    const me = currentUser(req);
    let row = db.get('SELECT id FROM users WHERE google_sub = ?', sub) || db.get('SELECT id FROM users WHERE email = ?', email);
    if (row) {
      db.run('UPDATE users SET google_sub = COALESCE(google_sub, ?) WHERE id = ?', sub, row.id);
    } else if (me && me.is_guest) {
      db.run('UPDATE users SET email = ?, google_sub = ?, is_guest = 0 WHERE id = ?', email, sub, me.id);
      const nick = freeNickname(name);
      db.run('UPDATE profiles SET nickname = ?, nickname_norm = ? WHERE user_id = ?', nick, normalize(nick), me.id);
      grantAdminIfListed(me.id, email);
      ctx.bumpBoards();
      return userById(me.id);
    } else {
      row = { id: insertUser({ email, googleSub: sub, nickname: freeNickname(name), isGuest: false }) };
    }
    grantAdminIfListed(row.id, email);
    logout(req, res);
    openSession(res, row.id);
    if (me && me.is_guest) mergeGuest(me.id, row.id);
    return userById(row.id);
  }

  // ---------- Profil ----------
  /** Profilna slika: klijent je smanji na 256 px; server provjerava vrstu i veličinu te sprema datoteku. */
  function saveAvatar(userId, dataUrl) {
    const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
    if (!m) throw bad('Slika mora biti JPEG, PNG ili WebP.');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 220 * 1024) throw bad('Slika je prevelika (najviše 220 kB).');
    const magic = buf.subarray(0, 12);
    const ok = (m[1] === 'jpeg' && magic[0] === 0xff && magic[1] === 0xd8)
      || (m[1] === 'png' && magic.subarray(0, 4).toString('hex') === '89504e47')
      || (m[1] === 'webp' && magic.subarray(0, 4).toString() === 'RIFF' && magic.subarray(8, 12).toString() === 'WEBP');
    if (!ok) throw bad('Datoteka nije ispravna slika.');
    const dir = path.join(config.dataDir, 'avatars');
    fs.mkdirSync(dir, { recursive: true });
    removeAvatarFile(userId);
    const name = `${userId}-${randomToken(6)}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
    fs.writeFileSync(path.join(dir, name), buf);
    return `/avatars/${name}`;
  }
  function removeAvatarFile(userId) {
    const dir = path.join(config.dataDir, 'avatars');
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) if (f.startsWith(`${userId}-`)) fs.rmSync(path.join(dir, f), { force: true });
  }
  function updateMe(user, body) {
    if (body.nickname !== undefined) {
      const nick = validNickname(body.nickname);
      if (nickTaken(normalize(nick), user.id)) throw new HttpError(409, 'Taj je nadimak zauzet.');
      db.run('UPDATE profiles SET nickname = ?, nickname_norm = ? WHERE user_id = ?', nick, normalize(nick), user.id);
    }
    if (body.is_public !== undefined) db.run('UPDATE profiles SET is_public = ? WHERE user_id = ?', body.is_public ? 1 : 0, user.id);
    if (body.avatar === null) { removeAvatarFile(user.id); db.run('UPDATE profiles SET avatar = NULL WHERE user_id = ?', user.id); }
    else if (body.avatar) {
      if (user.is_guest) throw new HttpError(403, 'Profilna slika je dostupna nakon registracije.');
      db.run('UPDATE profiles SET avatar = ? WHERE user_id = ?', saveAvatar(user.id, body.avatar), user.id);
    }
    ctx.bumpBoards();
    return userById(user.id);
  }
  function changePassword(user, { current, password }) {
    const row = db.get('SELECT password_hash FROM users WHERE id = ?', user.id);
    if (row.password_hash && !verifyPassword(String(current || ''), row.password_hash)) throw new HttpError(401, 'Trenutna lozinka nije točna.');
    if (String(password || '').length < 8) throw bad('Lozinka mora imati barem 8 znakova.');
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(password), user.id);
  }
  function createResetLink(userId) {
    const token = randomToken(24);
    db.run('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)', sha256(token), userId, new Date(Date.now() + 48 * 3600000).toISOString());
    return `${config.baseUrl}/lozinka?token=${token}`;
  }
  function resetPassword({ token, password }) {
    const row = db.get('SELECT * FROM password_resets WHERE token_hash = ?', sha256(String(token || '')));
    if (!row || row.used_at || row.expires_at < nowIso()) throw bad('Poveznica više ne vrijedi.');
    if (String(password || '').length < 8) throw bad('Lozinka mora imati barem 8 znakova.');
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(password), row.user_id);
    db.run('UPDATE password_resets SET used_at = ? WHERE token_hash = ?', nowIso(), row.token_hash);
    db.run('DELETE FROM auth_sessions WHERE user_id = ?', row.user_id);
  }
  /** Brisanje računa (GDPR): briše korisnika, partije, odgovore, članstva i sliku. Lige se predaju drugom članu. */
  function deleteAccount(userId) {
    db.tx(() => {
      for (const l of db.all('SELECT id FROM leagues WHERE owner_id = ?', userId)) {
        const heir = db.get('SELECT user_id FROM league_members WHERE league_id = ? AND user_id != ? ORDER BY joined_at LIMIT 1', l.id, userId);
        if (heir) db.run('UPDATE leagues SET owner_id = ? WHERE id = ?', heir.user_id, l.id);
      }
      db.run('DELETE FROM users WHERE id = ?', userId);
    });
    removeAvatarFile(userId);
    ctx.bumpBoards();
  }

  return {
    currentUser, ensureUser, publicMe, userById, register, login, logout, googleEnabled, googleStart, googleCallback, loginWithGoogle,
    updateMe, changePassword, createResetLink, resetPassword, deleteAccount, removeAvatarFile, validNickname, nickTaken, mergeGuest,
  };
}
