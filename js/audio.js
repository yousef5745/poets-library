// Optional background music and small WebAudio cues. Off by default; the reader turns it on from settings.
let on = false, ac = null, music = null;
export function setOn(v, quiet) {
  on = !!v;
  if (!music) { music = new Audio('assets/audio/music.mp3'); music.loop = true; music.volume = 0.28; }
  if (on && !quiet) music.play().catch(() => {});
  if (!on) music.pause();
}
export function unlock() {
  if (on && music && music.paused) music.play().catch(() => {});
  if (!ac && on) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
}
export function stop() { if (music) music.pause(); }
function tone(f, d, type = 'sine', vol = 0.05, when = 0) {
  if (!on || !ac) return;
  const t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + 0.05);
}
export function sfx(k) {
  if (k === 'tap') tone(880, 0.1, 'sine', 0.025);
  else if (k === 'choose') { tone(587, 0.25, 'triangle', 0.05); tone(880, 0.3, 'sine', 0.035, 0.06); }
  else if (k === 'pearl') [1318, 1568, 1976].forEach((f, i) => tone(f, 0.35, 'sine', 0.04, i * 0.08));
  else if (k === 'verse') [294, 370, 440, 587].forEach((f, i) => tone(f, 1.4, 'sine', 0.035, i * 0.12));
  else if (k === 'end') [294, 392, 494, 587, 740].forEach((f, i) => tone(f, 1.2, 'triangle', 0.04, i * 0.15));
  else if (k === 'no') tone(196, 0.25, 'triangle', 0.05);
}
