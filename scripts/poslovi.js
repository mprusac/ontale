// Jednokratni prolaz zakazanih poslova (za cron / systemd timer kad je u aplikaciji JOBS=off).
// Primjer cron zapisa (svakih 10 minuta):  */10 * * * * cd /srv/ontale && node --disable-warning=ExperimentalWarning scripts/poslovi.js
import { createApp } from '../src/app.js';
const { ctx, close } = createApp();
const r = await ctx.jobs.tick();
console.log(new Date().toISOString(), JSON.stringify(r));
await close();
