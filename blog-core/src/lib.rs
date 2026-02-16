use anyhow::{Context, Result};
use askama::Template;
use chrono::{DateTime, NaiveDate, TimeZone, Utc};
use maud::{html, PreEscaped};
use once_cell::sync::Lazy;
use pulldown_cmark::{html::push_html, Options, Parser};
use regex::{Captures, Regex};
use serde::{Deserialize, Serialize};
use serde_json::json;
use slug::slugify;
use std::cmp::Ordering;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

static WIKILINK_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(!?)\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]").expect("invalid wikilink regex")
});

static IMG_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"<img\s").expect("invalid img regex"));

#[derive(Debug, Clone)]
pub struct SiteConfig {
    pub base_url: String,
    pub title: String,
    pub description: String,
    pub author: String,
    pub language: String,
}

impl Default for SiteConfig {
    fn default() -> Self {
        Self {
            base_url: "https://example.com".to_string(),
            title: "My Digital Garden".to_string(),
            description: "Thoughts, notes, and connected ideas.".to_string(),
            author: "Author".to_string(),
            language: "en".to_string(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct BuildConfig {
    pub content_dir: PathBuf,
    pub output_dir: PathBuf,
    pub static_dir: PathBuf,
    pub site: SiteConfig,
}

impl Default for BuildConfig {
    fn default() -> Self {
        Self {
            content_dir: PathBuf::from("content/posts"),
            output_dir: PathBuf::from("dist"),
            static_dir: PathBuf::from("static"),
            site: SiteConfig::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct BuildSummary {
    pub posts: usize,
    pub tags: usize,
    pub output_dir: PathBuf,
    pub generated_at: String,
}

#[derive(Debug, Deserialize, Default)]
struct FrontMatter {
    title: Option<String>,
    description: Option<String>,
    slug: Option<String>,
    date: Option<String>,
    updated: Option<String>,
    tags: Option<Vec<String>>,
    aliases: Option<Vec<String>>,
    draft: Option<bool>,
    #[serde(rename = "dg-publish")]
    dg_publish: Option<bool>,
    #[serde(rename = "dg-home")]
    dg_home: Option<bool>,
}

#[derive(Debug, Clone)]
struct PostSeed {
    source_path: PathBuf,
    slug: String,
    title: String,
    description: Option<String>,
    tags: Vec<String>,
    aliases: Vec<String>,
    date: Option<DateTime<Utc>>,
    updated: Option<DateTime<Utc>>,
    is_home: bool,
}

#[derive(Debug, Clone)]
struct Post {
    slug: String,
    title: String,
    description: String,
    excerpt: String,
    tags: Vec<String>,
    date: Option<DateTime<Utc>>,
    updated: Option<DateTime<Utc>>,
    markdown_html: String,
    outgoing_links: Vec<String>,
    reading_time_min: usize,
    is_home: bool,
}

#[derive(Debug, Clone, Serialize)]
struct SearchRecord {
    title: String,
    slug: String,
    url: String,
    excerpt: String,
    tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
struct GraphNode {
    id: String,
    title: String,
    url: String,
}

#[derive(Debug, Clone, Serialize)]
struct GraphLink {
    source: String,
    target: String,
}

#[derive(Debug, Clone)]
struct LayoutContext {
    site_title: String,
    site_description: String,
    site_url: String,
    lang: String,
    page_title: String,
    page_description: String,
    canonical_url: String,
    page_url: String,
    og_type: String,
    published_time: String,
    updated_time: String,
    json_ld: String,
}

#[derive(Debug, Clone)]
struct PostCard {
    title: String,
    url: String,
    excerpt: String,
    date_display: String,
    reading_time_min: usize,
    tags: Vec<TagEntry>,
}

#[derive(Debug, Clone)]
struct TagEntry {
    name: String,
    slug: String,
    count: usize,
}

#[derive(Debug, Clone)]
struct Backlink {
    title: String,
    url: String,
    excerpt: String,
}

#[derive(Template)]
#[template(path = "index.html")]
struct IndexTemplate {
    layout: LayoutContext,
    posts: Vec<PostCard>,
    tags: Vec<TagEntry>,
    home_intro_html: String,
}

#[derive(Template)]
#[template(path = "post.html")]
struct PostTemplate {
    layout: LayoutContext,
    post: PostCard,
    body_html: String,
}

#[derive(Template)]
#[template(path = "tag.html")]
struct TagTemplate {
    layout: LayoutContext,
    tag_name: String,
    posts: Vec<PostCard>,
}

pub fn build_site(config: &BuildConfig) -> Result<BuildSummary> {
    let seeds = collect_post_seeds(config)?;
    let slug_map = build_slug_map(&seeds);
    let mut posts = render_posts(&seeds, &slug_map)?;

    posts.sort_by(sort_posts_by_recency);

    let post_by_slug: HashMap<String, &Post> = posts.iter().map(|p| (p.slug.clone(), p)).collect();
    let backlinks = build_backlinks(&posts, &post_by_slug);
    let tags = build_tag_index(&posts);

    if config.output_dir.exists() {
        fs::remove_dir_all(&config.output_dir)
            .with_context(|| format!("failed to clear {}", config.output_dir.display()))?;
    }

    fs::create_dir_all(&config.output_dir)
        .with_context(|| format!("failed to create {}", config.output_dir.display()))?;

    copy_static_assets(&config.static_dir, &config.output_dir)?;
    ensure_default_css(&config.output_dir)?;

    let home_intro_html = posts
        .iter()
        .find(|p| p.is_home)
        .map(|p| p.markdown_html.clone())
        .unwrap_or_default();

    render_index(config, &posts, &tags, &home_intro_html)?;
    render_posts_pages(config, &posts, &backlinks)?;
    render_tag_pages(config, &tags, &posts)?;
    write_search_index(config, &posts)?;
    write_graph(config, &posts)?;
    write_sitemap(config, &posts, &tags)?;
    write_rss(config, &posts)?;
    write_robots_txt(config)?;

    Ok(BuildSummary {
        posts: posts.len(),
        tags: tags.len(),
        output_dir: config.output_dir.clone(),
        generated_at: Utc::now().to_rfc3339(),
    })
}

fn collect_post_seeds(config: &BuildConfig) -> Result<Vec<PostSeed>> {
    let markdown_files = collect_markdown_files(&config.content_dir)?;
    let mut seeds = Vec::new();
    let mut used_slugs = HashSet::new();

    for path in markdown_files {
        let raw = fs::read_to_string(&path)
            .with_context(|| format!("failed to read {}", path.display()))?;
        let (frontmatter, _) = parse_frontmatter_and_body(&raw)?;

        let should_publish = frontmatter
            .dg_publish
            .unwrap_or(!frontmatter.draft.unwrap_or(false));

        if !should_publish {
            continue;
        }

        let file_stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("untitled")
            .to_string();

        let title = frontmatter.title.unwrap_or_else(|| file_stem.clone());
        let base_slug = frontmatter
            .slug
            .unwrap_or_else(|| slugify(&file_stem));

        let slug = ensure_unique_slug(base_slug, &mut used_slugs);

        let mut tags = frontmatter
            .tags
            .unwrap_or_default()
            .into_iter()
            .map(|tag| clean_tag(&tag))
            .filter(|tag| !tag.is_empty())
            .collect::<Vec<_>>();
        tags.sort();
        tags.dedup();

        let mut aliases = frontmatter
            .aliases
            .unwrap_or_default()
            .into_iter()
            .map(|alias| alias.trim().to_string())
            .filter(|alias| !alias.is_empty())
            .collect::<Vec<_>>();
        aliases.sort();
        aliases.dedup();

        seeds.push(PostSeed {
            source_path: path,
            slug,
            title,
            description: frontmatter.description,
            tags,
            aliases,
            date: frontmatter.date.as_deref().and_then(parse_datetime),
            updated: frontmatter.updated.as_deref().and_then(parse_datetime),
            is_home: frontmatter.dg_home.unwrap_or(false),
        });
    }

    Ok(seeds)
}

fn render_posts(seeds: &[PostSeed], slug_map: &HashMap<String, String>) -> Result<Vec<Post>> {
    let mut posts = Vec::with_capacity(seeds.len());

    for seed in seeds {
        let raw = fs::read_to_string(&seed.source_path)
            .with_context(|| format!("failed to read {}", seed.source_path.display()))?;
        let (_, body) = parse_frontmatter_and_body(&raw)?;

        let (rewritten, outgoing_links) = rewrite_wikilinks(body, slug_map);
        let markdown_html = markdown_to_html(&rewritten);

        let excerpt = extract_excerpt(body, 200);
        let description = seed
            .description
            .clone()
            .unwrap_or_else(|| excerpt.clone());

        posts.push(Post {
            slug: seed.slug.clone(),
            title: seed.title.clone(),
            description,
            excerpt,
            tags: seed.tags.clone(),
            date: seed.date,
            updated: seed.updated,
            markdown_html,
            outgoing_links,
            reading_time_min: estimate_reading_time_minutes(body),
            is_home: seed.is_home,
        });
    }

    Ok(posts)
}

fn render_index(
    config: &BuildConfig,
    posts: &[Post],
    tags: &[TagEntry],
    home_intro_html: &str,
) -> Result<()> {
    let layout = website_layout(
        config,
        config.site.title.clone(),
        config.site.description.clone(),
        "/",
        "website",
        "",
        "",
        website_json_ld(config),
    );

    let template = IndexTemplate {
        layout,
        posts: posts.iter().map(post_to_card).collect(),
        tags: tags.to_vec(),
        home_intro_html: home_intro_html.to_string(),
    };

    write_file(config.output_dir.join("index.html"), template.render()?)
}

fn render_posts_pages(
    config: &BuildConfig,
    posts: &[Post],
    backlinks: &HashMap<String, Vec<Backlink>>,
) -> Result<()> {
    for post in posts {
        let page_path = format!("/notes/{}/", post.slug);
        let json_ld = article_json_ld(config, post);
        let layout = website_layout(
            config,
            format!("{} | {}", post.title, config.site.title),
            post.description.clone(),
            &page_path,
            "article",
            &format_datetime(post.date.clone()),
            &format_datetime(post.updated.clone()),
            json_ld,
        );

        let backlink_list = backlinks.get(&post.slug).cloned().unwrap_or_default();
        let body_html = render_post_body_with_maud(&post.markdown_html, &backlink_list);

        let template = PostTemplate {
            layout,
            post: post_to_card(post),
            body_html,
        };

        let target = config
            .output_dir
            .join("notes")
            .join(&post.slug)
            .join("index.html");

        write_file(target, template.render()?)?;
    }

    Ok(())
}

fn render_tag_pages(config: &BuildConfig, tags: &[TagEntry], posts: &[Post]) -> Result<()> {
    let mut post_map: HashMap<&str, Vec<&Post>> = HashMap::new();
    for post in posts {
        for tag in &post.tags {
            post_map.entry(tag.as_str()).or_default().push(post);
        }
    }

    for tag in tags {
        let mut tag_posts = post_map.get(tag.name.as_str()).cloned().unwrap_or_default();
        tag_posts.sort_by(|a, b| sort_posts_by_recency(a, b));

        let page_path = format!("/tags/{}/", tag.slug);
        let layout = website_layout(
            config,
            format!("#{} | {}", tag.name, config.site.title),
            format!("Posts tagged '{}'", tag.name),
            &page_path,
            "website",
            "",
            "",
            website_json_ld(config),
        );

        let template = TagTemplate {
            layout,
            tag_name: tag.name.clone(),
            posts: tag_posts.into_iter().map(post_to_card).collect(),
        };

        let target = config
            .output_dir
            .join("tags")
            .join(&tag.slug)
            .join("index.html");

        write_file(target, template.render()?)?;
    }

    Ok(())
}

fn write_search_index(config: &BuildConfig, posts: &[Post]) -> Result<()> {
    let entries = posts
        .iter()
        .map(|post| SearchRecord {
            title: post.title.clone(),
            slug: post.slug.clone(),
            url: format!("/notes/{}/", post.slug),
            excerpt: post.excerpt.clone(),
            tags: post.tags.clone(),
        })
        .collect::<Vec<_>>();

    let json = serde_json::to_string_pretty(&entries)?;
    write_file(config.output_dir.join("search-index.json"), json)
}

fn write_graph(config: &BuildConfig, posts: &[Post]) -> Result<()> {
    let nodes = posts
        .iter()
        .map(|post| GraphNode {
            id: post.slug.clone(),
            title: post.title.clone(),
            url: format!("/notes/{}/", post.slug),
        })
        .collect::<Vec<_>>();

    let mut links = Vec::new();
    let known: HashSet<&str> = posts.iter().map(|p| p.slug.as_str()).collect();

    for post in posts {
        for target in &post.outgoing_links {
            if known.contains(target.as_str()) {
                links.push(GraphLink {
                    source: post.slug.clone(),
                    target: target.clone(),
                });
            }
        }
    }

    let graph = json!({ "nodes": nodes, "links": links });
    write_file(
        config.output_dir.join("graph.json"),
        serde_json::to_string_pretty(&graph)?,
    )
}

fn write_sitemap(config: &BuildConfig, posts: &[Post], tags: &[TagEntry]) -> Result<()> {
    let mut xml = String::new();
    xml.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    xml.push_str("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");

    append_sitemap_url(&mut xml, &absolute_url(&config.site.base_url, "/"), None);

    for post in posts {
        append_sitemap_url(
            &mut xml,
            &absolute_url(&config.site.base_url, &format!("/notes/{}/", post.slug)),
            post.updated.clone().or(post.date.clone()),
        );
    }

    for tag in tags {
        append_sitemap_url(
            &mut xml,
            &absolute_url(&config.site.base_url, &format!("/tags/{}/", tag.slug)),
            None,
        );
    }

    xml.push_str("</urlset>\n");

    write_file(config.output_dir.join("sitemap.xml"), xml)
}

fn write_rss(config: &BuildConfig, posts: &[Post]) -> Result<()> {
    let mut xml = String::new();
    xml.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    xml.push_str("<rss version=\"2.0\">\n");
    xml.push_str("<channel>\n");
    writeln!(xml, "<title>{}</title>", escape_xml(&config.site.title))?;
    writeln!(
        xml,
        "<link>{}</link>",
        escape_xml(&absolute_url(&config.site.base_url, "/"))
    )?;
    writeln!(
        xml,
        "<description>{}</description>",
        escape_xml(&config.site.description)
    )?;
    writeln!(xml, "<language>{}</language>", escape_xml(&config.site.language))?;

    for post in posts.iter().take(30) {
        xml.push_str("<item>\n");
        writeln!(xml, "<title>{}</title>", escape_xml(&post.title))?;
        let link = absolute_url(&config.site.base_url, &format!("/notes/{}/", post.slug));
        writeln!(xml, "<link>{}</link>", escape_xml(&link))?;
        writeln!(xml, "<guid>{}</guid>", escape_xml(&link))?;
        writeln!(xml, "<description>{}</description>", escape_xml(&post.excerpt))?;
        writeln!(
            xml,
            "<pubDate>{}</pubDate>",
            post.date.clone().unwrap_or_else(Utc::now).to_rfc2822()
        )?;
        xml.push_str("</item>\n");
    }

    xml.push_str("</channel>\n");
    xml.push_str("</rss>\n");

    write_file(config.output_dir.join("rss.xml"), xml)
}

fn write_robots_txt(config: &BuildConfig) -> Result<()> {
    let body = format!(
        "User-agent: *\nAllow: /\n\nSitemap: {}\n",
        absolute_url(&config.site.base_url, "/sitemap.xml")
    );
    write_file(config.output_dir.join("robots.txt"), body)
}

fn write_file(path: PathBuf, contents: String) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }

    fs::write(&path, contents).with_context(|| format!("failed to write {}", path.display()))
}

fn collect_markdown_files(content_dir: &Path) -> Result<Vec<PathBuf>> {
    if !content_dir.exists() {
        return Ok(Vec::new());
    }

    let mut files = WalkDir::new(content_dir)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
        .map(|entry| entry.path().to_path_buf())
        .filter(|path| {
            path.extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| matches!(ext, "md" | "markdown"))
                .unwrap_or(false)
        })
        .collect::<Vec<_>>();

    files.sort();
    Ok(files)
}

fn parse_frontmatter_and_body(raw: &str) -> Result<(FrontMatter, &str)> {
    let has_unix = raw.starts_with("---\n");
    let has_windows = raw.starts_with("---\r\n");

    if has_unix {
        if let Some(end) = raw[4..].find("\n---\n") {
            let frontmatter = &raw[4..4 + end];
            let body = &raw[4 + end + 5..];
            let parsed: FrontMatter = serde_yaml::from_str(frontmatter)
                .with_context(|| "failed to parse YAML frontmatter")?;
            return Ok((parsed, body));
        }
    }

    if has_windows {
        if let Some(end) = raw[5..].find("\r\n---\r\n") {
            let frontmatter = &raw[5..5 + end];
            let body = &raw[5 + end + 8..];
            let parsed: FrontMatter = serde_yaml::from_str(frontmatter)
                .with_context(|| "failed to parse YAML frontmatter")?;
            return Ok((parsed, body));
        }
    }

    Ok((FrontMatter::default(), raw))
}

fn build_slug_map(seeds: &[PostSeed]) -> HashMap<String, String> {
    let mut map = HashMap::new();

    for seed in seeds {
        map.insert(normalize_lookup(&seed.slug), seed.slug.clone());
        map.insert(normalize_lookup(&seed.title), seed.slug.clone());

        if let Some(stem) = seed.source_path.file_stem().and_then(|s| s.to_str()) {
            map.insert(normalize_lookup(stem), seed.slug.clone());
        }

        for alias in &seed.aliases {
            map.insert(normalize_lookup(alias), seed.slug.clone());
        }
    }

    map
}

fn rewrite_wikilinks(markdown: &str, slug_map: &HashMap<String, String>) -> (String, Vec<String>) {
    let mut outgoing = Vec::new();

    let rewritten = WIKILINK_RE
        .replace_all(markdown, |caps: &Captures| {
            let is_embed = caps.get(1).map(|m| m.as_str() == "!").unwrap_or(false);
            let target_raw = caps.get(2).map(|m| m.as_str().trim()).unwrap_or_default();
            let heading = caps.get(3).map(|m| m.as_str().trim());
            let label = caps.get(4).map(|m| m.as_str().trim()).unwrap_or(target_raw);

            if let Some(slug) = slug_map.get(&normalize_lookup(target_raw)) {
                let mut target_url = format!("/notes/{}/", slug);
                if let Some(anchor) = heading {
                    if !anchor.is_empty() {
                        target_url.push('#');
                        target_url.push_str(&slugify(anchor));
                    }
                }

                outgoing.push(slug.clone());

                let display = if is_embed {
                    format!("{} (embedded)", label)
                } else {
                    label.to_string()
                };

                format!("[{}]({})", display, target_url)
            } else {
                format!("`[[{}]]`", target_raw)
            }
        })
        .to_string();

    outgoing.sort();
    outgoing.dedup();

    (rewritten, outgoing)
}

fn markdown_to_html(markdown: &str) -> String {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_TASKLISTS);
    options.insert(Options::ENABLE_FOOTNOTES);

    let parser = Parser::new_ext(markdown, options);
    let mut html = String::new();
    push_html(&mut html, parser);

    IMG_RE
        .replace_all(&html, "<img loading=\"lazy\" decoding=\"async\" ")
        .to_string()
}

fn render_post_body_with_maud(markdown_html: &str, backlinks: &[Backlink]) -> String {
    html! {
        article class="note-body" {
            (PreEscaped(markdown_html))
        }
        @if !backlinks.is_empty() {
            section class="backlinks" {
                h2 { "Linked Mentions" }
                ul {
                    @for link in backlinks {
                        li {
                            a href=(link.url) { (link.title) }
                            p { (link.excerpt) }
                        }
                    }
                }
            }
        }
    }
    .into_string()
}

fn build_backlinks(posts: &[Post], known_posts: &HashMap<String, &Post>) -> HashMap<String, Vec<Backlink>> {
    let mut backlinks: HashMap<String, Vec<Backlink>> = HashMap::new();

    for source in posts {
        for target in &source.outgoing_links {
            if known_posts.contains_key(target) && target != &source.slug {
                let entry = Backlink {
                    title: source.title.clone(),
                    url: format!("/notes/{}/", source.slug),
                    excerpt: source.excerpt.clone(),
                };

                let items = backlinks.entry(target.clone()).or_default();
                if !items.iter().any(|item| item.url == entry.url) {
                    items.push(entry);
                }
            }
        }
    }

    backlinks
}

fn build_tag_index(posts: &[Post]) -> Vec<TagEntry> {
    let mut counts: BTreeMap<String, usize> = BTreeMap::new();

    for post in posts {
        for tag in &post.tags {
            *counts.entry(tag.clone()).or_insert(0) += 1;
        }
    }

    counts
        .into_iter()
        .map(|(name, count)| TagEntry {
            slug: slugify(&name),
            name,
            count,
        })
        .collect()
}

fn post_to_card(post: &Post) -> PostCard {
    PostCard {
        title: post.title.clone(),
        url: format!("/notes/{}/", post.slug),
        excerpt: post.excerpt.clone(),
        date_display: post
            .date
            .map(|date| date.format("%Y-%m-%d").to_string())
            .unwrap_or_else(|| "Undated".to_string()),
        reading_time_min: post.reading_time_min,
        tags: post
            .tags
            .iter()
            .map(|tag| TagEntry {
                slug: slugify(tag),
                name: tag.clone(),
                count: 0,
            })
            .collect(),
    }
}

fn website_layout(
    config: &BuildConfig,
    page_title: String,
    page_description: String,
    page_path: &str,
    og_type: &str,
    published_time: &str,
    updated_time: &str,
    json_ld: String,
) -> LayoutContext {
    let canonical_url = absolute_url(&config.site.base_url, page_path);

    LayoutContext {
        site_title: config.site.title.clone(),
        site_description: config.site.description.clone(),
        site_url: config.site.base_url.clone(),
        lang: config.site.language.clone(),
        page_title,
        page_description,
        canonical_url: canonical_url.clone(),
        page_url: canonical_url,
        og_type: og_type.to_string(),
        published_time: published_time.to_string(),
        updated_time: updated_time.to_string(),
        json_ld,
    }
}

fn website_json_ld(config: &BuildConfig) -> String {
    json!({
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": &config.site.title,
        "url": absolute_url(&config.site.base_url, "/"),
        "description": &config.site.description,
    })
    .to_string()
}

fn article_json_ld(config: &BuildConfig, post: &Post) -> String {
    json!({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": &post.title,
        "description": &post.description,
        "datePublished": format_datetime(post.date.clone()),
        "dateModified": format_datetime(post.updated.clone().or(post.date.clone())),
        "author": {
            "@type": "Person",
            "name": &config.site.author,
        },
        "mainEntityOfPage": absolute_url(&config.site.base_url, &format!("/notes/{}/", post.slug)),
    })
    .to_string()
}

fn copy_static_assets(static_dir: &Path, output_dir: &Path) -> Result<()> {
    if !static_dir.exists() {
        return Ok(());
    }

    for entry in WalkDir::new(static_dir)
        .into_iter()
        .filter_map(|entry| entry.ok())
    {
        let entry_path = entry.path();
        let rel = entry_path.strip_prefix(static_dir).with_context(|| {
            format!(
                "failed to create relative path for {} from {}",
                entry_path.display(),
                static_dir.display()
            )
        })?;

        if rel.as_os_str().is_empty() {
            continue;
        }

        let dest = output_dir.join(rel);

        if entry.file_type().is_dir() {
            fs::create_dir_all(&dest)
                .with_context(|| format!("failed to create {}", dest.display()))?;
        } else {
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent)
                    .with_context(|| format!("failed to create {}", parent.display()))?;
            }

            fs::copy(entry_path, &dest).with_context(|| {
                format!(
                    "failed to copy {} to {}",
                    entry_path.display(),
                    dest.display()
                )
            })?;
        }
    }

    Ok(())
}

fn ensure_default_css(output_dir: &Path) -> Result<()> {
    let css_path = output_dir.join("assets").join("style.css");
    if css_path.exists() {
        return Ok(());
    }

    let default_css = r#":root {
  --bg: #f8f7f2;
  --surface: #ffffff;
  --text: #1f2933;
  --muted: #4b5563;
  --line: #d7dce2;
  --accent: #0057b8;
  --accent-soft: #dbeafe;
  --radius: 12px;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
}

body {
  font-family: "Pretendard", "Noto Sans KR", "IBM Plex Sans", sans-serif;
  background: radial-gradient(circle at top right, #eff6ff 0%, var(--bg) 42%);
  color: var(--text);
  line-height: 1.65;
}

a {
  color: var(--accent);
  text-decoration-thickness: 1.5px;
  text-underline-offset: 2px;
}

a:hover {
  text-decoration-thickness: 2px;
}

.site-shell {
  width: min(980px, calc(100% - 2rem));
  margin: 2rem auto 4rem;
}

.site-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  border-bottom: 1px solid var(--line);
  padding-bottom: 1rem;
  margin-bottom: 1.5rem;
}

.site-title {
  font-size: clamp(1.4rem, 1.4vw + 1rem, 2rem);
  margin: 0;
}

.site-tagline {
  margin: 0.4rem 0 0;
  color: var(--muted);
  font-size: 0.95rem;
}

.site-nav {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  font-size: 0.92rem;
}

.panel {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 1.1rem 1.2rem;
}

.home-intro {
  margin-bottom: 1.25rem;
}

.post-list {
  display: grid;
  gap: 0.8rem;
  margin: 1.4rem 0;
}

.post-item h3 {
  margin: 0 0 0.45rem;
  font-size: 1.1rem;
}

.post-meta {
  color: var(--muted);
  font-size: 0.9rem;
  margin-bottom: 0.35rem;
}

.tag-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 0.65rem;
}

.tag {
  display: inline-block;
  border: 1px solid var(--line);
  background: var(--accent-soft);
  color: #123b70;
  border-radius: 999px;
  padding: 0.15rem 0.6rem;
  font-size: 0.83rem;
  text-decoration: none;
}

.note-header h1 {
  margin: 0 0 0.5rem;
  font-size: clamp(1.6rem, 1.7vw + 1rem, 2.35rem);
}

.note-body :where(h2, h3, h4) {
  margin-top: 1.5rem;
}

.note-body p code,
.note-body li code {
  background: #eef2ff;
  padding: 0.12rem 0.34rem;
  border-radius: 6px;
  font-size: 0.92em;
}

.note-body pre {
  overflow-x: auto;
  padding: 0.9rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #f8fafc;
}

.backlinks {
  margin-top: 2rem;
  border-top: 1px solid var(--line);
  padding-top: 1rem;
}

.backlinks ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.65rem;
}

