import { Mic } from 'lucide-react'
import type { ReactNode } from 'react'
import { LogEntryPhotoMenu } from './LogEntryPhotoMenu'
import { VoiceNotePlayback } from './VoiceNotePlayback'
import {
  sortContentBlocksByOrderDesc,
} from '../lib/log-entry-content-order'

export type EntryContentBlock =
  | {
      key: string
      kind: 'photo'
      order: number
      src: string
      onDelete: () => void
      onSetMetadata?: () => void | Promise<void>
      metadataBusy?: boolean
    }
  | {
      key: string
      kind: 'note'
      order: number
      value: string
      editing: boolean
      onChange: (value: string) => void
      onBlur: () => void
      inputRef?: React.RefObject<HTMLTextAreaElement | null>
    }
  | {
      key: string
      kind: 'voice'
      order: number
      recording?: boolean
      src?: string | null
      onRemove?: () => void
      placeholderMessage?: string
    }

type LogEntryContentStackProps = {
  blocks: EntryContentBlock[]
  map: ReactNode
}

export function LogEntryContentStack({ blocks, map }: LogEntryContentStackProps) {
  const sortedBlocks = sortContentBlocksByOrderDesc(blocks)

  return (
    <div className="space-y-4">
      {sortedBlocks.length > 0 ? (
        <div className="space-y-3">
          {sortedBlocks.map((block) => (
            <EntryContentBlockView key={block.key} block={block} />
          ))}
        </div>
      ) : null}
      {map}
    </div>
  )
}

function EntryContentBlockView({ block }: { block: EntryContentBlock }) {
  return (
    <div data-content-kind={block.kind}>
      {block.kind === 'photo' ? (
        <div className="relative overflow-hidden rounded-2xl border border-[var(--panel-border)]">
          <img src={block.src} alt="" className="aspect-[4/3] w-full object-cover" />
          <LogEntryPhotoMenu
            onDelete={block.onDelete}
            onSetMetadata={block.onSetMetadata}
            metadataBusy={block.metadataBusy}
          />
        </div>
      ) : null}

      {block.kind === 'note' && block.editing ? (
        <textarea
          ref={block.inputRef}
          value={block.value}
          onChange={(event) => block.onChange(event.target.value)}
          onBlur={block.onBlur}
          rows={3}
          placeholder="Add a note…"
          className="w-full rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-sm text-[var(--sea-ink)] placeholder:text-[var(--sea-ink-soft)] outline-none focus:ring-2 focus:ring-[var(--sea-ink)]/20"
        />
      ) : null}

      {block.kind === 'voice' ? (
        block.src ? (
          <VoiceNotePlayback src={block.src} onRemove={block.onRemove ?? (() => {})} />
        ) : block.recording ? (
          <p className="m-0 text-xs font-medium text-[var(--brand)]">
            Recording… tap mic to stop
          </p>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--chip-bg)] px-4 py-3 text-sm text-[var(--sea-ink-soft)]">
            <Mic className="size-4 shrink-0 text-[var(--sea-ink)]" />
            <p className="m-0">
              {block.placeholderMessage ??
                'Recording will be added in a future update. This entry is marked for a voice note.'}
            </p>
          </div>
        )
      ) : null}
    </div>
  )
}
