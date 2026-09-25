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
  onSelect,
  disabled,
}: {
  text: string
  onSelect: (card: CardSummary) => void
  disabled: boolean
}) {
  const { language } = useTranslation()
  const [result, setResult] = useState<{
    key: string
    cards: CardSummary[]
  } | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const key = `${language}:${text}`
  useEffect(() => {
    if (!text.trim() || text.trim().length > 200 || disabled) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void apiJson<{ cards: CardSummary[] }>('/api/messaging/cards/match', {
        method: 'POST',
        body: JSON.stringify({ text: text.trim(), language }),
        signal: controller.signal,
      })
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
  }, [text, language, key, disabled])
  const current = result?.key === key ? result : null
  if (!current?.cards.length && failedKey !== key) return null
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
              className="shrink-0 rounded-xl border-0 bg-transparent p-1 transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
            >
              <CardImage card={card} className="size-20" />
            </button>
          ))}
        </div>
      )}
      {failedKey === key && (
        <p role="status" className="m-0 text-xs text-slate-500">
          Card suggestions are temporarily unavailable.
        </p>
      )}
    </div>
  )
}
