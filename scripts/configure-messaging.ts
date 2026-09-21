import 'dotenv/config'
import { configureStream } from '../src/server/messaging/stream-provider'

try {
  if (!process.env.STREAM_API_KEY?.trim() || !process.env.STREAM_API_SECRET?.trim()) {
    console.error('Set STREAM_API_KEY and STREAM_API_SECRET in the gitignored .env file first.')
    process.exitCode = 1
  } else {
    await configureStream()
    console.log('Logmaster Stream event channels configured: member read access only, Stream push disabled.')
  }
} catch {
  // Provider errors can contain request headers; do not print credentials or tokens.
  console.error('Stream configuration failed. Check the credentials, account permissions and Stream dashboard settings.')
  process.exitCode = 1
}
