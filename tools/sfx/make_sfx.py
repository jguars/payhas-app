"""Synthesise Payhas UI sounds (44.1 kHz mono 16-bit WAV) with numpy/scipy.

Palette: glassy bubbles, soft marimba and bell chimes, a touch of small-room
air. Everything is short (mostly < 0.4 s), peaks at -12 dBFS so it sits under
video audio, and is deterministic (fixed seed) so re-running gives the same files.

Run from the app folder:  python3 tools/sfx/make_sfx.py assets/sfx
"""
import sys
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
rng = np.random.default_rng(11)
PEAK = 10 ** (-12 / 20)

NOTE = {  # equal temperament, A4 = 440
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'G5': 783.99, 'A5': 880.0,
    'C6': 1046.5, 'D6': 1174.66, 'E6': 1318.51, 'G6': 1567.98, 'A6': 1760.0, 'C7': 2093.0,
    'G4': 392.0, 'E4': 329.63, 'C4': 261.63, 'A3': 220.0,
}


def t_axis(dur):
    return np.arange(int(SR * dur)) / SR


def env(dur, attack=0.003, decay=8.0):
    t = t_axis(dur)
    return np.minimum(1.0, t / attack) * np.exp(-decay * t)


def tone(freq, dur, partials=((1, 1.0),), decay=8.0, attack=0.003, glide=0.0):
    """Pitched note; `glide` bends by that many semitones across the note."""
    t = t_axis(dur)
    f = freq * 2 ** (glide * t / dur / 12)
    phase = 2 * np.pi * np.cumsum(f) / SR
    return sum(a * np.sin(m * phase) for m, a in partials) * env(dur, attack, decay)


MARIMBA = ((1, 1.0), (4, 0.25), (10, 0.06))
BELL = ((1, 1.0), (2.76, 0.35), (5.4, 0.15), (8.9, 0.05))
GLASS = ((1, 1.0), (2, 0.2), (3, 0.08))


def noise(dur, lo, hi, decay=12.0, attack=0.002):
    b, a = signal.butter(2, [lo / (SR / 2), hi / (SR / 2)], btype='band')
    return signal.lfilter(b, a, rng.uniform(-1, 1, int(SR * dur))) * env(dur, attack, decay)


def sweep_noise(dur, f0, f1, q=6.0, decay=6.0):
    """Noise through a band-pass whose centre glides f0 → f1 (whooshes, flicks)."""
    n = int(SR * dur)
    src = rng.uniform(-1, 1, n)
    out = np.zeros(n)
    block = 256
    for i in range(0, n, block):
        c = f0 * (f1 / f0) ** (i / n)
        bw = c / q
        b, a = signal.butter(2, [max(40, c - bw) / (SR / 2), min(SR / 2 - 100, c + bw) / (SR / 2)], btype='band')
        out[i:i + block] = signal.lfilter(b, a, src[i:i + block])
    return out * env(dur, 0.01, decay)


def mix(*clips):
    """Sum clips of different lengths (shorter ones are padded with silence)."""
    n = max(len(c) for c in clips)
    return sum(np.pad(c, (0, n - len(c))) for c in clips)


def seq(*items, total=0.0):
    n = max([int(SR * at) + len(c) for at, c in items] + [int(SR * total)])
    out = np.zeros(n)
    for at, c in items:
        s = int(SR * at)
        out[s:s + len(c)] += c
    return out


def room(x, mix=0.12, length=0.25):
    """Tiny room: convolve with a short decaying noise burst."""
    ir = rng.uniform(-1, 1, int(SR * length)) * np.exp(-18 * t_axis(length))
    ir /= np.abs(ir).sum() / 4
    wet = signal.fftconvolve(x, ir)[: len(x) + int(SR * 0.08)]
    dry = np.pad(x, (0, len(wet) - len(x)))
    return dry * (1 - mix) + wet * mix


def finish(x, tail=0.02):
    x = np.pad(x, (0, int(SR * tail)))
    fade = int(SR * 0.008)
    x[-fade:] *= np.linspace(1, 0, fade)
    peak = np.abs(x).max() or 1
    return (x / peak * PEAK * 32767).astype(np.int16)


def pop(freq=900, dur=0.09, glide=-7):
    """A bubble: short pitched blip falling in pitch, plus a tiny air click."""
    return mix(tone(freq, dur, GLASS, decay=38, attack=0.001, glide=glide), 0.25 * noise(0.02, 2000, 7000, decay=120))


