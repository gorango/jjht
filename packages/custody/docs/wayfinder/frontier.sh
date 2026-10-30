#!/usr/bin/env bash
# Print open, unassigned tickets whose blockers are all closed.
# Usage: ./frontier.sh
set -euo pipefail
cd "$(dirname "$0")"

status_of() {
  # $1 is a ticket id, e.g. C03
  local f
  f=$(ls tickets/"$1"-*.md 2>/dev/null | head -1)
  [ -n "$f" ] || { echo "missing"; return; }
  sed -n 's/^status: *//p' "$f" | head -1
}

for f in tickets/*.md; do
  [ -e "$f" ] || continue
  id=$(sed -n 's/^id: *//p' "$f" | head -1)
  title=$(sed -n 's/^title: *//p' "$f" | head -1 | tr -d '"')
  status=$(sed -n 's/^status: *//p' "$f" | head -1)
  assignee=$(sed -n 's/^assignee: *//p' "$f" | head -1)
  [ "$status" = "open" ] || continue
  [ "$assignee" = "null" ] || [ -z "$assignee" ] || continue
  blockers=$(sed -n 's/^blocked_by: *//p' "$f" | head -1)
  ready=1
  for b in $(printf '%s' "$blockers" | tr -d '[]' | tr ',' ' '); do
    [ -z "$b" ] && continue
    [ "$(status_of "$b")" = "closed" ] || { ready=0; break; }
  done
  if [ "$ready" = "1" ]; then
    printf '%s\t%s\n' "$id" "$title"
  fi
done
