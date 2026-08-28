import { access, readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const clientDir = resolve('dist/client')
const assetsDir = resolve(clientDir, 'assets')
const serverAssetsDir = resolve('dist/server/assets')
const stylesRefPattern = /\/assets\/(styles-[A-Za-z0-9_-]+\.css)/g

await access(resolve(clientDir, 'offline.html'))
await access(resolve(clientDir, '.well-known/apple-app-site-association'))

const assets = await readdir(assetsDir)
const clientStylesFiles = assets.filter((name) => name.startsWith('styles-') && name.endsWith('.css'))
if (clientStylesFiles.length !== 1) {
  console.error(
    `[build] expected exactly one dist/client/assets/styles-*.css, found ${clientStylesFiles.length}`,
  )
  process.exit(1)
}
const clientStylesFile = clientStylesFiles[0]

async function collectServerStylesRefs() {
  const serverAssetFiles = await readdir(serverAssetsDir)
  const serverStylesRefs = new Set()

  for (const file of serverAssetFiles) {
    if (!file.endsWith('.js')) continue
    const source = await readFile(resolve(serverAssetsDir, file), 'utf8')
    for (const match of source.matchAll(stylesRefPattern)) {
      serverStylesRefs.add(match[1])
    }
  }

  return { serverAssetFiles, serverStylesRefs }
}

async function syncServerStylesReferences() {
  const { serverAssetFiles, serverStylesRefs } = await collectServerStylesRefs()

  if (serverStylesRefs.size === 0) {
    console.error('[build] missing styles-*.css reference in dist/server/assets')
    process.exit(1)
  }

  if (serverStylesRefs.has(clientStylesFile)) {
    return false
  }

  // TanStack Start can emit different hashed CSS names for client vs SSR bundles on
  // some platforms (notably linux/arm64). The client bundle is what we ship and serve.
  let patchedFiles = 0
  for (const stale of serverStylesRefs) {
    for (const file of serverAssetFiles) {
      if (!file.endsWith('.js')) continue
      const filePath = resolve(serverAssetsDir, file)
      const source = await readFile(filePath, 'utf8')
      if (!source.includes(stale)) continue
      await writeFile(filePath, source.replaceAll(stale, clientStylesFile), 'utf8')
      patchedFiles += 1
    }
  }

  console.log(
    `[build] synced server CSS refs (${[...serverStylesRefs].join(', ')} -> ${clientStylesFile}, ${patchedFiles} files)`,
  )
  return true
}

await syncServerStylesReferences()

const { serverStylesRefs } = await collectServerStylesRefs()
if (!serverStylesRefs.has(clientStylesFile)) {
  console.error(
    `[build] server/client CSS mismatch: client has ${clientStylesFile}, server references ${[...serverStylesRefs].join(', ')}`,
  )
  process.exit(1)
}

console.log(`[build] verified client bundle (${clientStylesFile}, offline.html, apple-app-site-association)`)
