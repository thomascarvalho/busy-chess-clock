// Simulates the countdown's redraws on a model of the BUSY Bar, to see how many displayed seconds
// are skipped with the wait worked out before and after the fix in src/redraw.ts.
//
// The model only has the two traits noted in AGENTS.md: Date.now() advances in steps of 1/256 s,
// and drawing a frame takes 25 to 40 ms. Timers fire on time. It runs the app's own formatClock,
// msUntilNextChange and msUntilRedraw.
//
// Run with: node tools/countdown-sim.mjs

import { formatClock, msUntilNextChange } from "../src/format.ts";
import { MIN_TIMER_MS, msUntilRedraw } from "../src/redraw.ts";

const STEP_MS = 1000 / 256;
const START_MS = 5 * 60_000;
const END_MS = 11_000; // stop above the last ten seconds, where the display switches to tenths
const RUNS = 200;
const TENTHS = true; // the default: whole seconds are truncated above ten seconds

/** A small seeded generator, so every run of the script gives the same numbers. */
function random(seed) {
  let state = seed;
  return () => (state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
}

/** What Date.now() reads on the bar at real time `t`. */
const barNow = (t) => Math.floor(Math.floor(t / STEP_MS) * STEP_MS);

/** The wait the app worked out before the fix: from the clock as it reads after drawing. */
const waitBefore = (_drawnLeft, leftNow) => Math.max(MIN_TIMER_MS, msUntilNextChange(leftNow, TENTHS));

/** The wait it works out since the fix: from the moment the frame on screen was drawn for. */
const waitAfter = (drawnLeft, leftNow) => msUntilRedraw(drawnLeft, TENTHS, drawnLeft - leftNow);

/** One countdown from 5:00. Returns every wake-up and the readings that never reached the screen. */
function countdown(wait, drawMs, seed) {
  const rand = random(seed);
  let t = rand() * 1000;
  const start = barNow(t);
  const wakes = [];

  for (;;) {
    const left = START_MS - (barNow(t) - start);
    if (left < END_MS) break;

    t += drawMs(rand);
    const leftNow = START_MS - (barNow(t) - start);
    const next = wait(left, leftNow);
    wakes.push({ shows: formatClock(left, TENTHS), left, leftAfterDraw: leftNow, wait: next });
    t += next;
  }

  const shown = new Set(wakes.map((wake) => wake.shows));
  const missed = [];
  for (let ms = START_MS - 1; ms >= END_MS; ms -= 1000) {
    if (!shown.has(formatClock(ms, TENTHS))) missed.push(formatClock(ms, TENTHS));
  }
  return { wakes, missed };
}

const slowDraw = (rand) => 25 + rand() * 15;
const instantDraw = () => 0;
const secondsPerRun = (START_MS - END_MS) / 1000;

for (const [label, wait, drawMs] of [
  ["before the fix, 25-40 ms draws", waitBefore, slowDraw],
  ["after the fix, 25-40 ms draws", waitAfter, slowDraw],
  ["before the fix, instant draws", waitBefore, instantDraw],
]) {
  let missed = 0;
  let stale = 0;
  let wakes = 0;
  for (let seed = 1; seed <= RUNS; seed++) {
    const run = countdown(wait, drawMs, seed);
    missed += run.missed.length;
    wakes += run.wakes.length;
    // The screen is already behind when the reading changed while the frame was being drawn.
    stale += run.wakes.filter((wake) => formatClock(wake.leftAfterDraw, TENTHS) !== wake.shows).length;
  }
  const missedShare = ((100 * missed) / (RUNS * secondsPerRun)).toFixed(1);
  const staleShare = ((100 * stale) / wakes).toFixed(1);
  console.log(`${label}: ${missedShare} % of seconds never shown, screen behind after ${staleShare} % of wake-ups`);
}

// The three wake-ups that lead to the first skipped second of the first run, before the fix.
const { wakes, missed } = countdown(waitBefore, slowDraw, 1);
const skip = wakes.findIndex((wake, i) => i > 0 && wake.shows < formatClock(wakes[i - 1].left - 1000, TENTHS));
console.log(`\nFirst run before the fix, ${missed[0]} is never shown:`);
console.table(wakes.slice(skip - 2, skip + 1));
