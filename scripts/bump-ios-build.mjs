import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const pbxprojPath = resolve('ios/App/App.xcodeproj/project.pbxproj')

const pbxproj = await readFile(pbxprojPath, 'utf8')
const match = pbxproj.match(/CURRENT_PROJECT_VERSION = (\d+);/)
if (!match) {
  console.error('[ios] CURRENT_PROJECT_VERSION not found in project.pbxproj')
  process.exit(1)
}

const next = Number.parseInt(match[1], 10) + 1
const updated = pbxproj.replace(
  /CURRENT_PROJECT_VERSION = \d+;/g,
  `CURRENT_PROJECT_VERSION = ${next};`,
)

await writeFile(pbxprojPath, updated)
console.log(`[ios] bumped build number to ${next}`)