SOUNDS = {
    # interface
    'tap': lambda: mix(tone(NOTE['A6'], 0.05, ((1, 1.0), (3, 0.1)), decay=70, attack=0.001), 0.3 * noise(0.012, 3000, 9000, decay=200)),
    'tab': lambda: tone(NOTE['E6'], 0.07, MARIMBA, decay=55, attack=0.001),
    'toggle_on': lambda: seq((0, tone(NOTE['C6'], 0.08, MARIMBA, decay=40)), (0.05, tone(NOTE['G6'], 0.1, MARIMBA, decay=35))),
    'toggle_off': lambda: seq((0, tone(NOTE['G6'], 0.08, MARIMBA, decay=40)), (0.05, tone(NOTE['C6'], 0.1, MARIMBA, decay=35))),
    'sheet': lambda: 0.6 * sweep_noise(0.18, 600, 2400, q=4, decay=14),
    # engagement
    'like': lambda: room(seq((0, pop(700, 0.08, 5)), (0.055, tone(NOTE['G6'], 0.16, BELL, decay=22)))),
    'heart': lambda: room(seq(
        (0, pop(520, 0.1, 9)),
        (0.06, tone(NOTE['C6'], 0.3, BELL, decay=12)),
        (0.1, 0.5 * tone(NOTE['E6'], 0.28, BELL, decay=13)),
        (0.14, 0.35 * tone(NOTE['C7'], 0.25, BELL, decay=16)),
    ), mix=0.18),
    'unlike': lambda: tone(NOTE['E5'], 0.09, MARIMBA, decay=40, glide=-3),
    'react': lambda: room(seq((0, pop(650, 0.07, 10)), (0.05, pop(900, 0.07, 10)), (0.1, pop(1250, 0.08, 9)))),
    'save': lambda: room(seq((0, 0.7 * noise(0.04, 300, 1500, decay=60)), (0.025, tone(NOTE['D6'], 0.14, MARIMBA, decay=26)))),
    'follow': lambda: room(seq(
        (0, tone(NOTE['C6'], 0.16, MARIMBA, decay=20)),
        (0.07, tone(NOTE['E6'], 0.16, MARIMBA, decay=20)),
        (0.14, tone(NOTE['G6'], 0.26, BELL, decay=12)),
    )),
    'send': lambda: room(seq((0, 0.8 * sweep_noise(0.28, 500, 5000, q=5, decay=9)), (0.18, tone(NOTE['A6'], 0.2, BELL, decay=18)))),
    'hide': lambda: seq((0, 0.6 * sweep_noise(0.2, 2400, 500, q=4, decay=14)), (0.05, tone(NOTE['C5'], 0.12, MARIMBA, decay=30, glide=-4))),
    # PIN
    'key': lambda: tone(NOTE['C6'], 0.05, MARIMBA, decay=70, attack=0.001),
    'success': lambda: room(seq((0, tone(NOTE['G5'], 0.14, MARIMBA, decay=22)), (0.08, tone(NOTE['D6'], 0.3, BELL, decay=11)))),
    'error': lambda: seq((0, tone(NOTE['A3'], 0.09, ((1, 1.0), (2, 0.4)), decay=30)), (0.11, tone(NOTE['A3'] * 0.94, 0.12, ((1, 1.0), (2, 0.4)), decay=26))),
    # games
    'pop1': lambda: pop(820),
    'pop2': lambda: pop(1000),
    'pop3': lambda: pop(1220),
    'combo': lambda: room(seq((0, tone(NOTE['E6'], 0.1, BELL, decay=24)), (0.05, tone(NOTE['A6'], 0.18, BELL, decay=16)))),
    'wrong': lambda: tone(NOTE['E4'], 0.22, ((1, 1.0), (2, 0.15)), decay=14, glide=-5),
    'flip': lambda: 0.7 * sweep_noise(0.1, 1500, 4000, q=5, decay=30),
    'match': lambda: room(seq((0, tone(NOTE['E6'], 0.14, BELL, decay=20)), (0.07, tone(NOTE['A6'], 0.3, BELL, decay=11)))),
    'win': lambda: room(seq(
        (0.00, tone(NOTE['C6'], 0.18, MARIMBA, decay=18)),
        (0.10, tone(NOTE['E6'], 0.18, MARIMBA, decay=18)),
        (0.20, tone(NOTE['G6'], 0.18, MARIMBA, decay=18)),
        (0.32, tone(NOTE['C7'], 0.7, BELL, decay=5)),
        (0.36, 0.4 * tone(NOTE['G6'], 0.6, BELL, decay=6)),
    ), mix=0.2),
    # screen time
    'times_up': lambda: room(seq(
        (0.0, tone(NOTE['G5'], 0.4, BELL, decay=7)),
        (0.22, tone(NOTE['E5'], 0.4, BELL, decay=7)),
        (0.44, tone(NOTE['C5'], 0.8, BELL, decay=4)),
    ), mix=0.25),
}


def main(out_dir: str):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for name, make in SOUNDS.items():
        data = finish(make())
        wavfile.write(out / f'{name}.wav', SR, data)
        print(f'{name:10s} {len(data) / SR:.2f}s')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'assets/sfx')
