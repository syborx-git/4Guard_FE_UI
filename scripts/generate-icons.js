const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPng(width, height) {
  // RGBA buffer: fill with gold background (#C59B27 -> R:197, G:155, B:39, A:255)
  // and navy rounded center
  const rawData = Buffer.alloc(height * (width * 4 + 1));

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 4 + 1);
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;

      // Border radius check
      const r = Math.min(width, height) * 0.18;
      const dx = Math.max(0, Math.max(r - x, x - (width - 1 - r)));
      const dy = Math.max(0, Math.max(r - y, y - (height - 1 - r)));
      const isOutsideCorner = Math.sqrt(dx * dx + dy * dy) > r;

      if (isOutsideCorner) {
        rawData[pixelOffset] = 0;
        rawData[pixelOffset + 1] = 0;
        rawData[pixelOffset + 2] = 0;
        rawData[pixelOffset + 3] = 0; // Transparent
      } else {
        // Metallic Gold background with slight gradient
        const t = (x + y) / (width + height);
        const rVal = Math.floor(212 * (1 - t) + 184 * t);
        const gVal = Math.floor(175 * (1 - t) + 134 * t);
        const bVal = Math.floor(55 * (1 - t) + 11 * t);

        rawData[pixelOffset] = rVal;
        rawData[pixelOffset + 1] = gVal;
        rawData[pixelOffset + 2] = bVal;
        rawData[pixelOffset + 3] = 255;
      }
    }
  }

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0; // Compression: Deflate
  ihdr[11] = 0; // Filter: 0
  ihdr[12] = 0; // Interlace: 0
  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT chunk
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(12 + length);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = calculateCrc(Buffer.concat([Buffer.from(type, 'ascii'), data]));
  chunk.writeInt32BE(crc, 8 + length);
  return chunk;
}

function calculateCrc(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return crc ^ 0xffffffff;
}

function createIco(pngBuffer) {
  // Minimal 1-image ICO containing PNG data
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 (ICO)
  header.writeUInt16LE(1, 4); // 1 Image

  const entry = Buffer.alloc(16);
  entry[0] = 32; // Width (32px)
  entry[1] = 32; // Height (32px)
  entry[2] = 0;  // Colors in palette
  entry[3] = 0;  // Reserved
  entry.writeUInt16LE(1, 4);  // Color planes
  entry.writeUInt16LE(32, 6); // Bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8); // Size
  entry.writeUInt32LE(22, 12); // Offset (6 header + 16 entry = 22)

  return Buffer.concat([header, entry, pngBuffer]);
}

const iconsDir = path.join(__dirname, '..', 'apps', 'rf-terminal', 'src', 'assets', 'icons');
const srcDir = path.join(__dirname, '..', 'apps', 'rf-terminal', 'src');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const sizes = [72, 96, 128, 144, 192, 512];
for (const s of sizes) {
  const png = createPng(s, s);
  const outPath = path.join(iconsDir, `icon-${s}x${s}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Created: ${outPath} (${png.length} bytes)`);
}

// Create favicon.ico (using 32x32 PNG inside)
const faviconPng = createPng(32, 32);
const ico = createIco(faviconPng);
fs.writeFileSync(path.join(srcDir, 'favicon.ico'), ico);
console.log(`Created: ${path.join(srcDir, 'favicon.ico')} (${ico.length} bytes)`);
