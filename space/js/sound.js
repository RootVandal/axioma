/**
 * Original score, synthesised live: slow pads, a sub, a glass arpeggio and a soft pulse.
 * Harmony and density follow the chapter on screen. D Dorian, 58 bpm.
 */
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const BEAT = 60 / 58, CHORD = BEAT * 8;

const C = {
  Dm9: [38, 57, 60, 64, 65, 69], Bb: [34, 53, 57, 62, 65, 72], F: [41, 57, 60, 64, 67, 72], C69: [36, 55, 62, 64, 67, 69],
  Gm9: [43, 58, 62, 65, 69, 70], Asus: [33, 57, 62, 64, 67, 71], Eb: [39, 55, 58, 62, 65, 70],
  void: [26, 50, 57, 63], thin: [38, 62, 69], open: [38, 57, 62, 66, 69, 76], Am9: [45, 60, 64, 67, 71, 74],
};
export const SCORE = {
  hero: { prog: ['Dm9', 'Bb', 'F', 'Asus'], arp: .35, pulse: 0, cut: 900, verb: .55 },
  order: { prog: ['Gm9', 'Dm9', 'Bb', 'C69'], arp: .8, pulse: 0, cut: 1500, verb: .5 },
  ship: { prog: ['Dm9', 'F', 'C69', 'Asus'], arp: .4, pulse: .7, cut: 1200, verb: .45 },
  origin: { prog: ['F', 'Am9', 'Bb', 'C69'], arp: 1, pulse: 0, cut: 1900, verb: .6 },
  energy: { prog: ['Dm9', 'Eb', 'Dm9', 'Bb'], arp: .25, pulse: 1, cut: 1500, verb: .5 },
  hole: { prog: ['void', 'void', 'Eb', 'void'], arp: 0, pulse: .25, cut: 420, verb: .8 },
  scale: { prog: ['Bb', 'F', 'Gm9', 'Dm9'], arp: .5, pulse: 0, cut: 1300, verb: .85 },
  world: { prog: ['F', 'C69', 'Gm9', 'Bb'], arp: .85, pulse: .3, cut: 1800, verb: .55 },
  moon: { prog: ['thin', 'thin', 'void', 'thin'], arp: .1, pulse: 0, cut: 520, verb: .95 },
  end: { prog: ['Bb', 'F', 'Asus', 'open'], arp: .4, pulse: 0, cut: 1600, verb: .8 },
};

/** The audio graph and its notes. Works on a live or an offline context. */
class Score {
  constructor(c) {
    this.c = c; this.scene = SCORE.hero; this.i = 0; this.seed = 1;
    const out = this.out = c.createGain(); out.gain.value = .8;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = .02; comp.release.value = .3;
    out.connect(comp); comp.connect(c.destination);

    this.dry = c.createGain(); this.dry.gain.value = .75; this.dry.connect(out);
    this.fx = c.createGain(); this.fx.gain.value = .9; this.fx.connect(comp);   // effects ride above the ducked score
    this.wet = c.createGain(); this.wet.gain.value = .55;
    const conv = c.createConvolver(); conv.buffer = this.impulse(5.5); conv.connect(this.wet); this.wet.connect(out);
    this.verb = conv;

    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 900; this.lp.Q.value = .3;
    this.lp.connect(this.dry); this.lp.connect(conv);
    const wob = c.createOscillator(), wg = c.createGain(); wob.frequency.value = .043; wg.gain.value = 170;
    wob.connect(wg); wg.connect(this.lp.frequency); wob.start();

    this.delay = c.createDelay(2); this.delay.delayTime.value = BEAT * .75;
    const fb = c.createGain(); fb.gain.value = .42;
    this.echo = c.createGain(); this.echo.gain.value = .5;
    this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(this.dry); this.delay.connect(conv);
    this.echo.connect(this.delay); this.echo.connect(conv); this.echo.connect(this.dry);
  }

