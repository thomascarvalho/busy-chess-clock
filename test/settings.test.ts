import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DEFAULTS, readSettings } from "../src/settings.ts";
import { CUSTOM, PRESETS } from "../src/timeControls.ts";

const schema = JSON.parse(readFileSync(new URL("../src/appmeta/settings.json", import.meta.url), "utf8")) as {
  fields: Record<string, { type: string; default: unknown; options?: { value: string }[]; min?: number; max?: number }>;
};

test("stored values are read as they are", () => {
  const settings = readSettings({
    default_time_control: "10+5",
    custom_minutes: 45,
    custom_increment: 15,
    sound: false,
    low_time_beep: false,
  });

  assert.deepEqual(settings, {
    defaultControl: "10+5",
    customMinutes: 45,
    customIncrement: 15,
    sound: false,
    lowTimeBeep: false,
  });
});

test("missing or mistyped values fall back to the defaults", () => {
  assert.deepEqual(readSettings(undefined), DEFAULTS);
  assert.deepEqual(readSettings({ default_time_control: 5, custom_minutes: "7", sound: "yes" }), DEFAULTS);
});

test("custom values outside the allowed range are clamped", () => {
  const settings = readSettings({ custom_minutes: 0, custom_increment: 999 });

  assert.equal(settings.customMinutes, 1);
  assert.equal(settings.customIncrement, 60);
});

test("the defaults in code match the defaults in settings.json", () => {
  const fields = schema.fields;

  assert.equal(fields["default_time_control"]!.default, DEFAULTS.defaultControl);
  assert.equal(fields["custom_minutes"]!.default, DEFAULTS.customMinutes);
  assert.equal(fields["custom_increment"]!.default, DEFAULTS.customIncrement);
  assert.equal(fields["sound"]!.default, DEFAULTS.sound);
  assert.equal(fields["low_time_beep"]!.default, DEFAULTS.lowTimeBeep);
});

test("settings.json offers every preset plus the custom time control", () => {
  assert.deepEqual(
    schema.fields["default_time_control"]!.options!.map((option) => option.value),
    [...PRESETS.map((preset) => preset.label), CUSTOM],
  );
});

test("settings.json only uses types the bar can edit on its own screen", () => {
  for (const [id, field] of Object.entries(schema.fields)) {
    assert.ok(["boolean", "integer", "enum"].includes(field.type), `${id} is a ${field.type}`);
  }
});
