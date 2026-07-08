/**
 * Long-running pg-boss workers (use in production or alongside dev API).
 * In production, run the API and this worker as separate processes.
 */
import 'dotenv/config'
import { getBoss } from './server/jobs/boss'

const main = async () => {
  await getBoss()
  console.log('[travelmode] pg-boss worker started')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
