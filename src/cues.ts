// Which sound, if any, a change in the game calls for. Pure.

import type { Game } from "./game.ts";

export type Cue = "flag" | "low";

/**
 * @param before - The game before the last action or tick.
 * @param after - The game after it.
 * @param wasLow - Whether the running clock displayed under ten seconds the last time this was asked.
 * @param low - Whether it does now.
 */
export function cueFor(
  before: Game,
  after: Game,
  wasLow: boolean,
  low: boolean,
  settings: { sound: boolean; lowTimeBeep: boolean },
): Cue | null {
  if (!settings.sound) return null;

  if (after.phase === "finished") return before.phase === "finished" ? null : "flag";

  // Only a clock that crosses the mark while it runs beeps: a turn handed to a player who is already
  // low, or a pause lifted on a low clock, would otherwise beep on every move of a time scramble.
  const sameTurn = before.phase === "running" && after.phase === "running" && before.active === after.active;

  return settings.lowTimeBeep && sameTurn && low && !wasLow ? "low" : null;
}
