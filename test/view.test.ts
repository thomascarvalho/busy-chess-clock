import assert from "node:assert/strict";
import { test } from "node:test";
import type { DisplayElement, ImageElement, RectangleElement, TextElement } from "../shared/device.ts";
import { newGame, step, type Game } from "../src/game.ts";
import { buildControls } from "../src/timeControls.ts";
import { COLORS, frame, GAUGE_WIDTH } from "../src/view.ts";

const T0 = 1_700_000_000_000;
const CONTROLS = buildControls({ minutes: 7, increment: 3 });
/** 3+2 */
const BLITZ = 2;

function setup(): Game {
  return newGame(CONTROLS, BLITZ);
}

function ready(): Game {
  return step(setup(), { type: "ok" }, T0);
}

function running(): Game {
  return step(ready(), { type: "start" }, T0);
}

function find(elements: DisplayElement[], id: string): DisplayElement | undefined {
  return elements.find((candidate) => candidate.id === id);
}

function text(elements: DisplayElement[], id: string): TextElement {
  const element = find(elements, id);
  assert.ok(element, `no element "${id}"`);
  assert.equal(element.type, "text");
  return element as TextElement;
}

function rectangle(elements: DisplayElement[], id: string): RectangleElement {
  const element = find(elements, id);
  assert.ok(element, `no element "${id}"`);
  assert.equal(element.type, "rectangle");
  return element as RectangleElement;
}

function image(elements: DisplayElement[], id: string): ImageElement {
  const element = find(elements, id);
  assert.ok(element, `no element "${id}"`);
  assert.equal(element.type, "image");
  return element as ImageElement;
}

function ids(elements: DisplayElement[], display: "front" | "back"): string[] {
  return elements.filter((element) => element.display === display).map((element) => element.id);
}

function backTexts(elements: DisplayElement[]): string[] {
  return elements
    .filter((element): element is TextElement => element.display === "back" && element.type === "text")
    .map((element) => element.text);
}

/** Every phase of a game, for the checks that must hold whatever is on screen. */
function everyPhase(): Game[] {
  const play = running();
  return [setup(), ready(), play, step(play, { type: "ok" }, T0 + 1), step(play, { type: "tick" }, T0 + 180_000)];
}

// --- Front: setup

test("in setup the front shows the knight next to the time control, and no clocks", () => {
  const elements = frame(setup(), T0, true);

  assert.equal(text(elements, "control").text, "3+2");
  assert.equal(image(elements, "knight").path, "appmeta/icon_front_8x8.png");
  assert.ok(image(elements, "knight").x < text(elements, "control").x);
  assert.equal(find(elements, "clock0"), undefined);
  assert.equal(find(elements, "gauge0"), undefined);
});

test("in setup two dim arrows at the edges hint that the wheel changes the time control", () => {
  const elements = frame(setup(), T0, true);

  assert.equal(text(elements, "prev").text, "<");
  assert.equal(text(elements, "next").text, ">");
  assert.ok(text(elements, "prev").x < image(elements, "knight").x);
  assert.ok(text(elements, "next").x > text(elements, "control").x);
  assert.notEqual(text(elements, "prev").color, text(elements, "control").color);
});

test("the knight and the time control stay centred together, whatever the label's length", () => {
  for (const control of [0, 7]) {
    // "1+0" and "15+10"
    const elements = frame(newGame(CONTROLS, control), T0, true);
    const label = text(elements, "control");
    const left = image(elements, "knight").x;
    const right = label.x + label.text.length * 7 - 1;

    assert.ok(Math.abs(left - (72 - right)) <= 1, `${label.text}: ${left} px on the left, ${72 - right} on the right`);
  }
});

// --- Front: clocks

