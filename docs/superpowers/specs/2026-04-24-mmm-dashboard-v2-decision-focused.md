# MMM Dashboard v2 — Decision-Focused 재설계 스펙

**작성일**: 2026-04-24
**브랜치**: `feat/mmm-dashboard`
**이전 스펙**: `2026-04-24-mmm-dashboard-design.md` (v1, Phase 1 Response Curve 중심)
**현재 구현 커밋**: `0ed0e05` (v1 Phase 1)

---

## 0. 왜 v2인가

v1 구현(`/dashboard/mmm` Response Curve 2×2)을 실 UI로 확인한 결과 **직관성 부족**이 드러났다:

- Response Curve는 **MMM 방법론을 보여주는 차트**이지, **의사결정을 보여주는 차트**가 아님
- S-커브 접선으로 marginal CPI를 읽어내려면 통계 지식 필요 → 실무자·경영자에게 부적합
- 채널별 카드 4개가 정보 밀도는 높지만 "그래서 어쩌라고"에 답하지 않음

### v2 설계 기준 (사용자와 협의한 원칙)

**내용은 실용적 의사결정 도구, 포장은 쇼케이스급 완성도** — (a)+(b) × (c) 하이브리드.

| 층위 | 목적 |
|------|------|
| (a) 실무적 | "Meta에서 Google로 $30K 옮기자" — 구체적 재배분 액션 |
| (b) 경영자적 | "우리 마케팅이 한계에 달했나?" — 포트폴리오 전체 판정 |
| (c) 쇼케이스 | MMM/Bayesian 기술력이 드러나는 독특한 시각화와 드릴다운 깊이 |

### 핵심 분석 질문 (재확인)

1. **시장 포화도 (Saturation)**: 돈을 더 넣으면 효과가 있는가?
2. **단가 적절성 (CPI Benchmark)**: 우리 CPI는 시장 대비 합리적인가?

두 질문 모두 **1급 섹션**으로 노출. v1은 Saturation만 주된 주제였고 Benchmark는 카드 안 숫자로 희석됨 → v2는 CPI Benchmark 전용 섹션(④)을 하단에 배치.

---

## 1. 페이지 구조 (5-Section)

```
┌─────────────────────────────────────────────────┐
│ ① Hero Verdict                                  │
│   DecisionStoryCard (기존 재사용)                │
│   강한 판정 문장 + 3 메트릭 + 채널별 상태 뱃지    │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│ ② Portfolio Saturation Meter (NEW)              │
│   0% ━━━━━━▓▓▓▓━━━━━ 100%  66% ⚠               │
│   "가중 평균 — Meta/Apple이 한계 근접"           │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│ ③ Channel Status Cards (단순화, 4개)            │
│   각 카드: 포화 배지 + mCPI + 권고 액션 + 포화%  │
│   클릭 → Response Curve 드릴다운 모달            │
└─────────────────────────────────────────────────┘

── 단가 적절성 영역 (하단) ──

┌─────────────────────────────────────────────────┐
│ ④ CPI Benchmark Analysis                        │
│   좌: 2×2 Quadrant (포화도 × 시장 대비 CPI 편차)│
│        4채널 = 4 dot, 4 사분면 라벨             │
│   우: 벤치마크 테이블                           │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│ ⑤ Reallocation Summary                          │
│   Before → After 바 + "+$28K" 예상 매출         │
└─────────────────────────────────────────────────┘
```

### 섹션별 역할 매트릭스

| 섹션 | 답하는 질문 | 주 시청자 | 상호작용 |
|------|-------------|-----------|----------|
| ① Verdict | "결론은?" | 경영자 | 읽기 |
| ② Saturation Meter | "전체 얼마나 막혔나?" | 경영자 | Hover tooltip |
| ③ Channel Cards | "어느 채널이 문제고 뭐 해야?" | 실무자 | Click → Drill |
| ④ CPI Benchmark | "시장 대비 적정 가격인가?" | 실무자 | Dot hover |
| ⑤ Reallocation | "얼마 옮기면 얼마 번다?" | 의사결정자 | (데모) 적용 버튼 |

### 스토리 흐름

```
[판정] → [전체 맥락] → [채널 단위 문제] → [시장 비교] → [액션]
 ①        ②              ③                   ④             ⑤
```

섹션 ①~③은 **내부 관점** (우리 데이터만). ④는 **외부 벤치마크**. ⑤는 ①~④가 가리키는 **실행 지침**. 5개 섹션이 하나의 선형 내러티브로 읽혀야 함.

---

## 2. 섹션별 상세 설계

### ① Hero Verdict

