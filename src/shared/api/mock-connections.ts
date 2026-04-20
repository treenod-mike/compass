/**
 * Mock Connections — 외부 시스템 연동 상태 (MVP)
 *
 * 실제 OAuth / API integration은 미구현. CSV 업로드가 1차 MVP 경로.
 */

export type ConnectionStatus = "connected" | "warn" | "error" | "disconnected"

export type ConnectionCategory =
  | "attribution"
  | "finance"
  | "analytics"
  | "database"
  | "notification"

export type ConnectionMetric = { label: string; value: string }

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
  csvSchema?: ConnectionCsvColumn[]
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
  // ── 어트리뷰션 ──────────────────────────
  {
    id: "appsflyer",
    brand: "AppsFlyer",
    initials: "AF",
    brandColor: "#00b2e5",
    category: "attribution",
    description: "MMP · 어트리뷰션 데이터 (설치·인스톨 소스·캠페인 성과)",
    status: "connected",
    lastSync: "12분 전",
    metrics: [
      { label: "이벤트", value: "1.2M" },
      { label: "앱", value: "3" },
    ],
    csvSchema: [
      { name: "install_time", type: "date", required: true, example: "2026-04-20 09:12:33" },
      { name: "media_source", type: "string", required: true, example: "facebook_ads" },
      { name: "campaign", type: "string", required: false, example: "KR_iOS_Prospecting" },
      { name: "publisher", type: "string", required: false, example: "Meta" },
      { name: "cost_usd", type: "currency", required: false, example: "1.85" },
      { name: "revenue_usd", type: "currency", required: false, example: "3.20" },
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
  },
  {
    id: "singular",
    brand: "Singular",
    initials: "SG",
    brandColor: "#f5317f",
    category: "attribution",
    description: "크로스채널 마케팅 통합 분석",
    status: "disconnected",
  },

  // ── 재무 / 회계 ──────────────────────────
  {
    id: "accounting-csv",
    brand: "재무 (CSV)",
    initials: "₩",
    brandColor: "#02a262",
    category: "finance",
    description: "월별 P&L · 매출/비용/순이익 CSV 업로드",
    status: "warn",
    lastSync: "3일 전",
    metrics: [
      { label: "계정", value: "12" },
      { label: "기간", value: "24개월" },
    ],
    csvSchema: [
      { name: "month", type: "date", required: true, example: "2026-04" },
      { name: "account_code", type: "string", required: true, example: "4100" },
      { name: "account_name", type: "string", required: true, example: "매출" },
      { name: "amount_krw", type: "currency", required: true, example: "120000000" },
      { name: "type", type: "string", required: true, example: "revenue | expense" },
      { name: "memo", type: "string", required: false, example: "iOS 글로벌 매출" },
    ],
  },
  {
    id: "quickbooks",
    brand: "QuickBooks",
    initials: "QB",
    brandColor: "#2ca01c",
    category: "finance",
    description: "Intuit QuickBooks · 실시간 장부 sync (OAuth)",
    status: "disconnected",
  },
  {
    id: "xero",
    brand: "Xero",
    initials: "XR",
    brandColor: "#13b5ea",
    category: "finance",
    description: "Xero 회계 SaaS · 국제 법인용",
    status: "disconnected",
  },

  // ── 분석 ──────────────────────────
  {
    id: "ga4",
    brand: "Google Analytics 4",
    initials: "GA",
    brandColor: "#f9ab00",
    category: "analytics",
    description: "웹/앱 행동 분석 · 페이지뷰/이벤트",
    status: "error",
    lastSync: "6시간 전",
    metrics: [{ label: "Property", value: "2" }],
  },
  {
    id: "amplitude",
    brand: "Amplitude",
    initials: "AM",
    brandColor: "#1059e7",
    category: "analytics",
    description: "프로덕트 분석 · 코호트/리텐션",
    status: "disconnected",
  },

  // ── 데이터베이스 ──────────────────────────
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
  },

  // ── 알림 ──────────────────────────
  {
    id: "slack",
    brand: "Slack",
    initials: "SL",
    brandColor: "#4a154b",
    category: "notification",
    description: "이상 신호 · 주간 요약 자동 전송",
    status: "disconnected",
  },
]