test("once ready the front shows both clocks, the first player on the left", () => {
  const elements = frame(ready(), T0, true);
  const left = text(elements, "clock0");
  const right = text(elements, "clock1");

  assert.equal(left.text, "3:00");
  assert.equal(right.text, "3:00");
  assert.ok(left.x < right.x);
  assert.equal(find(elements, "control"), undefined);
  assert.equal(find(elements, "knight"), undefined);
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

test("once ready, the side that moves first is lit and the other is dimmed", () => {
  const left = ready();
  const right = step(left, { type: "rotate", delta: 1 }, T0);

  assert.equal(text(frame(left, T0, true), "clock0").color, COLORS.active);
  assert.equal(text(frame(left, T0, true), "clock1").color, COLORS.idle);
  assert.equal(text(frame(right, T0, true), "clock0").color, COLORS.idle);
  assert.equal(text(frame(right, T0, true), "clock1").color, COLORS.active);
});

// --- Front: gauges

test("each clock has a gauge under it, full before the first move", () => {
  const elements = frame(ready(), T0, true);

  for (const player of [0, 1]) {
    const gauge = rectangle(elements, `gauge${player}`);
    const clock = text(elements, `clock${player}`);

    assert.equal(gauge.width, GAUGE_WIDTH);
    assert.ok(gauge.y > clock.y, "the gauge sits below the digits");
    assert.ok(gauge.y + gauge.height <= 16, "the gauge fits on the 16-pixel front");
  }
});

test("a gauge is a single row of pixels", () => {
  const elements = frame(ready(), T0, true);

  for (const id of ["gauge0", "gauge1", "track0", "track1"]) {
    assert.equal(rectangle(elements, id).height, 1, id);
  }
});

test("a gauge empties in proportion to the time used", () => {
  // Half of the three minutes gone.
  const elements = frame(running(), T0 + 90_000, true);

  assert.equal(rectangle(elements, "gauge0").width, GAUGE_WIDTH / 2);
  assert.equal(rectangle(elements, "gauge1").width, GAUGE_WIDTH);
});

test("a gauge keeps one pixel for as long as there is any time left", () => {
  const elements = frame(running(), T0 + 179_999, true);

  assert.equal(rectangle(elements, "gauge0").width, 1);
});

test("a gauge never overflows when increments push a clock above its starting time", () => {
  // Moves instantly: 3:00 plus 2 s of increment.
  const game = step(running(), { type: "start" }, T0);

  assert.equal(rectangle(frame(game, T0, true), "gauge0").width, GAUGE_WIDTH);
});

test("a gauge has the colour of its clock", () => {
  const elements = frame(running(), T0 + 172_550, true);

  for (const player of [0, 1]) {
    const gauge = rectangle(elements, `gauge${player}`);
    assert.deepEqual(gauge.fill_colors, [text(elements, `clock${player}`).color]);
  }
});

test("an empty gauge leaves only its track", () => {
  const finished = step(running(), { type: "tick" }, T0 + 180_000);
  const elements = frame(finished, T0 + 180_000, true);

  assert.equal(find(elements, "gauge0"), undefined);
  assert.equal(rectangle(elements, "track0").width, GAUGE_WIDTH);
  assert.equal(rectangle(elements, "gauge1").width, GAUGE_WIDTH);
});

test("both gauges and their tracks span the same pixels, one on each half of the front", () => {
  const elements = frame(ready(), T0, true);
  const left = rectangle(elements, "track0");
  const right = rectangle(elements, "track1");

  assert.equal(left.width, right.width);
  assert.equal(left.x, 72 - (right.x + right.width), "mirrored around the middle");
  assert.equal(rectangle(elements, "gauge0").x, left.x);
  assert.equal(rectangle(elements, "gauge1").x, right.x);
});

// --- Front: the middle of the screen

test("a thin divider separates the two clocks while a game is ready or running", () => {
  for (const game of [ready(), running()]) {
    const divider = rectangle(frame(game, T0, true), "divider");

    assert.equal(divider.width, 1);
    assert.ok(divider.x > 33 && divider.x < 39, "between the two clocks");
  }
});

test("a pause shows a pause sign in the middle instead of the divider", () => {
  const paused = step(running(), { type: "ok" }, T0 + 10_000);
  const elements = frame(paused, T0 + 500_000, true);

  assert.equal(find(elements, "divider"), undefined);
  assert.deepEqual(rectangle(elements, "pause0").fill_colors, [COLORS.paused]);
  assert.deepEqual(rectangle(elements, "pause1").fill_colors, [COLORS.paused]);
  assert.ok(rectangle(elements, "pause0").x < rectangle(elements, "pause1").x);
});

test("while paused the stopped clock is marked, and nothing counts down", () => {
  const paused = step(running(), { type: "ok" }, T0 + 10_000);
  const elements = frame(paused, T0 + 500_000, true);

  assert.equal(text(elements, "clock0").text, "2:50");
  assert.equal(text(elements, "clock0").color, COLORS.paused);
  assert.equal(text(elements, "clock1").color, COLORS.idle);
});

test("a finished game keeps the plain divider: the red zero says it all", () => {
  const finished = step(running(), { type: "tick" }, T0 + 180_000);
  const elements = frame(finished, T0 + 181_000, true);

  assert.equal(rectangle(elements, "divider").width, 1);
  assert.equal(find(elements, "pause0"), undefined);
  assert.deepEqual(
    ids(elements, "front").filter((id) => !/^(clock|gauge|track)[01]$/.test(id)),
    ["divider"],
  );
});

test("on a fallen flag the loser's clock reads zero in red", () => {
  const finished = step(running(), { type: "tick" }, T0 + 180_000);
  const elements = frame(finished, T0 + 181_000, true);

  assert.equal(text(elements, "clock0").text, "0.0");
  assert.equal(text(elements, "clock0").color, COLORS.low);
  assert.equal(text(elements, "clock1").color, COLORS.idle);
});

test("the loser's clock can be drawn dimmed, so it can flash", () => {
  const finished = step(running(), { type: "tick" }, T0 + 180_000);
  const elements = frame(finished, T0 + 181_000, true, true);

  assert.equal(text(elements, "clock0").text, "0.0");
  assert.equal(text(elements, "clock0").color, COLORS.lowIdle);
  assert.equal(text(elements, "clock1").color, COLORS.idle, "only the loser flashes");
});

test("dimming for the flash only applies to a finished game", () => {
  assert.equal(text(frame(running(), T0 + 172_550, true, true), "clock0").color, COLORS.low);
});

// --- Back

test("the back shows the knight, the time control and the state", () => {
  const elements = frame(setup(), T0, true);

  assert.equal(image(elements, "b-knight").path, "appmeta/icon_back_11x11.png");
  assert.ok(backTexts(elements).includes("3+2"));
  assert.ok(backTexts(elements).includes("SETUP"));
});

test("the back names each state of the game", () => {
  const play = running();
  const paused = step(play, { type: "ok" }, T0 + 1_000);
  const finished = step(play, { type: "tick" }, T0 + 180_000);

  assert.ok(backTexts(frame(ready(), T0, true)).includes("READY"));
  assert.ok(backTexts(frame(play, T0, true)).includes("RUNNING"));
  assert.ok(backTexts(frame(paused, T0 + 1_000, true)).includes("PAUSED"));
  assert.ok(backTexts(frame(finished, T0 + 180_000, true)).includes("FINISHED"));
});

test("the back reminds which controls apply, in plain words", () => {
  assert.ok(backTexts(frame(setup(), T0, true)).some((line) => line.includes("Wheel")));
  assert.ok(backTexts(frame(running(), T0, true)).some((line) => line.includes("Button")));
  assert.ok(backTexts(frame(step(running(), { type: "ok" }, T0 + 1), T0 + 1, true)).some((line) => line.includes("resume")));
});

test("the back says whose move it is, with an arrow on that side", () => {
  const leftToMove = frame(running(), T0, true);
  const rightToMove = frame(step(running(), { type: "start" }, T0 + 1_000), T0 + 1_000, true);

  assert.ok(backTexts(leftToMove).includes("Left to move"));
  assert.equal(text(leftToMove, "b-arrow").text, "<");
  assert.ok(backTexts(rightToMove).includes("Right to move"));
  assert.equal(text(rightToMove, "b-arrow").text, ">");
  assert.ok(text(leftToMove, "b-arrow").x < text(rightToMove, "b-arrow").x);
});

test("once ready, the back says which side moves first and that the wheel changes it", () => {
  const left = ready();
  const right = step(left, { type: "rotate", delta: 1 }, T0);

  assert.ok(backTexts(frame(left, T0, true)).includes("Left moves first"));
  assert.ok(backTexts(frame(right, T0, true)).includes("Right moves first"));
  assert.ok(backTexts(frame(left, T0, true)).some((line) => line.includes("Wheel")));
});

test("the back counts moves the way a scoresheet does: one per pair of presses", () => {
  let game = running();
  assert.ok(backTexts(frame(game, T0, true)).includes("Move 1"));

  game = step(game, { type: "start" }, T0 + 1_000);
  assert.ok(backTexts(frame(game, T0 + 1_000, true)).includes("Move 1"));

  game = step(game, { type: "start" }, T0 + 2_000);
  assert.ok(backTexts(frame(game, T0 + 2_000, true)).includes("Move 2"));
});

test("the back says who lost on time", () => {
  const leftFlagged = step(running(), { type: "tick" }, T0 + 180_000);
  assert.ok(backTexts(frame(leftFlagged, T0 + 180_000, true)).includes("Left lost on time"));

  const rightToMove = step(running(), { type: "start" }, T0 + 1_000);
  const rightFlagged = step(rightToMove, { type: "tick" }, T0 + 181_000);
  assert.ok(backTexts(frame(rightFlagged, T0 + 181_000, true)).includes("Right lost on time"));
});

// --- Whatever is on screen

test("every element is one the device accepts: unique id, printable ASCII, a display, a real size", () => {
  for (const game of everyPhase()) {
    const elements = frame(game, T0 + 180_000, true);
    const seen = new Set(elements.map((element) => element.id));

    assert.equal(seen.size, elements.length, `duplicate id in ${game.phase}`);

    for (const element of elements) {
      assert.match(element.id, /^[a-zA-Z0-9._-]+$/);
      assert.ok(element.display === "front" || element.display === "back");
      if (element.type === "text") assert.match(element.text, /^[\x20-\x7E]+$/, `${element.id} in ${game.phase}`);
      if (element.type === "rectangle") {
        assert.ok(element.width >= 1 && element.height >= 1, `${element.id} in ${game.phase} has no size`);
      }
    }
  }
});

test("nothing is drawn outside the 72x16 front", () => {
  for (const game of everyPhase()) {
    for (const element of frame(game, T0 + 180_000, true)) {
      if (element.display !== "front") continue;

      assert.ok(element.x >= 0 && element.x < 72, `${element.id} at x=${element.x} in ${game.phase}`);
      assert.ok(element.y >= 0 && element.y < 16, `${element.id} at y=${element.y} in ${game.phase}`);
      if (element.type === "rectangle") {
        assert.ok(element.x + element.width <= 72 && element.y + element.height <= 16, `${element.id} in ${game.phase}`);
      }
    }
  }
});

test("the back keeps clear of the system's status column on its right edge", () => {
  for (const game of everyPhase()) {
    for (const element of frame(game, T0 + 180_000, true)) {
      if (element.display === "back") assert.ok(element.x <= 144, `${element.id} at x=${element.x} in ${game.phase}`);
    }
  }
});

test("a tick of the running clock changes nothing but that clock and its gauge", () => {
  const before = new Map(frame(running(), T0 + 30_000, true).map((element) => [element.id, JSON.stringify(element)]));
  const changed = frame(running(), T0 + 31_000, true)
    .filter((element) => before.get(element.id) !== JSON.stringify(element))
    .map((element) => element.id);

  assert.ok(changed.includes("clock0"));
  assert.deepEqual(
    changed.filter((id) => id !== "clock0" && id !== "gauge0"),
    [],
  );
});

test("the front ids in each state are the ones the state calls for", () => {
  assert.deepEqual(ids(frame(setup(), T0, true), "front").sort(), ["control", "knight", "next", "prev"]);
  assert.deepEqual(ids(frame(running(), T0, true), "front").sort(), [
    "clock0",
    "clock1",
    "divider",
    "gauge0",
    "gauge1",
    "track0",
    "track1",
  ]);
});
