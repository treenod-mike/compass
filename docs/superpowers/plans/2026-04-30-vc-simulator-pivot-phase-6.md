# VC Simulator Pivot — Phase 6 Implementation Plan (정리)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Phases 1-5 결과로 발생한 orphan 자원 정리 + 문서 동기화.

**Stacking:** Phase 5 (PR #35) 위. base 브랜치 `refactor/vc-pivot-phase-5`.

**Spec:** `docs/superpowers/specs/2026-04-29-vc-simulator-product-pivot-design.md` §9 Phase 6.

**Scope discipline (의식적 제외):**
- noindex 메타: hidden routes (`market-gap`, `mmm`, `prism`, `vc-simulation`)는 모두 `"use client"` 페이지라 Next.js 의 `export const metadata` 불가. 서버 컴포넌트 래퍼로 감싸는 건 별도 리팩터링이라 *Phase 6.1 fast-follow* 로 미룸. 본 phase 에서는 손대지 않음.
- 위젯 삭제: spec §12 "기존 24개 차트 위젯 삭제 0개" 원칙 유지 — Executive Overview 전용 위젯들도 남겨둠.

---

## 정리 대상

### Orphan i18n keys (5개)

Phase 2-5 진행 중 사용처가 사라진 키들. dictionary 에서 제거:

| 키 | 제거 사유 | 추가된 phase |
|---|---|---|
| `vc.tabs.kpi` | Phase 2에서 KPI 탭 제거 (VcResultTabs 에서 KPI를 hoist) | (이전 phase) |
| `vc.compare.you` | Phase 4에서 추가됐으나 v1 UI에서 미사용 | Phase 4 |
| `nav.group.market` | Phase 1에서 CategoryId 좁힘 | Phase 1 |
| `nav.group.channel` | Phase 1에서 CategoryId 좁힘 | Phase 1 |
| `nav.group.experiments` | Phase 1에서 CategoryId 좁힘 | Phase 1 |

### 문서 동기화

**CLAUDE.md** §3 (Project Structure) + §4 (Dashboard Pages):
- 사이드바 단순화 반영 (Dashboard + Connections만)
- VC sim 가 홈이라는 사실 명시
- "Executive Overview" 명칭 제거 — `/dashboard` = VC simulator
- spec 파일 참조 추가

---

## File Structure

| 변경 | 경로 | 책임 |
|---|---|---|
| Modify | `src/shared/i18n/dictionary.ts` | 5개 orphan key 제거 |
| Modify | `CLAUDE.md` | §3 + §4 dashboard pages section 업데이트 |

---

## Task 1: worktree

- [ ] **Step 1:**
```bash
cd "/Users/mike/Downloads/Project Compass"
git worktree add ../compass-worktrees/refactor-vc-pivot-phase-6 -b refactor/vc-pivot-phase-6 refactor/vc-pivot-phase-5
```

- [ ] **Step 2:**
```bash
cd ../compass-worktrees/refactor-vc-pivot-phase-6
npm install --legacy-peer-deps
```

- [ ] **Step 3:** `git log --oneline -3` — HEAD = `8cdfd83` (Phase 5 fix).

---

## Task 2: orphan i18n keys 제거

**File:** `src/shared/i18n/dictionary.ts`

- [ ] **Step 1: 사용처 grep으로 최종 확인**

```bash
cd /Users/mike/Downloads/compass-worktrees/refactor-vc-pivot-phase-6
echo "vc.tabs.kpi:" && grep -rn '"vc.tabs.kpi"\|t("vc.tabs.kpi")' src/ --include='*.tsx' --include='*.ts' | grep -v dictionary.ts
echo "vc.compare.you:" && grep -rn '"vc.compare.you"\|t("vc.compare.you")' src/ --include='*.tsx' --include='*.ts' | grep -v dictionary.ts
echo "nav.group.market:" && grep -rn '"nav.group.market"\|t("nav.group.market")' src/ --include='*.tsx' --include='*.ts' | grep -v dictionary.ts
echo "nav.group.channel:" && grep -rn '"nav.group.channel"\|t("nav.group.channel")' src/ --include='*.tsx' --include='*.ts' | grep -v dictionary.ts
echo "nav.group.experiments:" && grep -rn '"nav.group.experiments"\|t("nav.group.experiments")' src/ --include='*.tsx' --include='*.ts' | grep -v dictionary.ts
```

**Expected:** 모든 grep이 빈 결과. 만약 어느 하나가 사용처가 있으면 — 해당 키는 *제거하지 말고* report에 명시.

- [ ] **Step 2: dictionary.ts에서 5개 키 제거**

`src/shared/i18n/dictionary.ts` 에서 다음 항목 (key + ko + en 묶음) 모두 삭제:
- `vc.tabs.kpi`
- `vc.compare.you`
- `nav.group.market`
- `nav.group.channel`
- `nav.group.experiments`

Phase 1에서 추가된 "Kept for Phase 3 PRISM re-introduction (...)" 주석도 함께 제거 (지금은 Phase 3 LTV 통합이 자체 i18n key를 새로 만드는 게 맞으니 명시적 보존 의무 없음).

- [ ] **Step 3: tsc 확인**

```bash
npx tsc --noEmit
```

Expected: 0 errors. (TranslationKey 타입에서 5개 union 멤버가 사라지는데, 사용처가 없으므로 영향 없음.)

---

## Task 3: CLAUDE.md 업데이트

**File:** `CLAUDE.md`

- [ ] **Step 1: §3 Project Structure 의 dashboard 라우트 트리 업데이트**

기존:
```
src/
├── app/
│   ├── page.tsx                    # / → /dashboard 리다이렉트
│   ├── layout.tsx                  # Root layout (fonts, providers)
│   └── (dashboard)/
│       ├── layout.tsx              # Dashboard shell (StatusBar + Sidebar)
│       └── dashboard/
│           ├── page.tsx            # Executive Overview (Module 1)
│           └── market-gap/
│               └── page.tsx        # Market Gap Analysis (Module 2)
```

다음으로 교체:
```
src/
├── app/
│   ├── page.tsx                    # / → /dashboard 리다이렉트
│   ├── layout.tsx                  # Root layout (fonts, providers)
│   └── (dashboard)/
│       ├── layout.tsx              # Dashboard shell (Sidebar + Header)
│       └── dashboard/
│           ├── page.tsx            # VC Simulator (홈) — 시뮬레이터 = 제품
│           ├── connections/        # AppsFlyer 연동 관리 (사이드바 노출)
│           ├── market-gap/         # URL 보존, 사이드바 hidden
│           ├── mmm/                # URL 보존, 사이드바 hidden
│           ├── prism/              # URL 보존, 사이드바 hidden
│           └── vc-simulation/      # URL 보존 (`/dashboard` 와 동일 콘텐츠)
```

- [ ] **Step 2: §4 Dashboard Pages 섹션 전체 교체**

기존 §4 (Executive Overview / Market Gap 두 페이지 description) 를 다음으로 교체:

```markdown
## 4. Dashboard Pages

**제품 정체성**: 관찰형 대시보드 → 조작형 시뮬레이터로 pivot 완료
(spec: `docs/superpowers/specs/2026-04-29-vc-simulator-product-pivot-design.md`).

### `/dashboard` — VC Simulator (홈)
사이드바의 "Dashboard" 진입점. VC 자본 배분 시뮬레이션을 한 화면에 압축.

**구성**:
1. **Hero Decision Sentence** — "이 자본 배분이면 X" 풀폭 헤드라인
2. **시장과 비교 토글** (헤더 우측) — ON 시 시장 p50 retention overlay
3. **좌 40% INPUT 컬럼**:
   - Preset 탭 / Horizon / Fund / Channel mix / Offer fields
   - **채널 분해 보기** 트리거 → 우측 480px Sheet drawer (CpiQuadrant + CpiBenchmarkTable)
   - **가정값 출처** 디스클로저 → RevenueForecast 미니 / D1/D7/D30 retention strip / KPI 2×2
4. **우 60% RESULT 컬럼**:
   - DataSourceBadge + StaleBadge
   - VcKpiStrip — IRR / MOIC / Payback / J-Curve (4개, 항상 보임)
   - CumulativeRoasChart (메인 차트)
   - VcResultTabs — Insights / Runway

### `/dashboard/connections` — AppsFlyer 연동 관리
사이드바의 "데이터 연결". 백엔드 설정 영역. 시뮬레이터의 일부가 아님.

### Hidden routes (URL 보존, 사이드바 비노출)
- `/dashboard/market-gap` — Bayesian Prior/Posterior (구 Module 2)
- `/dashboard/mmm` — Marketing Mix (Channel drawer의 "전체 화면" 링크에서 진입)
- `/dashboard/prism` — PRISM × LTV (다음 챕터에서 시뮬레이터 입력으로 흡수 예정)
- `/dashboard/vc-simulation` — `/dashboard` 와 동일 콘텐츠 (북마크 호환)
```

---

## Task 4: 검증 + commit

- [ ] **Step 1: tsc + tests**

```bash
npx tsc --noEmit
npm test
```

Expected: 0 errors, 254/254 PASS.

- [ ] **Step 2: 커밋**

```bash
git add src/shared/i18n/dictionary.ts CLAUDE.md
git commit -m "$(cat <<'EOF'
chore(vc-sim): cleanup orphan i18n keys + sync CLAUDE.md (Phase 6)

Phase 6 of VC simulator pivot — final cleanup:
- Remove 5 orphan i18n keys: vc.tabs.kpi, vc.compare.you,
  nav.group.{market,channel,experiments}
- CLAUDE.md §3 Project Structure: hidden routes 표시 추가
- CLAUDE.md §4 Dashboard Pages: VC simulator 홈 + connections 만 노출,
  hidden routes 명시. Executive Overview / Market Gap 옛 description 제거

noindex meta는 hidden routes가 모두 use client component 라 Next.js metadata
export 불가 — 서버 wrapper 추가는 fast-follow Phase 6.1로 미룸.

Spec: docs/superpowers/specs/2026-04-29-vc-simulator-product-pivot-design.md §9

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: build + push + PR

```bash
npm run build
git push -u origin refactor/vc-pivot-phase-6
gh pr create --base refactor/vc-pivot-phase-5 \
  --title "chore(vc-sim): VC simulator pivot — Phase 6 cleanup" \
  --body "$(cat <<'EOF'
## Summary

VC simulator pivot의 마지막 phase — 정리.

- 5개 orphan i18n keys 제거 (Phases 1-5에서 사용처 사라짐)
- CLAUDE.md §3 + §4 — Dashboard Pages 섹션 새 IA 반영
- "Executive Overview" 명칭 제거, VC simulator = 제품 홈 명시

**스코프 의도적 제외:** hidden routes의 noindex meta — 4개 페이지가 모두 \`"use client"\` 라 Next.js \`export const metadata\` 불가. 서버 wrapper 추가는 별도 리팩터링이므로 Phase 6.1 fast-follow 로 미룸.

**Stacking:** PR #31 → #32 → #33 → #34 → #35 → 본 PR (마지막).

**Spec:** \`docs/superpowers/specs/2026-04-29-vc-simulator-product-pivot-design.md\` §9 Phase 6
**Plan:** \`docs/superpowers/plans/2026-04-30-vc-simulator-pivot-phase-6.md\`

## Test plan

- [ ] dictionary.ts에서 5개 키 삭제 확인 (grep으로 확인 = 0건)
- [ ] CLAUDE.md §3, §4 새 사이트맵 반영 확인
- [ ] \`npm run build\` 통과 — 6개 dashboard 라우트 정적 생성 그대로
- [ ] \`npm test\` 254 PASS

## After merge

이 PR이 머지되면 5단계 stack 모두 main에 도달:
1. PR #31: sidebar 단순화 + VC sim 홈 승격
2. PR #32: hero + KPI + 40/60 grid
3. PR #33: 가정값 출처 disclosure
4. PR #34: 시장과 비교 토글
5. PR #35: Channel drawer
6. **PR #36: 정리 (본 PR)**

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

- 5개 orphan key 사용처 grep 으로 사전 확인 ✓
- CLAUDE.md 업데이트 — 사이드바 + dashboard pages 동기화 ✓
- noindex meta deferral 명시 ✓
- 위젯 삭제 없음 ✓ (spec §12)
- 254 tests 통과 검증 ✓
