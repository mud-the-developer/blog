use std::{
    fs,
    path::{Path, PathBuf},
};

use mud_blog::{build_static_site, render_posts_fragment};

fn count_markdown_posts(dir: &Path) -> Result<usize, Box<dyn std::error::Error>> {
    let mut count = 0;
    for entry in fs::read_dir(dir)? {
        let path = entry?.path();
        if path.is_dir() {
            count += count_markdown_posts(&path)?;
        } else if path.extension().and_then(|ext| ext.to_str()) == Some("md") {
            count += 1;
        }
    }
    Ok(count)
}

fn test_output_dir(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("target")
        .join("contract-dist")
        .join(format!("{}-{}", name, std::process::id()))
}

#[tokio::test]
async fn builds_public_polished_home_with_filetree_and_no_decorative_pretext_motion()
-> Result<(), Box<dyn std::error::Error>> {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let out_dir = test_output_dir("public-polish");
    let expected_post_count = count_markdown_posts(&root.join("posts"))?;

    let result = build_static_site(root.join("posts"), &out_dir).await?;
    let expected_home_post_count = result
        .posts
        .iter()
        .filter(|post| post.folder != "news")
        .count();

    assert_eq!(result.posts.len(), expected_post_count);
    assert!(out_dir.join("index.html").exists());
    assert!(out_dir.join("archive.json").exists());
    assert!(out_dir.join("robots.txt").exists());
    assert!(out_dir.join("sitemap.xml").exists());
    assert!(out_dir.join("news/index.html").exists());
    assert!(out_dir.join("news/search/index.html").exists());
    assert!(out_dir.join("fragments/posts.html").exists());
    assert!(!out_dir.join("assets/pretext-polish.mjs").exists());
    assert!(!out_dir.join("assets/pretext-polish-effects.mjs").exists());
    assert!(!out_dir.join("assets/pretext-editorial.mjs").exists());
    assert!(!out_dir.join("assets/pretext/layout.js").exists());
    assert!(out_dir.join("assets/blog-lab.mjs").exists());
    assert!(out_dir.join("assets/site-chrome.mjs").exists());
    assert!(out_dir.join("assets/site-chrome-effects.mjs").exists());
    assert!(out_dir.join("news/data/latest.json").exists());
    assert!(!out_dir.join("assets/pretext-field.mjs").exists());

    let index = fs::read_to_string(out_dir.join("index.html"))?;
    let robots = fs::read_to_string(out_dir.join("robots.txt"))?;
    assert!(robots.starts_with("User-agent: *\n"));
    assert!(robots.contains("Allow: /\n"));
    assert!(robots.contains("Sitemap: https://mud-blog.pages.dev/sitemap.xml\n"));
    assert!(!robots.contains("<!doctype html>"));

    let sitemap = fs::read_to_string(out_dir.join("sitemap.xml"))?;
    assert!(sitemap.starts_with("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"));
    assert!(sitemap.contains("<loc>https://mud-blog.pages.dev/</loc>"));
    assert!(sitemap.contains("<loc>https://mud-blog.pages.dev/news/</loc>"));
    assert!(sitemap.contains("<loc>https://mud-blog.pages.dev/news/search/</loc>"));
    assert!(sitemap.contains("<loc>https://mud-blog.pages.dev/cfp/</loc>"));
    assert_eq!(sitemap.matches("<url>").count(), expected_post_count + 4);

    assert!(index.contains("<a href=\"/news/\"><span class=\"ui-icon\" data-icon=\"newspaper\""));
    assert!(index.contains("href=\"/cfp/\""));
    assert!(index.contains("data-theme-toggle"));
    assert!(index.contains("aria-label=\"Toggle color theme: System\""));
    assert!(index.contains("/assets/site-chrome.mjs"));
    assert!(index.contains("data-layout=\"public-index\""));
    assert!(index.contains("class=\"public-shell\""));
    assert!(index.contains("class=\"filetree"));
    assert!(index.contains("aria-label=\"editorial dossier\""));
    assert!(index.contains("data-home-post"));
    assert!(index.contains("data-home-post-body"));
    assert!(!index.contains("data-pretext-editorial"));
    assert!(!index.contains("archive typography motion"));
    assert!(!index.contains("/assets/pretext-editorial.mjs"));
    assert!(index.contains("<h2>Hi 🙋</h2>"));
    assert!(index.contains("Welcome to my blog"));
    assert!(index.contains("<span>About me</span>"));
    assert!(!index.contains("Public writing"));
    assert!(!index.contains("id=\"posts-title\""));
    assert!(!index.contains("A tight public desk for AI systems"));
    assert!(index.contains("dossier-card-left"));
    assert!(index.contains("dossier-card-right"));
    assert!(index.contains("Source brief"));
    assert!(index.contains("CFP Radar"));
    assert!(!index.contains("writing index is live"));
    assert!(!index.contains("<details class=\"filetree-folder\" data-folder=\"news\""));
    assert!(!index.contains("<span>news/</span>"));
    assert!(!index.contains(" · news</span>"));
    assert!(index.contains("data-folder=\"blog\" aria-label=\"Blog posts\" open"));
    assert!(index.contains("<summary class=\"filetree-folder-label\""));
    assert_eq!(
        index.matches("class=\"filetree-file\"").count(),
        expected_home_post_count
    );
    assert_eq!(
        index.matches("class=\"post-card\"").count(),
        expected_home_post_count
    );
    assert!(!index.contains("aria-label=\"post text rain\""));
    assert!(!index.contains("aria-label=\"ambient animated index\""));
    assert!(!index.contains("data-pretext-polish"));
    assert!(!index.contains("data-focused-issue-lab"));
    assert!(!index.contains("data-blog-chat"));
    assert!(!index.contains("/assets/pretext-polish.mjs"));
    assert!(!index.contains("/assets/blog-lab.mjs"));
    assert!(!index.contains("GOOGLE_AI_API_KEY"));
    assert!(!index.contains("GEMINI_API_KEY"));
    assert!(index.contains("posts/"));
    assert!(!index.contains("<span>news/</span>"));
    assert!(index.contains("blog/"));
    assert!(index.contains("cfp/"));
    assert!(index.contains("papers/"));
    assert!(index.contains("about/"));
    assert!(index.contains("Jinhyuk Kim"));
    assert!(!index.contains("읽기 좋은 노트"));
    assert!(!index.contains("Readable archive"));
    assert!(!index.contains("Markdown archive"));
    assert!(!index.contains("<a href=\"/archive.json\">Data</a>"));
    assert!(!index.contains("data-field-stage"));
    assert!(!index.contains("data-archive-graph"));
    assert!(!index.contains("paper-grid"));
    assert!(!index.contains("Pretext Kinetic Blog"));
    assert!(!index.contains("Research Radar"));
    assert!(!index.contains("README Post Template"));
    assert!(!index.contains("About Jinhyuk"));
    assert!(!index.contains("tokio · askama · htmx"));
    assert!(!index.contains("runtime</dt>"));
    assert!(!index.contains("refresh fragment"));

    let style = fs::read_to_string(out_dir.join("assets/style.css"))?;
    assert!(style.contains("dossier-enter"));
    assert!(style.contains(".dossier-card-left"));
    assert!(style.contains(".dossier-card-right"));
    assert!(style.contains(".home-post-body"));
    assert!(!style.contains(".pretext-editorial-canvas"));
    assert!(!style.contains(".pretext-polish"));
    assert!(style.contains(".filetree"));
    assert!(style.contains(".post-body :is"));
    assert!(style.contains(".profile-publication-widget"));
    assert!(!style.contains("pretext-rain-fall"));
    assert!(!style.contains("pretext-rain-column"));
    assert!(!style.contains("pretext-loom-breathe"));
    assert!(!style.contains("pretext-loom-row"));
    assert!(!style.contains("pretext-loom-status"));
    assert!(!style.contains("pretext-cat-breathe"));
    assert!(!style.contains("pretext-cat-sprite"));
    assert!(!style.contains("pretext-cat-blink"));
    assert!(!style.contains("pretext-cat-prowl"));
    assert!(!style.contains("pretext-loom-thread"));
    assert!(!style.contains("pretext-ascii-row-pulse"));
    assert!(!style.contains("pretext-scan-lane"));
    assert!(!style.contains("pretext-front-glass"));
    assert!(!style.contains("pretext-ambient-layer"));
    assert!(!style.contains("pretext-cat-paw"));
    assert!(!style.contains("pretext-cat-shadow"));
    assert!(style.contains("--space-bg"));
    assert!(style.contains("--glass-bg"));
    assert!(!style.contains("radial-gradient"));
    assert!(!style.contains("repeating-linear-gradient"));
    assert!(!style.to_ascii_lowercase().contains("orbit"));
    assert!(!style.to_ascii_lowercase().contains("bubble"));
    assert!(!style.to_ascii_lowercase().contains("stripe"));
    assert!(!style.to_ascii_lowercase().contains("skewy"));
    assert!(!style.contains(".paper-grid"));
    assert!(!style.contains(".field-stage"));
    assert!(!style.contains(".archive-graph"));
    assert!(!style.to_ascii_lowercase().contains("neon"));
    assert!(
        style.len() <= 43_000,
        "public polish CSS should stay bounded even with responsive controls, post chrome spacing, icons, theme modes, dark contrast guards, editorial archive controls, mobile news compression, card-news surfaces, and CFP tables"
    );

    let profile = fs::read_to_string(out_dir.join("posts/jinhyuk-kim/index.html"))?;
    assert!(profile.contains("class=\"post-reader\""));
    assert!(profile.contains("profile-publication-widget"));
    assert!(!out_dir.join("posts/about-jinhyuk/index.html").exists());

    assert!(
        out_dir
            .join("posts/2026-06-10-ai-news-digest/index.html")
            .exists()
    );
    assert!(
        out_dir
            .join("posts/news-digest-archive/index.html")
            .exists()
    );
    let home_post = fs::read_to_string(out_dir.join("posts/home/index.html"))?;
    assert!(home_post.contains("href=\"/posts/jinhyuk-kim/\""));
    assert!(home_post.contains(">Jinhyuk</a>"));
    assert!(!home_post.contains("href=\"/posts/about-me/\""));

    let latest_digest =
        fs::read_to_string(out_dir.join("posts/2026-06-10-ai-news-digest/index.html"))?;
    assert!(latest_digest.contains("href=\"/posts/news-digest-archive/\""));
    assert!(!latest_digest.contains("href=\"/notes/"));

    let archive = fs::read_to_string(out_dir.join("archive.json"))?;
    assert!(archive.len() <= 26_000);

    let news = fs::read_to_string(out_dir.join("news/index.html"))?;
    assert!(news.contains("data-askama-template=\"news\""));
    assert!(news.contains("data-layout=\"news-index\""));
    assert!(news.contains("aria-current=\"page\""));
    assert!(news.contains("href=\"/news/search/\""));
    assert!(news.contains("data-news-archive"));
    assert!(news.contains("data-news-featured"));
    assert!(news.contains("class=\"news-feature-thumb\""));
    assert!(news.contains("Read latest issue"));
    assert!(news.contains("data-news-recent"));
    assert!(news.contains("data-news-monthly-archive"));
    assert!(news.contains("data-news-utility"));
    assert!(news.contains("Latest issue"));
    assert!(news.contains("Recent 7 issues"));
    assert!(news.contains("Monthly archive"));
    assert!(news.contains("pipeline utility"));
    assert!(news.contains("latest.json"));
    assert!(news.find("Latest issue") < news.find("pipeline utility"));
    assert!(news.matches("class=\"news-row\"").count() <= 7);
    assert!(!news.contains("data-news-digest-json"));
    assert!(!news.contains("data-focused-issue-lab"));
    assert!(!news.contains("data-overview-figure"));
    assert!(!news.contains("data-blog-chat"));
    assert!(!news.contains("Gemma guide"));
    assert!(news.contains("AI News Brief —"));
    assert!(news.contains("Daily AI News Archive"));

    let cfp = fs::read_to_string(out_dir.join("cfp/index.html"))?;
    assert!(cfp.contains("data-askama-template=\"cfp\""));
    assert!(cfp.contains("data-layout=\"cfp-index\""));
    assert!(cfp.contains("CFP Radar"));
    assert!(cfp.contains("wireless/communications focus"));
    assert!(cfp.contains("/cfp/data/latest.json"));
    assert!(cfp.contains("Read latest CFP Radar"));
    assert!(out_dir.join("cfp/data/latest.json").exists());

    let cfp_post = fs::read_to_string(out_dir.join("posts/2026-07-03-cfp-radar/index.html"))?;
    assert!(cfp_post.contains("Nearest submission deadlines"));
    assert!(cfp_post.contains("Three-by-three quick view"));
    assert!(cfp_post.contains("Full grouped watchlists"));
    assert!(cfp_post.contains(">Venue</th>"));
    assert!(cfp_post.contains(">Deadline</th>"));
    assert!(cfp_post.contains(">Kind</th>"));
    assert!(!cfp_post.contains(">Days</th>"));
    assert!(!cfp_post.contains(">Verified rank</th>"));
    assert!(!cfp_post.contains(">Rank source</th>"));
    assert!(!cfp_post.contains(">Metric</th>"));
    assert!(!cfp_post.contains(">Standing</th>"));
    assert!(!cfp_post.contains("Q1/Q2 / ranking basis"));
    assert!(!cfp_post.contains("Q1-like"));
    assert!(!cfp_post.contains("Q2-like"));
    assert!(!cfp_post.contains("Q1/Q2-like"));
    assert!(!cfp_post.contains("Top-tier"));
    assert!(!cfp_post.contains("Specialized venue"));
    assert!(cfp_post.contains("IEEE International Conference on Communications"));
    assert!(cfp_post.contains("IEEE Wireless Communications and Networking Conference"));
    assert!(cfp_post.contains("IEEE International Workshop on Computer Aided Modeling"));
    assert!(cfp_post.contains("IEEE International Mediterranean Conference on Communications"));
    assert!(cfp_post.contains("IEEE Journal on Selected Areas in Communications"));
    assert!(cfp_post.contains("Journal special issue"));
    assert!(cfp_post.contains("Workshops"));
    assert!(cfp_post.contains("Verified-rank only"));
    assert!(cfp_post.contains("No proxy levels"));
    assert_eq!(cfp_post.matches("<h1").count(), 1);

    let latest_news_post = result
        .posts
        .iter()
        .find(|post| post.folder == "news" && post.title.starts_with("Daily AI Beta Brief"));
    assert!(latest_news_post.is_some());
    let Some(latest_news_post) = latest_news_post else {
        return Ok(());
    };
    let latest_news_html = fs::read_to_string(
        out_dir
            .join("posts")
            .join(&latest_news_post.slug)
            .join("index.html"),
    )?;
    assert_eq!(latest_news_html.matches("<h1").count(), 1);
    assert!(latest_news_html.contains("<h2 data-pretext-target>Daily AI Beta Brief"));

    let news_search = fs::read_to_string(out_dir.join("news/search/index.html"))?;
    assert!(news_search.contains("data-askama-template=\"news-search\""));
    assert!(news_search.contains("data-layout=\"news-search\""));
    assert!(news_search.contains("data-focused-issue-lab"));
    assert!(news_search.contains("data-news-search-results"));
    assert!(news_search.contains("aria-label=\"News sources\""));
    assert!(news_search.contains("GDELT live web"));
    assert!(news_search.contains("Google News"));
    assert!(news_search.contains("unstable RSS"));
    assert!(news_search.contains("Scholar link"));
    assert!(news_search.contains("experimental"));
    assert!(news_search.contains("Search query mode"));
    assert!(news_search.contains("Exact keyword"));
    assert!(news_search.contains("AI-assisted expansion"));
    assert!(news_search.contains("GitHub repositories"));
    assert!(news_search.contains("arXiv papers"));
    assert!(news_search.contains("Scholar link"));
    assert!(news_search.contains("HF Papers"));
    assert!(!news_search.contains("Hugging Face Papers"));
    assert!(news_search.contains("OpenAlex"));
    assert!(news_search.contains("Crossref"));
    assert!(news_search.contains("Semantic Scholar"));
    assert!(news_search.contains("Hacker News"));
    assert!(news_search.contains("data-source-group=\"code\""));
    assert!(news_search.contains("data-source-group=\"paper\""));
    assert!(news_search.contains("data-source-group=\"social\""));
    assert!(news_search.contains("GeekNews"));
    assert!(news_search.contains("Endigest"));
    assert!(news_search.contains("Search news"));
    assert!(news_search.contains("Draft from selected news"));
    assert!(news_search.contains("Download Markdown"));
    assert!(news_search.contains("Download PDF"));
    assert!(news_search.contains("news-command-strip"));
    assert!(news_search.contains("data-news-signal-stack"));
    assert!(!news_search.contains("data-news-pretext-board"));
    assert!(news_search.contains("source scan"));
    assert!(!news_search.contains("RANKING LANES"));
    assert!(news_search.contains("source map"));
    assert!(!news_search.contains("data-overview-figure"));
    assert!(!news_search.contains("data-blog-chat"));
    assert!(!news_search.contains("Gemma guide"));

    Ok(())
}

