# Compass 통합 하네스 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compass 프로젝트에 매 작업(feature/fix/refactor/docs)의 공통 흐름을 자동화하는 5개 구성요소 하네스를 설치한다 — SessionStart 브리핑, `/compass-start` 슬래시 커맨드, 커밋 전 tsc+test 게이트, PR 후 CodeRabbit/Vercel 자동화, CLAUDE.md §10 컨벤션.

**Architecture:** 3개 shell 스크립트(`scripts/compass-harness/`)가 로직을 보유하고, `.claude/settings.json`이 3개 훅(`SessionStart`, `PreToolUse:Bash`, `PostToolUse:Bash`)을 스크립트에 바인딩. `.claude/commands/compass-start.md`가 슬래시 커맨드, `CLAUDE.md` append로 컨벤션 명문화.

**Tech Stack:** Bash + jq + gh CLI + Claude Code hooks schema + Next.js/tsx 기존 워크플로우

**Spec:** `docs/superpowers/specs/2026-04-24-compass-harness-design.md`

**Branch:** `feat/compass-harness` (이미 체크아웃됨, 스펙 커밋 `2b7db1b` 위에 쌓음)

---

## 파일 구조

| 파일 | 작업 | 책임 |
|---|---|---|
| `package.json` | modify | `scripts.test` 범용 필드 추가 (precommit gate 전제조건) |
| `scripts/compass-harness/session-brief.sh` | create | 세션 시작 시 git/PR/spec 요약 stdout 출력 |
| `scripts/compass-harness/precommit-gate.sh` | create | `git commit` 전 tsc + test 검증 |
| `scripts/compass-harness/postpr-enrich.sh` | create | `gh pr create` 후 CodeRabbit 트리거 + Vercel URL 보고 |
| `.claude/commands/compass-start.md` | create | `/compass-start <type> <name>` 슬래시 커맨드 안내 |
| `.claude/settings.json` | create | 3개 훅 등록 (script 파일 경로 참조) |
| `CLAUDE.md` | modify (append) | §10 작업 컨벤션 섹션 추가 |

---

## Task 1: `package.json` test 스크립트 추가

**근거:** 스펙 §4.4 precommit gate가 `npm test`를 호출하지만 현재 package.json에는 `test:af`만 있어 mmm-data 등 나머지 테스트가 제외됨. 범용 `test` 필드 신설.

**Files:**
- Modify: `package.json` (scripts 블록)

- [ ] **Step 1: 현재 package.json scripts 확인**

Run: `jq '.scripts' package.json`
Expected: `test` 키가 **없음**. `test:af`만 존재.

- [ ] **Step 2: `scripts.test` 필드 추가**

Edit `package.json`, `scripts` 블록에 `"test:af"` 바로 앞에 아래 라인 추가:
```json
"test": "tsx --test \"src/**/*.test.ts\"",
```

수정 후 `scripts` 블록 예시:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "tsx --test \"src/**/*.test.ts\"",
  "crawl:st": "cd crawler && npx tsx src/index.ts",
  "crawl:st:login": "cd crawler && npx tsx src/index.ts --login",
  "crawl:st:dry": "cd crawler && npx tsx src/index.ts --dry-run --limit 1",
  "crawl:st:discover": "cd crawler && npx tsx src/discover.ts",
  "fetch:af": "tsx scripts/fetch-appsflyer.ts",
  "fetch:af:dry": "tsx scripts/fetch-appsflyer.ts -- --dry-run",
  "test:af": "tsx --test src/shared/api/appsflyer/__tests__/*.test.ts"
}
```

- [ ] **Step 3: `npm test` 실행하여 전체 테스트 통과 확인**

Run: `npm test`
Expected: 모든 `src/**/*.test.ts` 파일의 node:test 통과. 최소 mmm-data.test.ts 16/16 + appsflyer 4파일 전부 통과.

실패 시: 테스트 runner가 glob을 해석 못 하는 경우 tsx 버전 확인 (`npx tsx --version`, 4.x 이상 필요). glob 문제면 quote 변경 또는 package.json의 `"test"` 값을 `"tsx --test src/shared/api/__tests__/mmm-data.test.ts src/shared/api/appsflyer/__tests__/*.test.ts"` 로 명시적 나열.

- [ ] **Step 4: 커밋**

```bash
git add package.json
git commit -m "$(cat <<'EOF'
chore(harness): add unified npm test script — prerequisite for precommit gate

