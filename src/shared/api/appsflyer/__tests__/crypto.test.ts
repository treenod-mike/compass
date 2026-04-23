import { describe, it, expect, beforeEach } from "vitest"
import { encryptToken, decryptToken, hashToken, maskToken } from "../crypto"

const TEST_KEY = "0".repeat(64)  // 32-byte hex

describe("crypto", () => {
  beforeEach(() => {
    process.env.APPSFLYER_MASTER_KEY = TEST_KEY
  })

  it("encrypt + decrypt roundtrip", () => {
    const plain = "eyJhbGciOiJBMjU2S1ciLCJjdHkiOiJKV1QifQ.signature"
    const ct = encryptToken(plain)
    expect(ct).toContain(":")  // iv:cipher:tag
    expect(decryptToken(ct)).toBe(plain)
  })

  it("decrypt rejects tampered ciphertext", () => {
    const ct = encryptToken("secret")
    const [iv, cipher, tag] = ct.split(":")
    const tampered = `${iv}:${cipher.slice(0, -2)}ff:${tag}`
    expect(() => decryptToken(tampered)).toThrow()
  })

  it("decrypt rejects wrong key", () => {
    const ct = encryptToken("secret")
    process.env.APPSFLYER_MASTER_KEY = "f".repeat(64)
    expect(() => decryptToken(ct)).toThrow()
  })

  it("hashToken produces SHA-256 hex (deterministic 64-char)", () => {
    const h1 = hashToken("abc")
    const h2 = hashToken("abc")
    expect(h1).toHaveLength(64)
    expect(h1).toBe(h2)
    expect(/^[0-9a-f]{64}$/.test(h1)).toBe(true)
  })

  it("maskToken shows first 6 + ... + last 4", () => {
    expect(maskToken("eyJhbGciOiabcdef.signature_xyz123end")).toBe("eyJhbG...3end")
    expect(maskToken("short")).toBe("***")  // too short to mask meaningfully
  })

  it("throws when APPSFLYER_MASTER_KEY missing", () => {
    delete process.env.APPSFLYER_MASTER_KEY
    expect(() => encryptToken("x")).toThrow(/APPSFLYER_MASTER_KEY/)
  })

  it("rejects non-hex key with 64 length (would silently truncate via Buffer.from)", () => {
    process.env.APPSFLYER_MASTER_KEY = "z".repeat(64)
    expect(() => encryptToken("x")).toThrow(/APPSFLYER_MASTER_KEY/)
  })

  it("decrypt rejects empty tag segment (would skip GCM authentication)", () => {
    const ct = encryptToken("secret")
    const [iv, cipher] = ct.split(":")
    expect(() => decryptToken(`${iv}:${cipher}:`)).toThrow(/decryption failed/)
  })

  it("decrypt rejects malformed iv length", () => {
    expect(() => decryptToken("ab:00:00")).toThrow(/decryption failed/)
  })
})
