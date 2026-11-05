// The chess clock itself: phases, time accounting, increment and flag fall.
//
// Pure: no timers, no I/O, no Date. Every function takes the current timestamp, and the time a
// player has left is always derived from the difference between two timestamps, never counted in ticks.

export interface TimeControl {
  /** As shown on the bar, e.g. "5+3". */
  readonly label: string;
  /** Time each player starts with. */
  readonly baseMs: number;
  /** Added to a player's clock every time that player completes a move. */
  readonly incrementMs: number;
}

export type Phase = "setup" | "ready" | "running" | "paused" | "finished";

/** 0 is the left-hand clock, 1 the right-hand one. */
export type Player = 0 | 1;

export interface Game {
  readonly controls: readonly TimeControl[];
  /** Index of the chosen time control in `controls`. */
  readonly control: number;
  readonly phase: Phase;
  /** Whose clock runs, or would run once the game is started or resumed. Before the first move: the side that moves first. */
  readonly active: Player;
  /** What each player had left when their clock last stopped. */
  readonly banked: readonly [number, number];
  /** Timestamp the active clock was started at. Only meaningful while running. */
  readonly since: number;
  /** Half-moves completed: one per press that passed the turn. */
  readonly plies: number;
  /** The player whose time ran out. */
  readonly flagged: Player | null;
}

export type Action =
  /** The wheel, one click per unit of `delta`. */
  | { readonly type: "rotate"; readonly delta: number }
  /** The big button going down. */
  | { readonly type: "start" }
  | { readonly type: "ok" }
  | { readonly type: "back" }
  /** No input: time passed, check the flag. */
  | { readonly type: "tick" };

export function newGame(controls: readonly TimeControl[], control: number): Game {
  const { baseMs } = controls[control]!;

  return {
    controls,
    control,
    phase: "setup",
    active: 0,
    banked: [baseMs, baseMs],
    since: 0,
    plies: 0,
    flagged: null,
  };
}

/** What `player` has left at `now`, never below zero. */
export function remainingMs(game: Game, player: Player, now: number): number {
  const banked = game.banked[player];
  if (game.phase !== "running" || player !== game.active) return banked;

  // The device only has a wall clock. If it is set back mid-game, the turn costs nothing rather than handing time out.
  const elapsed = Math.max(0, now - game.since);
  return Math.max(0, banked - elapsed);
}

function withBanked(game: Game, player: Player, ms: number): readonly [number, number] {
  return player === 0 ? [ms, game.banked[1]] : [game.banked[0], ms];
}

function flag(game: Game): Game {
  return { ...game, phase: "finished", banked: withBanked(game, game.active, 0), flagged: game.active };
}

function other(player: Player): Player {
  return player === 0 ? 1 : 0;
}

function rotate(game: Game, delta: number): Game {
  const count = game.controls.length;
  const control = (((game.control + delta) % count) + count) % count;

  return control === game.control ? game : newGame(game.controls, control);
}

/**
 * The game after `action` happened at `now`.
 *
 * Returns the very same object when the action changes nothing, so callers can tell an ignored
 * input from one that needs a redraw by comparing references.
 */
export function step(game: Game, action: Action, now: number): Game {
  switch (game.phase) {
    case "setup":
      if (action.type === "rotate") return rotate(game, action.delta);
      if (action.type === "ok" || action.type === "start") return { ...game, phase: "ready" };
      return game;

    case "ready":
      // Two sides, so every click of the wheel, either way, hands the first move to the other one.
      if (action.type === "rotate") return action.delta % 2 === 0 ? game : { ...game, active: other(game.active) };
      if (action.type === "start") return { ...game, phase: "running", since: now };
      if (action.type === "back") return newGame(game.controls, game.control);
      return game;

    case "running": {
      if (action.type === "back" || action.type === "rotate") return game;

      const left = remainingMs(game, game.active, now);
      if (left <= 0) return flag(game);

      if (action.type === "start") {
        const increment = game.controls[game.control]!.incrementMs;

        return {
          ...game,
          banked: withBanked(game, game.active, left + increment),
          active: other(game.active),
          since: now,
          plies: game.plies + 1,
        };
      }

      if (action.type === "ok") {
        return { ...game, phase: "paused", banked: withBanked(game, game.active, left) };
      }

      return game;
    }

    case "paused":
      if (action.type === "ok") return { ...game, phase: "running", since: now };
      if (action.type === "back") return newGame(game.controls, game.control);
      return game;

    case "finished":
      if (action.type === "back") return newGame(game.controls, game.control);
      return game;
  }
}
