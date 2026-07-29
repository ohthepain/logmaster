import { copyFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const clientDir = resolve('dist/client')
const indexPath = resolve(clientDir, 'index.html')
const stubPath = resolve('capacitor/index.html')

await mkdir(clientDir, { recursive: true })
await copyFile(stubPath, indexPath)
console.log(`[capacitor] copied ${stubPath} -> ${indexPath}`)