**재사용**: `DecisionStoryCard` 그대로. v1과 동일.

**변경 없음.**

### ② Portfolio Saturation Meter (NEW)

**계산**: Spend-가중 평균 saturation.
```
weightedSaturation = Σ(channel.saturationPct × channel.spend) / Σspend
```

**시각화**: 수평 게이지 바.
- 트랙: 회색 (bg-2)
- 값 영역: 0~33% 녹색 · 33~66% 주황 · 66~100% 빨강 (signal 토큰)
- 마커: 현재 값 위치에 드롭 인디케이터
- 축 라벨: `0%`, `33%`, `66%`, `100%`, 각 구간에 "여유 / 주의 / 포화" 라벨

**카피**:
- 상단 라벨: `채널 포화도 (spend-가중 평균)` / `Saturation (spend-weighted)`
- 현재 값: 큰 숫자 `66%`
- 해석 한 줄: "Meta/Apple이 한계 근접, 전체 포트폴리오도 주의 구간"

**컴포넌트**: `src/widgets/charts/ui/saturation-meter.tsx` — visx scale 또는 순수 CSS 바.

### ③ Channel Status Cards (SIMPLIFIED)

v1 `ResponseCurveCard`의 compact 뷰 대신 **더 단순한** 카드 4개. S-커브는 **완전 제거**하고 수치로만 표현.

**카드 내용** (각 130-150px 높이):
```
┌──────────────────┐
│ Meta Ads    🔴   │   ← 상단: 채널명 + 포화 배지 (🟢🟡🔴)
│──────────────────│
│  mCPI   $42.00   │   ← 큰 숫자 1개
│                  │
│ 포화 78%  ━━━━▓  │   ← 포화 미니 바 (전체 미터의 축소판)
│                  │
│ 권고: -$30K 축소 │   ← 액션 한 줄 (bold)
└──────────────────┘
     (클릭 가능)
```

**클릭 시**: 기존 `ResponseCurveCard`의 expanded 뷰를 모달로 띄움. Response Curve + saturation point + benchmark + methodology trigger. **v1 자산 재활용 — 기존 컴포넌트는 모달 컨텐츠로 이동.**

**배지 로직**:
- 🟢 저포화 (saturationPct < 33%)
- 🟡 주의 (33% ≤ < 66%)
- 🔴 포화 (≥ 66%)

**권고 로직** (mock JSON precompute):
- "+$XK 증액" — 여유 있는 채널
- "-$XK 축소" — 포화 채널
- "유지" — 중립

**컴포넌트**:
- `src/widgets/charts/ui/channel-status-card.tsx` — 새 카드
- `src/widgets/charts/ui/channel-detail-modal.tsx` — 기존 ResponseCurveCard를 래핑

### ④ CPI Benchmark Analysis

2단 레이아웃. 좌측 쇼케이스 차트 + 우측 실용 테이블.

#### ④-L: 2×2 Quadrant Chart

**축**:
- x: 포화도 (0~100%)
- y: 시장 대비 CPI 편차 (%) — `(ourCpi - marketMedianCpi) / marketMedianCpi × 100`

**사분면 해석**:
```
                  y: CPI 편차
                      ▲
            (시장 대비 비쌈)
    +50% ┼──────────────┼──────────────
         │              │               
    좌상 │  ⓘ Creative  │  ⓘ 과포화 🔴 │ 우상
         │    문제      │   축소 필요   │
         │  (여유 있지만)│  (비싸고 포화)│
         │  ● Google?   │ ● Meta       │
    0%   ┼──────────────┼─────────────── → x: 포화도
         │              │               
         │  🟢 최적     │  ⚠ 유니콘    │
         │  (저포화+저가)│  (포화지만 저가)│
         │  ● TikTok?   │               
    -50% │              │               
         │              │               
            (시장 대비 저렴)
               낮음           높음
```

**데이터 포인트**: 4채널 × (saturationPct, cpiDeviation, ourCpi, mCpi, label, color).

**렌더링**:
- Recharts `ScatterChart` + `ReferenceLine` (x=50%, y=0%) → 4사분면
- 각 dot 컬러 = 해당 채널 `MMM_COLORS.channels.<key>.line`
- Dot 크기 = `log(spend)` 에 비례 (spend 많을수록 큰 dot, 버블차트 효과)
- 사분면 background: 반투명 color wash (risk/caution/positive 참조)
- 각 사분면 라벨: 코너에 카피 노출 (i18n)

**컴포넌트**: `src/widgets/charts/ui/cpi-quadrant.tsx`

#### ④-R: Benchmark Table

