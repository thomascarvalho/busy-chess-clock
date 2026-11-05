// The time controls the wheel steps through. Pure.

import type { TimeControl } from "./game.ts";

/** The remembered value that stands for the user-defined time control, whatever its minutes and increment are. */
export const CUSTOM = "custom";

/** Selected when nothing is remembered yet, or when what is remembered is not a time control any more. */
const FALLBACK = "10+0";

export function timeControl(minutes: number, incrementSeconds: number): TimeControl {
  return {
    label: `${minutes}+${incrementSeconds}`,
    baseMs: minutes * 60_000,
    incrementMs: incrementSeconds * 1000,
  };
}

export const PRESETS: readonly TimeControl[] = [
  timeControl(1, 0),
  timeControl(3, 0),
  timeControl(3, 2),
  timeControl(5, 0),
  timeControl(5, 3),
  timeControl(10, 0),
  timeControl(10, 5),
  timeControl(15, 10),
  timeControl(30, 0),
];

/** The presets, followed by the custom time control from the settings. */
export function buildControls(custom: { minutes: number; increment: number }): TimeControl[] {
  return [...PRESETS, timeControl(custom.minutes, custom.increment)];
}

/** What to remember for the time control at `index` in `controls` (as built by `buildControls`). */
export function controlValue(controls: readonly TimeControl[], index: number): string {
  return index === controls.length - 1 ? CUSTOM : controls[index]!.label;
}

/** Index in `controls` (as built by `buildControls`) for a remembered value; null when nothing is remembered. */
export function controlIndex(controls: readonly TimeControl[], value: string | null): number {
  if (value === CUSTOM) return controls.length - 1;

  const presets = controls.slice(0, controls.length - 1);
  const index = presets.findIndex((control) => control.label === value);
  return index >= 0 ? index : presets.findIndex((control) => control.label === FALLBACK);
}
