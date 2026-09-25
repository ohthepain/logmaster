import { createHash } from 'node:crypto'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { HTTPException } from 'hono/http-exception'
import sharp from 'sharp'
import { prisma } from '../db'
import { getPhotosS3Client } from '../s3-photos'
import {
  MAX_CARD_BYTES,
  normalizeCardExpression,
} from '../../domain/response-cards'
import type {
  CardSummary,
  ImageResponseCard,
} from '../../domain/response-cards'

export function cardsBucket() {
  return (
    process.env.S3_BUCKET_MESSAGING_CARDS?.trim() || 'logmaster-messaging-cards'
  )
}
export function cardSummary(card: CardSummary): CardSummary {
  return {
    id: card.id,
    title: card.title,
    checksum: card.checksum,
    enabled: card.enabled,
  }
}
export async function responseCardSnapshot(
  id: string,
): Promise<ImageResponseCard> {
  const card = await prisma.messagingCard.findFirst({
    where: { id, enabled: true, deletedAt: null },
  })
  if (!card)
    throw new HTTPException(400, {
      message: 'This response card is no longer available.',
    })
  return { version: 1, type: 'image-response', card: cardSummary(card) }
}
export async function uploadResponseCard(file: File) {
  if (!file.size || file.size > MAX_CARD_BYTES)
    throw new HTTPException(400, {
      message: 'Choose an image smaller than 10 MB.',
    })
  const body = Buffer.from(await file.arrayBuffer())
  let contentType: string
  try {
    const metadata = await sharp(body, {
      animated: true,
      limitInputPixels: 40_000_000,
    }).metadata()
    const types: Record<string, string> = {
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    }
    contentType = types[metadata.format ?? '']
    if (
      !contentType ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > 4096 ||
      (metadata.pageHeight ?? metadata.height) > 4096 ||
      (metadata.pages ?? 1) > 300
    )
      throw new Error('Invalid card')
  } catch {
    throw new HTTPException(400, {
      message:
        'Use a PNG, JPEG, GIF or WebP image, up to 4096 pixels and 300 animation frames.',
    })
  }
  const checksum = createHash('sha256').update(body).digest('hex')
  // Content-addressed, immutable assets. Repeated admin uploads reuse the same card.
  const existing = await prisma.messagingCard.findUnique({
    where: { checksum },
  })
  if (!existing)
    await getPhotosS3Client().send(
      new PutObjectCommand({
        Bucket: cardsBucket(),
        Key: `sha256/${checksum}`,
        Body: body,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
        ChecksumSHA256: Buffer.from(checksum, 'hex').toString('base64'),
      }),
    )
  return prisma.messagingCard.upsert({
    where: { checksum },
    create: {
      checksum,
      contentType,
      size: body.length,
      title: file.name.replace(/\.[^.]+$/, '').slice(0, 120) || 'Response card',
    },
    update: { deletedAt: null, enabled: true },
  })
}
export async function readResponseCard(id: string) {
  // Retired cards remain readable by signed-in users so sent messages keep working.
  const card = await prisma.messagingCard.findUnique({ where: { id } })
  if (!card) throw new HTTPException(404, { message: 'Card not found' })
  return {
    card,
    object: await getPhotosS3Client().send(
      new GetObjectCommand({
        Bucket: cardsBucket(),
        Key: `sha256/${card.checksum}`,
      }),
    ),
  }
}

export async function matchResponseCards(text: string, language: string) {
  const normalized = normalizeCardExpression(text)
  if (!normalized) return { cards: [], translationUnavailable: false }
  const find = async (lang: string, phrase: string) => {
    const expression = await prisma.messagingExpression.findUnique({
      where: {
        language_normalized: {
          language: lang,
          normalized: normalizeCardExpression(phrase),
        },
      },
      include: {
        cards: {
          where: { card: { enabled: true, deletedAt: null } },
          include: { card: true },
          orderBy: { cardId: 'asc' },
        },
      },
    })
    return expression?.cards.map(({ card }) => cardSummary(card)) ?? []
  }
  const local = await find(language, normalized)
  if (language === 'en') return { cards: local, translationUnavailable: false }
  const verbatim = await find('en', normalized)
  return {
    cards: [
      ...new Map(
        [...local, ...verbatim].map((card) => [card.id, card]),
      ).values(),
    ],
    translationUnavailable: false,
  }
}
