import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Create clean, beautiful SVG icons
function getSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="sf-blue-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563EB" />
      <stop offset="100%" stop-color="#1D4ED8" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.15" />
    </filter>
  </defs>
  <!-- Background rounded card -->
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="url(#sf-blue-grad)" />

  <!-- Shop Roof / Awning -->
  <g fill="#FFFFFF" filter="url(#shadow)">
    <!-- Roof pediment -->
    <path d="
      M ${size * 0.20} ${size * 0.32}
      L ${size * 0.50} ${size * 0.18}
      L ${size * 0.80} ${size * 0.32}
      L ${size * 0.77} ${size * 0.37}
      L ${size * 0.23} ${size * 0.37}
      Z
    " />
    
    <!-- Store Pillars / Base Frame -->
    <rect x="${size * 0.22}" y="${size * 0.39}" width="${size * 0.08}" height="${size * 0.42}" rx="${size * 0.02}" />
    <rect x="${size * 0.70}" y="${size * 0.39}" width="${size * 0.08}" height="${size * 0.42}" rx="${size * 0.02}" />
    <rect x="${size * 0.18}" y="${size * 0.81}" width="${size * 0.64}" height="${size * 0.06}" rx="${size * 0.02}" />

    <!-- ShopFlow 'S' symbol inside store counter -->
    <path d="
      M ${size * 0.62} ${size * 0.45}
      C ${size * 0.60} ${size * 0.42} ${size * 0.55} ${size * 0.40} ${size * 0.50} ${size * 0.40}
      C ${size * 0.42} ${size * 0.40} ${size * 0.37} ${size * 0.45} ${size * 0.37} ${size * 0.51}
      C ${size * 0.37} ${size * 0.60} ${size * 0.63} ${size * 0.58} ${size * 0.63} ${size * 0.69}
      C ${size * 0.63} ${size * 0.76} ${size * 0.56} ${size * 0.78} ${size * 0.50} ${size * 0.78}
      C ${size * 0.43} ${size * 0.78} ${size * 0.38} ${size * 0.75} ${size * 0.36} ${size * 0.71}
      l ${size * 0.06} -${size * 0.04}
      C ${size * 0.43} ${size * 0.70} ${size * 0.46} ${size * 0.72} ${size * 0.50} ${size * 0.72}
      C ${size * 0.54} ${size * 0.72} ${size * 0.56} ${size * 0.69} ${size * 0.56} ${size * 0.67}
      C ${size * 0.56} ${size * 0.59} ${size * 0.30} ${size * 0.60} ${size * 0.30} ${size * 0.51}
      C ${size * 0.30} ${size * 0.41} ${size * 0.39} ${size * 0.35} ${size * 0.50} ${size * 0.35}
      C ${size * 0.57} ${size * 0.35} ${size * 0.63} ${size * 0.38} ${size * 0.67} ${size * 0.42}
      Z
    " fill="#FFFFFF" />
  </g>
</svg>`;
}

// 2. High-performance direct PNG encoder with anti-aliased shop silhouette and 'S'
function createPng(width, height, isMaskable = false) {
  const stride = width * 4 + 1;
  const rawData = Buffer.alloc(height * stride);

  const radius = isMaskable ? 0 : width * 0.22;
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * stride;
    rawData[rowOffset] = 0; // Filter byte: None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;

      // Check card boundary (rounded rect if not maskable)
      let insideCard = true;
      if (!isMaskable) {
        const dx = Math.abs(x - cx) - (width / 2 - radius);
        const dy = Math.abs(y - cy) - (height / 2 - radius);
        if (dx > 0 && dy > 0) {
          if (dx * dx + dy * dy > radius * radius) {
            insideCard = false;
          }
        }
      }

      if (!insideCard) {
        rawData[pixelOffset] = 0;
        rawData[pixelOffset + 1] = 0;
        rawData[pixelOffset + 2] = 0;
        rawData[pixelOffset + 3] = 0;
        continue;
      }

      // Base blue gradient (#2563EB to #1D4ED8)
      const gradT = y / height;
      let r = Math.round(37 * (1 - gradT) + 29 * gradT);
      let g = Math.round(99 * (1 - gradT) + 78 * gradT);
      let b = Math.round(235 * (1 - gradT) + 216 * gradT);
      let a = 255;

      // Scale coords to normalized 0..1
      const nx = x / width;
      const ny = y / height;

      let isForeground = false;

      // Roof pediment triangle
      if (ny >= 0.18 && ny <= 0.33) {
        const peakX = 0.5;
        const slope = (0.33 - 0.18) / 0.30; // height / half-width
        const allowedWidth = (ny - 0.18) / slope;
        if (Math.abs(nx - peakX) <= allowedWidth) {
          isForeground = true;
        }
      }

      // Roof arch trim
      if (ny >= 0.32 && ny <= 0.37 && nx >= 0.20 && nx <= 0.80) {
        isForeground = true;
      }

      // Left Pillar
      if (ny >= 0.37 && ny <= 0.81 && nx >= 0.22 && nx <= 0.30) {
        isForeground = true;
      }

      // Right Pillar
      if (ny >= 0.37 && ny <= 0.81 && nx >= 0.70 && nx <= 0.78) {
        isForeground = true;
      }

      // Ground Base
      if (ny >= 0.79 && ny <= 0.85 && nx >= 0.18 && nx <= 0.82) {
        isForeground = true;
      }

      // Center "S" Letter Shape
      // Upper loop of S
      const topCircY = 0.48;
      const botCircY = 0.67;
      const circX = 0.50;
      const dTop = Math.hypot(nx - circX, (ny - topCircY) * 1.1);
      const dBot = Math.hypot(nx - circX, (ny - botCircY) * 1.1);

      // Top arc (open on left bottom)
      if (dTop >= 0.05 && dTop <= 0.12 && ny <= 0.55 && (nx >= 0.40 || ny <= 0.48)) {
        isForeground = true;
      }
      // Bottom arc (open on right top)
      if (dBot >= 0.05 && dBot <= 0.12 && ny >= 0.58 && (nx <= 0.60 || ny >= 0.67)) {
        isForeground = true;
      }
      // Diagonal connector of S
      if (ny >= 0.52 && ny <= 0.62) {
        const targetX = 0.50 + (0.57 - ny) * 1.4;
        if (Math.abs(nx - targetX) < 0.045) {
          isForeground = true;
        }
      }

      if (isForeground) {
        r = 255;
        g = 255;
        b = 255;
        a = 255;
      }

      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  function crc32(buf) {
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ (-1)) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'binary');
    const toCrc = Buffer.concat([typeBuf, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(toCrc), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    header,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflated),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const publicDir = path.resolve(__dirname, '../public');

// Write SVGs
fs.writeFileSync(path.join(publicDir, 'icon-192.svg'), getSvg(192));
fs.writeFileSync(path.join(publicDir, 'icon-512.svg'), getSvg(512));
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), getSvg(64));

// Write PNGs
const png192 = createPng(192, 192, false);
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), png192);

const png512 = createPng(512, 512, false);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), png512);

const maskable512 = createPng(512, 512, true);
fs.writeFileSync(path.join(publicDir, 'maskable-icon-512.png'), maskable512);

// Apple touch icon
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), png192);

console.log('Icons generated successfully: SVGs and PNGs in public/');
