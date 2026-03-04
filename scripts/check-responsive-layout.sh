#!/usr/bin/env bash
set -euo pipefail

STYLE_FILE="${1:-static/assets/style-core.css}"

if [[ ! -f "$STYLE_FILE" ]]; then
  echo "::error::Style file '$STYLE_FILE' does not exist."
  exit 1
fi

assert_regex() {
  local haystack="$1"
  local regex="$2"
  local message="$3"

  if ! printf '%s' "$haystack" | perl -0ne "exit((/$regex/s) ? 0 : 1)"; then
    echo "::error::${message}"
    exit 1
  fi
}

content="$(cat "$STYLE_FILE")"

assert_regex \
  "$content" \
  '@media\s*\(max-width:\s*1360px\)\s*\{[\s\S]*?grid-template-areas:\s*"tabs main"\s*"graph graph";?' \
  "1360px breakpoint must stack graph beneath tabs/main."

assert_regex \
  "$content" \
  '@media\s*\(max-width:\s*1360px\)\s*\{[\s\S]*?\.live-graph\s*\{[^}]*position:\s*static;[^}]*top:\s*auto;?' \
  "1360px breakpoint must disable sticky behavior for .live-graph to avoid overlap."

assert_regex \
  "$content" \
  '@media\s*\(max-width:\s*1080px\)\s*\{[\s\S]*?(?:\.page-tabs,\s*\.live-graph|\.live-graph,\s*\.page-tabs)\s*\{[^}]*position:\s*static;[^}]*top:\s*auto;[^}]*max-height:\s*none;?' \
  "1080px breakpoint must keep .page-tabs and .live-graph non-sticky."

echo "Responsive layout guard check passed."
