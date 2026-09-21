import { useEffect, useRef, useState } from 'react'
import { Camera, Image as ImageIcon, Video, X, Play } from 'lucide-react'
import type { ChatAttachment } from '../domain/message-media'
import {
  MAX_MESSAGE_ATTACHMENTS,
  validateMessageFile,
} from '../domain/message-media'
import { loadMessageMedia, messageMediaUrl } from '../lib/messaging/media'

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
  const [load, setLoad] = useState(false)
  const [url, setUrl] = useState('')
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (video) return
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
  }, [video])
  useEffect(() => {
    if (!load) return
    const abort = new AbortController()
    let objectUrl: string | undefined
    setError(false)
    setUrl('')
    void loadMessageMedia(userId, threadId, media, abort.signal)
      .then((blob) => {
        if (abort.signal.aborted) return
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
  return (
    <div
      ref={ref}
      className="my-1 min-w-40 overflow-hidden rounded-xl bg-black/5"
    >
      {url && !error ? (
        video ? (
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
              className="max-h-96 w-full object-contain"
              onError={() => setError(true)}
            />
          </a>
        )
      ) : (
        <div className="flex min-h-28 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-slate-600">
          {!load && video ? (
            <button
              type="button"
              onClick={() => setLoad(true)}
              className="flex flex-col items-center gap-2"
            >
              <Play size={30} />
              Play video
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
            <span role="status">Loading {video ? 'video' : 'photo'}…</span>
          )}
          {(!url || error) && (
            <span className="max-w-56 truncate text-xs">{media.fileName}</span>
          )}
        </div>
      )}
    </div>
  )
}
export function MessageMedia({
  userId,
  threadId,
  media,
}: {
  userId: string
  threadId: string
  media?: ChatAttachment[]
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
    </div>
  )
}