기존 test:af는 AppsFlyer 전용. mmm-data 등 다른 node:test 파일을
포함하는 범용 test 필드 신설. 하네스 precommit-gate.sh의 전제조건.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `session-brief.sh` 작성

**근거:** 스펙 §4.2. SessionStart 훅이 호출할 스크립트. git/PR/spec 상태를 markdown으로 출력하면 Claude Code가 `additionalContext`로 주입.

**Files:**
- Create: `scripts/compass-harness/session-brief.sh`

- [ ] **Step 1: 디렉토리 생성**

Run: `mkdir -p scripts/compass-harness`
Expected: 에러 없음.

- [ ] **Step 2: 스크립트 작성**

Create `scripts/compass-harness/session-brief.sh` with exact content:

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

- [ ] **Step 3: 실행 권한 부여**

Run: `chmod +x scripts/compass-harness/session-brief.sh`
Expected: 에러 없음.

- [ ] **Step 4: 단독 실행 테스트**

Run: `bash scripts/compass-harness/session-brief.sh`
Expected stdout:
- `# Compass 세션 컨텍스트 (auto-injected)` 헤더 존재
- `## 현재 브랜치` 아래 `feat/compass-harness` 표시
- `## 최근 커밋 3개` 아래 `2b7db1b docs(harness):` 시작 라인 표시
- `## 열린 PR` 아래 PR #5 (MMM dashboard) 표시
- `## 최신 스펙 3개` 아래 `2026-04-24-compass-harness-design.md` 포함
- `## 활성 worktree` 아래 적어도 1개 (main 경로) 표시

실패 시: 스크립트에 syntax 오류이면 `bash -n scripts/compass-harness/session-brief.sh`로 체크. gh 인증 오류면 `gh auth status`로 확인.

- [ ] **Step 5: 커밋**

```bash
git add scripts/compass-harness/session-brief.sh
git commit -m "$(cat <<'EOF'
feat(harness): session-brief.sh — SessionStart hook 컨텍스트 출력

현재 브랜치/최근 커밋 3개/열린 PR/최신 스펙 3개/활성 worktree를
markdown으로 출력. Claude Code가 세션 시작 시 additionalContext로 주입.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `precommit-gate.sh` 작성

**근거:** 스펙 §4.4. PreToolUse:Bash 훅이 호출. `git commit`일 때만 tsc + test 실행, 실패 시 exit 2로 차단.

**Files:**
- Create: `scripts/compass-harness/precommit-gate.sh`

- [ ] **Step 1: 스크립트 작성**

Create `scripts/compass-harness/precommit-gate.sh` with exact content:

```bash
#!/usr/bin/env bash
# scripts/compass-harness/precommit-gate.sh
# PreToolUse:Bash hook — git commit 전에 tsc + test 자동 검증
set -uo pipefail

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

if ! echo "$CMD" | grep -qE '(^|[[:space:]&;|])git[[:space:]]+commit([[:space:]]|$)'; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

echo "━━━ Compass pre-commit gate ━━━" >&2

echo "▸ tsc --noEmit..." >&2
if ! npx tsc --noEmit 2>&1 >&2; then
  cat >&2 <<EOF
❌ 커밋 차단: TypeScript 타입 오류 발견
   위 출력의 오류를 먼저 수정하세요.
EOF
  exit 2
fi
echo "  ✅ tsc 통과" >&2

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

