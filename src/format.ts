// How a clock reads on the display, and when that reading next changes. Pure.

/** Below this the clock is drawn in red, and in tenths when the bar keeps up. */
const LOW_MS = 10_000;

const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

/**
 * The text for a clock with `ms` left.
 *
 * With tenths, seconds are truncated and the last ten seconds read "9.9" down to "0.0", as on an
 * online clock. Without tenths, seconds are rounded up, so "0:00" only ever shows on a fallen flag.
 */
export function formatClock(ms: number, tenths: boolean): string {
  if (tenths && ms < LOW_MS) {
    const t = Math.floor(ms / 100);
    return `${Math.floor(t / 10)}.${t % 10}`;
  }

  const seconds = tenths ? Math.floor(ms / 1000) : Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${pad(seconds % 60)}`;
}

/** Whether the clock displays less than ten seconds. */
export function isLow(ms: number, tenths: boolean): boolean {
  return tenths ? ms < LOW_MS : Math.ceil(ms / 1000) < LOW_MS / 1000;
}

/**
 * How long a running clock with `ms` left keeps its current text and colour: the wait until the
 * next redraw, or until the flag falls, whichever comes first.
 */
export function msUntilNextChange(ms: number, tenths: boolean): number {
  if (ms <= 0) return 0;

  if (!tenths) return ((ms - 1) % 1000) + 1;

  // Truncated readings change just below a boundary, hence the extra millisecond.
  const wait = (ms < LOW_MS ? ms % 100 : ms % 1000) + 1;
  return Math.min(wait, ms);
}
