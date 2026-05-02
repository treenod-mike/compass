# CumulativeRoasChart — Gameboard 디자인 차용 Redesign

**Date:** 2026-05-02
**Status:** Approved (Mike "게임보드 차트 디자인 차용해서" 2026-05-02)

---

## 1. Why

Compass의 메인 시뮬레이터 차트(`CumulativeRoasChart`)는 Bloomberg Terminal × Linear × Toss DPS 디자인 언어로 그려져 있다 — 모노크롬 base + 신호색 minimal + radius 2-6px 각진 톤. 

Mike 결정: 이 톤은 시뮬레이터에서 *추상적이고 차가운* 인상을 준다. 게임 스튜디오 도메인의 부모 저장소인 **Gameboard** 의 ToggleChart 디자인 (rounded-2xl Card + 풍부한 헤더 + soft area gradient) 을 차용하면 더 따뜻하고 *제품다운* 느낌으로 격상.

전체 Compass의 디자인 시스템 까지 다 갈아엎지는 않고, **메인 차트 한 컴포넌트만** 변경. 다른 차트들은 후속 작업.

---

## 2. Out of Scope

- **전체 디자인 시스템 교체** — `globals.css` 토큰, `chart-typography.ts`, signal 색 등은 그대로. 본 phase는 CumulativeRoasChart 한 컴포넌트만.
- **ToggleChart 컴포넌트 자체 포팅** — gameboard의 ToggleChart는 Card / CustomTabs / AxisRangeDialog / SegmentFilter 등 거대 의존성 다발. 이번에는 *시각 패턴만 차용*, 컴포넌트는 Compass 인라인.
- **다른 차트 위젯들** — RunwayChart, KPI strip, Sensitivity Heatmap 등 그대로 유지. 후속 phase에서 개별로 검토.

---

## 3. 차용 디자인 요소

### A. 외곽 Card 래퍼
```css
rounded-2xl                /* 16px — 게임보드 기준 (Bloomberg 4px 대비 부드러움) */
border border-border       /* card token */
bg-card                    /* card 표면 */
hover:border-primary       /* 인터랙션 명확화 */
transition-colors
```

### B. CardHeader 구조
```
┌────────────────────────────────────────────────────┐
│ {Title} {[tooltip-info]} {titleAdornment}    {customFilter} │
│ ─────────────────────────────────────────────────── │
│ {subtitle (optional)}                                │
└────────────────────────────────────────────────────┘
```
- Title: `font-bold tracking-[-0.01em]`, 16-18px
- 우측 customFilter: 차트 타입 전환 / granularity / 옵션 등 — 현재 monthly/quarterly 토글이 여기 들어감
- subtitle은 작은 회색 텍스트

### C. 차트 색상 / 스타일
- **단일 P50 라인**: `--brand` (브랜드 블루 #1A7FE8), strokeWidth 2.5
- **P10/P90 밴드**: `Area` with `fillOpacity={0.12}`, color `--brand` — 밴드는 두 Area의 마스킹
- **BEP 100% horizontal line**: `--foreground` 1.5px solid (게임보드는 reference line 회색 dashed)
- **Break-even crossover marker**: 도트 + 수직 dashed line — 색상은 `--success` (signal-positive)
- **Pinned scenario (Phase 8)**: dashed `6 4`, `--fg-2` 회색 — 그대로 유지
- **Market BEP (Phase 4.1)**: dashed `4 4`, `--fg-3` 옅은 회색 — 그대로 유지

### D. Soft area gradient
ToggleChart 패턴: 단순 fillOpacity 0.12 평면 색이 아니라 **세로 그라데이션** (위에서 아래로 색→투명).

```typescript
<defs>
  <linearGradient id="cumulative-roas-band" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.18} />
    <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.02} />
  </linearGradient>
</defs>
<Area dataKey="p90" fill="url(#cumulative-roas-band)" ... />
```

### E. 헤더 customFilter 영역
현재: monthly/quarterly가 헤더 옆 작은 토글
After: ToggleChart 스타일의 button group — 좀 더 시각적으로 명확

### F. 카드 패딩 / 간격
- Card padding: `p-6`
- Header → 차트: `pb-4` 헤더 + 차트 영역
- 차트 height: 그대로 (340-380px)

---

## 4. 변경 전후 비교

| 항목 | Before (현재) | After (gameboard 차용) |
|---|---|---|
| 외곽 | 카드 X (raw chart) | rounded-2xl Card + hover border |
| 헤더 | 단순 ChartHeader 텍스트 | font-bold + tooltip info + titleAdornment slot + customFilter slot |
| Area 밴드 | 단일 fillOpacity 0.12 | linearGradient (위 0.18 → 아래 0.02) |
| Line color | `--primary` | `--brand` 그대로 (이미 동일) |
| Reference line | inline label position top | inline label + 색상 stronger |
| Granularity 토글 | 작은 인라인 버튼 | header customFilter — 더 큰 button group |
| Compass tone | 각진 + monochrome | 부드러운 + 풍부 |

---

## 5. File Structure

| 변경 | 경로 | 책임 |
|---|---|---|
| Modify | `src/widgets/vc-simulation/ui/cumulative-roas-chart.tsx` | Card 래핑 + gradient + 헤더 재구성 |

다른 파일 손대지 않음. 호출자(`vc-result-board.tsx`)는 props 그대로 사용.

---

## 6. 위험 / 호환성

- 기존 Card 컴포넌트 위치 확인 필요: `src/shared/ui/Card` 또는 `src/shared/ui/card.tsx`. 없다면 인라인 div + class 처리.
- benchmark-gap (실측 vs 시뮬) 표시는 차트 footer로 그대로 유지 — 디자인은 살짝 다듬을 수 있으나 큰 변경 X.
- Pinned + market BEP overlay (Phase 4.1, 8) 그대로 유지. gradient 변경은 P10/P90 밴드만.

---

## 7. 성공 기준

- 차트가 카드로 감싸짐 — 호버 시 border 색 강조
- P10/P90 밴드가 그라데이션으로 부드러워짐
- 헤더에 tooltip info + (선택) titleAdornment 슬롯 사용 가능
- monthly/quarterly 토글이 헤더 우측 customFilter 영역에 깔끔히 배치
- 기존 BEP marker / pinned line / market BEP 모두 정상 동작
- tsc + 254 tests 통과

---

## 8. Future

- v1.1: 다른 차트들 (DualBaselineRunwayChart, ContributionDonut 등) 동일 패턴 적용
- v2: gameboard의 ToggleChart 자체를 Compass에 포팅 (Card / CustomTabs 등 의존성 다발 함께)
- v2.1: 디자인 토큰 sync 재추진 (PR #24 Phase 1-2 머지됨, Phase 3-4 미진행)
