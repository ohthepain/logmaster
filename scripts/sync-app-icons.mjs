import { copyFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'

const source = resolve('public/AppIcons/Assets.xcassets/AppIcon.appiconset/1024.png')

const iosDir = resolve('ios/App/App/Assets.xcassets/AppIcon.appiconset')
const iosTarget = resolve(iosDir, 'AppIcon-512@2x.png')
await mkdir(iosDir, { recursive: true })
await copyFile(source, iosTarget)
console.log(`[ios] synced app icon -> ${iosTarget}`)

const androidDensities = [
  { folder: 'mipmap-mdpi', launcher: 48, foreground: 108 },
  { folder: 'mipmap-hdpi', launcher: 72, foreground: 162 },
  { folder: 'mipmap-xhdpi', launcher: 96, foreground: 216 },
  { folder: 'mipmap-xxhdpi', launcher: 144, foreground: 324 },
  { folder: 'mipmap-xxxhdpi', launcher: 192, foreground: 432 },
]

for (const { folder, launcher, foreground } of androidDensities) {
  const resDir = resolve('android/app/src/main/res', folder)
  const publicDir = resolve('public/AppIcons/android', folder)
  await mkdir(resDir, { recursive: true })
  await mkdir(publicDir, { recursive: true })

  const launcherPng = await sharp(source).resize(launcher, launcher).png().toBuffer()
  await sharp(launcherPng).toFile(resolve(resDir, 'ic_launcher.png'))
  await sharp(launcherPng).toFile(resolve(resDir, 'ic_launcher_round.png'))
  await sharp(launcherPng).toFile(resolve(publicDir, 'ic_launcher.png'))
  await sharp(source).resize(foreground, foreground).png().toFile(resolve(resDir, 'ic_launcher_foreground.png'))
}

console.log('[android] synced launcher, round, and adaptive foreground icons')
