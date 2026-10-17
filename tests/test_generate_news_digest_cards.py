import importlib.util
import json
import os
import sqlite3
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "generate_news_digest.py"
SPEC = importlib.util.spec_from_file_location("generate_news_digest", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Cannot load the news generator for tests")
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class GenerateNewsDigestCardRenderingTests(unittest.TestCase):
    def test_render_digest_card_lines_includes_summary_and_meta(self) -> None:
        card = MODULE.NewsItem(
            headline="PackForcing",
            title="PackForcing",
            url="https://example.com/paper",
            source="huggingface.co",
            tags=["AI"],
            score=6.2,
            raw_score=3.6,
            published_hours_ago=11,
            stars=0,
            image_url="/news/assets/thumb-paper.svg",
            badge="Paper",
            deck="English one-line paper summary for readable scanning.",
            meta="HF Papers · 11h ago · signal 6.20",
            rank=19,
            rank_delta=-4,
        )

        html = "\n".join(MODULE.render_digest_card_lines(card, extra_classes="news-digest-top-card"))

        self.assertIn('class="news-digest-card news-digest-card--paper news-digest-top-card"', html)
        self.assertIn("news-digest-card-badge--paper", html)
        self.assertIn("English one-line paper summary for readable scanning.", html)
        self.assertIn("HF Papers", html)
        self.assertIn("<h3 data-pretext-target>PackForcing</h3>", html)

    def test_paper_rows_render_full_titles_even_when_headline_is_shortened(self) -> None:
        card = MODULE.NewsItem(
            headline="Demystifying Hidden-State Recurrence: Switchable Latent Reasoning with On-Policy Reinforcement…",
            title="Demystifying Hidden-State Recurrence: Switchable Latent Reasoning with On-Policy Reinforcement Learning",
            url="https://example.com/paper",
            source="huggingface.co",
            tags=["AI"],
            score=6.2,
            raw_score=3.6,
            published_hours_ago=11,
            stars=0,
            image_url="/news/assets/thumb-paper.svg",
            badge="Paper",
            deck="English one-line paper summary for readable scanning.",
            meta="HF Papers · 11h ago · signal 6.20",
            rank=19,
            rank_delta=-4,
        )

        compact_html = "\n".join(MODULE.render_compact_signal_rows([card]))
        card_html = "\n".join(MODULE.render_digest_card_lines(card, extra_classes="news-digest-top-card"))

        self.assertIn("On-Policy Reinforcement Learning", compact_html)
        self.assertIn("On-Policy Reinforcement Learning", card_html)
        self.assertNotIn("On-Policy Reinforcement…", compact_html)
        self.assertNotIn("On-Policy Reinforcement…", card_html)

    def test_render_markdown_uses_signal_brief_rhythm_instead_of_repeated_cards(self) -> None:
        def card(headline: str, badge: str, source: str, score: float, rank: int):
            return MODULE.NewsItem(
                headline=headline,
                title=headline,
                url=f"https://example.com/{rank}",
                source=source,
                tags=["AI"],
                score=score,
                raw_score=score,
                published_hours_ago=rank,
                stars=1000 + rank,
                image_url="/news/assets/thumb-ai.svg",
                badge=badge,
                deck=f"{headline} is a compact evidence summary for the issue.",
                meta=f"{MODULE.source_label(source)} · +{rank * 10}/7d · signal {score:.2f}",
                rank=rank,
                rank_delta=rank if rank % 2 == 0 else None,
            )

        repo_cards = [card("Repo velocity", "Repo", "github.com", 8.6, 1), card("Agent toolkit", "Repo", "github.com", 7.3, 2)]
        paper_cards = [card("Paper cluster", "Paper", "huggingface.co", 7.8, 3), card("World model", "Paper", "arxiv.org", 6.9, 4)]
        social_cards = [card("Community thread", "Social", "x.com", 5.4, 5)]
        context = MODULE.DigestContext(
            summary="Repos, papers, and community signals diverged today.",
            top_cards=[repo_cards[0], paper_cards[0], social_cards[0]],
            repo_scoreboard=repo_cards,
            sections=[
                ("repos", "Repository velocity", "Repos moving fastest.", repo_cards),
                ("papers", "Paper queue", "Papers worth scanning.", paper_cards),
                ("social", "Community wire", "Community posts with signal.", social_cards),
            ],
            source_counts=[{"label": "GitHub", "value": 2}, {"label": "Hugging Face", "value": 1}, {"label": "X", "value": 1}],
        )
        brief = MODULE.BetaDigest(
            title="AI News Brief — Signal Test",
            dek="A richer signal brief.",
            lead="The lead story frames the day before the ledger.",
            article_body=["One paragraph sets the editorial angle."],
            takeaways=["Repo momentum leads", "Paper queue follows", "Social signal trails"],
            section_titles={},
            section_bodies={},
            closing="Keep the ledger for audit.",
        )
        html, _stem = MODULE.render_markdown(
            datetime(2026, 4, 14, tzinfo=MODULE.KST),
            datetime(2026, 4, 14, 9, 30, tzinfo=MODULE.KST),
            context,
            brief,
            [],
        )

        self.assertIn('class="news-digest-signal-brief"', html)
        self.assertIn('data-digest-layout="editorial-signal"', html)
        self.assertIn('class="news-digest-lead-strip"', html)
        self.assertIn('class="news-digest-signal-board"', html)
        self.assertIn('class="news-digest-compact-row', html)
        self.assertIn('class="news-digest-row-visual ', html)
        self.assertIn('class="news-digest-row-metric"', html)
        self.assertIn('class="news-digest-source-ledger"', html)
        self.assertIn('class="news-digest-interrupt-note"', html)
        self.assertNotIn('class="news-digest-compact-rank"', html)
        self.assertNotIn('signal 8.60', html)
        self.assertNotIn('Generated from the ranked feed', html)
        self.assertLess(html.index("news-digest-lead-strip"), html.index("news-digest-source-ledger"))


class GenerateNewsDigestAutomationTests(unittest.TestCase):
    def test_public_hub_is_utf8_and_never_contains_private_memory(self) -> None:
        context = MODULE.DigestContext(
            summary="연구 — résumé", top_cards=[], repo_scoreboard=[], sections=[], source_counts=[],
            mempalace_context=[{"content": "PRIVATE_CONTEXT_TEST_MARKER", "wing": "private"}],
        )
        issue = datetime(2026, 10, 17, tzinfo=MODULE.KST)
        with tempfile.TemporaryDirectory() as directory, patch.object(MODULE, "GENERATED_DIR", Path(directory)), patch.object(MODULE, "recent_archive_entries", return_value=[]):
            MODULE.write_hub_json(issue, issue, context, "audit")
            text = (Path(directory) / "latest.json").read_bytes().decode("utf-8")
            self.assertNotIn("PRIVATE_CONTEXT_TEST_MARKER", text)
            self.assertNotIn("mempalace_context", json.loads(text))
            self.assertEqual(json.loads(text)["summary"], "연구 — résumé")
        self.assertEqual(context.mempalace_context[0]["content"], "PRIVATE_CONTEXT_TEST_MARKER")

    def test_json_file_reader_requires_utf8_objects_and_never_overwrites_bad_data(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "feed.json"
            path.write_text('{"note":"연구"}', encoding="utf-8")
            self.assertEqual(MODULE.read_json_object(path), {"note": "연구"})
            for invalid in ["not-json", "[]"]:
                path.write_text(invalid, encoding="utf-8")
                with self.assertRaises(ValueError):
                    MODULE.read_json_object(path)
                self.assertEqual(path.read_text(encoding="utf-8"), invalid)

    def test_model_json_requires_an_object(self) -> None:
        for invalid in ["", "not-json", "[]"]:
            with self.assertRaises(ValueError):
                MODULE.parse_llm_json(invalid)
        self.assertEqual(MODULE.parse_llm_json('{"ok":true}'), {"ok": True})

    def test_model_endpoints_reject_file_urls_before_network_io(self) -> None:
        with patch.dict(os.environ, {"NVIDIA_API_KEY": "test-key", "NVIDIA_NIM_BASE_URL": "file:///tmp"}, clear=True), patch.dict(MODULE.BETA_DIGEST_CACHE, {}, clear=True), patch.object(MODULE.urllib.request, "urlopen") as fetch:
            with self.assertRaises(MODULE.GemmaRequestError):
                MODULE.gemma_json_request("unsafe-endpoint-test", {"task": "test"})
            fetch.assert_not_called()

    def test_modern_kst_dates_use_portable_labels(self) -> None:
        issue = MODULE.issue_date_from_args("2026-04-14")
        self.assertEqual(issue.utcoffset().total_seconds(), 9 * 60 * 60)
        self.assertEqual(MODULE.issue_date_label(issue), "Apr 14, 2026")
        generated = datetime(2026, 4, 14, 9, 30, tzinfo=MODULE.KST)
        self.assertEqual(MODULE.generated_timestamp_label(generated), "Apr 14, 2026 · 9:30 AM KST")

    def test_keyword_digest_stem_uses_date_and_keywords(self) -> None:
        issue_dt = datetime(2026, 4, 14, tzinfo=MODULE.KST)
        self.assertEqual(
            MODULE.digest_stem_for(issue_dt, ["open RAN", "Gemma 4"]),
            "2026-04-14-open-ran-gemma-4-news-digest",
        )

    def test_google_api_key_supports_common_google_env_names(self) -> None:
        old_values = {key: os.environ.get(key) for key in ["GOOGLE_AI_API_KEY", "GOOGLE_API_KEY", "GEMINI_API_KEY"]}
        try:
            for key in old_values:
                os.environ.pop(key, None)
            os.environ["GEMINI_API_KEY"] = "gemini-test-key"
            self.assertEqual(MODULE.google_ai_api_key(), "gemini-test-key")
            self.assertTrue(MODULE.gemma_beta_enabled())
        finally:
            for key, value in old_values.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value

    def test_nvidia_nim_is_primary_capable_and_gemini_remains_available(self) -> None:
        keys = ["NVIDIA_API_KEY", "GOOGLE_AI_API_KEY", "GOOGLE_API_KEY", "GEMINI_API_KEY"]
        old_values = {key: os.environ.get(key) for key in keys}
        try:
            for key in keys:
                os.environ.pop(key, None)
            os.environ["NVIDIA_API_KEY"] = "nim-test-key"
            self.assertTrue(MODULE.gemma_beta_enabled())
            self.assertEqual(MODULE.nvidia_api_url(), "https://integrate.api.nvidia.com/v1/chat/completions")
            self.assertTrue(MODULE.nvidia_model_name())
            os.environ["GEMINI_API_KEY"] = "gemini-fallback-key"
            self.assertEqual(MODULE.google_ai_api_key(), "gemini-fallback-key")
        finally:
            for key, value in old_values.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value

    def test_mempalace_context_reads_local_chroma_documents_for_keyword(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "chroma.sqlite3"
            con = sqlite3.connect(db_path)
            con.executescript(
                """
                create table embedding_metadata(id integer, key text, string_value text, int_value integer, float_value real, bool_value integer);
                create virtual table embedding_fulltext_search using fts5(string_value, tokenize='trigram');
                insert into embedding_metadata(id, key, string_value) values
                    (1, 'chroma:document', 'O-RAN RIC and xApp notes for AI news automation'),
                    (1, 'wing', 'projects'),
                    (1, 'room', 'blog'),
                    (2, 'chroma:document', 'unrelated cooking memory'),
                    (2, 'wing', 'personal'),
                    (2, 'room', 'misc');
                insert into embedding_fulltext_search(rowid, string_value) values
                    (1, 'O-RAN RIC and xApp notes for AI news automation'),
                    (2, 'unrelated cooking memory');
                """
            )
            con.commit()
            con.close()

            found = MODULE.load_mempalace_context(["O-RAN"], palace_path=Path(temp_dir), limit=3)
            self.assertEqual(len(found), 1)
            self.assertIn("O-RAN RIC", found[0]["content"])
            self.assertEqual(found[0]["wing"], "projects")

    def test_gemma_payload_includes_keyword_and_mempalace_context(self) -> None:
        context = MODULE.DigestContext(
            summary="Daily AI signals.",
            top_cards=[],
            repo_scoreboard=[],
            sections=[],
            source_counts=[],
            keywords=["open ran"],
            mempalace_context=[{"content": "User tracks O-RAN RIC and xApp news.", "wing": "projects", "room": "blog"}],
        )
        payload = MODULE.gemma_overview_payload(datetime(2026, 4, 14, tzinfo=MODULE.KST), context)
        self.assertEqual(payload["keyword_focus"], ["open ran"])
        self.assertIn("mempalace_context", payload)
        self.assertIn("O-RAN RIC", payload["mempalace_context"][0]["content"])


if __name__ == "__main__":
    unittest.main()
