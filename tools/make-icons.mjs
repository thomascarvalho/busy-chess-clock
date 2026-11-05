// Generates the app's two icons into src/appmeta/. Run with `pnpm icons`; the .png files are
// committed, so this only needs running again when the drawing is changed.
//
// The bar wants an 8x8 colour icon for the LED front and an 11x11 greyscale one for the back,
// both as 8-bit RGBA PNGs. Each drawing below is a grid of one character per pixel.

import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const OUT = new URL("../src/appmeta/", import.meta.url);

/** A knight on a green base, the colour of the running clock. `.` is transparent. */
const FRONT = {
  colors: { W: "#FFF4DC", w: "#D9C49A", G: "#40FF70", g: "#1E9A45" },
  art: `
    ...W....
    ..WWWW..
    .WW.WWw.
    WWWWWWw.
    WWW.WWw.
    ...WWWw.
    ..WWWWw.
    .GGGGGGg`,
};

/** The same knight with room for a neck and a jaw. */
const BACK = {
  colors: { "#": "#FFFFFF", "+": "#B0B0B0", "-": "#707070" },
  art: `
    ....#......
    ...####....
    ..######...
    .##.####+..
    #########+.
    ###..####+.
    .....####+.
    ....#####+.
    ...######+.
    ..########+
    ..--------+`,
};

function pixels({ art, colors }) {
  return art
    .trim()
    .split("\n")
    .map((line) =>
      [...line.trim()].map((ch) => {
        if (ch === ".") return [0, 0, 0, 0];
        const hex = colors[ch];
        if (hex === undefined) throw new Error(`no colour for "${ch}"`);
        return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255];
      }),
    );
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc(body));
  return Buffer.concat([length, body, sum]);
}

/** An 8-bit RGBA PNG, rows stored unfiltered. */
function png(rows) {
  const height = rows.length;
  const width = rows[0].length;
  if (rows.some((row) => row.length !== width)) throw new Error("rows of different widths");

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bits per channel
  header[9] = 6; // RGBA

  const raw = Buffer.alloc(height * (width * 4 + 1));
  rows.forEach((row, y) => {
    row.forEach((pixel, x) => {
      pixel.forEach((value, i) => {
        raw[y * (width * 4 + 1) + 1 + x * 4 + i] = value;
      });
    });
  });

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function write(name, drawing, size) {
  const rows = pixels(drawing);
  if (rows.length !== size || rows[0].length !== size) throw new Error(`${name} is not ${size}x${size}`);

  const file = png(rows);
  writeFileSync(new URL(name, OUT), file);
  console.log(`${name}: ${size}x${size}, ${file.length} bytes`);
}

write("icon_front_8x8.png", FRONT, 8);
write("icon_back_11x11.png", BACK, 11);
