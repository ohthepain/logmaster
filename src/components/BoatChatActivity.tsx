import { FileText } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { BoatChatActivity } from '../domain/boat-activity'
import { useTranslation } from '../lib/i18n'
import { apiUrl } from '../lib/app-origin'
import { PdfDocumentPages } from './PdfDocumentPages'

export function BoatActivityContent({
  activity,
}: {
  activity: BoatChatActivity
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [failed, setFailed] = useState(false)
  const preview = activity.preview
  useEffect(() => {
    setFailed(false)
  }, [preview?.url])
  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '100px' },
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  const url =
    preview && (preview.kind === 'link' ? preview.url : apiUrl(preview.url))
  return (
    <div ref={ref} className="space-y-2" data-boat-activity={activity.kind}>
      <p className="m-0 break-words text-xs text-slate-600">
        {t(`boatActivity_${activity.kind}`)}
        {activity.label && <> · {activity.label}</>}
        {activity.targetLabel && <> ↔ {activity.targetLabel}</>}
      </p>
      {preview && url && (
        <div className="w-72 max-w-full overflow-hidden rounded-xl bg-slate-50">
          {failed ? (
            <p className="p-3 text-xs text-slate-600">
              {t('boatActivity_unavailable')}
            </p>
          ) : (
            <>
              {preview.kind === 'image' && (
                <a href={url} target="_blank" rel="noreferrer">
                  <img
                    src={url}
                    alt={preview.title}
                    loading="lazy"
                    onError={() => setFailed(true)}
                    className="max-h-96 w-full object-contain"
                  />
                </a>
              )}
              {preview.kind === 'video' && (
                <video
                  src={url}
                  aria-label={preview.title}
                  controls
                  playsInline
                  preload="none"
                  onError={() => setFailed(true)}
                  className="max-h-96 w-full"
                />
              )}
              {preview.kind === 'audio' && (
                <audio
                  src={url}
                  aria-label={preview.title}
                  controls
                  preload="none"
                  onError={() => setFailed(true)}
                  className="w-full"
                />
              )}
              {preview.kind === 'pdf' && (
                <div className="h-64 overflow-hidden">
                  {visible && (
                    <PdfDocumentPages
                      contentUrl={url}
                      title={preview.title}
                      maxPages={1}
                    />
                  )}
                </div>
              )}
              {['pdf', 'file', 'link'].includes(preview.kind) && (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 p-3 text-sm text-sky-800 underline"
                >
                  <FileText className="size-6 shrink-0" />
                  <span className="min-w-0 break-words">
                    {preview.title || t('boatActivity_open')}
                  </span>
                </a>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
