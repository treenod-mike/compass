/**
 * z-index 시멘틱 토큰 — 단일 진실의 원천 (SSoT)
 *
 * ## 마이그레이션 매핑 표
 *
 * | 기존 값                     | 위치/컴포넌트                                | → 시멘틱 상수               | Tailwind 클래스      |
 * |-----------------------------|----------------------------------------------|-----------------------------|----------------------|
 * | z-[1] / z-[3] / z-[5]      | 탭 active indicator, minor raised content    | Z_INDEX.CONTENT_RAISED      | z-content-raised     |
 * | z-10                        | 차트 바 (bar chart, gantt bar)               | Z_INDEX.CHART_BAR           | z-chart-bar          |
 * | z-20                        | 선택된/hover 차트 바                         | Z_INDEX.CHART_BAR_ACTIVE    | z-chart-bar-active   |
 * | z-30                        | sticky 컬럼·행 헤더                          | Z_INDEX.STICKY_HEADER       | z-sticky-header      |
 * | z-[40] / zIndex:40          | 차트 축, crosshair (Recharts inline style)   | Z_INDEX.CHART_AXIS          | CSS var (인라인 전용)|
 * | z-50                        | chart overlay (out-of-range mask)            | Z_INDEX.CHART_OVERLAY       | z-chart-overlay      |
 * | z-[60] / z-60               | AppTopBar / 최상단 네비게이션 바             | Z_INDEX.APP_TOP_BAR         | z-app-top-bar        |
 * | z-[70] / z-70               | 사이드바                                     | Z_INDEX.SIDEBAR             | z-sidebar            |
 * | z-[80]                      | sticky 페이지 헤더 (PageHeader)              | Z_INDEX.PAGE_HEADER         | z-page-header        |
 * | z-[200]                     | mega menu / 좌측 필터 패널                   | Z_INDEX.MEGA_MENU           | z-mega-menu          |
 * | z-50  (radix select/dropdown/popover content) | dropdown 메뉴 콘텐츠        | Z_INDEX.DROPDOWN            | z-dropdown           |
 * | z-50  (dialog/sheet overlay+content)| 모달 backdrop                          | Z_INDEX.OVERLAY_BACKDROP    | z-overlay-backdrop   |
 * | z-50  (dialog/sheet content)| 다이얼로그·시트 콘텐츠                      | Z_INDEX.MODAL               | z-modal              |
 * | z-50  (popover content — 모달 위) | popover                                | Z_INDEX.POPOVER             | z-popover            |
 * | z-[9999] (radix portal tooltip) | 툴팁                                     | Z_INDEX.TOOLTIP             | z-tooltip            |
 * | z-[9999] (dev-role-switcher)| 개발자 역할 전환기 — 유일하게 9999 유지     | Z_INDEX.DEV_OVERLAY         | z-dev-overlay        |
 *
 * ## Stacking context 트랩 주의
 * 다음 CSS 속성은 새로운 stacking context 를 만들어 자식 z-index 를 가둔다:
 *   - transform (translate, scale, rotate 포함)
 *   - will-change: transform | opacity | filter
 *   - opacity < 1
 *   - filter (blur 등)
 *   - isolation: isolate
 *   - position: fixed / sticky (일부 조건)
 * → Recharts SVG, Framer Motion 애니메이션 래퍼가 이에 해당. 해당 요소 내부에서
 *   z-index 를 올려도 외부 레이어를 넘을 수 없다. 외부 레이어가 필요하면
 *   Radix Portal 등을 통해 DOM 최상단에 렌더링.
 */
export const Z_INDEX = {
  BASE: 0,               // 기본 컨텐츠
  CONTENT_RAISED: 1,     // 살짝 떠 있는 컨텐츠 (탭 active indicator 등)
  CHART_BAR: 10,         // 차트 바, gantt 이벤트 바
  CHART_BAR_ACTIVE: 20,  // 선택된/hover 차트 바
  STICKY_HEADER: 30,     // sticky 컬럼·행 헤더
  CHART_AXIS: 40,        // 차트 축, crosshair (Recharts inline style 에 사용)
  CHART_OVERLAY: 50,     // 차트 오버레이 (out-of-range mask)
  APP_TOP_BAR: 60,       // 앱 최상단 네비게이션 바
  SIDEBAR: 70,           // 사이드바 (사이드 메뉴)
  PAGE_HEADER: 80,       // sticky 페이지 헤더 (PageHeader)
  MEGA_MENU: 90,         // mega menu / 좌측 필터 패널
  DROPDOWN: 100,         // dropdown·select·popover 콘텐츠 (Radix Portal)
  OVERLAY_BACKDROP: 200, // 모달 backdrop
  MODAL: 210,            // 다이얼로그·시트 콘텐츠
  POPOVER: 220,          // popover (모달 위에서도 사용)
  TOOLTIP: 300,          // 툴팁 (거의 최상단)
  NOTIFICATION: 400,     // 토스트·알림 (new token — no legacy mapping)
  DEV_OVERLAY: 9999,     // 개발자 도구 — 유일하게 9999 허용
} as const

export type ZIndexKey = keyof typeof Z_INDEX
export type ZIndexValue = (typeof Z_INDEX)[ZIndexKey]
