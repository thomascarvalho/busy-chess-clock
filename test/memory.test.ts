import assert from "node:assert/strict";
import { test } from "node:test";
import { LastControl } from "../src/memory.ts";

/** Stands in for the bar's localStorage, and counts writes: each one rewrites a file on flash. */
function fakeStore(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  const store = {
    writes: 0,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.writes++;
      items.set(key, value);
    },
  };
  return store;
}

test("nothing is remembered before the first game", () => {
  assert.equal(new LastControl(fakeStore()).load(), null);
});

test("the time control of the last game is remembered across launches", () => {
  const store = fakeStore();

  new LastControl(store).save("15+10");

  assert.equal(new LastControl(store).load(), "15+10");
});

test("playing the same time control again writes nothing", () => {
  const store = fakeStore();
  const memory = new LastControl(store);

  memory.save("3+2");
  memory.save("3+2");

  assert.equal(store.writes, 1);
});

test("playing the time control the app opened on writes nothing", () => {
  const store = fakeStore();
  new LastControl(store).save("3+2");
  store.writes = 0;

  const memory = new LastControl(store);
  memory.load();
  memory.save("3+2");

  assert.equal(store.writes, 0);
});

test("changing time control writes the new one", () => {
  const store = fakeStore();
  const memory = new LastControl(store);

  memory.save("3+2");
  memory.save("5+0");

  assert.equal(store.writes, 2);
  assert.equal(new LastControl(store).load(), "5+0");
});

test("a store that cannot be read counts as nothing remembered", () => {
  const broken = {
    getItem: (): string => {
      throw new Error("storage error");
    },
    setItem: () => {},
  };

  assert.equal(new LastControl(broken).load(), null);
});

test("a store that cannot be written reports it instead of throwing, and tries again next time", () => {
  let attempts = 0;
  const broken = {
    getItem: () => null,
    setItem: () => {
      attempts++;
      throw new Error("Local storage database cannot be saved");
    },
  };
  const memory = new LastControl(broken);

  assert.equal(memory.save("3+2"), "Local storage database cannot be saved");
  assert.equal(memory.save("3+2"), "Local storage database cannot be saved");
  assert.equal(attempts, 2);
});

test("on a runtime without storage the app simply remembers nothing", () => {
  const memory = new LastControl(undefined);

  assert.equal(memory.load(), null);
  assert.equal(memory.save("3+2"), undefined);
});

test("a stored value of the wrong type is ignored", () => {
  const odd = { getItem: () => undefined, setItem: () => {} };

  assert.equal(new LastControl(odd).load(), null);
});
