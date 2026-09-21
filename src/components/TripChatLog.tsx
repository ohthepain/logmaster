import { MapPin } from 'lucide-react'
import { useState } from 'react'
import type { ChatMessage, TripChatLog } from '../domain/messaging'
import { useTranslation } from '../lib/i18n'
import { apiUrl } from '../lib/app-origin'
import { MessageMedia } from './MessageMedia'

export function plainTripLog(entry: TripChatLog) {
  return !['PHOTO', 'MEDIA', 'VOICE_NOTE'].includes(entry.type)
}
export function TripChatPosition({
  latitude,
  longitude,
}: {
  latitude: number
  longitude: number
}) {
  const [failed, setFailed] = useState(false)
  const z = 12,
    n = 2 ** z
  const x = ((longitude + 180) / 360) * n
  const lat = (Math.max(-85.0511, Math.min(85.0511, latitude)) * Math.PI) / 180
  const y = ((1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2) * n
  return (
    <figure className="mx-auto my-0 w-72 max-w-full overflow-hidden rounded-xl bg-slate-200">
      <div
        role="img"
        aria-label={`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}
        className="relative aspect-[4/3] overflow-hidden"
      >
        {!failed &&
          [-1, 0, 1].flatMap((dy) =>
            [-1, 0, 1].map((dx) => {
              const tx = Math.floor(x) + dx,
                ty = Math.floor(y) + dy
              if (ty < 0 || ty >= n) return null
              return (
                <img
                  key={`${dx}:${dy}`}
                  alt=""
                  loading="lazy"
                  draggable={false}
                  src={apiUrl(
                    `/api/map-tiles/${z}/${((tx % n) + n) % n}/${ty}.png`,
                  )}
                  onError={() => setFailed(true)}
                  className="absolute size-64 max-w-none"
                  style={{
                    left: `calc(50% + ${(tx - x) * 256}px)`,
                    top: `calc(50% + ${(ty - y) * 256}px)`,
                  }}
                />
              )
            }),
          )}
        <MapPin className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-full fill-blue-600 text-white drop-shadow" />
        <span className="absolute inset-x-0 bottom-0 bg-white/85 p-1 text-center text-xs tabular-nums text-slate-700">
          {latitude.toFixed(4)}, {longitude.toFixed(4)}
        </span>
      </div>
      <figcaption className="bg-white px-2 text-right text-[9px] text-slate-600">
        <a
          href="https://www.maptiler.com/copyright/"
          target="_blank"
          rel="noreferrer"
        >
          © MapTiler
        </a>{' '}
        ·{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap
        </a>
      </figcaption>
    </figure>
  )
}
export function TripLogContent({ entry }: { entry: TripChatLog }) {
  const { t, language } = useTranslation()
  const coordinates =
    entry.latitude != null &&
    entry.longitude != null &&
    Number.isFinite(entry.latitude) &&
    Number.isFinite(entry.longitude) &&
    Math.abs(entry.latitude) <= 90 &&
    Math.abs(entry.longitude) <= 180
  return (
    <div className="space-y-2" data-trip-log-type={entry.type}>
      <p className="m-0 text-xs text-slate-600">
        {t(`tripLog_${entry.type}`)} ·{' '}
        <time dateTime={entry.timestamp}>
          {new Date(entry.timestamp).toLocaleString(language, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      </p>
      {entry.type === 'HOURLY_LOG' && coordinates && (
        <TripChatPosition
          latitude={entry.latitude!}
          longitude={entry.longitude!}
        />
      )}
      {entry.notes && (
        <p className="m-0 whitespace-pre-wrap break-words text-sm text-slate-800">
          {entry.notes}
        </p>
      )}
      {entry.legacyMedia.map((item) => (
        <div
          key={item.id}
          className="w-72 max-w-full overflow-hidden rounded-xl"
        >
          {item.kind === 'voice' ? (
            <audio
              aria-label={t('tripLog_VOICE_NOTE')}
              src={apiUrl(item.url)}
              controls
              preload="none"
              className="w-full"
            />
          ) : item.kind === 'video' ? (
            <video
              aria-label={t('tripLog_MEDIA')}
              src={apiUrl(item.url)}
              controls
              playsInline
              preload="none"
              className="max-h-96 w-full"
            />
          ) : (
            <img
              src={apiUrl(item.url)}
              alt={t('tripLog_PHOTO')}
              loading="lazy"
              className="max-h-96 w-full object-contain"
            />
          )}
        </div>
      ))}
    </div>
  )
}
export function TripChatLogItem({
  message,
  userId,
}: {
  message: ChatMessage
  userId: string
}) {
  if (!message.logEntry) return null
  return (
    <div
      className="mx-auto max-w-sm py-2 text-center"
      data-testid="trip-log-row"
    >
      <TripLogContent entry={message.logEntry} />
      <MessageMedia
        userId={userId}
        threadId={message.threadId}
        media={message.media}
      />
    </div>
  )
}
