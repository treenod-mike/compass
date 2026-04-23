import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

function getKey(): Buffer {
  const hex = process.env.APPSFLYER_MASTER_KEY
  if (!hex) throw new Error("APPSFLYER_MASTER_KEY env var missing")
  if (hex.length !== 64) throw new Error("APPSFLYER_MASTER_KEY must be 32 bytes (64 hex chars)")
  return Buffer.from(hex, "hex")
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${enc.toString("hex")}:${tag.toString("hex")}`
}

export function decryptToken(packed: string): string {
  const parts = packed.split(":")
  if (parts.length !== 3) throw new Error("invalid ciphertext format")
  const [ivHex, cipherHex, tagHex] = parts
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"))
  decipher.setAuthTag(Buffer.from(tagHex, "hex"))
  const dec = Buffer.concat([decipher.update(Buffer.from(cipherHex, "hex")), decipher.final()])
  return dec.toString("utf8")
}

export function hashToken(plain: string): string {
  return createHash("sha256").update(plain).digest("hex")
}

export function maskToken(plain: string): string {
  if (plain.length < 12) return "***"
  return `${plain.slice(0, 6)}...${plain.slice(-4)}`
}
