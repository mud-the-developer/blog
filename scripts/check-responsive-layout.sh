#!/usr/bin/env bash
set -euo pipefail

STYLE_FILE="${1:-static/assets/style.css}"

if [[ ! -f "$STYLE_FILE" ]]; then
  echo "::error::Style file '$STYLE_FILE' does not exist."
  exit 1
fi

extract_block() {
  local start_marker="$1"
  local end_marker="$2"

  awk -v start="$start_marker" -v end="$end_marker" '
    index($0, start) {
      in_block = 1
    }
    in_block {
      if (index($0, end)) {
        exit
      }
      print
    }
  ' "$STYLE_FILE"
}

assert_regex() {
  local haystack="$1"
  local regex="$2"
  local message="$3"

  if ! printf '%s' "$haystack" | perl -0ne "exit((/$regex/s) ? 0 : 1)"; then
    echo "::error::${message}"
    exit 1
  fi
}

block_1360="$(extract_block "@media (max-width: 1360px)" "@media (max-width: 1080px)")"
block_1080="$(extract_block "@media (max-width: 1080px)" "@media (max-width: 760px)")"

if [[ -z "$block_1360" || -z "$block_1080" ]]; then
  echo "::error::Required responsive media blocks were not found in '$STYLE_FILE'."
  exit 1
fi

assert_regex \
  "$block_1360" \
  'grid-template-areas:\s*"tabs main"\s*"graph graph";' \
  "1360px breakpoint must stack graph beneath tabs/main."

assert_regex \
  "$block_1360" \
  '\.live-graph\s*\{[^}]*position:\s*static;[^}]*top:\s*auto;' \
  "1360px breakpoint must disable sticky behavior for .live-graph to avoid overlap."

assert_regex \
  "$block_1080" \
  '\.page-tabs,\s*\.live-graph\s*\{[^}]*position:\s*static;[^}]*top:\s*auto;[^}]*max-height:\s*none;' \
  "1080px breakpoint must keep .page-tabs and .live-graph non-sticky."

echo "Responsive layout guard check passed."
