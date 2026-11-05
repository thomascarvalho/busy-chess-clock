import assert from "node:assert/strict";
import { test } from "node:test";
import { newGame, remainingMs, step, type Game, type TimeControl } from "../src/game.ts";

const BLITZ: TimeControl = { label: "3+2", baseMs: 180_000, incrementMs: 2_000 };
const RAPID: TimeControl = { label: "10+0", baseMs: 600_000, incrementMs: 0 };
const BULLET: TimeControl = { label: "1+0", baseMs: 60_000, incrementMs: 0 };
const CONTROLS = [BULLET, BLITZ, RAPID];

/** An arbitrary wall-clock origin, so no test depends on timestamps starting at zero. */
const T0 = 1_700_000_000_000;

function setup(): Game {
  return newGame(CONTROLS, 1);
}

function ready(): Game {
  return step(setup(), { type: "ok" }, T0);
}

/** A game whose first clock started at T0. */
function running(): Game {
  return step(ready(), { type: "start" }, T0);
}

test("a new game is in setup with both clocks at the chosen time control", () => {
  const game = setup();

  assert.equal(game.phase, "setup");
  assert.equal(game.controls[game.control], BLITZ);
  assert.equal(remainingMs(game, 0, T0), 180_000);
  assert.equal(remainingMs(game, 1, T0), 180_000);
  assert.equal(game.plies, 0);
  assert.equal(game.flagged, null);
});

test("the wheel steps through the time controls in setup", () => {
  const next = step(setup(), { type: "rotate", delta: 1 }, T0);

  assert.equal(next.controls[next.control], RAPID);
  assert.equal(remainingMs(next, 0, T0), 600_000);
  assert.equal(remainingMs(next, 1, T0), 600_000);
});

test("the wheel wraps around at both ends of the list", () => {
  const last = step(setup(), { type: "rotate", delta: 1 }, T0);
  const wrapped = step(last, { type: "rotate", delta: 1 }, T0);
  const back = step(wrapped, { type: "rotate", delta: -1 }, T0);

  assert.equal(wrapped.controls[wrapped.control], BULLET);
  assert.equal(back.controls[back.control], RAPID);
});

test("the wheel does nothing once the game has started", () => {
  const paused = step(running(), { type: "ok" }, T0 + 100);
  const finished = step(running(), { type: "tick" }, T0 + 180_000);

  for (const game of [running(), paused, finished]) {
    assert.equal(step(game, { type: "rotate", delta: 1 }, T0 + 500), game);
  }
});

test("once ready, the wheel picks which side moves first", () => {
  const right = step(ready(), { type: "rotate", delta: 1 }, T0);

  assert.equal(right.phase, "ready");
  assert.equal(right.active, 1);
  assert.equal(step(right, { type: "rotate", delta: 1 }, T0).active, 0);
  assert.equal(step(right, { type: "rotate", delta: -1 }, T0).active, 0);
  assert.equal(step(ready(), { type: "rotate", delta: -1 }, T0).active, 1);
});

test("picking a side starts no clock and touches no time", () => {
  const right = step(ready(), { type: "rotate", delta: 1 }, T0);

  assert.equal(remainingMs(right, 0, T0 + 5_000), 180_000);
  assert.equal(remainingMs(right, 1, T0 + 5_000), 180_000);
  assert.equal(right.plies, 0);
});

test("start runs the clock of the side that was picked", () => {
  const right = step(ready(), { type: "rotate", delta: 1 }, T0);
  const game = step(right, { type: "start" }, T0);

  assert.equal(game.phase, "running");
  assert.equal(game.active, 1);
  assert.equal(remainingMs(game, 1, T0 + 2_000), 178_000);
  assert.equal(remainingMs(game, 0, T0 + 2_000), 180_000);
});

test("when the right side moves first, its first press hands the move to the left", () => {
  const right = step(ready(), { type: "rotate", delta: 1 }, T0);
  const game = step(step(right, { type: "start" }, T0), { type: "start" }, T0 + 3_000);

  assert.equal(game.active, 0);
  assert.equal(game.plies, 1);
  assert.equal(remainingMs(game, 1, T0 + 3_000), 179_000);
});

test("a new game starts from the left again, whatever was picked before", () => {
  const right = step(ready(), { type: "rotate", delta: 1 }, T0);
  const again = step(step(right, { type: "back" }, T0), { type: "ok" }, T0);

  assert.equal(again.phase, "ready");
  assert.equal(again.active, 0);
});

test("ok confirms the time control and gets the game ready", () => {
  assert.equal(ready().phase, "ready");
});

test("start in setup also gets the game ready, without starting a clock", () => {
  const game = step(setup(), { type: "start" }, T0);

  assert.equal(game.phase, "ready");
  assert.equal(remainingMs(game, 0, T0 + 5_000), 180_000);
});

test("start from ready runs the first player's clock only", () => {
  const game = running();

  assert.equal(game.phase, "running");
  assert.equal(game.active, 0);
  assert.equal(remainingMs(game, 0, T0 + 1_500), 178_500);
  assert.equal(remainingMs(game, 1, T0 + 1_500), 180_000);
});

test("a press stops the active clock, adds the increment and starts the other one", () => {
  const game = step(running(), { type: "start" }, T0 + 4_000);

  assert.equal(game.active, 1);
  assert.equal(game.plies, 1);
  // 180 s - 4 s + 2 s increment, frozen from now on.
  assert.equal(remainingMs(game, 0, T0 + 9_000), 178_000);
  assert.equal(remainingMs(game, 1, T0 + 9_000), 175_000);
});

