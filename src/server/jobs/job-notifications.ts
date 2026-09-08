import type { Job } from 'pg-boss'
import { fireNotification, notifyAdminJobFinished } from '../notifications/events'

type BatchHandler<T> = (jobs: Job<T>[]) => Promise<unknown>

export function wrapJobHandlerWithNotifications<T>(
  queueName: string,
  handler: BatchHandler<T>,
): BatchHandler<T> {
  return async (jobs) => {
    try {
      const result = await handler(jobs)
      for (const job of jobs) {
        fireNotification(
          notifyAdminJobFinished({
            jobId: job.id,
            queueName,
            success: true,
            summary: 'completed successfully.',
          }),
        )
      }
      return result
    } catch (error) {
      for (const job of jobs) {
        fireNotification(
          notifyAdminJobFinished({
            jobId: job.id,
            queueName,
            success: false,
            summary:
              error instanceof Error ? error.message : 'failed unexpectedly.',
          }),
        )
      }
      throw error
    }
  }
}
