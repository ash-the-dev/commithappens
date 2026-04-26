import crypto from 'crypto'
import type { Mention } from './providers'

export function createMentionHash(mention: Mention): string {
  const normalized = [
    mention.source,
    mention.url?.trim().toLowerCase() || '',
    mention.content.trim().toLowerCase().replace(/\s+/g, ' '),
  ].join('|')

  return crypto.createHash('sha256').update(normalized).digest('hex')
}