.backlinks li {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fcfdff;
  padding: 0.7rem;
}

.site-footer {
  margin-top: 2rem;
  color: var(--muted);
  font-size: 0.9rem;
  border-top: 1px solid var(--line);
  padding-top: 0.9rem;
}

@media (max-width: 760px) {
  .site-shell {
    width: calc(100% - 1.2rem);
    margin: 1rem auto 2.3rem;
  }

  .panel {
    padding: 0.9rem;
  }
}
"#;

    if let Some(parent) = css_path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }

    fs::write(&css_path, default_css)
        .with_context(|| format!("failed to write {}", css_path.display()))
}

fn build_post_sort_key(post: &Post) -> i64 {
    post.date
        .clone()
        .map(|date| date.timestamp())
        .unwrap_or(i64::MIN / 2)
}

fn sort_posts_by_recency(a: &Post, b: &Post) -> Ordering {
    build_post_sort_key(b)
        .cmp(&build_post_sort_key(a))
        .then_with(|| a.title.cmp(&b.title))
}

fn format_datetime(datetime: Option<DateTime<Utc>>) -> String {
    datetime.map(|dt| dt.to_rfc3339()).unwrap_or_default()
}

fn ensure_unique_slug(base: String, used: &mut HashSet<String>) -> String {
    let candidate = if base.is_empty() {
        "post".to_string()
    } else {
        base
    };

    if !used.contains(&candidate) {
        used.insert(candidate.clone());
        return candidate;
    }

    let mut idx = 2usize;
    loop {
        let next = format!("{}-{}", candidate, idx);
        if !used.contains(&next) {
            used.insert(next.clone());
            return next;
        }
        idx += 1;
    }
}

