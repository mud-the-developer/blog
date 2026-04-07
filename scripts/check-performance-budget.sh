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
MAX_TOTAL_JSON=131072
MAX_SHARED_EDITORIAL_CSS=49152
MAX_COLLECTION_EDITORIAL_CSS=49152
MAX_HOME_EDITORIAL_CSS=53248
MAX_GRAPH_EDITORIAL_CSS=57344
MAX_READING_EDITORIAL_CSS=81920
MAX_RICH_READING_EDITORIAL_CSS=90112
MAX_NEWS_BRIDGE_CSS=16384

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

sum_selected_bytes() {
  local total=0
  local file
  for file in "$@"; do
    local path="$DIST_DIR/$file"
    if [[ -f "$path" ]]; then
      total=$((total + $(bytes_of "$path")))
    fi
  done
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

graph_js="$DIST_DIR/assets/graph-view.min.js"
filetree_js="$DIST_DIR/assets/filetree.min.js"

if [[ ! -f "$graph_js" ]]; then
  graph_js="$DIST_DIR/assets/graph-view.js"
fi

if [[ ! -f "$filetree_js" ]]; then
  filetree_js="$DIST_DIR/assets/filetree.js"
fi

if [[ -f "$graph_js" ]]; then
  graph_js_size="$(bytes_of "$graph_js")"
  warn_if_over "$(basename "$graph_js")" "$graph_js_size" "$MAX_SINGLE_GRAPH_JS"
fi

if [[ -f "$filetree_js" ]]; then
  filetree_js_size="$(bytes_of "$filetree_js")"
  warn_if_over "$(basename "$filetree_js")" "$filetree_js_size" "$MAX_SINGLE_FILETREE_JS"
fi

total_js="$(sum_bytes '*.js')"
total_css="$(sum_bytes '*.css')"
total_json="$(sum_bytes '*.json')"

warn_if_over "Total JS" "$total_js" "$MAX_TOTAL_JS"
warn_if_over "Total JSON" "$total_json" "$MAX_TOTAL_JSON"

shared_editorial_css="$(sum_selected_bytes \
  assets/style-core.css \
  assets/style-search-pane.css \
  assets/style-touch-targets.css \
  assets/style-editorial.css)"
collection_editorial_css="$(sum_selected_bytes \
  assets/style-core.css \
  assets/style-search-pane.css \
  assets/style-touch-targets.css \
  assets/style-editorial.css \
  assets/style-collection-editorial.css)"
home_editorial_css="$(sum_selected_bytes \
  assets/style-core.css \
  assets/style-search-pane.css \
  assets/style-touch-targets.css \
  assets/style-editorial.css \
  assets/style-home-editorial.css)"
graph_editorial_css="$(sum_selected_bytes \
  assets/style-core.css \
  assets/style-search-pane.css \
  assets/style-touch-targets.css \
  assets/style-graph.css \
  assets/style-editorial.css \
  assets/style-graph-editorial.css)"
reading_editorial_css="$(sum_selected_bytes \
  assets/style-core.css \
  assets/style-search-pane.css \
  assets/style-touch-targets.css \
  assets/style-graph.css \
  assets/style-note-core.css \
  assets/style-editorial.css \
  assets/style-note-editorial.css)"
rich_reading_editorial_css="$(sum_selected_bytes \
  assets/style-core.css \
  assets/style-search-pane.css \
  assets/style-touch-targets.css \
  assets/style-graph.css \
  assets/style-note-core.css \
  assets/style-editorial.css \
  assets/style-note.css \
  assets/style-note-editorial.css)"
news_bridge_css="$(sum_selected_bytes \
  assets/style-news-bridge.css)"

warn_if_over "Shared editorial CSS bundle" "$shared_editorial_css" "$MAX_SHARED_EDITORIAL_CSS"
warn_if_over "Collection editorial CSS bundle" "$collection_editorial_css" "$MAX_COLLECTION_EDITORIAL_CSS"
warn_if_over "Home editorial CSS bundle" "$home_editorial_css" "$MAX_HOME_EDITORIAL_CSS"
warn_if_over "Graph editorial CSS bundle" "$graph_editorial_css" "$MAX_GRAPH_EDITORIAL_CSS"
warn_if_over "Reading editorial CSS bundle" "$reading_editorial_css" "$MAX_READING_EDITORIAL_CSS"
warn_if_over "Rich reading editorial CSS bundle" "$rich_reading_editorial_css" "$MAX_RICH_READING_EDITORIAL_CSS"
warn_if_over "News bridge CSS bundle" "$news_bridge_css" "$MAX_NEWS_BRIDGE_CSS"

echo "Performance budget summary: JS=$(human_size "$total_js"), aggregate CSS=$(human_size "$total_css"), JSON=$(human_size "$total_json")."
echo "CSS bundle summary: shared-editorial=$(human_size "$shared_editorial_css"), collection-editorial=$(human_size "$collection_editorial_css"), home-editorial=$(human_size "$home_editorial_css"), graph-editorial=$(human_size "$graph_editorial_css"), reading-editorial=$(human_size "$reading_editorial_css"), rich-reading-editorial=$(human_size "$rich_reading_editorial_css"), news-bridge=$(human_size "$news_bridge_css")."

if (( warn_count > 0 )); then
  echo "::warning::Performance budget check completed with $warn_count warning(s)."
else
  echo "Performance budget check passed without warnings."
fi