test("time is the difference between press timestamps, however irregular", () => {
  let game = running();
  game = step(game, { type: "start" }, T0 + 1_234);
  game = step(game, { type: "start" }, T0 + 1_234 + 7_001);
  game = step(game, { type: "start" }, T0 + 1_234 + 7_001 + 333);

  assert.equal(game.active, 1);
  assert.equal(game.plies, 3);
  assert.equal(remainingMs(game, 0, T0 + 60_000), 180_000 - 1_234 + 2_000 - 333 + 2_000);
  assert.equal(remainingMs(game, 1, T0 + 1_234 + 7_001 + 333), 180_000 - 7_001 + 2_000);
});

test("ok pauses the running clock and ok again resumes it without charging the pause", () => {
  const paused = step(running(), { type: "ok" }, T0 + 10_000);

  assert.equal(paused.phase, "paused");
  assert.equal(remainingMs(paused, 0, T0 + 99_000), 170_000);

  const resumed = step(paused, { type: "ok" }, T0 + 100_000);

  assert.equal(resumed.phase, "running");
  assert.equal(resumed.active, 0);
  assert.equal(remainingMs(resumed, 0, T0 + 101_000), 169_000);
});

test("pausing adds no increment and counts no move", () => {
  const paused = step(running(), { type: "ok" }, T0 + 10_000);

  assert.equal(paused.plies, 0);
  assert.equal(remainingMs(paused, 0, T0 + 10_000), 170_000);
});

test("start is ignored while paused", () => {
  const paused = step(running(), { type: "ok" }, T0 + 10_000);

  assert.equal(step(paused, { type: "start" }, T0 + 11_000), paused);
});

test("back is ignored while a clock is running", () => {
  const game = running();

  assert.equal(step(game, { type: "back" }, T0 + 1_000), game);
});

test("back from pause returns to setup with fresh clocks and the same time control", () => {
  let game = step(running(), { type: "start" }, T0 + 4_000);
  game = step(game, { type: "ok" }, T0 + 6_000);
  game = step(game, { type: "back" }, T0 + 7_000);

  assert.equal(game.phase, "setup");
  assert.equal(game.controls[game.control], BLITZ);
  assert.equal(game.plies, 0);
  assert.equal(game.active, 0);
  assert.equal(remainingMs(game, 0, T0 + 7_000), 180_000);
  assert.equal(remainingMs(game, 1, T0 + 7_000), 180_000);
});

test("back from ready returns to setup", () => {
  assert.equal(step(ready(), { type: "back" }, T0).phase, "setup");
});

test("back in setup leaves the game untouched: leaving the app is the caller's business", () => {
  const game = setup();

  assert.equal(step(game, { type: "back" }, T0), game);
});

test("a tick before the flag changes nothing", () => {
  const game = running();

  assert.equal(step(game, { type: "tick" }, T0 + 179_999), game);
});

test("the flag falls when the active clock reaches zero", () => {
  const game = step(running(), { type: "tick" }, T0 + 180_000);

  assert.equal(game.phase, "finished");
  assert.equal(game.flagged, 0);
  assert.equal(remainingMs(game, 0, T0 + 999_000), 0);
  assert.equal(remainingMs(game, 1, T0 + 999_000), 180_000);
});

test("a running clock never reads below zero, even before the flag is noticed", () => {
  assert.equal(remainingMs(running(), 0, T0 + 200_000), 0);
});

test("a press that comes after the time ran out flags the player instead of switching", () => {
  const game = step(running(), { type: "start" }, T0 + 180_001);

  assert.equal(game.phase, "finished");
  assert.equal(game.flagged, 0);
  assert.equal(game.active, 0);
  assert.equal(game.plies, 0);
  assert.equal(remainingMs(game, 0, T0 + 180_001), 0);
});

test("a pause that comes after the time ran out flags the player", () => {
  const game = step(running(), { type: "ok" }, T0 + 180_001);

  assert.equal(game.phase, "finished");
  assert.equal(game.flagged, 0);
});

test("start and ok are ignored once the game is finished", () => {
  const finished = step(running(), { type: "tick" }, T0 + 180_000);

  assert.equal(step(finished, { type: "start" }, T0 + 181_000), finished);
  assert.equal(step(finished, { type: "ok" }, T0 + 181_000), finished);
});

test("back from a finished game returns to setup", () => {
  const finished = step(running(), { type: "tick" }, T0 + 180_000);
  const game = step(finished, { type: "back" }, T0 + 190_000);

  assert.equal(game.phase, "setup");
  assert.equal(game.flagged, null);
  assert.equal(remainingMs(game, 0, T0 + 190_000), 180_000);
});

test("a wall clock that jumps backwards never gives time back", () => {
  const game = running();

  assert.equal(remainingMs(game, 0, T0 - 60_000), 180_000);

  const next = step(game, { type: "start" }, T0 - 60_000);

  assert.equal(remainingMs(next, 0, T0), 182_000);
});

test("the increment is added to the player who just moved, not the opponent", () => {
  let game = running();
  game = step(game, { type: "start" }, T0 + 1_000);
  game = step(game, { type: "start" }, T0 + 2_000);

  assert.equal(remainingMs(game, 1, T0 + 2_000), 181_000);
  assert.equal(remainingMs(game, 0, T0 + 2_000), 181_000);
});
