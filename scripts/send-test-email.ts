import 'dotenv/config'
import { sendTransactionalEmail } from '../src/server/email/ses'

const to = process.argv[2]
if (!to) {
  console.error('Usage: pnpm exec tsx scripts/send-test-email.ts you@example.com')
  process.exit(1)
}

await sendTransactionalEmail({
  to,
  subject: 'logmaster SES test',
  text: 'If you received this, SES is wired up correctly.',
  html: '<p>If you received this, SES is wired up correctly.</p>',
})

console.info('[email] sent to', to)
