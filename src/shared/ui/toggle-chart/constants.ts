import { CHART_SERIES_COLORS } from '@/shared/constants/colors'

// ========================================
// 차트 설정 상수
// ========================================

// 차트 시리즈 색상 시스템 (colors.ts 기반 - 20색)
export const COLORS = CHART_SERIES_COLORS

// 차트 마진 설정
export const CHART_MARGINS = {
  TOP: 15,
  LEFT_BASE: 12,       // Y축 왼쪽 기본 여백 (YAxis.width와 별도 추가 공간)
  LEFT_PER_DIGIT: 0,   // 숫자 자릿수당 추가 여백 (YAxis.width가 라벨 공간 담당)
  RIGHT_DUAL: 0,       // 보조축 사용 시 오른쪽 여백
  RIGHT_SINGLE: 4,     // 단일축 사용 시 오른쪽 여백
  BOTTOM_WITH_LEGEND: 15, // 범례 포함 아래 여백
  BOTTOM_WITHOUT_LEGEND: 5,
} as const

// 범례 설정
export const LEGEND_CONFIG = {
  HEIGHT: 15,
  PADDING_TOP_NORMAL: 2,
  MARGIN_TOP: 12,
} as const

// X축 설정
export const XAXIS_CONFIG = {
  HEIGHT: 30,
  FONT_SIZE: 15,
  ANGLE: 0,
  TEXT_ANCHOR: 'middle',
} as const

// Y축 설정
export const YAXIS_CONFIG = {
  WIDTH_BASE: 20,      // Y축 기본 너비 (100% 표시 완전 보이도록 충분한 공간)
  WIDTH_PER_DIGIT: 5,  // 자릿수당 추가 너비 (16px 폰트 기준)
  FONT_SIZE: 16,
} as const

// 듀얼축 임계값
export const DUAL_AXIS_THRESHOLD = 10 as const
