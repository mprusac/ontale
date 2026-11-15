#!/usr/bin/env python3
"""ONTALE — generator izvornih zvučnih isječaka (public/zvukovi/*.mp3).

Svi zvukovi nastaju ovdje matematičkom sintezom (sinusi, harmonici, filtrirani šum) — bez ikakvih
tuđih snimki. Autor: ONTALE; licenca: CC0 1.0 (slobodno za svaku uporabu).
Pokretanje:  python3 scripts/zvukovi.py   (treba numpy, scipy i ffmpeg s libmp3lame)
"""
import os, subprocess, tempfile
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'zvukovi')
rng = np.random.default_rng(7)

def t(d): return np.arange(int(SR * d)) / SR
def env(n, a=0.005, r=0.3, d=None):
    x = np.arange(n) / SR
    e = np.minimum(1, x / max(a, 1e-4)) * np.exp(-x / max(r, 1e-4))
    return e
def tone(f, d, harm=((1, 1),), a=0.004, r=0.4, vib=0.0):
    x = t(d); s = np.zeros_like(x)
    for k, amp in harm:
        s += amp * np.sin(2 * np.pi * f * k * x + vib * np.sin(2 * np.pi * 5.5 * x))
    return s * env(len(x), a, r)
def bell(f, d=1.6, r=0.7):
    # neharmonijski parcijali zvona
    parts = ((0.5, .35), (1, 1), (1.19, .5), (1.56, .35), (2, .45), (2.51, .25), (3.01, .15))
    x = t(d); s = np.zeros_like(x)
    for k, amp in parts:
        s += amp * np.sin(2 * np.pi * f * k * x) * np.exp(-x / (r / (0.6 + k * 0.35)))
    return s * np.minimum(1, x / 0.002)
def pluck(f, d=0.6):
    # Karplus–Strong: trzana žica (mandolina / tambura)
    n = int(SR * d); p = max(2, int(SR / f)); buf = rng.uniform(-1, 1, p); out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = 0.5 * (buf[i % p] + buf[(i + 1) % p]) * 0.996
    return out
def noise(d): return rng.uniform(-1, 1, int(SR * d))
def lp(x, fc, o=2): b, a = butter(o, fc / (SR / 2), 'low'); return lfilter(b, a, x)
def bp(x, lo, hi, o=2): b, a = butter(o, [lo / (SR / 2), hi / (SR / 2)], 'band'); return lfilter(b, a, x)
def place(total, *items):
    out = np.zeros(int(SR * total))
    for start, sig in items:
        i = int(SR * start); j = min(len(out), i + len(sig)); out[i:j] += sig[: j - i]
    return out
def fade(x, ms=40):
    n = int(SR * ms / 1000); x = x.copy(); x[-n:] *= np.linspace(1, 0, n); return x
