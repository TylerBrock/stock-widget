// Generates assets/icon.png — a 22x22 bar-chart template icon for the macOS menubar.
// Uses only Node.js builtins (no native deps).
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

function crc32(buf) {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

const W = 22, H = 22
// Grayscale + alpha (type 4): black pixels = template image on macOS
const pixels = new Uint8Array(W * H * 2) // [gray, alpha] per pixel

// Draw 4 vertical bars of increasing height (bar chart)
const bars = [
  { x: 2, w: 3, h: 8 },
  { x: 7, w: 3, h: 13 },
  { x: 12, w: 3, h: 10 },
  { x: 17, w: 3, h: 18 },
]
const baseline = H - 2

for (const { x, w, h } of bars) {
  for (let bx = x; bx < x + w && bx < W; bx++) {
    for (let by = baseline - h; by <= baseline && by < H; by++) {
      if (by >= 0) {
        const i = (by * W + bx) * 2
        pixels[i] = 0       // black
        pixels[i + 1] = 255 // fully opaque
      }
    }
  }
}

// Baseline stroke
for (let bx = 0; bx < W; bx++) {
  const i = (baseline * W + bx) * 2
  pixels[i] = 0
  pixels[i + 1] = 200
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0)
ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8  // bit depth
ihdr[9] = 4  // grayscale + alpha
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

const rows = []
for (let y = 0; y < H; y++) {
  rows.push(Buffer.from([0]))
  rows.push(Buffer.from(pixels.subarray(y * W * 2, (y + 1) * W * 2)))
}
const compressed = zlib.deflateSync(Buffer.concat(rows), { level: 9 })

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk('IHDR', ihdr),
  pngChunk('IDAT', compressed),
  pngChunk('IEND', Buffer.alloc(0)),
])

const outDir = path.join(__dirname, '../assets')
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'icon.png'), png)
console.log('✓ Generated assets/icon.png')
