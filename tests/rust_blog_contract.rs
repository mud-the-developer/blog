use std::{
    fs,
    path::{Path, PathBuf},
};

use mud_blog::{build_static_site, parse_markdown_post};

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

fn contains_korean_mobile(text: &str) -> bool {
    if text.contains("(+82)") {
        return true;
    }
    let bytes = text.as_bytes();
    for idx in 0..bytes.len() {
        if bytes.get(idx..idx + 3) == Some(b"10-") {
            let tail = &bytes[idx + 3..];
            if tail.len() >= 9
                && tail[0..4].iter().all(u8::is_ascii_digit)
                && tail[4] == b'-'
                && tail[5..9].iter().all(u8::is_ascii_digit)
            {
                return true;
            }
        }
    }
    false
}

#[test]
fn parses_windows_and_unix_frontmatter_identically() {
    let source =
        "---\ntitle: Research\nslug: research\ndate: 2026-10-15\ntags: [cfp, wireless]\n---\nBody";
    let unix = parse_markdown_post(source, "fallback");
    let windows = parse_markdown_post(&source.replace('\n', "\r\n"), "fallback");
    assert_eq!(windows.title, unix.title);
    assert_eq!(windows.slug, unix.slug);
    assert_eq!(windows.date, unix.date);
    assert_eq!(windows.tags, unix.tags);
    assert_eq!(windows.body, unix.body);
    assert_eq!(windows.html, unix.html);
}

#[tokio::test]
async fn heading_links_have_unique_ids_without_changing_cfp_rendering()
-> Result<(), Box<dyn std::error::Error>> {
    let root = test_output_dir("heading-links");
    fs::create_dir_all(root.join("blog"))?;
    fs::create_dir_all(root.join("cfp"))?;
    let source = "---\ntitle: Main Heading\n---\n# Main Heading\n## Details\n## Details\n## Kept {#explicit}\n";
    fs::write(root.join("blog/test.md"), source)?;
    fs::write(root.join("cfp/test.md"), source)?;
    let posts = mud_blog::load_posts(&root).await?;
    let blog = posts.iter().find(|post| post.folder == "blog").unwrap();
    let page = mud_blog::render_post_page(blog, &posts)?;
    assert!(page.contains("<h1 id=\"main-heading\">Main Heading</h1>"));
    assert!(page.contains("<h2 id=\"details\">"));
    assert!(page.contains("<h2 id=\"details-2\">"));
    assert!(page.contains("<h2 id=\"explicit\">"));
    let cfp = posts.iter().find(|post| post.folder == "cfp").unwrap();
    assert!(cfp.html.contains("<h2>Details</h2>"));
    fs::remove_dir_all(root)?;
    Ok(())
}

fn test_output_dir(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("target")
        .join("contract-dist")
        .join(format!("{}-{}", name, std::process::id()))
}

