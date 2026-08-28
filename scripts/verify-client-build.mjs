import { access, readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const clientDir = resolve('dist/client')
const assetsDir = resolve(clientDir, 'assets')
const serverAssetsDir = resolve('dist/server/assets')

await access(resolve(clientDir, 'offline.html'))
await access(resolve(clientDir, '.well-known/apple-app-site-association'))

const assets = await readdir(assetsDir)
const stylesCss = assets.find((name) => name.startsWith('styles-') && name.endsWith('.css'))
if (!stylesCss) {
  console.error('[build] missing dist/client/assets/styles-*.css')
  process.exit(1)
}

const serverAssetFiles = await readdir(serverAssetsDir)
const stylesRefPattern = /\/assets\/(styles-[A-Za-z0-9_-]+\.css)/g
const serverStylesRefs = new Set()

for (const file of serverAssetFiles) {
  if (!file.endsWith('.js')) continue
  const source = await readFile(resolve(serverAssetsDir, file), 'utf8')
  for (const match of source.matchAll(stylesRefPattern)) {
    serverStylesRefs.add(match[1])
  }
}

if (serverStylesRefs.size === 0) {
  console.error('[build] missing styles-*.css reference in dist/server/assets')
  process.exit(1)
}

if (!serverStylesRefs.has(stylesCss)) {
  console.error(
    `[build] server/client CSS mismatch: client has ${stylesCss}, server references ${[...serverStylesRefs].join(', ')}`,
  )
  process.exit(1)
}

console.log(`[build] verified client bundle (${stylesCss}, offline.html, apple-app-site-association)`)
