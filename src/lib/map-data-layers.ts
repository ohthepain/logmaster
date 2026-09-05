/** Map data layer registry — shared by admin builds and sailing map UI. */

export type OsmPointDatasetId = "marinas" | "harbours" | "anchorages" | "places" | "seamarks";

export type MapDataLayerId =
  | "openseamap-raster"
  | "openseamap-bathymetry-relief"
  | "openseamap-bathymetry-contours"
  | "osm-depth-soundings"
  | "geonames-cities"
  | "osm-marinas"
  | "osm-harbours"
  | "osm-anchorage"
  | "osm-bay"
  | "osm-cape"
  | "osm-island"
  | "osm-strait"
  | "osm-seamarks-buoys"
  | "osm-seamarks-lights"
  | "osm-seamarks-other"
  | "ais-live";

export type MapDataLayerGroup =
  | "basemap"
  | "places"
  | "mooring"
  | "navigation"
  | "bathymetry";

export type MapDataLayerDefinition = {
  id: MapDataLayerId;
  title: string;
  description: string;
  group: MapDataLayerGroup;
  /** Default visibility when map loads. */
  defaultVisible: boolean;
  /** Persisted in app-options. */
  persistToggle: boolean;
  /** Vector tile source — omit for raster-only layers. */
  dataset?: OsmPointDatasetId;
  tileFile?: string;
  /** Filter features by properties.kind (places / seamarks bundles). */
  kindFilter?: string[];
  /** GeoNames highres/lowres instead of OSM points. */
  geoFeatureResolution?: "highres" | "lowres";
  /** Live feed overlay — not part of the offline vector tile pipeline. */
  liveOnly?: boolean;
  /** Requires network connectivity to show data. */
  onlineOnly?: boolean;
  circleColor: string;
  circleRadius: number;
};

export const OSM_POINT_DATASETS: Record<
  OsmPointDatasetId,
  { tileFile: string; buildQueue: string; logPrefix: string }
> = {
  marinas: {
    tileFile: "marinas.json.gz",
    buildQueue: "build_marinas",
    logPrefix: "marinas",
  },
  harbours: {
    tileFile: "harbours.json.gz",
    buildQueue: "build_osm_points",
    logPrefix: "harbours",
  },
  anchorages: {
    tileFile: "anchorages.json.gz",
    buildQueue: "build_osm_points",
    logPrefix: "anchorages",
  },
  places: {
    tileFile: "places.json.gz",
    buildQueue: "build_osm_points",
    logPrefix: "places",
  },
  seamarks: {
    tileFile: "seamarks.json.gz",
    buildQueue: "build_osm_points",
    logPrefix: "seamarks",
  },
};