echo "━━━ 게이트 통과 — 커밋 진행 ━━━" >&2
exit 0
```

- [ ] **Step 2: 실행 권한 부여**

Run: `chmod +x scripts/compass-harness/precommit-gate.sh`

- [ ] **Step 3: "git commit 아닌 명령" 통과 테스트**

Run:
```bash
echo '{"tool_input":{"command":"ls -la"}}' | bash scripts/compass-harness/precommit-gate.sh
echo "exit=$?"
```
Expected: `exit=0`, stderr 출력 없음 (tsc/test 안 돌아야 함).

- [ ] **Step 4: "git commit 명령" 통과 테스트**

Run:
```bash
echo '{"tool_input":{"command":"git commit -m test"}}' | bash scripts/compass-harness/precommit-gate.sh
echo "exit=$?"
```
Expected: `━━━ Compass pre-commit gate ━━━` 출력 → tsc 통과 → test 통과 → `━━━ 게이트 통과 ━━━`. 최종 `exit=0`.

실패 시: 현재 브랜치 상태에 이미 tsc/test 오류가 있다는 뜻. 그 오류를 먼저 수정해야 전체 플랜이 진행됨.

- [ ] **Step 5: "tsc 실패 시 차단" 테스트**

먼저 일부러 타입 오류 파일 생성:
```bash
cat > src/__harness_test_tsc.ts <<'EOF'
const x: number = "this is a string";
EOF
```

Run:
```bash
echo '{"tool_input":{"command":"git commit -m test"}}' | bash scripts/compass-harness/precommit-gate.sh
echo "exit=$?"
```
Expected: tsc 오류 출력 + `❌ 커밋 차단: TypeScript 타입 오류` + `exit=2`.

정리:
```bash
rm src/__harness_test_tsc.ts
```

- [ ] **Step 6: 커밋**

```bash
git add scripts/compass-harness/precommit-gate.sh
git commit -m "$(cat <<'EOF'
feat(harness): precommit-gate.sh — git commit 전 tsc + test 게이트

stdin으로 PreToolUse:Bash hook JSON 수신, git commit일 때만
tsc --noEmit + npm test 실행. 실패 시 exit 2로 커밋 차단.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(주의: 이 커밋은 precommit-gate.sh 자체가 아직 hook으로 등록되기 전이라 게이트 없이 통과. 정상 동작.)

---

## Task 4: `postpr-enrich.sh` 작성

**근거:** 스펙 §4.5. PostToolUse:Bash 훅이 호출. `gh pr create` 성공 후 CodeRabbit 트리거 + Vercel URL 폴링.

**Files:**
- Create: `scripts/compass-harness/postpr-enrich.sh`

- [ ] **Step 1: 스크립트 작성**

Create `scripts/compass-harness/postpr-enrich.sh` with exact content:

