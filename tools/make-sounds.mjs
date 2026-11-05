// Generates the app's sounds into src/sounds/. Run with `pnpm sounds`; the .snd files are committed,
// so this only needs running again when a sound is changed.
//
// A .snd file is what the firmware's own converter (scripts/audio.py in busybar-firmware) produces:
// raw signed 16-bit little-endian PCM, mono, 44100 Hz, no header.

import { mkdirSync, writeFileSync } from "node:fs";

const RATE = 44100;
const OUT = new URL("../src/sounds/", import.meta.url);

/** Ramp at both ends of a tone, so it does not click. */
const EDGE_S = 0.008;

/** The amplifier takes a moment to wake up, and would swallow the start of a short sound. */
const LEAD_IN_S = 0.12;

function silence(seconds) {
  return new Array(Math.round(seconds * RATE)).fill(0);
}

function tone(hz, seconds, volume = 0.6) {
  const count = Math.round(seconds * RATE);
  const edge = Math.round(EDGE_S * RATE);
  const samples = [];

  for (let i = 0; i < count; i++) {
    const envelope = Math.min(1, i / edge, (count - 1 - i) / edge);
    samples.push(Math.sin((2 * Math.PI * hz * i) / RATE) * volume * envelope);
  }

  return samples;
}

function write(name, parts) {
  const samples = [silence(LEAD_IN_S), ...parts].flat();
  const pcm = Buffer.alloc(samples.length * 2);

  samples.forEach((sample, i) => pcm.writeInt16LE(Math.round(sample * 32767), i * 2));

  writeFileSync(new URL(name, OUT), pcm);
  console.log(`${name}: ${(samples.length / RATE).toFixed(2)} s, ${pcm.length} bytes`);
}

mkdirSync(OUT, { recursive: true });

// Ten seconds left: one short, high beep.
write("low.snd", [tone(1760, 0.12)]);

// Flag fall: a falling three-note figure, unmistakable from the beep.
write("flag.snd", [tone(880, 0.16), silence(0.05), tone(660, 0.16), silence(0.05), tone(440, 0.4)]);