export const MAP_DATA_LAYERS: MapDataLayerDefinition[] = [
  {
    id: "openseamap-raster",
    title: "OpenSeaMap chart symbols",
    description: "Raster seamarks overlay (not tappable).",
    group: "navigation",
    defaultVisible: true,
    persistToggle: true,
    circleColor: "#7ec8e8",
    circleRadius: 0,
  },
  {
    id: "openseamap-bathymetry-relief",
    title: "Depth relief (GEBCO)",
    description: "Shaded underwater terrain from GEBCO (~100 m+ resolution).",
    group: "bathymetry",
    defaultVisible: false,
    persistToggle: true,
    circleColor: "#1e3a5f",
    circleRadius: 0,
  },
  {
    id: "openseamap-bathymetry-contours",
    title: "Depth contours",
    description: "OpenSeaMap depth contour lines (not for navigation).",
    group: "bathymetry",
    defaultVisible: false,
    persistToggle: true,
    circleColor: "#38bdf8",
    circleRadius: 0,
  },
  {
    id: "osm-depth-soundings",
    title: "Spot depths",
    description: "Tappable OSM depth soundings — sparse; rebuild seamarks after query updates.",
    group: "bathymetry",
    defaultVisible: false,
    persistToggle: true,
    dataset: "seamarks",
    tileFile: "seamarks.json.gz",
    kindFilter: ["depth"],
    circleColor: "#93c5fd",
    circleRadius: 4,
  },
  {
    id: "geonames-cities",
    title: "Place labels",
    description: "GeoNames cities and towns.",
    group: "places",
    defaultVisible: false,
    persistToggle: true,
    geoFeatureResolution: "highres",
    circleColor: "#c8d0dc",
    circleRadius: 3,
  },
  {
    id: "osm-marinas",
    title: "Marinas",
    description: "Mooring and marina facilities.",
    group: "mooring",
    defaultVisible: true,
    persistToggle: true,
    dataset: "marinas",
    tileFile: "marinas.json.gz",
    circleColor: "#4ade80",
    circleRadius: 6,
  },
  {
    id: "osm-harbours",
    title: "Harbours",
    description: "Ports and harbours (informational).",
    group: "mooring",
    defaultVisible: false,
    persistToggle: true,
    dataset: "harbours",
    tileFile: "harbours.json.gz",
    circleColor: "#22d3ee",
    circleRadius: 5,
  },
  {
    id: "osm-anchorage",
    title: "Anchorages",
    description: "Designated anchorage areas.",
    group: "mooring",
    defaultVisible: false,
    persistToggle: true,
    dataset: "anchorages",
    tileFile: "anchorages.json.gz",
    circleColor: "#a78bfa",
    circleRadius: 5,
  },
  {
    id: "osm-bay",
    title: "Bays",
    description: "Named bays.",
    group: "places",
    defaultVisible: false,
    persistToggle: true,
    dataset: "places",
    tileFile: "places.json.gz",
    kindFilter: ["bay"],
    circleColor: "#60a5fa",
    circleRadius: 4,
  },
  {
    id: "osm-cape",
    title: "Capes",
    description: "Headlands and capes.",
    group: "places",
    defaultVisible: false,
    persistToggle: true,
    dataset: "places",
    tileFile: "places.json.gz",
    kindFilter: ["cape"],
    circleColor: "#fbbf24",
    circleRadius: 4,
  },
  {
    id: "osm-island",
    title: "Islands",
    description: "Islands and islets.",
    group: "places",
    defaultVisible: false,
    persistToggle: true,
    dataset: "places",
    tileFile: "places.json.gz",
    kindFilter: ["island", "islet"],
    circleColor: "#34d399",
    circleRadius: 4,
  },
  {
    id: "osm-strait",
    title: "Straits",
    description: "Named straits and passages.",
    group: "places",
    defaultVisible: false,
    persistToggle: true,
    dataset: "places",
    tileFile: "places.json.gz",
    kindFilter: ["strait"],
    circleColor: "#94a3b8",
    circleRadius: 4,
  },
  {
    id: "osm-seamarks-buoys",
    title: "Buoys & beacons",
    description: "Lateral, cardinal, and special buoys/beacons.",
    group: "navigation",
    defaultVisible: false,
    persistToggle: true,
    dataset: "seamarks",
    tileFile: "seamarks.json.gz",
    kindFilter: ["buoy", "beacon"],
    circleColor: "#f97316",
    circleRadius: 5,
  },
  {
    id: "osm-seamarks-lights",
    title: "Lights",
    description: "Major and minor navigation lights.",
    group: "navigation",
    defaultVisible: false,
    persistToggle: true,
    dataset: "seamarks",
    tileFile: "seamarks.json.gz",
    kindFilter: ["light"],
    circleColor: "#fde047",
    circleRadius: 6,
  },
  {
    id: "osm-seamarks-other",
    title: "Notices & hazards",
    description: "Notices, restricted areas, wrecks.",
    group: "navigation",
    defaultVisible: false,
    persistToggle: true,
    dataset: "seamarks",
    tileFile: "seamarks.json.gz",
    kindFilter: ["notice", "restricted", "wreck", "other"],
    circleColor: "#f87171",
    circleRadius: 6,
  },
  {
    id: "ais-live",
    title: "AIS vessels (live)",
    description: "Current ship positions in the map view — coverage varies vs commercial charts (internet only).",
    group: "navigation",
    defaultVisible: true,
    persistToggle: true,
    liveOnly: true,
    onlineOnly: true,
    circleColor: "#fbbf24",
    circleRadius: 0,
  },
];

