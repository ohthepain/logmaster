import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import englishCatalog from '../../../lib/locales/en'
import { languages } from '../../../lib/i18n'
import type { Language, TranslationCatalog } from '../../../lib/i18n'
import {
  fetchAdminTranslationOverrides,
  resetAdminTranslation,
  saveAdminTranslation,
} from '../../../lib/admin-api'
import { useSession } from '../../../lib/auth-client'
import { useIsAdmin } from '../../../lib/use-admin'

export const Route = createFileRoute('/_main/admin/translations')({
  component: TranslationAdminPage,
})

function TranslationAdminPage() {
  const session = useSession()
  const navigate = useNavigate()
  const { isAdmin, loading: adminLoading } = useIsAdmin()
  const [language, setLanguage] = useState<Language>('sv')
  const [catalog, setCatalog] = useState<TranslationCatalog | null>(null)
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    if (adminLoading || session.isPending) return
    if (!session.data?.user || !isAdmin) void navigate({ to: '/' })
  }, [adminLoading, isAdmin, navigate, session.data?.user, session.isPending])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [locale, rows] = await Promise.all([
        languages.find((item) => item.code === language)?.load() ??
          languages[0].load(),
        fetchAdminTranslationOverrides(),
      ])
      const nextCatalog = locale.default
      const nextOverrides = Object.fromEntries(
        rows
          .filter((row) => row.language === language)
          .map((row) => [row.key, row.value]),
      )
      setCatalog(nextCatalog)
      setOverrides(nextOverrides)
      setDrafts(nextOverrides)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load translations')
    } finally {
      setLoading(false)
    }
  }, [language])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => {
    if (!catalog) return []
    const query = filter.trim().toLowerCase()
    return (Object.keys(englishCatalog) as Array<keyof TranslationCatalog>)
      .filter((key) => {
        const value = drafts[key] ?? catalog[key]
        return !query || `${key} ${value}`.toLowerCase().includes(query)
      })
      .map((key) => ({
        key,
        english: englishCatalog[key],
        base: catalog[key],
        value: drafts[key] ?? catalog[key],
        overridden: key in overrides,
      }))
  }, [catalog, drafts, filter, overrides])

  if (adminLoading || session.isPending || !isAdmin) {
    return <main className="page-wrap px-4 py-8">Loading…</main>
  }

  return (
    <main className="page-wrap px-4 py-8">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">Admin</p>
        <h1 className="display-title mb-2 text-3xl font-bold text-[var(--sea-ink)] sm:text-4xl">
          Translations
        </h1>
        <p className="m-0 mb-5 text-sm leading-6 text-[var(--sea-ink-soft)]">
          Edit runtime wording without releasing the app. Changes override the
          bundled catalog for everyone using this language.
        </p>

        <div className="mb-5 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-[var(--sea-ink)]">
            Language
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as Language)}
              className="rounded-lg border border-[var(--chip-line)] bg-[var(--surface-strong)] px-3 py-2 font-normal"
            >
              {languages.map(({ code, nameKey }) => (
                <option key={code} value={code}>
                  {englishCatalog[nameKey]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm font-medium text-[var(--sea-ink)]">
            Filter
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Search key or text"
              className="rounded-lg border border-[var(--chip-line)] bg-[var(--surface-strong)] px-3 py-2 font-normal"
            />
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-[var(--chip-line)] bg-[var(--chip-bg)] px-4 py-2 text-sm font-medium text-[var(--sea-ink)]"
          >
            Reload
          </button>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {loading ? (
          <p className="text-sm text-[var(--sea-ink-soft)]">
            Loading translations…
          </p>
        ) : null}
        {!loading && catalog ? (
          <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
            <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
              <thead className="bg-[var(--header-bg)]">
                <tr className="border-b border-[var(--line)]">
                  <th className="px-3 py-2 font-semibold">Key</th>
                  <th className="px-3 py-2 font-semibold">English</th>
                  <th className="px-3 py-2 font-semibold">Translation</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-[var(--line)]/70 align-top"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-[var(--sea-ink-soft)]">
                      {row.key}
                    </td>
                    <td className="max-w-xs px-3 py-2 text-[var(--sea-ink-soft)]">
                      {row.english}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={row.value}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [row.key]: event.target.value,
                          }))
                        }
                        className="w-full min-w-56 rounded-lg border border-[var(--chip-line)] bg-[var(--surface-strong)] px-2 py-1.5 text-[var(--sea-ink)]"
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <button
                        type="button"
                        disabled={savingKey === row.key || !row.value.trim()}
                        onClick={() => {
                          setSavingKey(row.key)
                          void saveAdminTranslation(
                            language,
                            row.key,
                            row.value,
                          )
                            .then((saved) => {
                              setOverrides((current) => ({
                                ...current,
                                [row.key]: saved.value,
                              }))
                            })
                            .catch((e) =>
                              setError(
                                e instanceof Error
                                  ? e.message
                                  : 'Could not save translation',
                              ),
                            )
                            .finally(() => setSavingKey(null))
                        }}
                        className="rounded-lg bg-[var(--btn-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--btn-text)] disabled:opacity-50"
                      >
                        {savingKey === row.key ? 'Saving…' : 'Save'}
                      </button>
                      {row.overridden ? (
                        <button
                          type="button"
                          disabled={savingKey === row.key}
                          onClick={() => {
                            setSavingKey(row.key)
                            void resetAdminTranslation(language, row.key)
                              .then(() => {
                                setOverrides((current) => {
                                  const next = { ...current }
                                  delete next[row.key]
                                  return next
                                })
                                setDrafts((current) => ({
                                  ...current,
                                  [row.key]: row.base,
                                }))
                              })
                              .catch((e) =>
                                setError(
                                  e instanceof Error
                                    ? e.message
                                    : 'Could not reset translation',
                                ),
                              )
                              .finally(() => setSavingKey(null))
                          }}
                          className="ml-2 rounded-lg border border-[var(--chip-line)] px-3 py-1.5 text-xs font-semibold text-[var(--sea-ink)] disabled:opacity-50"
                        >
                          Reset
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <p className="mt-5 text-sm">
          <Link
            to="/admin"
            className="font-medium text-[var(--sea-accent)] underline"
          >
            ← Admin
          </Link>
        </p>
      </section>
    </main>
  )
}
