import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { generateSW } from 'workbox-build'

const clientDir = resolve('dist/client')
const swDest = resolve(clientDir, 'sw.js')

await access(resolve(clientDir, 'offline.html'))

const { count, size, warnings } = await generateSW({
  swDest,
  globDirectory: clientDir,
  globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,webmanifest}'],
  globIgnores: ['sw.js', 'sw.js.map'],
  navigateFallback: '/offline.html',
  navigateFallbackDenylist: [/^\/api\//],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  runtimeCaching: [
    {
      urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
      handler: 'NetworkOnly',
    },
    {
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'logmaster-pages',
        networkTimeoutSeconds: 3,
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 60 * 60 * 24,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
  ],
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
})

if (warnings.length > 0) {
  console.warn('[pwa] workbox warnings:\n', warnings.join('\n'))
}

console.log(
  `[pwa] generated ${swDest} (${count} files, ${(size / 1024).toFixed(1)} KB precache)`,
)
