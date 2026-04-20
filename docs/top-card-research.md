# Top Card Research — Benchmarks & Pattern Extraction

**작성 일자**: 2026-04-20
**배경**: 현재 Compass `/dashboard` 최상단의 투자 판정 카드(PortfolioVerdict + OverviewSummaryStrip)의 사내 이해도가 낮음. "MOIC", "Payback P10/P50/P90", "Credible Interval", "Invest/Hold/Reduce" 등 금융·통계 전문용어가 그대로 노출되어 비전문가가 의사결정을 바로 내리기 어려운 상태.
**목표**: 누가 봐도 "지금 뭘 해야 하는지"를 3초 안에 이해할 수 있는 상단 카드 설계.

---

## 1. 현재 카드 진단

### 1.1 OverviewSummaryStrip (4칸 요약)

| 메트릭 | 현재 표기 | 이해도 문제 |
|--------|-----------|-------------|
| 런웨이 | `8.2개월 · ↗+0.5 현금 보유 기준` | "런웨이"라는 단어가 일상어 아님. "현금 몇 개월 남음"이 더 직관적 |
| Blended ROAS | `148% · ↗+6.2%p 전월 대비` | ROAS 자체가 광고 도메인 용어. "광고비 회수율"로 풀어야 |
| 판정 신뢰도 | `78% · ● 확대` | 베이지안 사후 확률을 단순히 "78%"로 표기 — 무엇에 대한 78%? |
| Portfolio MOIC | `1.27x · ↗+0.08x 누적 투자 배수` | VC 용어. "투자한 자본이 1.27배 됨"이 평이 |

### 1.2 PortfolioVerdict (결정 덱)

| 요소 | 현재 | 문제 |
|------|------|------|
| Status Badge | INVEST / HOLD / REDUCE | 영어 명령형. 한글 동사로 풀어야 ("지금 늘려라") |
| Confidence Bar | P10-P50-P90 credible interval | 통계학 용어. 독자가 "이 막대는 뭐지?" 의문 |
| Recommendation | 평이어 한 문장이지만 뒤에 $45K/월 같은 숫자 혼재 | 금액 단위 불일치 (달러/원화/월단위) |
| Impact Badge | +$1.2M ARR 예상 | ARR = Annual Recurring Revenue (SaaS 용어). 게임 산업에선 "연 매출" |

### 1.3 종합 진단

> **"숫자는 있지만, 다음 행동이 한눈에 잡히지 않음."**
>
> 회사 외부 투자자·경영진은 이 카드를 보고 "무슨 말인지" 번역이 필요. 이는 **Decision OS의 본질적 실패** — 결정을 돕는 UI가 결정을 어렵게 만듦.

---

## 2. Primary Benchmark — Toss

### 2.1 Toss가 "누구나 이해"를 달성한 핵심 원칙

Toss 홈 / 토스증권 / 토스뱅크 UX 분석에서 추출한 **8가지 원칙**:

| # | 원칙 | 예시 | Compass 적용 |
|---|------|------|--------------|
| 1 | **한 문장 hero** | "이번 달 20만원 덜 썼어요" | "이번 달 매출 12억원 더 들어와요" |
| 2 | **평이어 + 정량 보조** | "지난 주보다 **12%** 적게 썼어요" | "지난 달 대비 **ROAS +6%** 올랐어요" |
| 3 | **감정 태그**(Tossface) | "🎉 축하해요" / "📈 좋아요" | "🚀 확대 타이밍" / "⚠️ 주의" |
| 4 | **진행 바 시각화** | "목표까지 67%" | "12개월 런웨이 목표 / 현재 8.2개월 (68%)" |
| 5 | **단일 CTA** | "자세히 보기 →" | "재배분 플랜 보기 →" |
| 6 | **비교 프레임** | "나 vs 또래 평균" | "우리 vs 장르 평균" |
| 7 | **시간 단위 명시** | "오늘 / 이번 주 / 이번 달" | "어제 / 지난 7일 / 이번 달" |
| 8 | **action verb 한 단어** | "송금하기 / 저축하기" | "확대하기 / 유지하기 / 줄이기" |

### 2.2 Toss 구체 패턴 사례

#### 패턴 A: Toss 자산 홈 상단 카드
```
┌──────────────────────────────────────┐
│ [💰]  이번 달 쓸 수 있는 돈           │
│       234,000원                      │
│       지난 달보다 12만원 적게 남아요    │
│  [━━━━━━━━━━────] 67%                │
└──────────────────────────────────────┘
```

#### 패턴 B: 토스증권 종목 카드
```
┌──────────────────────────────────────┐
│  삼성전자        70,000원 (+2.1%)     │
│  ●━━━━━━━━━━━━━━━━                   │
│  "오늘 많이 올랐어요. 🔥"              │
│  [더보기] [매수하기]                   │
└──────────────────────────────────────┘
```

### 2.3 Toss가 Compass에 주는 시사점

1. **한글 서술형이 영어 명령형보다 강하다**: "Invest More"보다 "지금 더 넣어도 좋아요"
2. **"좋아요 / 나빠요"는 색으로, 근거는 문장으로**: 컬러 인코딩 + 평문 근거 조합
3. **단일 핵심 지표 + 2-3개 보조**: 5-6개 숫자 동시 노출은 읽기 불가
4. **"다음에 뭐 해" CTA 필수**: 결정 덱은 반드시 다음 행동으로 링크되어야

---

## 3. Secondary Benchmarks

### 3.1 Stripe Dashboard

**배울 점**:
- Top headline: `Gross Volume $234,567 · +12% vs last week`
- Sparkline trend (작은 차트 inline)
- Segment breakdown (bar, donut) 바로 아래
- **No jargon** — "ARR"도 ARR로 쓰지만 숫자는 큰 금액으로 강조

