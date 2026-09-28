import { access, copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { generateSW } from 'workbox-build'

const clientDir = resolve('dist/client')
const swDest = resolve(clientDir, 'sw.js')
const pushHandlerSource = resolve('public/push-sw.js')
const pushHandlerDest = resolve(clientDir, 'push-sw.js')

await access(resolve(clientDir, 'offline.html'))
await access(pushHandlerSource)
await copyFile(pushHandlerSource, pushHandlerDest)

const { count, size, warnings } = await generateSW({
  swDest,
  globDirectory: clientDir,
  globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,webmanifest}'],
  globIgnores: ['sw.js', 'sw.js.map'],
  importScripts: ['push-sw.js'],
  navigateFallbackDenylist: [
    /^\/api\//,
    /^\/sign-in/,
    /^\/reset-password/,
  ],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  runtimeCaching: [
    {
      urlPattern: ({ url }) =>
        url.pathname.startsWith('/api/map-tiles/') ||
        url.pathname.startsWith('/api/maptiler-cdn') ||
        url.pathname.startsWith('/api/openseamap-seamark/') ||
        url.pathname.startsWith('/api/openseamap-bathymetry/relief/'),
      handler: 'CacheFirst',
      options: {
        cacheName: 'logmaster-map-tiles',
        expiration: {
          maxEntries: 6000,
          maxAgeSeconds: 30 * 24 * 60 * 60,
          purgeOnQuotaError: true,
        },
        cacheableResponse: {
          statuses: [200],
        },
      },
    },
    {
      urlPattern: ({ url }) =>
        url.pathname.startsWith('/api/marinas/') ||
        url.pathname.startsWith('/api/osm-points/') ||
        url.pathname.startsWith('/api/geo-features/'),
      handler: 'CacheFirst',
      options: {
        cacheName: 'logmaster-degree-tiles',
        expiration: {
          maxEntries: 1500,
          maxAgeSeconds: 7 * 24 * 60 * 60,
          purgeOnQuotaError: true,
        },
        cacheableResponse: {
          statuses: [200],
        },
      },
    },
    {
      urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
      handler: 'NetworkOnly',
    },
    {
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'logmaster-pages',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 16,
          maxAgeSeconds: 60 * 60,
        },
        cacheableResponse: {
          statuses: [200],
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
