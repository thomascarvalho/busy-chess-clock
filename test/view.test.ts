import assert from "node:assert/strict";
import { test } from "node:test";
import type { DisplayElement, TextElement } from "../shared/device.ts";
import { newGame, step, type Game } from "../src/game.ts";
import { buildControls } from "../src/timeControls.ts";
import { COLORS, frame } from "../src/view.ts";

const T0 = 1_700_000_000_000;
const CONTROLS = buildControls({ minutes: 7, increment: 3 });
/** 3+2 */
const BLITZ = 2;

function setup(): Game {
  return newGame(CONTROLS, BLITZ);
}

function running(): Game {
  return step(step(setup(), { type: "ok" }, T0), { type: "start" }, T0);
}

function text(elements: DisplayElement[], id: string): TextElement {
  const element = elements.find((candidate) => candidate.id === id);
  assert.ok(element, `no element "${id}"`);
  assert.equal(element.type, "text");
  return element as TextElement;
}

function ids(elements: DisplayElement[], display: "front" | "back"): string[] {
  return elements.filter((element) => element.display === display).map((element) => element.id);
}

function backTexts(elements: DisplayElement[]): string[] {
  return elements
    .filter((element): element is TextElement => element.display === "back" && element.type === "text")
    .map((element) => element.text);
}

test("in setup the front shows the time control and no clocks", () => {
  const elements = frame(setup(), T0, true);

  assert.equal(text(elements, "control").text, "3+2");
  assert.deepEqual(ids(elements, "front"), ["control"]);
});

test("once ready the front shows both clocks, the first player on the left", () => {
  const elements = frame(step(setup(), { type: "ok" }, T0), T0, true);
  const left = text(elements, "clock0");
  const right = text(elements, "clock1");

  assert.equal(left.text, "3:00");
  assert.equal(right.text, "3:00");
  assert.ok(left.x < right.x);
  assert.deepEqual(ids(elements, "front").sort(), ["clock0", "clock1"]);
});

test("the running clock is bright and counts down, the other is dimmed and frozen", () => {
  const elements = frame(running(), T0 + 61_000, true);

  assert.equal(text(elements, "clock0").text, "1:59");
  assert.equal(text(elements, "clock0").color, COLORS.active);
  assert.equal(text(elements, "clock1").text, "3:00");
  assert.equal(text(elements, "clock1").color, COLORS.idle);
});

test("after a press the brightness moves to the other clock", () => {
  const game = step(running(), { type: "start" }, T0 + 5_000);
  const elements = frame(game, T0 + 6_000, true);

  assert.equal(text(elements, "clock0").color, COLORS.idle);
  assert.equal(text(elements, "clock1").color, COLORS.active);
});

test("a running clock under ten seconds turns red and shows tenths", () => {
  const elements = frame(running(), T0 + 172_550, true);

  assert.equal(text(elements, "clock0").text, "7.4");
  assert.equal(text(elements, "clock0").color, COLORS.low);
});

test("without tenths a low clock stays in whole seconds", () => {
  const elements = frame(running(), T0 + 172_550, false);

  assert.equal(text(elements, "clock0").text, "0:08");
  assert.equal(text(elements, "clock0").color, COLORS.low);
});

test("a waiting clock under ten seconds is a dimmed red", () => {
  // The first player burns down to 5 s, gets 2 s of increment, and now waits on 7 s.
  const game = step(running(), { type: "start" }, T0 + 175_000);
  const elements = frame(game, T0 + 176_000, true);

  assert.equal(text(elements, "clock0").text, "7.0");
  assert.equal(text(elements, "clock0").color, COLORS.lowIdle);
});

test("while paused the stopped clock is marked, and nothing counts down", () => {
  const game = step(running(), { type: "ok" }, T0 + 10_000);
  const elements = frame(game, T0 + 500_000, true);

  assert.equal(text(elements, "clock0").text, "2:50");
  assert.equal(text(elements, "clock0").color, COLORS.paused);
  assert.equal(text(elements, "clock1").color, COLORS.idle);
});

test("on a fallen flag the loser's clock reads zero in red", () => {
  const game = step(running(), { type: "tick" }, T0 + 180_000);
  const elements = frame(game, T0 + 181_000, true);

  assert.equal(text(elements, "clock0").text, "0.0");
  assert.equal(text(elements, "clock0").color, COLORS.low);
  assert.equal(text(elements, "clock1").color, COLORS.idle);
});

