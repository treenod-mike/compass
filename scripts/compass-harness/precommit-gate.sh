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
