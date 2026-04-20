/**
 * 게임보드 브랜드 컬러 시스템
 * 프로젝트 전체에서 사용되는 색상 상수
 */

// 브랜드 메인 컬러
export const BRAND_COLORS = {
  PRIMARY: '#083687',        // Katarina Blue - 게임보드 브랜드 블루
  PRIMARY_HOVER: '#062757',  // 호버 상태 (더 어두운 블루)
  PRIMARY_TEXT: 'white',     // 프라이머리 배경 위 텍스트
} as const

// 레벨 모니터링 아이템 컬러 (TDS 200 팔레트 기반 — 카테고리별 그라데이션 시작점)
// getItemColor()가 인덱스에 따라 화이트 블렌딩으로 100 톤까지 확장
export const LEVEL_ITEM_COLORS = {
  READY_ITEM: '#90c2ff',   // TDS blue-200 (레디 아이템) - CHART_SERIES_COLORS[9]
  INGAME_ITEM: '#76e4b8',  // TDS green-200 (인게임 아이템) - CHART_SERIES_COLORS[8]
  CONTINUE: '#ffcd80',     // TDS orange-200 (컨티뉴) - CHART_SERIES_COLORS[11]
} as const

// 차트 시리즈 컬러 팔레트 (최대 20개 시리즈 지원)
// 0번은 브랜드 프라이머리, 나머지는 TDS 팔레트 100~300 레벨 (라이트/파스텔 톤)
// 다크 모드 대응이 필요한 경우 CSS var(--chart-N) 참조 방식으로 전환 필요
export const CHART_SERIES_COLORS = [
  'var(--primary)', // 0. Brand Primary — 다크 모드 대응 (CSS variable)
  '#64a8ff', // 1. TDS blue-300
  '#58c7c7', // 2. TDS teal-300
  '#ffbd51', // 3. TDS orange-300
  '#c770e4', // 4. TDS purple-300
  '#fb8890', // 5. TDS red-300
  '#ffdd78', // 6. TDS yellow-300
  '#d1d6db', // 7. TDS grey-300
  '#76e4b8', // 8. TDS green-200
  '#90c2ff', // 9. TDS blue-200
  '#89d8d8', // 10. TDS teal-200
  '#ffcd80', // 11. TDS orange-200
  '#da9bef', // 12. TDS purple-200
  '#feafb4', // 13. TDS red-200
  '#ffe69b', // 14. TDS yellow-200
  '#e5e8eb', // 15. TDS grey-200
  '#aeefd5', // 16. TDS green-100
  '#c9e2ff', // 17. TDS blue-100
  '#ffe0b0', // 18. TDS orange-100
  '#bce9e9', // 19. TDS teal-100
] as const

// 시리즈 컬러 이름 맵 (디버깅/문서용)
export const CHART_SERIES_NAMES = {
  BASE:      'Brand Primary',
  SERIES_1:  'TDS Blue 300',
  SERIES_2:  'TDS Teal 300',
  SERIES_3:  'TDS Orange 300',
  SERIES_4:  'TDS Purple 300',
  SERIES_5:  'TDS Red 300',
  SERIES_6:  'TDS Yellow 300',
  SERIES_7:  'TDS Grey 300',
  SERIES_8:  'TDS Green 200',
  SERIES_9:  'TDS Blue 200',
  SERIES_10: 'TDS Teal 200',
  SERIES_11: 'TDS Orange 200',
  SERIES_12: 'TDS Purple 200',
  SERIES_13: 'TDS Red 200',
  SERIES_14: 'TDS Yellow 200',
  SERIES_15: 'TDS Grey 200',
  SERIES_16: 'TDS Green 100',
  SERIES_17: 'TDS Blue 100',
  SERIES_18: 'TDS Orange 100',
  SERIES_19: 'TDS Teal 100',
} as const

// 기타 UI 컬러 — TDS semantic 토큰 hex 값 (globals.css 기준)
export const UI_COLORS = {
  SUCCESS: '#02a262',  // TDS green-600 (= --success)
  ERROR:   '#d22030',  // TDS red-700   (= --destructive)
  WARNING: '#fb8800',  // TDS orange-600 (= --warning)
  INFO:    '#2272eb',  // TDS blue-600  (= --chart-2)
  NEUTRAL: '#6b7684',  // TDS grey-600  (= --muted-foreground)
} as const

// 전체 컬러 시스템 (편의성을 위한 통합 export)
export const COLORS = {
  ...BRAND_COLORS,
  LEVEL_ITEM: LEVEL_ITEM_COLORS,
  UI: UI_COLORS,
  CHART_SERIES: CHART_SERIES_COLORS,
} as const
