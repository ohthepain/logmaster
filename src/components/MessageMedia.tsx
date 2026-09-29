import {
  Camera,
  Download,
  Image as ImageIcon,
  Play,
  Video,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { ChatAttachment } from '../domain/message-media'
import {
  MAX_MESSAGE_ATTACHMENTS,
  validateMessageFile,
} from '../domain/message-media'
import { loadMessageMedia, messageMediaUrl } from '../lib/messaging/media'
import {
  isSavableChatMedia,
  saveChatMedia,
} from '../lib/messaging/save-chat-media'

export function FilePreview({ file }: { file: File }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const value = URL.createObjectURL(file)
    setUrl(value)
    return () => URL.revokeObjectURL(value)
  }, [file])
  return file.type.startsWith('video/') ||
    /\.(mp4|mov|webm|ogv|3gp)$/i.test(file.name) ? (
    <video
      src={url || undefined}
      muted
      playsInline
      preload="metadata"
      className="size-full object-cover"
      aria-label={file.name}
    />
  ) : (
    <img
      src={url || undefined}
      alt={file.name}
      className="size-full object-cover"
    />
  )
}

export function MediaSelector({
  open,
  files,
  disabled,
  onFiles,
  onClose,
  onError,
}: {
  open: boolean
  files: File[]
  disabled: boolean
  onFiles: (files: File[]) => void
  onClose: () => void
  onError: (error: string) => void
}) {
  const library = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const video = useRef<HTMLInputElement>(null)
  function add(list: FileList | null) {
    if (!list) return
    try {
      const additions = Array.from(list)
      for (const file of additions) validateMessageFile(file)
      if (files.length + additions.length > MAX_MESSAGE_ATTACHMENTS)
        throw new Error('Choose up to 10 photos and videos per message.')
      onFiles([...files, ...additions])
    } catch (error) {
      onError(
        error instanceof Error ? error.message : 'Could not select media.',
      )
    }
  }
  return (
    <>
      <input
        ref={library}
        className="hidden"
        aria-label="Select photos and videos"
        type="file"
        accept="image/*,video/*"
        multiple
        disabled={disabled}
        onChange={(e) => {
          add(e.currentTarget.files)
          e.currentTarget.value = ''
        }}
      />
      <input
        ref={camera}
        className="hidden"
        aria-label="Take a photo"
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled}
        onChange={(e) => {
          add(e.currentTarget.files)
          e.currentTarget.value = ''
        }}
      />
      <input
        ref={video}
        className="hidden"
        aria-label="Record a video"
        type="file"
        accept="video/*"
        capture="environment"
        disabled={disabled}
        onChange={(e) => {
          add(e.currentTarget.files)
          e.currentTarget.value = ''
        }}
      />
      {files.length > 0 && (
        <div
          aria-label="Selected media"
          className="flex gap-2 overflow-x-auto px-3 pt-3"
        >
          {files.map((file, index) => (
            <div
              key={`${index}-${file.name}`}
              className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-black/10 bg-slate-100"
            >
              <FilePreview file={file} />
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                disabled={disabled}
                onClick={() => onFiles(files.filter((_, i) => i !== index))}
                className="absolute right-0 top-0 rounded-full bg-black/65 p-1.5 text-white"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      {open && (
        <div
          role="region"
          aria-label="Media selector"
          className="border-b border-slate-100 p-3 text-black"
        >
          <div className="mb-2 flex items-center justify-between text-sm">
            <span>Photos & videos</span>
            <button
              type="button"
              aria-label="Close media selector"
              onClick={onClose}
              className="p-2"
            >
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => library.current?.click()}
              className="flex flex-col items-center gap-2 rounded-xl bg-slate-100 p-3 text-xs"
            >
              <ImageIcon size={24} />
              Photo library
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => camera.current?.click()}
              className="flex flex-col items-center gap-2 rounded-xl bg-slate-100 p-3 text-xs"
            >
              <Camera size={24} />
              Camera
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => video.current?.click()}
              className="flex flex-col items-center gap-2 rounded-xl bg-slate-100 p-3 text-xs"
            >
              <Video size={24} />
              Record video
            </button>
          </div>
          <p className="mb-0 mt-2 text-xs text-slate-500">
            Up to 10 items · 100 MB each
          </p>
        </div>
      )}
    </>
  )
}

function MediaItem({
  userId,
  threadId,
  media,
}: {
  userId: string
  threadId: string
  media: ChatAttachment
}) {
  const video = media.contentType.startsWith('video/')
  const audio = media.contentType.startsWith('audio/')
  const [load, setLoad] = useState(false)
  const [url, setUrl] = useState('')
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [saveState, setSaveState] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle')
  const [saveError, setSaveError] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const blobRef = useRef<Blob | null>(null)
  const savedTimer = useRef(0)
  const savable = isSavableChatMedia(media.contentType)
  useEffect(() => () => window.clearTimeout(savedTimer.current), [])
  useEffect(() => {
    if (video || audio) return
    if (typeof IntersectionObserver === 'undefined') {
      setLoad(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLoad(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [video, audio])
  useEffect(() => {
    if (!load) return
    const abort = new AbortController()
    let objectUrl: string | undefined
    setError(false)
    setUrl('')
    void loadMessageMedia(userId, threadId, media, abort.signal)
      .then((blob) => {
        if (abort.signal.aborted) return
        blobRef.current = blob
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {
        if (!abort.signal.aborted) setError(true)
      })
    return () => {
      abort.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [
    userId,
    threadId,
    media.id,
    media.checksum,
    media.contentType,
    media.size,
    media.fileName,
    load,
    attempt,
  ])

  async function save() {
    if (saveState === 'saving') return
    setSaveState('saving')
    setSaveError('')
    try {
      const blob =
        blobRef.current ??
        (await loadMessageMedia(userId, threadId, media).then((loaded) => {
          blobRef.current = loaded
          return loaded
        }))
      const result = await saveChatMedia(
        blob,
        media.fileName,
        media.contentType,
      )
      if (result === 'cancelled') {
        setSaveState('idle')
        return
      }
      setSaveState('saved')
      window.clearTimeout(savedTimer.current)
      savedTimer.current = window.setTimeout(() => {
        setSaveState((current) => (current === 'saved' ? 'idle' : current))
      }, 2000)
    } catch (saveFailure) {
      setSaveState('error')
      setSaveError(
        saveFailure instanceof Error
          ? saveFailure.message
          : 'Could not save this file.',
      )
    }
  }

  const saveLabel =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
        ? 'Saved'
        : 'Save'
  return (
    <div ref={ref} className="my-1 min-w-40">
      <div className="overflow-hidden rounded-xl bg-black/5">
        {url && !error ? (
          audio ? (
            <audio
              src={url}
              controls
              preload="metadata"
              className="w-full"
              onError={() => setError(true)}
            />
          ) : video ? (
            <video
              src={url}
              controls
              playsInline
              preload="metadata"
              className="max-h-96 w-full"
              onError={() => setError(true)}
            />
          ) : (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${media.fileName}`}
            >
              <img
                src={url}
                alt={media.fileName}
                draggable={false}
                className="max-h-96 w-full object-contain"
                onError={() => setError(true)}
              />
            </a>
          )
        ) : (
          <div className="flex min-h-28 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-slate-600">
            {!load && (video || audio) ? (
              <button
                type="button"
                onClick={() => setLoad(true)}
                className="flex flex-col items-center gap-2"
              >
                <Play size={30} />
                {audio ? 'Play voice note' : 'Play video'}
              </button>
            ) : error ? (
              <>
                <span>Preview unavailable</span>
                <button
                  type="button"
                  className="underline"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  Retry
                </button>
                <a
                  className="underline"
                  href={messageMediaUrl(threadId, media.id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open original
                </a>
              </>
            ) : (
              <span role="status">
                Loading {audio ? 'audio' : video ? 'video' : 'photo'}…
              </span>
            )}
            {(!url || error) && (
              <span className="max-w-56 truncate text-xs">
                {media.fileName}
              </span>
            )}
          </div>
        )}
      </div>
      {savable ? (
        <div className="mt-1 flex justify-end">
          <button
            type="button"
            aria-label={video ? 'Save video' : 'Save photo'}
            disabled={saveState === 'saving'}
            onClick={() => void save()}
            className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--sea-ink)] shadow-sm disabled:opacity-60"
          >
            <Download size={14} aria-hidden />
            {saveLabel}
          </button>
        </div>
      ) : null}
      {saveError ? (
        <p role="alert" className="mb-0 mt-1 text-right text-xs text-red-700">
          {saveError}
        </p>
      ) : null}
    </div>
  )
}
export function MessageMedia({
  userId,
  threadId,
  media,
  likeControl,
}: {
  userId: string
  threadId: string
  media?: ChatAttachment[]
  likeControl?: ReactNode
}) {
  if (!media?.length) return null
  return (
    <div className="grid max-w-sm gap-1">
      {media.map((item) => (
        <MediaItem
          key={item.id}
          userId={userId}
          threadId={threadId}
          media={item}
        />
      ))}
      {likeControl ? (
        <div className="flex justify-end">{likeControl}</div>
      ) : null}
    </div>
  )
}
