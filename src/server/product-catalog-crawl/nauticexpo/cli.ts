import 'dotenv/config'
import { runNauticExpoCatalogCrawl } from './run'

function readFlag(name: string) {
  return process.argv.includes(name)
}

function readNumberFlag(name: string) {
  const index = process.argv.indexOf(name)
  if (index === -1) return null
  const raw = process.argv[index + 1]
  if (!raw) return null
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) ? value : null
}

function readStringFlag(name: string) {
  const index = process.argv.indexOf(name)
  if (index === -1) return null
  return process.argv[index + 1] ?? null
}

async function main() {
  const dryRun = readFlag('--dry-run')
  const markMissingRemoved = readFlag('--mark-missing-removed')
  const useLocal = readFlag('--local')
  const useApify = readFlag('--apify')
  const maxProducts = readNumberFlag('--max-products')
  const maxPages = readNumberFlag('--max-pages')
  const resumeRunId = readStringFlag('--resume')
  const storageDir = readStringFlag('--storage-dir')
  const apifyRunId = readStringFlag('--apify-run-id')

  const provider = useLocal ? 'local' : useApify || apifyRunId ? 'apify' : undefined

  const result = await runNauticExpoCatalogCrawl({
    seedProfile: 'equipment',
    provider,
    apifyRunId,
    dryRun,
    markMissingRemoved,
    maxProducts,
    maxPages,
    resumeRunId,
    storageDir,
  })

  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