#[tokio::test]
async fn loads_folder_posts_after_removing_duplicate_and_internal_scaffold_posts()
-> Result<(), Box<dyn std::error::Error>> {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let expected_post_count = count_markdown_posts(&root.join("posts"))?;

    for folder in ["about", "blog", "news", "papers"] {
        assert!(
            root.join("posts").join(folder).is_dir(),
            "posts should include a public {folder}/ folder"
        );
    }
    assert!(root.join("posts/about/jinhyuk-kim.md").exists());
    assert!(!root.join("posts/about/about-jinhyuk.md").exists());
    assert!(!root.join("posts/meta/pretext-kinetic-blog.md").exists());
    assert!(!root.join("posts/meta/research-radar.md").exists());
    assert!(!root.join("posts/meta/readme-post-template.md").exists());
    assert!(
        root.join("posts/news/2026-04-13-ai-news-digest.md")
            .exists()
    );
    assert!(root.join("posts/blog/second-brain.md").exists());
    assert!(root.join("posts/papers/uhlm-2412-12687.md").exists());

    let result = build_static_site(root.join("posts"), test_output_dir("migration")).await?;
    let titles = result
        .posts
        .iter()
        .map(|post| post.title.as_str())
        .collect::<Vec<_>>();

    assert_eq!(result.posts.len(), expected_post_count);
    assert!(titles.contains(&"Jinhyuk Kim"));
    assert!(titles.contains(&"Second Brain Architecture"));
    assert!(titles.contains(&"GitHub to Cloudflare Pipeline"));
    assert!(
        titles
            .iter()
            .any(|title| title.starts_with("AI News Brief —"))
    );
    assert!(titles.contains(&"Daily AI News Archive"));
    assert!(titles.contains(
        &"Uncertainty-Aware Hybrid Inference with On-Device Small and Remote Large Language Models"
    ));
    assert!(!titles.contains(&"About Jinhyuk"));
    assert!(!titles.contains(&"Pretext Kinetic Blog"));
    assert!(!titles.contains(&"Research Radar"));
    assert!(!titles.contains(&"README Post Template"));
    assert!(!titles.contains(&"Co-SLM"));
    assert!(
        !titles
            .iter()
            .any(|title| title.contains("Overflow Regression Case"))
    );

    let second_brain = result
        .posts
        .iter()
        .find(|post| post.title == "Second Brain Architecture");
    assert!(second_brain.is_some());
    let Some(second_brain) = second_brain else {
        return Ok(());
    };
    assert!(second_brain.tags.contains(&"rust".to_string()));
    assert!(second_brain.tags.contains(&"architecture".to_string()));
    assert!(second_brain.html.contains("/posts/seo-performance-guide/"));

    Ok(())
}

