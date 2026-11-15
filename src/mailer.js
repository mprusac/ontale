// Slanje e-maila preko SMTP-a — bez vanjskih paketa (node:net / node:tls).
// Podržava implicitni TLS (port 465), STARTTLS (587) i AUTH PLAIN/LOGIN. Bez konfiguracije ne šalje ništa
// i to jasno javlja (nikad se ne pretvara da je e-mail poslan).
import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const wrap76 = (s) => s.replace(/.{1,76}/g, '$&\r\n').trimEnd();
const encWord = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const addr = (s) => String(s || '').match(/<([^>]+)>/)?.[1] || String(s || '').trim();

export function buildMessage({ from, to, subject, text, html, headers = {}, domain = 'ontale.eu' }) {
  const boundary = 'ont_' + crypto.randomBytes(12).toString('hex');
  const fromName = String(from).match(/^\s*"?([^"<]*?)"?\s*</)?.[1];
  const head = {
    From: fromName ? `${encWord(fromName)} <${addr(from)}>` : addr(from),
    To: addr(to), Subject: encWord(subject), Date: new Date().toUTCString(),
    'Message-ID': `<${crypto.randomUUID()}@${domain}>`, 'MIME-Version': '1.0',
    'Content-Type': `multipart/alternative; boundary="${boundary}"`, ...headers,
  };
  const lines = Object.entries(head).map(([k, v]) => `${k}: ${v}`);
  const part = (type, body) => [`--${boundary}`, `Content-Type: ${type}; charset=UTF-8`, 'Content-Transfer-Encoding: base64', '', wrap76(b64(body))].join('\r\n');
  return [...lines, '', part('text/plain', text || ''), part('text/html', html || ''), `--${boundary}--`, ''].join('\r\n');
}

export function createMailer(cfg = {}) {
  const c = { host: '', port: 587, user: '', pass: '', from: '', secure: null, timeoutMs: 20000, ...cfg };
  const configured = () => !!(c.host && c.from);

  function session(sock) {
    let buf = '', waiting = null, closed = null;
    const pending = [];
    const onData = (d) => {
      buf += d.toString('utf8');
      for (;;) {
        const lines = [];
        let rest = buf, done = false;
        for (let i = rest.indexOf('\n'); i >= 0; i = rest.indexOf('\n')) {
          const line = rest.slice(0, i).replace(/\r$/, '');
          lines.push(line);
          rest = rest.slice(i + 1);
          if (/^\d{3}( |$)/.test(line)) { done = true; break; }   // zadnji redak odgovora: „250 OK“ (višeredni imaju „250-“)
        }
        if (!done) return;
        buf = rest;
        const resp = { code: Number(lines[lines.length - 1].slice(0, 3)), text: lines.map((l) => l.slice(4)).join('\n') };
        if (waiting) { const w = waiting; waiting = null; w(resp); } else pending.push(resp);
      }
    };
    sock.on('data', onData);
    sock.on('error', (e) => { closed = e; if (waiting) { const w = waiting; waiting = null; w({ code: 0, text: e.message }); } });
    sock.on('close', () => { if (waiting) { const w = waiting; waiting = null; w({ code: 0, text: 'veza zatvorena' }); } });
    const read = () => new Promise((resolve) => { if (pending.length) resolve(pending.shift()); else if (closed) resolve({ code: 0, text: closed.message }); else waiting = resolve; });
    const cmd = async (line, expect) => {
      if (line != null) sock.write(line + '\r\n');
      const r = await read();
      if (expect && !expect.includes(r.code)) throw new Error(`SMTP ${line ? line.split(' ')[0] : 'pozdrav'}: ${r.code} ${r.text}`.slice(0, 300));
      return r;
    };
    return { cmd, detach: () => sock.off('data', onData) };
  }
  const connect = (secure) => new Promise((resolve, reject) => {
    const opts = { host: c.host, port: Number(c.port), servername: c.host };
    const sock = secure ? tls.connect(opts, () => resolve(sock)) : net.connect(opts, () => resolve(sock));
    sock.setTimeout(c.timeoutMs, () => sock.destroy(new Error('SMTP: isteklo vrijeme')));
    sock.once('error', reject);
  });

  /** Šalje poruku. Vraća { ok:true, id } ili baca grešku. */
  async function send({ to, subject, text, html, headers }) {
    if (!configured()) { const e = new Error('E-mail nije konfiguriran (SMTP_HOST / EMAIL_FROM).'); e.notConfigured = true; throw e; }
    const implicit = c.secure != null ? !!c.secure : Number(c.port) === 465;
    let sock = await connect(implicit);
    let s = session(sock);
    try {
      await s.cmd(null, [220]);
      const host = (c.from.split('@')[1] || 'localhost').replace(/>.*/, '');
      let ehlo = await s.cmd(`EHLO ${host}`, [250]);
      if (!implicit && /STARTTLS/i.test(ehlo.text)) {
        await s.cmd('STARTTLS', [220]);
        s.detach();
        sock = await new Promise((resolve, reject) => { const t = tls.connect({ socket: sock, servername: c.host }, () => resolve(t)); t.once('error', reject); });
        sock.setTimeout(c.timeoutMs, () => sock.destroy(new Error('SMTP: isteklo vrijeme')));
        s = session(sock);
        ehlo = await s.cmd(`EHLO ${host}`, [250]);
      } else if (!implicit && c.user && !c.allowInsecureAuth) {
        throw new Error('SMTP poslužitelj ne nudi STARTTLS — lozinka se ne šalje nešifrirano.');
      }
      if (c.user) {
        if (/AUTH[^\n]*PLAIN/i.test(ehlo.text)) await s.cmd('AUTH PLAIN ' + Buffer.from(`\0${c.user}\0${c.pass}`).toString('base64'), [235]);
        else { await s.cmd('AUTH LOGIN', [334]); await s.cmd(b64(c.user), [334]); await s.cmd(b64(c.pass), [235]); }
      }
      await s.cmd(`MAIL FROM:<${addr(c.from)}>`, [250]);
      await s.cmd(`RCPT TO:<${addr(to)}>`, [250, 251]);
      await s.cmd('DATA', [354]);
      const msg = buildMessage({ from: c.from, to, subject, text, html, headers, domain: (addr(c.from).split('@')[1] || 'ontale.eu') });
      const done = await s.cmd(msg.replace(/\r\n\./g, '\r\n..') + '\r\n.', [250]);
      await s.cmd('QUIT').catch(() => {});
      return { ok: true, id: done.text };
    } finally { sock.end(); sock.destroy(); }
  }
  return { configured, send, info: () => ({ host: c.host, port: c.port, from: c.from, user: c.user ? '(postavljeno)' : '' }) };
}

