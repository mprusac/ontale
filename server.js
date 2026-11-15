// ONTALE.eu — ulazna točka poslužitelja.
import { createApp } from './src/app.js';
import { config } from './src/config.js';
import { upgradeData } from './src/upgrade.js';
import * as seedTools from './seed/seed.js';

const { server, ctx, close } = createApp();
// Nadogradnja podataka postojeće baze (uz sigurnosnu kopiju); na novoj ili već nadograđenoj bazi ne radi ništa.
try {
  const up = upgradeData(ctx, { questions: await seedTools.loadQuestions(), seedTools });
  if (up.ran) { console.log('Baza je nadograđena:'); for (const n of up.notes) console.log('  • ' + n); }
} catch (e) {
  console.error('Nadogradnja podataka nije uspjela — baza je ostala nepromijenjena (transakcija je poništena).\n', e);
  process.exit(1);
}
const hasContent = ctx.db.get('SELECT COUNT(*) AS n FROM daily_challenges').n;
if (!hasContent) console.warn('Baza je prazna. Pokreni: npm run seed');

server.listen(config.port, config.host, () => {
  console.log(`ONTALE sluša na ${config.baseUrl} (port ${config.port}, ${config.production ? 'produkcija' : 'razvoj'})`);
  console.log(`Današnji datum igre: ${ctx.game.today()}`);
});
// Zakazani poslovi (zaključivanje dana, izazova i nagrada, podsjetnici, sažeci poruka) — svakih 5 minuta.
// Stanje je u bazi, pa restart ne šalje ništa dvaput. Isključi s JOBS=off ako ih pokrećeš cronom (npm run jobs).
const runJobs = () => ctx.jobs.tick().then((r) => { if (process.env.JOBS_LOG === '1') console.log('Poslovi:', JSON.stringify(r)); }).catch((e) => console.error('Poslovi:', e));
if (!config.jobsDisabled) { setTimeout(runJobs, 20000).unref(); setInterval(runJobs, 5 * 60000).unref(); }
else setInterval(() => { try { ctx.game.finalizePastDays(); } catch (e) { console.error(e); } }, 5 * 60000).unref();
// Jednom dnevno: brisanje isteklih sesija i gostiju neaktivnih dulje od 12 mjeseci (vidi pravila privatnosti).
function cleanup() {
  const now = new Date().toISOString();
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString();
  ctx.db.run('DELETE FROM auth_sessions WHERE expires_at < ?', now);
  ctx.db.run('DELETE FROM password_resets WHERE expires_at < ?', now);
  const gone = ctx.db.run('DELETE FROM users WHERE is_guest = 1 AND COALESCE(last_seen_at, created_at) < ?', yearAgo).changes;
  if (gone) { ctx.bumpBoards(); console.log(`Obrisano neaktivnih gostiju: ${gone}`); }
}
cleanup();
setInterval(() => { try { cleanup(); } catch (e) { console.error(e); } }, 24 * 3600000).unref();

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { close().then(() => process.exit(0)); });
