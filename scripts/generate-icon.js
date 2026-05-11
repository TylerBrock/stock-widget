// Generates assets/icon.png — 512x512 app icon for electron-builder.
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

const W = 512, H = 512
// RGBA pixels
const pixels = new Uint8Array(W * H * 4)

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return
  const i = (y * W + x) * 4
  pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b; pixels[i+3] = a
}

function fillRect(x, y, w, h, r, g, b, a = 255) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      setPixel(x + dx, y + dy, r, g, b, a)
}

function drawLine(x0, y0, x1, y1, thickness, r, g, b) {
  const dx = x1 - x0, dy = y1 - y0
  const steps = Math.max(Math.abs(dx), Math.abs(dy))
  const half = Math.floor(thickness / 2)
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps
    const px = Math.round(x0 + dx * t)
    const py = Math.round(y0 + dy * t)
    for (let oy = -half; oy <= half; oy++)
      for (let ox = -half; ox <= half; ox++)
        setPixel(px + ox, py + oy, r, g, b)
  }
}

// Background: dark #1c1c1e
fillRect(0, 0, W, H, 28, 28, 30)

// Chart points — upward trending line with a dip
const points = [
  [64, 340], [128, 310], [192, 330], [256, 250], [320, 220], [384, 180], [448, 140],
]

// Green fill under the line
for (let i = 0; i < points.length - 1; i++) {
  const [x0, y0] = points[i]
  const [x1, y1] = points[i + 1]
  const steps = Math.abs(x1 - x0)
  for (let s = 0; s <= steps; s++) {
    const t = s / steps
    const px = Math.round(x0 + (x1 - x0) * t)
    const py = Math.round(y0 + (y1 - y0) * t)
    for (let fy = py; fy < 390; fy++)
      setPixel(px, fy, 110, 231, 183, 28)
  }
}

// Green line
for (let i = 0; i < points.length - 1; i++) {
  const [x0, y0] = points[i]
  const [x1, y1] = points[i + 1]
  drawLine(x0, y0, x1, y1, 14, 110, 231, 183)
}

// Dots at each point
for (const [px, py] of points) {
  const r = 14
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++)
      if (dx*dx + dy*dy <= r*r)
        setPixel(px + dx, py + dy, 110, 231, 183)
}

// Build PNG (RGBA = color type 6)
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(W, 0)
ihdr.writeUInt32BE(H, 4)
ihdr[8] = 8   // bit depth
ihdr[9] = 6   // RGBA
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

const rows = []
for (let y = 0; y < H; y++) {
  rows.push(Buffer.from([0]))
  rows.push(Buffer.from(pixels.subarray(y * W * 4, (y + 1) * W * 4)))
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
console.log('✓ Generated assets/icon.png (512x512)')
