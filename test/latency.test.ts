import assert from "node:assert/strict";
import { test } from "node:test";
import { Latency } from "../src/latency.ts";

test("an empty tracker has nothing to report", () => {
  const latency = new Latency();

  assert.equal(latency.count, 0);
  assert.equal(latency.average(), 0);
  assert.equal(latency.smoothed(), undefined);
});

test("it reports how many samples it saw, their average and the worst one", () => {
  const latency = new Latency();
  for (const ms of [20, 40, 90]) latency.add(ms);

  assert.equal(latency.count, 3);
  assert.equal(latency.average(), 50);
  assert.equal(latency.max, 90);
});

test("the smoothed value starts at the first sample and follows later ones gradually", () => {
  const latency = new Latency();

  latency.add(40);
  assert.equal(latency.smoothed(), 40);

  latency.add(80);
  assert.equal(latency.smoothed(), 50);
});

test("one slow outlier does not push the smoothed value over a budget the others respect", () => {
  const latency = new Latency();
  for (const ms of [30, 30, 30, 150, 30, 30]) latency.add(ms);

  assert.ok(latency.smoothed()! < 70);
});
