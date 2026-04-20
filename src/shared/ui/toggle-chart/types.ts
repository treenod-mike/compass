import React from 'react'

// ========================================
// 차트 데이터 타입
// ========================================

/**
 * 차트 데이터 아이템 타입
 */
export interface ChartDataItem {
  [key: string]: string | number | null | undefined
}

// ========================================
// 내부 컴포넌트 타입
// ========================================

/**
 * Recharts 범례 페이로드 아이템 타입
 */
export interface LegendPayloadItem {
  value?: string
  color?: string
  dataKey?: string
  type?: string
  payload?: Record<string, unknown>
}

/**
 * Custom Legend 컴포넌트 Props
 */
export interface CustomLegendProps {
  payload?: any
  chartType?: 'line' | 'bar'
  legendOrder?: string[] // 범례 표시 순서
  customLabels?: Record<string, string> // 데이터 키를 표시용 레이블로 매핑
  legendLayout?: 'wrap' | 'scroll-x' // 레이아웃 모드
}

/**
 * Custom Legend with Line Indicator Tooltips
 * Following shadcn Tooltip - Line Indicator style
 *
 * @param payload - Recharts에서 제공하는 범례 데이터
 * @param chartType - 차트 타입 ('line' | 'bar')
 * @param legendOrder - 범례 표시 순서 (제공되면 이 순서대로 정렬)
 * @param onHover - 범례 항목에 마우스 호버 시 호출되는 콜백
 */
export interface CustomLegendPropsExtended extends CustomLegendProps {
  onHover?: (dataKey: string | null, index: number) => void
}

// ========================================
// 외부 설정 타입
// ========================================

export interface CustomToggle {
  label: string
  value: string
  multiSelect?: boolean // 다중 선택 가능 여부
}

export interface SelectConfig {
  label: string
  options: string[]
  defaultValue: string
  value?: string[] // 제어 컴포넌트를 위한 현재 선택값
  onSelect: (value: string) => void
  isMultiSelect?: boolean
  onMultiSelect?: (values: string[]) => void
}

// ========================================
// 메인 컴포넌트 Props
// ========================================

export interface ToggleChartProps {
  title: string
  tooltip?: string
  titleSuffix?: React.ReactNode // 제목 우측에 표시할 추가 콘텐츠
  titleAdornment?: React.ReactNode // 제목 바로 옆(인라인)에 표시할 콘텐츠
  data: ChartDataItem[]
  height?: number
  dataKey?: string
  dataKey2?: string
  nameKey?: string
  isPuChart?: boolean
  chartType?: 'line' | 'bar' | 'area' | 'pie' | 'composed' // 영역 차트 타입 추가
  selectConfig?: SelectConfig
  customToggles?: CustomToggle[]
  onToggleChange?: (value: string | string[]) => void // 커스텀 토글 변경 콜백 (단일/다중)
  isLoading?: boolean
  valueFormatter?: (value: string | number) => string
  isStackedBar?: boolean
  stackKeys?: string[]
  legendOrder?: string[] // 범례 표시 순서 (차트 렌더링 순서와 다를 수 있음)
  enableFullWidth?: boolean
  isFullWidth?: boolean // 초기 너비 상태 (전체 너비 여부)
  enableDualAxis?: boolean // 보조축 사용 여부
  dualAxisDataKey?: string // 보조축에 표시할 데이터 키
  onFullWidthChange?: (isFullWidth: boolean) => void // 부모에게 상태 알림
  hideXAxis?: boolean // X축 숨김 여부
  hideYAxis?: boolean // Y축 숨김 여부
  yAxisTickFormatter?: (value: number) => string // Y축 틱 포맷터
  xAxisInterval?: number | 'preserveStart' | 'preserveEnd' | 'preserveStartEnd' // X축 레이블 간격 (기본: 'preserveStartEnd')
  disableLegendInteraction?: boolean // 범례 클릭 비활성화 여부 (기간 비교 시 사용)
  hideSegmentFilter?: boolean // 세그먼트 필터 드롭다운 숨김 여부 (기간 비교 시 사용)
  hideChartTypeSelector?: boolean // 차트 타입 선택 드롭다운 숨김 여부
  // 혼합 차트 설정
  composedConfig?: {
    bars?: Array<{ dataKey: string; name: string; fill?: string; yAxisId?: 'left' | 'right' }>
    lines?: Array<{ dataKey: string; name: string; stroke?: string; yAxisId?: 'left' | 'right' }>
  }
  leftMargin?: number // 차트 좌측 마진 커스터마이징
  rightMargin?: number // 차트 우측 마진 커스터마이징
  customColorFunction?: (key: string, index: number, totalKeys: number) => string // 커스텀 색상 함수
  customFilter?: React.ReactNode // 커스텀 필터 영역 (차트 헤더에 표시)
  customTooltip?: (props: { active?: boolean; payload?: any[]; label?: string | number; hoveredDataKey?: string }) => React.ReactNode // 커스텀 툴팁
  customLabels?: Record<string, string> // 데이터 키를 표시용 레이블로 매핑 (범례/툴팁에 사용)
  fixedLeftYMax?: number // 좌측 Y축 최댓값 고정 (지정 시 자동 계산 무시)
  referenceLines?: Array<{ value: number; label?: string; color?: string }> // 수평 기준선
  xReferenceLines?: Array<{ value: string | number; label?: string; color?: string }> // 수직 기준선 (x축)
  mini?: boolean // Card/Header 없이 차트만 렌더링 (AI 위젯 썸네일 등)
  barCellColors?: string[] // 단일 키 바 차트에서 각 바의 색상 (인덱스 순서)
  segmentFilterLabel?: string // 세그먼트 필터 드롭다운 기본 레이블 (기본값: '세그먼트')
  legendLayout?: 'wrap' | 'scroll-x' // 범례 레이아웃: 'wrap' 다중 행 래핑(기본), 'scroll-x' 단일 행 가로 스크롤
  animateLines?: boolean // 라인 차트 그려지는 애니메이션 활성화 (기본 false)
}
