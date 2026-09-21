import { expect, it, vi } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname } from 'node:path'
import { setStreamSecrets } from './set-stream-secrets'

vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }))

const credentials = { apiKey: 'test-api-key', apiSecret: 'test-api-secret' }
const metadata = {
  Parameters: ['STREAM_API_KEY', 'STREAM_API_SECRET'].map((name) => ({
    Name: `/logmaster/production/${name}`,
    Type: 'SecureString',
  })),
}

it.each([0, 1])('protects and removes CLI input files after exit status %i', (status) => {
  const paths: string[] = []
  vi.mocked(spawnSync).mockImplementation((_command, args) => {
    const argv = args as string[]
    expect(JSON.stringify(argv)).not.toContain(credentials.apiSecret)
    if (argv[1] === 'describe-parameters') {
      return { status: 0, stdout: JSON.stringify(metadata), stderr: '' } as ReturnType<typeof spawnSync>
    }
    const path = argv[argv.indexOf('--cli-input-json') + 1].slice('file://'.length)
    paths.push(path)
    expect(statSync(path).mode & 0o777).toBe(0o600)
    expect(statSync(dirname(path)).mode & 0o077).toBe(0)
    const input = JSON.parse(readFileSync(path, 'utf8'))
    expect([credentials.apiKey, credentials.apiSecret]).toContain(input.Value)
    return { status, stdout: '{}', stderr: `Private payload: ${input.Value}` } as ReturnType<typeof spawnSync>
  })
  if (status) {
    expect(() => setStreamSecrets('production', credentials)).toThrow('AWS ssm put-parameter failed.')
  } else {
    setStreamSecrets('production', credentials)
  }
  expect(paths.length).toBe(status ? 1 : 2)
  for (const path of paths) expect(existsSync(dirname(path))).toBe(false)
})

it('passes values separately from CLI arguments and does not redeploy by default', () => {
  const runAws = vi.fn().mockReturnValue(metadata)
  const names = setStreamSecrets('production', credentials, { runAws })
  expect(names).toEqual(metadata.Parameters.map((parameter) => parameter.Name))
  expect(runAws).toHaveBeenCalledTimes(3)
  for (const [args] of runAws.mock.calls) {
    expect(JSON.stringify(args)).not.toContain(credentials.apiKey)
    expect(JSON.stringify(args)).not.toContain(credentials.apiSecret)
  }
  expect(runAws.mock.calls[2]).toEqual([
    ['ssm', 'put-parameter'],
    {
      Name: '/logmaster/production/STREAM_API_SECRET',
      Value: credentials.apiSecret,
      Type: 'SecureString',
      Overwrite: true,
    },
  ])
})

it('requires Terraform ownership before writing either credential', () => {
  const runAws = vi
    .fn()
    .mockReturnValue({ Parameters: metadata.Parameters.slice(0, 1) })
  expect(() => setStreamSecrets('production', credentials, { runAws })).toThrow(
    'Apply Terraform',
  )
  expect(runAws).toHaveBeenCalledTimes(1)
})

it('validates environment and both credentials before contacting AWS', () => {
  const runAws = vi.fn()
  expect(() => setStreamSecrets('prodution', credentials, { runAws })).toThrow(
    'Environment',
  )
  expect(() =>
    setStreamSecrets(
      'production',
      { ...credentials, apiSecret: ' ' },
      { runAws },
    ),
  ).toThrow('Set STREAM_API_KEY')
  expect(runAws).not.toHaveBeenCalled()
})

it('redeploys only after both writes succeed and only when explicitly requested', () => {
  const runAws = vi.fn().mockReturnValue(metadata)
  setStreamSecrets('production', credentials, { runAws, redeploy: true })
  expect(runAws.mock.calls.at(-1)?.[0]).toContain('--force-new-deployment')
  const failing = vi
    .fn()
    .mockReturnValue(metadata)
    .mockImplementationOnce(() => metadata)
    .mockImplementationOnce(() => {
      throw new Error('Access denied')
    })
  expect(() =>
    setStreamSecrets('production', credentials, {
      runAws: failing,
      redeploy: true,
    }),
  ).toThrow('Access denied')
  expect(failing.mock.calls.some(([args]) => args[0] === 'ecs')).toBe(false)
})