#[tokio::test]
async fn builds_v3_personal_site_with_cv_projects_writing_and_functional_pretext()
-> Result<(), Box<dyn std::error::Error>> {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let out_dir = test_output_dir("public-polish");
    let expected_post_count = count_markdown_posts(&root.join("posts"))?;

    let result = build_static_site(root.join("posts"), &out_dir).await?;
    let expected_writing_post_count = result
        .posts
        .iter()
        .filter(|post| post.folder != "news")
        .count();

    assert_eq!(result.posts.len(), expected_post_count);
    assert!(out_dir.join("index.html").exists());
    assert!(out_dir.join("projects/index.html").exists());
    assert!(out_dir.join("cv/index.html").exists());
    assert!(out_dir.join("cv/jinhyuk-kim-cv.pdf").exists());
    assert!(out_dir.join("writing/index.html").exists());
    assert!(out_dir.join("archive.json").exists());
    assert!(out_dir.join("robots.txt").exists());
    let not_found = fs::read_to_string(out_dir.join("404.html"))?;
    assert!(not_found.contains("Page not found"));
    assert!(not_found.contains("noindex"));
    assert!(out_dir.join("assets/safe-url.mjs").exists());
    assert!(out_dir.join("sitemap.xml").exists());
    assert!(out_dir.join("news/index.html").exists());
    assert!(out_dir.join("news/search/index.html").exists());
    assert!(!out_dir.join("assets/pretext-polish.mjs").exists());
    assert!(!out_dir.join("assets/pretext-polish-effects.mjs").exists());
    assert!(!out_dir.join("assets/pretext-editorial.mjs").exists());
    assert!(out_dir.join("assets/pretext/layout.js").exists());
    assert!(out_dir.join("assets/pretext-stage.mjs").exists());
    assert!(out_dir.join("assets/v3-interactive-state.mjs").exists());
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
    assert!(sitemap.contains("<loc>https://mud-blog.pages.dev/projects/</loc>"));
    assert!(sitemap.contains("<loc>https://mud-blog.pages.dev/cv/</loc>"));
    assert!(sitemap.contains("<loc>https://mud-blog.pages.dev/writing/</loc>"));
    assert!(sitemap.contains("<loc>https://mud-blog.pages.dev/news/</loc>"));
    assert!(sitemap.contains("<loc>https://mud-blog.pages.dev/news/search/</loc>"));
    assert!(sitemap.contains("<loc>https://mud-blog.pages.dev/cfp/</loc>"));
    assert_eq!(sitemap.matches("<url>").count(), expected_post_count + 7);

    assert!(index.contains("href=\"/projects/\""));
    assert!(index.contains("href=\"/cv/\""));
    assert!(index.contains("href=\"/writing/\""));
    assert!(index.contains("href=\"/cfp/\""));
    assert!(index.contains("href=\"/news/\""));
    assert!(index.contains("data-theme-toggle"));
    assert!(index.contains("aria-label=\"Toggle color theme: System\""));
    assert!(index.contains("/assets/site-chrome.mjs"));
    assert!(index.contains("/assets/pretext-stage.mjs"));
    assert!(index.contains("data-layout=\"v3-dossier\""));
    assert!(index.contains("data-palette=\"pair-07\""));
    assert!(index.contains("data-pretext-stage"));
    assert!(index.contains("v3-home-shell"));
    assert!(index.contains("v3-intro"));
    assert!(index.contains("v3-work-grid"));
    assert!(index.contains("v3-pub-list"));
    assert!(index.contains("v3-affil-strip"));
    assert!(!index.contains("data-copy-bibtex"));
    assert!(!index.contains("data-research-cluster"));
    assert!(!index.contains("data-theme-filter-bar"));
    assert!(!index.contains("section-writing"));
    assert!(index.contains("Jinhyuk Kim"));
    assert!(index.contains("RAMO Laboratory"));
    assert!(index.contains("Uncertainty-Aware Hybrid Inference"));
    assert!(index.contains("Call for Papers"));
    assert!(index.contains("Automation"));
    assert!(index.contains("data-icon=\"home\""));
    assert!(!index.contains("CFP Radar"));
    assert!(!index.contains("Live System"));
    assert!(!index.contains("v3-shape"));
    assert!(index.contains("AI News Digest"));
    assert!(!index.contains("href=\"/cv/jinhyuk-kim-cv.pdf\""));
    assert!(!contains_korean_mobile(&index));
    assert!(!index.contains("data-pretext-editorial"));
    assert!(!index.contains("aria-label=\"post text rain\""));
    assert!(!index.contains("aria-label=\"ambient animated index\""));
    assert!(!index.contains("data-pretext-polish"));
    assert!(!index.contains("data-focused-issue-lab"));
    assert!(!index.contains("data-blog-chat"));
    assert!(!index.contains("/assets/pretext-polish.mjs"));
    assert!(!index.contains("/assets/blog-lab.mjs"));
    assert!(!index.contains("GOOGLE_AI_API_KEY"));
    assert!(!index.contains("GEMINI_API_KEY"));
    assert!(!index.contains("읽기 좋은 노트"));
    assert!(!index.contains("Readable archive"));
    assert!(!index.contains("Markdown archive"));
    assert!(!index.contains("Pretext Kinetic Blog"));
    assert!(!index.contains("Research Radar"));
    assert!(!index.contains("README Post Template"));
    assert!(!index.contains("About Jinhyuk"));
    assert!(!index.contains("tokio · askama · htmx"));
    assert!(!index.contains("refresh fragment"));

    let projects_html = fs::read_to_string(out_dir.join("projects/index.html"))?;
    assert!(projects_html.contains("data-askama-template=\"projects\""));
    assert!(projects_html.contains("data-layout=\"v3-projects\""));
    assert!(projects_html.contains("LLM-Based 5G Beamforming for AI-RAN"));
    assert!(projects_html.contains("Call for Papers"));
    assert!(!projects_html.contains("Live Systems"));
    assert!(!projects_html.contains("v3-shape"));
    assert!(projects_html.contains("posts/projects/"));

    let cv_html = fs::read_to_string(out_dir.join("cv/index.html"))?;
    assert!(cv_html.contains("data-askama-template=\"cv\""));
    assert!(cv_html.contains("data-layout=\"v3-cv\""));
    assert!(cv_html.contains("Yonsei University"));
    assert!(cv_html.contains("Singapore University of Technology and Design"));
    assert!(cv_html.contains("Institute of Science Tokyo"));
    assert!(cv_html.contains("/cv/jinhyuk-kim-cv.pdf"));
    assert!(cv_html.contains("/assets/cv/yonsei_logo.png"));
    assert!(!contains_korean_mobile(&cv_html));
    assert!(!cv_html.contains("Submitted to"));
    let writing_html = fs::read_to_string(out_dir.join("writing/index.html"))?;
    assert!(writing_html.contains("data-askama-template=\"writing\""));
    assert!(writing_html.contains("data-layout=\"v3-writing\""));
    assert!(writing_html.contains("class=\"filetree\""));
    assert!(!writing_html.contains("<details class=\"filetree-folder\" data-folder=\"news\""));
    assert!(!writing_html.contains("<span>news/</span>"));
    assert_eq!(
        writing_html.matches("class=\"filetree-file\"").count(),
        expected_writing_post_count
    );
    assert_eq!(
        writing_html.matches("class=\"post-card\"").count(),
        expected_writing_post_count
    );

    let style = fs::read_to_string(out_dir.join("assets/style.css"))?;
    assert!(style.contains(".v3-home-shell"));
    assert!(style.contains(".v3-work-grid"));
    assert!(style.contains(".v3-pub-list"));
    assert!(style.contains(".v3-affil-strip"));
    assert!(style.contains(".v3-logo-adaptive"));
    assert!(style.contains(".v3-bio-line"));
    assert!(!style.contains(".v3-cluster-card"));
    assert!(!style.contains(".v3-filter-dock"));
    assert!(style.contains(".v3-cv-entry"));
    assert!(style.contains(".v3-cmd-dialog"));
    assert!(!style.contains(".pretext-editorial-canvas"));
    assert!(!style.contains(".pretext-polish"));
    assert!(style.contains(".filetree"));
    assert!(style.contains(".post-body :is"));
    assert!(!style.contains(".profile-publication-widget"));
    assert!(!style.contains(".public-shell"));
    assert!(!style.contains(".archive-command-deck"));
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
        style.len() <= 72_000,
        "v3 personal site CSS should stay bounded (actual: {} bytes)",
        style.len()
    );

    let project_post =
        fs::read_to_string(out_dir.join("posts/mwc26-ai-ran-beamforming/index.html"))?;
    assert!(project_post.contains("class=\"post-reader\""));
    assert!(project_post.contains("data-folder=\"projects\""));
    for slug in [
        "ai-news-digest-system",
        "cfp-radar-system",
        "hwp-editor-public",
        "licheerv-nano-fido2",
        "mudplot",
        "mwc25-drl-beamforming",
        "mwc26-ai-ran-beamforming",
        "niri-desktop-suite",
        "rusty-note",
    ] {
        assert!(out_dir.join(format!("posts/{slug}/index.html")).is_file());
        for framing in ["", "-compact"] {
            for suffix in [".mp4", "-poster.png", "-dark.mp4", "-dark-poster.png"] {
                let media = format!("assets/media/{slug}{framing}{suffix}");
                assert!(out_dir.join(&media).is_file(), "missing {media}");
            }
        }
    }

    assert!(!out_dir.join("posts/jinhyuk-kim/index.html").exists());
    assert!(!out_dir.join("posts/home/index.html").exists());
    assert!(!out_dir.join("posts/uhlm-2412-12687/index.html").exists());
    assert!(!out_dir.join("fragments/posts.html").exists());

    let latest_news_post = result
        .posts
        .iter()
        .find(|post| post.folder == "news" && post.slug.ends_with("-ai-news-digest"))
        .expect("at least one daily AI news digest post should exist");
    assert!(
        out_dir
            .join(format!("posts/{}/index.html", latest_news_post.slug))
            .exists()
    );
    assert!(
        out_dir
            .join("posts/news-digest-archive/index.html")
            .exists()
    );

    let latest_digest =
        fs::read_to_string(out_dir.join(format!("posts/{}/index.html", latest_news_post.slug)))?;
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
    assert!(news.contains("data-news-visual-summary"));
    assert!(news.contains("<svg class=\"news-visual-svg\""));
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
    assert!(cfp.contains("wireless communications"));
    assert!(cfp.contains("/cfp/data/latest.json"));
    assert!(cfp.contains("Nearest submission deadlines"));
    assert!(!cfp.contains("data-cfp-history"));
    assert!(!cfp.contains("Weekly CFP archive"));
    assert_eq!(
        result
            .posts
            .iter()
            .filter(|post| post.folder == "cfp")
            .count(),
        1
    );
    assert!(!out_dir.join("posts/2026-10-12-cfp-radar").exists());
    assert!(out_dir.join("cfp/data/latest.json").exists());
    assert!(out_dir.join("cfp/radar.ics").exists());

    let cfp_post = fs::read_to_string(out_dir.join("posts/cfp-radar/index.html"))?;
    assert!(cfp_post.contains("Nearest submission deadlines"));
    assert!(cfp_post.contains("/assets/cfp-deadlines.mjs"));
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
    assert!(!news.contains("blog-lab.mjs"));

    // Security headers, RSS feeds, sitemap lastmod, SEO, reader UX, OSS projects & Scholar metrics
    let headers = fs::read_to_string(out_dir.join("_headers"))?;
    assert!(headers.contains("Content-Security-Policy:"));
    assert!(headers.contains("X-Frame-Options: DENY"));

    let rss = fs::read_to_string(out_dir.join("rss.xml"))?;
    assert!(rss.contains("<rss version=\"2.0\""));
    assert!(rss.contains("https://mud-blog.pages.dev/posts/mudplot/"));
    let news_rss = fs::read_to_string(out_dir.join("news/rss.xml"))?;
    assert!(news_rss.contains("<rss version=\"2.0\""));

    let sitemap = fs::read_to_string(out_dir.join("sitemap.xml"))?;
    assert!(sitemap.contains("<lastmod>"));

    let index_html = fs::read_to_string(out_dir.join("index.html"))?;
    assert!(index_html.contains("rel=\"canonical\""));
    assert!(index_html.contains("property=\"og:image\""));
    assert!(index_html.contains("application/ld+json"));
    assert!(index_html.contains("cites"));
    let cv_html = fs::read_to_string(out_dir.join("cv/index.html"))?;
    assert!(cv_html.contains("data-scholar-summary"));
    assert!(cv_html.contains("data-paper-citations"));

    let mudplot_post = fs::read_to_string(out_dir.join("posts/mudplot/index.html"))?;
    assert!(mudplot_post.contains("lang=\"en\""));
    assert!(mudplot_post.contains("class=\"post-toc\""));
    assert!(mudplot_post.contains("class=\"code-block\""));
    assert!(mudplot_post.contains("data-copy-code"));
    assert!(mudplot_post.contains("<math xmlns=\"http://www.w3.org/1998/Math/MathML\""));
    assert!(mudplot_post.contains("class=\"post-pager\""));
    assert!(!mudplot_post.contains("/assets/cfp-deadlines.mjs"));
    assert!(cv_html.contains("href=\"/rss.xml\""));
    let writing_html = fs::read_to_string(out_dir.join("writing/index.html"))?;
    assert!(writing_html.contains("href=\"/rss.xml\""));
    assert!(news.contains("href=\"/news/rss.xml\""));
    assert!(out_dir.join("assets/post-reader.css").exists());
    assert!(out_dir.join("assets/media/og-card.png").exists());

    let asset_v = mud_blog::asset_version();
    assert_eq!(asset_v.len(), 10);
    assert!(index_html.contains(&format!("/assets/style.css?v={asset_v}")));
    assert!(index_html.contains(&format!("/assets/site-chrome.mjs?v={asset_v}")));
    assert!(mudplot_post.contains(&format!("/assets/post-reader.css?v={asset_v}")));
    let not_found_html = fs::read_to_string(out_dir.join("404.html"))?;
    assert!(not_found_html.contains(&format!("/assets/style.css?v={asset_v}")));

    let rum_js = fs::read_to_string(out_dir.join("assets/web-vitals-rum.js"))?;
    assert!(!rum_js.contains("unpkg.com"));

    Ok(())
}

