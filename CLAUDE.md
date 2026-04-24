# Project Compass — Company Portfolio Version

## About This Project

이 프로젝트는 Compass 원본의 **간소화 복사본**입니다.

- **목적**: 회사 포트폴리오 / 기술 데모용
- **원본**: `/Users/mike/Downloads/Compass/compass/` (사업계획, 랜딩, 인증 등 포함)
- **이 버전에서 제거된 것**: Landing 페이지, Auth/Login, Actions 페이지, Experiments 페이지, Capital 페이지, Copilot Command Bar, 사업 관련 문서 전체
- **보존된 것**: 차트 위젯 24개 전부, Overview 대시보드, Market Gap 페이지, 디자인 시스템, 전체 UI 컴포넌트
- **별도 git repo로 관리 예정** — 원본과 독립적으로 운영

---

## 1. 프로젝트 정의

모바일 게임 산업을 위한 실험→투자 의사결정 OS (Experiment-to-Investment Decision OS).

A/B 테스트, 라이브 운영, 시장 시그널을 자본 배분 결정으로 번역하는 AI 기반 의사결정 플랫폼. 시장 데이터(Silo 1), 어트리뷰션(Silo 2), 실험(Silo 3), 재무(Silo 4) 4개 데이터 사일로를 하나의 투자 판단 레이어로 통합.

---

## 2. Tech Stack

### Compass 대시보드 (`src/`)

| 영역 | 기술 |
|------|------|
| Framework | Next.js 15 (App Router) + TypeScript |
| Architecture | FSD 2.1 (Feature-Sliced Design) |
| State | Zustand (client) |
| Visualization | Recharts + visx (custom SVG charts) |
| UI | Tailwind CSS v4 + Radix UI + Framer Motion |
| Fonts | Geist Sans/Mono + Pretendard (KR) + Instrument Serif + Noto Serif KR |
| Icons | @iconify/react + Solar Bold set |
| Animation | Framer Motion (layout animations, page transitions) |
| i18n | Custom ko/en dictionary + LocaleProvider |
| Runtime Validation | Zod (prior-data.ts, 빌드 타임 snapshot 검증) |

### Sensor Tower 크롤러 (`crawler/`)

Compass와 **물리적으로 분리된** Node-only CLI 패키지. Playwright 바이너리가 Next.js 빌드에 들어가지 않도록 독립 `package.json` 유지.

| 영역 | 기술 |
|------|------|
| Runtime | Node.js 24 LTS + ESM (NodeNext) |
| Browser Automation | Playwright (headed Chromium, OAuth 세션 재사용) |
| Language | TypeScript + tsx (no build step) |
| Schema Validation | Zod (env + snapshot 양방향 검증) |
| CLI | Commander |
| Testing | Vitest (단위 테스트, transformer·schema·lib) |
| Session Storage | `storageState.json` (OAuth 쿠키, gitignore + chmod 600) |

### Vercel 배포 (Compass만)

- Root Directory: 프로젝트 루트 (`.`)
- Install Command: `npm install --legacy-peer-deps` (`@visx`의 React 18 peer dep 충돌 방지)
- Build Command: `next build`
- 모든 페이지 Static 빌드 → Hobby 플랜 가능
- `crawler/`는 배포 대상 아님 (로컬 CLI 전용)

---

## 3. Project Structure

```
src/
├── app/
│   ├── page.tsx                    # / → /dashboard 리다이렉트
│   ├── layout.tsx                  # Root layout (fonts, providers)
│   └── (dashboard)/
│       ├── layout.tsx              # Dashboard shell (StatusBar + Sidebar)
│       └── dashboard/
│           ├── page.tsx            # Executive Overview (Module 1)
│           └── market-gap/
│               └── page.tsx        # Market Gap Analysis (Module 2)
├── shared/
│   ├── api/                        # Mock data, types, hooks (use-game-data)
│   ├── config/
│   │   ├── chart-colors.ts         # 차트별 색상 config (PALETTE + per-chart)
│   │   └── chart-typography.ts     # 차트 폰트 config (CHART_TYPO)
│   ├── hooks/                      # useGridLayout, useMobile, useChartExpand
│   ├── i18n/                       # ko/en locale dictionary + context
│   ├── lib/                        # utils, market-signal 계산
│   ├── store/                      # Zustand (selected-game)
│   └── ui/                         # Base UI: Card, Button, Tooltip, Badge,
│                                   #   ChartHeader, ChartTooltip, ExpandButton,
│                                   #   MethodologyModal, PageTransition 등
├── styles/
│   └── globals.css                 # CSS custom properties (design tokens)
└── widgets/
    ├── app-shell/                  # RunwayStatusBar (top bar)
    ├── charts/                     # 24개 차트 컴포넌트 (아래 목록)
    ├── dashboard/                  # Verdict, KPI, Heatmap, Context widgets
    └── sidebar/                    # AppSidebar + PageHeader
```