```bash
#!/usr/bin/env bash
# scripts/compass-harness/postpr-enrich.sh
# PostToolUse:Bash hook — gh pr create 직후 CodeRabbit 트리거 + Vercel URL 조회
set -uo pipefail

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")
STDOUT=$(echo "$INPUT" | jq -r '.tool_response.stdout // ""' 2>/dev/null || echo "")
EXIT_CODE=$(echo "$INPUT" | jq -r '.tool_response.exit_code // 1' 2>/dev/null || echo "1")

if ! echo "$CMD" | grep -qE '(^|[[:space:]&;|])gh[[:space:]]+pr[[:space:]]+create'; then
  exit 0
fi
if [ "$EXIT_CODE" != "0" ]; then
  exit 0
fi

PR_URL=$(echo "$STDOUT" | grep -oE 'https://github\.com/[^[:space:]]+/pull/[0-9]+' | head -1)
if [ -z "$PR_URL" ]; then
  exit 0
fi
PR_NUM=$(echo "$PR_URL" | grep -oE '[0-9]+$')

echo "━━━ Compass post-PR enrichment (PR #$PR_NUM) ━━━" >&2

if command -v gh >/dev/null 2>&1; then
  if gh pr comment "$PR_NUM" --body "@coderabbitai review" >/dev/null 2>&1; then
    echo "  ✅ CodeRabbit review 트리거됨" >&2
  else
    echo "  ⚠️  CodeRabbit 트리거 실패 (수동 추가 필요)" >&2
  fi
fi

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

- [ ] **Step 2: 실행 권한 부여**

Run: `chmod +x scripts/compass-harness/postpr-enrich.sh`

- [ ] **Step 3: "gh pr create 아닌 명령" 통과 테스트**

Run:
```bash
echo '{"tool_input":{"command":"ls"},"tool_response":{"exit_code":0,"stdout":""}}' | bash scripts/compass-harness/postpr-enrich.sh
echo "exit=$?"
```
Expected: `exit=0`, stderr 출력 없음.

- [ ] **Step 4: "gh pr create 실패" 통과 테스트**

Run:
```bash
echo '{"tool_input":{"command":"gh pr create"},"tool_response":{"exit_code":1,"stdout":""}}' | bash scripts/compass-harness/postpr-enrich.sh
echo "exit=$?"
```
Expected: `exit=0`, stderr 출력 없음 (실패 시 enrichment 안 돌음).

- [ ] **Step 5: "PR URL 없는 성공" 통과 테스트**

Run:
```bash
echo '{"tool_input":{"command":"gh pr create"},"tool_response":{"exit_code":0,"stdout":"created without url"}}' | bash scripts/compass-harness/postpr-enrich.sh
echo "exit=$?"
```
Expected: `exit=0`, stderr 출력 없음 (URL 파싱 실패하면 조용히 종료).

- [ ] **Step 6: 실제 PR URL 주입 테스트 (선택, 30초 소요)**

실제 열린 PR #5 번호로 dry-run 테스트 (코멘트는 실제 추가됨):
```bash
echo '{"tool_input":{"command":"gh pr create"},"tool_response":{"exit_code":0,"stdout":"https://github.com/treenod-mike/compass/pull/5"}}' | bash scripts/compass-harness/postpr-enrich.sh
echo "exit=$?"
```
Expected: `━━━ Compass post-PR enrichment (PR #5) ━━━` → CodeRabbit 트리거 성공 → Vercel URL 찾음 → `exit=0`.

주의: 실제 PR에 `@coderabbitai review` 코멘트가 중복 추가됨. 이미 PR #5에는 여러 번 붙었으니 한 번 더 붙어도 무해. 원치 않으면 이 Step은 건너뛰고 Task 8의 실제 PR 생성에서 확인.

- [ ] **Step 7: 커밋**

```bash
git add scripts/compass-harness/postpr-enrich.sh
git commit -m "$(cat <<'EOF'
feat(harness): postpr-enrich.sh — PR 생성 후 CodeRabbit/Vercel 자동 보고

stdin으로 PostToolUse:Bash hook JSON 수신, gh pr create 성공 시만
동작. PR에 @coderabbitai review 코멘트 자동 추가, Vercel bot의
preview URL을 30초간 폴링해서 stderr로 Claude에게 보고.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `/compass-start` 슬래시 커맨드 작성

**근거:** 스펙 §4.3. 새 작업 시작 시 worktree + 브랜치 + npm install + brainstorming을 한 커맨드로 축약하는 Claude 자연어 지시서.

**Files:**
- Create: `.claude/commands/compass-start.md`

- [ ] **Step 1: 디렉토리 생성**

Run: `mkdir -p .claude/commands`
Expected: 에러 없음.

- [ ] **Step 2: 슬래시 커맨드 markdown 작성**

Create `.claude/commands/compass-start.md` with exact content:

```markdown
---
description: Compass 새 작업 시작 — worktree + 브랜치 + npm install + (필요 시) brainstorming
argument-hint: <type: feature|fix|refactor|docs> <name>
---

# /compass-start

입력:
- `$1` = type (`feature` | `fix` | `refactor` | `docs` 중 하나)
- `$2` = name (kebab-case, 예: `mmm-v3`, `fadein-delay-prop`)

## 실행 순서

1. **입력 검증**
   - `$1`이 `feature` / `fix` / `refactor` / `docs` 중 하나인지 확인, 아니면 에러 메시지 출력 후 종료
   - `$2`가 `^[a-z][a-z0-9-]+$` 패턴인지 확인, 아니면 에러

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
   이미 같은 이름의 worktree가 있으면 오류 출력 + 기존 경로 안내 후 종료.

4. **종속성 설치 (백그라운드)**
   - worktree 디렉토리에서 `npm install --legacy-peer-deps`를 백그라운드로 실행
   - 사용자에게 "의존성 설치 중 — 몇 분 걸릴 수 있음" 안내

5. **타입별 후속 액션**
   - `feature` 또는 `refactor` → `superpowers:brainstorming` 스킬 자동 호출
   - `fix` → `superpowers:systematic-debugging` 스킬 자동 호출
   - `docs` → 바로 편집 모드 진입 (brainstorming 스킵)

6. **작업 디렉토리 전환 안내**
   - Claude에게 "이후 모든 파일 편집은 `../compass-worktrees/<type>-<name>/` 디렉토리에서 수행" 알림

## 주의

- Compass 루트(`/Users/mike/Downloads/Project Compass/`)에서 실행 가정
- 메타 파일(`docs/`, `CLAUDE.md`, `scripts/`, `README.md`) 수정은 worktree 없이 main에서 해도 됨 (CLAUDE.md §10.2 참고)
- 동일한 이름의 worktree가 이미 있으면 오류 + 기존 경로 안내
```

- [ ] **Step 3: 파일 검증**

Run: `test -f .claude/commands/compass-start.md && echo "exists"`
Expected: `exists`

- [ ] **Step 4: 커밋**

```bash
git add .claude/commands/compass-start.md
git commit -m "$(cat <<'EOF'
feat(harness): /compass-start slash command

새 작업 시작 시 worktree + 브랜치 + npm install +
(feature/refactor→brainstorming, fix→debugging) 자동화.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `.claude/settings.json` 훅 등록

**근거:** 스펙 §4.1. 3개 스크립트를 Claude Code 훅으로 바인딩. **모든 스크립트가 존재한 뒤 마지막에 등록**해야 파일 부재 에러를 피함.

**Files:**
- Create: `.claude/settings.json`

- [ ] **Step 1: settings.json 작성**

Create `.claude/settings.json` with exact content:

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

- [ ] **Step 2: JSON 유효성 검증**

Run: `jq empty .claude/settings.json && echo "valid JSON"`
Expected: `valid JSON`, 에러 없음.

- [ ] **Step 3: 참조 파일 존재 확인**

Run:
```bash
for f in scripts/compass-harness/session-brief.sh scripts/compass-harness/precommit-gate.sh scripts/compass-harness/postpr-enrich.sh; do
  test -x "$f" && echo "$f ✓ executable" || echo "$f ✗ MISSING or not executable"
done
```
Expected: 세 파일 모두 `✓ executable`.

실패 시: 앞 Task의 `chmod +x` 단계를 놓쳤을 가능성. 해당 파일에 `chmod +x <path>` 수행.

- [ ] **Step 4: 커밋**

```bash
git add .claude/settings.json
git commit -m "$(cat <<'EOF'
feat(harness): .claude/settings.json — 3개 훅 등록

SessionStart → session-brief.sh
PreToolUse:Bash → precommit-gate.sh
PostToolUse:Bash → postpr-enrich.sh

Claude Code 재시작 후 활성화됨.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `CLAUDE.md` §10 컨벤션 섹션 추가

**근거:** 스펙 §4.6. Mike 프로필·worktree 규약·계정 분리·하네스 작동 목록을 CLAUDE.md에 명문화. 메모리에만 있던 내용을 프로젝트 파일로 승격.

**Files:**
- Modify: `CLAUDE.md` (append at end of file)

- [ ] **Step 1: 현재 CLAUDE.md 끝 라인 확인**

Run: `tail -5 CLAUDE.md`
Expected 현재 마지막 섹션은 "§9 외부 데이터 갱신 (Sensor Tower 크롤러)"의 "트러블슈팅" 문단 — 끝은 ``crawler/README.md` 참조.`` 비슷한 문장.

- [ ] **Step 2: §10 섹션을 파일 끝에 append**

CLAUDE.md 끝에 빈 줄 하나 두고 아래 내용 추가:

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

- [ ] **Step 3: 검증**

Run: `grep -n "^## 10\. 작업 컨벤션" CLAUDE.md`
Expected: `N:## 10. 작업 컨벤션 (하네스)` (N = 해당 라인 번호)

Run: `grep -c "### 10\." CLAUDE.md`
Expected: `5` (10.1~10.5 다섯 개 하위 섹션)

- [ ] **Step 4: 커밋**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(harness): CLAUDE.md §10 작업 컨벤션 섹션 추가

Mike 프로필(비개발자, 추천-OK), worktree 기본 규약,
회사/개인 계정 분리, 하네스 자동 작동 목록과 범위 밖 수동
도구를 명문화. 메모리에만 있던 규약을 프로젝트 파일로 승격.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: PR 생성 및 수동 검증

**근거:** 스펙 §6. 하네스 자체를 하네스로 검증하는 단계. 주의: 이 시점엔 Claude Code 재시작 전이라 `postpr-enrich.sh`가 자동으로 붙지 않음 — 수동으로 동일한 효과 확인.

**Files:**
- 변경 없음 (git push + gh pr create)

- [ ] **Step 1: 브랜치 푸시**

Run: `git push -u origin feat/compass-harness`
Expected: 원격에 새 브랜치 생성, 커밋 8개(스펙 + 7개 Task 커밋) 업로드.

- [ ] **Step 2: PR 생성**

Run:
```bash
gh pr create --title "feat(harness): Compass 통합 하네스 — 5개 MVP 설치" --body "$(cat <<'EOF'
## Summary
- Compass 매 작업에 공통으로 적용할 5개 MVP 하네스 설치
- 3개 shell 훅(`SessionStart`, `PreToolUse:Bash`, `PostToolUse:Bash`) + 1개 slash command + CLAUDE.md §10 컨벤션
- Spec: `docs/superpowers/specs/2026-04-24-compass-harness-design.md`
- Plan: `docs/superpowers/plans/2026-04-24-compass-harness.md`

## Changes
- `package.json`: 범용 `test` 스크립트 추가 (전제조건)
- `scripts/compass-harness/`: session-brief / precommit-gate / postpr-enrich 3종
- `.claude/commands/compass-start.md`: 신규 슬래시 커맨드
- `.claude/settings.json`: 3개 훅 등록
- `CLAUDE.md`: §10 작업 컨벤션 섹션 추가

## Activation
Claude Code **재시작 필요**. 재시작 후 자동 동작:
- 세션 시작 → git/PR/spec 요약 자동 주입
- `git commit` → tsc + test 자동 실행, 실패 시 차단
- `gh pr create` → CodeRabbit 트리거 + Vercel URL 자동 보고

## Test plan
- [ ] Claude Code 재시작 후 세션 시작 브리핑 표시 확인
- [ ] 일부러 타입 오류 만들어 `git commit` 차단 동작 확인
- [ ] 테스트용 dummy PR 생성하여 CodeRabbit/Vercel 자동 보고 확인
- [ ] `/compass-start docs test-dummy` 호출로 worktree 생성 확인

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
Expected: PR URL 출력 (예: `https://github.com/treenod-mike/compass/pull/6`).

- [ ] **Step 3: 수동으로 CodeRabbit 트리거 (hook 없는 지금 회차만)**

위에서 받은 PR 번호를 `<PR_NUM>`으로 치환하여:
```bash
gh pr comment <PR_NUM> --body "@coderabbitai review"
```
Expected: 코멘트 추가 성공 메시지.

- [ ] **Step 4: Mike에게 재시작 안내**

사용자(Mike)에게 전달할 메시지:
```
구현 완료. 다음 단계:
1. 이 Claude Code 세션을 /exit 또는 Ctrl+C 두 번으로 종료
2. 터미널에서 claude 재실행 (같은 폴더)
3. 재시작 후 "하네스 테스트" 라고 말씀하시면 5개 구성요소가 제대로 로드됐는지 진단

PR: <위에서 받은 URL>
```

---

## Task 9: 재시작 후 E2E 진단 (재시작된 세션에서 수행)

**전제:** Claude Code 재시작 후 새 세션에서 실행. Task 8 완료 후.

**Files:**
- 변경 없음 (진단 전용)

- [ ] **Step 1: SessionStart 브리핑 확인**

새 세션 시작 직후 Claude의 첫 응답에 다음 내용이 포함됐는지 확인:
- "Compass 세션 컨텍스트 (auto-injected)" 헤더
- 현재 브랜치, 최근 커밋 3개, 열린 PR, 최신 스펙

Expected: 포함됨. 없으면 `.claude/settings.json` 파싱 실패 또는 스크립트 경로 오류.

- [ ] **Step 2: `/compass-start` 슬래시 커맨드 인식 확인**

새 세션에서 `/compass-start` 입력 후 자동완성 또는 help 표시 확인.
Expected: `<type> <name>` argument hint 표시.

- [ ] **Step 3: precommit-gate 동작 확인 (dry-run)**

새 세션에서 Claude에게: "타입 오류 있는 더미 파일 만들고 git commit 시도해서 게이트 차단 확인해줘"라고 요청.
Expected:
- Claude가 `src/__harness_test.ts` 같은 파일 생성
- `git commit` 시도 시 게이트 작동 → 차단 메시지 + tsc 오류 출력
- Claude가 더미 파일 삭제 후 종료

- [ ] **Step 4: postpr-enrich 동작 확인 (선택)**

이미 PR 열려 있으면 추가 PR 생성은 불필요. 이미 PR #6(이 PR)이 Task 8에서 만들어졌으므로 Task 8 Step 3에서 수동으로 확인한 것과 동일. 새로운 dummy PR로 확인하고 싶으면:
- `/compass-start docs harness-e2e-test` 호출
- worktree에서 README에 한 줄 추가 + 커밋
- `gh pr create` 실행 → 자동으로 CodeRabbit 코멘트 + Vercel URL stderr 출력 확인
- 확인 후 PR close + `git worktree remove ../compass-worktrees/docs-harness-e2e-test`

- [ ] **Step 5: Mike 리뷰 + 머지**

PR #6 리뷰 후 `gh pr merge --squash --delete-branch` 또는 GitHub UI에서 머지.

---

## Self-Review 결과

**1. Spec coverage (§ 매핑):**
- §4.1 settings.json → Task 6 ✅
- §4.2 session-brief.sh → Task 2 ✅
- §4.3 /compass-start → Task 5 ✅
- §4.4 precommit-gate.sh → Task 3 ✅
- §4.5 postpr-enrich.sh → Task 4 ✅
- §4.6 CLAUDE.md §10 → Task 7 ✅
- §5 재시작 절차 → Task 8 Step 4 + Task 9 ✅
- §6.1 단위 테스트 → 각 Task 내 검증 Step ✅
- §6.2 E2E 시나리오 → Task 9 ✅
- §8 구현 순서 — step 4 package.json → Task 1 ✅

**2. Placeholder 스캔:** "TBD", "TODO", "fill in" 등 없음. 각 Step에 실제 명령/코드 전체 포함.

**3. Type/이름 일관성:**
- 스크립트 파일명 3개 — 모든 Task에서 동일한 이름 사용 확인됨
- settings.json의 `$CLAUDE_PROJECT_DIR` 환경변수 — Task 6에서 정의, Task 9에서 재시작 후 검증 전제로 사용 — 일관

**4. Task 독립성 확인:**
- Task 1(package.json)은 Task 3(precommit-gate test step)의 전제. 순서 맞음.
- Task 2–5는 서로 독립. 순서 바뀌어도 OK. 단 Task 6(settings.json)은 모든 스크립트 존재 후 수행 — 명시됨.
- Task 7(CLAUDE.md)는 다른 Task와 독립. 언제 해도 됨.
- Task 8(PR)은 반드시 마지막. Task 9는 재시작 후 신규 세션.
