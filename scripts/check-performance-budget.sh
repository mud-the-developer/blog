#!/usr/bin/env bash
set -euo pipefail

DIST_DIR="${1:-dist}"

if [[ ! -d "$DIST_DIR" ]]; then
  echo "::error::Distribution directory '$DIST_DIR' does not exist."
  exit 1
fi

MAX_SINGLE_GRAPH_JS=24576
MAX_SINGLE_FILETREE_JS=8192
MAX_TOTAL_JS=131072
MAX_TOTAL_CSS=65536
MAX_TOTAL_JSON=131072

warn_count=0

bytes_of() {
  wc -c < "$1" | tr -d ' '
}

sum_bytes() {
  local pattern="$1"
  local total=0
  while IFS= read -r -d '' file; do
    local size
    size="$(bytes_of "$file")"
    total=$((total + size))
  done < <(find "$DIST_DIR" -type f -name "$pattern" -print0)
  echo "$total"
}

human_size() {
  local bytes="$1"
  awk -v n="$bytes" 'BEGIN {
    if (n < 1024) {
      printf "%d B", n;
    } else if (n < 1024 * 1024) {
      printf "%.1f KiB", n / 1024;
    } else {
      printf "%.2f MiB", n / (1024 * 1024);
    }
  }'
}

warn_if_over() {
  local name="$1"
  local value="$2"
  local budget="$3"
  if (( value > budget )); then
    warn_count=$((warn_count + 1))
    echo "::warning::${name} exceeded budget ($(human_size "$value") > $(human_size "$budget"))."
  fi
}

graph_js="$DIST_DIR/assets/graph-view.js"
filetree_js="$DIST_DIR/assets/filetree.js"

if [[ -f "$graph_js" ]]; then
  graph_js_size="$(bytes_of "$graph_js")"
  warn_if_over "assets/graph-view.js" "$graph_js_size" "$MAX_SINGLE_GRAPH_JS"
fi

if [[ -f "$filetree_js" ]]; then
  filetree_js_size="$(bytes_of "$filetree_js")"
  warn_if_over "assets/filetree.js" "$filetree_js_size" "$MAX_SINGLE_FILETREE_JS"
fi

total_js="$(sum_bytes '*.js')"
total_css="$(sum_bytes '*.css')"
total_json="$(sum_bytes '*.json')"

warn_if_over "Total JS" "$total_js" "$MAX_TOTAL_JS"
warn_if_over "Total CSS" "$total_css" "$MAX_TOTAL_CSS"
warn_if_over "Total JSON" "$total_json" "$MAX_TOTAL_JSON"

echo "Performance budget summary: JS=$(human_size "$total_js"), CSS=$(human_size "$total_css"), JSON=$(human_size "$total_json")."

if (( warn_count > 0 )); then
  echo "::warning::Performance budget check completed with $warn_count warning(s)."
else
  echo "Performance budget check passed without warnings."
fi
