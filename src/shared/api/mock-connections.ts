/**
 * Mock Connections — 외부 시스템 연동 상태 (MVP)
 *
 *  · AppsFlyer / GA4 등 SaaS 데이터는 **API 연동** (자동)
 *  · 재무·회계 데이터는 **파일 업로드** (CSV 또는 Google Drive)
 */

export type ConnectionStatus = "connected" | "warn" | "error" | "disconnected"

export type ConnectionCategory =
  | "attribution"
  | "finance"
  | "analytics"
  | "database"
  | "notification"

export type ConnectionMetric = { label: string; value: string }

export type ConnectionMethod = "api" | "file"

/** API 연동 방식의 필수/선택 필드 정의 */
export type ApiField = {
  name: string
  label: string
  type: "password" | "text" | "select"
  required: boolean
  placeholder?: string
  hint?: string
  options?: { label: string; value: string }[]
  defaultValue?: string
}

/** 파일 업로드의 스키마 */
export type ConnectionCsvColumn = {
  name: string
  type: "date" | "string" | "number" | "currency"
  required: boolean
  example?: string
}

export type Connection = {
  id: string
  brand: string
  initials: string
  brandColor: string
  category: ConnectionCategory
  description: string
  status: ConnectionStatus
  lastSync?: string
  metrics?: ConnectionMetric[]
  primaryMethod: ConnectionMethod

  /** API 연동용 필드 (primaryMethod === "api") */
  apiFields?: ApiField[]
  /** 예상 sync 주기 문구 */
  syncCadence?: string

  /** 파일 업로드 스키마 (primaryMethod === "file") */
  csvSchema?: ConnectionCsvColumn[]
  /** Google Drive 연결 지원 여부 (file 타입에만) */
  supportsGoogleDrive?: boolean
}

export const CATEGORY_LABEL: Record<ConnectionCategory, string> = {
  attribution: "어트리뷰션",
  finance: "재무 / 회계",
  analytics: "분석",
  database: "데이터베이스",
  notification: "알림",
}

export const CATEGORY_ORDER: ConnectionCategory[] = [
  "attribution",
  "finance",
  "analytics",
  "database",
  "notification",
]

export const mockConnections: Connection[] = [
  // ── 어트리뷰션 (API) ──────────────────────────
  {
    id: "appsflyer",
    brand: "AppsFlyer",
    initials: "AF",
    brandColor: "#00b2e5",
    category: "attribution",
    description: "MMP · 어트리뷰션 데이터 (설치·인스톨 소스·캠페인 성과) 자동 sync",
    status: "connected",
    lastSync: "12분 전",
    metrics: [
      { label: "이벤트", value: "1.2M" },
      { label: "앱", value: "3" },
    ],
    primaryMethod: "api",
    syncCadence: "1시간마다 자동 sync",
    apiFields: [
      {
        name: "dev_token",
        label: "AppsFlyer Dev Token",
        type: "password",
        required: true,
        placeholder: "xxxxxxxx.xxxx.xxxx.xxxx.xxxxxxxxxxxx",
        hint: "AppsFlyer 대시보드 > User Access > Admin Tokens 에서 발급",
      },
      {
        name: "home_currency",
        label: "Home Currency",
        type: "select",
        required: true,
        defaultValue: "KRW",
        options: [
          { label: "KRW (대한민국 원)", value: "KRW" },
          { label: "USD (US Dollar)", value: "USD" },
          { label: "JPY (Japanese Yen)", value: "JPY" },
          { label: "EUR (Euro)", value: "EUR" },
        ],
      },
      {
        name: "sync_frequency",
        label: "Sync 주기",
        type: "select",
        required: true,
        defaultValue: "1h",
        options: [
          { label: "실시간 (웹훅 수신)", value: "realtime" },
          { label: "1시간마다", value: "1h" },
          { label: "하루 1번 (00:00 KST)", value: "daily" },
        ],
      },
      {
        name: "app_ids",
        label: "대상 App IDs",
        type: "text",
        required: false,
        placeholder: "id1234567890, com.compass.poco",
        hint: "공백 — 전체 앱 자동 탐색",
      },
    ],
  },
  {
    id: "adjust",
    brand: "Adjust",
    initials: "AJ",
    brandColor: "#1dc3fe",
    category: "attribution",
    description: "대안 MMP · 경쟁사 벤치마크 용도",
    status: "disconnected",
    primaryMethod: "api",
  },
  {
    id: "singular",
    brand: "Singular",
    initials: "SG",
    brandColor: "#f5317f",
    category: "attribution",
    description: "크로스채널 마케팅 통합 분석",
    status: "disconnected",
    primaryMethod: "api",
  },

  // ── 재무 / 회계 (파일 업로드 · CSV / Google Drive) ──────────────────────────
  {
    id: "accounting-csv",
    brand: "재무 / 회계 데이터",
    initials: "₩",
    brandColor: "#02a262",
    category: "finance",
    description: "월별 P&L · 매출/비용/순이익. CSV 직접 업로드 또는 Google Drive 폴더 연결",
    status: "warn",
    lastSync: "3일 전",
    metrics: [
      { label: "계정", value: "12" },
      { label: "기간", value: "24개월" },
    ],
    primaryMethod: "file",
    supportsGoogleDrive: true,
    csvSchema: [
      { name: "month", type: "date", required: true, example: "2026-04" },
      { name: "account_code", type: "string", required: true, example: "4100" },
      { name: "account_name", type: "string", required: true, example: "매출" },
      { name: "amount_krw", type: "currency", required: true, example: "120000000" },
      { name: "type", type: "string", required: true, example: "revenue | expense" },
      { name: "memo", type: "string", required: false, example: "iOS 글로벌 매출" },
    ],
  },

  // ── 분석 (사내 게임보드) ──────────────────────────
  {
    id: "gameboard",
    brand: "게임보드",
    initials: "GB",
    brandColor: "#1A7FE8",
    category: "analytics",
    description: "사내 인게임 이벤트 · 플레이 행태 원천 (연동 범위 기획 중)",
    status: "disconnected",
    primaryMethod: "api",
  },

  // ── 데이터베이스 (API) ──────────────────────────
  {
    id: "supabase",
    brand: "Supabase",
    initials: "SB",
    brandColor: "#3ecf8e",
    category: "database",
    description: "PostgreSQL · 원본 데이터 레이크",
    status: "connected",
    lastSync: "실시간",
    metrics: [
      { label: "테이블", value: "47" },
      { label: "rows", value: "14.2M" },
    ],
    primaryMethod: "api",
  },

  // ── 알림 (API) ──────────────────────────
  {
    id: "slack",
    brand: "Slack",
    initials: "SL",
    brandColor: "#4a154b",
    category: "notification",
    description: "이상 신호 · 주간 요약 자동 전송",
    status: "disconnected",
    primaryMethod: "api",
  },
]
