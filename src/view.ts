// What both displays show for a given game at a given moment. Pure: builds elements, sends nothing.

import type { Align, DeviceFont, DisplayElement, ImageElement, RectangleElement, TextElement } from "@shared/device";
import { formatClock, isLow } from "./format.ts";
import { remainingMs, type Game, type Phase, type Player } from "./game.ts";

// --- The LED front, 72×16

const FRONT_WIDTH = 72;

/** Each clock is centred in its own half, a little above the middle to leave room for its gauge. */
const CLOCK_X = [18, 54] as const;
const CLOCK_Y = 7;

/** A gauge is as wide as a clock reading "10:00", and sits right under it. */
export const GAUGE_WIDTH = 30;
const GAUGE_X = [3, 39] as const;
const GAUGE = { y: 13, height: 1 };

/** The five pixel columns between the two clocks: a divider, or a pause sign. */
const DIVIDER = { x: 36, y: 3, width: 1, height: 9 };
const PAUSE_X = [34, 37] as const;
const PAUSE = { y: 4, width: 2, height: 7 };

/** In setup: the knight, a gap, then the time control, centred as one group. */
const KNIGHT = { path: "appmeta/icon_front_8x8.png", size: 8, y: 4, gap: 3 };
const SETUP_Y = 8;
const ARROW_X = [4, 67] as const;
/** Every glyph the time control uses (digits and "+") advances by this much in the bold font. */
const BOLD_ADVANCE = 7;

// --- The greyscale back, 160×80; the system keeps its status icons in a column on the right edge

const BACK = { left: 4, right: 144 };
const BACK_KNIGHT = { path: "appmeta/icon_back_11x11.png", x: 4, y: 3 };
const BACK_ROW = { control: 5, state: 3, turn: 24, moves: 40, help1: 56, help2: 68 };
const BACK_CONTROL_X = 20;
/** Room for the arrow that points at the side the line is about. */
const BACK_ARROW_ROOM = 12;

export const COLORS = {
  /** The clock that is running. */
  active: "#40FF70FF",
  /** The clock that waits. */
  idle: "#FFFFFFA0",
  /** Under ten seconds, and the clock of a fallen flag. */
  low: "#FF2A2AFF",
  /** Under ten seconds, waiting; also the off phase of a flashing flag. */
  lowIdle: "#FF2A2AA0",
  /** The clock that was stopped by a pause, and the pause sign. */
  paused: "#FFB000FF",
  /** Text that carries no state: the time control. */
  plain: "#FFFFFFFF",
  /** Decoration: the wheel arrows and the divider. */
  hint: "#FFFFFF60",
  /** What a gauge has already lost. */
  track: "#FFFFFF28",
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
  setup: ["Wheel: time control", "OK: confirm   Back: quit"],
  ready: ["Wheel: who moves first", "Button: start   Back: setup"],
  running: ["Button: end your move", "OK: pause"],
  paused: ["OK: resume", "Back: new game"],
  finished: ["Back: new game"],
};

const SIDE = ["Left", "Right"] as const;

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

function box(id: string, color: string, at: { x: number; y: number; width: number; height: number }): RectangleElement {
  return {
    type: "rectangle",
    id,
    x: at.x,
    y: at.y,
    width: at.width,
    height: at.height,
    fill: "solid",
    fill_colors: [color],
    border_width: 0,
    display: "front",
  };
}

function picture(display: "front" | "back", id: string, path: string, x: number, y: number): ImageElement {
  return { type: "image", id, path, x, y, display };
}

function clockColor(game: Game, player: Player, low: boolean, flagDim: boolean): string {
  if (game.phase === "finished") {
    if (player !== game.flagged) return COLORS.idle;
    return flagDim ? COLORS.lowIdle : COLORS.low;
  }
  if (player !== game.active) return low ? COLORS.lowIdle : COLORS.idle;
  if (low) return COLORS.low;

  return game.phase === "paused" ? COLORS.paused : COLORS.active;
}

/** A clock, the track of its gauge and, while it has time left, the gauge itself. */
function clock(game: Game, player: Player, now: number, tenths: boolean, flagDim: boolean): DisplayElement[] {
  const left = remainingMs(game, player, now);
  const color = clockColor(game, player, isLow(left, tenths), flagDim);
  const span = { x: GAUGE_X[player], y: GAUGE.y, width: GAUGE_WIDTH, height: GAUGE.height };

  const elements: DisplayElement[] = [
    text("front", `clock${player}`, formatClock(left, tenths), "bold", color, CLOCK_X[player], CLOCK_Y, "center"),
    box(`track${player}`, COLORS.track, span),
  ];

  // Rounded up, so the gauge keeps a pixel until the flag; capped, since increments can exceed the starting time.
  const base = game.controls[game.control]!.baseMs;
  const filled = Math.min(GAUGE_WIDTH, Math.ceil((GAUGE_WIDTH * left) / base));
  if (filled > 0) elements.push(box(`gauge${player}`, color, { ...span, width: filled }));

  return elements;
}

