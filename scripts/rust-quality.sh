#!/usr/bin/env bash
set -euo pipefail

install_hint() {
  case "$1" in
    cargo-mutants)
      echo "cargo-mutants is required. Install with: cargo install cargo-mutants --locked" >&2
      ;;
    cargo-fuzz)
      echo "cargo-fuzz is required. Install with: cargo install cargo-fuzz --locked" >&2
      ;;
    miri)
      echo "Miri is required. Install with: rustup toolchain install nightly && rustup +nightly component add miri" >&2
      ;;
    *)
      echo "$1 is required." >&2
      ;;
  esac
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    install_hint "$1"
    exit 127
  fi
}

require_miri() {
  if ! rustup +nightly component list --installed 2>/dev/null | grep -q '^miri'; then
    install_hint miri
    exit 127
  fi
}

mode="${1:-all}"
case "${mode}" in
  miri)
    require_miri
    cargo +nightly miri test --lib
    ;;
  fuzz)
    require_command cargo-fuzz
    cargo +nightly fuzz run parse_markdown_post -- -runs="${FUZZ_RUNS:-128}"
    ;;
  mutants)
    require_command cargo-mutants
    cargo mutants --list
    ;;
  all)
    "$0" miri
    "$0" fuzz
    "$0" mutants
    ;;
  *)
    echo "Usage: $0 [miri|fuzz|mutants|all]" >&2
    exit 2
    ;;
esac
