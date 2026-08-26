import { access, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const clientDir = resolve('dist/client')
const assetsDir = resolve(clientDir, 'assets')

await access(resolve(clientDir, 'offline.html'))

const assets = await readdir(assetsDir)
const stylesCss = assets.find((name) => name.startsWith('styles-') && name.endsWith('.css'))
if (!stylesCss) {
  console.error('[build] missing dist/client/assets/styles-*.css')
  process.exit(1)
}

console.log(`[build] verified client bundle (${stylesCss}, offline.html)`)
