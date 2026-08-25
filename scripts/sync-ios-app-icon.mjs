import { copyFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const source = resolve('public/AppIcons/Assets.xcassets/AppIcon.appiconset/1024.png')
const targetDir = resolve('ios/App/App/Assets.xcassets/AppIcon.appiconset')
const target = resolve(targetDir, 'AppIcon-512@2x.png')

await mkdir(targetDir, { recursive: true })
await copyFile(source, target)
console.log(`[ios] synced app icon ${source} -> ${target}`)