**Compass 적용**:
- Hero 숫자 + sparkline 인라인
- "vs last month" 비교를 default로 표기
- 메트릭 복수 병치 시 가로 strip (작고 densely)

### 3.2 Linear (Project Status)

**배울 점**:
- Color-coded status dot (초록/노랑/빨강) — 한눈에 상태
- 상태 + 한 줄 사유 (e.g., "On track · Due Apr 25")
- Minimal chrome, 긴 텍스트 없음
- Status 변화는 작은 뱃지로 알림 ("Moved from Backlog → In Progress")

**Compass 적용**:
- 상태를 강한 색 dot으로
- 상태 근거는 한 줄 이내
- 상태 변화를 미묘한 애니메이션으로

### 3.3 Notion (Weekly Digest)

**배울 점**:
- Narrative summary: "This week: 3 wins, 1 concern"
- 스토리 구조 — wins / concerns / actions
- 이모지로 감정 태깅
- 긴 텍스트 OK하지만 구조적 (headings + bullets)

**Compass 적용**:
- 포트폴리오 상태를 스토리로: "포코머지 글로벌 확대 신호, 일본 유지, 국내 축소"
- 🚀 / ⚠️ / 📉 이모지 활용
- 결정 덱 내부에 mini sections (상황 / 근거 / 권고)

### 3.4 Vercel Analytics

**배울 점**:
- Card hover가 미묘 — 강한 상호작용 지양
- 숫자는 크게, 단위는 작게 (ellipsis 시 숫자 우선)
- "Real User" / "Synthetic" 같은 기술 용어를 "방문자" / "성능 테스트"로 풀어 설명

**Compass 적용**:
- 호버 효과는 subtle
- 숫자 hierarchy 명확히 (hero > supporting)
- 기술 용어 옆 물음표 아이콘으로 설명

---

## 4. Gaming-Specific Reference

### 4.1 AppsFlyer Dashboard

- LTV, CPI, ROAS가 도메인 기본어 — 게임 산업 종사자는 이해
- 그러나 **비종사자(투자자·경영진)**는 모름
- AppsFlyer도 최근 onboarding에서 평이어 tooltip을 삽입하는 추세

**Compass 적용**: 게임 기획자 외 독자(투자자·CEO)를 고려해 2개 층위로 제공 — 기본 평이어 + 호버 시 전문용어 노출

### 4.2 Unity Analytics / GameAnalytics

- 메트릭 명칭이 Unity/GA 표준 — 개발자 친화
- 그러나 "Whale retention" 같은 속어는 초보자 이해 불가

**Compass 적용**: 용어집(별도 문서) 구축 → 앱 전체에서 참조

---

## 5. 패턴 카탈로그 (추출된 공통 원칙 10개)

1. **Single hero number** — 가장 중요한 숫자 1개 크게
2. **Plain Korean subtitle** — 그 숫자가 무슨 의미인지 한 문장
3. **Delta comparison** — 항상 "vs 지난 기간" 병기
4. **Color-coded status** — 초록/노랑/빨강 signal 시스템
5. **Trend sparkline** — 숫자 옆 작은 시계열
6. **Single primary CTA** — 다음 행동 1개만
7. **Secondary metrics strip** — 3-4개 보조 숫자 가로 정렬
8. **Narrative reasoning** — 숫자 아래 한 줄 사유
9. **Progressive disclosure** — 기본은 간결, "자세히 보기"로 심화
10. **Tone 일관성** — 친근 / 전문 / 경고 한 가지 톤 고수

---

## 6. Compass 카드 재설계 방향 (Research Conclusion)

### 6.1 우선순위

1. **판정 한 문장** (hero text) — "지금 포코머지 글로벌에 예산을 더 투입하세요"
2. **근거 3개** (secondary evidence) — 광고비 회수율 / 성장 속도 / 경쟁 포지션
3. **신뢰도 시각화** — "10번 중 8번 맞는 판단" (단순화한 게이지)
4. **임팩트 배지** — "실행 시 1년 매출 +12억" (원화, 평이어)
5. **단일 CTA** — "재배분 플랜 보기 →"

### 6.2 버릴 것

- "MOIC", "Credible Interval", "P10/P50/P90" 배지 상단 노출 (차트 내부로 이동)
- 영어 status ("INVEST/HOLD/REDUCE") 단독 노출 — 한글 서술 병기 필수
- 달러 단위 ($45K, $1.2M) — 원화 환산 병기 또는 교체

### 6.3 유지할 것

- 색 인코딩 시스템 (green/amber/red)
- 포트폴리오 구조 (3개 지역 비교)
- 신뢰도 수치 (78%) — 설명만 보완

---

## 7. 다음 단계

- [x] 용어집 작성 → `docs/wording-glossary.md`
- [x] 3개 재설계 컨셉 → `docs/verdict-redesign-concepts.md`
- [ ] 컨셉 1개 선택 (사용자 결정)
- [ ] 구현 (PortfolioVerdict + OverviewSummaryStrip 리펙토링)
- [ ] 사내 사용성 테스트 (3-5명 비전문가 대상, "이 카드 보고 뭐 해야 하죠?" 질문)

---

## 부록: 사내 테스트 설계 (권장)

대상: 금융/게임 전문 지식이 **없는** 3-5명 (디자인팀, 사업개발, 마케팅 주니어)

프로토콜:
1. 카드만 5초 보여줌
2. "지금 무슨 상황인가요?" 질문
3. "다음에 뭘 하면 되나요?" 질문
4. 이해 못 한 용어 표시해달라 요청

성공 기준: 5명 중 4명이 2개 질문에 정답. 용어 미이해율 20% 이하.
