import { prisma } from '../db'

const FLUSH_INTERVAL_MS = 500
const FLUSH_LINE_COUNT = 1

export type JobLogFn = (message: string) => void

export class JobLogger {
  private lines: string[] = []
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private flushPromise: Promise<void> | null = null

  constructor(private jobId: string) {}

  log(message: string): void {
    const line = message.replace(/\r?\n$/, '')
    if (!line) return
    this.lines.push(line)
    this.scheduleFlush()
  }

  getText(): string {
    return this.lines.join('\n')
  }

  private scheduleFlush(): void {
    if (this.lines.length % FLUSH_LINE_COUNT === 0) {
      void this.flush()
      return
    }
    if (this.flushTimer) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      void this.flush()
    }, FLUSH_INTERVAL_MS)
  }

  async flush(): Promise<void> {
    if (this.flushPromise) {
      await this.flushPromise
      return
    }
    const text = this.getText()
    this.flushPromise = prisma.adminJobLog
      .upsert({
        where: { jobId: this.jobId },
        create: { jobId: this.jobId, log: text },
        update: { log: text },
      })
      .then(() => undefined)
      .finally(() => {
        this.flushPromise = null
      })
    await this.flushPromise
  }

  async finish(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    await this.flush()
  }
}

export function createJobLogger(jobId: string): JobLogger {
  return new JobLogger(jobId)
}

export async function readJobLog(jobId: string): Promise<string | null> {
  const row = await prisma.adminJobLog.findUnique({ where: { jobId } })
  return row?.log ?? null
}