/** What sits between the two clocks. */
function middle(phase: Phase): DisplayElement[] {
  if (phase === "paused") {
    return PAUSE_X.map((x, i) => box(`pause${i}`, COLORS.paused, { ...PAUSE, x }));
  }

  return [box("divider", COLORS.hint, DIVIDER)];
}

function setupFront(game: Game): DisplayElement[] {
  const label = game.controls[game.control]!.label;
  const labelWidth = label.length * BOLD_ADVANCE - 1;
  const start = Math.floor((FRONT_WIDTH - (KNIGHT.size + KNIGHT.gap + labelWidth)) / 2);

  return [
    text("front", "prev", "<", "bold", COLORS.hint, ARROW_X[0], SETUP_Y, "center"),
    picture("front", "knight", KNIGHT.path, start, KNIGHT.y),
    text("front", "control", label, "bold", COLORS.plain, start + KNIGHT.size + KNIGHT.gap, SETUP_Y, "mid_left"),
    text("front", "next", ">", "bold", COLORS.hint, ARROW_X[1], SETUP_Y, "center"),
  ];
}

function front(game: Game, now: number, tenths: boolean, flagDim: boolean): DisplayElement[] {
  if (game.phase === "setup") return setupFront(game);

  return [...clock(game, 0, now, tenths, flagDim), ...clock(game, 1, now, tenths, flagDim), ...middle(game.phase)];
}

/** The line that says whose turn, first move or loss it is, pushed to that player's side with an arrow. */
function turnLine(game: Game): DisplayElement[] {
  if (game.phase === "setup") {
    return [text("back", "b-turn", "Pick a time control", "large", BACK_BRIGHT, BACK.left, BACK_ROW.turn, "top_left")];
  }

  const player = game.flagged ?? game.active;
  const what = game.phase === "finished" ? "lost on time" : game.phase === "ready" ? "moves first" : "to move";
  const line = `${SIDE[player]} ${what}`;

  if (player === 0) {
    return [
      text("back", "b-arrow", "<", "large", BACK_BRIGHT, BACK.left, BACK_ROW.turn, "top_left"),
      text("back", "b-turn", line, "large", BACK_BRIGHT, BACK.left + BACK_ARROW_ROOM, BACK_ROW.turn, "top_left"),
    ];
  }

  return [
    text("back", "b-arrow", ">", "large", BACK_BRIGHT, BACK.right, BACK_ROW.turn, "top_right"),
    text("back", "b-turn", line, "large", BACK_BRIGHT, BACK.right - BACK_ARROW_ROOM, BACK_ROW.turn, "top_right"),
  ];
}

function back(game: Game): DisplayElement[] {
  const { phase } = game;
  const label = game.controls[game.control]!.label;

  const elements: DisplayElement[] = [
    picture("back", "b-knight", BACK_KNIGHT.path, BACK_KNIGHT.x, BACK_KNIGHT.y),
    text("back", "b-control", label, "bold", BACK_BRIGHT, BACK_CONTROL_X, BACK_ROW.control, "top_left"),
    // The extra-large font only has capitals.
    text("back", "b-state", STATE[phase], "extra_large", BACK_BRIGHT, BACK.right, BACK_ROW.state, "top_right"),
    ...turnLine(game),
  ];

  if (phase === "running" || phase === "paused" || phase === "finished") {
    // A move is one turn by each player, as on a scoresheet.
    const move = Math.floor(game.plies / 2) + 1;
    elements.push(text("back", "b-moves", `Move ${move}`, "normal", BACK_BRIGHT, BACK.left, BACK_ROW.moves, "top_left"));
  }

  const help = HELP[phase];
  elements.push(text("back", "b-help1", help[0]!, "normal", BACK_DIM, BACK.left, BACK_ROW.help1, "top_left"));
  if (help[1] !== undefined) {
    elements.push(text("back", "b-help2", help[1], "normal", BACK_DIM, BACK.left, BACK_ROW.help2, "top_left"));
  }

  return elements;
}

/**
 * Everything both displays should show at `now`.
 * @param tenths - Whether the last ten seconds are drawn in tenths.
 * @param flagDim - Draws the clock of a fallen flag dimmed: the off phase of its flash.
 */
export function frame(game: Game, now: number, tenths: boolean, flagDim = false): DisplayElement[] {
  return [...front(game, now, tenths, flagDim), ...back(game)];
}
