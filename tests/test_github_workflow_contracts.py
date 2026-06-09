import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
UPDATE_WORKFLOW = ROOT / ".github" / "workflows" / "update-news-digest.yml"
DEPLOY_WORKFLOW = ROOT / ".github" / "workflows" / "deploy-cloudflare-pages.yml"


class GithubWorkflowContractTests(unittest.TestCase):
    def read_workflows(self) -> tuple[str, str]:
        return UPDATE_WORKFLOW.read_text(), DEPLOY_WORKFLOW.read_text()

    def test_news_workflow_keeps_daily_and_manual_generation_contracts(self) -> None:
        update, _deploy = self.read_workflows()

        self.assertIn('cron: "20 15 * * *"', update)
        self.assertIn("workflow_dispatch:", update)
        self.assertIn("date:", update)
        self.assertIn("keywords:", update)
        self.assertIn("mempalace_limit:", update)
        self.assertIn('args+=(--date "${INPUT_DATE}")', update)
        self.assertIn('args+=(--keywords "${INPUT_KEYWORDS}")', update)
        self.assertIn('args+=(--mempalace-limit "${INPUT_MEMPALACE_LIMIT}")', update)

    def test_news_workflow_preserves_source_freshness_and_coverage_gates(self) -> None:
        update, _deploy = self.read_workflows()

        self.assertIn('Path("vendor/blog_news/data/latest.json")', update)
        self.assertIn('Path("static/news/data/latest.json")', update)
        self.assertIn("age_hours > 36", update)
        self.assertIn("GitHub fetch error", update)
        self.assertIn("rate limit", update)
        self.assertIn('source_counts.get("github.com", 0) < 8', update)
        self.assertIn("paper_count < 8", update)
        self.assertIn("validated source payload", update)

    def test_news_workflow_commits_rebuild_artifacts_without_legacy_paths(self) -> None:
        update, _deploy = self.read_workflows()

        self.assertIn("paths=(data/news posts/news static/news/data static/news/assets)", update)
        self.assertNotIn("content/generated/news", update)
        self.assertNotIn("content/posts/news", update)
        self.assertIn("git push origin HEAD:main", update)

    def test_deploy_runs_after_push_or_successful_news_generation_and_verifies_before_pages_deploy(self) -> None:
        update, deploy = self.read_workflows()

        self.assertNotIn("deploy-cloudflare-pages.yml/dispatches", update)
        self.assertNotIn("Bearer ***", update)
        self.assertNotRegex(update, re.compile(r"Authorization: Bearer\s*$", re.MULTILINE))
        self.assertIn("contents: write", update)
        self.assertNotIn("actions: write", update)

        self.assertIn("push:", deploy)
        self.assertIn("workflow_run:", deploy)
        self.assertIn("Update News Digest", deploy)
        self.assertIn("github.event.workflow_run.conclusion == 'success'", deploy)
        self.assertIn("ref: ${{ github.event_name == 'workflow_run' && 'main' || github.ref_name }}", deploy)
        self.assertIn("- main", deploy)
        self.assertLess(deploy.index("npm run build"), deploy.index("wrangler@4 pages deploy dist"))
        self.assertLess(deploy.index("npm test"), deploy.index("wrangler@4 pages deploy dist"))
        self.assertLess(deploy.index("npm run lint"), deploy.index("wrangler@4 pages deploy dist"))
        self.assertIn("pages secret put GOOGLE_AI_API_KEY", deploy)
        self.assertIn("Authorization: Bearer ${CLOUDFLARE_API_TOKEN}", deploy)
        self.assertIn("CLOUDFLARE_API_TOKEN", deploy)
        self.assertIn("CLOUDFLARE_ACCOUNT_ID", deploy)
        self.assertIn("CLOUDFLARE_ACCOUNT_ID}\" =~ ^[A-Za-z0-9]{32}$", deploy)
        self.assertIn("api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${CF_PAGES_PROJECT}", deploy)
        self.assertNotIn("npx wrangler@4 whoami", deploy)


if __name__ == "__main__":
    unittest.main()
