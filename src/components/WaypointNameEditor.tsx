import { cn } from '../lib/cn'

type WaypointNameEditorProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

export function WaypointNameEditor({
  value,
  onChange,
  disabled = false,
  className,
}: WaypointNameEditorProps) {
  return (
    <div
      className={cn(
        'pointer-events-auto absolute inset-x-0 top-16 z-40 flex justify-center px-4 sm:top-[4.5rem]',
        className,
      )}
    >
      <label className="flex w-full max-w-md flex-col gap-1">
        <span className="sr-only">Waypoint name</span>
        <input
          type="text"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Waypoint name"
          className="m-0 w-full rounded-full border border-white/25 bg-black/65 px-4 py-2.5 text-sm font-medium text-white placeholder:text-white/50 backdrop-blur-sm outline-none ring-0 focus:border-white/40 disabled:opacity-60"
        />
      </label>
    </div>
  )
}
