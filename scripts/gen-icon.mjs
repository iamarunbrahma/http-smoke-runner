// Generates a 128x128 PNG placeholder with "HSR" lettering.
// No dependencies beyond Node 20 built-ins.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const W = 128;
const H = 128;
const BG = [14, 22, 36];
const FG = [140, 220, 180];
const data = new Uint8Array(W * H * 4);

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    data[i] = BG[0];
    data[i + 1] = BG[1];
    data[i + 2] = BG[2];
    data[i + 3] = 0xff;
  }
}

const G = {
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001']
};

function drawChar(c, x0, y0, scale) {
  const m = G[c];
  if (!m) return;
  for (let r = 0; r < 7; r++) {
    for (let k = 0; k < 5; k++) {
      if (m[r][k] !== '1') continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const x = x0 + k * scale + dx;
          const y = y0 + r * scale + dy;
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const i = (y * W + x) * 4;
          data[i] = FG[0];
          data[i + 1] = FG[1];
          data[i + 2] = FG[2];
        }
      }
    }
  }
}

const scale = 8;
const totalW = (3 * 5 + 2) * scale;
const x0 = Math.floor((W - totalW) / 2);
const y0 = Math.floor((H - 7 * scale) / 2);
drawChar('H', x0 + 0 * (6 * scale), y0, scale);
drawChar('S', x0 + 1 * (6 * scale), y0, scale);
drawChar('R', x0 + 2 * (6 * scale), y0, scale);

writeFileSync('media/icon.png', encodePng(W, H, data));
console.log('wrote media/icon.png');

function encodePng(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = chunk('IHDR', buildIhdr(w, h));
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (1 + w * 4) + 1);
  }
  const idat = chunk('IDAT', deflateSync(raw));
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

function buildIhdr(w, h) {
  const b = Buffer.alloc(13);
  b.writeUInt32BE(w, 0);
  b.writeUInt32BE(h, 4);
  b[8] = 8;
  b[9] = 6;
  b[10] = 0;
  b[11] = 0;
  b[12] = 0;
  return b;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}
