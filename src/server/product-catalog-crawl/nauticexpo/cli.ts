import 'dotenv/config'
import { resolveSeedProfile } from './manufacturers'
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

function readRepeatedStringFlag(name: string) {
  const values: string[] = []
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] !== name) continue
    const value = process.argv[i + 1]
    if (value && !value.startsWith('--')) values.push(value)
  }
  return values.length > 0 ? values : null
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
  const seedProfile = resolveSeedProfile(readStringFlag('--seed'))
  const manufacturerUrls = readRepeatedStringFlag('--manufacturer-url')
  const searchKeywords = readRepeatedStringFlag('--keyword')

  const provider = useLocal
    ? 'local'
    : useApify || apifyRunId
      ? 'apify'
      : undefined

  const result = await runNauticExpoCatalogCrawl({
    seedProfile,
    manufacturerUrls,
    searchKeywords,
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
