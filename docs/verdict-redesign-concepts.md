# Verdict Redesign — 3개 컨셉

**맥락**: `docs/top-card-research.md`의 벤치마크(Toss 중심)와 `docs/wording-glossary.md`의 용어 재매핑을 바탕으로 `/dashboard` 최상단 카드(OverviewSummaryStrip + PortfolioVerdict)의 3가지 재설계 옵션 제시.

**평가 기준**:
- **이해도** (5초 테스트 통과율)
- **정보 밀도** (한 화면에 얼마나 많이)
- **gameboard 톤 적합성** (casual + 전문)
- **구현 비용** (기존 컴포넌트 재활용 정도)

---

## Concept α — "Toss Story Card" (추천)

Toss 자산 홈 패턴을 그대로 차용. **스토리 + 이모지 + 단일 CTA**.

### 레이아웃

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   🚀  지금 포코머지 글로벌에 예산을 더 투입하세요              │
│                                                            │
│   1년 내 매출 12억 원이 더 붙을 신호예요                       │
│   ↳ 10번 중 8번은 맞을 근거입니다 (신뢰도 78%)                │
│                                                            │
│   ┌──────────────┬──────────────┬──────────────┐           │
│   │ 광고비 회수   │ 성장 속도     │ 경쟁 위치     │           │
│   │ 148%        │ +6.2%p/월    │ 장르 3위      │           │
│   │ ↗ 지난달 +6% │ ↗ 가속 중    │ ↗ 2계단 상승  │           │
│   └──────────────┴──────────────┴──────────────┘           │
│                                                            │
│                              [재배분 플랜 보기 →]           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 스펙

- **컨테이너**: `rounded-2xl` · `p-8` · `bg-card` · `border-l-4 border-success` (좌측 accent)
- **이모지 + Hero 문장**: `text-2xl font-bold` + 🚀 이모지 inline
- **Sub-reason**: `text-sm text-muted-foreground` (근거 + 신뢰도)
- **3-metric grid**: 작은 divider 구분, 각 4열 셀 안에 label / value / trend
- **CTA**: `primary` button bottom-right, 아이콘 오른쪽 화살표

### 데이터 매핑 (기존 mock → 신규 카드)

| 카드 요소 | 데이터 소스 |
|-----------|-------------|
| 이모지 | status에 따라 🚀(invest) / ⚠️(hold) / 🚨(reduce) |
| Hero 문장 | `mockPortfolioSignal.recommendation.ko` (평이어 버전) |
| 1년 매출 예측 | `mockPortfolioSignal.impact.value` (원화 환산) |
| 신뢰도 | `mockPortfolioSignal.confidence` |
| 광고비 회수 | `mockPortfolioKPIs.blendedRoas` |
| 성장 속도 | 월별 성장률 계산 (사내 fresh 지표) |
| 경쟁 위치 | `mockMarketHero.rank` |
| CTA | 재배분 페이지 링크 (현재 없음 — 향후 구현) |

### 장점
- ✅ Toss 패턴 직접 매칭 — 사내 이해도 즉시 상승
- ✅ 단일 hero + 3개 보조 = 최적 정보 밀도
- ✅ 이모지로 감정 태깅 — "지금 좋은 상황"이 3초 안에 전달
- ✅ Status 색은 border-left 4px로 과하지 않게 신호

### 단점
- ⚠️ Payback 구간(P10/P50/P90)을 표시하지 않음 → 통계 신뢰 느낌 감소
- ⚠️ Status 색이 약함 (border-left 4px만) — 경영진이 "빨강/초록" 즉시 구분 어려울 수 있음

### 구현 비용
**중간** — 신규 컴포넌트 `<DecisionStoryCard />` 1개 필요. 기존 `OverviewSummaryStrip` 완전 교체, `PortfolioVerdict` 단순화.

---

## Concept β — "Linear Status Strip + Narrative"

Linear의 status 리스트 패턴 + Notion의 narrative summary.

### 레이아웃

```
┌────────────────────────────────────────────────────────────┐
│  ●초록  [확대]  포트폴리오는 성장 궤도에 있어요                │
│  ────────────────────────────────────────────              │
│  📊 이번 주 요약                                             │
│  • 🟢 포코머지 글로벌 — 투자 확대 (ROAS 148%, 월 성장 +6%)     │
│  • 🟡 포코머지 일본 — 관망 (수익화 실험 필요)                  │
│  • 🔴 포코머지 국내 — 축소 권고 (UA 효율 72%)                  │
│  ────────────────────────────────────────────              │
│  💬 다음 액션                                                │
│  포코머지 글로벌에 UA 예산 60%를 재배분하세요.                 │
│  예상 효과: +12억원 연 매출 (신뢰도 78%)                     │
│                                                            │
│                              [확대 실행하기 →]             │
└────────────────────────────────────────────────────────────┘
```

### 스펙

- **상단 상태 헤더**: `rounded-full bg-success/10 p-2 px-4` — 한 줄
- **섹션 1: 이번 주 요약**: 3개 지역 불릿 리스트, 각 상태 색 dot + 한 문장
- **섹션 2: 다음 액션**: narrative paragraph + 예상 효과
- **CTA**: 하단 우측, 강한 primary 버튼