// ---------- Predlošci ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
/** Jednostavan, mobilno prilagođen HTML e-mail u bojama Ontale. Tekst se uvijek escapea. */
export function emailLayout({ title, lead, button, url, footer, prefsUrl, unsubUrl }) {
  const html = `<!doctype html><html lang="hr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#0f141a;font-family:Overpass,Segoe UI,Helvetica,Arial,sans-serif;color:#e8edf1">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f141a"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#161d25;border-radius:16px;overflow:hidden">
<tr><td style="background:#0c7a55;padding:18px 24px"><span style="display:inline-block;font-weight:900;font-size:22px;letter-spacing:.5px;color:#fff;border:2px solid #fff;border-radius:8px;padding:4px 12px">Ontale</span></td></tr>
<tr><td style="padding:26px 24px 8px"><h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;color:#ffffff">${esc(title)}</h1>
<p style="margin:0 0 22px;font-size:16px;line-height:1.55;color:#c9d3db">${esc(lead)}</p>
<a href="${esc(url)}" style="display:inline-block;background:#ffc928;color:#12181b;font-weight:800;text-decoration:none;padding:13px 22px;border-radius:12px;font-size:16px">${esc(button)}</a></td></tr>
<tr><td style="padding:22px 24px 26px;font-size:12.5px;line-height:1.6;color:#8a97a3">${esc(footer || '')}<br>
<a href="${esc(prefsUrl)}" style="color:#8fd3b5">Postavke obavijesti</a> · <a href="${esc(unsubUrl)}" style="color:#8fd3b5">Odjavi e-mail obavijesti</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = `${title}\n\n${lead}\n\n${button}: ${url}\n\n${footer || ''}\nPostavke obavijesti: ${prefsUrl}\nOdjava: ${unsubUrl}\n`;
  return { html, text };
}