test("the back shows the time control, the state and the controls that apply", () => {
  const texts = backTexts(frame(setup(), T0, true));

  assert.ok(texts.includes("3+2"));
  assert.ok(texts.includes("SETUP"));
  assert.ok(texts.some((line) => line.includes("WHEEL")));
});

test("the back names each state of the game", () => {
  const ready = step(setup(), { type: "ok" }, T0);
  const play = step(ready, { type: "start" }, T0);
  const paused = step(play, { type: "ok" }, T0 + 1_000);
  const finished = step(play, { type: "tick" }, T0 + 180_000);

  assert.ok(backTexts(frame(ready, T0, true)).includes("READY"));
  assert.ok(backTexts(frame(play, T0, true)).includes("RUNNING"));
  assert.ok(backTexts(frame(paused, T0 + 1_000, true)).includes("PAUSED"));
  assert.ok(backTexts(frame(finished, T0 + 180_000, true)).includes("FINISHED"));
});

test("the back counts moves the way a scoresheet does: one per pair of presses", () => {
  let game = running();
  assert.ok(backTexts(frame(game, T0, true)).includes("MOVE 1"));

  game = step(game, { type: "start" }, T0 + 1_000);
  assert.ok(backTexts(frame(game, T0 + 1_000, true)).includes("MOVE 1"));

  game = step(game, { type: "start" }, T0 + 2_000);
  assert.ok(backTexts(frame(game, T0 + 2_000, true)).includes("MOVE 2"));
});

test("the back says who lost on time", () => {
  const whiteFlagged = step(running(), { type: "tick" }, T0 + 180_000);
  assert.ok(backTexts(frame(whiteFlagged, T0 + 180_000, true)).some((line) => line.includes("LEFT")));

  const blackToMove = step(running(), { type: "start" }, T0 + 1_000);
  const blackFlagged = step(blackToMove, { type: "tick" }, T0 + 181_000);
  assert.ok(backTexts(frame(blackFlagged, T0 + 181_000, true)).some((line) => line.includes("RIGHT")));
});

test("every element is one the device accepts: unique id, printable ASCII, a display", () => {
  const ready = step(setup(), { type: "ok" }, T0);
  const play = step(ready, { type: "start" }, T0);
  const games = [setup(), ready, play, step(play, { type: "ok" }, T0 + 1), step(play, { type: "tick" }, T0 + 180_000)];

  for (const game of games) {
    const elements = frame(game, T0 + 180_000, true);
    const seen = new Set(elements.map((element) => element.id));

    assert.equal(seen.size, elements.length, `duplicate id in ${game.phase}`);

    for (const element of elements) {
      assert.match(element.id, /^[a-zA-Z0-9._-]+$/);
      assert.ok(element.display === "front" || element.display === "back");
      if (element.type === "text") assert.match(element.text, /^[\x20-\x7E]+$/, `${element.id} in ${game.phase}`);
    }
  }
});

test("the back keeps clear of the system's status column on its right edge", () => {
  const ready = step(setup(), { type: "ok" }, T0);
  const play = step(ready, { type: "start" }, T0);
  const games = [setup(), ready, play, step(play, { type: "ok" }, T0 + 1), step(play, { type: "tick" }, T0 + 180_000)];

  for (const game of games) {
    for (const element of frame(game, T0 + 180_000, true)) {
      if (element.display === "back") assert.ok(element.x <= 144, `${element.id} at x=${element.x} in ${game.phase}`);
    }
  }
});

test("once ready, the side that moves first is lit and the other is dimmed", () => {
  const left = step(setup(), { type: "ok" }, T0);
  const right = step(left, { type: "rotate", delta: 1 }, T0);

  assert.equal(text(frame(left, T0, true), "clock0").color, COLORS.active);
  assert.equal(text(frame(left, T0, true), "clock1").color, COLORS.idle);
  assert.equal(text(frame(right, T0, true), "clock0").color, COLORS.idle);
  assert.equal(text(frame(right, T0, true), "clock1").color, COLORS.active);
});

test("once ready, the back says which side moves first and that the wheel changes it", () => {
  const left = step(setup(), { type: "ok" }, T0);
  const right = step(left, { type: "rotate", delta: 1 }, T0);

  assert.ok(backTexts(frame(left, T0, true)).includes("LEFT MOVES FIRST"));
  assert.ok(backTexts(frame(right, T0, true)).includes("RIGHT MOVES FIRST"));
  assert.ok(backTexts(frame(left, T0, true)).some((line) => line.includes("WHEEL")));
});
