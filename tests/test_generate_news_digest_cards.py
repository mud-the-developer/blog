import importlib.util
import os
import sqlite3
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "generate_news_digest.py"
SPEC = importlib.util.spec_from_file_location("generate_news_digest", MODULE_PATH)
assert SPEC and SPEC.loader
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

    def test_render_markdown_uses_signal_brief_rhythm_instead_of_repeated_cards(self) -> None:
        def card(headline: str, badge: str, source: str, score: float, rank: int) -> MODULE.NewsItem:
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
            datetime(2026, 4, 14, tzinfo=ZoneInfo("Asia/Seoul")),
            datetime(2026, 4, 14, 9, 30, tzinfo=ZoneInfo("Asia/Seoul")),
            context,
            brief,
            [],
        )

        self.assertIn('class="news-digest-signal-brief"', html)
        self.assertIn('class="news-digest-lead-strip"', html)
        self.assertIn('class="news-digest-rail-grid"', html)
        self.assertIn('class="news-digest-compact-row', html)
        self.assertIn('class="news-digest-source-ledger"', html)
        self.assertIn('class="news-digest-interrupt-note"', html)
        self.assertLess(html.index("news-digest-lead-strip"), html.index("news-digest-source-ledger"))


class GenerateNewsDigestAutomationTests(unittest.TestCase):
    def test_keyword_digest_stem_uses_date_and_keywords(self) -> None:
        issue_dt = datetime(2026, 4, 14, tzinfo=ZoneInfo("Asia/Seoul"))
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
        payload = MODULE.gemma_overview_payload(datetime(2026, 4, 14, tzinfo=ZoneInfo("Asia/Seoul")), context)
        self.assertEqual(payload["keyword_focus"], ["open ran"])
        self.assertIn("mempalace_context", payload)
        self.assertIn("O-RAN RIC", payload["mempalace_context"][0]["content"])


if __name__ == "__main__":
    unittest.main()