const layerById = new Map(MAP_DATA_LAYERS.map((layer) => [layer.id, layer]));

export function getMapDataLayer(id: MapDataLayerId): MapDataLayerDefinition {
  const layer = layerById.get(id);
  if (!layer) throw new Error(`Unknown map data layer "${id}"`);
  return layer;
}

export type MapDataLayerToggles = Record<MapDataLayerId, boolean>;

export function defaultMapDataLayerToggles(): MapDataLayerToggles {
  return Object.fromEntries(MAP_DATA_LAYERS.map((layer) => [layer.id, layer.defaultVisible])) as MapDataLayerToggles;
}

/** Merge persisted/partial toggles with registry defaults (new layers, missing keys). */
export function mergeMapDataLayerToggles(
  partial?: Partial<MapDataLayerToggles> | null,
): MapDataLayerToggles {
  const defaults = defaultMapDataLayerToggles();
  if (!partial) return defaults;
  return { ...defaults, ...partial };
}

export function resolveMapDataLayerToggle(
  toggles: MapDataLayerToggles,
  layerId: MapDataLayerId,
): boolean {
  const value = toggles[layerId];
  if (typeof value === "boolean") return value;
  return getMapDataLayer(layerId).defaultVisible;
}

export function resolveMapDataLayerToggles(
  toggles: MapDataLayerToggles,
): MapDataLayerToggles {
  return Object.fromEntries(
    MAP_DATA_LAYERS.map((layer) => [
      layer.id,
      resolveMapDataLayerToggle(toggles, layer.id),
    ]),
  ) as MapDataLayerToggles;
}

/** Layers backed by a fetchable vector tile (excludes raster-only). */
export function vectorMapDataLayers(): MapDataLayerDefinition[] {
  return MAP_DATA_LAYERS.filter(
    (layer) =>
      !layer.liveOnly &&
      (layer.dataset != null || layer.geoFeatureResolution != null),
  );
}

export function isLiveMapDataLayerId(layerId: MapDataLayerId): boolean {
  return getMapDataLayer(layerId).liveOnly === true;
}

export function mapDataLayerSourceId(layerId: MapDataLayerId): string {
  return `geo-${layerId}`;
}

export function mapDataLayerCircleLayerId(layerId: MapDataLayerId): string {
  return `geo-${layerId}-circles`;
}

export function mapDataLayerSymbolLayerId(layerId: MapDataLayerId): string {
  return `geo-${layerId}-symbols`;
}

/** MapLibre layer id used for rendering and hit-testing. */
export function mapDataLayerRenderLayerId(layerId: MapDataLayerId): string {
  if (layerId === "osm-seamarks-other") {
    return mapDataLayerSymbolLayerId(layerId);
  }
  if (layerId === "osm-depth-soundings") {
    return mapDataLayerCircleLayerId(layerId);
  }
  return mapDataLayerCircleLayerId(layerId);
}

/** Symbol labels paired with {@link mapDataLayerRenderLayerId} for depth soundings. */
export function mapDataLayerAuxiliaryLayerId(layerId: MapDataLayerId): string | null {
  if (layerId === "osm-depth-soundings") {
    return mapDataLayerSymbolLayerId(layerId);
  }
  return null;
}

/** Raster-only overlays toggled in the layers panel (no vector source). */
export function isRasterMapDataLayerId(layerId: MapDataLayerId): boolean {
  return (
    layerId === "openseamap-raster" ||
    layerId === "openseamap-bathymetry-relief" ||
    layerId === "openseamap-bathymetry-contours"
  );
}
