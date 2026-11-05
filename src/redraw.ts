// When to wake up next so the running clock's reading stays current. Pure.

import { msUntilNextChange } from "./format.ts";

/** The runtime does not fire a timer sooner than this. */
export const MIN_TIMER_MS = 10;

/**
 * The device's clock advances in steps of 1/256 s. Waking up one step past a change makes sure the
 * clock reads past it too; aiming at the change itself lands on the old reading about every other time.
 */
export const CLOCK_STEP_MS = 4;

/**
 * How long to wait before the frame on screen has to be drawn again.
 *
 * The wait is counted from the moment that frame was drawn for. Counting from the clock as it reads
 * when the wait is worked out looks equivalent, but drawing takes tens of milliseconds on the bar:
 * a frame drawn right on a boundary still shows the old second, the clock has moved past the
 * boundary by the time the wait is computed, and the app would then sleep through a whole second.
 *
 * @param left - What the running clock had left at the moment the frame on screen was drawn for.
 * @param tenths - Whether the last ten seconds are drawn in tenths.
 * @param sinceDrawn - How long ago that moment was.
 */
export function msUntilRedraw(left: number, tenths: boolean, sinceDrawn: number): number {
  return Math.max(MIN_TIMER_MS, msUntilNextChange(left, tenths) + CLOCK_STEP_MS - sinceDrawn);
}
