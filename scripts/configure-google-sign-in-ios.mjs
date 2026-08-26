import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const iosClientId = process.env.GOOGLE_IOS_CLIENT_ID?.trim()
const plistPath = resolve('ios/App/App/Info.plist')

if (!iosClientId) {
  console.warn(
    '[ios] GOOGLE_IOS_CLIENT_ID unset — skip Google Sign-In Info.plist (native Google login will not work until configured)',
  )
  process.exit(0)
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

let plist = await readFile(plistPath, 'utf8')

if (!plist.includes('<key>GIDClientID</key>')) {
  plist = plist.replace(
    '</dict>\n</plist>',
    `\t<key>GIDClientID</key>
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
</dict>
</plist>`,
  )
} else {
  plist = plist.replace(
    /<key>GIDClientID<\/key>\s*<string>[^<]*<\/string>/,
    `<key>GIDClientID</key>\n\t<string>${iosClientId}</string>`,
  )
  plist = plist.replace(
    /<key>CFBundleURLTypes<\/key>\s*<array>[\s\S]*?<\/array>/,
    `<key>CFBundleURLTypes</key>
\t<array>
\t\t<dict>
\t\t\t<key>CFBundleURLSchemes</key>
\t\t\t<array>
\t\t\t\t<string>${reversedScheme}</string>
\t\t\t</array>
\t\t</dict>
\t</array>`,
  )
}

await writeFile(plistPath, plist)
console.log('[ios] configured Google Sign-In (GIDClientID + URL scheme)')
