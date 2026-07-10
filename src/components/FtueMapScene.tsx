import { RotateCcw, Waves } from 'lucide-react'

export function FtueMapScene() {
  return (
    <div className="relative mt-auto min-h-[11rem] w-full sm:min-h-[13rem]">
      <svg
        className="absolute inset-x-0 bottom-0 h-full w-full"
        viewBox="0 0 400 220"
        preserveAspectRatio="xMidYMax meet"
        aria-hidden
      >
        <g fill="none" stroke="rgba(59,130,246,0.12)" strokeWidth="1">
          <ellipse cx="200" cy="170" rx="170" ry="95" />
          <ellipse cx="200" cy="175" rx="130" ry="72" />
          <ellipse cx="200" cy="180" rx="90" ry="48" />
        </g>
        <path
          d="M 20 150 C 90 120, 150 105, 220 95 S 330 70, 390 55"
          stroke="rgba(235,69,57,0.38)"
          strokeWidth="2"
          strokeDasharray="8 6"
          strokeLinecap="round"
        />
        <circle cx="228" cy="93" r="11" fill="#ffffff" stroke="var(--brand)" strokeWidth="3" />
        <circle cx="228" cy="93" r="4" fill="var(--brand)" />
      </svg>

      <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 sm:bottom-8">
        <div className="ftue-stats-pill rise-in">
          <span className="inline-flex items-center gap-1.5">
            <Waves className="size-4 text-[var(--brand)]" strokeWidth={2.25} />
            42 NM sailed
          </span>
          <span className="h-4 w-px bg-black/10" aria-hidden />
          <span className="inline-flex items-center gap-1.5">
            <RotateCcw className="size-4 text-[var(--brand)]" strokeWidth={2.25} />
            8 trips recorded
          </span>
        </div>
      </div>
    </div>
  )
}
