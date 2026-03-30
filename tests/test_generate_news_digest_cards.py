import importlib.util
import sys
import unittest
from pathlib import Path


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
            meta="Hugging Face Papers · 11h ago · signal 6.20",
            rank=19,
            rank_delta=-4,
        )

        html = "\n".join(MODULE.render_digest_card_lines(card, extra_classes="news-digest-top-card"))

        self.assertIn('class="news-digest-card news-digest-top-card"', html)
        self.assertIn("news-digest-card-badge--paper", html)
        self.assertIn("English one-line paper summary for readable scanning.", html)
        self.assertIn("Hugging Face Papers", html)
        self.assertIn("<h3>PackForcing</h3>", html)


if __name__ == "__main__":
    unittest.main()