---

## 4. Dashboard Pages

### Executive Overview (`/dashboard`)
포트폴리오 레벨 투자 판정. 게임 선택에 따라 Portfolio/Single-game 뷰 전환.

**구성 위젯:**
1. **PortfolioVerdict / HeroVerdict** — 투자 상태 (Invest/Hold/Reduce) + 신뢰도
2. **KPICards** — 6개(포트폴리오) 또는 4개(단일게임) 핵심 지표
3. **TitleHeatmap + MarketContextCard** — 타이틀별 건강도 + 시장 맥락 (3:2 split)
4. **CapitalWaterfall + RevenueVsInvest** — 자본 흐름 + 수익 대비 투자 (2-col)
5. **RevenueForecast + DataFreshnessStrip** — 매출 예측 (Bayesian P10/P50/P90) + 데이터 신선도 (3:1 split)

### Market Gap (`/dashboard/market-gap`)
Bayesian 사전/사후 확률 분석으로 시장 대비 포지셔닝 시각화.

**구성 위젯:**
1. **MarketHeroVerdict** — 시장 내 순위 + 경쟁 포지션 판정
2. **PriorPosteriorChart** — 장르 기대치 vs 우리 실적 (핵심 차별화 차트)
3. **MarketBenchmark + RankingTrend** — 리텐션 벤치마크 + 순위 추세 (2-col)
4. **SaturationTrendChart + Competitor Table** — 포화도 추세 + 경쟁사 테이블 (2-col)

---

## 5. Chart Components (24개)

모든 차트는 `src/widgets/charts/ui/`에 위치. `shared/config/chart-colors.ts`에서 색상, `chart-typography.ts`에서 폰트 참조.

| 차트 | 파일 | 용도 |
|------|------|------|
| RetentionCurve | retention-curve.tsx | 리텐션 곡선 (P10/P50/P90 밴드) |
| RevenueForecast | revenue-forecast.tsx | 매출 예측 (Bayesian 3-layer) |
| RevenueVsInvest | revenue-vs-invest.tsx | 수익 vs 투자 비교 |
| CapitalWaterfall | capital-waterfall.tsx | 자본 흐름 워터폴 |
| MarketBenchmark | market-benchmark.tsx | 장르별 리텐션 벤치마크 |
| PriorPosteriorChart | prior-posterior-chart.tsx | 사전/사후 확률 분포 |
| RankingTrend | ranking-trend.tsx | 매출 순위 추세 |
| SaturationTrendChart | saturation-trend.tsx | 시장 포화도 추세 |
| SaturationBar | saturation-bar.tsx | 포화도 바 차트 |
| CohortHeatmap | cohort-heatmap.tsx | 코호트 리텐션 히트맵 |
| BudgetDonut | budget-donut.tsx | 예산 배분 도넛 차트 |
| RunwayFanChart | runway-fan-chart.tsx | 런웨이 팬 차트 |
| ScenarioSimulator | scenario-simulator.tsx | 시나리오 시뮬레이터 |
| ExperimentBar | experiment-bar.tsx | 실험 ΔLTV 바 차트 |
| ExperimentRevenue | experiment-revenue.tsx | 실험별 매출 분해 |
| VariantImpactChart | variant-impact-chart.tsx | 변이별 LTV 영향도 |
| RolloutHistoryTimeline | rollout-history-timeline.tsx | 롤아웃 이력 타임라인 |
| RippleForecastFan | ripple-forecast-fan.tsx | 리플 예측 팬 차트 |
| ActionTimeline | action-timeline.tsx | 액션 타임라인 |
| ActionRoiQuadrant | action-roi-quadrant.tsx | 액션 ROI 사분면 |
| CausalImpactPanel | causal-impact-panel.tsx | 인과 영향 패널 |
| CumulativeImpactCurve | cumulative-impact-curve.tsx | 누적 영향 곡선 |
| RetentionShiftHeatmap | retention-shift-heatmap.tsx | 리텐션 시프트 히트맵 |
| CyclicUpdateTimeline | cyclic-update-timeline.tsx | 순환 업데이트 타임라인 |

