# Diligence Menu — Design

**Date:** 2026-04-30
**Status:** Approved (Mike "다음 가자" 2026-04-30)
**Predecessors:**
- `2026-04-29-vc-simulator-product-pivot-design.md` — VC pivot 완료 (hidden routes 보존)
- `2026-04-30-portfolio-menu-design.md` — Portfolio 메뉴 (PR #37 merged)

---

## 1. Why

VC simulator pivot에서 4개 페이지가 사이드바에서 hidden 됐다 — `market-gap`, `mmm`, `prism`, `vc-simulation`. 그 중 `vc-simulation`은 `/dashboard`에 흡수돼 있고, 나머지 3개는 URL만 살아있을 뿐 진입점 없음. **Diligence 메뉴**가 이 분석 toolkit의 통합 진입점.

> "Diligence" = 시뮬레이터에 *입력할 가정값* 을 다지는 단계. 시뮬 결과를 신뢰하려면 그 입력 데이터가 어떤 시장 신호 / 채널 분해 / 실험 영향에서 왔는지 알아야 함.

---

## 2. Out of Scope

- **Hidden pages 자체 수정 금지** — `/market-gap`, `/mmm`, `/prism` 페이지는 그대로 보존. 본 phase는 *진입점*만 추가.
- **3-tab 단일 페이지로 통합** — defer. 각 hidden 페이지가 이미 자체 IA를 가져서 통합하면 의미가 흐려짐. v1은 hub 형식.
- **Sheet drawer로 임베드** — Phase 5 패턴 재사용도 가능하나 마우스 동선이 더 복잡해짐. v1은 단순 navigation.

---

## 3. IA

### 사이드바

```
Before                           After
─────────────                    ─────────────
◎ Dashboard                      ◎ Dashboard
📊 Portfolio                     📊 Portfolio
─────────────                    🔬 Diligence          ← 신규
⚙ Settings                       ─────────────
  └ Connections                  ⚙ Settings
                                   └ Connections
```

### 라우트

- 신규: `/dashboard/diligence` (사이드바 노출)
- 기존: `/dashboard/market-gap`, `/dashboard/mmm`, `/dashboard/prism` 그대로 (Diligence hub의 카드에서 `<Link>` 으로 진입)

---

## 4. Layout

```
┌─ TopBar ────────────────────────────────────────────────────┐
│  ◎ Compass | [game ▾] | ● 신선 |                           │
└─────────────────────────────────────────────────────────────┘
┌─ PageHeader ────────────────────────────────────────────────┐
│  Diligence                                                  │
│  시뮬 입력 가정값을 다지는 분석 toolkit                          │
└─────────────────────────────────────────────────────────────┘
┌─ 3 카드 그리드 ─────────────────────────────────────────────┐
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│ │ 🎯 시장 포지셔닝 │  │ 📡 채널 분해   │  │ 🧪 실험 영향   │         │
│ │ Bayesian      │  │ MMM / CPI    │  │ PRISM × LTV  │         │
│ │ prior/post    │  │ benchmark    │  │ rollout      │         │
│ │              │  │              │  │              │         │
│ │ Open ↗        │  │ Open ↗        │  │ Open ↗        │         │
│ └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

각 카드 → `<Link href="/dashboard/{market-gap|mmm|prism}">` Next.js 클라이언트 navigation.

---

## 5. 카드 구성

| 카드 | 라우트 | 아이콘 | 설명 (ko) | 설명 (en) |
|---|---|---|---|---|
| 시장 포지셔닝 | `/dashboard/market-gap` | `target-bold` (또는 graph-up) | 장르 기대치 vs 우리 실적 분포 | Genre prior vs our actual distribution |
| 채널 분해 | `/dashboard/mmm` | `widget-5-bold` | UA 채널별 CPI 벤치마크 + 효율 | UA channel CPI benchmark + efficiency |
| 실험 영향 | `/dashboard/prism` | `flaskBold` (custom) | 변이 / 실험이 LTV에 미친 영향 | Variant / experiment LTV impact |

---

## 6. 컴포넌트 재사용

- `PageHeader` — 페이지 타이틀
- `PageTransition` / `FadeInUp` — 진입 애니메이션
- `<Link>` from `next/link` — 카드 클릭 → hidden route 진입
- 신규: `DiligenceCard` (단순 카드, 약 30줄)

---

## 7. Mobile

- 3-card grid → single column stacking (≤768px)

---

## 8. 디자인 시스템 준수

- Card radius `--radius-card` (4px)
- Hover 시 border `--brand` 색
- 아이콘: solar-bold set
- 모노크롬 base, signal 색 사용 안 함 (분석 toolkit이라 signal 의미 없음)

---

## 9. 데이터 흐름

데이터 흐름 없음 — 본 페이지는 *진입점*. 실제 분석은 hidden 페이지가 수행.

```
Diligence hub
        │
        ├─ Link → /dashboard/market-gap (기존 페이지)
        ├─ Link → /dashboard/mmm (기존 페이지)
        └─ Link → /dashboard/prism (기존 페이지)
```

백엔드 / mock 데이터 변경 없음.

---

## 10. 성공 기준

- 사이드바에 "Diligence" 노출
- `/dashboard/diligence` 진입 시 3개 카드 그리드
- 각 카드 클릭 → 해당 hidden 페이지로 navigation 정상
- 모바일에서 카드 stacking
- 254 tests + tsc pass

---

## 11. Future Work

- v1.1: 각 카드에 "최근 변화" 미니 indicator (예: market gap이 주요 변화 있음 ⚠)
- v2: 3-tab 단일 페이지로 통합 + 게임 selector 공유 (현 hidden 페이지의 자체 selector 제거)
- v2.1: PRISM × LTV 통합 phase 합쳐지면 PRISM 카드가 시뮬 안으로 흡수
