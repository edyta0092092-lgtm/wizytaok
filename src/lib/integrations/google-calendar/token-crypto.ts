import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "crypto"

import { isGoogleCalendarTokenEncryptionConfigured } from "@/lib/integrations/google-calendar/config"

const ALGO = "aes-256-gcm"
const IV_BYTES = 12

function encryptionKey(): Buffer | null {
  if (!isGoogleCalendarTokenEncryptionConfigured()) return null
  const raw = process.env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY!.trim()
  const buf = Buffer.from(raw, raw.length >= 44 ? "base64" : "utf8")
  if (buf.length < 32) return null
  return buf.subarray(0, 32)
}

export type EncryptedTokenPayload = {
  ciphertext: string
  iv: string
  tag: string
}

export function encryptRefreshToken(plain: string): EncryptedTokenPayload | null {
  const key = encryptionKey()
  if (!key) return null
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  }
}

export function decryptRefreshToken(payload: EncryptedTokenPayload): string | null {
  const key = encryptionKey()
  if (!key) return null
  try {
    const iv = Buffer.from(payload.iv, "base64")
    const tag = Buffer.from(payload.tag, "base64")
    const ciphertext = Buffer.from(payload.ciphertext, "base64")
    const decipher = createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return plain.toString("utf8")
  } catch {
    return null
  }
}

export function signOAuthState(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url")
}

export function verifyOAuthState(payloadB64: string, signature: string, secret: string): boolean {
  const expected = signOAuthState(payloadB64, secret)
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
