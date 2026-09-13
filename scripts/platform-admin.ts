import 'dotenv/config'
import { prisma } from '../src/server/db'

const USAGE = `Usage:
  pnpm admin:platform list
  pnpm admin:platform grant <email>
  pnpm admin:platform revoke <email>

Uses DATABASE_URL from the environment (local .env).

Production RDS is not reachable from most laptops (SocketTimeout / P1008). Use:
  ./scripts/platform-admin-via-ecs.sh production grant <email>

The user must have signed in at least once before grant.`

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

async function listAdmins() {
  const rows = await prisma.user.findMany({
    where: { platformAdminAt: { not: null } },
    orderBy: { email: 'asc' },
    select: { email: true, platformAdminAt: true },
  })
  if (rows.length === 0) {
    console.info('No platform admins in the database.')
    return
  }
  for (const row of rows) {
    console.info(`${row.email}\t${row.platformAdminAt?.toISOString() ?? ''}`)
  }
}

async function grantAdmin(emailArg: string) {
  const email = normalizeEmail(emailArg)
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, platformAdminAt: true },
  })
  if (!user) {
    console.error(
      `No user with email ${email}. They must sign in once, then run grant again.`,
    )
    process.exit(1)
  }
  if (user.platformAdminAt) {
    console.info(`Already platform admin: ${user.email}`)
    return
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { platformAdminAt: new Date() },
  })
  console.info(`Granted platform admin: ${user.email}`)
}

async function revokeAdmin(emailArg: string) {
  const email = normalizeEmail(emailArg)
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, platformAdminAt: true },
  })
  if (!user) {
    console.error(`No user with email ${email}.`)
    process.exit(1)
  }
  if (!user.platformAdminAt) {
    console.info(`Not a platform admin: ${user.email}`)
    return
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { platformAdminAt: null },
  })
  console.info(`Revoked platform admin: ${user.email}`)
}

const [command, emailArg] = process.argv.slice(2)

switch (command) {
  case 'list':
    await listAdmins()
    break
  case 'grant':
    if (!emailArg) {
      console.error(USAGE)
      process.exit(1)
    }
    await grantAdmin(emailArg)
    break
  case 'revoke':
    if (!emailArg) {
      console.error(USAGE)
      process.exit(1)
    }
    await revokeAdmin(emailArg)
    break
  default:
    console.error(USAGE)
    process.exit(command ? 1 : 0)
}

await prisma.$disconnect()
