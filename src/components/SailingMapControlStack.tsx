import { LoaderCircle, LocateFixed, Maximize2, Minus, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import {
  MAP_CHROME_BUTTON_HOVER_CLASS,
  MAP_CHROME_CELL_CLASS,
  MAP_CHROME_DIVIDER_CLASS,
  MAP_CHROME_SURFACE_CLASS,
} from '../lib/map-chrome'
import { useTranslation } from '../lib/i18n'
import { MapButtonTooltip } from './MapButtonTooltip'

type SailingMapControlStackProps = {
  onZoomIn: () => void
  onZoomOut: () => void
  onLocate?: () => void
  locatePending?: boolean
  locateLabel?: string
  locateMode?: 'you' | 'boat' | 'route'
  layers?: ReactNode
  onExpand?: () => void
  className?: string
}

export function SailingMapControlStack({
  onZoomIn,
  onZoomOut,
  onLocate,
  locatePending = false,
  locateLabel,
  locateMode = 'you',
  layers,
  onExpand,
  className,
}: SailingMapControlStackProps) {
  const { t } = useTranslation()
  const resolvedLocateLabel =
    locateLabel ??
    t(
      locateMode === 'boat'
        ? 'centerOnBoatPosition'
        : locateMode === 'route'
          ? 'fitRoute'
          : 'centerOnYourLocation',
    )
  return (
    <div
      className={cn(
        'sailing-map-controls pointer-events-none absolute right-2.5 top-1/2 z-40 -translate-y-1/2 sm:right-3',
        className,
      )}
    >
      <div
        data-map-touch-zone
        className={cn(
          'ios-map-touch-target pointer-events-auto flex flex-col overflow-visible',
          MAP_CHROME_SURFACE_CLASS,
        )}
      >
        <MapControlButton label={t('zoomIn')} onClick={onZoomIn}>
          <Plus className="size-5" strokeWidth={2.25} />
        </MapControlButton>
        <MapControlButton label={t('zoomOut')} onClick={onZoomOut} bordered>
          <Minus className="size-5" strokeWidth={2.25} />
        </MapControlButton>
        {onLocate ? (
          <MapControlButton
            label={resolvedLocateLabel}
            onClick={onLocate}
            bordered
            disabled={locatePending}
          >
            {locatePending ? (
              <LoaderCircle
                className="size-5 animate-spin motion-reduce:animate-none"
                aria-hidden
              />
            ) : (
              <LocateFixed className="size-5" strokeWidth={2.25} />
            )}
          </MapControlButton>
        ) : null}
        {layers ? (
          <div className={cn('relative', MAP_CHROME_DIVIDER_CLASS)}>
            {layers}
          </div>
        ) : null}
        {onExpand ? (
          <MapControlButton
            label={t('openFullScreenMap')}
            onClick={onExpand}
            bordered
          >
            <Maximize2 className="size-5" strokeWidth={2.25} />
          </MapControlButton>
        ) : null}
      </div>
    </div>
  )
}

export function MapControlButton({
  label,
  onClick,
  bordered,
  disabled = false,
  children,
  'aria-expanded': ariaExpanded,
}: {
  label: string
  onClick: () => void
  bordered?: boolean
  disabled?: boolean
  children: ReactNode
  'aria-expanded'?: boolean
}) {
  return (
    <MapButtonTooltip label={label} side="left">
      <button
        type="button"
        aria-label={label}
        aria-expanded={ariaExpanded}
        aria-busy={disabled || undefined}
        title={label}
        disabled={disabled}
        onClick={onClick}
        onPointerUp={(event) => {
          event.stopPropagation()
        }}
        className={cn(
          'ios-map-touch-target touch-manipulation',
          MAP_CHROME_CELL_CLASS,
          !disabled && MAP_CHROME_BUTTON_HOVER_CLASS,
          disabled && 'opacity-80',
          bordered && MAP_CHROME_DIVIDER_CLASS,
        )}
      >
        {children}
      </button>
    </MapButtonTooltip>
  )
}
