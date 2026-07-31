import { Hono } from 'hono'
import sharp from 'sharp'

/** Light chart label color — matches `SailingMapColors.label`. */
const LIGHT_LABEL = { r: 232, g: 238, b: 244 }

const UPSTREAM = 'https://tiles.openseamap.org/seamark'

export const openseamapSeamarkRoutes = new Hono()

function parseTileParam(seg: string): number {
  const s = seg.replace(/\.png$/i, '')
  return Number(s)
}

/** Dark neutral pixels in OpenSeaMap raster tiles → light labels for dark basemaps. */
function lightenDarkSeamarkLabels(data: Buffer) {
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    if (alpha < 8) continue

    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const lum = (r + g + b) / 3
    const sat = max === 0 ? 0 : (max - min) / max

    // Recolor near-black / gray text and hairlines; leave saturated buoy colors.
    if (lum < 96 && sat < 0.4) {
      data[i] = LIGHT_LABEL.r
      data[i + 1] = LIGHT_LABEL.g
      data[i + 2] = LIGHT_LABEL.b
    }
  }
}

openseamapSeamarkRoutes.get('/:z/:x/:y', async (c) => {
  const z = parseTileParam(c.req.param('z') ?? '')
  const x = parseTileParam(c.req.param('x') ?? '')
  const y = parseTileParam(c.req.param('y') ?? '')

  if (!Number.isInteger(z) || z < 0 || z > 22) {
    return c.text('Invalid z', 400)
  }
  const n = 2 ** z
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= n ||
    y >= n
  ) {
    return c.text('Invalid tile', 400)
  }

  const variant = c.req.query('variant') ?? 'dark'
  const upstream = `${UPSTREAM}/${z}/${x}/${y}.png`

  const response = await fetch(upstream, {
    headers: { Accept: 'image/png,*/*' },
  })
  if (!response.ok) {
    return c.text('Upstream error', 502)
  }

  const input = Buffer.from(await response.arrayBuffer())
  if (variant === 'light') {
    c.header('Content-Type', 'image/png')
    c.header('Cache-Control', 'public, max-age=86400, immutable')
    return c.body(input)
  }

  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const pixels = Buffer.from(data)
  lightenDarkSeamarkLabels(pixels)

  const output = await sharp(pixels, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer()

  c.header('Content-Type', 'image/png')
  c.header('Cache-Control', 'public, max-age=86400, immutable')
  return c.body(output)
})
