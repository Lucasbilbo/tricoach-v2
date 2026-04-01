/**
 * generate-icons.js — genera iconos PWA con Node.js built-ins (sin dependencias)
 * Fondo negro (#080808), "T" blanca centrada en serif bold, punto naranja (#FF6B2B)
 * en la esquina superior derecha de la T — evocando el "ai" del wordmark.
 *
 * Uso: node scripts/generate-icons.js
 */
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

// CRC32 implementation para PNG chunks
function makeCrc32Table() {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  return table
}
const CRC_TABLE = makeCrc32Table()

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const name = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcVal = Buffer.alloc(4)
  crcVal.writeUInt32BE(crc32(Buffer.concat([name, data])), 0)
  return Buffer.concat([len, name, data, crcVal])
}

function generateIcon(size) {
  const bg = [8, 8, 8]       // #080808
  const white = [255, 255, 255]
  const orange = [255, 107, 43] // #FF6B2B

  // Pixel grid (flat array: y*size + x → [r,g,b])
  const px = new Array(size * size).fill(null).map(() => [...bg])

  const sc = size / 192

  // Helper: fill rectangle with color
  function fillRect(x0, y0, x1, y1, color) {
    for (let y = Math.floor(y0 * sc); y < Math.floor(y1 * sc); y++) {
      for (let x = Math.floor(x0 * sc); x < Math.floor(x1 * sc); x++) {
        if (x >= 0 && x < size && y >= 0 && y < size) px[y * size + x] = [...color]
      }
    }
  }

  // Helper: fill circle with color
  function fillCircle(cx, cy, r, color) {
    const cx2 = Math.floor(cx * sc)
    const cy2 = Math.floor(cy * sc)
    const r2 = Math.floor(r * sc)
    for (let y = cy2 - r2; y <= cy2 + r2; y++) {
      for (let x = cx2 - r2; x <= cx2 + r2; x++) {
        if (x >= 0 && x < size && y >= 0 && y < size) {
          if ((x - cx2) ** 2 + (y - cy2) ** 2 <= r2 ** 2) px[y * size + x] = [...color]
        }
      }
    }
  }

  // T horizontal bar: x 38–154, y 38–78 (192px reference)
  fillRect(38, 38, 154, 78, white)
  // T vertical bar: x 82–110, y 78–158
  fillRect(82, 78, 110, 158, white)
  // Orange dot: cx 142, cy 44, r 14
  fillCircle(142, 44, 14, orange)

  // Build PNG raw data (filter byte 0 = None per row)
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3)
    row[0] = 0 // filter: None
    for (let x = 0; x < size; x++) {
      const [r, g, b] = px[y * size + x]
      row[1 + x * 3] = r
      row[2 + x * 3] = g
      row[3 + x * 3] = b
    }
    rows.push(row)
  }
  const raw = Buffer.concat(rows)
  const compressed = zlib.deflateSync(raw, { level: 6 })

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(size, 0)
  ihdrData.writeUInt32BE(size, 4)
  ihdrData[8] = 8  // bit depth
  ihdrData[9] = 2  // color type: RGB
  ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdrData),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const publicDir = path.join(__dirname, '..', 'public')
fs.mkdirSync(publicDir, { recursive: true })

fs.writeFileSync(path.join(publicDir, 'icon-192.png'), generateIcon(192))
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), generateIcon(512))

console.log('✓ public/icon-192.png')
console.log('✓ public/icon-512.png')
