# Compass 통합 하네스 설계

**Date**: 2026-04-24
**Status**: Draft → Review
**Target Branch**: `feat/compass-harness`
**Author**: Mike + Claude (brainstorming)

---

## 1. 개요

Compass 프로젝트의 매 작업(feature, fix, refactor, docs)에 공통으로 적용할 **얇은 자동화 레이어**를 정의한다. 수동으로 반복되던 흐름(스펙 → 플랜 → worktree → 구현 → tsc → commit → PR → 리뷰 툴 트리거)의 일부를 Claude Code 하네스(hooks, slash commands, 문서)로 옮긴다.

### 설계 원칙

1. **Compass 규모에 맞춰 슬림하게** — 풀 CI/CD 파이프라인은 과잉. 로컬 hook + 최소 스크립트로 제한.
2. **자동화는 "반복되고 실수가 생긴 지점"에만** — 최근 세 번의 작업(AppsFlyer, MMM v1, v2)에서 실제 관찰된 마찰을 근거로 함.
3. **구성요소 간 독립** — 각 hook/command는 한 파일에 고립. 추가·제거가 서로 영향 주지 않음.
4. **비개발자 친화** — Mike가 훅 내부를 직접 수정하지 않아도 의도대로 작동. 메시지는 한국어.

### 범위 밖 (YAGNI)

- GitHub Actions CI 파이프라인 (Vercel + CodeRabbit이 이미 담당)
- Ralph 자율 루프 상시 실행 (별도 수동 트리거로 유지)
- Main 브랜치에서 `src/**` 편집 차단 (MVP #6 — 향후 확장)
- 자동 changelog 생성, auto-deploy monitoring

---

## 2. 배경: 반복 관찰된 마찰

| 마찰 | 언제 발생 | 하네스 항목 |
|---|---|---|
| 세션 시작 시 "어디까지 했더라?" 수동 확인 | 매 세션 | #1 SessionStart |
| 새 작업 시작 시 brainstorm→spec→plan→worktree 5단계 수동 | 매 feature | #2 /compass-start |
| 커밋 후에야 tsc 에러 발견 (ex: FadeInUp delay prop) | 커밋 직전 | #3 PreCommit |
| CodeRabbit 기본 skip → 수동 `@coderabbitai review` 필요 | PR 생성 후 | #4 PostPR |
| Vercel preview URL 찾기 위해 PR 페이지 왕복 | PR 생성 후 | #4 PostPR |
| CLAUDE.md에 Mike 워크플로우·worktree·계정분리 규약 누락 | 서브에이전트 호출 시 | #5 Docs |

---

## 3. 파일 구조

```
.claude/                                     (신규)
├── settings.json                            ← 3개 hook 등록
└── commands/
    └── compass-start.md                     ← /compass-start 슬래시 커맨드

scripts/compass-harness/                     (신규)
├── session-brief.sh                         ← Hook #1
├── precommit-gate.sh                        ← Hook #3
└── postpr-enrich.sh                         ← Hook #4

CLAUDE.md                                    ← §10 "작업 컨벤션" 섹션 신규 추가
docs/superpowers/specs/
└── 2026-04-24-compass-harness-design.md     ← 본 문서
```

### 왜 `.claude/settings.json` 프로젝트 파일인가

Mike 단독 저장소라 팀 공유 이슈 없고, 다음 세션·다른 worktree에서도 동일하게 작동해야 하므로 git에 커밋. `.claude/settings.local.json`은 Mike의 일회성 권한(`allow/deny` 리스트)을 위해 남겨두고 건드리지 않는다.

### 왜 hook 로직을 별도 `.sh`로 분리했나

`settings.json`에 bash one-liner를 길게 쓰면 수정·디버깅이 번거롭다. 스크립트 파일로 빼면:
- `bash -x scripts/compass-harness/precommit-gate.sh` 로 단독 테스트 가능
- 파일 단독 책임 원칙 (FSD 정신과 일관)
- 스크립트 내부 설명 주석을 풍부하게 쓸 수 있음

---

## 4. 구현 세부

### 4.1 `.claude/settings.json`

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$CLAUDE_PROJECT_DIR/scripts/compass-harness/session-brief.sh\""
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$CLAUDE_PROJECT_DIR/scripts/compass-harness/precommit-gate.sh\""
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$CLAUDE_PROJECT_DIR/scripts/compass-harness/postpr-enrich.sh\""
          }
        ]
      }
    ]
  }
}
```

**`matcher: "Bash"`** — 모든 Bash 호출에서 훅이 실행된다. 스크립트 내부에서 `tool_input.command`를 파싱해 `git commit` / `gh pr create`에만 반응하고 나머지는 즉시 `exit 0`.

### 4.2 Hook #1 — `session-brief.sh`

**목적**: 세션 시작 시 Claude에게 현재 프로젝트 상태를 자동 주입.
**트리거**: `SessionStart` (startup / resume / clear).
**출력**: stdout으로 markdown 컨텍스트. Claude Code가 이를 `additionalContext`로 모델에 주입.

```bash
#!/usr/bin/env bash
# scripts/compass-harness/session-brief.sh
# SessionStart hook — Compass 현재 상태 요약을 Claude에게 주입
set -euo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "(not a git repo)")
COMMITS=$(git log --oneline -3 2>/dev/null || echo "(no commits)")

