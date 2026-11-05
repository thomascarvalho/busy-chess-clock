import assert from "node:assert/strict";
import { test } from "node:test";
import { formatClock, isLow, msUntilNextChange } from "../src/format.ts";

test("with tenths, whole seconds are truncated like on an online clock", () => {
  assert.equal(formatClock(300_000, true), "5:00");
  assert.equal(formatClock(299_999, true), "4:59");
  assert.equal(formatClock(1_800_000, true), "30:00");
  assert.equal(formatClock(61_000, true), "1:01");
  assert.equal(formatClock(10_000, true), "0:10");
});

test("with tenths, the last ten seconds show seconds and tenths", () => {
  assert.equal(formatClock(9_999, true), "9.9");
  assert.equal(formatClock(9_900, true), "9.9");
  assert.equal(formatClock(9_899, true), "9.8");
  assert.equal(formatClock(100, true), "0.1");
  assert.equal(formatClock(99, true), "0.0");
  assert.equal(formatClock(0, true), "0.0");
});

test("without tenths, seconds are rounded up so 0:00 only shows when the flag falls", () => {
  assert.equal(formatClock(300_000, false), "5:00");
  assert.equal(formatClock(299_001, false), "5:00");
  assert.equal(formatClock(299_000, false), "4:59");
  assert.equal(formatClock(9_999, false), "0:10");
  assert.equal(formatClock(1, false), "0:01");
  assert.equal(formatClock(0, false), "0:00");
});

test("a clock is low as soon as it displays less than ten seconds", () => {
  assert.equal(isLow(10_000, true), false);
  assert.equal(isLow(9_999, true), true);
  assert.equal(isLow(0, true), true);

  assert.equal(isLow(9_001, false), false);
  assert.equal(isLow(9_000, false), true);
});

test("with tenths, the next change is when the displayed second or tenth drops", () => {
  assert.equal(msUntilNextChange(299_500, true), 501);
  assert.equal(msUntilNextChange(300_000, true), 1);
  assert.equal(msUntilNextChange(10_000, true), 1);
  assert.equal(msUntilNextChange(9_950, true), 51);
  assert.equal(msUntilNextChange(9_900, true), 1);
});

test("without tenths, the next change is the next whole second", () => {
  assert.equal(msUntilNextChange(299_500, false), 500);
  assert.equal(msUntilNextChange(300_000, false), 1_000);
  assert.equal(msUntilNextChange(400, false), 400);
});

test("the next change is never later than the flag", () => {
  assert.equal(msUntilNextChange(40, true), 40);
  assert.equal(msUntilNextChange(0, true), 0);
  assert.equal(msUntilNextChange(0, false), 0);
});

test("the displayed text really changes at the announced moment, and not before", () => {
  for (const tenths of [true, false]) {
    for (const left of [300_000, 123_456, 10_001, 10_000, 9_999, 5_050, 1_000, 101, 100, 37]) {
      const wait = msUntilNextChange(left, tenths);
      const flagged = left - wait <= 0;

      assert.ok(wait > 0 && wait <= left, `wait ${wait} for ${left}`);
      if (wait > 1) {
        assert.equal(formatClock(left - wait + 1, tenths), formatClock(left, tenths), `early at ${left}`);
      }
      if (!flagged) {
        assert.notEqual(formatClock(left - wait, tenths), formatClock(left, tenths), `late at ${left}`);
      }
    }
  }
});
