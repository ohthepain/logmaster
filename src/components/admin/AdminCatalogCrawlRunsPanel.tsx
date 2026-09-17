import { Link } from '@tanstack/react-router'
import { Info, Search } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  deleteCatalogCrawl,
  fetchCatalogCrawlRuns,
  repeatCatalogCrawl,
} from '../../lib/admin-api'
import type {
  CatalogCrawlRepeatMode,
  CatalogCrawlRunSummary,
} from '../../lib/admin-jobs'
import {
  catalogCrawlMatchesQuery,
  formatJobRelativeTime,
  JOB_STATE_STYLES,
} from '../../lib/admin-jobs'
import { cn } from '../../lib/cn'
import { POPUP_MENU_Z_CLASS, PopupOutsideDismiss } from '../PopupOutsideDismiss'

export function AdminCatalogCrawlRunsPanel() {
  const [crawls, setCrawls] = useState<CatalogCrawlRunSummary[] | null>(null)
  const [query, setQuery] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setErr(null)
    setLoading(true)
    try {
      setCrawls(await fetchCatalogCrawlRuns(200))
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Request failed')
      setCrawls(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    if (!crawls) return []
    return crawls.filter((crawl) => catalogCrawlMatchesQuery(crawl, query))
  }, [crawls, query])

  const queueRepeat = async (
    crawl: CatalogCrawlRunSummary,
    mode: CatalogCrawlRepeatMode,
  ) => {
    const detail = [
      crawl.summary,
      mode === 'reimport' && crawl.apifyRunId
        ? `Apify ${crawl.apifyRunId}`
        : null,
    ]
      .filter(Boolean)
      .join('\n')
    const question =
      mode === 'reimport'
        ? `Re-import the existing Apify dataset without scraping again?\n\n${detail}`
        : `Queue a new Apify scrape with the same seed and limits?\n\n${detail}\n\nThis starts a new crawl; it does not resume the original run.`
    if (!globalThis.confirm(question)) return

    setBusyId(crawl.id)
    try {
      const result = await repeatCatalogCrawl(crawl.id, mode)
      toast.success(`Queued job ${result.jobId}`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not queue crawl',
      )
    } finally {
      setBusyId(null)
    }
  }

  const removeCrawl = async (crawl: CatalogCrawlRunSummary) => {
    if (
      !globalThis.confirm(
        `Delete this crawl record and its staged pages?\n\n${crawl.summary}\n\nProducts already imported into the catalog are kept.`,
      )
    ) {
      return
    }
    setBusyId(crawl.id)
    try {
      await deleteCatalogCrawl(crawl.id)
      setCrawls((current) =>
        current ? current.filter((item) => item.id !== crawl.id) : current,
      )
      toast.success('Crawl deleted')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not delete crawl',
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search crawls</span>
          <Search
            aria-hidden
            className="absolute left-3 top-3 size-5 text-[var(--sea-ink-soft)]"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Brand, status, Apify id…"
            className="w-full rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)] py-3 pl-10 pr-3"
          />
        </label>
        <div className="flex items-center gap-2">
          <CatalogCrawlActionsHelp />
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-2 text-sm font-medium text-[var(--sea-ink)]"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
          Loading crawls…
        </p>
      ) : null}
      {err ? (
        <p className="m-0 text-sm text-red-700 dark:text-red-300">{err}</p>
      ) : null}

      {crawls && crawls.length === 0 ? (
        <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
          No stored crawls yet. Queue one from Product catalog crawls or run{' '}
          <code className="text-xs">pnpm catalog:nauticexpo</code>.
        </p>
      ) : null}

      {crawls && crawls.length > 0 && visible.length === 0 ? (
        <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
          No crawls match this search.
        </p>
      ) : null}

      {visible.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {visible.map((crawl) => {
            const busy = busyId === crawl.id
            return (
              <li
                key={crawl.id}
                className="rounded-xl border border-[var(--chip-line)] bg-[var(--chip-bg)]/60 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 font-mono text-xs ${JOB_STATE_STYLES[crawl.status] ?? JOB_STATE_STYLES.created}`}
                  >
                    {crawl.status}
                  </span>
                  <span className="text-sm font-medium text-[var(--sea-ink)]">
                    {crawl.summary}
                  </span>
                </div>
                <p className="m-0 mt-1 text-xs text-[var(--sea-ink-soft)]">
                  {formatJobRelativeTime(crawl.startedAt)}
                  {crawl.result ? ` · ${crawl.result}` : ''}
                  {crawl.error ? ` · ${crawl.error}` : ''}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to="/admin/catalog-crawls/$runId"
                    params={{ runId: crawl.id }}
                    className="rounded-lg border border-[var(--btn-bg)] bg-[var(--btn-bg)] px-3 py-1.5 text-sm font-medium text-[var(--btn-text)]"
                  >
                    Open
                  </Link>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void queueRepeat(crawl, 'rescrape')}
                    className="rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm font-medium text-[var(--sea-ink)] disabled:opacity-60"
                  >
                    {busy ? 'Working…' : 'Repeat crawl'}
                  </button>
                  <button
                    type="button"
                    disabled={busy || !crawl.canReimport}
                    title={
                      crawl.canReimport
                        ? undefined
                        : 'This crawl has no Apify run to re-import'
                    }
                    onClick={() => void queueRepeat(crawl, 'reimport')}
                    className="rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm font-medium text-[var(--sea-ink)] disabled:opacity-60"
                  >
                    Re-import Apify
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeCrawl(crawl)}
                    className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 disabled:opacity-60 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
                  >
                    Delete
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

function CatalogCrawlActionsHelp() {
  const [open, setOpen] = useState(false)
  const dialogId = useId()

  return (
    <div className="relative">
      {open ? <PopupOutsideDismiss onDismiss={() => setOpen(false)} /> : null}
      <button
        type="button"
        aria-label="What these buttons do"
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)]"
      >
        <Info className="size-4" strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <div
          id={dialogId}
          role="dialog"
          aria-label="Crawl actions"
          className={cn(
            'absolute right-0 top-full mt-1 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-[var(--line)] bg-[var(--header-bg)] p-3 text-sm shadow-lg',
            POPUP_MENU_Z_CLASS,
            'ring-1 ring-[var(--line)]/60',
          )}
        >
          <p className="m-0 font-semibold text-[var(--sea-ink)]">
            Crawl actions
          </p>
          <ul className="m-0 mt-2 list-none space-y-2 p-0 text-[var(--sea-ink-soft)]">
            <li>
              <span className="font-medium text-[var(--sea-ink)]">Open</span>
              {' — '}
              shows products parsed in this crawl and whether each one was
              imported into the catalog.
            </li>
            <li>
              <span className="font-medium text-[var(--sea-ink)]">
                Repeat crawl
              </span>
              {' — '}
              queues a new Apify scrape with the same seed and limits. It does
              not resume the original run or replay local Playwright files.
            </li>
            <li>
              <span className="font-medium text-[var(--sea-ink)]">
                Re-import Apify
              </span>
              {' — '}
              imports the stored Apify dataset without scraping again. Disabled
              when this crawl has no Apify run id.
            </li>
            <li>
              <span className="font-medium text-[var(--sea-ink)]">Delete</span>
              {' — '}
              removes this crawl record and its staged pages. Catalog products
              already imported are kept.
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  )
}
