# Analysis Asset Absorption — Design

**Date:** 2026-05-02
**Status:** Approved (Mike)
**Author:** Claude (brainstormed with Mike)
**Predecessor specs:**
- `2026-04-29-vc-simulator-product-pivot-design.md` (관찰형 → 조작형 pivot 선언)
- `2026-04-24-vc-simulation-design.md` (VC sim 컴포넌트·스키마 원형)
- `2026-04-30-diligence-menu-design.md`
- `2026-04-30-portfolio-menu-design.md`

---

## 1. Why — pivot의 미완성 부분 마무리

`2026-04-29` pivot은 "Compass = 조작형 시뮬레이터" 정체성 선언과 IA(사이드바 2개 메뉴) 정리까지 끝냈다. 그러나 **자산 분류**(어느 코드가 어느 정체성에 속하는가)가 누락되어, 이후 1주일간 Tier 1 sweep으로 분석성 페이지 5개(`capital`, `cohort`, `marketing-sim`, `diligence`, `portfolio`)가 추가되며 정체성이 다시 흐려졌다.

본 spec은 **별도 분석 프로젝트로 분리하지 않고**, 모든 분석 자산을 VC 시뮬레이터의 내부 부품으로 흡수(absorb)하여 한 덩어리 코드베이스를 정합적으로 만든다.

### 핵심 결정

> **회사 실무 투자 판단에는 통계적 정밀도가 ROI를 만들지 않는다.**

Compass는 *직관적이고 빠른* 시뮬레이터로 충분하다. 학술적 엄밀성(베이지안 정밀도, 시장 prior 추정, MMM의 인과 추론 등)은 별도 분석 프로젝트의 영역이며, 그 프로젝트는 **만들지 않는다**(현재 시점). 미래에 필요해지면 본 코드베이스에서 cherry-pick하여 시작 가능.

### 한 문장 정의

> **Project Compass = VC 시뮬레이터에 자사 데이터와 시장 데이터를 같이 보여주는 정도.**
> Pollen VC식 단순 cash flow 시뮬 수준. 정교한 분석(MMM, Diligence, Capital, PRISM 등)은 시뮬의 부품으로도 흡수하지 않고 dormant 처리한다. 미래에 별도 분석 프로젝트가 필요해지면 그때 cherry-pick.

### 단순화 원칙

시뮬 본체에 살아있는 것은 4가지뿐:
1. **자사 베이스라인** — AppsFlyer 실측 + LSTM forecast
2. **시장 비교** — Sensor Tower raw percentile (토글 ON 시 overlay)
3. **자사 retention** — cohort strip (가정값 disclosure 안)
4. **시뮬 슬라이더 + 결과 보드** — Hero Decision Sentence + KPI Delta + Cumulative ROAS + Runway

그 외 모든 분석성 페이지/엔진은 코드 보존(dormant), 어디서도 mount/import 안 함.

---

## 2. Out of Scope

- **별도 분석 프로젝트 부트스트랩** — 만들지 않음. 미래에 필요해지면 그때 결정.
- **24개 차트 코드 변경** — 모든 차트 컴포넌트는 보존. mount 위치만 시뮬 안으로 재배선.
- **데이터 파이프라인 변경** — AppsFlyer / LSTM / Sensor Tower / CPI 크롤러 모두 그대로.
- **PRISM × LTV 통합** — 다음 챕터에서 시뮬 입력으로 흡수 예정. 본 라운드는 페이지 hidden만.
- **베이지안 엔진 삭제** — 코드 보존(dormant). import만 제거.

---

## 3. 흡수 매핑

### 3.1 UI 표면 (페이지 → 시뮬 내부 영역)

모든 라우트 코드는 보존. 사이드바 노출 hidden. **흡수 = 2개, dormant = 6개.**