fn normalize_lookup(value: &str) -> String {
    value
        .trim()
        .trim_end_matches(".md")
        .trim_end_matches(".markdown")
        .replace('\\', "/")
        .split('/')
        .next_back()
        .unwrap_or(value)
        .trim()
        .to_ascii_lowercase()
}

fn clean_tag(tag: &str) -> String {
    tag.trim().to_ascii_lowercase()
}

fn extract_excerpt(markdown: &str, max_chars: usize) -> String {
    let stripped = markdown
        .lines()
        .map(|line| line.trim())
        .filter(|line| !line.is_empty())
        .filter(|line| !line.starts_with("#"))
        .collect::<Vec<_>>()
        .join(" ");

    let normalized = stripped
        .replace("**", "")
        .replace('*', "")
        .replace('`', "")
        .replace('[', "")
        .replace(']', "")
        .replace('(', "")
        .replace(')', "")
        .replace('>', "")
        .replace('-', " ");

    if normalized.chars().count() <= max_chars {
        normalized
    } else {
        let excerpt = normalized.chars().take(max_chars).collect::<String>();
        format!("{}...", excerpt.trim_end())
    }
}

fn estimate_reading_time_minutes(markdown: &str) -> usize {
    let words = markdown
        .split_whitespace()
        .filter(|token| !token.is_empty())
        .count();

    usize::max(1, words / 220 + usize::from(words % 220 != 0))
}