```
┌─────────┬────────┬────────┬────────┬────────┐
│ 채널    │ 우리   │ 시장   │ 편차   │ 판정   │
├─────────┼────────┼────────┼────────┼────────┤
│ Meta    │ $42.00 │ $32.00 │ +31%   │ 🔴 비쌈│
│ Google  │ $18.00 │ $22.00 │ -18%   │ 🟢 저렴│
│ TikTok  │ $28.00 │ $25.00 │ +12%   │ 🟡 근접│
│ Apple   │ $38.00 │ $29.00 │ +31%   │ 🔴 비쌈│
└─────────┴────────┴────────┴────────┴────────┘
```

**판정 로직**:
- `|편차| < 15%` → 🟡 근접
- `편차 ≥ +15%` → 🔴 비쌈
- `편차 ≤ -15%` → 🟢 저렴

**컴포넌트**: `src/widgets/charts/ui/cpi-benchmark-table.tsx` — 단순 HTML 테이블 + Tailwind.

#### 카피 (출처 라벨)

테이블 하단: `출처: AppsFlyer Benchmarks (Mock — Phase 2에서 크롤러 연동)` / 영문 동일.

### ⑤ Reallocation Summary (NEW)

**시각화**: Before → After 가로 막대 2조. 각 막대는 4채널 색깔로 stacked.
```
Before:  [Meta $120K ][Google $60K][TikTok $65K][Apple $75K]  총 $320K
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
After:   [Meta $90K][Google $105K][TikTok $65K][Apple $60K]   총 $320K
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

화살표: Meta →$30K→ Google,  Apple →$15K→ Google
예상 효과: 월 매출 $520K → $548K (+5.4%)
신뢰도: 78%
```

**렌더링**: Recharts `BarChart` (horizontal) + `stacked: true`. 화살표/이동량은 커스텀 SVG 오버레이 또는 텍스트 리스트.

**데이터 출처**: snapshot의 `reallocation` 필드 (precomputed).

**컴포넌트**: `src/widgets/charts/ui/reallocation-summary.tsx`

---

## 3. 스냅샷 스키마 확장

v1 스키마 위에 다음 필드 **추가** (기존 필드 유지):

```typescript
// 새 섹션: portfolio (top-level)
portfolio: {
  saturationWeighted: z.number().min(0).max(1),  // 0-1 (66% = 0.66)
  saturationInterpretation: LocalizedTextSchema, // "Meta/Apple 한계 근접..."
}

// 각 channel에 recommendation 추가
channel.recommendation: {
  action: z.enum(["increase", "decrease", "hold"]),
  deltaSpend: z.number(),  // $ (음수 = 축소)
  rationale: LocalizedTextSchema,
}

// 새 섹션: reallocation (top-level)
reallocation: {
  totalMoved: z.number().nonnegative(),
  expectedRevenueLift: z.number(),  // 월 매출 델타 ($)
  expectedRevenueLiftPct: z.number(),  // +5.4 → 5.4
  confidence: z.number().min(0).max(1),
  moves: z.array(z.object({
    from: ChannelKeySchema,
    to: ChannelKeySchema,
    amount: z.number().positive(),
  })).max(6),
}
```

**기존 필드(Phase 1) 유지 이유**:
- `channels[].responseCurve` — Drill-down 모달에서 계속 사용
- `channels[].saturation.halfSaturation` — 모달의 knee 참조선
- `channels[].benchmark` — 섹션 ④에서 1급 데이터
- `channels[].marginal` — 섹션 ③ mCPI + 섹션 ④ 편차 계산

**Schema version bump**: `$schemaVersion: z.literal(1)` → `z.literal(2)`.

---

## 4. 컴포넌트 인벤토리

### 재사용 (변경 없음)
- `DecisionStoryCard` (섹션 ①)
- `MethodologyModal` (드릴다운 모달)
- `ResponseCurveCard` (드릴다운 모달 컨텐츠로 이동)
- `useGridLayout`, `useChartExpand`, `PageTransition`, `FadeInUp`, `ChartHeader`, `ChartTooltip`, `ExpandButton`
- `PALETTE`, `MMM_COLORS`, `CHART_TYPO`

### 신규 (섹션별)
| 섹션 | 파일 | 역할 |
|------|------|------|
| ② | `saturation-meter.tsx` | 수평 게이지 바 |
| ③ | `channel-status-card.tsx` | 단순화된 채널 카드 |
| ③ | `channel-detail-modal.tsx` | Click 드릴다운 (ResponseCurveCard 래핑) |
| ④ | `cpi-quadrant.tsx` | 2×2 Scatter |
| ④ | `cpi-benchmark-table.tsx` | 벤치마크 테이블 |
| ⑤ | `reallocation-summary.tsx` | Before/After 막대 + 이동 시각화 |

