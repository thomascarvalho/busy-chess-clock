// Bookkeeping for how long the device takes to answer. Pure.

/** Weight of a new sample in the smoothed value. */
const SMOOTHING = 0.25;

export class Latency {
  count = 0;
  max = 0;
  private total = 0;
  private recent: number | undefined;

  add(ms: number): void {
    this.count++;
    this.total += ms;
    if (ms > this.max) this.max = ms;
    this.recent = this.recent === undefined ? ms : this.recent + (ms - this.recent) * SMOOTHING;
  }

  average(): number {
    return this.count === 0 ? 0 : Math.round(this.total / this.count);
  }

  /** A moving average that follows a trend but shrugs off a single slow answer. Undefined before the first sample. */
  smoothed(): number | undefined {
    return this.recent;
  }
}
