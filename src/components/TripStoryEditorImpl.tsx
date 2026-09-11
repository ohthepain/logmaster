import { Editor } from '@tinymce/tinymce-react'
import type { Editor as TinyMceEditor } from 'tinymce'
import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import tinymce from 'tinymce/tinymce'

import 'tinymce/icons/default'
import 'tinymce/themes/silver'
import 'tinymce/models/dom'
import 'tinymce/plugins/lists'
import 'tinymce/plugins/link'
import 'tinymce/plugins/image'
import 'tinymce/plugins/media'
import 'tinymce/plugins/autolink'

import 'tinymce/skins/ui/oxide/skin.min.css'

import {
  absoluteStoryMediaUrl,
  uploadTripStoryMedia,
} from '../lib/trip-story-api'
import { TRIP_STORY_CONTENT_STYLE } from '../lib/trip-story-styles'
import type { TripStoryEditorProps } from './TripStoryEditor'
import { TripStoryPageShell } from './TripStoryPageShell'

function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/')
}

export function TripStoryEditorImpl({
  tripId,
  html,
  onChange,
  onSave,
  onResetFromTrip,
  onCancel,
}: TripStoryEditorProps) {
  const editorRef = useRef<TinyMceEditor | null>(null)
  const [saving, setSaving] = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

  const uploadMedia = useCallback(
    async (file: Blob, fileName?: string) => {
      const result = await uploadTripStoryMedia(tripId, file, fileName)
      return absoluteStoryMediaUrl(result.url)
    },
    [tripId],
  )

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(html)
      toast.success('Story saved')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save story',
      )
    } finally {
      setSaving(false)
    }
  }

  const init = useMemo(
    () => ({
      height: '100%',
      min_height: 480,
      menubar: false,
      plugins: 'autolink lists link image media',
      toolbar:
        'undo redo | bold italic | bullist numlist | link image media | removeformat',
      automatic_uploads: true,
      paste_data_images: true,
      image_dimensions: false,
      content_style: TRIP_STORY_CONTENT_STYLE,
      images_upload_handler: (
        blobInfo: { blob: () => Blob; filename: () => string },
        progress: (percent: number) => void,
      ) =>
        new Promise<string>((resolve, reject) => {
          progress(0)
          void uploadMedia(blobInfo.blob(), blobInfo.filename())
            .then((url) => {
              progress(100)
              resolve(url)
            })
            .catch(reject)
        }),
      setup: (editor: TinyMceEditor) => {
        editor.on('drop', (event) => {
          const transfer = event.dataTransfer
          const file = transfer?.files?.[0]
          if (!file || !isVideoFile(file)) return

          event.preventDefault()
          event.stopImmediatePropagation()

          void uploadMedia(file, file.name)
            .then((url) => {
              editor.insertContent(
                `<figure class="story-photo"><video controls src="${url}"></video></figure>`,
              )
            })
            .catch((error) => {
              toast.error(
                error instanceof Error
                  ? error.message
                  : 'Failed to upload video',
              )
            })
        })

        editor.on('dragover', (event) => {
          const transfer = event.dataTransfer
          const file = transfer?.files?.[0]
          if (file && isVideoFile(file)) {
            event.preventDefault()
          }
        })
      },
    }),
    [uploadMedia],
  )

  return (
    <TripStoryPageShell
      className="h-dvh"
      toolbar={
        <>
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="rounded-xl border border-[var(--chip-line)] px-3 py-1.5 text-sm text-[var(--sea-ink)]"
          >
            Back
          </button>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => setResetConfirmOpen(true)}
              className="rounded-xl border border-[var(--chip-line)] px-3 py-1.5 text-sm text-[var(--sea-ink-soft)]"
            >
              Reset from trip
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="rounded-xl bg-[var(--btn-bg)] px-4 py-1.5 text-sm font-semibold text-[var(--btn-text)] disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 [&_.tox-tinymce]:!h-full [&_.tox-tinymce]:!rounded-none [&_.tox-tinymce]:!border-0 [&_.tox-tinymce]:!shadow-none">
          <Editor
            licenseKey="gpl"
            onInit={(_event, editor) => {
              editorRef.current = editor
            }}
            value={html}
            onEditorChange={onChange}
            init={init}
          />
        </div>
      </div>

      {resetConfirmOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="presentation"
          onClick={() => setResetConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-xl"
            role="dialog"
            aria-labelledby="reset-story-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="reset-story-title" className="text-sm text-[var(--sea-ink)]">
              Replace the current story with a fresh draft from this trip&apos;s
              log entries and media?
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setResetConfirmOpen(false)
                  onResetFromTrip()
                }}
                className="rounded-xl bg-[var(--brand)] px-3 py-1.5 text-sm font-semibold text-white"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setResetConfirmOpen(false)}
                className="rounded-xl border border-[var(--chip-line)] px-3 py-1.5 text-sm"
              >
                Keep editing
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </TripStoryPageShell>
  )
}

void tinymce
