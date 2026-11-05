import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { inflateSync } from "node:zlib";

/** Reads an 8-bit RGBA PNG whose rows are stored unfiltered, as tools/make-icons.mjs writes them. */
function readIcon(name: string) {
  const file = readFileSync(new URL(`../src/appmeta/${name}`, import.meta.url));
  const chunks: Buffer[] = [];
  let width = 0;
  let height = 0;
  let format = "";

  for (let offset = 8; offset < file.length; ) {
    const length = file.readUInt32BE(offset);
    const type = file.toString("ascii", offset + 4, offset + 8);
    const data = file.subarray(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      format = `${data[8]}-bit, colour type ${data[9]}`;
    }
    if (type === "IDAT") chunks.push(data);

    offset += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * 4 + 1;
  const pixels: number[][] = [];

  for (let y = 0; y < height; y++) {
    assert.equal(raw[y * stride], 0, `${name}: row ${y} is filtered`);
    for (let x = 0; x < width; x++) {
      const at = y * stride + 1 + x * 4;
      pixels.push([raw[at]!, raw[at + 1]!, raw[at + 2]!, raw[at + 3]!]);
    }
  }

  return { width, height, format, pixels };
}

test("the front icon is an 8x8 RGBA image, as the bar requires", () => {
  const icon = readIcon("icon_front_8x8.png");

  assert.equal(icon.width, 8);
  assert.equal(icon.height, 8);
  assert.equal(icon.format, "8-bit, colour type 6");
});

test("the back icon is an 11x11 RGBA image in shades of grey, as the bar requires", () => {
  const icon = readIcon("icon_back_11x11.png");

  assert.equal(icon.width, 11);
  assert.equal(icon.height, 11);
  assert.equal(icon.format, "8-bit, colour type 6");

  for (const [r, g, b] of icon.pixels) {
    assert.ok(r === g && g === b, `pixel ${r},${g},${b} is not grey`);
  }
});

test("both icons actually draw something, on a transparent background", () => {
  for (const name of ["icon_front_8x8.png", "icon_back_11x11.png"]) {
    const { pixels } = readIcon(name);
    const opaque = pixels.filter((pixel) => pixel[3] === 255).length;
    const clear = pixels.filter((pixel) => pixel[3] === 0).length;

    assert.ok(opaque >= 20, `${name}: only ${opaque} drawn pixels`);
    assert.ok(clear >= 10, `${name}: no transparent background`);
  }
});
