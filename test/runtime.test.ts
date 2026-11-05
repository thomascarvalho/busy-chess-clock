import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

/** What firmware 1.3.1 gives `console`: calling anything else throws "Expected a function" on the bar. */
const AVAILABLE = ["log", "info", "error"];

function sources(dir: URL): URL[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return sources(new URL(`${entry.name}/`, dir));
    return entry.name.endsWith(".ts") ? [new URL(entry.name, dir)] : [];
  });
}

test("the app only calls console methods the bar's runtime has", () => {
  const files = [...sources(new URL("../src/", import.meta.url)), ...sources(new URL("../shared/", import.meta.url))];
  assert.ok(files.length > 5);

  for (const file of files) {
    for (const [, method] of readFileSync(file, "utf8").matchAll(/console\.(\w+)/g)) {
      assert.ok(AVAILABLE.includes(method!), `console.${method} in ${file.pathname.split("/").slice(-2).join("/")}`);
    }
  }
});
