import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16
const KEY_LENGTH = 32

let _cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (_cachedKey) return _cachedKey
  const secret = process.env.AGENT_CREDENTIALS_ENCRYPTION_KEY
  if (!secret || secret.length < 32) {
    throw new Error('AGENT_CREDENTIALS_ENCRYPTION_KEY must be set and at least 32 characters')
  }
  _cachedKey = createHash('sha256').update(secret).digest()
  return _cachedKey
}

export function encryptAgentCredential(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptAgentCredential(encryptedBase64: string): string {
  const key = getKey()
  const buf = Buffer.from(encryptedBase64, 'base64')
  if (buf.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Invalid encrypted payload')
  }
  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })
  decipher.setAuthTag(tag)
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
}