#[tokio::test]
async fn restores_news_digest_pipeline_for_the_new_posts_folder()
-> Result<(), Box<dyn std::error::Error>> {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let script = fs::read_to_string(root.join("scripts/generate_news_digest.py"))?;
    let workflow = fs::read_to_string(root.join(".github/workflows/update-news-digest.yml"))?;
    let deploy_workflow =
        fs::read_to_string(root.join(".github/workflows/deploy-cloudflare-pages.yml"))?;

    assert!(script.contains("POSTS_DIR = ROOT / \"posts\" / \"news\""));
    assert!(script.contains("GENERATED_DIR = ROOT / \"data\" / \"news\""));
    assert!(
        script.contains(
            "SOURCE_PATH = ROOT / \"vendor\" / \"blog_news\" / \"data\" / \"latest.json\""
        )
    );
    assert!(
        script
            .contains("SNAPSHOT_PATH = ROOT / \"static\" / \"news\" / \"data\" / \"latest.json\"")
    );
    assert!(workflow.contains("cron: \"20 15 * * *\""));
    assert!(workflow.contains("workflow_dispatch:"));
    assert!(workflow.contains("mempalace_limit:"));
    assert!(workflow.contains("scripts/generate_news_digest.py"));
    assert!(workflow.contains("age_hours > 36"));
    assert!(workflow.contains("GitHub fetch error"));
    assert!(workflow.contains("source_counts.get(\"github.com\", 0) < 8"));
    assert!(workflow.contains("paper_count < 8"));
    assert!(workflow.contains("paths=(data/news posts/news static/news/data static/news/assets)"));
    assert!(!workflow.contains("content/generated/news"));
    assert!(!workflow.contains("content/posts/news"));
    assert!(!workflow.contains("deploy-cloudflare-pages.yml/dispatches"));
    assert!(!workflow.contains("Bearer ***"));
    assert!(!workflow.contains("actions: write"));
    assert!(deploy_workflow.contains("push:"));
    assert!(deploy_workflow.contains("workflow_run:"));
    assert!(deploy_workflow.contains("Update News Digest"));
    assert!(deploy_workflow.contains("github.event.workflow_run.conclusion == 'success'"));
    assert!(deploy_workflow.contains("npm run build"));
    assert!(deploy_workflow.contains("npm test"));
    assert!(deploy_workflow.contains("npm run lint"));
    assert!(deploy_workflow.contains(
        "api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/pages/projects/${CF_PAGES_PROJECT}"
    ));
    assert!(deploy_workflow.contains("Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"));
    assert!(!deploy_workflow.contains("npx wrangler@4 whoami"));
    assert!(deploy_workflow.contains("wrangler@4 pages deploy dist"));
    assert!(deploy_workflow.contains("pages secret put GOOGLE_AI_API_KEY"));
    assert!(deploy_workflow.contains("GOOGLE_AI_API_KEY"));
    assert!(deploy_workflow.contains("GOOGLE_API_KEY"));
    assert!(deploy_workflow.contains("GEMINI_API_KEY"));
    assert!(script.contains("google_ai_api_key"));
    let preview_source = fs::read_to_string(root.join("src/lib.rs"))?;
    assert!(
        preview_source.contains("Gemma request failed locally before a response was received.")
    );
    assert!(!preview_source.contains("format!(\"Gemma request failed locally: {error}"));
    assert!(root.join("static/news/data/latest.json").exists());
    assert!(root.join("static/news/assets/thumb-ai.svg").exists());

    Ok(())
}

#[tokio::test]
async fn renders_plain_post_cards_fragment_that_can_swap_into_existing_tree()
-> Result<(), Box<dyn std::error::Error>> {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let result = build_static_site(root.join("posts"), test_output_dir("fragment")).await?;

    let fragment = render_posts_fragment(&result.posts)?;

    assert!(fragment.trim_start().starts_with("<a class=\"post-card\""));
    assert!(!fragment.contains("AI News Brief — Apr 13"));
    assert!(!fragment.contains(" · news</span>"));
    assert!(fragment.contains("Jinhyuk Kim"));
    assert!(!fragment.contains("Pretext Kinetic Blog"));
    assert!(!fragment.contains("class=\"post-grid\""));
    assert!(!fragment.contains("data-askama-template=\"posts-fragment\""));
    assert!(!fragment.contains("hx-target=\"#posts-surface\""));
    assert!(!fragment.contains("<html"));

    Ok(())
}
