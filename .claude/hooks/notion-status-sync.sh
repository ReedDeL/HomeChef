#!/usr/bin/env bash
# Fires on Stop, after a Claude Code turn that touched the HomeChef working
# tree. Dedupes on a hash of the uncommitted diff so an idle Stop (no new
# changes since the last fire) doesn't re-trigger, then hands off to a
# background `claude -p` run that appends a Status Reports row and,
# only on a confident title match, nudges a Project Management card's
# Status/Gantt dates. See .claude/settings.local.json for the hook wiring.
set -euo pipefail

PROJECT_DIR="/home/rjdel/Projects/HomeChef"
STATE_FILE="$PROJECT_DIR/.claude/.notion-sync-state"
LOG_FILE="$PROJECT_DIR/.claude/.notion-sync.log"

# Drain the hook's stdin JSON payload; this script doesn't need it.
cat >/dev/null || true

cd "$PROJECT_DIR" || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

CHANGES="$(git status --porcelain -- . 2>/dev/null)"
if [ -z "$CHANGES" ]; then
  exit 0
fi

DIFF_HASH="$(git diff HEAD -- . 2>/dev/null | sha256sum | cut -d' ' -f1)"
STATUS_HASH="$(printf '%s' "$CHANGES" | sha256sum | cut -d' ' -f1)"
SIG="${DIFF_HASH}-${STATUS_HASH}"

LAST_SIG=""
[ -f "$STATE_FILE" ] && LAST_SIG="$(cat "$STATE_FILE")"

if [ "$SIG" = "$LAST_SIG" ]; then
  exit 0
fi
echo "$SIG" >"$STATE_FILE"

STAT_SUMMARY="$(git diff HEAD --stat -- . 2>/dev/null)"

PROMPT=$(cat <<EOF
HomeChef repo work just finished this turn. Uncommitted changes (working tree
is $PROJECT_DIR):

$STAT_SUMMARY

$CHANGES

Do two things using the Notion MCP tools. Only touch what is described below —
nothing else in Notion.

1. Append ONE new row to the Status Reports table on the Notion page
   3b06705e-9509-80e0-80a9-f22a53145549, matching its existing
   Date | Action | Owner | Notes/Action Breakdown format exactly.
   - Date: today, YYYY-MM-DD.
   - Owner: "Claude Code".
   - Action: a short imperative summary of what changed (commit-message style).
   - Notes: a brief bullet breakdown, in the style of the existing rows.
   Run \`git diff HEAD\` and \`git log -3\` in $PROJECT_DIR yourself for detail if
   the summary above isn't enough. Do not edit or remove any existing rows.

2. Search the Project Management database
   (collection://3ab6705e-9509-807d-8cce-000b341d2da4) for an existing card
   whose title clearly corresponds to this change — a strong keyword/feature
   match, not a loose guess. ONLY if you find a confident match:
   - Move its Status forward as appropriate (Not started -> In progress ->
     Done) based on whether this change completes that card's scope.
   - If you set Status to Done and End date is empty, set End date to today.
   Do not create new cards, do not touch Start date, and do not modify any
   card at all if you're not confident of the match — skip step 2 silently
   rather than guessing.
EOF
)

nohup /home/rjdel/.local/bin/claude -p "$PROMPT" \
  --allowedTools "Bash(git diff:*),Bash(git log:*),Bash(git status:*),mcp__claude_ai_Notion__notion-search,mcp__claude_ai_Notion__notion-fetch,mcp__claude_ai_Notion__notion-update-page,mcp__claude_ai_Notion__notion-query-data-sources" \
  --add-dir "$PROJECT_DIR" \
  </dev/null >>"$LOG_FILE" 2>&1 &

exit 0
