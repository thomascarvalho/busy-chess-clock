import assert from "node:assert/strict";
import { test } from "node:test";
import { buildControls, controlIndex, controlValue, CUSTOM, PRESETS } from "../src/timeControls.ts";

test("the presets are the nine time controls of the spec, in order", () => {
  assert.deepEqual(
    PRESETS.map((control) => control.label),
    ["1+0", "3+0", "3+2", "5+0", "5+3", "10+0", "10+5", "15+10", "30+0"],
  );
});

test("a preset carries its base time and increment in milliseconds", () => {
  const control = PRESETS.find((preset) => preset.label === "15+10")!;

  assert.equal(control.baseMs, 15 * 60_000);
  assert.equal(control.incrementMs, 10_000);
});

test("the custom time control comes last, after the presets", () => {
  const controls = buildControls({ minutes: 7, increment: 3 });

  assert.equal(controls.length, PRESETS.length + 1);
  assert.deepEqual(controls.slice(0, PRESETS.length), [...PRESETS]);
  assert.deepEqual(controls[controls.length - 1], { label: "7+3", baseMs: 420_000, incrementMs: 3_000 });
});

test("a stored value selects the matching time control", () => {
  const controls = buildControls({ minutes: 7, increment: 3 });

  assert.equal(controls[controlIndex(controls, "10+5")]!.label, "10+5");
  assert.equal(controlIndex(controls, CUSTOM), controls.length - 1);
});

test("an unknown stored value falls back to 10+0", () => {
  const controls = buildControls({ minutes: 7, increment: 3 });

  assert.equal(controls[controlIndex(controls, "2+1")]!.label, "10+0");
});

test("with nothing remembered yet, the app opens on 10+0", () => {
  const controls = buildControls({ minutes: 7, increment: 3 });

  assert.equal(controls[controlIndex(controls, null)]!.label, "10+0");
});

test("a preset is remembered by its label, the custom time control by name", () => {
  const controls = buildControls({ minutes: 7, increment: 3 });

  assert.equal(controlValue(controls, 2), "3+2");
  assert.equal(controlValue(controls, controls.length - 1), CUSTOM);
});

test("every time control is found again from what was remembered for it", () => {
  // The custom one deliberately collides with a preset: it must still come back as custom.
  const controls = buildControls({ minutes: 5, increment: 3 });

  controls.forEach((_, index) => {
    assert.equal(controlIndex(controls, controlValue(controls, index)), index);
  });
});
