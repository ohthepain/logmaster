import { useCallback, useState } from 'react'
import { NAUTICEXPO_CRAWL_SEED_OPTIONS } from '../../lib/nauticexpo-manufacturer-presets'
import type { NauticExpoSeedProfile } from '../../lib/nauticexpo-manufacturer-presets'

type AdminProductCatalogCrawlPanelProps = {
  onQueued?: () => void
}

export function AdminProductCatalogCrawlPanel({
  onQueued,
}: AdminProductCatalogCrawlPanelProps) {
  const [seedProfile, setSeedProfile] =
    useState<NauticExpoSeedProfile>('equipment')
  const [maxProducts, setMaxProducts] = useState('0')
  const [maxPages, setMaxPages] = useState('50')
  const [apifyRunId, setApifyRunId] = useState('')
  const [dryRun, setDryRun] = useState(false)
  const [markMissingRemoved, setMarkMissingRemoved] = useState(false)
  const [enqueueing, setEnqueueing] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [lastJobId, setLastJobId] = useState<string | null>(null)

  const queueCrawl = useCallback(async () => {
    setErr(null)
    setLastJobId(null)
    setEnqueueing(true)
    try {
      const parsedMaxProducts = Number.parseInt(maxProducts, 10)
      const parsedMaxPages = Number.parseInt(maxPages, 10)
      const body: Record<string, unknown> = {
        seedProfile,
        dryRun,
        markMissingRemoved,
        provider: 'apify',
      }
      if (Number.isInteger(parsedMaxProducts)) {
        body.maxProducts = parsedMaxProducts
      }
      if (Number.isInteger(parsedMaxPages)) {
        body.maxPages = parsedMaxPages
      }
      const trimmedApifyRunId = apifyRunId.trim()
      if (trimmedApifyRunId) {
        body.apifyRunId = trimmedApifyRunId
      }

      const response = await fetch(
        '/api/admin/jobs/product-catalog-nauticexpo/runs',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      if (!response.ok) {
        setErr(await response.text())
        return
      }
      const payload = (await response.json()) as { jobId: string }
      setLastJobId(payload.jobId)
      onQueued?.()
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Request failed')
    } finally {
      setEnqueueing(false)
    }
  }, [
    apifyRunId,
    dryRun,
    markMissingRemoved,
    maxPages,
    maxProducts,
    onQueued,
    seedProfile,
  ])

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-[var(--line)] bg-[var(--header-bg)]/40 p-4">
      <div>
        <h2 className="m-0 text-base font-semibold text-[var(--sea-ink)]">
          Queue NauticExpo crawl
        </h2>
        <p className="m-0 mt-1 text-sm text-[var(--sea-ink-soft)]">
          Runs on the pg-boss worker via Apify (needs{' '}
          <code className="text-xs">APIFY_TOKEN</code> on the worker). Large
          manufacturer stands can take up to an hour.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm text-[var(--sea-ink)]">
        <span className="font-medium">Seed</span>
        <select
          value={seedProfile}
          onChange={(event) =>
            setSeedProfile(event.target.value as NauticExpoSeedProfile)
          }
          className="rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
        >
          {NAUTICEXPO_CRAWL_SEED_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-[var(--sea-ink)]">
          <span className="font-medium">Max products</span>
          <input
            type="number"
            value={maxProducts}
            onChange={(event) => setMaxProducts(event.target.value)}
            className="rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          />
          <span className="text-xs text-[var(--sea-ink-soft)]">
            Use 0 for no Apify item cap (still limited by max pages).
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm text-[var(--sea-ink)]">
          <span className="font-medium">Max pages</span>
          <input
            type="number"
            min={1}
            max={50}
            value={maxPages}
            onChange={(event) => setMaxPages(event.target.value)}
            className="rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2"
          />
          <span className="text-xs text-[var(--sea-ink-soft)]">
            Apify actor maximum is 50 per run.
          </span>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm text-[var(--sea-ink)]">
        <span className="font-medium">Apify run id (optional)</span>
        <input
          type="text"
          value={apifyRunId}
          onChange={(event) => setApifyRunId(event.target.value)}
          placeholder="Re-import an existing Apify run without re-scraping"
          className="rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 font-mono text-xs"
        />
      </label>

      <div className="flex flex-col gap-2 text-sm text-[var(--sea-ink)]">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(event) => setDryRun(event.target.checked)}
          />
          Dry run (stage only, no catalog import)
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={markMissingRemoved}
            onChange={(event) => setMarkMissingRemoved(event.target.checked)}
          />
          Mark missing source links removed after import
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={enqueueing}
          onClick={() => void queueCrawl()}
          className="rounded-lg border border-[var(--btn-bg)] bg-[var(--btn-bg)] px-4 py-2 text-sm font-medium text-[var(--btn-text)] disabled:opacity-60"
        >
          {enqueueing ? 'Queueing…' : 'Queue crawl job'}
        </button>
        {lastJobId ? (
          <span className="text-xs text-[var(--sea-ink-soft)]">
            Queued job <span className="font-mono">{lastJobId}</span>
          </span>
        ) : null}
      </div>

      {err ? (
        <p className="m-0 text-sm text-red-700 dark:text-red-300">{err}</p>
      ) : null}
    </div>
  )
}
