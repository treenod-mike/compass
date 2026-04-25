# CPI 벤치마크 데이터 소스 조사 노트

**작성일**: 2026-04-24
**목적**: MMM 대시보드 (`CpiBenchmarkTable`, `CpiQuadrant`, `ChannelStatusCard`) 에서 "our vs market" 비교에 사용할 **국가 × 장르 CPI 벤치마크** 데이터 소스 선정
**상태**: 조사만 완료. 구현 전 단계.

---

## 1. 배경

MMM v2 대시보드의 다음 위젯들이 시장 CPI 벤치마크를 필요로 함:
- `CpiBenchmarkTable` — our vs market CPI with verdict badges (§⑤-R)
- `CpiQuadrant` — 2×2 saturation × CPI deviation scatter (§⑤-L)
- `ChannelStatusCard` — MMP/MMM bias label (§④)

요구사항: **국가별 × 장르별** 매트릭스, 자동화 가능, 공신력 있는 오픈 리소스.

---

## 2. 핵심 결론

> **"완벽하게 공신력 + 자동화 + 무료"가 동시에 만족되는 단일 소스는 업계에 존재하지 않는다.**
> CPI 벤치마크는 광고 네트워크의 상품이라 대부분 유료 구독 또는 분기별 PDF로 갇혀 있다.
> 차선의 현실적인 조합만 존재한다.

---

## 3. 소스 평가

### 3.1 1순위 후보: Unity LevelPlay CPI Index (구 ironSource)

- **URL**: https://levelplay.com/cpi-index/ *(이관 후 상태 검증 필요)*
- **공신력**: ⭐⭐⭐⭐⭐ Unity/ironSource는 업계 최대 UA 네트워크 중 하나, 실제 입찰 데이터 기반
- **커버리지**: iOS + Android × 30+ 국가 × 20+ 장르 (Casual, Puzzle, RPG, Strategy 등)
- **갱신 주기**: 월 1회
- **비용**: 무료 + 로그인 불필요
- **자동화**: ✅ 프론트엔드가 내부 JSON API 호출 — Network 탭에서 엔드포인트 추출 후 직접 호출 가능
- **리스크**: Unity가 언제든 종료/유료화할 가능성. 장르 분류가 타 소스와 다를 수 있음.

### 3.2 보조 소스

| 소스 | 주기 | 자동화 | 비용 | 용도 |
|------|------|--------|------|------|
| AppsFlyer Performance Index (공개판) | 분기 | PDF 파싱 필요 | 무료 | cross-check |
| AppsFlyer Benchmarks (대시보드 내) | 월 | 수동 CSV export | 플랜 의존 | 회사 계정 티어 확인 필요 |
| GameAnalytics Data Report | 분기 | PDF 파싱 | 무료 | 게임 특화 CPI |
| Liftoff Intelligence Report | 연 2회 | PDF 파싱 | 무료 | 크리에이티브 성과 |
| data.ai / Sensor Tower API | 실시간 | ✅ API | **유료 (고가)** | enterprise 옵션 |
| 본인 Meta/Google/TikTok Ads API | 실시간 | ✅ API | 무료 | "우리 CPI" 실제 값 — benchmark 아님 |

---

## 4. 권장 아키텍처

```
[Primary / 자동화]
  Unity LevelPlay CPI Index (월간)
      ↓ JSON API 직접 호출
  src/shared/api/data/cpi-benchmarks/levelplay-snapshot.json

[Secondary / 분기 수동]
  AppsFlyer Performance Index PDF → 숫자 검증용
      ↓
  docs/benchmarks-cross-check-YYYY-QN.md (단순 노트)

[Own Data / 실시간]
  Meta/Google/TikTok Ads API → "우리 실제 CPI"
      ↓
  MMM: "our CPI vs LevelPlay benchmark"
```

**원칙**:
- 1순위 소스 하나로 일관된 methodology 유지
- 보조 소스는 "sanity check"로만 사용, 평균 내지 말 것 (신호 흐려짐)
- 소스 간 CPI가 2-3배 차이나는 것은 정상

---

## 5. 저장 구조 권장안

### 5.1 파일 위치

```
crawler/
├── src/cpi-benchmarks/
│   ├── ingest.ts              # JSON API → snapshot 변환
│   ├── schema.ts              # Zod (country/genre/platform enum + metric bounds)
│   └── __tests__/
└── (inbox 불필요 — API 직접 호출)

src/shared/api/data/cpi-benchmarks/
└── levelplay-snapshot.json    # 커밋 대상

src/shared/api/cpi-benchmarks.ts  # 런타임 accessor + isStale()
```

