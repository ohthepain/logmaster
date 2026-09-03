import { Layers } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  MAP_DATA_LAYERS,
} from '../lib/map-data-layers'
import type { MapDataLayerGroup, MapDataLayerToggles } from '../lib/map-data-layers'
import { MAP_LOG_ENTRY_LAYER_TOGGLES } from '../lib/map-log-entry-layers'
import type { MapLogEntryLayerToggles } from '../lib/map-log-entry-layers'
import { MapControlButton } from './SailingMapControlStack'

const DATA_GROUP_LABELS: Record<MapDataLayerGroup, string> = {
  basemap: 'Basemap',
  places: 'Places',
  mooring: 'Mooring & shelter',
  navigation: 'Navigation',
  bathymetry: 'Bathymetry',
}

type SailingMapLayerPanelProps = {
  toggles: MapDataLayerToggles
  onChange: (next: Partial<MapDataLayerToggles>) => void
  logEntryToggles: MapLogEntryLayerToggles
  onLogEntryChange: (next: Partial<MapLogEntryLayerToggles>) => void
}

export function SailingMapLayerPanel({
  toggles,
  onChange,
  logEntryToggles,
  onLogEntryChange,
}: SailingMapLayerPanelProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
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

  return (
    <div ref={rootRef} className="relative">
      <MapControlButton
        label="Map layers"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Layers className="size-4" strokeWidth={2.25} />
      </MapControlButton>

      {open ? (
        <div className="absolute bottom-0 right-[calc(100%+0.5rem)] z-50 w-[min(18rem,calc(100vw-3rem))] rounded-lg border border-[rgba(126,200,232,0.2)] bg-[rgba(26,51,72,0.97)] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
            <p className="m-0 mb-2 text-xs font-semibold uppercase tracking-wide text-white/70">
              Map layers
            </p>
            <div className="flex max-h-[min(20rem,50vh)] flex-col gap-3 overflow-y-auto">
              {dataGroups.map(([group, layers]) => (
                <div key={group}>
                  <p className="m-0 mb-1.5 text-[10px] font-medium uppercase tracking-wider text-white/50">
                    {DATA_GROUP_LABELS[group]}
                  </p>
                  <ul className="m-0 flex list-none flex-col gap-1 p-0">
                    {layers.map((layer) => (
                      <li key={layer.id}>
                        <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 hover:bg-white/5">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={toggles[layer.id]}
                            onChange={(event) =>
                              onChange({
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
              ))}

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
            </div>
        </div>
      ) : null}
    </div>
  )
}
