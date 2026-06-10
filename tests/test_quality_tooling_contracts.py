import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PACKAGE_JSON = ROOT / "package.json"
BIOME_CONFIG = ROOT / "biome.json"
ESLINT_CONFIG = ROOT / "eslint.config.js"
RUST_QUALITY_SCRIPT = ROOT / "scripts" / "rust-quality.sh"
FUZZ_MANIFEST = ROOT / "fuzz" / "Cargo.toml"
FUZZ_TARGET = ROOT / "fuzz" / "fuzz_targets" / "parse_markdown_post.rs"
DEPLOY_WORKFLOW = ROOT / ".github" / "workflows" / "deploy-cloudflare-pages.yml"


class QualityToolingContractTests(unittest.TestCase):
    def package(self) -> dict:
        return json.loads(PACKAGE_JSON.read_text())

    def test_package_scripts_wire_rust_deep_quality_and_web_lints(self) -> None:
        package = self.package()
        scripts = package["scripts"]
        lint = scripts["lint"]

        self.assertIn("lint:rust", scripts)
        self.assertIn("lint:rust:miri", scripts)
        self.assertIn("lint:rust:fuzz", scripts)
        self.assertIn("lint:rust:mutants", scripts)
        self.assertIn("lint:rust:deep", scripts)
        self.assertIn("lint:web", scripts)
        self.assertIn("lint:web:eslint", scripts)
        self.assertIn("lint:web:biome", scripts)
        self.assertIn("lint:quality", scripts)

        self.assertIn("npm run lint:rust", lint)
        self.assertIn("npm run lint:web", lint)
        self.assertIn("node scripts/check-state-architecture.mjs", lint)
        self.assertIn("cargo fmt --all --check", scripts["lint:rust"])
        self.assertIn("cargo fmt --manifest-path fuzz/Cargo.toml --check", scripts["lint:rust"])
        self.assertIn("cargo clippy --workspace --all-targets -- -D warnings", scripts["lint:rust"])
        self.assertIn("scripts/rust-quality.sh miri", scripts["lint:rust:miri"])
        self.assertIn("scripts/rust-quality.sh fuzz", scripts["lint:rust:fuzz"])
        self.assertIn("scripts/rust-quality.sh mutants", scripts["lint:rust:mutants"])
        self.assertIn("npm run lint:rust:miri", scripts["lint:rust:deep"])
        self.assertIn("npm run lint:rust:fuzz", scripts["lint:rust:deep"])
        self.assertIn("npm run lint:rust:mutants", scripts["lint:rust:deep"])
        self.assertIn("npm run lint:web", scripts["lint:quality"])
        self.assertIn("npm run lint:rust:deep", scripts["lint:quality"])

    def test_web_lint_dependencies_and_configs_are_explicit(self) -> None:
        package = self.package()
        dev_dependencies = package["devDependencies"]
        for dependency in ["@biomejs/biome", "@eslint/js", "eslint", "globals"]:
            self.assertIn(dependency, dev_dependencies)

        biome = json.loads(BIOME_CONFIG.read_text())
        self.assertEqual(biome["$schema"], "https://biomejs.dev/schemas/2.4.16/schema.json")
        self.assertTrue(biome["linter"]["enabled"])
        self.assertTrue(biome["formatter"]["enabled"])
        self.assertIn("src/**/*.mjs", biome["files"]["includes"])
        self.assertIn("functions/**/*.js", biome["files"]["includes"])

        eslint = ESLINT_CONFIG.read_text()
        self.assertIn("@eslint/js", eslint)
        self.assertIn("globals", eslint)
        self.assertIn("src/**/*.mjs", eslint)
        self.assertIn("functions/**/*.js", eslint)
        self.assertIn("no-restricted-globals", eslint)
        self.assertIn("no-implicit-globals", eslint)

    def test_rust_deep_quality_script_and_fuzz_target_are_present(self) -> None:
        script = RUST_QUALITY_SCRIPT.read_text()
        self.assertIn("cargo +nightly miri test", script)
        self.assertIn("cargo +nightly fuzz run parse_markdown_post", script)
        self.assertIn("cargo mutants", script)
        self.assertIn("--list", script)
        self.assertIn("install_hint", script)

        fuzz_manifest = FUZZ_MANIFEST.read_text()
        self.assertIn("cargo-fuzz", fuzz_manifest)
        self.assertIn("mud-blog", fuzz_manifest)
        self.assertIn("parse_markdown_post", fuzz_manifest)

        fuzz_target = FUZZ_TARGET.read_text()
        self.assertIn("mud_blog::parse_markdown_post", fuzz_target)
        self.assertIn("std::str::from_utf8", fuzz_target)

    def test_ci_keeps_fast_lint_and_exposes_deep_quality_as_manual_gate(self) -> None:
        deploy = DEPLOY_WORKFLOW.read_text()
        self.assertIn("npm run lint", deploy)
        self.assertNotIn("npm run lint:quality", deploy)


if __name__ == "__main__":
    unittest.main()
