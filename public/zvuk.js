// ONTALE — zvučni efekti. Kratki efekti nastaju u pregledniku (Web Audio sinteza, bez preuzimanja),
// a gradovi, granica, cilj i kraj partije imaju kratke izvorne MP3 isječke (public/zvukovi, ~10–20 kB).
// Pravila: zvuk se pali tek nakon dodira/klika/tipke (zahtjev preglednika), isključen zvuk nikad ne svira,
// postavka se pamti (localStorage + profil), isti efekt se ne preklapa sam sa sobom, a skrivena kartica utišava sve.
const LS = 'ontale-zvuk';
const NOTIF_EVENTS = new Set(['message', 'notify', 'award', 'win']);
const MIN_GAP = { tick: 250, count: 300, type: 40, wrong: 150, message: 1500, notify: 1500, arrive: 120 };
const PRELOAD = ['file:granica', 'file:cilj', 'file:kraj'];

function readLocal() { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch { return null; } }
function writeLocal(v) { try { localStorage.setItem(LS, JSON.stringify(v)); } catch { /* privatni način rada */ } }

export function createSound() {
  let cfg = { enabled: true, default_on: true, default_volume: 0.7, events: {}, cities: {}, files: {} };
  let prefs = { on: true, volume: 0.7, game: true, notif: true };
  let ctx = null, master = null, noiseBuf = null, unlocked = false;
  const buffers = new Map(), last = new Map(), live = new Set();
  let clipUntil = 0, queued = 0;
  const listeners = new Set();
  let saveRemote = null;

  // ---------- Web Audio ----------
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {}); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = prefs.on ? prefs.volume : 0;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  const GESTURES = ['pointerdown', 'keydown', 'touchend'];
  function unlock() {
    if (!cfg.enabled || !prefs.on) return;
    const c = ensure();
    if (!c) return;
    c.resume().then(() => {
      if (c.state !== 'running') return;
      unlocked = true;
      GESTURES.forEach((e) => window.removeEventListener(e, unlock, true));
      for (const slug of PRELOAD) loadClip(slug);
    }).catch(() => {});
  }
  GESTURES.forEach((e) => window.addEventListener(e, unlock, true));
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else if (prefs.on) ctx.resume().catch(() => {});
  });
  const ready = () => !!(cfg.enabled && prefs.on && unlocked && ctx && ctx.state === 'running' && !document.hidden);

  // ---------- gradivni blokovi sinteze ----------
  function osc(type, f, t0, dur, peak, { to, attack = 0.006, out } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(out || master);
    o.start(t0); o.stop(t0 + dur + 0.05);
    track(o);
  }
  function noise(t0, dur, peak, { type = 'bandpass', freq = 1200, q = 1, to, attack = 0.004, out } = {}) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(out || master);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
    track(s);
  }
  function track(node) { live.add(node); node.onended = () => live.delete(node); }
  const chime = (f, t0, dur = 0.7, peak = 0.16) => { osc('sine', f, t0, dur, peak); osc('sine', f * 2.01, t0, dur * 0.5, peak * 0.22); osc('sine', f * 3.03, t0, dur * 0.25, peak * 0.08); };

  // ---------- izvorni efekti ONTALE ----------
  const SYNTH = {
    start(t) { osc('sawtooth', 48, t, 0.55, 0.07, { to: 95, attack: 0.04 }); noise(t, 0.35, 0.05, { type: 'lowpass', freq: 380 }); osc('triangle', 523, t + 0.42, 0.18, 0.08); osc('triangle', 784, t + 0.52, 0.28, 0.08); },
    count(t) { osc('sine', 740, t, 0.09, 0.09); },
    go(t) { osc('triangle', 740, t, 0.12, 0.12); osc('triangle', 1109, t + 0.09, 0.3, 0.12); },
    tick(t) { osc('square', 1900, t, 0.028, 0.025, { attack: 0.001 }); },
    accept(t) { [659, 880, 1175].forEach((f, i) => osc('triangle', f, t + i * 0.06, 0.26, 0.14)); },
    wrong(t) { osc('square', 233, t, 0.16, 0.06, { to: 175 }); osc('square', 220, t + 0.15, 0.2, 0.06, { to: 150 }); },
    zero(t) { osc('sine', 440, t, 0.65, 0.12, { to: 196 }); osc('triangle', 330, t + 0.1, 0.55, 0.05, { to: 147 }); },
    transport(t, o = {}) { const lvl = Math.max(1, Math.min(7, o.level || 1)); const base = [392, 440, 494, 523, 587, 659, 784][lvl - 1]; for (let i = 0; i < Math.min(5, 1 + Math.ceil(lvl / 2)); i++) osc('triangle', base * [1, 1.25, 1.5, 2, 2.5][i], t + i * 0.055, 0.22, 0.1); if (lvl >= 6) SYNTH.rare(t + 0.2, { soft: true }); },
    vehicle(t, o = {}) {
      const lvl = o.level || 1, dur = Math.min(5, Math.max(0.8, o.duration || 2));
      if (lvl <= 1) { for (let x = 0; x < dur - 0.1; x += 0.36) noise(t + x, 0.08, 0.12, { type: 'lowpass', freq: 520 }); }
      else if (lvl === 2) { chime(2093, t, 0.35, 0.08); chime(2349, t + 0.16, 0.35, 0.07); for (let x = 0.4; x < dur - 0.1; x += 0.12) noise(t + x, 0.02, 0.025, { type: 'highpass', freq: 5200 }); }
      else if (lvl === 3) { osc('sawtooth', 330, t, 0.55, 0.05, { attack: 0.05 }); osc('sawtooth', 392, t, 0.55, 0.04, { attack: 0.05 }); for (let x = 0.6; x < dur - 0.15; x += 0.5) { noise(t + x, 0.07, 0.11, { type: 'lowpass', freq: 420 }); noise(t + x + 0.17, 0.07, 0.1, { type: 'lowpass', freq: 420 }); } }
      else if (lvl === 4) { osc('sawtooth', 52, t, dur, 0.09, { to: 82, attack: 0.15 }); osc('square', 26, t, dur, 0.04, { to: 41, attack: 0.15 }); noise(t + dur - 0.2, 0.4, 0.05, { type: 'highpass', freq: 2800 }); }
      else if (lvl === 5) { osc('sine', 260, t, dur, 0.06, { to: 820, attack: 0.2 }); osc('sine', 520, t, dur, 0.025, { to: 1640, attack: 0.2 }); noise(t, dur, 0.03, { type: 'bandpass', freq: 600, to: 1800, attack: 0.3 }); }
      else if (lvl === 6) { noise(t, dur + 0.3, 0.18, { type: 'bandpass', freq: 260, to: 2200, q: 1.1, attack: dur * 0.45 }); osc('sine', 180, t, dur, 0.03, { to: 360, attack: 0.3 }); }
      else { let x = 0, gap = 0.17; while (x < dur) { noise(t + x, 0.05, 0.16, { type: 'lowpass', freq: 360 }); x += gap; gap = Math.max(0.07, gap * 0.92); } osc('sawtooth', 100, t, dur, 0.025, { to: 130 }); }
    },
    station(t) { chime(1047, t, 0.8, 0.14); chime(1319, t + 0.14, 0.9, 0.13); },
    beyond(t) { osc('sine', 330, t, 0.7, 0.08, { to: 990, attack: 0.1 }); chime(1568, t + 0.55, 0.8, 0.11); },
    rare(t, o = {}) { for (let i = 0; i < 6; i++) osc('sine', 2400 + Math.random() * 2200, t + i * 0.05, 0.12, o.soft ? 0.03 : 0.05, { attack: 0.002 }); },
    award(t) { [784, 988, 1175, 1568].forEach((f, i) => osc('triangle', f, t + i * 0.1, i === 3 ? 0.7 : 0.2, 0.13)); SYNTH.rare(t + 0.35, { soft: true }); },
    win(t) { [523, 659, 784, 1047].forEach((f, i) => osc('triangle', f, t + i * 0.12, i === 3 ? 0.8 : 0.18, 0.14)); osc('triangle', 784, t + 0.36, 0.8, 0.07); },
    message(t) { osc('sine', 880, t, 0.12, 0.1, { to: 1320 }); osc('sine', 1320, t + 0.1, 0.18, 0.06); },
    notify(t) { chime(1175, t, 0.5, 0.1); chime(880, t + 0.16, 0.6, 0.09); },
  };

  // ---------- isječci (MP3) ----------
  function loadClip(slug) {
    if (buffers.has(slug)) return buffers.get(slug);
    const url = cfg.files[slug];
    if (!url || !ctx) return Promise.resolve(null);
    const p = fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => (b ? ctx.decodeAudioData(b) : null)).catch(() => null);
    buffers.set(slug, p);
    return p;
  }
  /** Isječci se nižu jedan za drugim (nikad više od dva u redu), pa se brzi niz gradova ne pretvara u kakofoniju. */
  function clip(slug, gain = 1) {
    if (queued >= 3) return;
    queued++;
    loadClip(slug).then((buf) => {
      queued--;
      if (!buf || !ready()) return;
      const s = ctx.createBufferSource(), g = ctx.createGain();
      g.gain.value = gain;
      s.buffer = buf; s.connect(g).connect(master);
      const at = Math.max(ctx.currentTime + 0.02, clipUntil);
      clipUntil = at + buf.duration + 0.15;    // pauza između isječaka, bez preklapanja
      s.start(at); track(s);
    });
  }
  const log = [];   // zadnjih 50 odsviranih zapisa (za provjeru u testovima; ništa ne šalje)
  function run(slug, opts) {
    if (!slug) return;
    log.push(slug); if (log.length > 50) log.shift();
    if (slug.startsWith('synth:')) { const fn = SYNTH[slug.slice(6)]; if (fn) fn(ctx.currentTime + 0.01, opts); }
    else clip(slug, opts?.gain ?? 1);
  }

  // ---------- javno sučelje ----------
  const api = {
    /** Događaj iz igre ili obavijesti (npr. 'accept', 'arrive', 'message'). */
    play(event, opts = {}) {
      if (!ready()) return;
      const cat = NOTIF_EVENTS.has(event) ? 'notif' : 'game';
      if (!prefs[cat]) return;
      const now = performance.now(), gap = MIN_GAP[event] ?? 90;
      if (now - (last.get(event) || 0) < gap) return;
      last.set(event, now);
      run(cfg.events[event], opts);
    },
    /** Dolazak u grad: vlastiti zvuk grada ili zadani „dolazak“. Poziva se SAMO tijekom stvarne vožnje. */
    arrive(stop) {
      if (!ready() || !prefs.game) return;
      if (stop.label === 'granica') return api.play('border');
      const now = performance.now();
      // debounce po imenu grada — isti grad nikad dvaput u 400 ms
      const cityKey = 'city:' + stop.name;
      if (now - (last.get(cityKey) || 0) < 400) return;
      last.set(cityKey, now);
      // koji bi zvuk zasvirao? (vlastiti zvuk grada ili zadani „Dolazak u grad”)
      const slug = cfg.cities[stop.name] || cfg.events.arrive;
      if (!slug) return;
      // Ako se isti zvuk već nedavno pustio (unutar 20 s), ne ponavljaj. Primjer: Istra — 5 gradova
      // dijeli isti „file:more” ili zadani „synth:station”, pa se pusti jednom, ne pet puta.
      const lastSlug = last.get('cityslug');
      const lastTime = last.get('cityslug-time') || 0;
      if (slug === lastSlug && now - lastTime < 20000) return;
      last.set('cityslug', slug);
      last.set('cityslug-time', now);
      if (!slug.startsWith('synth:')) { run(slug); return; }
      // sinteza — redaj iza isječaka da se ne preklapa s MP3-om
      const fn = SYNTH[slug.slice(6)]; if (!fn) return;
      const start = Math.max(ctx.currentTime + 0.02, clipUntil);
      log.push(slug); if (log.length > 50) log.shift();
      fn(start);
      clipUntil = start + 1.1;   // trajanje synth:station
    },
    /** Grad ima vlastiti MP3 zvuk (iz video-isječaka vlasnika)? Koristi se da se tablica dolaska zadrži duže. */
    cityHasClip(name) { const s = cfg.cities[name]; return !!(s && s.startsWith('file:gradovi/')); },
    configure(c, serverPrefs) {
      cfg = { ...cfg, ...(c || {}) };
      const local = readLocal();
      const sp = serverPrefs || {};
      prefs = {
        on: local?.on ?? sp.on ?? cfg.default_on,
        volume: local?.volume ?? sp.volume ?? cfg.default_volume,
        game: local?.game ?? sp.game ?? true,
        notif: local?.notif ?? sp.notif ?? true,
      };
      if (master) master.gain.value = prefs.on ? prefs.volume : 0;
      listeners.forEach((f) => f(prefs));
    },
    get prefs() { return { ...prefs }; },
    get available() { return !!(cfg.enabled && (window.AudioContext || window.webkitAudioContext)); },
    get unlocked() { return unlocked; },
    set(p) {
      prefs = { ...prefs, ...p };
      writeLocal(prefs);
      if (master) master.gain.setTargetAtTime(prefs.on ? prefs.volume : 0, ctx.currentTime, 0.02);
      if (prefs.on) unlock();
      else stopAll();
      listeners.forEach((f) => f(prefs));
      clearTimeout(saveRemote);
      saveRemote = setTimeout(() => api.onSave?.(prefs), 600);
    },
    /** Pregled zvuka (administracija i postavke): zaobilazi kategorije, ali poštuje isključen zvuk. */
    preview(slug, opts) { unlock(); if (ready()) run(slug, opts); else setTimeout(() => ready() && run(slug, opts), 250); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    stopAll,
    get log() { return [...log]; },
    onSave: null,
  };
  function stopAll() { for (const n of live) { try { n.stop(); } catch { /* već stao */ } } live.clear(); clipUntil = 0; }
  return api;
}

export const sound = createSound();