### 제거 (리팩토링)
- `ResponseCurveGrid` — v2에서 페이지 레벨 2×2 컨테이너 역할 사라짐. **파일 삭제**. 로직은 `ChannelStatusCard` 배열 렌더로 대체.

### 수정
- `src/app/(dashboard)/dashboard/mmm/page.tsx` — 5섹션 조립으로 전면 교체.
- `src/shared/api/mmm-data.ts` — 스키마 v2 필드 추가 + parse.
- `src/shared/api/data/mmm/mock-snapshot.json` — `portfolio`, `recommendation`, `reallocation` 필드 채움.

### i18n 키 추가 (대략 30개 예상)
```
mmm.section.verdict / saturation / channels / benchmark / reallocation
mmm.saturation.meter.label
mmm.saturation.meter.interpretation
mmm.saturation.tier.low / medium / high
mmm.channel.badge.low / medium / high
mmm.channel.recommendation.increase / decrease / hold
mmm.benchmark.quadrant.title / subtitle
mmm.benchmark.quadrant.q.optimal / creative / unicorn / oversaturated
mmm.benchmark.table.headers.channel / us / market / deviation / verdict
mmm.benchmark.verdict.expensive / close / cheap
mmm.benchmark.source
mmm.reallocation.title
mmm.reallocation.expectedLift
mmm.reallocation.before / after
mmm.reallocation.totalMoved
```

기존 `mmm.channel.*`, `mmm.metric.*`, `mmm.ref.saturationPoint`, `mmm.methodology.*` 키는 그대로 유지 (드릴다운 모달에서 사용).

---

## 5. Mock 데이터 생성 전략

### 이야기의 일관성 유지

4채널 숫자가 모든 섹션(①②③④⑤)에서 같은 이야기를 해야 함. 스토리:

> "Meta와 Apple은 포화됐고 시장보다 비싸다. Google은 여유 있고 저렴하다. TikTok은 중립. → Meta/Apple에서 Google로 재배분하면 +5% 매출."

### 일관된 mock 값 (tied together)

```
Meta:        포화 78% · mCPI $42 · 시장 $32 · 편차 +31% · 권고 -$30K
Google:      포화 21% · mCPI $18 · 시장 $22 · 편차 -18% · 권고 +$45K
TikTok:      포화 52% · mCPI $28 · 시장 $25 · 편차 +12% · 권고 유지
Apple:       포화 98% · mCPI $38 · 시장 $29 · 편차 +31% · 권고 -$15K

Portfolio:
  saturationWeighted = 0.66 (가중평균 검증 완료)
  
Reallocation:
  moves: Meta→Google $30K, Apple→Google $15K
  totalMoved: $45K
  expectedRevenueLift: $28K (월)
  expectedRevenueLiftPct: 5.4
  confidence: 0.78
```

기존 v1 Mock JSON의 currentSpend / marginal / benchmark 값과 정합. 단 responseCurve는 v1 그대로 유지(모달에서 사용).

---

## 6. Phase 2/3 영향

### Phase 2 (AppsFlyer Benchmarks 크롤러)
- 섹션 ④ 테이블의 `marketMedianCpi` 값을 mock → 크롤러 snapshot으로 교체
- 2×2 Quadrant의 y축 편차 값이 실제 시장 데이터 기반이 됨 → **진짜 적절성 판정 가능**

### Phase 3 (Python MMM 패키지)
- 섹션 ②의 `saturationWeighted` → PyMC-Marketing posterior에서 도출
- 섹션 ③의 `recommendation` → 옵티마이저 출력으로 교체
- 섹션 ⑤의 `reallocation.moves` + `expectedRevenueLift` → Bayesian 최적화 결과
- 드릴다운 모달의 Response Curve → 실학습된 posterior 밴드

v2 스키마는 이 모든 교체가 **TS 변경 없이** 가능하도록 설계됨 (source 필드 enum만 `mock-v2` → `pymc-marketing-v1`로 업데이트).

---

## 7. 구현 순서 (리팩토링 경로)

현재 구현(`0ed0e05`) 위에서 작업. 기존 코드를 **파괴하지 않고** 점진적으로 새 구조로 전환.

