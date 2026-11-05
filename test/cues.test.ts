import assert from "node:assert/strict";
import { test } from "node:test";
import { cueFor } from "../src/cues.ts";
import { newGame, step, type Game, type TimeControl } from "../src/game.ts";

const T0 = 1_700_000_000_000;
const BLITZ: TimeControl = { label: "3+2", baseMs: 180_000, incrementMs: 2_000 };
const ALL_ON = { sound: true, lowTimeBeep: true };

function running(): Game {
  const ready = step(newGame([BLITZ], 0), { type: "ok" }, T0);
  return step(ready, { type: "start" }, T0);
}

test("the flag sound plays when the game finishes", () => {
  const before = running();
  const after = step(before, { type: "tick" }, T0 + 180_000);

  assert.equal(cueFor(before, after, true, true, ALL_ON), "flag");
});

test("the low-time beep plays when the running clock drops under ten seconds", () => {
  const game = running();

  assert.equal(cueFor(game, game, false, true, ALL_ON), "low");
});

test("there is no beep while the clock simply stays low", () => {
  const game = running();

  assert.equal(cueFor(game, game, true, true, ALL_ON), null);
});

test("there is no beep when the turn passes to a player who is already low", () => {
  const before = running();
  const after = step(before, { type: "start" }, T0 + 1_000);

  assert.equal(cueFor(before, after, false, true, ALL_ON), null);
});

test("there is no beep when a low clock is resumed after a pause", () => {
  const paused = step(running(), { type: "ok" }, T0 + 175_000);
  const resumed = step(paused, { type: "ok" }, T0 + 200_000);

  assert.equal(cueFor(paused, resumed, false, true, ALL_ON), null);
});

test("ordinary moves are silent", () => {
  const before = running();
  const after = step(before, { type: "start" }, T0 + 1_000);

  assert.equal(cueFor(before, after, false, false, ALL_ON), null);
});

test("the low-time beep can be switched off on its own", () => {
  const game = running();
  const flagged = step(game, { type: "tick" }, T0 + 180_000);
  const settings = { sound: true, lowTimeBeep: false };

  assert.equal(cueFor(game, game, false, true, settings), null);
  assert.equal(cueFor(game, flagged, true, true, settings), "flag");
});

test("with sound off nothing plays at all", () => {
  const game = running();
  const flagged = step(game, { type: "tick" }, T0 + 180_000);
  const settings = { sound: false, lowTimeBeep: true };

  assert.equal(cueFor(game, game, false, true, settings), null);
  assert.equal(cueFor(game, flagged, true, true, settings), null);
});
