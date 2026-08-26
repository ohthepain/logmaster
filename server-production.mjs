import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
/**
 * TanStack Start's Vite build emits a Web Fetch handler only (no HTTP listen).
 * Running `node dist/server/server.js` loads the module and exits — ECS sees
 * "Essential container exited" with no CloudWatch logs. This file binds the
 * handler to Node's HTTP server (0.0.0.0 for Fargate/ALB health checks).
 */
import { serve } from '@hono/node-server'
import server from './dist/server/server.js'

const port = Number(process.env.PORT) || 3000
const hostname = process.env.HOST ?? '0.0.0.0'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const viteClientDir = path.join(__dirname, 'dist', 'client')

const mimeByExt = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'application/javascript; charset=utf-8',
	'.mjs': 'application/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.webmanifest': 'application/manifest+json; charset=utf-8',
	'.wasm': 'application/wasm',
	'.svg': 'image/svg+xml; charset=utf-8',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.ico': 'image/x-icon',
	'.map': 'application/json; charset=utf-8',
	'.txt': 'text/plain; charset=utf-8',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.eot': 'application/vnd.ms-fontobject',
}

function getMimeType(filePath) {
	const ext = path.extname(filePath).toLowerCase()
	return mimeByExt[ext] ?? 'application/octet-stream'
}

function cacheControlForPath(pathname) {
	if (pathname === '/sw.js' || pathname === '/manifest.webmanifest') {
		return 'no-cache'
	}
	if (pathname.startsWith('/assets/')) {
		return 'public, max-age=31536000, immutable'
	}
	return 'public, max-age=3600'
}

async function tryServeStaticFile(req) {
	const url = new URL(req.url)
	const pathname = url.pathname

	let relPath
	try {
		relPath = decodeURIComponent(pathname.slice(1))
	} catch {
		return null
	}
	if (!relPath) return null

	const ext = path.extname(relPath).toLowerCase()
	if (!mimeByExt[ext]) return null

	const filePath = path.resolve(viteClientDir, relPath)
	if (!filePath.startsWith(viteClientDir + path.sep)) return null

	try {
		const data = await fs.readFile(filePath)
		return new Response(data, {
			status: 200,
			headers: {
				'content-type': getMimeType(filePath),
				'cache-control': cacheControlForPath(pathname),
			},
		})
	} catch (err) {
		if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') return null
		throw err
	}
}

serve(
	{
		fetch: async (req) => {
			const assetResponse = await tryServeStaticFile(req)
			return assetResponse ?? server.fetch(req)
		},
		port,
		hostname,
	},
	(info) => {
		console.log(`Listening on http://${hostname}:${info.port}`)
	},
)
