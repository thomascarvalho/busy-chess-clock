import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DEFAULTS, readSettings, SETTINGS_VERSION } from "../src/settings.ts";

const schema = JSON.parse(readFileSync(new URL("../src/appmeta/settings.json", import.meta.url), "utf8")) as {
  version: number;
  fields: Record<string, { type: string; default: unknown; min?: number; max?: number }>;
};

test("stored values are read as they are", () => {
  const settings = readSettings({
    custom_minutes: 45,
    custom_increment: 15,
    sound: false,
    low_time_beep: false,
  });

  assert.deepEqual(settings, {
    customMinutes: 45,
    customIncrement: 15,
    sound: false,
    lowTimeBeep: false,
  });
});

test("missing or mistyped values fall back to the defaults", () => {
  assert.deepEqual(readSettings(undefined), DEFAULTS);
  assert.deepEqual(readSettings({ custom_minutes: "7", custom_increment: null, sound: "yes" }), DEFAULTS);
});

test("custom values outside the allowed range are clamped", () => {
  const settings = readSettings({ custom_minutes: 0, custom_increment: 999 });

  assert.equal(settings.customMinutes, 1);
  assert.equal(settings.customIncrement, 60);
});

test("the settings in code are exactly the fields of settings.json, with the same defaults", () => {
  const fields = schema.fields;

  assert.deepEqual(Object.keys(fields).sort(), ["custom_increment", "custom_minutes", "low_time_beep", "sound"]);
  assert.equal(fields["custom_minutes"]!.default, DEFAULTS.customMinutes);
  assert.equal(fields["custom_increment"]!.default, DEFAULTS.customIncrement);
  assert.equal(fields["sound"]!.default, DEFAULTS.sound);
  assert.equal(fields["low_time_beep"]!.default, DEFAULTS.lowTimeBeep);
});

test("the settings version the app expects is the one settings.json declares", () => {
  assert.equal(schema.version, SETTINGS_VERSION);
});

test("settings.json only uses types the bar can edit on its own screen", () => {
  for (const [id, field] of Object.entries(schema.fields)) {
    assert.ok(["boolean", "integer", "enum"].includes(field.type), `${id} is a ${field.type}`);
  }
});
