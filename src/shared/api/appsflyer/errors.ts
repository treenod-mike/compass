/**
 * AppsFlyer 파이프라인 에러 계층.
 * 호출자(CLI / API route)가 종류별로 분기 처리할 수 있도록 구체 클래스로 분리.
 */

export class AppsFlyerError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = "AppsFlyerError"
    this.code = code
  }
}

export class AuthError extends AppsFlyerError {
  constructor(message = "AppsFlyer authentication failed") {
    super("invalid_token", message)
    this.name = "AuthError"
  }
}

export class RateLimitError extends AppsFlyerError {
  readonly retryAfterSec: number
  constructor(retryAfterSec: number, message = "AppsFlyer rate limit exceeded") {
    super("rate_limited", message)
    this.name = "RateLimitError"
    this.retryAfterSec = retryAfterSec
  }
}

export class TimeoutError extends AppsFlyerError {
  constructor(message = "AppsFlyer request timed out") {
    super("timeout", message)
    this.name = "TimeoutError"
  }
}

export class ValidationError extends AppsFlyerError {
  readonly path: string
  constructor(path: string, message: string) {
    super("schema_mismatch", message)
    this.name = "ValidationError"
    this.path = path
  }
}

export class NetworkError extends AppsFlyerError {
  constructor(message = "AppsFlyer network error") {
    super("network", message)
    this.name = "NetworkError"
  }
}
