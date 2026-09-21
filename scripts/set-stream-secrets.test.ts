import { expect, it, vi } from 'vitest'
import { setStreamSecrets } from './set-stream-secrets'

const credentials = { apiKey: 'test-api-key', apiSecret: 'test-api-secret' }
const metadata = {
  Parameters: ['STREAM_API_KEY', 'STREAM_API_SECRET'].map((name) => ({
    Name: `/logmaster/production/${name}`,
    Type: 'SecureString',
  })),
}

it('passes values only as stdin JSON and does not redeploy by default', () => {
  const runAws = vi.fn().mockReturnValue(metadata)
  const names = setStreamSecrets('production', credentials, { runAws })
  expect(names).toEqual(metadata.Parameters.map((parameter) => parameter.Name))
  expect(runAws).toHaveBeenCalledTimes(3)
  for (const [args] of runAws.mock.calls) {
    expect(JSON.stringify(args)).not.toContain(credentials.apiKey)
    expect(JSON.stringify(args)).not.toContain(credentials.apiSecret)
  }
  expect(runAws.mock.calls[2]).toEqual([
    ['ssm', 'put-parameter', '--cli-input-json', 'file:///dev/stdin'],
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