---

## 6. Design System

### 디자인 언어
**Bloomberg Terminal × Linear × Toss Design Platform System (DPS)**

- Decision-first: 모든 화면은 데이터가 아닌 **판단**으로 시작
- Uncertainty-honest: 신뢰구간/밴드 표시, 거짓 정밀도 금지
- Enterprise angular: radius 2-6px (둥글지 않음)
- Monochrome base: 색상은 Signal(판단)에만 사용

### Color Tokens (globals.css)

**배경**: `--bg-0`(캔버스) → `--bg-1`(카드) → `--bg-2`(서브틀) → `--bg-3`(호버) → `--bg-4`(강한 보더)

**텍스트**: `--fg-0`(헤드라인) → `--fg-1`(본문) → `--fg-2`(보조) → `--fg-3`(비활성)

**Signal (판단 전용)**:
- `--signal-positive` (#00875A) — Invest / Ship / 안전
- `--signal-caution` (#B25E09) — Hold / Watch
- `--signal-risk` (#C9372C) — Reduce / Pull back
- `--signal-pending` (#6B7280) — 데이터 없음

**Brand**: `--brand` (#1A7FE8) — P50 라인, CTA, 포커스

**차트 팔레트**: 6-cohort categorical (colorblind-safe), P10/P50/P90 밴드 시스템

### Typography

| 용도 | 폰트 |
|------|------|
| UI / Body (Latin) | Geist Sans |
| UI / Body (Korean) | Pretendard (CDN) |
| 숫자 / 코드 / 차트 축 | Geist Mono (tabular-nums) |
| Decision 문장 (Latin) | Instrument Serif |
| Decision 문장 (Korean) | Noto Serif KR |

### Radius
- `--radius-inline`: 2px (badge, 인라인 요소)
- `--radius-card`: 4px (카드, 패널)
- `--radius-modal`: 6px (모달, 드롭다운)

---

## 7. 핵심 컨벤션

### Chart 개발 패턴
- 색상: `shared/config/chart-colors.ts`의 per-chart config 사용 (Recharts SVG는 CSS var 미지원 → hex 직접)
- 타이포: `shared/config/chart-typography.ts`의 `CHART_TYPO` 객체 사용
- 확장: `useChartExpand` 훅 + `ExpandButton` 컴포넌트
- 헤더: `ChartHeader` 컴포넌트 (제목 + 서브타이틀 통일)
- 툴팁: `ChartTooltip` 컴포넌트 (디자인 통일)
- 그리드 레이아웃: `useGridLayout` 훅 (expand/collapse 2-col ↔ full-width 전환)

### 레이아웃 구조
- `RunwayStatusBar` — sticky top 56px, 로고 + 4개 metric + 게임/기간 셀렉터
- `AppSidebar` — 오른쪽 192px, 네비게이션
- Main content — `px-10 pt-6 pb-24`, overflow-y-auto

### i18n
- `useLocale()` 훅으로 `t("key")` 번역
- `shared/i18n/dictionary.ts`에 ko/en 키-값 쌍
- 브랜드명 "project compass"는 번역하지 않음

### 상태 관리
- `useSelectedGame` (Zustand) — 전역 게임 선택 상태
- `useGameData` — 선택된 게임의 mock 데이터 반환
- 게임: Portfolio, Match League, Weaving Fairy, Dig Infinity

### Page Transitions
- `PageTransition` + `FadeInUp` 래퍼로 섹션별 stagger 애니메이션
- `motion.div layout` + `useGridLayout` 으로 차트 expand/collapse 애니메이션

---

## 8. 작업 시 주의사항

- **Tailwind v4**: important는 suffix `!` (예: `static!`). v3 prefix `!`는 무시됨
- **Recharts SVG**: CSS custom property 미지원 → `chart-colors.ts` hex 값 직접 사용
- **React 19 + @visx**: peer dependency 충돌 → `npm install --legacy-peer-deps` 필수
- **차트 24개 전부 보존**: 현재 페이지에서 사용하지 않는 차트도 포함 (향후 페이지 추가 시 활용)
- **Mock 데이터**: `shared/api/mock-data.ts`에 모든 타입 + 데이터 정의. 실 API 연동 전 단계

---

## 9. 외부 데이터 갱신 (Sensor Tower 크롤러)

Compass의 Bayesian Prior(장르 기대치) 데이터는 `crawler/` 패키지가 Sensor Tower 웹 대시보드에서 수집해 `src/shared/api/data/sensor-tower/merge-jp-snapshot.json`에 저장합니다.

### 운영
- 주 1회 수동 실행: `npm run crawl:st`
- 30일마다 재로그인: `npm run crawl:st:login`
- 1개 게임 디버그: `npm run crawl:st:dry`

### 코드 진입점
- 크롤러: `crawler/src/index.ts`
- Compass 측 import: `src/shared/api/prior-data.ts` (`priorByGenre`, `priorTopGames`, `isPriorStale()`)
- 설계 스펙: `docs/superpowers/specs/2026-04-20-sensortower-crawler-design.md`

### 안전
- 비밀번호 저장 안 함 — 항상 사람이 직접 로그인
- `crawler/storageState.json`, `crawler/.env`는 절대 커밋 금지 (`.gitignore`로 차단)
- 14일 경과 시 Compass UI에 stale 배지 자동 표시

### 트러블슈팅
`crawler/README.md` 참조.

---

## 10. 작업 컨벤션 (하네스)

### 10.1 사용자 프로필
- **Mike는 비개발자**. 제품 방향을 정의하나 기술 트레이드오프 판단은 어려움.
- **추천-OK 워크플로우**: A/B/C/D 메뉴형 질문보다 단일 추천안 + 근거 제시를 선호. 사용자 응답은 OK / 다르게 2가지로 수렴.

### 10.2 브랜치 / Worktree 규약
- **모든 코드 작업(feature/fix/refactor)은 `git worktree` 기본**. `git checkout -b`로 같은 디렉토리에서 브랜치 이동 금지.
- 시작 커맨드: `/compass-start <type> <name>` — worktree + 브랜치 + `npm install --legacy-peer-deps` 자동화.
- Worktree 경로: `../compass-worktrees/<type>-<name>/`
- 메타 파일(`docs/`, `CLAUDE.md`, `scripts/`, `README.md`) 수정은 main 워크트리에서 직접 해도 됨.

### 10.3 GitHub 계정 분리
- **회사 계정**: `treenod-mike` → `treenod-*` repo 전용
- **개인 계정**: `mugungwhwa` → 개인 repo 전용
- 계정 오염 시 즉시 `gh auth switch` 후 identity 재확인. `git config user.*` 설정을 절대 수정하지 말 것.

### 10.4 하네스 자동 작동 목록
세션마다 아래가 자동으로 돎 — Claude가 수동 호출할 필요 없음:

| 순간 | 작동 | 실패 시 |
|---|---|---|
| 세션 시작 | 현재 브랜치·PR·최신 스펙 3개 자동 요약 | — |
| `git commit` 시도 | tsc + npm test 자동 실행 | 커밋 차단, 오류 메시지 반환 |
| `gh pr create` 성공 | `@coderabbitai review` 코멘트 추가 + Vercel preview URL 조회 | 에러 메시지만 출력, 후속 작업 안 막음 |

### 10.5 하네스 범위 밖 (수동 실행)
- `/arch-check` — 큰 구조 변경(여러 레이어 수정, FSD 경계 재정의) 커밋 전 수동 실행
- `/oh-my-claudecode:ralph` — 복잡한 버그 추적이나 긴 리팩토링에 자율 루프로 선택 사용
- `/ultrareview` — 사용자가 직접 PR에 트리거
