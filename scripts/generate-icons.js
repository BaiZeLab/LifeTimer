#!/usr/bin/env node
/**
 * generate-icons.js — Pure Node.js PWA icon generator.
 *
 * Renders a clock-face icon that matches Life Timer's warm-cream / dark-ink
 * design language. No external dependencies — only Node built-ins (zlib, fs).
 *
 * Outputs:
 *   public/icons/icon-192.png
 *   public/icons/icon-512.png
 *   public/icons/apple-touch-icon.png  (180×180)
 */

/* eslint-disable no-console */
const zlib = require("zlib");
const fs   = require("fs");
const path = require("path");

// ── CRC32 (required by PNG spec) ─────────────────────────────────────────────

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[i] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const t   = Buffer.from(type, "ascii");
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length);
  const c   = Buffer.allocUnsafe(4); c.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, c]);
}

// ── Icon pixel renderer ───────────────────────────────────────────────────────

/**
 * Returns [r, g, b] (0-255) for pixel at (x, y) in a w×h icon.
 *
 * Design:
 *   • Warm cream background  (#F1EBDF  ≈ oklch 94.5% 0.015 88)
 *   • Dark ink clock ring + hands  (#262319  ≈ oklch 17% 0.032 75)
 *   • Lighter cream clock face  (#F8F4EC)
 *   • Clock reads "10:10" (iconic open-smile position)
 *   • 12 tick marks; 4 major ones are longer
 */
function pixel(x, y, w, h) {
  const BG   = [241, 235, 223];
  const FACE = [248, 244, 236];
  const INK  = [38,  35,  25];

  const cx = w / 2, cy = h / 2;
  const maxR = Math.min(w, h) / 2;

  const ringOuter = maxR * 0.85;
  const ringInner = maxR * 0.68;
  const handW     = ringInner * 0.080;
  const hourLen   = ringInner * 0.54;
  const minLen    = ringInner * 0.74;

  // 10:10 → hour at 10/12, minute at 2/12 on the clock face
  const hourA = 2 * Math.PI * (10 / 12) - Math.PI / 2;
  const minA  = 2 * Math.PI * (2  / 12) - Math.PI / 2;

  const dx = x - cx, dy = y - cy;
  const dist = Math.hypot(dx, dy);

  if (dist > ringOuter) return BG;

  if (dist > ringInner) return INK; // clock ring

  // Inside the face ────────────────────────────────────────────────────────

  // Tick marks (12 × 30°)
  const angle = Math.atan2(dy, dx);
  for (let t = 0; t < 12; t++) {
    const ta = 2 * Math.PI * t / 12 - Math.PI / 2;
    // Circular angular distance
    let da = (angle - ta + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    da = Math.abs(da);
    const isMajor = t % 3 === 0;
    const tickOuter = ringInner * 0.96;
    const tickInner = ringInner * (isMajor ? 0.72 : 0.84);
    const angTol   = isMajor ? 0.055 : 0.038;
    if (da < angTol && dist >= tickInner && dist <= tickOuter) return INK;
  }

  // Clock hands (check by rotating coordinate system to hand's axis)
  function nearHand(angle, length, width) {
    const cosA = Math.cos(-angle), sinA = Math.sin(-angle);
    const rx = dx * cosA - dy * sinA;
    const ry = dx * sinA + dy * cosA;
    return Math.abs(rx) < width && ry > -width * 0.4 && ry <= length;
  }

  if (nearHand(hourA, hourLen, handW))       return INK;
  if (nearHand(minA,  minLen,  handW * 0.70)) return INK;

  // Centre pivot dot
  if (dist < ringInner * 0.095) return INK;

  return FACE;
}

// ── PNG builder ───────────────────────────────────────────────────────────────

function makePNG(size) {
  const w = size, h = size;

  // IHDR
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // RGB (no alpha needed)
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Raw scanlines: 1 filter byte (0=None) + 3 bytes per pixel
  const raw = Buffer.allocUnsafe(h * (1 + w * 3));
  let pos = 0;
  for (let y = 0; y < h; y++) {
    raw[pos++] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixel(x, y, w, h);
      raw[pos++] = r; raw[pos++] = g; raw[pos++] = b;
    }
  }

  const idat = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const outDir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

const sizes = [
  { name: "icon-192.png",       size: 192 },
  { name: "icon-512.png",       size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const { name, size } of sizes) {
  const buf = makePNG(size);
  fs.writeFileSync(path.join(outDir, name), buf);
  console.log(`[icons] Generated ${name} (${size}×${size})`);
}
