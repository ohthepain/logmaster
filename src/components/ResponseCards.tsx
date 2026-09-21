import { useEffect, useState } from 'react'
import type { ResponseCard } from '../domain/messaging'
import type { CardSummary } from '../domain/response-cards'
import { apiJson } from '../lib/api-client'
import { apiUrl } from '../lib/app-origin'
import { useTranslation } from '../lib/i18n'

export function CardImage({
  card,
  className = '',
}: {
  card: CardSummary
  className?: string
}) {
  return (
    <img
      src={apiUrl(`/api/messaging/cards/${encodeURIComponent(card.id)}/image`)}
      alt={card.title}
      className={`object-contain ${className}`}
      loading="lazy"
    />
  )
}
export function MessageResponseCard({
  responseCard,
}: {
  responseCard: ResponseCard | null
}) {
  if (
    !responseCard ||
    responseCard.type !== 'image-response' ||
    !('card' in responseCard)
  )
    return null
  return (
    <CardImage
      card={responseCard.card}
      className="max-h-64 w-52 max-w-full rounded-xl"
    />
  )
}
export function ResponseCardSuggestions({
  text,
  selected,
  onSelect,
  disabled,
}: {
  text: string
  selected?: CardSummary
  onSelect: (card?: CardSummary) => void
  disabled: boolean
}) {
  const { language } = useTranslation()
  const [result, setResult] = useState<{
    key: string
    cards: CardSummary[]
    translationUnavailable: boolean
  } | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const key = `${language}:${text}`
  useEffect(() => {
    if (!text.trim() || text.trim().length > 200 || disabled || selected) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void apiJson<{ cards: CardSummary[]; translationUnavailable: boolean }>(
        '/api/messaging/cards/match',
        {
          method: 'POST',
          body: JSON.stringify({ text: text.trim(), language }),
          signal: controller.signal,
        },
      )
        .then((data) => {
          if (!controller.signal.aborted) setResult({ ...data, key })
        })
        .catch(() => {
          if (!controller.signal.aborted) setFailedKey(key)
        })
    }, 550)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [text, language, key, disabled, selected])
  if (selected)
    return (
      <div
        className="flex items-center gap-3 border-b border-slate-100 px-3 py-2"
        aria-label="Selected response card"
      >
        <CardImage card={selected} className="size-20" />
        <span className="flex-1 text-sm text-slate-700">{selected.title}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect()}
          className="p-2 text-sm text-blue-600"
        >
          Remove card
        </button>
      </div>
    )
  const current = result?.key === key ? result : null
  if (
    !current?.cards.length &&
    failedKey !== key &&
    !current?.translationUnavailable
  )
    return null
  return (
    <div className="border-b border-slate-100 px-3 py-2">
      {!!current?.cards.length && (
        <div aria-label="Response cards" className="flex gap-2 overflow-x-auto">
          {current.cards.map((card) => (
            <button
              key={card.id}
              type="button"
              aria-label={`Choose ${card.title}`}
              disabled={disabled}
              onClick={() => onSelect(card)}
              className="shrink-0 rounded-xl border border-slate-200 p-1 hover:bg-blue-50 focus-visible:outline-blue-500"
            >
              <CardImage card={card} className="size-20" />
            </button>
          ))}
        </div>
      )}
      {(failedKey === key || current?.translationUnavailable) && (
        <p role="status" className="m-0 text-xs text-slate-500">
          {failedKey === key
            ? 'Card suggestions are temporarily unavailable.'
            : 'Translation is temporarily unavailable; showing direct phrase matches.'}
        </p>
      )}
    </div>
  )
}
