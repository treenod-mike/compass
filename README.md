# Compass

Experiment-to-Investment Decision OS — 모바일 게임 산업의 실험·어트리뷰션·시장 시그널을 자본 배분 결정으로 번역하는 AI 기반 의사결정 플랫폼.

> **브랜드 메타**: purple primary (`#9128b4`) · Pretendard · Rocko Ultra (로고 한정)

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
│           ├── page.tsx            # 투자 판정
│           ├── market-gap/page.tsx # 시장 포지셔닝
│           └── connections/page.tsx# 데이터 연결 (MVP)
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

### VC Simulation (`/dashboard/vc-simulation`)

선택된 게임에 대한 VC 오퍼 조건 기반 36개월 Monte Carlo 투자 시뮬레이터. Baseline ①(실험 없이)과 ②(실험 반영) 를 동시 렌더링하여 실험-이율 J-커브를 시각화.

- 계산 로직: `src/shared/api/vc-simulation/compute.ts`
- LSTM 리텐션 계약: `src/shared/api/data/lstm/retention-snapshot.json` + `src/shared/api/vc-simulation/types.ts` (Zod schema)
- 설계 스펙: `docs/superpowers/specs/2026-04-24-vc-simulation-design.md`
- 단위 테스트: `npm run test:vc`
