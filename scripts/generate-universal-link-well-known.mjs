import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const pathsConfig = JSON.parse(
  readFileSync(resolve(root, 'config/universal-link-paths.json'), 'utf8'),
)
const androidConfigPath = resolve(
  root,
  'config/android-app-link-fingerprints.json',
)
const androidConfig = JSON.parse(readFileSync(androidConfigPath, 'utf8'))

const paths = pathsConfig.paths
if (!Array.isArray(paths) || paths.length === 0) {
  throw new Error('config/universal-link-paths.json must list at least one path')
}

const aasa = {
  applinks: {
    apps: [],
    details: [
      {
        appID: 'RPGSNMH65P.live.logmaster.app',
        paths,
      },
    ],
  },
}

const wellKnownDir = resolve(root, 'public/.well-known')
writeFileSync(
  resolve(wellKnownDir, 'apple-app-site-association'),
  `${JSON.stringify(aasa, null, 2)}\n`,
)

const envFingerprints = (process.env.ANDROID_APP_LINK_SHA256_FINGERPRINTS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const fingerprints = [
  ...new Set([
    ...(androidConfig.sha256_cert_fingerprints ?? []),
    ...envFingerprints,
  ]),
]

const assetlinks = [
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: androidConfig.package_name ?? 'live.logmaster.app',
      sha256_cert_fingerprints: fingerprints,
    },
  },
]

writeFileSync(
  resolve(wellKnownDir, 'assetlinks.json'),
  `${JSON.stringify(assetlinks, null, 2)}\n`,
)

if (fingerprints.length === 0) {
  console.warn(
    '[app-links] assetlinks.json has no SHA-256 fingerprints — Android App Link verification will fail until you add them (see docs/app-links.md).',
  )
} else {
  console.log(
    `[app-links] wrote apple-app-site-association (${paths.length} paths) and assetlinks.json (${fingerprints.length} fingerprint(s))`,
  )
}
