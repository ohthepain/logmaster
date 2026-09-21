import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { config } from 'dotenv'

type AwsRunner = (args: string[], input?: Record<string, unknown>) => unknown

function awsJson(args: string[], input?: Record<string, unknown>): unknown {
  // AWS CLI cannot reopen Node's stdin on macOS. Use an owner-only temporary
  // directory/file and always remove it, including on CLI errors.
  const directory = input
    ? mkdtempSync(resolve(tmpdir(), 'logmaster-ssm-'))
    : undefined
  try {
    const inputPath = directory ? resolve(directory, 'input.json') : undefined
    if (inputPath) writeFileSync(inputPath, JSON.stringify(input), { mode: 0o600 })
    const result = spawnSync(
      'aws',
      [
        ...args,
        ...(inputPath ? ['--cli-input-json', `file://${inputPath}`] : []),
        '--region',
        process.env.AWS_REGION || 'eu-central-1',
        '--output',
        'json',
        '--no-cli-pager',
      ],
      {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, AWS_CLI_AUTO_PROMPT: 'off', AWS_PAGER: '' },
      },
    )
    if (result.error || result.status !== 0) {
      const code = result.stderr?.match(
        /An error occurred \(([A-Za-z0-9]+)\)/,
      )?.[1]
      // SDK/CLI errors can include request payloads; never forward their raw output.
      throw new Error(
        `AWS ${args[0]} ${args[1]} failed${code ? ` (${code})` : ''}. Check AWS login and permissions.`,
      )
    }
    return result.stdout.trim() ? JSON.parse(result.stdout) : {}
  } finally {
    if (directory) rmSync(directory, { recursive: true, force: true })
  }
}

export function setStreamSecrets(
  environment: string,
  credentials: { apiKey: string; apiSecret: string },
  options: { redeploy?: boolean; project?: string; runAws?: AwsRunner } = {},
): string[] {
  if (!['staging', 'production'].includes(environment))
    throw new Error('Environment must be staging or production.')
  const project = options.project || 'logmaster'
  if (!/^[a-zA-Z0-9-]+$/.test(project)) throw new Error('Invalid project name.')
  const apiKey = credentials.apiKey.trim()
  const apiSecret = credentials.apiSecret.trim()
  if (!apiKey || !apiSecret)
    throw new Error(
      'Set STREAM_API_KEY and STREAM_API_SECRET in the gitignored .env file or environment first.',
    )
  const runAws = options.runAws || awsJson
  const prefix = `/${project}/${environment}/`
  const parameters = [
    { Name: `${prefix}STREAM_API_KEY`, Value: apiKey },
    { Name: `${prefix}STREAM_API_SECRET`, Value: apiSecret },
  ]
  const metadata = runAws([
    'ssm',
    'describe-parameters',
    '--parameter-filters',
    JSON.stringify([
      { Key: 'Name', Option: 'BeginsWith', Values: [`${prefix}STREAM_`] },
    ]),
  ]) as { Parameters?: Array<{ Name: string; Type: string }> }
  if (
    !parameters.every((parameter) =>
      metadata.Parameters?.some(
        (existing) =>
          existing.Name === parameter.Name && existing.Type === 'SecureString',
      ),
    )
  ) {
    throw new Error(
      `Apply Terraform for ${environment} first: both Stream SecureString parameters must already exist.`,
    )
  }
  for (const parameter of parameters) {
    runAws(['ssm', 'put-parameter'], {
      ...parameter,
      Type: 'SecureString',
      Overwrite: true,
    })
  }
  if (options.redeploy) {
    runAws([
      'ecs',
      'update-service',
      '--cluster',
      `${project}-${environment}-cluster`,
      '--service',
      `${project}-${environment}-service`,
      '--force-new-deployment',
      '--query',
      'service.serviceName',
    ])
  }
  return parameters.map((parameter) => parameter.Name)
}

const scriptPath = fileURLToPath(import.meta.url)
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  try {
    const [environment, option, ...extra] = process.argv.slice(2)
    if (!environment || (option && option !== '--redeploy') || extra.length)
      throw new Error(
        'Usage: pnpm messaging:secrets staging|production [--redeploy]',
      )
    config({ path: resolve(dirname(scriptPath), '../.env'), quiet: true })
    const names = setStreamSecrets(
      environment,
      {
        apiKey: process.env.STREAM_API_KEY || '',
        apiSecret: process.env.STREAM_API_SECRET || '',
      },
      {
        redeploy: option === '--redeploy',
        project: process.env.LOGMASTER_PROJECT_NAME,
      },
    )
    for (const name of names) console.log(`Updated ${name} (SecureString).`)
    console.log(
      option === '--redeploy'
        ? `Requested a new ${environment} ECS deployment.`
        : 'No ECS deployment requested. New tasks will read the updated values.',
    )
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Unable to set Stream secrets.',
    )
    process.exitCode = 1
  }
}
