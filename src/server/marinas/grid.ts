import type { MarinaBbox } from './bboxes'

export type GridCell = MarinaBbox

export function gridCellsForBbox(
  bbox: MarinaBbox,
  stepDegrees: number,
): GridCell[] {
  if (stepDegrees <= 0) {
    throw new Error('grid step must be positive')
  }

  const cells: GridCell[] = []
  for (let south = bbox.south; south < bbox.north; south += stepDegrees) {
    const north = Math.min(south + stepDegrees, bbox.north)
    for (let west = bbox.west; west < bbox.east; west += stepDegrees) {
      const east = Math.min(west + stepDegrees, bbox.east)
      cells.push({ south, west, north, east })
    }
  }
  return cells
}

export function splitGridCell(cell: GridCell): GridCell[] {
  const latMid = (cell.south + cell.north) / 2
  const lonMid = (cell.west + cell.east) / 2
  return [
    { south: cell.south, west: cell.west, north: latMid, east: lonMid },
    { south: cell.south, west: lonMid, north: latMid, east: cell.east },
    { south: latMid, west: cell.west, north: cell.north, east: lonMid },
    { south: latMid, west: lonMid, north: cell.north, east: cell.east },
  ]
}

export function cellSpanDegrees(cell: GridCell): number {
  return Math.max(cell.north - cell.south, cell.east - cell.west)
}
