import {
  BOAT_COURSE_LINE_COLOR,
  formatCogDegrees,
  formatSogKnots,
  useBoatMotionReading,
} from '../lib/boat-motion'

export function BoatMotionReadout({ tripId }: { tripId: string }) {
  const reading = useBoatMotionReading(tripId)
  if (!reading) return null

  const speed = formatSogKnots(reading.sogKnots)
  const course = formatCogDegrees(reading.cogDegrees)

  return (
    <div className="sticky top-0 z-10 flex justify-center pb-1 pt-0.5">
      <div
        data-boat-motion
        className="flex flex-col items-center rounded-full border border-white/30 bg-black/45 px-4 py-1.5 text-white shadow-[0_8px_22px_rgba(0,0,0,0.35)] backdrop-blur-md"
        aria-label={`Speed over ground ${speed}, course ${course}`}
      >
        <p className="m-0 flex items-baseline gap-1.5 leading-none">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/65">
            SOG
          </span>
          <span className="text-[1.35rem] font-semibold tabular-nums tracking-tight">
            {reading.sogKnots < 10
              ? reading.sogKnots.toFixed(1)
              : Math.round(reading.sogKnots)}
          </span>
          <span className="text-xs font-medium text-white/70">kn</span>
        </p>
        <p className="m-0 mt-1 flex items-center gap-1 text-[13px] font-medium tabular-nums text-white/90">
          <svg
            viewBox="0 0 12 12"
            className="h-3 w-3"
            style={{ transform: `rotate(${reading.cogDegrees}deg)` }}
            aria-hidden
          >
            <path d="M6 1.2 10.2 10.2H1.8Z" fill={BOAT_COURSE_LINE_COLOR} />
          </svg>
          <span>{course}</span>
        </p>
      </div>
    </div>
  )
}