### 5.2 스냅샷 shape (중첩 객체)

```jsonc
{
  "version": 1,
  "source": "unity-levelplay-cpi-index",
  "generatedAt": "2026-04-01",
  "sourceRange": { "start": "2026-03-01", "end": "2026-03-31" },
  "platforms": {
    "ios": {
      "JP": {
        "puzzle":  { "cpi": 3.2, "cpm": 18.5 },
        "rpg":     { "cpi": 5.8, "cpm": 22.1 }
      },
      "US": { }
    },
    "android": { }
  }
}
```

### 5.3 이 shape를 선택한 이유

- **O(1) 조회**: `data.platforms.ios.JP.puzzle.cpi`
- **Git diff 친화적**: 일본 puzzle CPI만 바뀌면 1줄만 변경
- **타입 안전**: Zod로 country/genre enum 강제 → 오타 즉시 catch
- **크기**: Platform 2 × Country 30 × Genre 15 × Metrics 4 ≈ 3,600 값 ≈ gzip 후 ~15KB → 번들 부담 0

### 5.4 Staleness

```ts
// 35일 이상이면 stale (월 1회 갱신 + 5일 버퍼)
export function isBenchmarkStale(snapshot): boolean {
  const age = Date.now() - new Date(snapshot.generatedAt).getTime()
  return age > 35 * 24 * 60 * 60 * 1000
}
```

---

## 6. 데이터 정규화 레이어 필요

각 소스의 장르/국가 분류가 다르므로 Compass 내부 표준 enum 정의 필요:

- **국가**: ISO 3166-1 alpha-2 (JP, US, KR, DE, ...)
- **장르**: Sensor Tower 분류와 일치시킬 것 (기존 `prior-data.ts` 참고)
  - 예: LevelPlay "Casual" → Compass "puzzle/match-3"
- **플랫폼**: `ios` | `android` (소문자)

매핑 테이블: `src/shared/api/cpi-benchmarks/normalize.ts` (구현 시).

---

## 7. 구현 전 확인할 것 (TODO)

### 7.1 LevelPlay 검증 (5분)
1. https://levelplay.com/cpi-index/ 접속 → 페이지 살아있는지 확인
2. DevTools Network 탭 열고 필터 바꿔보면서 **내부 API 엔드포인트** 식별
3. `curl`로 인증 없이 호출 가능한지 확인
4. 응답 JSON 구조 스크린샷/저장

### 7.2 AppsFlyer Benchmarks 플랜 확인 (5분)
1. https://hq1.appsflyer.com/ 로그인 (ikhoon@treenod.com)
2. 좌측 메뉴에 **Benchmarks** 있는지 확인
3. 있다면 Export/Download CSV 버튼 유무 확인
4. 없다면 플랜 업그레이드 여부 검토 (또는 Primary 단일 소스로 진행)

### 7.3 장르 매핑 설계
- 기존 `src/shared/api/prior-data.ts`의 장르 분류와 LevelPlay 장르를 나란히 놓고 매핑표 작성

---

## 8. 주의사항

1. **Unity/ironSource가 CPI Index를 언제든 종료하거나 유료화할 가능성** — 스냅샷을 git에 커밋해두면 서비스가 사라져도 히스토리는 남음.
2. **"업계 평균"의 편향** — LevelPlay는 자사 네트워크 데이터 비중이 높음. Meta/Google에서만 집행하는 입장에선 5-30% 차이 날 수 있음 → 항상 "reference only" 표기.
3. **장르 분류의 fuzziness** — 동일 게임도 소스마다 다른 장르에 들어갈 수 있음. 결과 해석 시 주의.
4. **"our CPI vs benchmark" deviation이 의사결정의 진짜 축** — 절대값보다 상대 편차가 MMM 판정에 훨씬 중요. 벤치마크는 완벽할 필요 없고 **일관된 방법론**이면 충분.

---

## 9. 관련 파일

- `src/shared/api/prior-data.ts` — Sensor Tower prior 데이터 (참고 패턴)
- `src/shared/api/data/sensor-tower/merge-jp-snapshot.json` — 기존 snapshot 패턴 참고
- `src/widgets/charts/ui/market-benchmark.tsx` — 현재 벤치마크 차트 구현
- `docs/superpowers/specs/2026-04-20-sensortower-crawler-design.md` — 크롤러 설계 참고 패턴
- `crawler/` — 기존 크롤러 패키지 구조