| 분석 페이지 (현재) | 처리 | 시뮬 안 위치 | 진입점 |
|---|---|---|---|
| `/dashboard/market-gap` | **흡수** | 차트 위 시장 percentile overlay | TopBar "□ 시장과 비교" 토글 ON |
| `/dashboard/cohort` | **흡수** | 좌 "가정값 출처 ▸" 안 자사 retention strip | 좌측 disclosure 펼침 |
| `/dashboard/mmm` | **dormant** | 없음 (코드 보존, mount X) | — |
| `/dashboard/prism` | **dormant** | 없음 | — |
| `/dashboard/capital` | **dormant** | 없음 | — |
| `/dashboard/diligence` | **dormant** | 없음 | — |
| `/dashboard/marketing-sim` | **dormant** | 없음 | — |
| `/dashboard/portfolio` | **dormant** | 없음 | — |

### 3.2 백엔드/엔진 (시뮬의 재료)

**활성 = 3개, dormant = 3개.**

| 자산 | 처리 | 시뮬 안 역할 |
|---|---|---|
| **AppsFlyer 연동** (`src/shared/api/appsflyer/`) | **활성** | 자사 실측 데이터 — 시뮬 베이스라인 |
| **LSTM 파이프라인** (cron + retention/revenue forecast) | **활성** | 자사 forecast — 좌 INPUT 자동 채움 + P10/P50/P90 신뢰 구간 |
| **Sensor Tower 크롤러** (`crawler/`) | **활성** | 시장 raw percentile — 시장 비교 토글 데이터 소스 |
| **Bayesian engine** (`src/shared/lib/bayesian-stats/`, 9 files) | **dormant** | 없음. 미래 cherry-pick 가능성 |
| **PriorPosteriorChart** | **dormant** | 없음 |
| **CPI 벤치마크 크롤러** (`crawler/cpi-benchmarks/`) | **dormant** | MMM이 dormant이므로 같이 비활성. 데이터 snapshot만 보존 |

### 3.3 사이드바 최종 상태

```
◎ Dashboard            ← VC 시뮬레이터 (모든 분석 자산 흡수됨)
─────────────
⚙ Settings
  └ Connections        ← AppsFlyer 연동 관리
```

폭 160px. **메뉴 2개. 끝.**

기타 8개 라우트(`market-gap`, `mmm`, `prism`, `capital`, `cohort`, `marketing-sim`, `diligence`, `portfolio`)는 URL 살아있되 사이드바 hidden. `/dashboard/vc-simulation`은 `/dashboard`로 redirect.

---

## 4. Bayesian 처리 — 보존하되 비활성

### 결정

- **시뮬 신뢰 구간(P10/P50/P90)** = LSTM quantile forecast (이미 구현됨)
- **콜드 스타트 prior** = 불필요 (poco merge는 라이브 게임, 콜드 스타트 시나리오 없음)
- **시장 분포 시각화** = Sensor Tower raw percentile 직접 표시 (베이지안 추정 안 거침)
- **Bayesian engine 코드** = `src/shared/lib/bayesian-stats/` 9 files 그대로 보존, 어디서도 import 안 함

### 미래 cherry-pick 시나리오

별도 분석 프로젝트가 필요해질 때:
1. `src/shared/lib/bayesian-stats/` 통째로 새 repo로 이전
2. `PriorPosteriorChart`, `Market Gap` 페이지 코드 함께 이전
3. Sensor Tower 크롤러는 양쪽 repo에서 공유 (또는 데이터 snapshot만 공유)

지금은 그 시점이 아니므로 **결정만 명문화**하고 코드는 손대지 않는다.

---

## 5. Phase 로드맵

### Phase 1 (본 PR, docs-only)
- 본 spec 작성
- CLAUDE.md 정체성 재작성 + 7건 기술 스택 불일치 보정
- README.md 페이지 목록 정합성 보정
- 단일 PR로 묶음. 코드 변경 0줄.

