import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AdminPageShell } from '../../../components/admin/AdminPageShell'
import { CardImage } from '../../../components/ResponseCards'
import type {
  CardExpression,
  CardSummary,
} from '../../../domain/response-cards'
import { apiJson } from '../../../lib/api-client'
import { languages } from '../../../lib/i18n'
import { useIsAdmin } from '../../../lib/use-admin'

export const Route = createFileRoute('/_main/admin/response-cards')({
  component: ResponseCardsAdmin,
})
const base = '/api/admin/response-cards'
const inputStyle =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900'
const buttonStyle =
  'shrink-0 whitespace-nowrap rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40'

function phraseGroups(expressions: CardExpression[]) {
  const groups = new Map<string, CardExpression[]>()
  for (const expression of expressions) {
    const key = expression.groupId || expression.id
    const phrases = groups.get(key) ?? []
    phrases.push(expression)
    groups.set(key, phrases)
  }
  return [...groups.values()].map((phrases) =>
    phrases.sort((a, b) =>
      a.text.localeCompare(b.text, undefined, { sensitivity: 'base' }),
    ),
  )
}

function ExpressionEditor({
  phrases,
  cards,
  busy,
  dangerZone,
  run,
}: {
  phrases: CardExpression[]
  cards: CardSummary[]
  busy: boolean
  dangerZone: boolean
  run: (action: () => Promise<void>) => void
}) {
  const expression = phrases[0]
  const linked = new Map<string, CardSummary>()
  for (const phrase of phrases)
    for (const card of phrase.cards) linked.set(card.id, card)
  const groupCards = [...linked.values()]
  const [alias, setAlias] = useState('')
  const [dragging, setDragging] = useState(false)
  function upload(files: File[]) {
    if (busy || !files.length) return
    run(async () => {
      for (const file of files) {
        const body = new FormData()
        body.append('file', file)
        await apiJson(`${base}/expressions/${expression.id}/upload`, {
          method: 'POST',
          body,
        })
      }
    })
  }
  return (
    <section className="rounded-xl border border-slate-200 bg-white/70 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 rounded-lg bg-slate-100 px-1.5 py-1">
          {phrases.map((phrase) => (
            <span
              key={phrase.id}
              className="inline-flex items-center gap-0.5 rounded bg-white px-1.5 py-0.5 text-sm font-medium text-slate-800"
            >
              {phrase.text}
              <button
                type="button"
                disabled={busy}
                aria-label={`Remove phrase ${phrase.text}`}
                className="px-0.5 text-slate-400 hover:text-red-700 disabled:opacity-40"
                onClick={() => {
                  if (
                    phrases.length === 1 &&
                    !window.confirm(
                      'Remove this phrase? Cards will remain in the library.',
                    )
                  )
                    return
                  run(async () => {
                    await apiJson(`${base}/expressions/${phrase.id}`, {
                      method: 'DELETE',
                    })
                  })
                }}
              >
                ×
              </button>
            </span>
          ))}
          <form
            className="inline-flex min-w-28 flex-1"
            onSubmit={(event) => {
              event.preventDefault()
              const additions = alias
                .split(/[,\n]/)
                .map((phrase) => phrase.trim())
                .filter(Boolean)
              if (!additions.length) return
              run(async () => {
                for (const phrase of additions)
                  await apiJson(`${base}/expressions/${expression.id}/aliases`, {
                    method: 'POST',
                    body: JSON.stringify({ text: phrase }),
                  })
                setAlias('')
              })
            }}
          >
            <input
              aria-label={`Add a matching phrase for ${phrases.map((phrase) => phrase.text).join(', ')}`}
              placeholder="ok, oka, okay…"
              maxLength={200}
              value={alias}
              disabled={busy}
              onChange={(event) => setAlias(event.target.value)}
              className="w-full bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-slate-400"
            />
          </form>
        </div>
        {dangerZone ? (
          <button
            disabled={busy}
            className="shrink-0 text-sm text-red-700"
            onClick={() => {
              if (
                window.confirm(
                  'Remove these phrases? Cards will remain in the library.',
                )
              )
                run(async () => {
                  for (const phrase of phrases)
                    await apiJson(`${base}/expressions/${phrase.id}`, {
                      method: 'DELETE',
                    })
                })
            }}
          >
            Delete phrases
          </button>
        ) : null}
      </div>
      <div
        className={`mb-3 flex overflow-x-auto ${dangerZone ? 'gap-3' : ''}`}
        aria-label={`Cards for ${phrases.map((phrase) => phrase.text).join(', ')}`}
      >
        {groupCards.map((card) => (
          <div
            key={card.id}
            title={card.title}
            className={
              dangerZone
                ? 'w-28 shrink-0 rounded-lg border border-slate-200 p-2'
                : `shrink-0 ${card.enabled ? '' : 'opacity-40'}`
            }
          >
            <CardImage
              card={card}
              className={dangerZone ? 'h-24 w-full' : 'h-24 w-auto'}
            />
            {dangerZone ? (
              <>
                <p className="my-1 truncate text-xs" title={card.title}>
                  {card.title}
                  {!card.enabled && ' (disabled)'}
                </p>
                <button
                  disabled={busy}
                  className="text-xs text-red-700"
                  aria-label={`Unlink ${card.title} from ${expression.text}`}
                  onClick={() =>
                    run(async () => {
                      await apiJson(
                        `${base}/expressions/${expression.id}/cards/${card.id}`,
                        { method: 'DELETE' },
                      )
                    })
                  }
                >
                  Unlink
                </button>
              </>
            ) : null}
          </div>
        ))}
      </div>
      <label
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          upload(Array.from(event.dataTransfer.files))
        }}
        className={`block cursor-pointer rounded-xl border-2 border-dashed p-5 text-center text-sm ${dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300'}`}
      >
        Drop images here, or choose files
        <input
          type="file"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp"
          disabled={busy}
          aria-label={`Upload cards for ${expression.text}`}
          className="mt-2 block w-full text-xs"
          onChange={(event) => {
            upload(Array.from(event.target.files ?? []))
            event.target.value = ''
          }}
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <select
          aria-label={`Link existing card to ${expression.text}`}
          disabled={busy}
          value=""
          className={`${inputStyle} max-w-full`}
          onChange={(event) => {
            const id = event.target.value
            if (id)
              run(async () => {
                await apiJson(
                  `${base}/expressions/${expression.id}/cards/${id}`,
                  { method: 'PUT' },
                )
              })
          }}
        >
          <option value="">Link an existing card…</option>
          {cards
            .filter((card) => !linked.has(card.id))
            .map((card) => (
              <option key={card.id} value={card.id}>
                {card.title}
              </option>
            ))}
        </select>
      </div>
    </section>
  )
}
function CardEditor({
  card,
  busy,
  run,
}: {
  card: CardSummary
  busy: boolean
  run: (action: () => Promise<void>) => void
}) {
  const [title, setTitle] = useState(card.title)
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <CardImage card={card} className="mx-auto h-28 w-full" />
      <form
        className="mt-2 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          run(async () => {
            await apiJson(`${base}/cards/${card.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ title }),
            })
          })
        }}
      >
        <input
          aria-label={`Title for ${card.title}`}
          maxLength={120}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className={`${inputStyle} w-full min-w-0`}
        />
        <button disabled={busy || !title.trim()} className={buttonStyle}>
          Save
        </button>
      </form>
      <div className="mt-3 flex justify-between gap-2 text-sm">
        <label>
          <input
            type="checkbox"
            checked={card.enabled}
            disabled={busy}
            onChange={(event) => {
              const enabled = event.target.checked
              run(async () => {
                await apiJson(`${base}/cards/${card.id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ enabled }),
                })
              })
            }}
          />{' '}
          Enabled
        </label>
        <button
          disabled={busy}
          className="text-red-700"
          onClick={() => {
            if (
              window.confirm(
                'Remove this card from every expression? Sent messages will keep their image.',
              )
            )
              run(async () => {
                await apiJson(`${base}/cards/${card.id}`, { method: 'DELETE' })
              })
          }}
        >
          Remove card
        </button>
      </div>
    </div>
  )
}
function ResponseCardsAdmin() {
  const { isAdmin } = useIsAdmin()
  const [language, setLanguage] = useState('en')
  const [dangerZone, setDangerZone] = useState(false)
  const [text, setText] = useState('')
  const [expressions, setExpressions] = useState<CardExpression[]>([])
  const [cards, setCards] = useState<CardSummary[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const sequence = useRef(0)
  const mutating = useRef(false)
  const load = useCallback(async () => {
    const request = ++sequence.current
    setLoading(true)
    try {
      const data = await apiJson<{
        expressions: CardExpression[]
        cards: CardSummary[]
      }>(`${base}?language=${language}`)
      if (request === sequence.current) {
        setExpressions(data.expressions)
        setCards(data.cards)
      }
    } finally {
      if (request === sequence.current) setLoading(false)
    }
  }, [language])
  useEffect(() => {
    if (isAdmin)
      void load().catch(() => setError('Could not load response cards.'))
    return () => {
      sequence.current++
    }
  }, [isAdmin, load])
  function run(action: () => Promise<void>) {
    if (mutating.current) return
    mutating.current = true
    setBusy(true)
    setError(null)
    void (async () => {
      try {
        await action()
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Could not save response cards.',
        )
      } finally {
        try {
          await load()
        } catch {
          setError('Could not refresh response cards.')
        }
        mutating.current = false
        setBusy(false)
      }
    })()
  }
  return (
    <AdminPageShell
      title="Response cards"
      description="Match phrases to static or animated cards. Cards can be shared across phrases and languages. PNG, JPEG, GIF and WebP, up to 10 MB each."
    >
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          Language
          <select
            aria-label="Card language"
            className={inputStyle}
            disabled={busy}
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          >
            {languages.map((item) => (
              <option key={item.code} value={item.code}>
                {item.nativeName}
              </option>
            ))}
          </select>
        </label>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            run(async () => {
              await apiJson(`${base}/expressions`, {
                method: 'POST',
                body: JSON.stringify({ language, text }),
              })
              setText('')
            })
          }}
        >
          <input
            aria-label="New matching expression"
            placeholder="e.g. yes"
            maxLength={200}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className={inputStyle}
          />
          <button className={buttonStyle} disabled={busy || !text.trim()}>
            Add phrase
          </button>
        </form>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={dangerZone}
            onChange={(event) => setDangerZone(event.target.checked)}
          />
          Danger zone
        </label>
      </div>
      {busy && (
        <p role="status" className="text-sm">
          Saving cards…
        </p>
      )}
      {loading ? (
        <p>Loading expressions…</p>
      ) : (
        <div className="space-y-4">
          {!expressions.length && (
            <p className="text-sm text-slate-500">
              No expressions in this language yet. Add a phrase, then drop its
              cards below it.
            </p>
          )}
          {phraseGroups(expressions).map((phrases) => (
            <ExpressionEditor
              key={phrases[0].groupId || phrases[0].id}
              phrases={phrases}
              cards={cards}
              busy={busy}
              dangerZone={dangerZone}
              run={run}
            />
          ))}
        </div>
      )}
      <h2 className="mb-2 mt-8 text-xl font-semibold">
        Card library · all languages
      </h2>
      <p className="mb-4 text-sm text-slate-500">
        Disabling hides a card from suggestions. Removing it unlinks every
        expression; sent messages retain their images.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <CardEditor
            key={`${card.id}:${card.title}`}
            card={card}
            busy={busy}
            run={run}
          />
        ))}
      </div>
    </AdminPageShell>
  )
}
