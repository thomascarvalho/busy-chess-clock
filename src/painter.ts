// Sends frames to the device: only the elements that differ from what is on screen, and never
// more than the device can work through.

import type { DisplayElement } from "@shared/device";

/** Where frames go. Both calls return at once; the painter is told when the device answers through `settled`. */
export interface Screen {
  draw(elements: DisplayElement[]): void;
  clear(ids: string[]): void;
}

export class Painter {
  private readonly screen: Screen;
  /** What the device was last sent for each id, serialized. */
  private shown = new Map<string, string>();
  /** Requests sent and not answered yet. */
  private inFlight = 0;
  /** The newest frame asked for while the device was busy. */
  private held: DisplayElement[] | undefined;
  private stopped = false;

  constructor(screen: Screen) {
    this.screen = screen;
  }

  /** Whether the device is still working on an earlier frame. */
  busy(): boolean {
    return this.inFlight > 0;
  }

  /**
   * Puts `elements` on screen: the whole frame as it should look, not a delta.
   *
   * The device answers one request at a time and takes its time, so queueing frames would only
   * make every one of them later. While it is busy the newest frame is held and the ones in
   * between are dropped.
   */
  paint(elements: DisplayElement[]): void {
    if (this.stopped) return;

    if (this.inFlight > 0) {
      this.held = elements;
      return;
    }

    const next = new Map<string, string>();
    const changed: DisplayElement[] = [];

    for (const element of elements) {
      const serialized = JSON.stringify(element);
      if (this.shown.get(element.id) !== serialized) changed.push(element);
      next.set(element.id, serialized);
    }

    const stale: string[] = [];
    this.shown.forEach((_, id) => {
      if (!next.has(id)) stale.push(id);
    });

    this.shown = next;

    // Both at once: neither names an element the other does, so their order does not matter.
    if (changed.length > 0) {
      this.inFlight++;
      this.screen.draw(changed);
    }
    if (stale.length > 0) {
      this.inFlight++;
      this.screen.clear(stale);
    }
  }

  /**
   * To be called once for every `draw` and `clear` the screen was handed, when the device answered.
   *
   * After a failure the screen is in an unknown state: the next frame is sent in full. It is not
   * sent from here, so a device in trouble is not hammered; when to try again is up to the caller.
   */
  settled(failed: boolean): void {
    if (this.inFlight > 0) this.inFlight--;

    if (failed) {
      this.shown = new Map();
      this.held = undefined;
    }

    if (this.stopped || this.inFlight > 0 || this.held === undefined) return;

    const frame = this.held;
    this.held = undefined;
    this.paint(frame);
  }

  /**
   * Tells the painter the device may have dropped what it was showing. The next frame is sent in
   * full, and elements that are no longer part of it are still cleared, in case they survived.
   */
  invalidate(): void {
    this.shown.forEach((_, id) => this.shown.set(id, ""));
  }

  /** Nothing is sent from now on, including a frame that was being held. */
  stop(): void {
    this.stopped = true;
    this.held = undefined;
  }
}
