import type { AisVessel } from '../../domain/ais-vessel'
import type { AisVesselCategory } from '../../domain/ais-vessel-categories'
import {
  aisCategoryForShipType,
  aisNavigationalStatusLabel,
  aisShipTypeLabel,
} from '../../domain/ais-vessel-categories'

type PositionPayload = {
  UserID?: number
  NavigationalStatus?: number
  Latitude?: number
  Longitude?: number
  Sog?: number
  Cog?: number
  TrueHeading?: number
}

type StaticPayload = {
  Type?: number
  Name?: string
  CallSign?: string
  ImoNumber?: number | string
  Destination?: string
  Dimension?: {
    A?: number
    B?: number
    C?: number
    D?: number
  }
}

function readNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function readHeading(value: unknown): number | null {
  const heading = readNumber(value)
  if (heading == null || heading >= 511) return null
  return heading
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readPositionPayload(message: Record<string, unknown> | undefined): PositionPayload | null {
  if (!message) return null
  for (const key of [
    'PositionReport',
    'StandardClassBPositionReport',
    'ExtendedClassBPositionReport',
    'LongRangeAisBroadcastMessage',
    'BaseStationReport',
  ]) {
    const payload = message[key]
    if (payload && typeof payload === 'object') {
      return payload as PositionPayload
    }
  }
  return null
}

function normalizeStaticRecord(raw: Record<string, unknown>): StaticPayload {
  const reported = raw.ReportedMessage
  const source =
    reported && typeof reported === 'object'
      ? (reported as Record<string, unknown>)
      : raw

  const payload: StaticPayload = {}
  const type =
    readNumber(source.Type) ?? readNumber(source.ShipType) ?? readNumber(source.type)
  if (type != null) payload.Type = type

  const name = readString(source.Name)
  if (name) payload.Name = name

  const callSign = readString(source.CallSign)
  if (callSign) payload.CallSign = callSign

  if (typeof source.ImoNumber === 'number' || typeof source.ImoNumber === 'string') {
    payload.ImoNumber = source.ImoNumber
  }

  const destination = readString(source.Destination)
  if (destination) payload.Destination = destination

  if (source.Dimension && typeof source.Dimension === 'object') {
    payload.Dimension = source.Dimension as StaticPayload['Dimension']
  }

  return payload
}

function readStaticPayload(message: Record<string, unknown> | undefined): StaticPayload | null {
  if (!message) return null
  for (const key of ['ShipStaticData', 'StaticDataReport']) {
    const payload = message[key]
    if (payload && typeof payload === 'object') {
      return normalizeStaticRecord(payload as Record<string, unknown>)
    }
  }
  return null
}

function readMetaShipType(meta: Record<string, unknown>): number | null {
  return (
    readNumber(meta.Type) ??
    readNumber(meta.ShipType) ??
    readNumber(meta.ship_type) ??
    readNumber(meta.ShipAndCargoType)
  )
}

function readMmsi(meta: Record<string, unknown>, position: PositionPayload | null): string | null {
  const fromMeta = meta.MMSI ?? meta.MMSI_String
  if (fromMeta != null) return String(fromMeta)
  if (position?.UserID != null) return String(position.UserID)
  return null
}

function readDimensions(staticData: StaticPayload | null): {
  lengthMeters: number | null
  widthMeters: number | null
} {
  const dimension = staticData?.Dimension
  if (!dimension) return { lengthMeters: null, widthMeters: null }
  const a = readNumber(dimension.A)
  const b = readNumber(dimension.B)
  const c = readNumber(dimension.C)
  const d = readNumber(dimension.D)
  const lengthMeters = a != null && b != null ? a + b : null
  const widthMeters = c != null && d != null ? c + d : null
  return { lengthMeters, widthMeters }
}

function staticFieldsFromPayload(
  meta: Record<string, unknown>,
  staticData: StaticPayload | null,
): Partial<
  Pick<
    AisVessel,
    | 'name'
    | 'shipType'
    | 'shipTypeLabel'
    | 'category'
    | 'callSign'
    | 'imo'
    | 'destination'
    | 'lengthMeters'
    | 'widthMeters'
  >
> {
  const result: Partial<
    Pick<
      AisVessel,
      | 'name'
      | 'shipType'
      | 'shipTypeLabel'
      | 'category'
      | 'callSign'
      | 'imo'
      | 'destination'
      | 'lengthMeters'
      | 'widthMeters'
    >
  > = {}

  const metaName = readString(meta.ShipName)
  if (metaName) result.name = metaName

  const staticName = readString(staticData?.Name)
  if (staticName) result.name = staticName

  const shipType = readMetaShipType(meta) ?? readNumber(staticData?.Type)
  if (shipType != null) {
    result.shipType = shipType
    result.shipTypeLabel = aisShipTypeLabel(shipType)
    result.category = aisCategoryForShipType(shipType)
  }

  const callSign = readString(staticData?.CallSign)
  if (callSign) result.callSign = callSign

  const imoRaw = staticData?.ImoNumber
  if (typeof imoRaw === 'number') {
    result.imo = String(imoRaw)
  } else if (typeof imoRaw === 'string' && imoRaw.trim()) {
    result.imo = imoRaw.trim()
  }

  const destination = readString(staticData?.Destination)
  if (destination) result.destination = destination

  const { lengthMeters, widthMeters } = readDimensions(staticData)
  if (lengthMeters != null) result.lengthMeters = lengthMeters
  if (widthMeters != null) result.widthMeters = widthMeters

  return result
}

/** Normalize one AISStream JSON frame into a vessel update, if applicable. */
export function parseAisStreamMessage(raw: unknown): Partial<AisVessel> | null {
  if (!raw || typeof raw !== 'object') return null
  const frame = raw as Record<string, unknown>
  if (frame.MessageType === 'SubscriptionConfirmation') return null

  const meta = frame.MetaData
  if (!meta || typeof meta !== 'object') return null
  const metaRecord = meta as Record<string, unknown>

  const message = frame.Message as Record<string, unknown> | undefined
  const position = readPositionPayload(message)
  const staticData = readStaticPayload(message)
  const mmsi = readMmsi(metaRecord, position)
  if (mmsi == null) return null

  const staticFields = staticFieldsFromPayload(metaRecord, staticData)
  const latitude =
    readNumber(metaRecord.Latitude) ??
    readNumber(metaRecord.latitude) ??
    readNumber(position?.Latitude)
  const longitude =
    readNumber(metaRecord.Longitude) ??
    readNumber(metaRecord.longitude) ??
    readNumber(position?.Longitude)

  const navigationalStatus = readNumber(position?.NavigationalStatus)

  const base: Partial<AisVessel> = {
    mmsi,
    ...staticFields,
    updatedAt: new Date().toISOString(),
  }

  if (navigationalStatus != null) {
    base.navigationalStatus = navigationalStatus
    base.navigationalStatusLabel = aisNavigationalStatusLabel(navigationalStatus)
  }

  if (latitude == null || longitude == null) {
    return Object.keys(staticFields).length > 0 ? base : null
  }

  return {
    ...base,
    latitude,
    longitude,
    cog: readNumber(position?.Cog),
    sog: readNumber(position?.Sog),
    heading: readHeading(position?.TrueHeading),
  }
}

export function aisCategoryFromUpdate(
  update: Partial<AisVessel>,
  fallback: AisVesselCategory = 'unspecified',
): AisVesselCategory {
  if (update.shipType != null) return aisCategoryForShipType(update.shipType)
  if (update.category && update.category !== 'unspecified') return update.category
  return fallback
}
