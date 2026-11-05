// Device keys → game actions. Pure.

import type { Action } from "./game.ts";

/**
 * The action a key event stands for, or null when the event is not one the app reacts to.
 *
 * The big button acts on `press`, the moment it goes down: a player's clock must stop when the
 * button is hit, not when the finger lifts. The `short` that follows on release is dropped, so one
 * push is one move. The wheel click and Back are ordinary buttons and act on `short`.
 */
export function toAction(event: BusyInputEvent): Action | null {
  if (event.key === "encoder") return { type: "rotate", delta: event.delta };
  if (event.key === "start") return event.action === "press" ? { type: "start" } : null;
  if (event.action !== "short") return null;

  return event.key === "ok" ? { type: "ok" } : { type: "back" };
}