#[tokio::test]
async fn loads_folder_posts_after_removing_duplicate_and_internal_scaffold_posts()
-> Result<(), Box<dyn std::error::Error>> {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let expected_post_count = count_markdown_posts(&root.join("posts"))?;

    for folder in ["cfp", "news", "projects"] {
        assert!(
            root.join("posts").join(folder).is_dir(),
            "posts should include a public {folder}/ folder"
        );
    }
    for removed_folder in ["about", "blog", "papers"] {
        assert!(
            !root.join("posts").join(removed_folder).exists(),
            "legacy {removed_folder}/ folder should be removed"
        );
    }
    assert!(!root.join("posts/about/jinhyuk-kim.md").exists());
    assert!(!root.join("posts/about/about-jinhyuk.md").exists());
    assert!(!root.join("posts/meta/pretext-kinetic-blog.md").exists());
    assert!(!root.join("posts/meta/research-radar.md").exists());
    assert!(!root.join("posts/meta/readme-post-template.md").exists());
    assert!(!root.join("posts/blog/second-brain.md").exists());
    assert!(!root.join("posts/papers/uhlm-2412-12687.md").exists());
    assert!(
        root.join("posts/projects/mwc26-ai-ran-beamforming.md")
            .exists()
    );
    assert!(root.join("posts/projects/cfp-radar-system.md").exists());

    let result = build_static_site(root.join("posts"), test_output_dir("migration")).await?;
    let titles = result
        .posts
        .iter()
        .map(|post| post.title.as_str())
        .collect::<Vec<_>>();

    assert_eq!(result.posts.len(), expected_post_count);
    assert!(titles.contains(&"LLM-Based 5G Beamforming for AI-RAN"));
    assert!(titles.contains(&"Call for Papers — Automated Deadline Pipeline"));
    assert!(
        titles
            .iter()
            .any(|title| title.starts_with("AI News Brief —"))
    );
    assert!(titles.contains(&"Daily AI News Archive"));
    assert!(!titles.contains(&"Jinhyuk Kim"));
    assert!(!titles.contains(&"Second Brain Architecture"));
    assert!(!titles.contains(&"About Jinhyuk"));
    assert!(!titles.contains(&"Pretext Kinetic Blog"));
    assert!(!titles.contains(&"Research Radar"));
    assert!(!titles.contains(&"README Post Template"));
    assert!(!titles.contains(&"Co-SLM"));
    assert!(!titles.contains(
        &"Uncertainty-Aware Hybrid Inference with On-Device Small and Remote Large Language Models"
    ));
    assert!(
        !titles
            .iter()
            .any(|title| title.contains("Overflow Regression Case"))
    );

    let cfp_project = result
        .posts
        .iter()
        .find(|post| post.slug == "cfp-radar-system");
    assert!(cfp_project.is_some());
    let Some(cfp_project) = cfp_project else {
        return Ok(());
    };
    assert!(cfp_project.tags.contains(&"rust".to_string()));
    assert!(cfp_project.html.contains("/cfp/"));

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
    assert!(script.contains("DEFAULT_RETENTION_DAYS = 60"));
    assert!(
        workflow
            .contains("NVIDIA_NIM_MODEL: ${{ vars.NVIDIA_NIM_MODEL || secrets.NVIDIA_NIM_MODEL }}")
    );
    assert!(workflow.contains("git pull --rebase origin main"));
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
