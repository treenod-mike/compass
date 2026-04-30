# Portfolio Menu — Design

**Date:** 2026-04-30
**Status:** In progress (Mike approved menu structure 2026-04-30)
**Predecessor:** `2026-04-29-vc-simulator-product-pivot-design.md` (VC pivot 완료)

---

## 1. Why

VC simulator pivot 완료 후 사이드바는 `Dashboard + Connections` 둘뿐. 시뮬레이터의 입력 후보군(어떤 게임을 시뮬할지)을 보여줄 진입점이 없다. **Portfolio 메뉴**가 이 역할을 한다.

- 사용자 동선: Portfolio → 게임 선택 → "시뮬레이터에서 보기" → `/dashboard`
- 실 demo 게임은 1개(poko merge) + 포트폴리오 aggregate. 단일 게임이라도 *제품 정체성* 면에서 "여러 게임 운영 중" 가능성을 보여주는 것이 핵심.

---

## 2. Out of Scope

- **새 mock 게임 추가** — 현재 1개 + portfolio. 새 게임 데이터 만드는 건 Phase 8+.
- **Pipeline 메뉴** — pre-launch 단계 게임. mock 부족으로 defer.
- **Diligence 메뉴** — market-gap / mmm / prism 워크벤치 통합. 별도 phase.
- **"Add to portfolio" 플로우** — admin form. 현재 1게임 + portfolio 고정.
- **Compare across games** — 다중 게임 시 의미 있는 기능.

---

## 3. Information Architecture

### 사이드바 변화

```
Before                     After
─────────────              ─────────────
◎ Dashboard                ◎ Dashboard           (= VC simulator)
─────────────              📊 Portfolio          ← 신규
⚙ Settings                 ─────────────
  └ Connections            ⚙ Settings
                             └ Connections
```

### 라우트

- 신규: `/dashboard/portfolio` (사이드바 노출)
- 기존 다른 경로 변경 없음

---

## 4. Layout (Desktop)

```
┌─ TopBar (sticky) ───────────────────────────────────────────┐
│  ◎ Compass  |  [game ▾]  |  ● 신선  |                      │
└─────────────────────────────────────────────────────────────┘
┌─ PageHeader ────────────────────────────────────────────────┐
│  Portfolio                                                  │
│  운영 중인 게임의 투자 상태                                    │
└─────────────────────────────────────────────────────────────┘
┌─ Aggregate KPIs (포트폴리오 합산 4 카드) ──────────────────────┐
│  Total invested  |  Cumulative ROAS  |  Active games  |  …  │
└─────────────────────────────────────────────────────────────┘
┌─ Per-game cards (그리드) ──────────────────────────────────────┐
│ ┌───────────────┐  ┌───────────────┐                         │
│ │ 포코머지 [Invest] │  │ + Add 게임    │                         │
│ │ ROAS 148%        │  │ (placeholder) │                         │
│ │ Payback 6mo      │  │               │                         │
│ │ Spent $1.2M      │  │               │                         │
│ │ [시뮬에서 보기 →] │  │               │                         │
│ └───────────────┘  └───────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

**Portfolio aggregate** 는 게임 카드 첫 자리에 따로 표시하거나 상단 KPIs에서 보여줌.

---

## 5. Per-Game Card

| 요소 | 데이터 소스 | 비고 |
|---|---|---|
| 게임명 | `gameId` | "포코머지" |
| Signal 배지 | `mockTitleHealth[gameId].status` | Invest / Hold / Reduce |
| ROAS | `mockTitleHealth[gameId].roas` | % 표시 |
| Payback | `mockTitleHealth[gameId].payback` | mo 단위 |
| Capital deployed | `mockPortfolioKPIs` 에서 추출 | $ 단위 |
| 트렌드 미니 sparkline | `gameData.charts.revenueVsInvest` 의 마지막 12개월 | optional v1.1 |
| CTA "시뮬에서 보기" | onClick → `setSelectedGame(gameId)` + router.push("/dashboard") | |

---

## 6. 컴포넌트 재사용

기존 위젯 그대로 사용:
- `PageHeader` — 페이지 타이틀
- `KPICards` — aggregate KPIs strip (Phase 1에서 hidden 됐던 위젯, Portfolio에서 부활)
- `signal` 토큰 — Invest/Hold/Reduce 배지 색
- `useSelectedGame` Zustand store — 게임 선택 state

신규 컴포넌트:
- `PortfolioGameCard` — 게임 1개 표현 카드
- `/dashboard/portfolio/page.tsx` — 페이지 자체

---

## 7. Mobile (≤768px)

- Aggregate KPIs grid 2×2
- Per-game cards 단일 컬럼 stacking
- CTA 풀폭

---

## 8. 디자인 시스템 준수

- 카드 radius: `--radius-card` (4px)
- Signal 색: 게임별 status 배지에만
- 배경 모노크롬
- 숫자: Geist Mono `tabular-nums`
- 헤더: Geist Sans / Pretendard

---

## 9. 데이터 흐름

```
useSelectedGame() (전역)
        │
        ▼
Portfolio page
        │
        ├─ mockPortfolioKPIs       (aggregate 카드)
        ├─ mockTitleHealth         (per-game status / KPIs)
        └─ click → setSelectedGame(gameId) + router.push("/dashboard")
```

VC sim 백엔드 데이터 변경 없음. 기존 mock 그대로 소비.

---

## 10. 성공 기준

- 사이드바에 "Portfolio" 항목 노출
- `/dashboard/portfolio` 진입 시 aggregate + 게임 카드 렌더
- 게임 카드 클릭/CTA → 시뮬레이터에서 해당 게임 선택 상태로 이동
- 다중 게임 추가 시 카드 그리드가 자연스럽게 확장 (placeholder card 제외하고도 작동)
- 254 tests + tsc pass

---

## 11. Open Questions

1. **Aggregate KPIs 위치 — 페이지 상단 vs 첫 게임 카드처럼?** 추천: 페이지 상단 (Portfolio 단위와 게임 단위가 의미적으로 분리).
2. **Placeholder "+ Add 게임" 카드?** v1에서는 *생략* (추후 admin flow 대비). YAGNI.
3. **CTA 라벨?** "시뮬에서 보기" / "Open in simulator". 한국어 기본.
