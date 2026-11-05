// What both displays show for a given game at a given moment. Pure: builds elements, sends nothing.

import type { Align, DeviceFont, DisplayElement, TextElement } from "@shared/device";
import { formatClock, isLow } from "./format.ts";
import { remainingMs, type Game, type Phase, type Player } from "./game.ts";

/** The LED front is 72×16: each clock is centred in its own half. */
const CLOCK_X = [18, 54] as const;
const FRONT_MID = { x: 36, y: 8 };

/** The greyscale back is 160×80; the system keeps its status icons in a column on the right edge. */
const BACK = { left: 4, right: 144 };
const BACK_ROW = { title: 6, moves: 24, result: 38, help1: 54, help2: 66 };

export const COLORS = {
  /** The clock that is running. */
  active: "#40FF70FF",
  /** The clock that waits. */
  idle: "#FFFFFFA0",
  /** Under ten seconds, and the clock of a fallen flag. */
  low: "#FF2A2AFF",
  /** Under ten seconds, waiting. */
  lowIdle: "#FF2A2AA0",
  /** The clock that was stopped by a pause. */
  paused: "#FFB000FF",
  /** Text that carries no state: the time control. */
  plain: "#FFFFFFFF",
} as const;

const BACK_BRIGHT = "#FFFFFFFF";
const BACK_DIM = "#FFFFFF90";

const STATE: Record<Phase, string> = {
  setup: "SETUP",
  ready: "READY",
  running: "RUNNING",
  paused: "PAUSED",
  finished: "FINISHED",
};

/** The controls that do something in each phase, at most two lines. */
const HELP: Record<Phase, readonly string[]> = {
  setup: ["WHEEL: TIME CONTROL", "OK: CONFIRM  BACK: QUIT"],
  ready: ["BUTTON: START  BACK: SETUP", "WHEEL: WHO MOVES FIRST"],
  running: ["BUTTON: END YOUR MOVE", "OK: PAUSE"],
  paused: ["OK: RESUME", "BACK: NEW GAME"],
  finished: ["BACK: NEW GAME"],
};

const SIDE = ["LEFT", "RIGHT"] as const;

function text(
  display: "front" | "back",
  id: string,
  value: string,
  font: DeviceFont,
  color: string,
  x: number,
  y: number,
  align: Align,
): TextElement {
  return { type: "text", id, text: value, font, color, x, y, align, display };
}

function clockColor(game: Game, player: Player, low: boolean): string {
  if (game.phase === "finished") return player === game.flagged ? COLORS.low : COLORS.idle;
  if (player !== game.active) return low ? COLORS.lowIdle : COLORS.idle;
  if (low) return COLORS.low;

  return game.phase === "paused" ? COLORS.paused : COLORS.active;
}

function clock(game: Game, player: Player, now: number, tenths: boolean): TextElement {
  const left = remainingMs(game, player, now);
  const color = clockColor(game, player, isLow(left, tenths));

  return text("front", `clock${player}`, formatClock(left, tenths), "bold", color, CLOCK_X[player], FRONT_MID.y, "center");
}

function front(game: Game, now: number, tenths: boolean): DisplayElement[] {
  if (game.phase === "setup") {
    const label = game.controls[game.control]!.label;
    return [text("front", "control", label, "bold", COLORS.plain, FRONT_MID.x, FRONT_MID.y, "center")];
  }

  return [clock(game, 0, now, tenths), clock(game, 1, now, tenths)];
}

function back(game: Game): DisplayElement[] {
  const { phase } = game;
  const label = game.controls[game.control]!.label;

  const elements: DisplayElement[] = [
    text("back", "b-control", label, "bold", BACK_BRIGHT, BACK.left, BACK_ROW.title, "top_left"),
    text("back", "b-state", STATE[phase], "bold", BACK_BRIGHT, BACK.right, BACK_ROW.title, "top_right"),
  ];

  if (phase === "ready") {
    const first = `${SIDE[game.active]} MOVES FIRST`;
    elements.push(text("back", "b-first", first, "normal", BACK_BRIGHT, BACK.left, BACK_ROW.moves, "top_left"));
  }

  if (phase === "running" || phase === "paused" || phase === "finished") {
    // A move is one turn by each player, as on a scoresheet.
    const move = Math.floor(game.plies / 2) + 1;
    elements.push(text("back", "b-moves", `MOVE ${move}`, "normal", BACK_BRIGHT, BACK.left, BACK_ROW.moves, "top_left"));
  }

  if (game.flagged !== null) {
    const result = `${SIDE[game.flagged]} LOST ON TIME`;
    elements.push(text("back", "b-result", result, "normal", BACK_BRIGHT, BACK.left, BACK_ROW.result, "top_left"));
  }

  const help = HELP[phase];
  elements.push(text("back", "b-help1", help[0]!, "small", BACK_DIM, BACK.left, BACK_ROW.help1, "top_left"));
  if (help[1] !== undefined) {
    elements.push(text("back", "b-help2", help[1], "small", BACK_DIM, BACK.left, BACK_ROW.help2, "top_left"));
  }

  return elements;
}

/**
 * Everything both displays should show at `now`.
 * @param tenths - Whether the last ten seconds are drawn in tenths.
 */
export function frame(game: Game, now: number, tenths: boolean): DisplayElement[] {
  return [...front(game, now, tenths), ...back(game)];
}
