import { test } from "node:test"
import assert from "node:assert/strict"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { afHttp } from "../client"
import { TimeoutError, RateLimitError, AuthError } from "../errors"

function startServer(handler: (req: import("http").IncomingMessage, res: import("http").ServerResponse) => void) {
  const server = createServer(handler)
  return new Promise<{ url: string; close: () => Promise<void> }>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
      })
    })
  })
}

test("afHttp: throws TimeoutError when server never responds", async () => {
  const { url, close } = await startServer(() => {
    /* never respond */
  })
  try {
    await assert.rejects(
      () => afHttp({ url, method: "GET", token: "t", timeoutMs: 100, maxRetries: 0 }),
      (err: unknown) => err instanceof TimeoutError,
    )
  } finally {
    await close()
  }
})

test("afHttp: throws AuthError on 401 without retry", async () => {
  let calls = 0
  const { url, close } = await startServer((_req, res) => {
    calls++
    res.statusCode = 401
    res.end()
  })
  try {
    await assert.rejects(
      () => afHttp({ url, method: "GET", token: "t", maxRetries: 3 }),
      (err: unknown) => err instanceof AuthError,
    )
    assert.equal(calls, 1, "401 should not be retried")
  } finally {
    await close()
  }
})

test("afHttp: retries on 429 and succeeds", async () => {
  let calls = 0
  const { url, close } = await startServer((_req, res) => {
    calls++
    if (calls < 3) {
      res.statusCode = 429
      res.setHeader("retry-after", "0")
      res.end()
      return
    }
    res.statusCode = 200
    res.setHeader("content-type", "application/json")
    res.end(JSON.stringify({ ok: true }))
  })
  try {
    const result = await afHttp({ url, method: "GET", token: "t", maxRetries: 3 })
    assert.deepEqual(result, { ok: true })
    assert.equal(calls, 3)
  } finally {
    await close()
  }
})
