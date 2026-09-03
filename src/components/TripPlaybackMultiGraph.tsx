import { useMemo } from 'react'
import type { TripPlaybackRange } from '../lib/trip-playback'
import type { PlaybackGraphSeries } from '../lib/trip-playback-panels'
import {
  filterPlaybackGraphPointsForWindow,
  interpolatePlaybackGraphValue,
} from '../lib/trip-playback-panels'

type TripPlaybackMultiGraphProps = {
  series: PlaybackGraphSeries[]
  windowRange: TripPlaybackRange
  currentTimeMs: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

type SeriesLayout = {
  series: PlaybackGraphSeries
  windowPoints: { timeMs: number; value: number }[]
  minValue: number
  maxValue: number
  normalized: boolean
}

function buildSeriesLayouts(
  series: PlaybackGraphSeries[],
  windowRange: TripPlaybackRange,
): SeriesLayout[] {
  const scaleGroups = new Set(series.map((item) => item.scaleGroup))
  const sharedScale = scaleGroups.size === 1

  const layouts = series.map((item) => {
    const windowPoints = filterPlaybackGraphPointsForWindow(item.points, windowRange)
    const values = windowPoints.map((point) => point.value)
    const minValue = values.length > 0 ? Math.min(...values) : 0
    const maxValue = values.length > 0 ? Math.max(...values, minValue + 0.5) : 1
    return { series: item, windowPoints, minValue, maxValue, normalized: false }
  })

  if (!sharedScale || layouts.length <= 1) {
    return layouts.map((layout) => ({
      ...layout,
      normalized: !sharedScale,
    }))
  }

  const globalMin = Math.min(...layouts.map((layout) => layout.minValue), 0)
  const globalMax = Math.max(...layouts.map((layout) => layout.maxValue), globalMin + 0.5)
  return layouts.map((layout) => ({
    ...layout,
    minValue: globalMin,
    maxValue: globalMax,
    normalized: false,
  }))
}

export function TripPlaybackMultiGraph({
  series,
  windowRange,
  currentTimeMs,
}: TripPlaybackMultiGraphProps) {
  const layouts = useMemo(
    () => buildSeriesLayouts(series, windowRange),
    [series, windowRange],
  )

  const cursorX = clamp(
    ((currentTimeMs - windowRange.startMs) / windowRange.durationMs) * 100,
    0,
    100,
  )

  const height = 40
  const top = 6
  const bottom = 4

  const paths = layouts.map((layout) => {
    const span = Math.max(layout.maxValue - layout.minValue, 0.5)
    const xForTime = (timeMs: number) =>
      clamp(
        ((timeMs - windowRange.startMs) / windowRange.durationMs) * 100,
        0,
        100,
      )
    const yForValue = (value: number) =>
      height - bottom - ((value - layout.minValue) / span) * (height - top - bottom)

    const path = layout.windowPoints
      .map((point, index) => {
        const command = index === 0 ? 'M' : 'L'
        return `${command}${xForTime(point.timeMs).toFixed(2)} ${yForValue(point.value).toFixed(2)}`
      })
      .join(' ')

    return { layout, path }
  })

  return (
    <div className="flex min-h-0 flex-col justify-end">
      <div className="mb-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] font-semibold">
        {series.map((item) => {
          const currentValue = interpolatePlaybackGraphValue(item.points, currentTimeMs)
          return (
            <span key={item.id} className="inline-flex items-center gap-1 tabular-nums text-white">
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              <span className="text-white/70">{item.shortLabel}</span>
              <span>
                {currentValue != null ? item.formatValue(currentValue) : '—'}
              </span>
            </span>
          )
        })}
      </div>
      <svg
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        className="h-8 w-full overflow-visible"
        aria-hidden
      >
        <line x1="0" y1="36" x2="100" y2="36" stroke="rgba(255,255,255,0.18)" strokeWidth="0.6" />
        {paths.map(({ layout, path }) =>
          path ? (
            <path
              key={layout.series.id}
              d={path}
              fill="none"
              stroke={layout.series.color}
              strokeWidth="1.4"
              vectorEffect="non-scaling-stroke"
            />
          ) : null,
        )}
        <line
          x1={cursorX}
          y1="0"
          x2={cursorX}
          y2="40"
          stroke="var(--brand)"
          strokeWidth="0.8"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}