def save(name, x, gain_db=-3.0):
    x = fade(x)
    x = x / (np.max(np.abs(x)) + 1e-9) * (10 ** (gain_db / 20))
    os.makedirs(OUT, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        wavfile.write(f.name, SR, (x * 32767).astype(np.int16))
        dst = os.path.join(OUT, name + '.mp3')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', f.name, '-ac', '1', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '64k', dst], check=True)
        os.unlink(f.name)
    print(f'{name}.mp3  {len(x) / SR:.2f} s  {os.path.getsize(dst) // 1024} kB')

N = {'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.0, 'B5': 987.77, 'C6': 1046.5, 'E6': 1318.5, 'G4': 392.0, 'A4': 440.0, 'B4': 493.88, 'D4': 293.66, 'E4': 329.63, 'C4': 261.63, 'G3': 196.0}

# Tramvaj: dvostruko zvonce + kratki „klik“ tračnica (Zagreb, Osijek, Sarajevo)
ding = bell(1760, 0.9, 0.35) * 0.6 + bell(1760 * 1.5, 0.9, 0.25) * 0.25
clack = lp(noise(0.05), 900) * env(int(SR * 0.05), 0.001, 0.02)
save('tramvaj', place(1.6, (0, ding), (0.22, ding), (0.75, clack * 0.5), (0.95, clack * 0.45)))

# Brodska sirena: dubok ton s harmonicima, polako nabuja (Rijeka, Split, Zadar, Ploče)
x = t(1.5); s = sum(a * np.sin(2 * np.pi * 110 * k * x) for k, a in ((1, 1), (2, .5), (3, .35), (4, .2), (5, .12)))
s *= np.minimum(1, x / 0.18) * np.minimum(1, (1.5 - x) / 0.35)
save('brod', lp(s, 1400) + 0.04 * lp(noise(1.5), 400), -4)

# Zvona: tri udarca crkvenog zvona (Dubrovnik, Šibenik, Trogir)
save('zvona', place(2.4, (0, bell(N['E5'], 2.2)), (0.45, bell(N['C5'], 1.9)), (0.9, bell(N['G4'], 1.5))), -4)

# More: šum valova i daleki „krik“ galeba sintetiziran frekvencijskim klizanjem (obala)
w = bp(noise(2.2), 200, 1800) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.7 * t(2.2) - 1.2)) * np.minimum(1, t(2.2) / 0.4)
def gull(d=0.32, f0=2300, f1=1500):
    x = t(d); f = np.linspace(f0, f1, len(x)); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) + 0.3 * np.sin(2 * ph)) * np.sin(np.pi * x / d) ** 1.5
save('more', place(2.2, (0, w * 0.6), (0.5, gull() * 0.35), (0.85, gull(0.25, 2500, 1700) * 0.3)), -5)

# Planina: rog s jekom (Gospić, Sveti Rok, Jajce, Bihać, Konjic)
horn = lambda f, d: tone(f, d, ((1, 1), (2, .45), (3, .25), (4, .12)), a=0.06, r=0.9)
motif = place(1.2, (0, horn(N['G4'], 0.45)), (0.4, horn(N['D5'], 0.75)))
save('planina', place(2.6, (0, motif), (0.9, motif * 0.35), (1.6, motif * 0.15)), -4)

# Mandolina: trzani uzlazni akord (Split, Mostar, Makarska)
save('mandolina', place(1.4, *[(i * 0.09, pluck(f, 1.0) * 0.8) for i, f in enumerate((N['G4'], N['B4'], N['D5'], N['G5']))], (0.45, pluck(N['G5'], 0.9) * 0.5), (0.5, pluck(N['B5'], 0.9) * 0.5)), -4)

# Granica: pečat u putovnici + dva tona
stamp = lp(noise(0.12), 500) * env(int(SR * 0.12), 0.001, 0.035) * 1.4 + tone(90, 0.12, a=0.001, r=0.04)
save('granica', place(1.1, (0, stamp), (0.18, tone(N['C6'], 0.6, ((1, 1), (2.76, .2)), r=0.35) * 0.45), (0.33, tone(N['G5'] * 1.335, 0.7, ((1, 1), (2.76, .2)), r=0.4) * 0.45)), -4)

# Cilj: kratka fanfara (limeni puhač: pilasti harmonici kroz niskopropusni filtar)
brass = lambda f, d: lp(tone(f, d, tuple((k, 1 / k) for k in range(1, 9)), a=0.02, r=0.5), 3200)
save('cilj', place(1.9, (0, brass(N['C5'], 0.18)), (0.16, brass(N['E5'], 0.18)), (0.32, brass(N['G5'], 0.18)), (0.5, brass(N['C6'], 1.2)), (0.5, brass(N['E5'], 1.2) * 0.6)), -3)

# Kraj partije: vedra kadenca
save('kraj', place(1.7, *[(i * 0.13, tone(f, 0.9, ((1, 1), (2, .3), (3, .12)), r=0.35) * 0.7) for i, f in enumerate((N['C5'], N['E5'], N['G5'], N['C6']))], (0.62, tone(N['E6'], 1.0, ((1, 1), (2, .2)), r=0.5) * 0.5)), -4)