  impulse(sec) {
    const c = this.c, n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let l = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n, w = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.8);
        l += (w - l) * (.5 - .42 * t);          // the tail darkens as it decays
        d[i] = l;
      }
    }
    return b;
  }

  rand() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }

  pad(notes, t, dur) {
    const c = this.c;
    notes.forEach((m, k) => {
      const f = mtof(m), g = c.createGain(), low = k === 0;
      const peak = low ? .17 : .05;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 2.6);
      g.gain.setValueAtTime(peak, t + dur - .5);
      g.gain.linearRampToValueAtTime(0, t + dur + 3.4);
      g.connect(low ? this.dry : this.lp);
      const voices = low ? [['sine', 0]] : [['sawtooth', -6], ['sawtooth', 6], ['triangle', 0]];
      for (const [type, cents] of voices) {
        const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = cents;
        o.connect(g); o.start(t); o.stop(t + dur + 3.6);
      }
    });
  }

  /** Two-operator FM bell: reads as glass over the pads. */
  bell(m, t, vol) {
    const c = this.c, f = mtof(m), o = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    o.frequency.value = f; mod.frequency.value = f * 3.01;
    mg.gain.setValueAtTime(f * 1.5, t); mg.gain.exponentialRampToValueAtTime(1, t + .9);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.0002, t + 2.3);
    mod.connect(mg); mg.connect(o.frequency); o.connect(g); g.connect(this.echo);
    o.start(t); mod.start(t); o.stop(t + 2.4); mod.stop(t + 2.4);
  }

  thump(m, t, vol) {
    const c = this.c, o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = mtof(m);
    lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(520, t); lp.frequency.exponentialRampToValueAtTime(110, t + .28);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.0003, t + .36);
    o.connect(lp); lp.connect(g); g.connect(this.dry); o.start(t); o.stop(t + .4);
  }

  /** Queues one chord of music starting at t. */
  chord(t) {
    const s = this.scene, name = s.prog[this.i % s.prog.length], notes = C[name];
    this.i++;
    const c = this.c;
    this.lp.frequency.setTargetAtTime(s.cut, t, 2);
    this.wet.gain.setTargetAtTime(s.verb, t, 2);
    this.pad(notes, t, CHORD);
    const up = notes.slice(1), steps = 16, dt = CHORD / steps;
    for (let i = 0; i < steps; i++) {
      const at = t + i * dt;
      if (this.rand() < s.arp * (i % 4 === 0 ? .95 : i % 2 === 0 ? .5 : .24)) {
        const n = up[Math.floor(this.rand() * up.length)] + 12 * (this.rand() < .42 ? 2 : 1);
        this.bell(n, at + (this.rand() - .5) * .018, .05 + this.rand() * .05);
      }
      if (s.pulse && i % 2 === 0) this.thump(notes[0] + 12, at, .12 * s.pulse * (i % 8 === 0 ? 1.15 : .75));
    }
  }

  /** A soft breath of air between chapters. */
  swell(t) {
    const c = this.c, n = c.createBufferSource(), b = c.createBuffer(1, c.sampleRate * 2.6, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    n.buffer = b;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = .8;
    f.frequency.setValueAtTime(240, t); f.frequency.exponentialRampToValueAtTime(1800, t + 1.3); f.frequency.exponentialRampToValueAtTime(320, t + 2.6);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05, t + 1.2); g.gain.linearRampToValueAtTime(0, t + 2.6);
    n.connect(f); f.connect(g); g.connect(this.verb); g.connect(this.dry); n.start(t);
  }
}

/** Filtered noise with a frequency sweep, the base of every effect in the finale. */
function sweep(c, dest, t, dur, f0, f1, g0, gPeak, peakAt, q = .7, type = 'bandpass') {
  const n = c.createBufferSource(), b = c.createBuffer(1, Math.ceil(c.sampleRate * Math.min(dur + .1, 3)), c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  n.buffer = b; n.loop = true;
  const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(g0, t);
  g.gain.linearRampToValueAtTime(gPeak, t + peakAt); g.gain.exponentialRampToValueAtTime(.0004, t + dur);
  n.connect(f); f.connect(g); g.connect(dest); n.start(t); n.stop(t + dur + .05);
  return g;
}
function drop(c, dest, t, dur, f0, f1, vol) {
  const o = c.createOscillator(), g = c.createGain();
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0004, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + .05);
}