### 장점
- ✅ 3개 지역(포코머지 글로벌/일본/국내) 한눈에 비교 — portfolio 서사 강함
- ✅ 상태 dot color로 즉시 인식
- ✅ narrative → 비전문가가 읽어도 이해

### 단점
- ⚠️ 숫자 밀도 낮음 (strip 없음) — 분석가 입장에선 부족할 수 있음
- ⚠️ 상단 높이 ↑ (5-6줄) — fold 아래로 다른 요소 밀림

### 구현 비용
**낮음** — 기존 `PortfolioVerdict`의 evidence 영역 확장. `OverviewSummaryStrip` 그대로 유지 (카드 아래 배치).

---

## Concept γ — "Stripe Headline + Sparkline"

Stripe Dashboard의 top metric 패턴. **최소 정보 + 최대 임팩트**.

### 레이아웃

```
┌────────────────────────────────────────────────────────────┐
│  자본이 27% 불어났어요              🟢 지금 늘려라             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━         │
│  1.27x                                                     │
│  Portfolio MOIC                                            │
│                                                            │
│  ╱╲    ╱╲╱  ← 6개월 sparkline                               │
│                                                            │
│  지난 달 대비 +0.08x · 신뢰도 78%                            │
│  ────────────────────────────────────────────              │
│  💡 포코머지 글로벌이 성장을 견인 — UA 60% 재배분 권장         │
└────────────────────────────────────────────────────────────┘
```

### 스펙

- **1st row**: 평이어 hero 문장 + status 뱃지 (우측)
- **2nd row**: 거대한 숫자(`text-6xl font-bold`) + 작은 라벨
- **3rd row**: sparkline (높이 40px) 시계열 — visx line chart
- **4th row**: delta + 신뢰도 한 줄
- **5th row**: 구분선 후 권고 한 문장 (💡)

### 장점
- ✅ 가장 간결 — Stripe 경험자에게 친숙
- ✅ Hero 숫자 1개 집중 — "27%"라는 단일 수치 기억에 남음
- ✅ Sparkline이 트렌드 직관화

### 단점
- ⚠️ 3개 지역 breakdown 없음 — portfolio 서사 부족
- ⚠️ hero가 MOIC 단일 — ROAS/런웨이 같은 다른 축 정보 보려면 스크롤

### 구현 비용
**높음** — 신규 컴포넌트 전체 설계. sparkline 위젯 신규 작성 (visx). 기존 PortfolioVerdict 폐기.

---

## 비교 매트릭스

| 기준 | α (Toss Story) | β (Linear Strip) | γ (Stripe Headline) |
|------|---------------|------------------|---------------------|
| 이해도 (비전문가) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| 정보 밀도 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| gameboard 톤 적합성 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| 3-region 서사 | ⭐⭐⭐ (요약) | ⭐⭐⭐⭐⭐ | ⭐ |
| 구현 비용 | 중 | 낮 | 높 |
| 모바일 적합성 | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 경영진 어필 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## 권장: **Concept α (Toss Story Card)**

**이유**:
1. 사내 이해도를 최우선 목표로 본다면 Toss 패턴의 감정 태깅 + 평이어 + 3-supporting-metric 공식이 가장 효과적
2. Compass의 "Decision OS" 포지셔닝과 Toss "money OS" 느낌이 유사 — 브랜드 톤 공명
3. 이모지(🚀/⚠️/🚨)는 Tossface 이미 설치됨 (Phase 1에서 포함)
4. 3-region 서사는 α 카드 아래 기존 TitleHeatmap 위젯이 이어받아서 drill-down 제공

**혼합안 제안**:
α 베이스 + β의 3-region 불릿을 "자세히 보기" 클릭 시 인라인 확장 → progressive disclosure.

---

## 다음 단계

1. **사용자 선택**: α / β / γ / α+β 혼합 중 선택
2. **low-fi mockup 작성** (선택 후) — Figma 또는 코드 sketch
3. **사내 5초 테스트** (비전문가 3-5명 대상)
4. **구현** — 선택된 컨셉 기준 `<DecisionCard />` 신규 컴포넌트 작성
5. **A/B 전환 준비** (선택사항) — 기존 버전과 신규 버전을 flag로 스위칭

---

## 구현 체크리스트 (α 기준 예시)

- [ ] `<DecisionStoryCard />` 컴포넌트 생성 (`src/widgets/dashboard/ui/`)
- [ ] 평이어 copy 적용 (`docs/wording-glossary.md` 참조)
- [ ] 이모지 태깅 로직 (status → emoji mapping)
- [ ] 3-metric grid 서브컴포넌트 (`<MetricPill />`)
- [ ] status color accent (border-left 4px)
- [ ] CTA 링크 (재배분 페이지 — 신규 라우트 `/dashboard/rebalance` 또는 modal)
- [ ] `OverviewSummaryStrip` deprecation (or integrate into new card)
- [ ] `PortfolioVerdict` deprecation (or simplify)
- [ ] page.tsx 업데이트
- [ ] 빌드 검증
- [ ] 사내 리뷰 세션
