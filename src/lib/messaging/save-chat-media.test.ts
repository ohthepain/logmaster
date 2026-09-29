import { describe, expect, it } from 'vitest'
import {
  chatMediaDownloadName,
  chatMediaSavePlan,
  hasSavableChatMedia,
  isSavableChatMedia,
} from './save-chat-media'

describe('chat media save', () => {
  it('saves photos and videos, not voice notes', () => {
    expect(isSavableChatMedia('image/jpeg')).toBe(true)
    expect(isSavableChatMedia('video/mp4')).toBe(true)
    expect(isSavableChatMedia('audio/mp4')).toBe(false)
    expect(
      hasSavableChatMedia([
        { contentType: 'audio/webm' },
        { contentType: 'image/png' },
      ]),
    ).toBe(true)
    expect(hasSavableChatMedia([{ contentType: 'audio/webm' }])).toBe(false)
  })

  it('keeps a safe file name and adds an extension when one is missing', () => {
    expect(chatMediaDownloadName('sunset.jpg', 'image/jpeg')).toBe('sunset.jpg')
    expect(chatMediaDownloadName('clip', 'video/quicktime')).toBe('clip.mov')
    expect(chatMediaDownloadName('a/b?.png', 'image/png')).toBe('a_b_.png')
    expect(chatMediaDownloadName('   ', 'image/jpeg')).toBe('photo.jpg')
  })

  it('sends iOS photos to the library and phones through the share sheet', () => {
    expect(
      chatMediaSavePlan({
        nativePlatform: 'ios',
        canShareFiles: false,
        coarsePointer: true,
      }),
    ).toBe('photo-library')
    expect(
      chatMediaSavePlan({
        nativePlatform: 'android',
        canShareFiles: false,
        coarsePointer: true,
      }),
    ).toBe('share-sheet')
    expect(
      chatMediaSavePlan({
        nativePlatform: 'web',
        canShareFiles: true,
        coarsePointer: true,
      }),
    ).toBe('share-sheet')
    expect(
      chatMediaSavePlan({
        nativePlatform: 'web',
        canShareFiles: true,
        coarsePointer: false,
      }),
    ).toBe('download')
  })
})