export class Sound {
  constructor() { this.on = false; this.name = 'hero'; }

  toggle() { this.on ? this.stop() : this.start(); return this.on; }

  start() {
    this.on = true;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { this.on = false; return; }
      this.ctx = new AC();
      this.score = new Score(this.ctx);
      this.score.scene = SCORE[this.name];
      this.score.out.gain.value = 0;
      this.next = this.ctx.currentTime + .1;
    }
    this.ctx.resume();
    this.score.out.gain.setTargetAtTime(.8, this.ctx.currentTime, 1.4);
    if (this.next < this.ctx.currentTime) this.next = this.ctx.currentTime + .1;
    this.timer ||= setInterval(() => this.pump(), 400);
    this.pump();
  }

  pump() {
    while (this.next < this.ctx.currentTime + 1.2) { this.score.chord(this.next); this.next += CHORD; }
  }

  stop() {
    this.on = false;
    if (!this.ctx) return;
    this.score.out.gain.setTargetAtTime(0, this.ctx.currentTime, .35);
    clearInterval(this.timer); this.timer = null;
    setTimeout(() => { if (!this.on) this.ctx.suspend(); }, 1600);
  }

  scene(name) {
    if (!SCORE[name]) return;
    this.name = name;
    if (this.score) { this.score.scene = SCORE[name]; this.score.i = 0; }
  }

  swell() { if (this.on) this.score.swell(this.ctx.currentTime); }

  /** Ducks the score, then plays the jump, the stop, the collapse and the blast at the given offsets. */
  finale(stopAt, boomAt) {
    if (!this.on) return;
    const c = this.ctx, t = c.currentTime, s = this.score, end = boomAt + 5;
    const o = s.out.gain; o.cancelScheduledValues(t); o.setTargetAtTime(.1, t, .15); o.setTargetAtTime(.8, t + end, 1.2);
    sweep(c, s.fx, t, stopAt, 180, 3200, .02, .42, stopAt * .9, 1.1);
    const w = c.createOscillator(), wg = c.createGain(); w.type = 'sawtooth';
    w.frequency.setValueAtTime(34, t); w.frequency.exponentialRampToValueAtTime(120, t + stopAt);
    wg.gain.setValueAtTime(0, t); wg.gain.linearRampToValueAtTime(.14, t + stopAt * .8); wg.gain.linearRampToValueAtTime(0, t + stopAt + .02);
    w.connect(wg); wg.connect(s.fx); w.start(t); w.stop(t + stopAt + .05);
    drop(c, s.fx, t + stopAt, .8, 96, 30, .9);
    sweep(c, s.fx, t + boomAt - .62, .66, 300, 5200, .001, .34, .6, .6, 'highpass');
    drop(c, s.fx, t + boomAt, 4.2, 68, 19, 1.1);
    sweep(c, s.fx, t + boomAt, 4.6, 4200, 90, .85, .85, .02, .4, 'lowpass');
    sweep(c, s.verb, t + boomAt, 3, 2600, 200, .34, .34, .02, .5, 'lowpass');
  }

  /** Final chord on acceptance: the piece resolves to D major. */
  resolve() {
    if (!this.on) return;
    const s = this.score; s.pad(C.open, this.ctx.currentTime + .05, CHORD);
    [62, 69, 74, 78, 81, 86].forEach((m, i) => s.bell(m, this.ctx.currentTime + .1 + i * .19, .09));
  }
}

/** Renders the score faster than real time so its levels can be measured. */
export async function measure(names, chords = 3) {
  const res = {};
  for (const n of names) {
    const sr = 44100, len = Math.ceil((chords * CHORD + 5) * sr);
    const o = new OfflineAudioContext(2, len, sr), s = new Score(o);
    s.scene = SCORE[n];
    for (let i = 0; i < chords; i++) s.chord(.05 + i * CHORD);
    const b = await o.startRendering(), d = b.getChannelData(0);
    let peak = 0, sum = 0;
    for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += v * v; }
    res[n] = { peak: +peak.toFixed(3), rmsDb: +(10 * Math.log10(sum / d.length + 1e-12)).toFixed(1) };
  }
  return res;
}
