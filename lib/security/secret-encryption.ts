import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

export const SECRET_ENCRYPTION_ALGORITHM = 'aes-256-gcm'
export const SECRET_ENCRYPTION_KEY_VERSION = 1

const IV_LENGTH = 12

export type EncryptedSecretPayload = {
  algorithm: string
  key_version: number
  iv: string
  ciphertext: string
  auth_tag: string
}

function getEncryptionSource(): string | null {
  return (
    process.env.BOT_SECRETS_ENCRYPTION_KEY ||
    process.env.ADMIN_EMAIL_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    null
  )
}

function getMasterKey(): Buffer | null {
  const source = getEncryptionSource()
  if (!source) return null
  return createHash('sha256').update(source).digest()
}

export function encryptSecret(plaintext: string): EncryptedSecretPayload {
  const key = getMasterKey()
  if (!key) {
    throw new Error('Missing BOT_SECRETS_ENCRYPTION_KEY, ADMIN_EMAIL_ENCRYPTION_KEY or SUPABASE_SERVICE_ROLE_KEY')
  }

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(SECRET_ENCRYPTION_ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return {
    algorithm: SECRET_ENCRYPTION_ALGORITHM,
    key_version: SECRET_ENCRYPTION_KEY_VERSION,
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    auth_tag: authTag.toString('base64'),
  }
}

export function decryptSecret(
  row:
    | {
        algorithm?: string | null
        iv?: string | null
        ciphertext?: string | null
        auth_tag?: string | null
      }
    | null
    | undefined
): string | null {
  if (!row?.algorithm || !row.iv || !row.ciphertext || !row.auth_tag) {
    return null
  }

  if (row.algorithm !== SECRET_ENCRYPTION_ALGORITHM) {
    return null
  }

  const key = getMasterKey()
  if (!key) {
    return null
  }

  try {
    const decipher = createDecipheriv(
      SECRET_ENCRYPTION_ALGORITHM,
      key,
      Buffer.from(row.iv, 'base64')
    )
    decipher.setAuthTag(Buffer.from(row.auth_tag, 'base64'))
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(row.ciphertext, 'base64')),
      decipher.final(),
    ])
    return plaintext.toString('utf8')
  } catch {
    return null
  }
}
