// Resetira sve partije i nagradne podatke, i vraća „Dan 1" na danas.
// NE briše: korisnike, administratore, pitanja, odgovore, karte, rute, prijevozna sredstva, zvučne zapise, postavke.
// Briše: sve odigrane partije, odgovore, rijetkost odgovora, serije, lige (članstvo), poruke, obavijesti, prijave, reakcije.
// Pokretanje: node scripts/reset-partije.js            (pita za potvrdu)
//             node scripts/reset-partije.js --yes      (bez potvrde, za skriptno pokretanje)
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { openDb, makeSettings } from '../src/db.js';
import { config } from '../src/config.js';
import { nowIso, gameDate } from '../src/util.js';

const yes = process.argv.includes('--yes') || process.argv.includes('-y');

const db = openDb(config.dbPath);
const settings = makeSettings(db);

const before = {
  sessions: db.get('SELECT COUNT(*) n FROM game_sessions').n,
  answers: db.get('SELECT COUNT(*) n FROM player_answers').n,
  users: db.get('SELECT COUNT(*) n FROM users').n,
  guests: db.get('SELECT COUNT(*) n FROM users WHERE is_guest = 1').n,
  leagues: db.get('SELECT COUNT(*) n FROM leagues').n,
  start_date: settings.get('start_date', null),
};

const today = gameDate(new Date(), settings.get('timezone', 'Europe/Zagreb'), settings.get('reset_time', '00:00'));

console.log('\nStanje prije resetiranja:');
console.log('  Partije:      ', before.sessions);
console.log('  Odgovori:     ', before.answers);
console.log('  Korisnici:    ', before.users, `(od toga gostiju: ${before.guests})`);
console.log('  Lige:         ', before.leagues);
console.log('  Dan 1 (prije):', before.start_date);
console.log('  Dan 1 (sada): ', today);
console.log();

async function confirm() {
  if (yes) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question('Upiši DA za potvrdu (ostalo prekida): ', (a) => { rl.close(); r(a.trim().toUpperCase() === 'DA'); }));
}

if (!await confirm()) { console.log('Prekinuto. Ništa nije promijenjeno.'); process.exit(0); }

// Sigurnosna kopija baze
const dir = path.dirname(config.dbPath);
const backupDir = path.join(dir, 'backups');
fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const backup = path.join(backupDir, `ontale-prije-reset-${stamp}.db`);
db.run('VACUUM INTO ?', backup);
console.log('Sigurnosna kopija spremljena:', backup);

db.tx(() => {
  // Partije i odgovori
  db.run('DELETE FROM player_answers');
  db.run('DELETE FROM answer_attempts');
  db.run('DELETE FROM game_sessions');
  // Rijetkost odgovora (ponovo se gradi iz novih partija)
  db.run('DELETE FROM frequency_voters');
  db.run('DELETE FROM answer_frequency');
  // Serije, izazovi, nagrade
  db.run('DELETE FROM daily_streaks');
  db.run('DELETE FROM challenge_events');
  db.run('DELETE FROM player_challenges');
  db.run('DELETE FROM league_awards');
  db.run('DELETE FROM award_finalizations');
  // Lige — članstvo se briše, same lige po želji; ostavljam ih prazne (admin ih može obrisati)
  db.run('DELETE FROM league_members');
  db.run('DELETE FROM leagues');
  // Interakcije
  db.run('DELETE FROM reactions');
  db.run('DELETE FROM route_sign_messages');
  db.run('DELETE FROM sign_reports');
  db.run('DELETE FROM sign_hidden');
  db.run('DELETE FROM answer_reports');
  db.run('DELETE FROM content_reports');
  db.run('DELETE FROM message_reports');
  // Poruke
  db.run('DELETE FROM private_messages');
  db.run('DELETE FROM conversation_members');
  db.run('DELETE FROM conversations');
  db.run('DELETE FROM user_blocks');
  // Obavijesti i pozadinski poslovi
  db.run('DELETE FROM notification_delivery_log');
  db.run('DELETE FROM notifications');
  db.run('DELETE FROM job_runs');
  // Gosti (registrirani korisnici i admini ostaju); profili gostiju nestanu CASCADE-om preko users
  db.run('DELETE FROM profiles WHERE user_id IN (SELECT id FROM users WHERE is_guest = 1)');
  db.run('DELETE FROM user_prefs WHERE user_id IN (SELECT id FROM users WHERE is_guest = 1)');
  db.run('DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE is_guest = 1)');
  db.run('DELETE FROM users WHERE is_guest = 1');
  // Dnevni izazovi: ostaju u bazi (vezani uz pitanja), ali će se pomak datuma postaviti tako da danas = Dan 1
  // Dan 1 na danas
  settings.set('start_date', today);
  // Audit
  db.run('INSERT INTO admin_audit_logs (action, entity, detail, created_at) VALUES (?, ?, ?, ?)', 'reset-partija', 'baza', JSON.stringify({ before, today, backup }), nowIso());
});

const after = {
  sessions: db.get('SELECT COUNT(*) n FROM game_sessions').n,
  answers: db.get('SELECT COUNT(*) n FROM player_answers').n,
  users: db.get('SELECT COUNT(*) n FROM users').n,
  guests: db.get('SELECT COUNT(*) n FROM users WHERE is_guest = 1').n,
  leagues: db.get('SELECT COUNT(*) n FROM leagues').n,
  start_date: settings.get('start_date'),
};

console.log('\nStanje poslije resetiranja:');
console.log('  Partije:      ', after.sessions);
console.log('  Odgovori:     ', after.answers);
console.log('  Korisnici:    ', after.users, `(gostiju: ${after.guests})`);
console.log('  Lige:         ', after.leagues);
console.log('  Dan 1:        ', after.start_date, '(danas)');
console.log('\nGotovo. Partija će krenuti kao Dan 1 čim pokreneš `npm start`.\n');
