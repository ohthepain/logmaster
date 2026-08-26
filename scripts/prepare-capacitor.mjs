import { copyFile, mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'

/** Minimal placeholder only — native shells load the deployed web app via Capacitor server.url. */
const clientDir = resolve('dist/client')
const indexPath = resolve(clientDir, 'index.html')
const stubPath = resolve('capacitor/index.html')

await rm(clientDir, { recursive: true, force: true })
await mkdir(clientDir, { recursive: true })
await copyFile(stubPath, indexPath)
console.log(`[capacitor] webDir stub only (no bundled app): ${indexPath}`)
