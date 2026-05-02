# Compass

**VC 시뮬레이터** — 모바일 게임 자본 배분 시뮬에 자사 데이터(AppsFlyer + LSTM)와 시장 데이터(Sensor Tower percentile)를 같이 보여준다. Pollen VC식 단순 cash flow 시뮬 수준.

> **정체성**: 시뮬 본체에 살아있는 자산은 4개(AppsFlyer / LSTM / Sensor Tower / cohort retention strip). 분석성 페이지(MMM·PRISM·Capital·Diligence·Marketing-sim·Portfolio)와 베이지안 엔진은 dormant — 코드 보존, mount/import 0건. 자세한 결정은 `docs/superpowers/specs/2026-05-02-analysis-asset-absorption-design.md`.

> **브랜드 메타**: purple primary (`#9128b4`) · Pretendard Variable · Rocko Ultra (로고 한정) · Tossface

## Tech Stack

| 영역 | 기술 |
|------|------|
| Framework | Next.js 16 (App Router) + TypeScript |
| Architecture | FSD 2.1 (Feature-Sliced Design) |
| State | Zustand (client) |
| Visualization | Recharts + visx |
| UI | Tailwind CSS v4 + Radix UI + @base-ui/react + Framer Motion |
| Icons | @iconify/react + @iconify-icons/solar (bold · bold-duotone) |
| Fonts | Pretendard Variable + Tossface + Rocko Ultra (로고) |

## Development

```bash
npm install --legacy-peer-deps   # @visx peer-dep 회피
npm run dev                      # http://localhost:3000
npm run build                    # production 빌드 검증
```

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                  # Root (font-face via globals.css)
│   └── (dashboard)/
│       ├── layout.tsx              # LayoutWrapper 래퍼
│       └── dashboard/
│           ├── page.tsx            # VC Simulator (홈, 사이드바 노출)
│           ├── connections/        # AppsFlyer 연동 관리 (사이드바 노출)
│           ├── market-gap/         # 흡수 — "시장과 비교" 토글에서 사용
│           ├── cohort/             # 흡수 — 가정값 disclosure에서 사용
│           ├── mmm/                # dormant
│           ├── prism/              # dormant
│           ├── capital/            # dormant
│           ├── diligence/          # dormant
│           ├── marketing-sim/      # dormant
│           ├── portfolio/          # dormant
│           └── vc-simulation/      # `/dashboard` redirect (북마크 호환)
├── shared/
│   ├── api/                        # mock-data, mock-connections
│   ├── config/                     # navigation, chart-colors, chart-typography
│   ├── constants/                  # colors, ui-sizes
│   ├── i18n/                       # locale 고정 "ko"
│   ├── lib/                        # utils, chart-utils, debug
│   ├── store/                      # selected-game (Zustand)
│   └── ui/                         # Card/Dialog/CustomTabs/ChartTooltip 등
├── styles/
│   └── globals.css                 # TDS tokens (1284줄)
└── widgets/
    ├── charts/                     # 24 차트
    ├── connections/                # ConnectionCard / ConnectionDialog
    ├── dashboard/                  # DecisionStoryCard / KPICards / ...
    └── navigation/                 # AppTopBar / CategorySidebar / BrandAndProduct
```

## Reference Directories (로컬 전용)

저장소에 올라가지 않는 참고용 폴더 (gitignore + tsconfig exclude 처리됨):

| 경로 | 용도 |
|------|------|
| `/gameboard-src/` | Treenod **gameboard** 원본 소스 — 디자인/컴포넌트 참조 스냅샷 |
| `/crawler/` | Sensor Tower 크롤러 (별도 서브 프로젝트) |

필요한 gameboard 파일은 `gameboard-src/` 에서 직접 조회해 Compass로 포팅하는 워크플로입니다. 빌드/타입체크 대상에서 자동 제외.

## Design System Refs

- `docs/top-card-research.md` — 상단 판정 카드 Toss 벤치마크
- `docs/wording-glossary.md` — 전문용어 → 평이어 전환 사전 (80+ 항목)
- `docs/verdict-redesign-concepts.md` — 3개 리디자인 컨셉 ASCII mockup

## Commit / Branch Convention

- 단일 브랜치 `main` · atomic 커밋 권장
- 계정 분리 규칙: 이 repo는 **`treenod-mike`** SSH key로만 push (`git@github.com-treenod:treenod-mike/compass.git`)

### VC Simulator (`/dashboard` — 홈)

선택된 게임에 대한 VC 오퍼 조건 기반 Monte Carlo 투자 시뮬. 슬라이더(Horizon / Fund / Channel mix) → 결과(KPI Delta / Cumulative ROAS / Runway) 즉시 갱신. P10/P50/P90 신뢰 구간은 LSTM quantile forecast로 채움(베이지안 추정 안 거침).

- 계산 로직: `src/shared/api/vc-simulation/compute.ts`
- LSTM 리텐션/매출 계약: `src/shared/api/data/lstm/retention-snapshot.json` + `src/shared/api/vc-simulation/types.ts` (Zod schema)
- 설계 스펙(원형): `docs/superpowers/specs/2026-04-24-vc-simulation-design.md`
- 정체성 pivot: `docs/superpowers/specs/2026-04-29-vc-simulator-product-pivot-design.md`
- 분석 자산 흡수/dormant 결정: `docs/superpowers/specs/2026-05-02-analysis-asset-absorption-design.md`
- 단위 테스트: `npm run test:vc`

`/dashboard/vc-simulation`은 북마크 호환을 위한 redirect 경로로 보존됨.
