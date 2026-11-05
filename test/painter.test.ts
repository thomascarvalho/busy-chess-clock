import assert from "node:assert/strict";
import { test } from "node:test";
import type { DisplayElement } from "../shared/device.ts";
import { Painter } from "../src/painter.ts";

/** Stands in for the device: records what it is asked to draw and clear. */
function fakeScreen() {
  const drawn: string[][] = [];
  const cleared: string[][] = [];

  return {
    drawn,
    cleared,
    draw: (elements: DisplayElement[]) => drawn.push(elements.map((element) => `${element.id}=${label(element)}`)),
    clear: (ids: string[]) => cleared.push([...ids]),
  };
}

function label(element: DisplayElement): string {
  return element.type === "text" ? element.text : element.type;
}

function text(id: string, value: string): DisplayElement {
  return { type: "text", id, text: value, font: "bold", color: "#FFFFFFFF", x: 0, y: 0, display: "front" };
}

test("the first frame is drawn in full", () => {
  const screen = fakeScreen();
  const painter = new Painter(screen);

  painter.paint([text("a", "1"), text("b", "2")]);

  assert.deepEqual(screen.drawn, [["a=1", "b=2"]]);
  assert.deepEqual(screen.cleared, []);
});

test("an identical frame sends nothing", () => {
  const screen = fakeScreen();
  const painter = new Painter(screen);

  painter.paint([text("a", "1")]);
  painter.settled(false);
  painter.paint([text("a", "1")]);

  assert.equal(screen.drawn.length, 1);
  assert.equal(painter.busy(), false);
});

test("only the elements that changed are sent again", () => {
  const screen = fakeScreen();
  const painter = new Painter(screen);

  painter.paint([text("a", "1"), text("b", "2")]);
  painter.settled(false);
  painter.paint([text("a", "1"), text("b", "3")]);

  assert.deepEqual(screen.drawn[1], ["b=3"]);
});

test("elements that left the frame are cleared by id, and drawn again if they return", () => {
  const screen = fakeScreen();
  const painter = new Painter(screen);

  painter.paint([text("a", "1"), text("b", "2")]);
  painter.settled(false);
  painter.paint([text("a", "1")]);
  painter.settled(false);

  assert.deepEqual(screen.cleared, [["b"]]);
  assert.equal(screen.drawn.length, 1);

  painter.paint([text("a", "1"), text("b", "2")]);

  assert.deepEqual(screen.drawn[1], ["b=2"]);
});

test("while the device is still answering, frames are held and only the newest one goes out", () => {
  const screen = fakeScreen();
  const painter = new Painter(screen);

  painter.paint([text("a", "1")]);
  painter.paint([text("a", "2")]);
  painter.paint([text("a", "3")]);

  assert.equal(screen.drawn.length, 1);
  assert.equal(painter.busy(), true);

  painter.settled(false);

  assert.deepEqual(screen.drawn, [["a=1"], ["a=3"]]);
});

test("a draw and a clear sent together are both waited for", () => {
  const screen = fakeScreen();
  const painter = new Painter(screen);

  painter.paint([text("a", "1"), text("b", "2")]);
  painter.settled(false);
  painter.paint([text("a", "9")]);
  painter.paint([text("a", "10")]);
  painter.settled(false);

  assert.equal(screen.drawn.length, 2);

  painter.settled(false);

  assert.deepEqual(screen.drawn[2], ["a=10"]);
});

test("after a failed request the next frame is sent in full, since the screen is in an unknown state", () => {
  const screen = fakeScreen();
  const painter = new Painter(screen);

  painter.paint([text("a", "1"), text("b", "2")]);
  painter.settled(true);
  painter.paint([text("a", "1"), text("b", "2")]);

  assert.deepEqual(screen.drawn[1], ["a=1", "b=2"]);
});

test("a failed request does not resend by itself: retrying is the caller's decision", () => {
  const screen = fakeScreen();
  const painter = new Painter(screen);

  painter.paint([text("a", "1")]);
  painter.settled(true);

  assert.equal(screen.drawn.length, 1);
});

test("once stopped, nothing more is sent", () => {
  const screen = fakeScreen();
  const painter = new Painter(screen);

  painter.paint([text("a", "1")]);
  painter.paint([text("a", "2")]);
  painter.stop();
  painter.settled(false);
  painter.paint([text("a", "3")]);

  assert.equal(screen.drawn.length, 1);
});

test("once invalidated, the next frame is sent in full even if nothing changed", () => {
  const screen = fakeScreen();
  const painter = new Painter(screen);

  painter.paint([text("a", "1"), text("b", "2")]);
  painter.settled(false);
  painter.invalidate();
  painter.paint([text("a", "1"), text("b", "2")]);

  assert.deepEqual(screen.drawn[1], ["a=1", "b=2"]);
  assert.deepEqual(screen.cleared, []);
});

test("once invalidated, elements that left the frame are still cleared", () => {
  const screen = fakeScreen();
  const painter = new Painter(screen);

  painter.paint([text("a", "1"), text("b", "2")]);
  painter.settled(false);
  painter.invalidate();
  painter.paint([text("a", "1")]);

  assert.deepEqual(screen.drawn[1], ["a=1"]);
  assert.deepEqual(screen.cleared, [["b"]]);
});

test("invalidating while the device is busy still resends everything afterwards", () => {
  const screen = fakeScreen();
  const painter = new Painter(screen);

  painter.paint([text("a", "1")]);
  painter.invalidate();
  painter.paint([text("a", "1")]);
  painter.settled(false);

  assert.deepEqual(screen.drawn, [["a=1"], ["a=1"]]);
});
