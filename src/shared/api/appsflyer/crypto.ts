import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

const HEX_KEY = /^[0-9a-fA-F]{64}$/

function getKey(): Buffer {
  const hex = process.env.APPSFLYER_MASTER_KEY
  if (!hex) throw new Error("APPSFLYER_MASTER_KEY env var missing")
  if (!HEX_KEY.test(hex)) {
    throw new Error("APPSFLYER_MASTER_KEY must be 64 hex characters (32 bytes)")
  }
  return Buffer.from(hex, "hex")
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${enc.toString("hex")}:${tag.toString("hex")}`
}

const HEX_RE = /^[0-9a-fA-F]*$/

export function decryptToken(packed: string): string {
  const parts = packed.split(":")
  if (parts.length !== 3) throw new Error("decryption failed")
  const [ivHex, cipherHex, tagHex] = parts
  // Defensive: Buffer.from(_, "hex") silently truncates non-hex/odd-length input,
  // and a zero-length tag would skip GCM authentication. Reject up front.
  if (ivHex.length !== 24 || !HEX_RE.test(ivHex)) throw new Error("decryption failed")  // 12 bytes = 24 hex
  if (tagHex.length !== 32 || !HEX_RE.test(tagHex)) throw new Error("decryption failed")  // 16 bytes = 32 hex
  if (!HEX_RE.test(cipherHex)) throw new Error("decryption failed")
  try {
    const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"))
    decipher.setAuthTag(Buffer.from(tagHex, "hex"))
    const dec = Buffer.concat([decipher.update(Buffer.from(cipherHex, "hex")), decipher.final()])
    return dec.toString("utf8")
  } catch {
    // Normalize Node's GCM auth error so callers cannot distinguish
    // structural format failures from authentication failures.
    throw new Error("decryption failed")
  }
}

export function hashToken(plain: string): string {
  return createHash("sha256").update(plain).digest("hex")
}

export function maskToken(plain: string): string {
  if (plain.length < 12) return "***"
  return `${plain.slice(0, 6)}...${plain.slice(-4)}`
}