### Phase 2 (1일, 사이드바 정리 + dormant 라우트 hidden)
- `src/shared/config/navigation.ts` 사이드바 항목 2개로 축소 (Dashboard + Connections)
- 8개 라우트 사이드바 hidden: `market-gap`, `cohort`, `mmm`, `prism`, `capital`, `diligence`, `marketing-sim`, `portfolio`
- `vc-simulation` → `/dashboard` redirect 확인

### Phase 3 (2~3일, 흡수 2건만)
- **시장 비교 토글** — TopBar "□ 시장과 비교" 토글 추가, ON 시 시뮬 차트 위 Sensor Tower percentile overlay (PriorPosteriorChart 사용 안 함, raw percentile 직접 그림)
- **자사 retention strip** — 좌 INPUT "가정값 출처 ▸" disclosure에 `cohort` 페이지의 retention strip 마운트
- 그 외 dormant 페이지(MMM/Capital/Diligence/PRISM/Marketing-sim/Portfolio)는 mount 작업 없음

### Phase 4 (검증)
- 사이드바 메뉴 = 2개 확인
- `market-gap`, `cohort` 2개 콘텐츠가 시뮬 안 진입점에서 도달 가능 확인
- dormant 6개 라우트는 직접 URL로만 도달 가능, 사이드바·드로어·탭에서 노출 0건 확인
- LSTM quantile이 P10/P50/P90 채우는지 시뮬 결과 차트에서 확인
- Bayesian engine 9 files + CPI 크롤러 + dormant 페이지들 모두 어디서도 import되지 않는지 grep 검증

---

## 6. 영향받는 파일

### Phase 1 (docs-only, 본 PR)
- `docs/superpowers/specs/2026-05-02-analysis-asset-absorption-design.md` (신규, 본 파일)
- `CLAUDE.md` (정체성 재작성 + 7건 보정)
- `README.md` (페이지 목록 정합성)

### Phase 2 (사이드바 정리)
- `src/shared/config/navigation.ts` (메뉴 2개로)
- `src/app/(dashboard)/dashboard/vc-simulation/page.tsx` (`/dashboard` redirect)

### Phase 3 (흡수 2건)
- 시뮬 화면(좌 INPUT + 우 RESULT) 컴포넌트 — TopBar 토글 추가 + retention strip mount 위치
- 정확한 파일은 Phase 3 시작 시 코드 탐색 후 결정 (현재 widgets/dashboard/ 구조 변동 가능성)

코드 변경은 모두 *재배선* 수준. 새 컴포넌트 작성 거의 없음.

---

## 7. 성공 기준

- [ ] 사이드바 메뉴 = 2개 (Dashboard + Connections)
- [ ] 시뮬 본체 = 자사 베이스라인 + 시장 비교 토글 + cohort retention strip만 활성
- [ ] dormant 자산(Bayesian/MMM/CPI/Capital/Diligence/PRISM/Marketing-sim/Portfolio) 모두 코드 보존, import 0건
- [ ] CLAUDE.md `About This Project` 섹션이 "VC 시뮬 + 자사 데이터 + 시장 비교" 정의로 시작
- [ ] Phase 1 PR 코드 변경 0줄 (docs only)

---

## 8. Open Questions (결정 보류)

- **시장 비교 데이터 형식**: Sensor Tower percentile을 P25/P50/P75 단순 라인으로 그릴지, fan chart로 그릴지 — Phase 3 시작 시 빠르게 판단.
- **dormant 페이지 정리 시점**: 코드 보존이 원칙이지만, 6개월 이상 mount 0건 + 의존성 충돌 발생 시 삭제 후보. 별도 결정으로 처리.

---

## 9. 결정 로그

- 2026-04-29: pivot 선언 (관찰 → 조작)
- 2026-04-30: Tier 1 sweep으로 분석 페이지 5개 추가 (PR #27, #29, #30) — 정체성 흐려짐
- 2026-05-02: 흡수 결정 (별도 프로젝트 X, 모두 시뮬 내부 부품으로) + Bayesian dormant 결정
