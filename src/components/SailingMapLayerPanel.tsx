import { Layers } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  MAP_DATA_LAYERS,
  resolveMapDataLayerToggle,
} from '../lib/map-data-layers'
import type { MapDataLayerGroup, MapDataLayerToggles } from '../lib/map-data-layers'
import { MAP_LOG_ENTRY_LAYER_TOGGLES } from '../lib/map-log-entry-layers'
import type { MapLogEntryLayerToggles } from '../lib/map-log-entry-layers'
import { MapControlButton } from './SailingMapControlStack'
import { useLogbookStore } from '../stores/logbook'

const DATA_GROUP_LABELS: Record<MapDataLayerGroup, string> = {
  basemap: 'Basemap',
  places: 'Places',
  mooring: 'Mooring & shelter',
  navigation: 'Navigation',
  bathymetry: 'Bathymetry',
}

const PANEL_WIDTH_PX = 288
const PANEL_GAP_PX = 8
const VIEWPORT_MARGIN_PX = 12

type SailingMapLayerPanelProps = {
  toggles: MapDataLayerToggles
  onChange: (next: Partial<MapDataLayerToggles>) => void
  logEntryToggles?: MapLogEntryLayerToggles
  onLogEntryChange?: (next: Partial<MapLogEntryLayerToggles>) => void
  /** Trip playback scrubs historical time — live AIS is hidden and disabled. */
  aisPlaybackBlocked?: boolean
  /** Saved trip static map — clarify that AIS is traffic now, not at trip time. */
  aisSavedTripHint?: boolean
  /** Planned route map — clarify that AIS is live traffic near the route. */
  aisPlannedRouteHint?: boolean
}

type PanelPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
}

function computePanelPosition(anchor: DOMRect): PanelPosition {
  const width = Math.min(PANEL_WIDTH_PX, window.innerWidth - VIEWPORT_MARGIN_PX * 2)
  const viewportHeight = window.innerHeight - VIEWPORT_MARGIN_PX * 2
  const maxHeight = Math.min(320, viewportHeight)

  let left = anchor.left - width - PANEL_GAP_PX
  if (left < VIEWPORT_MARGIN_PX) {
    left = Math.min(
      anchor.right + PANEL_GAP_PX,
      window.innerWidth - width - VIEWPORT_MARGIN_PX,
    )
  }

  // Grow upward from the layers button; clamp to the viewport.
  let top = anchor.bottom - maxHeight
  if (top < VIEWPORT_MARGIN_PX) {
    top = VIEWPORT_MARGIN_PX
  }
  const height = Math.min(maxHeight, anchor.bottom - top)

  return { top, left, width, maxHeight: Math.max(height, 160) }
}

export function SailingMapLayerPanel({
  toggles,
  onChange,
  logEntryToggles,
  onLogEntryChange,
  aisPlaybackBlocked = false,
  aisSavedTripHint = false,
  aisPlannedRouteHint = false,
}: SailingMapLayerPanelProps) {
  const showLogEntryLayers = logEntryToggles != null && onLogEntryChange != null
  const [open, setOpen] = useState(false)
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const online = useLogbookStore((state) => state.online)

  useLayoutEffect(() => {
    if (!open || !rootRef.current) {
      setPanelPosition(null)
      return
    }

    const updatePosition = () => {
      if (!rootRef.current) return
      setPanelPosition(computePanelPosition(rootRef.current.getBoundingClientRect()))
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return
      }
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const dataGroups = useMemo(() => {
    const byGroup = new Map<MapDataLayerGroup, typeof MAP_DATA_LAYERS>()
    for (const layer of MAP_DATA_LAYERS) {
      const list = byGroup.get(layer.group) ?? []
      list.push(layer)
      byGroup.set(layer.group, list)
    }
    return Array.from(byGroup.entries())
  }, [])

  const panelContent = panelPosition ? (
    <div
      ref={panelRef}
      data-map-touch-zone
      className="fixed z-[120] flex flex-col overflow-hidden rounded-lg border border-[rgba(126,200,232,0.2)] bg-[rgba(26,51,72,0.97)] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
      style={{
        top: panelPosition.top,
        left: panelPosition.left,
        width: panelPosition.width,
        height: panelPosition.maxHeight,
      }}
    >
      <p className="m-0 mb-2 shrink-0 text-xs font-semibold uppercase tracking-wide text-white/70">
        Map layers
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="flex flex-col gap-3 pb-0.5">
        {dataGroups.map(([group, layers]) => (
          <div key={group}>
            <p className="m-0 mb-1.5 text-[10px] font-medium uppercase tracking-wider text-white/50">
              {DATA_GROUP_LABELS[group]}
            </p>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {layers.map((layer) => {
                const aisLayer = layer.id === 'ais-live'
                const aisDisabled =
                  (layer.onlineOnly === true && !online) ||
                  (aisLayer && aisPlaybackBlocked)
                return (
                  <li key={layer.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 hover:bg-white/5">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                            checked={resolveMapDataLayerToggle(toggles, layer.id)}
                        disabled={aisDisabled}
                        onChange={(event) =>
                          onChange({
                            [layer.id]: event.target.checked,
                          })
                        }
                      />
                      <span className="min-w-0">
                        <span className="block text-sm text-white/95">
                          {layer.title}
                          {layer.onlineOnly ? (
                            <span className="ml-1 text-[10px] font-normal uppercase tracking-wide text-white/45">
                              {aisPlaybackBlocked
                                ? 'Replay'
                                : online
                                  ? 'Live'
                                  : 'Offline'}
                            </span>
                          ) : null}
                        </span>
                        <span className="block text-[11px] leading-snug text-white/55">
                          {layer.description}
                          {aisLayer && aisSavedTripHint ? (
                            <span className="mt-0.5 block text-white/45">
                              Shows traffic now along your saved route.
                            </span>
                          ) : null}
                          {aisLayer && aisPlannedRouteHint ? (
                            <span className="mt-0.5 block text-white/45">
                              Shows live traffic near your planned route.
                            </span>
                          ) : null}
                          {aisLayer && aisPlaybackBlocked ? (
                            <span className="mt-0.5 block text-white/45">
                              Unavailable during trip replay.
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        {showLogEntryLayers ? (
          <div>
            <p className="m-0 mb-1.5 text-[10px] font-medium uppercase tracking-wider text-white/50">
              Log entries
            </p>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {MAP_LOG_ENTRY_LAYER_TOGGLES.map((layer) => (
                <li key={layer.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 hover:bg-white/5">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={logEntryToggles[layer.id]}
                      onChange={(event) =>
                        onLogEntryChange({
                          [layer.id]: event.target.checked,
                        })
                      }
                    />
                    <span className="min-w-0">
                      <span className="block text-sm text-white/95">
                        {layer.title}
                      </span>
                      <span className="block text-[11px] leading-snug text-white/55">
                        {layer.description}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        </div>
      </div>
    </div>
  ) : null

  return (
    <div ref={rootRef} className="relative">
      <MapControlButton
        label="Map layers"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Layers className="size-4" strokeWidth={2.25} />
      </MapControlButton>

      {open && typeof document !== 'undefined'
        ? createPortal(panelContent, document.body)
        : null}
    </div>
  )
}