1. **스키마 v2 확장** — `mmm-data.ts` 필드 추가, mock JSON 확장, tests 업데이트
2. **신규 컴포넌트 5개 작성** — 섹션 ②~⑤ 순서대로 (TDD로 각 진행 가능)
3. **Page.tsx 전면 재조립** — 5섹션 순서로 교체
4. **구 `ResponseCurveGrid` 제거** — page에서 사라짐. `ResponseCurveCard`는 `ChannelDetailModal` 내부로 이동
5. **i18n 키 추가** — 약 30개
6. **검증** — tsc + lint + test + next build + 브라우저 확인

---

## 8. 검증 기준

### 빌드 타임
- tsc clean (src/ 0 에러)
- lint clean (MMM 신규 파일)
- node:test: mmm-data.test.ts 수정된 스키마 검증 (반복 가능)
- next build 성공, `/dashboard/mmm` Static prerendered

### 런타임 (브라우저)
- 5섹션 모두 렌더, 스크롤 흐름 자연스러움
- 섹션 ② 게이지가 가중 평균 66% 지점에 정확히 위치 (visual verify)
- 섹션 ③ 카드 클릭 → 드릴다운 모달 오픈 (ResponseCurve 재사용 확인)
- 섹션 ④ Quadrant의 4 dot이 각 사분면에 올바른 색/크기로 배치
- 섹션 ⑤ Before/After 바의 채널 색상이 Quadrant/Cards와 통일
- ko↔en 토글에 누락 키 없음

### 사용자 경험
- "직관적 이해가 안된다" 해소 — Response Curve 없이도 섹션 ②③으로 Saturation 이해 가능
- "포화=단가 오른다" 명시적 연결 — 섹션 ④ 사분면 우상단 사분면 라벨이 "포화 + 비쌈"으로 직접 기술
- "채널별이 의미 있나" 해소 — 섹션 ②(전체) + ③(채널) + ⑤(재배분) 3층 구조로 스케일 선택 가능

---

## 9. 명시적 비 스코프

- **실시간 시뮬레이션**: 섹션 ⑤의 "적용" 버튼은 데모 전용 (실제 optimizer 없음, Phase 3)
- **Geo-level 분해**: 국가별 breakdown 없음
- **Creative-level 분해**: 광고 소재별 없음
- **다게임 지원**: portfolio vs match-league 전환 없음 (v2는 match-league 고정)
- **User input**: 사용자가 spend 수치를 직접 조정하는 스라이더 없음 (Phase 4+)

---

## 10. 의존 관계

- v1 스펙 (`2026-04-24-mmm-dashboard-design.md`)은 **historical reference**로 유지. Supersede 관계.
- v1 커밋(`0ed0e05`)은 **롤백하지 않음** — 리팩토링 베이스. Git history 보존.
- 브랜치: `feat/mmm-dashboard` 계속 사용.

---

## Appendix A: 사용자 피드백 요약 (의사결정 트레일)

| 피드백 | 설계 반영 |
|--------|-----------|
| "직관적이지 않다" | Response Curve를 페이지 표면에서 제거, 드릴다운으로 이동 |
| "반포화점 라벨 겹침" | v2에서 Response Curve는 모달(큰 공간)에서만 렌더 → 해결 |
| "포화=단가 오른다?" 불명확 | 섹션 ④ 2×2 Quadrant에서 "포화 × CPI 편차" 직접 시각화 |
| "mock 의미 없어 보인다" | mock 값을 **하나의 스토리**(Meta/Apple 포화 → Google로)로 정합화 |
| "채널별 의미 있나" | ②(전체) ③(채널) ⑤(재배분) 3층 구조로 스케일 선택권 부여 |
| "(c) 쇼케이스 원함" | 2×2 Quadrant를 hero 시각화로 배치. 기술력 + 미관 쇼케이스 |
| "하단 메뉴로 빼도 된다" | 섹션 ④⑤를 하단에 배치. 상단 3섹션이 1차 의사결정 완결 |

## Appendix B: v1과의 차이점 요약

| 항목 | v1 | v2 |
|------|-----|-----|
| Hero 차트 | Response Curve 2×2 | Saturation Meter + Status Cards |
| S-커브 위치 | 페이지 표면 (4개) | 드릴다운 모달 (1개) |
| CPI Benchmark | 카드 내 숫자 1개 | 전용 섹션 (④) + 2×2 Quadrant + 테이블 |
| Reallocation | 없음 (Phase 3) | Phase 1 포함 (precomputed) |
| Portfolio 판정 | DecisionStoryCard만 | DecisionStoryCard + 가중 포화 게이지 |
| 섹션 수 | 2 (Verdict + Grid) | 5 |
| 페이지 높이 | 짧음 (1-2 스크롤) | 길음 (3-4 스크롤) |
| 복잡도 | 중 | 중+ (2×2 Quadrant가 추가 작업) |
