import { afterEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import {
  identifyAsset,
  normalizeAssetPhoto,
  researchAsset,
} from './asset-intelligence'

const mocks = vi.hoisted(() => ({
  chat: vi.fn(),
  adapter: vi.fn(),
  web: vi.fn(() => ({ type: 'web_search' })),
}))
vi.mock('@tanstack/ai', () => ({ chat: mocks.chat }))
vi.mock('@tanstack/ai-openai', () => ({ openaiText: mocks.adapter }))
vi.mock('@tanstack/ai-openai/tools', () => ({ webSearchTool: mocks.web }))
afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('TanStack AI asset service', () => {
  it('sends photo bytes through the TanStack multimodal adapter with structured output', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test')
    mocks.chat.mockResolvedValue({ name: 'Pump', modelNumber: null })
    await identifyAsset(Buffer.from('photo'))
    expect(mocks.adapter).toHaveBeenCalledWith('gpt-5-mini')
    expect(mocks.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        outputSchema: expect.anything(),
        messages: [
          {
            role: 'user',
            content: [
              expect.objectContaining({ type: 'text' }),
              {
                type: 'image',
                source: {
                  type: 'data',
                  value: Buffer.from('photo').toString('base64'),
                  mimeType: 'image/jpeg',
                },
              },
            ],
          },
        ],
      }),
    )
  })
  it('requires web search and rejects unknown connection IDs and duplicate documents', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test')
    const download = {
      title: 'Guide',
      url: 'https://example.com/guide.pdf',
      purpose: 'manual',
      reason: 'Instructions',
    }
    mocks.chat.mockResolvedValue({
      category: 'Plumbing',
      downloads: [download, download],
      connections: [
        { assetId: 'tank', reason: 'Water supply' },
        { assetId: 'foreign', reason: 'Invalid' },
      ],
    })
    const result = await researchAsset(
      { name: 'Pump', description: 'Fresh water pump', modelNumber: null },
      [
        {
          id: 'tank',
          name: 'Tank',
          description: null,
          modelNumber: null,
          category: 'Plumbing',
        },
      ],
      [],
    )
    expect(result.downloads).toHaveLength(1)
    expect(result.connections).toEqual([
      { assetId: 'tank', reason: 'Water supply' },
    ])
    expect(mocks.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [{ type: 'web_search' }],
        modelOptions: { tool_choice: 'required' },
      }),
    )
  })
  it('normalizes photo pixels and strips metadata before storage or AI use', async () => {
    const source = await sharp({
      create: { width: 2600, height: 1300, channels: 3, background: 'red' },
    })
      .jpeg()
      .withMetadata()
      .toBuffer()
    const photo = await normalizeAssetPhoto(
      new File([new Uint8Array(source)], 'photo.jpg', { type: 'image/jpeg' }),
    )
    const metadata = await sharp(photo).metadata()
    expect(metadata.format).toBe('jpeg')
    expect(metadata.width).toBe(2400)
    expect(metadata.exif).toBeUndefined()
  })
  it('rejects files that claim to be images but cannot be decoded', async () => {
    await expect(
      normalizeAssetPhoto(
        new File(['<html>'], 'photo.jpg', { type: 'image/jpeg' }),
      ),
    ).rejects.toThrow('could not be read')
  })
})
