# VC Simulation — 투자 시뮬레이션 모듈 설계 스펙

| 항목 | 값 |
|---|---|
| 날짜 | 2026-04-24 |
| 브랜치 | `feat/vc-simulation` |
| Worktree | `../compass-worktrees/feature-vc-simulation/` |
| 관련 PR | (작성 후 생성 예정) |
| 상위 의존 | AppsFlyer Pull API v5 (PR #4), empirical-Bayes engine (PR #2), Sensor Tower crawler |
| 분리된 subsystem | LSTM 리텐션 예측 모델 (`feat/retention-lstm` — 별도 worktree 예정) |

---

## 1. 요약

Project Compass 에 **투자 시뮬레이션(VC Simulation)** 모듈을 추가한다. 사용자가 VC 오퍼의 주요 조건(투자금, 투자 후 기업가치, 목표 회수 배수, 최소 기대수익률, 자금 배분)을 입력하면, 선택된 게임의 MMP(AppsFlyer) 실적·장르 벤치마크·LSTM 리텐션 예측·Bayesian 실험 posterior 를 자동 결합하여 36개월 horizon 의 현금흐름·수익률 분포를 Monte Carlo 시뮬레이션으로 산출한다. 핵심 차별화는 **"실험 영향도와 이율의 배반(J-커브) 구조"** 를 Baseline ①(실험 없이)과 ②(실험 반영)를 동시에 렌더링하여 정직하게 드러내는 시각화 계층이다.

이 모듈은 Compass 의 의사결정 판정(Executive Overview 의 `PortfolioVerdict`) 레이어가 아니라, 그 **상류에 위치한 what-if 계산기** 로 설계된다. 판정 책임은 기존 모듈이 계속 담당하고, VC Simulation 은 그 입력이 되는 분포 지표를 생성한다.

---

## 2. 배경 및 문제 정의

### 2.1 현재 Compass 자산
- **Executive Overview** (`/dashboard`): 포트폴리오 · 단일 게임 투자 판정 (`PortfolioVerdict`, `KPICards`)
- **Market Gap** (`/dashboard/market-gap`): Bayesian 사전/사후 확률로 시장 대비 포지셔닝
- 기존 `ScenarioSimulator` 컴포넌트 (73줄) — UA budget × target ROAS 기반 단순 배수 계산. `computeScenario(uaBudget, targetRoas)` 가 payback / BEP probability / monthly revenue 를 반환
- 기존 `RunwayFanChart` — Monte Carlo P10/P50/P90 캐시 런웨이 팬 차트 (visx 기반, 283줄)

### 2.2 빈 자리
1. **VC 오퍼 조건을 입력받아 수익률을 역산하는 도구가 없음** — 기존 ScenarioSimulator 는 운영 관점(UA/ROAS) 만, 투자자 관점(투자금/밸류에이션/exit multiple) 부재
2. **실험 성과가 투자 이율에 미치는 영향** 을 시각화하는 레이어 부재 — 실험은 성공하면 LTV ↑ 지만 실험 기간에는 비용 소요 → 두 효과가 반대로 움직이는 J-커브가 어디에도 안 드러남
3. **LSTM 리텐션 예측** 결과를 Compass 로 가져오는 계약(JSON 스키마·Zod 검증·fallback) 미정

### 2.3 기대 효과
- VC 오퍼를 받았을 때 "이 조건을 수용하면 36개월 후 IRR/MOIC 가 어떻게 될까" 를 슬라이더 조작만으로 탐색 가능
- 실험에 투자하는 비용이 장기 이율 개선에 얼마만큼 기여하는지 **정량적으로 분리 표시** → 실험 예산 방어 근거 생성
- LSTM 리텐션 모델의 출력이 Compass 에 자동 연동되는 snapshot 패턴 확립 — 이후 다른 ML 모델도 동일 패턴으로 붙이기 용이

---

## 3. 목표 / 비목표

### 3.1 목표 (MVP)
- [ ] `/dashboard/vc-simulation` 페이지 — 좌측 sticky 입력 패널 + 우측 3-section 결과
- [ ] 36개월 horizon(12~60 슬라이더) Monte Carlo 시뮬레이션, 2,000 sample
- [ ] Baseline ①(실험 없이)과 ②(실험 반영) 동시 렌더링, Gap 시각화
- [ ] 5 필수 입력 필드 + 자금 배분 슬라이더, 모두 한글 primary
- [ ] 3 프리셋 (보수적 · 표준 · 적극적) + AppsFlyer/MMM/Sensor Tower 로부터 Smart Default
- [ ] LSTM retention snapshot JSON 계약 (Zod 스키마 + fallback chain 3단) 확정 및 mock 파일 커밋
- [ ] AppSidebar 에 "투자 결정" / "시장 분석" 그룹 label 추가 (URL 구조 불변)
- [ ] `RunwayFanChart` 에 `overlay` optional prop 추가 (backward compatible)

### 3.2 비목표 (Phase 2 이후)
- [ ] 포트폴리오 레벨 시뮬레이션 (복수 게임 합산)
- [ ] 여러 VC 오퍼 동시 비교 (Google Sheets / Affinity CRM 연동)
- [ ] Liquidation preference · anti-dilution 등 term sheet 세부 조항
- [ ] Web Worker / Edge Function 으로 Monte Carlo offload
- [ ] KRW primary 통화 + 환율 토글
- [ ] Stress test / Sensitivity analysis / Tornado chart
- [ ] VC 관점 모드 (외부 투자자가 대상 회사 평가하는 데모용 view)

---

## 4. 확정 결정 로그 (Brainstorming 결과)

| # | 결정 | 근거 |
|---|---|---|
| 1 | 평가 단위 = 드롭다운 선택 단일 게임 | `useSelectedGame` Zustand 재사용, AppsFlyer snapshot 이 게임별 분리. 게임명 하드코딩 금지 |
| 2 | 역할 = what-if 계산기 (투자 판정 X) | 판정은 Executive Overview 담당 — 중복 제거 |
| 3 | 실험-이율 배반 = Baseline ① vs ② + J-커브 Gap | Compass 의 Bayesian 실험 플랫폼 강점 활용, "uncertainty-honest" 원칙 부합 |
| 4 | 시간 horizon = 36개월 기본, 12~60 슬라이더 | Series A ~ next round 표준 간격, LSTM 신뢰구간 상한선 |
| 5 | 입력 폼 = 5 필수 + 자금 배분 슬라이더, 한글 primary | Pollen VC 벤치마크 호환, 인지 부하 한계선 |
| 6 | 자동 연결 = Smart Default + 3 프리셋 | 실데이터 prefill + 사용자 미세 조정 패턴 |
| 7 | 페이지 레이아웃 = 좌측 sticky 입력 + 우측 3-section 결과 | 금융 도구 표준(Bloomberg Terminal) |
| 8 | 네비 = URL flat + Sidebar "투자 결정" / "시장 분석" 그룹 | IA 논리 + 기존 라우트 churn 회피 |

---

## 5. 아키텍처

### 5.1 3계층 구조

```
Tier 3 · UI    /dashboard/vc-simulation/page.tsx
                좌측: <VcInputPanel/>   우측: <VcResultBoard/>

Tier 2 · Compute   src/shared/api/vc-simulation/
                    defaults.ts · prefill.ts · types.ts
                    compute.ts · use-vc-sim.ts

Tier 1 · Data (읽기 전용)
                    readSnapshot()         [AppsFlyer]
                    priorByGenre           [Sensor Tower]
                    mmmSnapshot            [MMM]
                    lstmSnapshot           [LSTM, 신규 계약]
                    bayesianPosterior      [empirical-Bayes, PR #2]
```

### 5.2 핵심 설계 원칙
- **Read-only on existing data**: 기존 snapshot 파일에 쓰기 작업 없음 → 다른 feature PR 과 충돌 0
- **Pure function Monte Carlo**: `compute.ts` 는 side-effect 없음, 동일 input → 동일 output (seeded RNG)
- **Interface-first with LSTM worktree**: JSON 스키마 한 파일로 양쪽 독립 개발
- **i18n first**: 모든 label 은 `src/shared/i18n/dictionary.ts` 경유

### 5.3 기존 코드 변경 범위

| 파일 | 변경 유형 | 비고 |
|---|---|---|
| `src/widgets/charts/ui/runway-fan-chart.tsx` | **확장** | optional `overlay` prop 추가, 기존 호출처 영향 없음 |
| `src/widgets/sidebar/app-sidebar.tsx` | **리팩토링** | nav 배열에 group label 2개 추가 |
| `src/shared/i18n/dictionary.ts` | **추가** | `vc.*`, `nav.group.*` 키 ~30개 |
| `src/app/(dashboard)/dashboard/vc-simulation/page.tsx` | **신규** | 페이지 shell |
| `src/widgets/vc-simulation/` | **신규** | InputPanel, ResultBoard, 서브 컴포넌트 |
| `src/shared/api/vc-simulation/` | **신규** | compute / prefill / types / hook |
| `src/shared/api/data/lstm/retention-snapshot.json` | **신규** | mock placeholder, LSTM worktree 에서 실값으로 대체 |

---

## 6. 컴포넌트 구성

### 6.1 트리

```
VCSimulationPage
├─ <VcInputPanel/>                       [좌측 sticky 360px]
│   ├─ <PresetTabs/>
│   ├─ <OfferFields/>
│   ├─ <FundAllocationSlider/>
│   ├─ <HorizonSlider/>
│   └─ <DerivedStats/>                   VC 지분율 자동 계산
│
└─ <VcResultBoard/>                      [우측 scrollable]
    ├─ <VcKpiStrip/>                     4 판단 지표
    ├─ <DualBaselineRunwayChart/>        확장된 RunwayFanChart
    ├─ <IrrHistogramPair/>               IRR 분포 side-by-side
    └─ <JCurveStrip/>                    월별 실험 기여분 bar
```

### 6.2 컴포넌트 책임

| 컴포넌트 | 책임 |
|---|---|
| `VCSimulationPage` | 페이지 shell, `useVcSimulation` 훅 호출, 좌우 layout |
| `VcInputPanel` | offer 수집, URL state 로 persist |
| `PresetTabs` | 3 프리셋 선택 → offer 덮어쓰기 |
| `OfferFields` | 4 필드 input (투자금 · 투자 후 가치 · 회수 배수 · 최소 기대수익률) |
| `FundAllocationSlider` | UA ↔ 개발·운영 분배, AppsFlyer 비율로 prefill |
| `HorizonSlider` | 평가 기간 12~60 |
| `DerivedStats` | `지분율 = 투자금 ÷ 투자 후 기업가치` 즉시 계산 표시 |
| `VcKpiStrip` | 연환산 수익률 / 투자 배수 / 원금 회수 기간 / J-커브 회복 시점 카드 |
| `DualBaselineRunwayChart` | 기존 `RunwayFanChart` 의 확장 — `overlay` prop 추가 |
| `IrrHistogramPair` | visx `BarStack` 기반, ~40줄 |
| `JCurveStrip` | Recharts `ComposedChart`, break-even 월 하이라이트, ~60줄 |

### 6.3 `RunwayFanChart` 확장 (backward compatible)

```ts
type Props = {
  data: RunwayFanData                              // Baseline ① (solid, required)
  overlay?: { data: RunwayFanData; dashed: true }  // Baseline ② (optional)
  hurdleLine?: number                              // hurdle rate horizontal line
  title: string
  locale: "ko" | "en"
  height?: number
}
```

- `overlay` 가 `undefined` 면 기존 동작 그대로
- overlay 가 있으면 조건부로 `<LinePath strokeDasharray="4 4"/>` 한 블록 추가

### 6.4 기존 Compass 컴포넌트 의존
- `<Card/>`, `<Button/>`, `<Tooltip/>`, `<Badge/>` — `src/shared/ui/`
- `<ChartHeader/>`, `<ChartTooltip/>`, `<ExpandButton/>` — 통일 차트 UX
- `<PageTransition/>`, `<FadeInUp/>` — 페이지 진입 애니메이션
- `<MethodologyModal/>` — 계산 방법론 설명 모달

### 6.5 상태 관리
- **URL query state**: offer + preset → 링크 공유로 재현 가능
- **Zustand**: `useSelectedGame` 만 (기존 전역 스토어)
- **React memo**: `useVcSimulation` 내부 Monte Carlo 결과를 `useMemo` 로 캐시

---

## 7. 데이터 흐름

### 7.1 상호작용 체인
```
① 사용자: 게임 드롭다운 선택
② useSelectedGame() → gameId
③ useVcSimulation(gameId) 훅
④ 병렬 로드 (read-only):
   readSnapshot() · priorByGenre · mmmSnapshot · lstmSnapshot · bayesianPosterior
⑤ prefill() 이 5개 소스에서 default offer 생성 (or 사용자 덮어쓰기)
⑥ compute(offer, sources) — Monte Carlo 2,000회
   Baseline ①: lstm prior + historical CAC
   Baseline ②: lstm prior × (1 + bayesian Δ) + 실험 비용 차감
⑦ VcSimResult → 우측 3-section 렌더
```

### 7.2 LSTM 계약 JSON 스키마

**경로**: `src/shared/api/data/lstm/retention-snapshot.json`

```json
{
  "schema_version": "1.0",
  "generated_at": "2026-04-24T00:00:00Z",
  "model": {
    "name": "retention-lstm",
    "version": "v1",
    "trained_at": "2026-04-20T00:00:00Z",
    "hyperparameters": {
      "lookback_days": 90,
      "forecast_horizon_days": 1095,
      "sample_count": 10000,
      "confidence_interval": 0.80
    }
  },
  "predictions": {
    "<game_id>": {
      "game_id": "string",
      "genre": "string",
      "points": [
        { "day": 1,    "p10": 0.22, "p50": 0.35, "p90": 0.42 },
        { "day": 7,    "p10": 0.15, "p50": 0.22, "p90": 0.30 },
        { "day": 30,   "p10": 0.08, "p50": 0.14, "p90": 0.21 },
        { "day": 180,  "p10": 0.03, "p50": 0.06, "p90": 0.10 },
        { "day": 1095, "p10": 0.005,"p50": 0.01, "p90": 0.02 }
      ]
    }
  },
  "notes": "Optional — 모델 한계·데이터 컷오프 등"
}
```

**필수 샘플링 지점**: `day` ∈ {1, 3, 7, 14, 30, 60, 90, 180, 365, 730, 1095} (총 11개 이상). 사이 값은 Compass 쪽에서 monotone interpolation.

### 7.3 Zod 스키마 (`src/shared/api/vc-simulation/types.ts`)

```ts
const LstmPointSchema = z.object({
  day: z.number().int().positive().max(1095),
  p10: z.number().min(0).max(1),
  p50: z.number().min(0).max(1),
  p90: z.number().min(0).max(1),
})

const LstmSnapshotSchema = z.object({
  schema_version: z.literal("1.0"),
  generated_at: z.string().datetime(),
  model: z.object({
    name: z.string(),
    version: z.string(),
    trained_at: z.string().datetime(),
    hyperparameters: z.object({
      lookback_days: z.number().positive(),
      forecast_horizon_days: z.number().positive(),
      sample_count: z.number().int().positive(),
      confidence_interval: z.number().min(0).max(1),
    }),
  }),
  predictions: z.record(
    z.object({
      game_id: z.string(),
      genre: z.string(),
      points: z.array(LstmPointSchema).min(11),
    })
  ),
  notes: z.string().optional(),
})

export type LstmSnapshot = z.infer<typeof LstmSnapshotSchema>
```

### 7.4 Fallback chain (게임 X 의 리텐션 커브)
```
① lstmSnapshot.predictions[gameId]       ← 가장 신선·정확
       ↓ (없거나 검증 실패)
② priorByGenre(game.genre).retention     ← Sensor Tower prior
       ↓ (없으면)
③ 하드코딩 default (장르별 글로벌 평균)
```

각 계층 전환 시 UI 상단에 배지:
- `실데이터` (초록, `--signal-positive`)
- `장르 벤치마크` (노랑, `--signal-caution`)
- `기본 추정` (회색, `--signal-pending`)

### 7.5 Monte Carlo 수식

월 t 의 현금흐름:
```
users_t      = install_t  × retention_lstm(t, percentile)
revenue_t    = users_t    × arpu(t)  × currency
cost_t       = ua_spend_t + dev_ops_cost_t + experiment_cost_t   (② only)
net_t        = revenue_t − cost_t
cumulative_t = Σ net_0..t + initialCash + investmentAmount  (t=0 에 주입)
```

2,000 sample × 36개월 (+ offset) → `RunwayPoint[]` 의 P10/P50/P90 생성.

IRR: Newton-Raphson 수렴 (max 50 iter, tol 1e-6)
MOIC: `exit_month_value × equity% / investmentAmount`

### 7.6 Seed 관리 (deterministic)
```ts
const seed = hash(gameId + JSON.stringify(offer))
const rng = seedrandom(seed)
```
→ 같은 offer 는 같은 결과. 테스트·링크 재현 보장.

### 7.7 자동 연결 매트릭스

| 필드 | 출처 | 구현 |
|---|---|---|
| 투자금 | VC term sheet (비공개) | 수동 입력 필수 |
| 투자 후 기업가치 | 업계 벤치마크 suggest | prefill hint only |
| 목표 회수 배수 | VC fund 전략 상수 | default 3.0× |
| 최소 기대수익률 | 업계 표준 | default 20% |
| 자금 배분 UA/개발 | AppsFlyer 최근 90일 cost 비율 | **자동 derive (핵심 레버)** |
| 초기 현금잔고 | AppsFlyer cumulative cash position | 자동 |
| 장르 CAC/LTV | Sensor Tower `priorByGenre` | 자동 |
| 리텐션 P10/P50/P90 | LSTM snapshot | 자동 (fallback chain) |
| 실험 Δ LTV 분포 | Bayesian posterior (PR #2) | 자동 |

---

## 8. 에러 처리

### 8.1 Failure mode 와 대응

| 상황 | 감지 | 대응 | UI |
|---|---|---|---|
| LSTM snapshot 파일 없음 | import 실패 or parse 실패 | fallback chain ② | 배지 "장르 벤치마크" |
| Snapshot Zod 검증 실패 | `safeParse().success === false` | console.error + fallback ③ | 배지 "기본 추정" + 개발자 로그 |
| Snapshot 30일 이상 stale | `isLstmStale(generated_at)` | 계속 소비 (강제 차단 X) | 경고 배지 "모델 업데이트 필요" |
| AppsFlyer snapshot 없음 | `readSnapshot()` null | default 사용 | 배지 "샘플 데이터" |
| Monte Carlo NaN/Inf | 결과 `Number.isFinite` 체크 | 이전 결과 유지 + toast | `<ErrorBoundary/>` "계산 실패" |
| Offer 음수/극값 | Zod `OfferSchema` form validation | 빨간 테두리 + 메시지 | 제출 차단 |
| IRR 수렴 실패 | Newton-Raphson max iter 도달 | "수렴 불가" | KPI 카드 "—" + Tooltip |
| J-커브 회복 시점 부재 (전 기간 양수) | Gap 배열 최솟값 ≥ 0 | "해당 없음" 표기 + 원인 설명 | KPI 카드 "해당 없음" + Tooltip "실험 비용이 초기부터 상쇄됨" |
| J-커브 회복 시점 부재 (전 기간 음수) | Gap 배열 최댓값 ≤ 0 | 경고 수준 배지 | KPI 카드 "회복 없음" (경고색) |

### 8.2 원칙
- **조용히 실패하지 않기**: 모든 fallback 은 UI 배지로 데이터 출처 명시 (`uncertainty-honest`)
- **차단 vs 계속**: stale/missing = 계속 (정보는 주는 게 낫다), malformed/infinite = 차단 (잘못된 숫자는 안 보이는 게 낫다)
- **사용자 입력 에러 ≠ 시스템 에러**: offer 검증은 form 메시지, 시스템 에러는 ErrorBoundary 격리

### 8.3 ErrorBoundary 배치
```
<VCSimulationPage>
  <VcInputPanel/>    ← boundary 밖 (input 은 항상 조작 가능)
  <ErrorBoundary fallback={<CalcErrorCard/>}>
    <VcResultBoard/>
  </ErrorBoundary>
</VCSimulationPage>
```

---

## 9. 테스트 전략

### 9.1 피라미드

| 레벨 | 도구 | 파일 |
|---|---|---|
| Unit | Vitest | `__tests__/compute.test.ts`, `prefill.test.ts` |
| 컴포넌트 | Vitest + RTL | `__tests__/vc-input-panel.test.tsx` 등 |
| 계약 | Vitest | `__tests__/lstm-schema.test.ts` |
| E2E (선택) | Playwright | Phase 2 |

### 9.2 핵심 테스트 케이스

**compute.test.ts**:
- 같은 offer + sources → 같은 P50 IRR (deterministic)
- UA 비중 ↑ → 단기 payback ↓
- 실험 반영 baseline ② ≥ baseline ① (장기)
- J-커브: ② − ① 이 초기 음수 → 후반 양수

**prefill.test.ts**:
- AppsFlyer snapshot 없으면 default UA % 사용
- AppsFlyer snapshot 있으면 최근 90일 cost 비율 사용

**lstm-schema.test.ts**:
- points 10개 이하 → invalid
- 필수 필드 누락 → invalid
- schema_version mismatch → invalid

### 9.3 Fixture 관리 (`__tests__/fixtures/`)
- `offer.typical.json` · `offer.conservative.json` · `offer.aggressive.json`
- `lstm.valid.json` · `lstm.stale.json` · `lstm.malformed.json`
- `appsflyer.snapshot.json` (최근 90일 mock)

### 9.4 CI 통합
- Compass 하네스 (`precommit-gate.sh`) 가 `tsc + npm test` 자동 실행 → 커밋 차단
- 신규 script: `npm run test:vc` — VC simulation 전용 filter

### 9.5 커버리지 목표 (YAGNI)
- `compute.ts`: 90%+
- `prefill.ts`: 80%+
- 차트 컴포넌트: 시각 테스트 생략 (비용 대비 가치 낮음)
- `VcInputPanel` validation: 70%+

---

## 10. 구현 Phase

### Phase 1 — 기반 (1일)
- `src/shared/api/vc-simulation/` 디렉토리 + `types.ts` + Zod 스키마
- `src/shared/api/data/lstm/retention-snapshot.json` mock 커밋
- i18n dictionary `vc.*` 키 추가
- 테스트 fixture 3종

### Phase 2 — 계산 로직 (1-2일)
- `compute.ts` — Monte Carlo 루프 (seeded)
- `prefill.ts` — 5개 소스 fallback chain
- `defaults.ts` — 3 프리셋 상수
- `use-vc-sim.ts` — React hook
- `compute.test.ts` + `prefill.test.ts` — TDD

### Phase 3 — UI (2-3일)
- `VCSimulationPage` 페이지 shell
- `VcInputPanel` + 서브 컴포넌트 5개
- `VcResultBoard` + `VcKpiStrip`
- `RunwayFanChart` overlay prop 확장 + 기존 페이지 regression 확인

### Phase 4 — 시각화 (2일)
- `IrrHistogramPair` (visx)
- `JCurveStrip` (Recharts)
- Method ology modal 내용 작성

### Phase 5 — 통합 / 마무리 (1일)
- `AppSidebar` 그룹 label 추가
- 페이지 라우트 등록
- E2E 수동 QA (dev 서버 + 브라우저)
- README 업데이트

**총 예상**: ~8일 실작업 (1주 + α)

---

## 11. 리스크 / 미해결 항목

### 11.1 기술적
- **Monte Carlo 실시간 성능**: 2,000 sample × 36개월 이 메인 스레드에서 프레임 드랍 발생할 가능성. 대응 1: `useDeferredValue` + 150ms debounce. 대응 2: Phase 2 에 Web Worker 분리
- **IRR 수렴 실패율**: 현금흐름이 전부 음수인 극단 offer 에서 Newton-Raphson 실패. "수렴 불가" 표시로 대응하지만 사용자에겐 혼란 요인
- **LSTM 실값 연동 시점**: 이 MVP 는 mock 커밋으로 시작. 실값이 오기 전까지 P10/P50/P90 밴드가 대충 보이는 숫자로 나와 인상이 약할 수 있음

### 11.2 설계적
- **자금 배분 슬라이더의 의미론**: UA 60 / 개발 40 이 "월별 고정 비율" 인지 "총 기간 누적 비율" 인지 사용자 혼선 가능. Tooltip 으로 명시 필요
- **실험 비용 추정**: `ExperimentData` 에 `cost` 필드가 현재 mock-data 에 없음. Baseline ② 의 실험 비용 부분을 어떻게 투영할지 결정 필요 (기본값: 월별 UA budget 의 10%)
- **한글/영어 전환 시 숫자 포맷**: `1,234,567` 과 `$1.2M` 표기의 locale 간 일관성

### 11.3 결정 유보
- [ ] Monte Carlo sample 수: 2,000 으로 시작, 성능 측정 후 조정
- [ ] IRR 수렴 실패 시 fallback: "수렴 불가" 표시만 할지 vs "단순 ROI" 계산값 표시할지
- [ ] 프리셋 3개의 정확한 숫자 (보수적 $2M@$10M/2×/25% 가 업계 표준에 부합하는지 검증 필요)

---

## 12. 관련 문서
- `docs/superpowers/specs/2026-04-20-appsflyer-api-pipeline-design.md` — AppsFlyer Pull API 통합
- `docs/superpowers/specs/2026-04-20-sensortower-crawler-design.md` — Sensor Tower prior 데이터
- `docs/superpowers/specs/2026-04-21-bayesian-stats-engine-design.md` — Bayesian 실험 분석 엔진
- `docs/superpowers/specs/2026-04-24-compass-harness-design.md` — 하네스 (precommit-gate, postpr-enrich, session-brief)

## 13. 관련 외부 참조
- Pollen VC "LTV & Cash Flow Calculator" — https://pollen.vc/ (벤치마크 input 세트 참고)
- AppsFlyer Pull API v5 공식 문서
- visx `BarStack` · Recharts `ComposedChart` 공식 문서
