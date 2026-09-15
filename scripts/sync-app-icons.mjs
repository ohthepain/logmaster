import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import pngToIco from 'png-to-ico'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..')
const source = resolve(root, 'public/logo_trans_512.png')
const BLACK = { r: 0, g: 0, b: 0 }

async function resizeTransparent(size) {
  return sharp(source).resize(size, size, { kernel: 'lanczos3' }).png().toBuffer()
}

async function flattenOnBlack(size) {
  return sharp(source)
    .resize(size, size, { kernel: 'lanczos3' })
    .flatten({ background: BLACK })
    .removeAlpha()
    .png()
    .toBuffer()
}

async function iconOnCanvas(size, { scale, flatten }) {
  const inner = Math.round(size * scale)
  const icon = flatten
    ? await flattenOnBlack(inner)
    : await resizeTransparent(inner)
  const canvas = flatten
    ? { width: size, height: size, channels: 3, background: BLACK }
    : {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      }
  let pipeline = sharp({ create: canvas }).composite([
    { input: icon, gravity: 'center' },
  ])
  if (flatten) pipeline = pipeline.removeAlpha()
  return pipeline.png().toBuffer()
}

async function writePng(path, buffer) {
  await mkdir(resolve(path, '..'), { recursive: true })
  await writeFile(path, buffer)
}

const publicDir = resolve(root, 'public')
const appIconDir = resolve(
  publicDir,
  'AppIcons/Assets.xcassets/AppIcon.appiconset',
)

const transparent512 = await resizeTransparent(512)
await writePng(resolve(publicDir, 'logmaster_logo_transparent.png'), transparent512)
await writePng(resolve(publicDir, 'logmaster_logo_trans_crop.png'), transparent512)
await writePng(resolve(publicDir, 'logo512.png'), await flattenOnBlack(512))
await writePng(resolve(publicDir, 'logo192.png'), await flattenOnBlack(192))
await writePng(
  resolve(publicDir, 'logo512-maskable.png'),
  await iconOnCanvas(512, { scale: 0.8, flatten: true }),
)
await writePng(resolve(publicDir, 'favicon-16.png'), await resizeTransparent(16))
await writePng(resolve(publicDir, 'favicon-32.png'), await resizeTransparent(32))
await writePng(
  resolve(publicDir, 'apple-touch-icon.png'),
  await flattenOnBlack(180),
)
await writePng(
  resolve(publicDir, 'android-chrome-192x192.png'),
  await flattenOnBlack(192),
)
await writePng(
  resolve(publicDir, 'android-chrome-512x512.png'),
  await flattenOnBlack(512),
)

const favicon16 = await resizeTransparent(16)
const favicon32 = await resizeTransparent(32)
const favicon48 = await resizeTransparent(48)
await writeFile(
  resolve(publicDir, 'favicon.ico'),
  await pngToIco([favicon16, favicon32, favicon48]),
)

const store1024 = await flattenOnBlack(1024)
await writePng(resolve(appIconDir, '1024.png'), store1024)
await writePng(resolve(publicDir, 'AppIcons/appstore.png'), store1024)
await writePng(
  resolve(publicDir, 'AppIcons/playstore.png'),
  await flattenOnBlack(512),
)

const contents = JSON.parse(
  await readFile(resolve(appIconDir, 'Contents.json'), 'utf8'),
)
const sizesByFile = new Map()
for (const image of contents.images) {
  const size = Number(image['expected-size'])
  if (!image.filename || !Number.isFinite(size)) continue
  sizesByFile.set(
    image.filename,
    Math.max(sizesByFile.get(image.filename) ?? 0, size),
  )
}
for (const [filename, size] of sizesByFile) {
  await writePng(
    resolve(appIconDir, filename),
    size === 1024 ? store1024 : await flattenOnBlack(size),
  )
}

const iosDir = resolve(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset')
const iosTarget = resolve(iosDir, 'AppIcon-512@2x.png')
await mkdir(iosDir, { recursive: true })
await copyFile(resolve(appIconDir, '1024.png'), iosTarget)
console.log(`[ios] synced app icon -> ${iosTarget}`)

const androidDensities = [
  { folder: 'mipmap-mdpi', launcher: 48, foreground: 108 },
  { folder: 'mipmap-hdpi', launcher: 72, foreground: 162 },
  { folder: 'mipmap-xhdpi', launcher: 96, foreground: 216 },
  { folder: 'mipmap-xxhdpi', launcher: 144, foreground: 324 },
  { folder: 'mipmap-xxxhdpi', launcher: 192, foreground: 432 },
]

for (const { folder, launcher, foreground } of androidDensities) {
  const resDir = resolve(root, 'android/app/src/main/res', folder)
  const publicAndroidDir = resolve(publicDir, 'AppIcons/android', folder)
  await mkdir(resDir, { recursive: true })
  await mkdir(publicAndroidDir, { recursive: true })

  const launcherPng = await flattenOnBlack(launcher)
  await writePng(resolve(resDir, 'ic_launcher.png'), launcherPng)
  await writePng(resolve(resDir, 'ic_launcher_round.png'), launcherPng)
  await writePng(resolve(publicAndroidDir, 'ic_launcher.png'), launcherPng)
  await writePng(
    resolve(resDir, 'ic_launcher_foreground.png'),
    await iconOnCanvas(foreground, { scale: 0.66, flatten: false }),
  )
}

const androidBg = resolve(
  root,
  'android/app/src/main/res/values/ic_launcher_background.xml',
)
await writeFile(
  androidBg,
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#000000</color>
</resources>
`,
)

console.log('[web] generated favicons, PWA icons, and in-app logos')
console.log('[android] synced launcher, round, and adaptive foreground icons')
