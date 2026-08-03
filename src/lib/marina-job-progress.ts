export type MarinaJobProgress = {
  phase: 'starting' | 'cells' | 'uploading' | 'complete'
  cellsDone: number
  cellsTotal: number | null
  cellsFailed: number
  tilesDone: number
  tilesTotal: number | null
  marinasFound: number | null
  complete: boolean
}

function parseCount(value: string): number {
  return Number(value.replace(/,/g, ''))
}

export function parseMarinaJobProgress(log: string): MarinaJobProgress {
  const progress: MarinaJobProgress = {
    phase: 'starting',
    cellsDone: 0,
    cellsTotal: null,
    cellsFailed: 0,
    tilesDone: 0,
    tilesTotal: null,
    marinasFound: null,
    complete: false,
  }

  if (!log.trim()) return progress

  const querying = log.match(/querying (\d[\d,]*) of (\d[\d,]*) cells/)
  if (querying) {
    progress.cellsTotal = parseCount(querying[2])
  }

  for (const line of log.split('\n')) {
    const cellMatch = line.match(/cell (\d[\d,]*)\/(\d[\d,]*)/)
    if (cellMatch && /\b(OK|FAIL)\b/.test(line)) {
      progress.cellsDone = Math.max(
        progress.cellsDone,
        parseCount(cellMatch[1]),
      )
      progress.cellsTotal = parseCount(cellMatch[2])
      if (/\bFAIL\b/.test(line)) {
        progress.cellsFailed += 1
      }
    }

    const upload = line.match(/upload (\d[\d,]*)\/(\d[\d,]*)/)
    if (upload) {
      progress.tilesDone = Math.max(
        progress.tilesDone,
        parseCount(upload[1]),
      )
      progress.tilesTotal = parseCount(upload[2])
    } else if (/\buploaded s3:\/\//.test(line)) {
      progress.tilesDone += 1
    }
  }

  const writing = log.match(
    /writing (\d[\d,]*) tile folders \((\d[\d,]*) unique marinas\)/,
  )
  if (writing) {
    progress.tilesTotal = parseCount(writing[1])
    progress.marinasFound = parseCount(writing[2])
  }

  const fetchComplete = log.match(/fetch complete · (\d[\d,]*) marinas/)
  if (fetchComplete) {
    progress.marinasFound = parseCount(fetchComplete[1])
  }

  const done = log.match(/\[marinas\] done /)
  if (done) {
    progress.complete = true
    progress.phase = 'complete'
    const result = log.match(/"marinasFound":(\d+)/)
    const tiles = log.match(/"tilesWritten":(\d+)/)
    if (result) progress.marinasFound = parseCount(result[1])
    if (tiles) {
      progress.tilesTotal = parseCount(tiles[1])
      progress.tilesDone = progress.tilesTotal
    }
    return progress
  }

  if (progress.tilesTotal != null && progress.tilesTotal > 0) {
    progress.phase = 'uploading'
  } else if (progress.cellsTotal != null || progress.cellsDone > 0) {
    progress.phase = 'cells'
  }

  return progress
}

export function formatMarinaJobProgress(progress: MarinaJobProgress): string {
  if (progress.complete) {
    const marinas =
      progress.marinasFound != null
        ? ` · ${progress.marinasFound.toLocaleString()} marinas`
        : ''
    const tiles =
      progress.tilesTotal != null
        ? `${progress.tilesTotal.toLocaleString()} tiles`
        : 'done'
    return `Complete · ${tiles}${marinas}`
  }

  if (progress.phase === 'uploading' && progress.tilesTotal != null) {
    return `Upload ${progress.tilesDone}/${progress.tilesTotal} tiles`
  }

  if (progress.phase === 'cells' && progress.cellsTotal != null) {
    const failed =
      progress.cellsFailed > 0 ? ` · ${progress.cellsFailed} failed` : ''
    return `Cells ${progress.cellsDone}/${progress.cellsTotal}${failed}`
  }

  if (progress.cellsDone > 0) {
    return `Cells ${progress.cellsDone}…`
  }

  return 'Starting…'
}

export function marinaJobProgressPercent(
  progress: MarinaJobProgress,
): number | null {
  if (progress.complete) return 100
  if (
    progress.phase === 'uploading' &&
    progress.tilesTotal != null &&
    progress.tilesTotal > 0
  ) {
    return Math.round((progress.tilesDone / progress.tilesTotal) * 100)
  }
  if (
    progress.phase === 'cells' &&
    progress.cellsTotal != null &&
    progress.cellsTotal > 0
  ) {
    return Math.round((progress.cellsDone / progress.cellsTotal) * 100)
  }
  return null
}
