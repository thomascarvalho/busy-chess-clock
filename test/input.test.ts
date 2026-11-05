import assert from "node:assert/strict";
import { test } from "node:test";
import { toAction } from "../src/input.ts";

test("the big button acts the moment it goes down", () => {
  assert.deepEqual(toAction({ key: "start", action: "press" }), { type: "start" });
});

test("the rest of a big-button gesture is ignored, so one push is one move", () => {
  for (const action of ["release", "short", "long", "repeat"] as const) {
    assert.equal(toAction({ key: "start", action }), null);
  }
});

test("the wheel click and back act on a completed short press only", () => {
  assert.deepEqual(toAction({ key: "ok", action: "short" }), { type: "ok" });
  assert.deepEqual(toAction({ key: "back", action: "short" }), { type: "back" });

  for (const action of ["press", "release", "long", "repeat"] as const) {
    assert.equal(toAction({ key: "ok", action }), null);
    assert.equal(toAction({ key: "back", action }), null);
  }
});

test("the wheel reports its direction", () => {
  assert.deepEqual(toAction({ key: "encoder", action: "clockwise", delta: 1 }), { type: "rotate", delta: 1 });
  assert.deepEqual(toAction({ key: "encoder", action: "counterclockwise", delta: -1 }), { type: "rotate", delta: -1 });
});
