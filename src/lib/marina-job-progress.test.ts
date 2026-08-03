import { describe, expect, it } from 'vitest'
import {
  formatMarinaJobProgress,
  marinaJobProgressPercent,
  parseMarinaJobProgress,
} from './marina-job-progress'

const sampleLog = `[marinas] querying 300 of 300 cells (3° grid)
[marinas] cell 1/300 · OK · 0 features
[marinas] cell 2/300 · FAIL 504 · 0 features
[marinas] fetch complete · 42 marinas
[marinas] writing 120 tile folders (42 unique marinas)
[marinas] upload 45/120 N68/W53 (225 bytes)
`

describe('parseMarinaJobProgress', () => {
  it('tracks cell and upload progress from log lines', () => {
    const progress = parseMarinaJobProgress(sampleLog)
    expect(progress.phase).toBe('uploading')
    expect(progress.cellsDone).toBe(2)
    expect(progress.cellsTotal).toBe(300)
    expect(progress.cellsFailed).toBe(1)
    expect(progress.tilesDone).toBe(45)
    expect(progress.tilesTotal).toBe(120)
    expect(progress.marinasFound).toBe(42)
    expect(progress.complete).toBe(false)
  })

  it('marks complete when done line is present', () => {
    const progress = parseMarinaJobProgress(
      `${sampleLog}[marinas] done {"marinasFound":42,"tilesWritten":120}`,
    )
    expect(progress.complete).toBe(true)
    expect(progress.phase).toBe('complete')
    expect(progress.tilesDone).toBe(120)
    expect(formatMarinaJobProgress(progress)).toContain('Complete')
  })

  it('computes percent for cells and uploads', () => {
    expect(marinaJobProgressPercent(parseMarinaJobProgress(sampleLog))).toBe(
      38,
    )
    expect(
      marinaJobProgressPercent(
        parseMarinaJobProgress(
          '[marinas] querying 10 of 10 cells\n[marinas] cell 5/10 · OK · 1 features',
        ),
      ),
    ).toBe(50)
  })
})