if command -v gh >/dev/null 2>&1; then
  PRS=$(gh pr list --state open --limit 5 \
    --json number,title,headRefName,isDraft \
    --jq '.[] | "#\(.number) [\(if .isDraft then "draft" else "open" end)] \(.title) (\(.headRefName))"' \
    2>/dev/null || echo "(gh CLI error)")
else
  PRS="(gh CLI not installed)"
fi

LATEST_SPECS=$(ls -t docs/superpowers/specs/*.md 2>/dev/null | head -3 | xargs -n1 basename 2>/dev/null || echo "(no specs)")

WORKTREES=$(git worktree list 2>/dev/null | awk '{print "  • " $0}' || echo "  (none)")

cat <<EOF
# Compass 세션 컨텍스트 (auto-injected)

## 현재 브랜치
$BRANCH

## 최근 커밋 3개
$COMMITS

## 열린 PR
${PRS:-(none)}

## 최신 스펙 3개
$LATEST_SPECS

## 활성 worktree
$WORKTREES
EOF
```

### 4.3 Slash Command #2 — `.claude/commands/compass-start.md`

**목적**: 새 작업 시작 흐름(worktree + 브랜치 + npm install + brainstorming)을 한 줄 커맨드로 축약.
**호출**: `/compass-start <type> <name>`

```markdown
---
description: Compass 새 작업 시작 — worktree + 브랜치 + npm install + (필요시) brainstorming
argument-hint: <type: feature|fix|refactor|docs> <name>
---

# /compass-start

입력:
- `$1` = type (feature, fix, refactor, docs 중 하나)
- `$2` = name (kebab-case, 예: mmm-v3, fadein-delay-prop)

## 실행 순서

1. **입력 검증**
   - $1이 `feature|fix|refactor|docs` 중 하나인지 확인, 아니면 에러
   - $2가 `^[a-z][a-z0-9-]+$` 패턴인지 확인

2. **브랜치/경로 계산**
   - type별 prefix:
     - `feature` → `feat/<name>`
     - `fix` → `fix/<name>`
     - `refactor` → `refactor/<name>`
     - `docs` → `docs/<name>`
   - worktree 경로: `../compass-worktrees/<type>-<name>/`

3. **Worktree 생성**
   ```bash
   git worktree add "../compass-worktrees/<type>-<name>" -b "<prefix>/<name>"
   ```

4. **종속성 설치 (백그라운드)**
   - worktree 디렉토리에서 `npm install --legacy-peer-deps` 백그라운드 실행
   - 사용자에게 "의존성 설치 중 — 몇 분 걸릴 수 있음" 안내

5. **타입별 후속 액션**
   - `feature` 또는 `refactor` → `superpowers:brainstorming` 스킬 자동 호출
   - `fix` → `superpowers:systematic-debugging` 스킬 자동 호출
   - `docs` → 바로 편집 모드 진입 (brainstorming 스킵)

6. **작업 디렉토리 전환 안내**
   - Claude에게 "이후 모든 파일 편집은 `../compass-worktrees/<type>-<name>/`에서 수행" 알림

## 주의

- Compass 루트에서 실행하는 것을 가정
- 같은 이름의 worktree가 이미 있으면 오류 출력 + 기존 worktree 경로 안내
- `docs/`, `CLAUDE.md`, `scripts/` 같은 메타 파일 수정은 worktree 없이 main에서 해도 됨 (CLAUDE.md §10 참고)
```

### 4.4 Hook #3 — `precommit-gate.sh`

**목적**: `git commit` 실행 전에 tsc + test 자동 실행, 실패 시 차단.
**트리거**: `PreToolUse:Bash` (모든 Bash 호출에서 발동하지만 `git commit`에만 반응).
**Exit 전략**:
- `exit 0` — 통과 (훅이 관여하지 않거나 검사 통과)
- `exit 2` — 커밋 차단, stderr 내용이 Claude에게 블로킹 메시지로 전달

```bash
#!/usr/bin/env bash
# scripts/compass-harness/precommit-gate.sh
# PreToolUse:Bash hook — git commit 전에 tsc + test 자동 검증
set -uo pipefail

# stdin으로 hook input (JSON) 수신
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

# git commit 이 아니면 통과
if ! echo "$CMD" | grep -qE '(^|[[:space:]&;|])git[[:space:]]+commit([[:space:]]|$)'; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

echo "━━━ Compass pre-commit gate ━━━" >&2

# 1) tsc --noEmit
echo "▸ tsc --noEmit..." >&2
if ! npx tsc --noEmit 2>&1 >&2; then
  cat >&2 <<EOF
❌ 커밋 차단: TypeScript 타입 오류 발견
   위 출력의 오류를 먼저 수정하세요.
EOF
  exit 2
fi
echo "  ✅ tsc 통과" >&2

# 2) node:test (tsx --test) — Compass는 node:test + tsx 사용
#    하네스 설치 시 package.json에 "test" 범용 스크립트를 추가해 둠 (§8 참고)
if [ -f package.json ] && node -e "process.exit(require('./package.json').scripts?.test ? 0 : 1)" 2>/dev/null; then
  echo "▸ npm test (tsx --test)..." >&2
  if ! npm test 2>&1 >&2; then
    cat >&2 <<EOF
❌ 커밋 차단: 테스트 실패
   실패한 테스트를 먼저 수정하세요.
EOF
    exit 2
  fi
  echo "  ✅ test 통과" >&2
else
  echo "  ⤼ test 스크립트 없음 — 스킵" >&2
fi

# 3) arch-guard (Phase 2 — 별도 수동 단계로 유지)
# TODO(Phase 2): arch-guard 플러그인을 hook에서 자동 호출할 방법 연구.
#   현재 arch-guard는 slash command(/arch-check)로 설계됨 → hook에서 직접 호출 불가.
#   대안: CLAUDE.md에 "큰 리팩토링 커밋 전 /arch-check 수동 실행" 규약 추가.

echo "━━━ 게이트 통과 — 커밋 진행 ━━━" >&2
exit 0
```

**Phase 1 vs Phase 2**:
- **Phase 1 (MVP)**: tsc + test만. Arch-guard는 CLAUDE.md에 수동 실행 규약으로 명시.
- **Phase 2 (향후)**: arch-guard를 hook에서 직접 실행하는 wrapper 스크립트 연구.

### 4.5 Hook #4 — `postpr-enrich.sh`

**목적**: `gh pr create` 성공 후 자동으로:
1. CodeRabbit 수동 트리거 코멘트 추가
2. Vercel preview URL을 최대 30초 폴링해서 Claude에게 보고

**트리거**: `PostToolUse:Bash` (모든 Bash 호출에서 발동하지만 `gh pr create`에만 반응).

```bash
#!/usr/bin/env bash
# scripts/compass-harness/postpr-enrich.sh
# PostToolUse:Bash hook — gh pr create 직후 CodeRabbit 트리거 + Vercel URL 조회
set -uo pipefail

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")
STDOUT=$(echo "$INPUT" | jq -r '.tool_response.stdout // ""' 2>/dev/null || echo "")
EXIT_CODE=$(echo "$INPUT" | jq -r '.tool_response.exit_code // 1' 2>/dev/null || echo "1")

# gh pr create 성공만 대상
if ! echo "$CMD" | grep -qE '(^|[[:space:]&;|])gh[[:space:]]+pr[[:space:]]+create'; then
  exit 0
fi
if [ "$EXIT_CODE" != "0" ]; then
  exit 0
fi

# PR URL 추출
PR_URL=$(echo "$STDOUT" | grep -oE 'https://github\.com/[^[:space:]]+/pull/[0-9]+' | head -1)
if [ -z "$PR_URL" ]; then
  exit 0
fi
PR_NUM=$(echo "$PR_URL" | grep -oE '[0-9]+$')

echo "━━━ Compass post-PR enrichment (PR #$PR_NUM) ━━━" >&2

# 1) CodeRabbit 수동 트리거
if command -v gh >/dev/null 2>&1; then
  if gh pr comment "$PR_NUM" --body "@coderabbitai review" >/dev/null 2>&1; then
    echo "  ✅ CodeRabbit review 트리거됨" >&2
  else
    echo "  ⚠️  CodeRabbit 트리거 실패 (수동 추가 필요)" >&2
  fi
fi

# 2) Vercel preview URL 폴링 (최대 3회 × 10초 = 30초)
VERCEL_URL=""
for i in 1 2 3; do
  sleep 10
  VERCEL_URL=$(gh pr view "$PR_NUM" --json comments \
    --jq '.comments[] | select(.author.login == "vercel" or .author.login == "vercel[bot]") | .body' 2>/dev/null \
    | grep -oE 'https://[a-z0-9-]+\.vercel\.app[^[:space:])]*' | head -1 || echo "")
  [ -n "$VERCEL_URL" ] && break
done

if [ -n "$VERCEL_URL" ]; then
  echo "  ✅ Vercel Preview: $VERCEL_URL" >&2
else
  echo "  ⤼ Vercel Preview: 아직 배포 중 (1–2분 후 PR 페이지에서 확인)" >&2
fi

echo "━━━ PR: $PR_URL ━━━" >&2
exit 0
```

### 4.6 Docs #5 — `CLAUDE.md` §10 추가

기존 CLAUDE.md 끝에 신규 섹션 추가 (기존 내용 수정하지 않음).

```markdown
---

## 10. 작업 컨벤션 (하네스)

### 10.1 사용자 프로필
- **Mike는 비개발자**. 제품 방향을 정의하나 기술 트레이드오프 판단은 어려움.
- **추천-OK 워크플로우**: A/B/C/D 메뉴형 질문보다 단일 추천안 + 근거 제시를 선호. 사용자 응답은 OK / 다르게 2가지로 수렴.

### 10.2 브랜치 / Worktree 규약
- **모든 코드 작업(feature/fix/refactor)은 `git worktree` 기본**. `git checkout -b`로 같은 디렉토리에서 브랜치 이동 금지.
- 시작 커맨드: `/compass-start <type> <name>` — worktree + 브랜치 + `npm install --legacy-peer-deps` 자동화.
- Worktree 경로: `../compass-worktrees/<type>-<name>/`
- 메타 파일(`docs/`, `CLAUDE.md`, `scripts/`, `README.md`) 수정은 main 워크트리에서 직접 해도 됨.

### 10.3 GitHub 계정 분리
- **회사 계정**: `treenod-mike` → `treenod-*` repo 전용
- **개인 계정**: `mugungwhwa` → 개인 repo 전용
- 계정 오염 시 즉시 `gh auth switch` 후 identity 재확인. `git config user.*` 설정을 절대 수정하지 말 것.

### 10.4 하네스 자동 작동 목록
세션마다 아래가 자동으로 돎 — Claude가 수동 호출할 필요 없음:

| 순간 | 작동 | 실패 시 |
|---|---|---|
| 세션 시작 | 현재 브랜치·PR·최신 스펙 3개 자동 요약 | — |
| `git commit` 시도 | tsc + npm test 자동 실행 | 커밋 차단, 오류 메시지 반환 |
| `gh pr create` 성공 | `@coderabbitai review` 코멘트 추가 + Vercel preview URL 조회 | 에러 메시지만 출력, 후속 작업 안 막음 |

### 10.5 하네스 범위 밖 (수동 실행)
- `/arch-check` — 큰 구조 변경(여러 레이어 수정, FSD 경계 재정의) 커밋 전 수동 실행
- `/oh-my-claudecode:ralph` — 복잡한 버그 추적이나 긴 리팩토링에 자율 루프로 선택 사용
- `/ultrareview` — 사용자가 직접 PR에 트리거
```

---

## 5. 작동 타이밍 / 재시작

Claude Code는 `.claude/settings.json`을 **세션 시작 시점에 한 번** 로드한다.

| 구성요소 | 설치 직후 | 재시작 후 |
|---|---|---|
| #1 SessionStart hook | ❌ 이번 세션은 이미 시작됨 | ✅ |
| #2 /compass-start | 🟡 대개 즉시 인식 (slash command는 동적 스캔) | ✅ |
| #3 PreCommit | ❌ settings.json은 시작 시 로드 | ✅ |
| #4 PostPR | ❌ 동일 | ✅ |
| #5 CLAUDE.md 추가 | 🟡 파일은 즉시 존재, 시스템 프롬프트 자동 주입은 재시작 후 | ✅ |

### 재시작 절차
1. 현재 세션에서 `/exit` 또는 `Ctrl+C` 두 번
2. 같은 프로젝트 디렉토리에서 `claude` 재실행
3. 재시작 후 "Compass 하네스 테스트" 라고 말해 Claude가 5개 구성요소를 진단하도록 한다.

---

## 6. 테스트 / 진단 플랜

### 6.1 각 구성요소 단위 테스트

| 항목 | 테스트 방법 |
|---|---|
| #1 session-brief | `bash scripts/compass-harness/session-brief.sh` 단독 실행 → git 상태 블록 출력 확인 |
| #2 /compass-start | `/compass-start feature test-dummy` → `../compass-worktrees/feature-test-dummy/` 생성 확인 후 삭제 |
| #3 precommit-gate | TS 오류 파일 생성 후 `git commit` 시도 → 차단 메시지 확인 |
| #4 postpr-enrich | `gh pr create` 직후 PR 코멘트에 `@coderabbitai review` 자동 추가 확인 |
| #5 CLAUDE.md | `cat CLAUDE.md | grep "10. 작업 컨벤션"` 확인 |

### 6.2 End-to-End 시나리오

재시작 후 Mike가 "PR 하나 작게 만들어 보자"라고 말하면 Claude가 자동으로:
1. SessionStart 브리핑 확인
2. `/compass-start fix test-harness-verification` 호출
3. 사소한 변경 (예: README 오타 수정 후 worktree 내에서 재현)
4. `git commit` — 게이트 통과 확인
5. `gh pr create` — CodeRabbit + Vercel URL 출력 확인
6. 테스트 PR 닫고 worktree 제거

---

## 7. 개방된 이슈

1. **Arch-guard 통합 (Phase 2)** — 현재 arch-guard 플러그인은 slash command로만 호출 가능. Hook에서 직접 실행하려면 플러그인 내부 CLI entry point가 필요. 당장은 CLAUDE.md §10.5에 수동 실행 규약만 명시.

2. **MVP #6 main 브랜치 보호 (연기)** — Mike가 `/compass-start` 없이 자연어로 시작 시 main에서 편집하는 문제. 현재 MVP에서 제외, CLAUDE.md §10.2의 "worktree 기본" 규약으로 커버. 위반 시 개발자가 직접 알아차려야 함.

3. **Worktree의 `.omc/state/`, `.claude/` 공유 여부** — Git worktree는 `.git` 외 디렉토리를 공유한다. `.claude/settings.json`은 main과 모든 worktree에 동일 적용 → 의도대로. 단 `.omc/state/sessions/`는 각 Claude Code 세션별 분리(sessionId 단위)이므로 worktree 간 상태 충돌 없음.

4. **환경변수 의존성** — `postpr-enrich.sh`는 `gh` CLI + 인증 필요. 미설치 시 hook은 조용히 스킵하지만, 사용자 에러 알림은 없음. 초기 설정 체크리스트에 `gh auth status` 포함.

5. **Windows 호환** — 본 설계는 zsh/bash 기반. Mike는 macOS만 사용하므로 범위 밖.

---

## 8. 구현 순서 (writing-plans에서 상세화)

1. `.claude/settings.json` 생성 + 3개 hook 등록
2. `scripts/compass-harness/` 디렉토리 + 3개 쉘 스크립트 작성 (chmod +x)
3. `.claude/commands/compass-start.md` 작성
4. **`package.json` `scripts.test` 추가** — `"test": "tsx --test \"src/**/*.test.ts\""`.
   현재 `test:af`만 존재해 `precommit-gate.sh`가 제대로 동작하지 않음. 하네스의 필수 전제조건.
5. `CLAUDE.md` §10 신규 섹션 append
6. 단위 테스트 (6.1 표)
7. 커밋 + PR
8. Mike 재시작 후 E2E 진단 (6.2 시나리오)

---

## 9. 참고

- Claude Code hooks: https://docs.claude.com/en/docs/claude-code/hooks
- `superpowers:using-git-worktrees` 스킬
- 기존 Compass spec 5개 (`docs/superpowers/specs/`)
- 메모리: `feedback_recommendation_driven_workflow.md`, `feedback_git_worktree_default.md`, `feedback_account_separation.md`
