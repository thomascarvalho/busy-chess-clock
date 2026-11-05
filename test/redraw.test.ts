import assert from "node:assert/strict";
import { test } from "node:test";
import { formatClock } from "../src/format.ts";
import { CLOCK_STEP_MS, MIN_TIMER_MS, msUntilRedraw } from "../src/redraw.ts";

test("the wait runs from the moment the frame was drawn for, not from when the wait is computed", () => {
  // Drawn with 29:58.989 left; working that out and sending the frame took 30 ms.
  assert.equal(msUntilRedraw(1_798_989, true, 30), 989 + 1 + CLOCK_STEP_MS - 30);
});

test("a frame drawn right on a boundary, still showing the old second, is redrawn at once", () => {
  // Seen on the bar: the timer fires with exactly 29:58.000 left, the frame still reads 29:58, and
  // 25 ms later the clock is past the boundary. Waiting for the *next* boundary skips a second.
  assert.equal(msUntilRedraw(1_798_000, true, 25), MIN_TIMER_MS);
});

test("the wait is never shorter than what the runtime's timers allow", () => {
  assert.equal(msUntilRedraw(1_798_003, true, 500), MIN_TIMER_MS);
  assert.equal(msUntilRedraw(0, true, 0), MIN_TIMER_MS);
});

/** The bar's clock: milliseconds on a 1/256 s grid. */
function deviceClock(realMs: number): number {
  const second = Math.floor(realMs / 1000);
  const step = Math.floor(((realMs - second * 1000) * 256) / 1000);
  return second * 1000 + Math.floor((step * 1000) / 256);
}

/** Deterministic stand-in for Math.random, so a failure can be replayed. */
function sequence(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

test("on the bar's coarse clock, with slow ticks and early timers, every second is shown, on time", () => {
  for (const tenths of [true, false]) {
    const random = sequence(42);
    const base = 300_000;
    let real = 1_000_123.4;
    const since = deviceClock(real);
    const leftAt = (ms: number) => base - (deviceClock(ms) - since);

    let shown = formatClock(base, tenths);
    let shownAtLeft = base;

    // Down to the last ten seconds, where the display switches to tenths.
    while (leftAt(real) > 11_000) {
      // A tick: read the clock, draw the frame for that reading.
      const drawnLeft = leftAt(real);
      const drawnAt = deviceClock(real);
      const text = formatClock(drawnLeft, tenths);

      if (text !== shown) {
        const seconds = (value: string) => Number(value.split(":")[0]) * 60 + Number(value.split(":")[1]);
        assert.equal(seconds(shown) - seconds(text), 1, `${shown} -> ${text} (tenths ${tenths})`);
        shown = text;
        shownAtLeft = drawnLeft;
      }

      // The reading on screen must never be stale for long.
      assert.ok(shownAtLeft - drawnLeft < 1_050, `${shown} still up with ${drawnLeft} ms left (tenths ${tenths})`);

      // Building and sending the frame takes a while before the next wait is worked out...
      real += random() * 40;
      const wait = msUntilRedraw(drawnLeft, tenths, deviceClock(real) - drawnAt);
      // ...and the timer runs on another clock: up to 1 ms early, up to 2 ms late.
      real += wait - 1 + random() * 3;
    }
  }
});
