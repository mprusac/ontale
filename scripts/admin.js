// Dodjela administratorskih ovlasti:  npm run admin -- korisnik@domena.hr [--lozinka=NovaLozinka123] [--nadimak=Urednik]
// Ako korisnik ne postoji, a zadana je lozinka, račun se stvara.
import { createApp } from '../src/app.js';
import { hashPassword, normalize, nowIso } from '../src/util.js';

const args = process.argv.slice(2);
const email = (args.find((a) => !a.startsWith('--')) || '').toLowerCase();
const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
if (!email.includes('@')) { console.error('Upotreba: npm run admin -- korisnik@domena.hr [--lozinka=...] [--nadimak=...]'); process.exit(1); }

const app = createApp();
const { db } = app.ctx;
let user = db.get('SELECT id FROM users WHERE email = ?', email);
if (!user) {
  if (typeof opt.lozinka !== 'string' || opt.lozinka.length < 8) { console.error('Korisnik ne postoji. Za stvaranje računa dodaj --lozinka= (barem 8 znakova).'); await app.close(); process.exit(1); }
  const nick = typeof opt.nadimak === 'string' ? opt.nadimak : 'Urednik';
  if (db.get('SELECT 1 AS x FROM profiles WHERE nickname_norm = ?', normalize(nick))) { console.error(`Nadimak "${nick}" je zauzet — zadaj drugi s --nadimak=`); await app.close(); process.exit(1); }
  db.tx(() => {
    const id = db.run('INSERT INTO users (email, password_hash, is_guest, created_at) VALUES (?, ?, 0, ?)', email, hashPassword(opt.lozinka), nowIso()).id;
    db.run('INSERT INTO profiles (user_id, nickname, nickname_norm) VALUES (?, ?, ?)', id, nick, normalize(nick));
    user = { id };
  });
  console.log(`Stvoren je račun ${email} (nadimak: ${nick}).`);
} else if (typeof opt.lozinka === 'string' && opt.lozinka.length >= 8) {
  db.run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(opt.lozinka), user.id);
  console.log('Lozinka je promijenjena.');
}
db.run('INSERT OR IGNORE INTO admin_users (user_id, created_at) VALUES (?, ?)', user.id, nowIso());
db.run('INSERT INTO admin_audit_logs (action, entity, entity_id, created_at) VALUES (?, ?, ?, ?)', 'admin-dodijeljen-cli', 'korisnik', String(user.id), nowIso());
console.log(`${email} sada ima administratorske ovlasti. Admin panel: /admin`);
await app.close();
