import 'dotenv/config'
import { configureStream } from '../src/server/messaging/stream-provider'

await configureStream()
console.log('Logmaster Stream event channels configured: member read access only, Stream push disabled.')
