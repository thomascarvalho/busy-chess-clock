// Remembers the time control of the last game across launches.

/** The part of the runtime's `localStorage` this needs. */
export interface KeyValueStore {
  getItem(key: string): string | null | undefined;
  setItem(key: string, value: string): void;
}

const KEY = "last_control";

export class LastControl {
  private readonly store: KeyValueStore | undefined;
  /** What the store is known to hold, so an unchanged choice is not written again. */
  private known: string | null = null;

  /** @param store - The runtime's `localStorage`, or undefined where there is none. */
  constructor(store: KeyValueStore | undefined) {
    this.store = store;
  }

  /** The remembered value, or null when there is none or the store cannot be read. */
  load(): string | null {
    if (this.store === undefined) return null;

    try {
      const value = this.store.getItem(KEY);
      this.known = typeof value === "string" ? value : null;
    } catch {
      this.known = null;
    }

    return this.known;
  }

  /**
   * Remembers `value`. Every write rewrites a file on the device's flash, so nothing is written
   * when the value is already the one stored.
   * @returns An error message when the store refused the write, undefined otherwise.
   */
  save(value: string): string | undefined {
    if (this.store === undefined || value === this.known) return undefined;

    try {
      this.store.setItem(KEY, value);
      this.known = value;
      return undefined;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }
}
