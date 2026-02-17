#!/usr/bin/env bash
set -euo pipefail

DIST_DIR="${1:-dist}"

if [[ ! -d "$DIST_DIR" ]]; then
  echo "::error::Distribution directory '$DIST_DIR' does not exist."
  exit 1
fi

normalize_path() {
  local raw="$1"
  local cleaned
  cleaned="${raw%%#*}"
  cleaned="${cleaned%%\?*}"
  printf "%s" "$cleaned"
}

link_target_exists() {
  local link_path="$1"

  if [[ "$link_path" == "/" ]]; then
    [[ -f "$DIST_DIR/index.html" ]]
    return
  fi

  local relative="${link_path#/}"

  if [[ -f "$DIST_DIR/$relative" ]]; then
    return
  fi

  if [[ -f "$DIST_DIR/$relative/index.html" ]]; then
    return
  fi

  if [[ -f "$DIST_DIR/${relative%/}/index.html" ]]; then
    return
  fi

  return 1
}

missing=0

extract_link_rows() {
  if command -v rg >/dev/null 2>&1; then
    rg --line-number --with-filename --only-matching '(href|src)="/[^"]*"' "$DIST_DIR" --glob '*.html'
    return
  fi

  grep -RnoE --include='*.html' '(href|src)="/[^"]*"' "$DIST_DIR"
}

while IFS='|' read -r source_file link; do
  [[ -n "$source_file" ]] || continue
  [[ -n "$link" ]] || continue

  normalized="$(normalize_path "$link")"

  if [[ -z "$normalized" ]]; then
    continue
  fi

  if [[ "$normalized" != /* ]]; then
    continue
  fi

  if [[ "$normalized" == '//'*/ ]]; then
    continue
  fi

  if ! link_target_exists "$normalized"; then
    echo "::error file=${source_file}::Broken internal link '${link}'"
    missing=$((missing + 1))
  fi
done < <(
  extract_link_rows \
    | sed -E 's/^([^:]+:[0-9]+):.*="([^"]*)"$/\1|\2/'
)

if (( missing > 0 )); then
  echo "::error::Found $missing broken internal link(s)."
  exit 1
fi

echo "Internal link check passed."