fn parse_datetime(value: &str) -> Option<DateTime<Utc>> {
    if let Ok(datetime) = DateTime::parse_from_rfc3339(value) {
        return Some(datetime.with_timezone(&Utc));
    }

    if let Ok(date) = NaiveDate::parse_from_str(value, "%Y-%m-%d") {
        if let Some(naive) = date.and_hms_opt(0, 0, 0) {
            return Some(Utc.from_utc_datetime(&naive));
        }
    }

    if let Ok(date) = NaiveDate::parse_from_str(value, "%Y/%m/%d") {
        if let Some(naive) = date.and_hms_opt(0, 0, 0) {
            return Some(Utc.from_utc_datetime(&naive));
        }
    }

    None
}

fn append_sitemap_url(xml: &mut String, url: &str, lastmod: Option<DateTime<Utc>>) {
    xml.push_str("<url>");
    xml.push_str("<loc>");
    xml.push_str(&escape_xml(url));
    xml.push_str("</loc>");

    if let Some(lastmod) = lastmod {
        xml.push_str("<lastmod>");
        xml.push_str(&lastmod.format("%Y-%m-%d").to_string());
        xml.push_str("</lastmod>");
    }

    xml.push_str("</url>\n");
}

fn absolute_url(base_url: &str, path: &str) -> String {
    let base = base_url.trim_end_matches('/');
    let path = if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{}", path)
    };
    format!("{}{}", base, path)
}

fn escape_xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
