import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: resolve('.env') })
loadEnv({ path: resolve('ios/fastlane/.env') })

const iosClientId = process.env.GOOGLE_IOS_CLIENT_ID?.trim()
const plistPath = resolve('ios/App/App/Info.plist')

if (!iosClientId) {
  console.error(`
[ios] GOOGLE_IOS_CLIENT_ID is required for native Google Sign-In.

1. Google Cloud Console → APIs & Credentials → Create credentials → OAuth client ID → iOS
   Bundle ID: live.logmaster.app
2. Add to ios/fastlane/.env (or project .env):
   GOOGLE_IOS_CLIENT_ID=123456789-xxxx.apps.googleusercontent.com
3. Re-run: pnpm ios:beta
`)
  process.exit(1)
}

const reversedScheme = iosClientId.includes('.apps.googleusercontent.com')
  ? `com.googleusercontent.apps.${iosClientId.split('.apps.googleusercontent.com')[0]}`
  : iosClientId.startsWith('com.googleusercontent.apps.')
    ? iosClientId
    : null

if (!reversedScheme) {
  console.error(
    '[ios] GOOGLE_IOS_CLIENT_ID must be an iOS OAuth client id (*.apps.googleusercontent.com)',
  )
  process.exit(1)
}

const googleBlock = `\t<key>GIDClientID</key>
\t<string>${iosClientId}</string>
\t<key>CFBundleURLTypes</key>
\t<array>
\t\t<dict>
\t\t\t<key>CFBundleURLSchemes</key>
\t\t\t<array>
\t\t\t\t<string>${reversedScheme}</string>
\t\t\t</array>
\t\t</dict>
\t</array>
`

let plist = await readFile(plistPath, 'utf8')

plist = plist.replace(/\t<key>GIDClientID<\/key>[\s\S]*?(?=\n<\/dict>)/, '')
plist = plist.replace(/\n<\/dict>\s*<\/plist>\s*$/, `\n${googleBlock}</dict>\n</plist>\n`)

await writeFile(plistPath, plist)

try {
  execFileSync('plutil', ['-lint', plistPath], { stdio: 'pipe' })
} catch (err) {
  console.error('[ios] Info.plist is invalid after Google Sign-In configuration')
  if (err && typeof err === 'object' && 'stderr' in err && err.stderr) {
    console.error(String(err.stderr))
  }
  process.exit(1)
}

console.log('[ios] configured Google Sign-In (GIDClientID + URL scheme)')
