use anyhow::{Context, Result};
use askama::Template;
use chrono::{DateTime, NaiveDate, TimeZone, Utc};
use maud::{html, PreEscaped};
use once_cell::sync::Lazy;
use pulldown_cmark::{html::push_html, Options, Parser};
use regex::{Captures, Regex};
use serde::{Deserialize, Serialize};
use serde_json::json;
use serde_yaml::Value as YamlValue;
use slug::slugify;
use std::cmp::Ordering;
use std::collections::{BTreeMap, HashMap, HashSet, VecDeque};
use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

static WIKILINK_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(!?)\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]")
        .expect("invalid wikilink regex")
});

static IMG_RE: Lazy<Regex> = Lazy::new(|| Regex::new(r"<img\s").expect("invalid img regex"));
static HEADING_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r#"(?s)<h([1-6])>(.*?)</h[1-6]>"#).expect("invalid heading regex"));
static HEADING_WITH_ID_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?s)<h([2-4]) id="([^"]+)">(.*?)</h[2-4]>"#)
        .expect("invalid heading with id regex")
});
static MARKDOWN_HEADING_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^\s{0,3}(#{1,6})\s+(.+?)\s*$").expect("invalid markdown heading regex")
});
static CALLOUT_MARKER_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^\s*>\s*\[!([A-Za-z0-9_-]+)\]([+-])?\s*(.*?)\s*$")
        .expect("invalid callout marker regex")
});
static DATAVIEW_LIST_FROM_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)^\s*LIST\s+FROM\s+#([A-Za-z0-9_-]+)\s*$").expect("invalid dataview list regex")
});
static DATAVIEW_TABLE_FROM_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)^\s*TABLE(?:\s+[A-Za-z0-9_,\s]+)?\s+FROM\s+#([A-Za-z0-9_-]+)\s*$")
        .expect("invalid dataview table regex")
});
static DATAVIEW_TASK_FROM_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)^\s*TASK\s+FROM\s+#([A-Za-z0-9_-]+)\s*$").expect("invalid dataview task regex")
});
static DATAVIEW_SORT_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)^\s*SORT\s+(?:file\.name|title)\s*(ASC|DESC)?\s*$")
        .expect("invalid dataview sort regex")
});
static DATAVIEW_LIMIT_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)^\s*LIMIT\s+([0-9]{1,4})\s*$").expect("invalid dataview limit regex")
});
static DATAVIEW_WHERE_TITLE_CONTAINS_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?i)^\s*WHERE\s+contains\(\s*title\s*,\s*["']([^"']+)["']\s*\)\s*$"#)
        .expect("invalid dataview where title regex")
});
static DATAVIEW_WHERE_TAG_CONTAINS_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?i)^\s*WHERE\s+contains\(\s*tags\s*,\s*["']?#?([A-Za-z0-9_-]+)["']?\s*\)\s*$"#)
        .expect("invalid dataview where tag regex")
});
static DATAVIEW_INLINE_THIS_FILE_NAME_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)`=\s*this\.file\.name\s*`").expect("invalid dataview inline file name regex")
});
static DATAVIEW_INLINE_THIS_FILE_LINK_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)`=\s*this\.file\.link\s*`").expect("invalid dataview inline file link regex")
});
static DATAVIEW_INLINE_PAGES_LENGTH_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?i)`=\s*dv\.pages\(\s*["']#?([A-Za-z0-9_-]+)["']\s*\)\.length\s*`"#)
        .expect("invalid dataview inline pages length regex")
});
static NOTE_LINK_MARKDOWN_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\]\(/notes/([^)]+)\)").expect("invalid markdown note link regex"));
static HTML_TAG_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?s)<[^>]+>").expect("invalid html tag regex"));
static HIGHLIGHT_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"==([^=\n][^=\n]*?)==").expect("invalid highlight regex"));

const SUPPORTED_FRONTMATTER_KEYS: &[&str] = &[
    "title",
    "description",
    "slug",
    "dg-path",
    "dg-permalink",
    "date",
    "updated",
    "tags",
    "aliases",
    "draft",
    "dg-publish",
    "dg-home",
    "dg-enable-search",
    "dg-show-local-graph",
    "dg-pinned",
    "dg-hide",
    "dg-hide-in-graph",
    "dg-note-icon",
    "dg-metatags",
    "dg-content-classes",
];

#[derive(Debug, Clone)]
pub struct SiteText {
    pub search_placeholder: String,
    pub pages_heading: String,
    pub toc_heading: String,
    pub backlinks_heading: String,
    pub backlinks_empty: String,
}

impl Default for SiteText {
    fn default() -> Self {
        Self {
            search_placeholder: "Search notes...".to_string(),
            pages_heading: "Pages".to_string(),
            toc_heading: "On This Page".to_string(),
            backlinks_heading: "Linked Mentions".to_string(),
            backlinks_empty: "No linked mentions yet.".to_string(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct SiteConfig {
    pub base_url: String,
    pub title: String,
    pub description: String,
    pub author: String,
    pub language: String,
    pub text: SiteText,
}

impl Default for SiteConfig {
    fn default() -> Self {
        Self {
            base_url: "https://example.com".to_string(),
            title: "Mud's Blog".to_string(),
            description: "Thoughts, notes, and connected ideas.".to_string(),
            author: "Author".to_string(),
            language: "en".to_string(),
            text: SiteText::default(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct BuildConfig {
    pub content_dir: PathBuf,
    pub output_dir: PathBuf,
    pub static_dir: PathBuf,
    pub site: SiteConfig,
    pub publish_policy: PublishPolicy,
}

impl Default for BuildConfig {
    fn default() -> Self {
        Self {
            content_dir: PathBuf::from("content/posts"),
            output_dir: PathBuf::from("dist"),
            static_dir: PathBuf::from("static"),
            site: SiteConfig::default(),
            publish_policy: PublishPolicy::default(),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PublishPolicy {
    DgOptIn,
    Permissive,
}

impl Default for PublishPolicy {
    fn default() -> Self {
        Self::DgOptIn
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
    #[serde(rename = "dg-path")]
    dg_path: Option<String>,
    #[serde(rename = "dg-permalink")]
    dg_permalink: Option<String>,
    date: Option<String>,
    updated: Option<String>,
    tags: Option<Vec<String>>,
    aliases: Option<Vec<String>>,
    draft: Option<bool>,
    #[serde(rename = "dg-publish")]
    dg_publish: Option<bool>,
    #[serde(rename = "dg-home")]
    dg_home: Option<bool>,
    #[serde(rename = "dg-enable-search")]
    dg_enable_search: Option<bool>,
    #[serde(rename = "dg-show-local-graph")]
    dg_show_local_graph: Option<bool>,
    #[serde(rename = "dg-pinned")]
    dg_pinned: Option<bool>,
    #[serde(rename = "dg-hide")]
    dg_hide: Option<bool>,
    #[serde(rename = "dg-hide-in-graph")]
    dg_hide_in_graph: Option<bool>,
    #[serde(rename = "dg-note-icon")]
    dg_note_icon: Option<String>,
    #[serde(rename = "dg-metatags")]
    dg_metatags: Option<YamlValue>,
    #[serde(rename = "dg-content-classes")]
    dg_content_classes: Option<YamlValue>,
}

#[derive(Debug, Clone)]
struct PostSeed {
    source_path: PathBuf,
    source_rel_path: String,
    slug: String,
    title: String,
    description: Option<String>,
    tags: Vec<String>,
    aliases: Vec<String>,
    date: Option<DateTime<Utc>>,
    updated: Option<DateTime<Utc>>,
    is_home: bool,
    enable_search: bool,
    show_local_graph: bool,
    pinned: bool,
    hidden: bool,
    hide_in_graph: bool,
    note_icon: Option<String>,
    meta_tags: Vec<MetaTag>,
    content_classes: Vec<String>,
}

#[derive(Debug, Clone)]
struct Post {
    slug: String,
    title: String,
    source_rel_path: String,
    description: String,
    excerpt: String,
    tags: Vec<String>,
    date: Option<DateTime<Utc>>,
    updated: Option<DateTime<Utc>>,
    markdown_html: String,
    toc: Vec<TocEntry>,
    outgoing_links: Vec<String>,
    unresolved_note_slugs: Vec<String>,
    reading_time_min: usize,
    is_home: bool,
    enable_search: bool,
    show_local_graph: bool,
    pinned: bool,
    hidden: bool,
    hide_in_graph: bool,
    note_icon: Option<String>,
    meta_tags: Vec<MetaTag>,
    content_classes: Vec<String>,
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
struct FrontmatterReportEntry {
    file: String,
    unsupported_keys: Vec<String>,
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

#[derive(Debug, Clone, Serialize)]
struct FileTreeNode {
    id: String,
    label: String,
    kind: String,
    url: String,
    preview: String,
    children: Vec<FileTreeNode>,
}

#[derive(Debug, Default)]
struct FileTreeDirBuilder {
    dirs: BTreeMap<String, FileTreeDirBuilder>,
    notes: Vec<FileTreeNoteBuilder>,
}

#[derive(Debug, Clone)]
struct FileTreeNoteBuilder {
    sort_key: String,
    id: String,
    title: String,
    preview: String,
    url: String,
}

#[derive(Debug, Clone)]
struct EmbedSource {
    title: String,
    markdown: String,
}

#[derive(Debug, Clone)]
struct SeedSummary {
    slug: String,
    title: String,
    tags: Vec<String>,
}

#[derive(Debug, Clone, Copy)]
enum DataviewKind {
    List,
    Table,
    Task,
}

#[derive(Debug, Clone, Default)]
struct DataviewQueryOptions {
    where_title_contains: Option<String>,
    where_tag_contains: Option<String>,
    sort_desc: bool,
    limit: Option<usize>,
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
    extra_meta_tags: Vec<MetaTag>,
    page_tabs: Vec<PageTab>,
    toc_items: Vec<TocItem>,
    search_placeholder: String,
    pages_heading: String,
    toc_heading: String,
    show_search: bool,
    show_graph_module: bool,
    graph_data_url: String,
    graph_center_id: String,
    show_side_graph: bool,
}

#[derive(Debug, Clone)]
struct MetaTag {
    attr: String,
    key: String,
    content: String,
}

#[derive(Debug, Clone)]
struct PostCard {
    note_icon: Option<String>,
    title: String,
    url: String,
    excerpt: String,
    date_display: String,
    updated_display: Option<String>,
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
struct PageTab {
    note_icon: Option<String>,
    title: String,
    url: String,
    preview: String,
    active: bool,
}

#[derive(Debug, Clone)]
struct TocEntry {
    level: u8,
    id: String,
    title: String,
}

#[derive(Debug, Clone)]
struct TocItem {
    id: String,
    title: String,
    depth: usize,
}

#[derive(Debug, Clone)]
struct Backlink {
    title: String,
    url: String,
    excerpt: String,
    date_display: String,
    sort_timestamp: i64,
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
    content_classes: String,
}

#[derive(Template)]
#[template(path = "tag.html")]
struct TagTemplate {
    layout: LayoutContext,
    tag_name: String,
    posts: Vec<PostCard>,
}

#[derive(Template)]
#[template(path = "graph.html")]
struct GraphTemplate {
    layout: LayoutContext,
    total_nodes: usize,
    total_links: usize,
}

#[derive(Template)]
#[template(path = "404.html")]
struct NotFoundTemplate {
    layout: LayoutContext,
}

#[derive(Template)]
#[template(path = "missing-note.html")]
struct MissingNoteTemplate {
    layout: LayoutContext,
    missing_title: String,
    missing_slug: String,
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
    copy_content_assets(&config.content_dir, &config.output_dir)?;
    ensure_default_css(&config.output_dir)?;

    let home_intro_html = posts
        .iter()
        .find(|p| p.is_home)
        .map(|p| p.markdown_html.clone())
        .unwrap_or_default();

    render_index(config, &posts, &tags, &home_intro_html)?;
    render_posts_pages(config, &posts, &backlinks)?;
    render_missing_note_pages(config, &posts)?;
    render_tag_pages(config, &tags, &posts)?;
    render_graph_page(config, &posts)?;
    render_not_found_page(config, &posts)?;
    write_search_index(config, &posts)?;
    write_file_tree(config, &posts)?;
    write_graph(config, &posts)?;
    write_local_graphs(config, &posts)?;
    write_sitemap(config, &posts, &tags)?;
    write_rss(config, &posts)?;
    write_robots_txt(config)?;
    write_frontmatter_report(config)?;

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

        let should_publish = match config.publish_policy {
            PublishPolicy::DgOptIn => frontmatter.dg_publish.unwrap_or(false),
            PublishPolicy::Permissive => frontmatter
                .dg_publish
                .unwrap_or(!frontmatter.draft.unwrap_or(false)),
        };

        if !should_publish {
            continue;
        }

        let file_stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("untitled")
            .to_string();
        let source_rel_path = path
            .strip_prefix(&config.content_dir)
            .unwrap_or(&path)
            .with_extension("")
            .to_string_lossy()
            .replace('\\', "/");

        let title = frontmatter.title.unwrap_or_else(|| file_stem.clone());
        let slug_source = frontmatter
            .slug
            .as_deref()
            .or(frontmatter.dg_path.as_deref())
            .or(frontmatter.dg_permalink.as_deref())
            .unwrap_or(&source_rel_path);
        let base_slug = {
            let normalized = normalize_slug_candidate(slug_source);
            if normalized.is_empty() {
                normalize_slug_candidate(&file_stem)
            } else {
                normalized
            }
        };

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
            source_rel_path,
            slug,
            title,
            description: frontmatter.description,
            tags,
            aliases,
            date: frontmatter.date.as_deref().and_then(parse_datetime),
            updated: frontmatter.updated.as_deref().and_then(parse_datetime),
            is_home: frontmatter.dg_home.unwrap_or(false),
            enable_search: frontmatter.dg_enable_search.unwrap_or(true),
            show_local_graph: frontmatter.dg_show_local_graph.unwrap_or(true),
            pinned: frontmatter.dg_pinned.unwrap_or(false),
            hidden: frontmatter.dg_hide.unwrap_or(false),
            hide_in_graph: frontmatter.dg_hide_in_graph.unwrap_or(false),
            note_icon: frontmatter
                .dg_note_icon
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(|value| value.to_string()),
            meta_tags: parse_frontmatter_metatags(frontmatter.dg_metatags.as_ref()),
            content_classes: parse_content_classes(frontmatter.dg_content_classes.as_ref()),
        });
    }

    Ok(seeds)
}

fn render_posts(seeds: &[PostSeed], slug_map: &HashMap<String, String>) -> Result<Vec<Post>> {
    let mut posts = Vec::with_capacity(seeds.len());
    let mut embed_sources = HashMap::with_capacity(seeds.len());
    let known_slugs = seeds
        .iter()
        .map(|seed| seed.slug.clone())
        .collect::<HashSet<_>>();
    let seed_summaries = seeds
        .iter()
        .map(|seed| SeedSummary {
            slug: seed.slug.clone(),
            title: seed.title.clone(),
            tags: seed.tags.clone(),
        })
        .collect::<Vec<_>>();

    for seed in seeds {
        let raw = fs::read_to_string(&seed.source_path)
            .with_context(|| format!("failed to read {}", seed.source_path.display()))?;
        let (_, body) = parse_frontmatter_and_body(&raw)?;
        embed_sources.insert(
            seed.slug.clone(),
            EmbedSource {
                title: seed.title.clone(),
                markdown: body.to_string(),
            },
        );
    }

    for seed in seeds {
        let body = embed_sources
            .get(&seed.slug)
            .map(|source| source.markdown.as_str())
            .unwrap_or_default();
        let with_dataview_blocks = apply_dataview_blocks(body, &seed_summaries, &seed.slug);
        let with_dataview = apply_dataview_inline(
            &with_dataview_blocks,
            &seed_summaries,
            &seed.slug,
            &seed.title,
        );

        let (rewritten, outgoing_links) =
            rewrite_wikilinks(&with_dataview, slug_map, &embed_sources, &seed.slug, true);
        let unresolved_note_slugs = extract_referenced_note_slugs(&rewritten)
            .into_iter()
            .filter(|slug| !known_slugs.contains(slug))
            .collect::<Vec<_>>();
        let markdown_html = markdown_to_html(&rewritten);
        let toc = extract_toc_entries(&markdown_html);

        let excerpt = extract_excerpt(body, 200);
        let description = seed.description.clone().unwrap_or_else(|| excerpt.clone());

        posts.push(Post {
            slug: seed.slug.clone(),
            title: seed.title.clone(),
            source_rel_path: seed.source_rel_path.clone(),
            description,
            excerpt,
            tags: seed.tags.clone(),
            date: seed.date,
            updated: seed.updated,
            markdown_html,
            toc,
            outgoing_links,
            unresolved_note_slugs,
            reading_time_min: estimate_reading_time_minutes(body),
            is_home: seed.is_home,
            enable_search: seed.enable_search,
            show_local_graph: seed.show_local_graph,
            pinned: seed.pinned,
            hidden: seed.hidden,
            hide_in_graph: seed.hide_in_graph,
            note_icon: seed.note_icon.clone(),
            meta_tags: seed.meta_tags.clone(),
            content_classes: seed.content_classes.clone(),
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
        posts,
        config.site.title.clone(),
        config.site.description.clone(),
        "/",
        "website",
        "",
        "",
        website_json_ld(config),
        Vec::new(),
        true,
        true,
        "/graph.json".to_string(),
        String::new(),
        true,
        Vec::new(),
    );

    let template = IndexTemplate {
        layout,
        posts: posts
            .iter()
            .filter(|post| !post.hidden)
            .map(post_to_card)
            .collect(),
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
        let toc_items = toc_items_for_post(post);
        let show_side_graph = post.show_local_graph || !toc_items.is_empty();
        let layout = website_layout(
            config,
            posts,
            format!("{} | {}", post.title, config.site.title),
            post.description.clone(),
            &page_path,
            "article",
            &format_datetime(post.date),
            &format_datetime(post.updated),
            json_ld,
            toc_items,
            post.enable_search,
            post.show_local_graph,
            format!("/local-graph/{}.json", post.slug),
            post.slug.clone(),
            show_side_graph,
            post.meta_tags.clone(),
        );

        let backlink_list = backlinks.get(&post.slug).cloned().unwrap_or_default();
        let body_html =
            render_post_body_with_maud(&post.markdown_html, &backlink_list, &config.site.text);

        let template = PostTemplate {
            layout,
            post: post_to_card(post),
            body_html,
            content_classes: post.content_classes.join(" "),
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
        if post.hidden {
            continue;
        }
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
            posts,
            format!("#{} | {}", tag.name, config.site.title),
            format!("Posts tagged '{}'", tag.name),
            &page_path,
            "website",
            "",
            "",
            website_json_ld(config),
            Vec::new(),
            true,
            true,
            "/graph.json".to_string(),
            String::new(),
            true,
            Vec::new(),
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

fn render_graph_page(config: &BuildConfig, posts: &[Post]) -> Result<()> {
    let (nodes, links) = build_graph_data(posts);
    let layout = website_layout(
        config,
        posts,
        format!("Graph | {}", config.site.title),
        "Interactive graph view of connected notes.".to_string(),
        "/graph/",
        "website",
        "",
        "",
        website_json_ld(config),
        Vec::new(),
        true,
        false,
        "/graph.json".to_string(),
        String::new(),
        false,
        Vec::new(),
    );

    let template = GraphTemplate {
        layout,
        total_nodes: nodes.len(),
        total_links: links.len(),
    };

    write_file(
        config.output_dir.join("graph").join("index.html"),
        template.render()?,
    )
}

fn render_not_found_page(config: &BuildConfig, posts: &[Post]) -> Result<()> {
    let layout = website_layout(
        config,
        posts,
        format!("Not Found | {}", config.site.title),
        "The page you requested could not be found.".to_string(),
        "/404.html",
        "website",
        "",
        "",
        website_json_ld(config),
        Vec::new(),
        true,
        false,
        "/graph.json".to_string(),
        String::new(),
        false,
        Vec::new(),
    );

    let template = NotFoundTemplate { layout };
    write_file(config.output_dir.join("404.html"), template.render()?)
}

fn render_missing_note_pages(config: &BuildConfig, posts: &[Post]) -> Result<()> {
    let known_slugs = posts
        .iter()
        .map(|post| post.slug.as_str())
        .collect::<HashSet<_>>();
    let mut missing_slugs = posts
        .iter()
        .flat_map(|post| post.unresolved_note_slugs.iter())
        .filter(|slug| !known_slugs.contains(slug.as_str()))
        .cloned()
        .collect::<Vec<_>>();
    missing_slugs.sort();
    missing_slugs.dedup();

    for slug in missing_slugs {
        let missing_title = humanize_missing_note_slug(&slug);
        let page_path = format!("/notes/{slug}/");
        let layout = website_layout(
            config,
            posts,
            format!("{missing_title} | {}", config.site.title),
            "This note is not published yet.".to_string(),
            &page_path,
            "website",
            "",
            "",
            website_json_ld(config),
            Vec::new(),
            true,
            false,
            "/graph.json".to_string(),
            String::new(),
            false,
            Vec::new(),
        );

        let template = MissingNoteTemplate {
            layout,
            missing_title,
            missing_slug: slug.clone(),
        };

        let target = config
            .output_dir
            .join("notes")
            .join(&slug)
            .join("index.html");
        write_file(target, template.render()?)?;
    }

    Ok(())
}

fn write_search_index(config: &BuildConfig, posts: &[Post]) -> Result<()> {
    let entries = posts
        .iter()
        .filter(|post| !post.hidden && post.enable_search)
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

fn write_file_tree(config: &BuildConfig, posts: &[Post]) -> Result<()> {
    let tree = build_file_tree(posts);
    let json = serde_json::to_string_pretty(&tree)?;
    write_file(config.output_dir.join("filetree.json"), json)
}

fn build_file_tree(posts: &[Post]) -> Vec<FileTreeNode> {
    let mut root = FileTreeDirBuilder::default();

    for post in posts {
        if post.hidden {
            continue;
        }
        let normalized = post.source_rel_path.trim_matches('/').replace('\\', "/");
        let mut segments = normalized
            .split('/')
            .filter(|segment| !segment.trim().is_empty())
            .collect::<Vec<_>>();

        let leaf_segment = segments.pop().unwrap_or(post.slug.as_str());
        let mut dir_path = Vec::new();
        let mut cursor = &mut root;

        for segment in segments {
            let clean = segment.trim().to_string();
            dir_path.push(clean.clone());
            cursor = cursor.dirs.entry(clean).or_default();
        }

        let mut note_path = dir_path.clone();
        note_path.push(leaf_segment.to_string());

        cursor.notes.push(FileTreeNoteBuilder {
            sort_key: leaf_segment.to_string(),
            id: format!("note:{}", note_path.join("/")),
            title: post.title.clone(),
            preview: post.excerpt.clone(),
            url: format!("/notes/{}/", post.slug),
        });
    }

    file_tree_nodes_from_builder(&root, "")
}

fn file_tree_nodes_from_builder(builder: &FileTreeDirBuilder, path: &str) -> Vec<FileTreeNode> {
    let mut nodes = Vec::new();

    for (name, child) in &builder.dirs {
        let child_path = if path.is_empty() {
            name.to_string()
        } else {
            format!("{path}/{name}")
        };

        nodes.push(FileTreeNode {
            id: format!("dir:{child_path}"),
            label: name.to_string(),
            kind: "folder".to_string(),
            url: String::new(),
            preview: String::new(),
            children: file_tree_nodes_from_builder(child, &child_path),
        });
    }

    let mut notes = builder.notes.clone();
    notes.sort_by(|a, b| {
        a.sort_key
            .cmp(&b.sort_key)
            .then_with(|| a.title.to_lowercase().cmp(&b.title.to_lowercase()))
    });

    for note in notes {
        nodes.push(FileTreeNode {
            id: note.id,
            label: note.title,
            kind: "note".to_string(),
            url: note.url,
            preview: note.preview,
            children: Vec::new(),
        });
    }

    nodes
}

fn write_graph(config: &BuildConfig, posts: &[Post]) -> Result<()> {
    let (nodes, links) = build_graph_data(posts);

    let graph = json!({ "nodes": nodes, "links": links });
    write_file(
        config.output_dir.join("graph.json"),
        serde_json::to_string_pretty(&graph)?,
    )
}

fn build_graph_data(posts: &[Post]) -> (Vec<GraphNode>, Vec<GraphLink>) {
    let graph_posts = posts
        .iter()
        .filter(|post| !post.hidden && !post.hide_in_graph)
        .collect::<Vec<_>>();

    let nodes = graph_posts
        .iter()
        .map(|post| GraphNode {
            id: post.slug.clone(),
            title: post.title.clone(),
            url: format!("/notes/{}/", post.slug),
        })
        .collect::<Vec<_>>();

    let mut links = Vec::new();
    let known: HashSet<&str> = graph_posts.iter().map(|post| post.slug.as_str()).collect();

    for post in &graph_posts {
        for target in &post.outgoing_links {
            if known.contains(target.as_str()) {
                links.push(GraphLink {
                    source: post.slug.clone(),
                    target: target.clone(),
                });
            }
        }
    }

    (nodes, links)
}

fn write_local_graphs(config: &BuildConfig, posts: &[Post]) -> Result<()> {
    for post in posts {
        let (nodes, links) = build_local_graph_data(posts, &post.slug, 2, 72);
        let payload = json!({
            "center": post.slug,
            "nodes": nodes,
            "links": links,
        });

        write_file(
            config
                .output_dir
                .join("local-graph")
                .join(format!("{}.json", post.slug)),
            serde_json::to_string_pretty(&payload)?,
        )?;
    }

    Ok(())
}

fn build_local_graph_data(
    posts: &[Post],
    center_slug: &str,
    hops: usize,
    max_nodes: usize,
) -> (Vec<GraphNode>, Vec<GraphLink>) {
    let graph_posts = posts
        .iter()
        .filter(|post| !post.hidden && !post.hide_in_graph)
        .collect::<Vec<_>>();

    let post_by_slug = graph_posts
        .iter()
        .map(|post| (post.slug.as_str(), post))
        .collect::<HashMap<_, _>>();
    if !post_by_slug.contains_key(center_slug) {
        return (Vec::new(), Vec::new());
    }

    let known = post_by_slug.keys().copied().collect::<HashSet<_>>();

    let mut outgoing: HashMap<&str, Vec<&str>> = HashMap::new();
    let mut incoming: HashMap<&str, Vec<&str>> = HashMap::new();

    for post in &graph_posts {
        let source = post.slug.as_str();
        for target in &post.outgoing_links {
            let target = target.as_str();
            if !known.contains(target) {
                continue;
            }
            outgoing.entry(source).or_default().push(target);
            incoming.entry(target).or_default().push(source);
        }
    }

    let mut depth_by_slug: HashMap<&str, usize> = HashMap::new();
    let mut queue: VecDeque<&str> = VecDeque::new();
    depth_by_slug.insert(center_slug, 0);
    queue.push_back(center_slug);

    while let Some(current) = queue.pop_front() {
        let depth = *depth_by_slug.get(current).unwrap_or(&0);
        if depth >= hops {
            continue;
        }

        if let Some(nexts) = outgoing.get(current) {
            for next in nexts {
                if !depth_by_slug.contains_key(next) {
                    depth_by_slug.insert(next, depth + 1);
                    queue.push_back(next);
                }
            }
        }

        if let Some(prevs) = incoming.get(current) {
            for prev in prevs {
                if !depth_by_slug.contains_key(prev) {
                    depth_by_slug.insert(prev, depth + 1);
                    queue.push_back(prev);
                }
            }
        }
    }

    let mut selected = depth_by_slug.into_iter().collect::<Vec<_>>();
    selected.sort_by(|(a_slug, a_depth), (b_slug, b_depth)| {
        a_depth
            .cmp(b_depth)
            .then_with(|| {
                let a_title = post_by_slug
                    .get(a_slug)
                    .map(|post| post.title.to_lowercase())
                    .unwrap_or_else(|| (*a_slug).to_string());
                let b_title = post_by_slug
                    .get(b_slug)
                    .map(|post| post.title.to_lowercase())
                    .unwrap_or_else(|| (*b_slug).to_string());
                a_title.cmp(&b_title)
            })
            .then_with(|| a_slug.cmp(b_slug))
    });

    if selected.len() > max_nodes {
        selected.truncate(max_nodes);
    }

    let selected_set = selected
        .iter()
        .map(|(slug, _)| (*slug).to_string())
        .collect::<HashSet<_>>();

    let nodes = selected
        .iter()
        .filter_map(|(slug, _)| post_by_slug.get(slug))
        .map(|post| GraphNode {
            id: post.slug.clone(),
            title: post.title.clone(),
            url: format!("/notes/{}/", post.slug),
        })
        .collect::<Vec<_>>();

    let mut links = Vec::new();
    for post in &graph_posts {
        if !selected_set.contains(&post.slug) {
            continue;
        }
        for target in &post.outgoing_links {
            if selected_set.contains(target) {
                links.push(GraphLink {
                    source: post.slug.clone(),
                    target: target.clone(),
                });
            }
        }
    }

    (nodes, links)
}

fn write_sitemap(config: &BuildConfig, posts: &[Post], tags: &[TagEntry]) -> Result<()> {
    let mut xml = String::new();
    xml.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    xml.push_str("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");

    append_sitemap_url(&mut xml, &absolute_url(&config.site.base_url, "/"), None);
    append_sitemap_url(
        &mut xml,
        &absolute_url(&config.site.base_url, "/graph/"),
        None,
    );

    for post in posts {
        if post.hidden {
            continue;
        }
        append_sitemap_url(
            &mut xml,
            &absolute_url(&config.site.base_url, &format!("/notes/{}/", post.slug)),
            post.updated.or(post.date),
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
    writeln!(
        xml,
        "<language>{}</language>",
        escape_xml(&config.site.language)
    )?;

    for post in posts.iter().filter(|post| !post.hidden).take(30) {
        xml.push_str("<item>\n");
        writeln!(xml, "<title>{}</title>", escape_xml(&post.title))?;
        let link = absolute_url(&config.site.base_url, &format!("/notes/{}/", post.slug));
        writeln!(xml, "<link>{}</link>", escape_xml(&link))?;
        writeln!(xml, "<guid>{}</guid>", escape_xml(&link))?;
        writeln!(
            xml,
            "<description>{}</description>",
            escape_xml(&post.excerpt)
        )?;
        writeln!(
            xml,
            "<pubDate>{}</pubDate>",
            post.date.unwrap_or_else(Utc::now).to_rfc2822()
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

fn write_frontmatter_report(config: &BuildConfig) -> Result<()> {
    let mut entries = Vec::new();

    for path in collect_markdown_files(&config.content_dir)? {
        let raw = fs::read_to_string(&path)
            .with_context(|| format!("failed to read {}", path.display()))?;
        let Some((frontmatter_text, _)) = split_frontmatter(&raw) else {
            continue;
        };

        let parsed_yaml: YamlValue = match serde_yaml::from_str(frontmatter_text) {
            Ok(value) => value,
            Err(_) => continue,
        };
        let YamlValue::Mapping(map) = parsed_yaml else {
            continue;
        };

        let mut unsupported_keys = map
            .iter()
            .filter_map(|(key, _)| key.as_str())
            .map(str::trim)
            .filter(|key| !key.is_empty())
            .filter(|key| !SUPPORTED_FRONTMATTER_KEYS.contains(key))
            .map(|key| key.to_string())
            .collect::<Vec<_>>();
        unsupported_keys.sort();
        unsupported_keys.dedup();

        if unsupported_keys.is_empty() {
            continue;
        }

        let file = path
            .strip_prefix(&config.content_dir)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");

        entries.push(FrontmatterReportEntry {
            file,
            unsupported_keys,
        });
    }

    entries.sort_by(|left, right| left.file.cmp(&right.file));

    let payload = json!({
        "generated_at": Utc::now().to_rfc3339(),
        "content_root": config.content_dir.to_string_lossy(),
        "supported_keys": SUPPORTED_FRONTMATTER_KEYS,
        "entries": entries,
    });
    let mut body = serde_json::to_string_pretty(&payload)
        .with_context(|| "failed to serialize frontmatter report")?;
    body.push('\n');
    write_file(config.output_dir.join("frontmatter-report.json"), body)
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

fn split_frontmatter(raw: &str) -> Option<(&str, &str)> {
    if raw.starts_with("---\n") {
        if let Some(end) = raw[4..].find("\n---\n") {
            let frontmatter = &raw[4..4 + end];
            let body = &raw[4 + end + 5..];
            return Some((frontmatter, body));
        }
    }

    if raw.starts_with("---\r\n") {
        if let Some(end) = raw[5..].find("\r\n---\r\n") {
            let frontmatter = &raw[5..5 + end];
            let body = &raw[5 + end + 8..];
            return Some((frontmatter, body));
        }
    }

    None
}

fn parse_frontmatter_and_body(raw: &str) -> Result<(FrontMatter, &str)> {
    if let Some((frontmatter, body)) = split_frontmatter(raw) {
        let parsed: FrontMatter = serde_yaml::from_str(frontmatter)
            .with_context(|| "failed to parse YAML frontmatter")?;
        return Ok((parsed, body));
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

fn rewrite_wikilinks(
    markdown: &str,
    slug_map: &HashMap<String, String>,
    embed_sources: &HashMap<String, EmbedSource>,
    current_slug: &str,
    allow_embeds: bool,
) -> (String, Vec<String>) {
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

                if is_embed && allow_embeds {
                    let (embedded, embed_links) = render_note_transclusion(
                        slug,
                        heading,
                        &target_url,
                        slug_map,
                        embed_sources,
                        current_slug,
                    );
                    outgoing.extend(embed_links);
                    embedded
                } else {
                    let display = if is_embed {
                        format!("{} (embedded)", label)
                    } else {
                        label.to_string()
                    };
                    format!("[{}]({})", display, target_url)
                }
            } else if is_embed && is_pdf_target(target_raw) {
                let pdf_url = build_embed_asset_url(target_raw, heading);
                render_pdf_embed_html(&pdf_url, &pdf_display_title(target_raw, label))
            } else if is_embed && is_excalidraw_target(target_raw) {
                let source_url = resolve_asset_url(target_raw);
                render_excalidraw_embed_html(&source_url, &pdf_display_title(target_raw, label))
            } else if is_embed && is_canvas_target(target_raw) {
                let source_url = resolve_asset_url(target_raw);
                render_canvas_embed_html(&source_url, &pdf_display_title(target_raw, label))
            } else if is_embed && is_image_target(target_raw) {
                let image_url = resolve_asset_url(target_raw);
                render_image_embed_markdown(&image_url, &pdf_display_title(target_raw, label))
            } else if is_asset_link_target(target_raw) {
                let asset_url = resolve_asset_url(target_raw);
                let display = if label.is_empty() { target_raw } else { label };
                format!("[{}]({})", display, asset_url)
            } else {
                let unresolved_url = build_unresolved_note_url(target_raw, heading);
                let display = if label.is_empty() { target_raw } else { label };
                if is_embed && allow_embeds {
                    format!("[{} (missing note)]({})", display, unresolved_url)
                } else {
                    format!("[{}]({})", display, unresolved_url)
                }
            }
        })
        .to_string();

    outgoing.sort();
    outgoing.dedup();

    (rewritten, outgoing)
}

fn render_note_transclusion(
    target_slug: &str,
    heading: Option<&str>,
    target_url: &str,
    slug_map: &HashMap<String, String>,
    embed_sources: &HashMap<String, EmbedSource>,
    current_slug: &str,
) -> (String, Vec<String>) {
    let Some(source) = embed_sources.get(target_slug) else {
        return (format!("[{}]({})", target_slug, target_url), Vec::new());
    };

    if target_slug == current_slug {
        return (
            format!(
                "\n\n> **Embedded from [{}]({})**\n>\n> _Self embed skipped._\n\n",
                source.title, target_url
            ),
            Vec::new(),
        );
    }

    let transclusion_markdown = heading
        .filter(|anchor| !anchor.trim().is_empty())
        .and_then(|anchor| extract_markdown_section(&source.markdown, anchor))
        .unwrap_or_else(|| source.markdown.clone());

    let snippet = transclusion_markdown.trim();
    if snippet.is_empty() {
        return (
            format!(
                "\n\n> **Embedded from [{}]({})**\n>\n> _Embedded note is empty._\n\n",
                source.title, target_url
            ),
            Vec::new(),
        );
    }

    let (rewritten_snippet, mut snippet_links) =
        rewrite_wikilinks(snippet, slug_map, embed_sources, target_slug, false);
    snippet_links.retain(|slug| slug != current_slug);

    let quoted = rewritten_snippet
        .lines()
        .map(|line| {
            if line.trim().is_empty() {
                ">".to_string()
            } else {
                format!("> {line}")
            }
        })
        .collect::<Vec<_>>()
        .join("\n");

    (
        format!(
            "\n\n> **Embedded from [{}]({})**\n>\n{}\n\n",
            source.title, target_url, quoted
        ),
        snippet_links,
    )
}

fn is_pdf_target(target: &str) -> bool {
    let target = target.trim().to_ascii_lowercase();
    let path = target.split('?').next().unwrap_or(target.as_str());
    path.ends_with(".pdf")
}

fn is_excalidraw_target(target: &str) -> bool {
    extension_matches(target, &["excalidraw"])
}

fn is_canvas_target(target: &str) -> bool {
    extension_matches(target, &["canvas"])
}

fn is_image_target(target: &str) -> bool {
    extension_matches(
        target,
        &["png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "bmp"],
    )
}

fn is_asset_link_target(target: &str) -> bool {
    is_pdf_target(target)
        || is_excalidraw_target(target)
        || is_canvas_target(target)
        || is_image_target(target)
}

fn extension_matches(target: &str, extensions: &[&str]) -> bool {
    let target = target.trim().to_ascii_lowercase();
    let path = target
        .split(['?', '#'])
        .next()
        .unwrap_or(target.as_str())
        .trim_end_matches('.');
    let ext = path.rsplit('.').next().unwrap_or(path);
    extensions.iter().any(|item| ext == *item)
}

fn build_embed_asset_url(target_raw: &str, heading: Option<&str>) -> String {
    let mut url = resolve_asset_url(target_raw);
    if let Some(fragment) = heading.map(str::trim).filter(|value| !value.is_empty()) {
        url.push('#');
        url.push_str(fragment);
    }
    url
}

fn resolve_asset_url(target_raw: &str) -> String {
    let target = target_raw.trim();
    if target.starts_with("http://")
        || target.starts_with("https://")
        || target.starts_with("data:")
        || target.starts_with('/')
    {
        return target.to_string();
    }

    let normalized = target
        .trim_start_matches("./")
        .trim_start_matches('/')
        .replace('\\', "/");
    format!("/content/{normalized}")
}

fn build_unresolved_note_url(target_raw: &str, heading: Option<&str>) -> String {
    let normalized = normalize_slug_candidate(target_raw);
    let slug = if normalized.is_empty() {
        let fallback = slugify(target_raw.trim());
        if fallback.is_empty() {
            "missing-note".to_string()
        } else {
            fallback
        }
    } else {
        normalized
    };

    let mut url = format!("/notes/{slug}/");
    if let Some(anchor) = heading
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(slugify)
        .filter(|value| !value.is_empty())
    {
        url.push('#');
        url.push_str(&anchor);
    }
    url
}

fn extract_referenced_note_slugs(markdown: &str) -> Vec<String> {
    let mut slugs = NOTE_LINK_MARKDOWN_RE
        .captures_iter(markdown)
        .filter_map(|caps| caps.get(1).map(|m| m.as_str().trim()))
        .map(|path| path.split('#').next().unwrap_or(path))
        .map(|path| path.split('?').next().unwrap_or(path))
        .map(|path| path.trim_matches('/'))
        .map(normalize_slug_candidate)
        .filter(|slug| !slug.is_empty())
        .collect::<Vec<_>>();
    slugs.sort();
    slugs.dedup();
    slugs
}

fn humanize_missing_note_slug(slug: &str) -> String {
    let tail = slug
        .trim_matches('/')
        .split('/')
        .next_back()
        .unwrap_or(slug)
        .replace('-', " ")
        .replace('_', " ");
    let mut words = tail
        .split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            let Some(first) = chars.next() else {
                return String::new();
            };
            let mut title = String::new();
            title.push(first.to_ascii_uppercase());
            title.push_str(chars.as_str());
            title
        })
        .filter(|word| !word.is_empty())
        .collect::<Vec<_>>();
    if words.is_empty() {
        "Missing Note".to_string()
    } else {
        words.push("(Not Published)".to_string());
        words.join(" ")
    }
}

fn pdf_display_title(target_raw: &str, label: &str) -> String {
    let label = label.trim();
    if !label.is_empty() && label != target_raw.trim() {
        return label.to_string();
    }

    let file_name = target_raw
        .trim()
        .split('?')
        .next()
        .unwrap_or(target_raw.trim())
        .rsplit('/')
        .next()
        .unwrap_or(target_raw.trim())
        .rsplit('\\')
        .next()
        .unwrap_or(target_raw.trim());

    let title = file_name
        .trim_end_matches(".pdf")
        .trim_end_matches(".PDF")
        .trim();
    if title.is_empty() {
        "PDF".to_string()
    } else {
        title.to_string()
    }
}

fn render_pdf_embed_html(url: &str, title: &str) -> String {
    let safe_url = escape_html_text(url);
    let safe_title = escape_html_text(title);
    format!(
        "\n\n<div class=\"dg-pdf-embed\"><div class=\"dg-pdf-embed-head\">{title}</div><object data=\"{url}\" type=\"application/pdf\"><p>PDF preview is not available. <a href=\"{url}\" target=\"_blank\" rel=\"noopener\">Open PDF</a></p></object></div>\n\n",
        title = safe_title,
        url = safe_url
    )
}

fn apply_dataview_blocks(markdown: &str, seeds: &[SeedSummary], current_slug: &str) -> String {
    let lines = markdown.lines().collect::<Vec<_>>();
    let mut transformed = String::new();
    let mut idx = 0usize;

    while idx < lines.len() {
        let line = lines[idx];
        let trimmed = line.trim();
        let language = trimmed
            .strip_prefix("```")
            .map(str::trim)
            .unwrap_or_default()
            .to_ascii_lowercase();

        if language == "dataview" || language == "dataviewjs" {
            idx += 1;
            let mut block_lines = Vec::new();
            while idx < lines.len() {
                if lines[idx].trim_start().starts_with("```") {
                    idx += 1;
                    break;
                }
                block_lines.push(lines[idx].to_string());
                idx += 1;
            }

            let replacement = if language == "dataview" {
                render_dataview_query_block(&block_lines.join("\n"), seeds, current_slug)
            } else {
                render_dataviewjs_fallback(&block_lines.join("\n"))
            };
            transformed.push_str(&replacement);
            if !replacement.ends_with('\n') {
                transformed.push('\n');
            }
            continue;
        }

        transformed.push_str(line);
        transformed.push('\n');
        idx += 1;
    }

    if !markdown.ends_with('\n') && transformed.ends_with('\n') {
        transformed.pop();
    }

    transformed
}

fn apply_dataview_inline(
    markdown: &str,
    seeds: &[SeedSummary],
    current_slug: &str,
    current_title: &str,
) -> String {
    let mut transformed = String::new();
    let mut in_fence = false;

    for line in markdown.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            in_fence = !in_fence;
            transformed.push_str(line);
            transformed.push('\n');
            continue;
        }

        if in_fence {
            transformed.push_str(line);
            transformed.push('\n');
            continue;
        }

        let with_name = DATAVIEW_INLINE_THIS_FILE_NAME_RE
            .replace_all(line, current_title)
            .to_string();
        let with_link = DATAVIEW_INLINE_THIS_FILE_LINK_RE
            .replace_all(
                &with_name,
                format!("[{}](/notes/{}/)", current_title, current_slug),
            )
            .to_string();
        let with_count = DATAVIEW_INLINE_PAGES_LENGTH_RE
            .replace_all(&with_link, |caps: &Captures| {
                let tag = caps
                    .get(1)
                    .map(|m| m.as_str().to_ascii_lowercase())
                    .unwrap_or_default();
                seeds
                    .iter()
                    .filter(|seed| seed.tags.iter().any(|item| item == &tag))
                    .count()
                    .to_string()
            })
            .to_string();

        transformed.push_str(&with_count);
        transformed.push('\n');
    }

    if !markdown.ends_with('\n') && transformed.ends_with('\n') {
        transformed.pop();
    }

    transformed
}

fn parse_dataview_query(raw_query: &str) -> Option<(DataviewKind, String, DataviewQueryOptions)> {
    let mut lines = raw_query
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty());
    let head = lines.next()?;

    let (kind, tag) = if let Some(caps) = DATAVIEW_TASK_FROM_RE.captures(head) {
        (
            DataviewKind::Task,
            caps.get(1)
                .map(|m| m.as_str().to_ascii_lowercase())
                .unwrap_or_default(),
        )
    } else if let Some(caps) = DATAVIEW_TABLE_FROM_RE.captures(head) {
        (
            DataviewKind::Table,
            caps.get(1)
                .map(|m| m.as_str().to_ascii_lowercase())
                .unwrap_or_default(),
        )
    } else if let Some(caps) = DATAVIEW_LIST_FROM_RE.captures(head) {
        (
            DataviewKind::List,
            caps.get(1)
                .map(|m| m.as_str().to_ascii_lowercase())
                .unwrap_or_default(),
        )
    } else {
        return None;
    };

    let mut options = DataviewQueryOptions::default();
    for line in lines {
        if let Some(caps) = DATAVIEW_SORT_RE.captures(line) {
            let direction = caps
                .get(1)
                .map(|m| m.as_str().to_ascii_lowercase())
                .unwrap_or_else(|| "asc".to_string());
            options.sort_desc = direction == "desc";
            continue;
        }

        if let Some(caps) = DATAVIEW_LIMIT_RE.captures(line) {
            options.limit = caps
                .get(1)
                .and_then(|m| m.as_str().parse::<usize>().ok())
                .map(|value| value.clamp(1, 200));
            continue;
        }

        if let Some(caps) = DATAVIEW_WHERE_TITLE_CONTAINS_RE.captures(line) {
            options.where_title_contains = caps
                .get(1)
                .map(|m| m.as_str().trim().to_ascii_lowercase())
                .filter(|value| !value.is_empty());
            continue;
        }

        if let Some(caps) = DATAVIEW_WHERE_TAG_CONTAINS_RE.captures(line) {
            options.where_tag_contains = caps
                .get(1)
                .map(|m| m.as_str().trim().to_ascii_lowercase())
                .filter(|value| !value.is_empty());
        }
    }

    Some((kind, tag, options))
}

fn collect_dataview_matches(
    seeds: &[SeedSummary],
    current_slug: &str,
    from_tag: &str,
    options: &DataviewQueryOptions,
) -> Vec<(String, String)> {
    let mut matches = seeds
        .iter()
        .filter(|seed| seed.slug != current_slug)
        .filter(|seed| seed.tags.iter().any(|item| item == from_tag))
        .filter(|seed| {
            options
                .where_title_contains
                .as_ref()
                .map(|term| seed.title.to_ascii_lowercase().contains(term))
                .unwrap_or(true)
        })
        .filter(|seed| {
            options
                .where_tag_contains
                .as_ref()
                .map(|tag| seed.tags.iter().any(|item| item.contains(tag)))
                .unwrap_or(true)
        })
        .map(|seed| (seed.title.clone(), seed.slug.clone()))
        .collect::<Vec<_>>();

    matches.sort_by(|a, b| a.0.to_lowercase().cmp(&b.0.to_lowercase()));
    if options.sort_desc {
        matches.reverse();
    }
    if let Some(limit) = options.limit {
        matches.truncate(limit);
    }

    matches
}

fn render_dataview_query_block(query: &str, seeds: &[SeedSummary], current_slug: &str) -> String {
    let raw_query = query.trim();
    if raw_query.is_empty() {
        return "> [!info] Dataview\n> Empty Dataview query.\n".to_string();
    }

    let Some((kind, tag, options)) = parse_dataview_query(raw_query) else {
        return format!(
            "> [!info] Dataview\n> Query is not supported yet.\n>\n> ```text\n> {}\n> ```\n",
            raw_query.replace('\n', "\n> ")
        );
    };

    let matches = collect_dataview_matches(seeds, current_slug, &tag, &options);
    let mut rendered = String::new();
    rendered.push_str("> [!info] Dataview\n");
    let display_query = raw_query.replace('`', "\\`").replace('\n', " ; ");
    rendered.push_str(&format!("> Query: `{}`\n>\n", display_query));

    if matches.is_empty() {
        rendered.push_str(&format!("> _No notes found for #{}._\n", tag));
        return rendered;
    }

    match kind {
        DataviewKind::Task => {
            for (title, slug) in matches {
                rendered.push_str(&format!("> - [ ] [{}](/notes/{}/)\n", title, slug));
            }
        }
        DataviewKind::Table => {
            rendered.push_str("> | Title | Note |\n");
            rendered.push_str("> | --- | --- |\n");
            for (title, slug) in matches {
                let title = title.replace('|', "\\|");
                rendered.push_str(&format!("> | {} | [Open](/notes/{}/) |\n", title, slug));
            }
        }
        DataviewKind::List => {
            for (title, slug) in matches {
                rendered.push_str(&format!("> - [{}](/notes/{}/)\n", title, slug));
            }
        }
    }

    rendered
}

fn render_dataviewjs_fallback(query: &str) -> String {
    let body = query.trim();
    if body.is_empty() {
        return "> [!info] DataviewJS\n> DataviewJS block is not executed.\n".to_string();
    }

    format!(
        "> [!info] DataviewJS\n> DataviewJS block is not executed.\n>\n> ```javascript\n> {}\n> ```\n",
        body.replace('\n', "\n> ")
    )
}

fn render_excalidraw_embed_html(url: &str, title: &str) -> String {
    let safe_url = escape_html_text(url);
    let safe_title = escape_html_text(title);
    let svg_candidate = escape_html_text(&format!("{url}.svg"));
    let png_candidate = escape_html_text(&format!("{url}.png"));
    format!(
        "\n\n<div class=\"dg-excalidraw-embed\" data-excalidraw-src=\"{source}\"><div class=\"dg-excalidraw-embed-head\">{title}</div><div class=\"dg-excalidraw-embed-body\"><p class=\"dg-excalidraw-placeholder\">Loading drawing preview...</p><div class=\"dg-excalidraw-preview-wrap\" hidden></div><img class=\"dg-excalidraw-preview\" src=\"{svg}\" alt=\"{title}\" loading=\"lazy\" decoding=\"async\" /><p class=\"dg-excalidraw-links\"><a href=\"{source}\" target=\"_blank\" rel=\"noopener\">Open Excalidraw Source</a> · <a href=\"{png}\" target=\"_blank\" rel=\"noopener\">Try PNG Preview</a></p></div></div>\n\n",
        title = safe_title,
        svg = svg_candidate,
        source = safe_url,
        png = png_candidate
    )
}

fn render_canvas_embed_html(url: &str, title: &str) -> String {
    let safe_url = escape_html_text(url);
    let safe_title = escape_html_text(title);
    format!(
        "\n\n<div class=\"dg-canvas-embed\" data-canvas-src=\"{url}\"><div class=\"dg-canvas-embed-head\">{title}</div><div class=\"dg-canvas-embed-body\"><p class=\"dg-canvas-placeholder\">Loading canvas preview...</p><div class=\"dg-canvas-preview\" hidden></div><p class=\"dg-canvas-links\"><a href=\"{url}\" target=\"_blank\" rel=\"noopener\">Open Canvas Source</a></p></div></div>\n\n",
        title = safe_title,
        url = safe_url
    )
}

fn render_image_embed_markdown(url: &str, title: &str) -> String {
    format!("\n\n![{}]({})\n\n", title, url)
}

fn extract_markdown_section(markdown: &str, heading: &str) -> Option<String> {
    let target = slugify(heading.trim());
    if target.is_empty() {
        return None;
    }

    let mut in_section = false;
    let mut section_level = 0usize;
    let mut section = String::new();

    for line in markdown.lines() {
        if let Some(caps) = MARKDOWN_HEADING_RE.captures(line) {
            let level = caps.get(1).map(|m| m.as_str().len()).unwrap_or(1);
            let title = caps
                .get(2)
                .map(|m| m.as_str())
                .unwrap_or_default()
                .trim()
                .trim_end_matches('#')
                .trim();
            let id = slugify(title);

            if in_section && level <= section_level {
                break;
            }

            if !in_section && id == target {
                in_section = true;
                section_level = level;
            }
        }

        if in_section {
            section.push_str(line);
            section.push('\n');
        }
    }

    let section = section.trim().to_string();
    if section.is_empty() {
        None
    } else {
        Some(section)
    }
}

fn markdown_to_html(markdown: &str) -> String {
    let html = markdown_fragment_to_html(markdown);
    add_heading_ids(&html)
}

fn markdown_fragment_to_html(markdown: &str) -> String {
    let markdown = apply_highlight_syntax(markdown);
    let markdown = apply_callout_syntax(&markdown);
    let markdown = apply_plantuml_syntax(&markdown);
    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_TASKLISTS);
    options.insert(Options::ENABLE_FOOTNOTES);

    let parser = Parser::new_ext(&markdown, options);
    let mut html = String::new();
    push_html(&mut html, parser);

    let html = IMG_RE
        .replace_all(&html, "<img loading=\"lazy\" decoding=\"async\" ")
        .to_string();

    html
}

fn apply_plantuml_syntax(markdown: &str) -> String {
    let lines = markdown.lines().collect::<Vec<_>>();
    let mut transformed = String::new();
    let mut idx = 0usize;

    while idx < lines.len() {
        let line = lines[idx];
        let trimmed = line.trim_start();
        let (fence, language) = if let Some(rest) = trimmed.strip_prefix("```") {
            ("```", rest.trim().to_ascii_lowercase())
        } else if let Some(rest) = trimmed.strip_prefix("~~~") {
            ("~~~", rest.trim().to_ascii_lowercase())
        } else {
            ("", String::new())
        };

        if !fence.is_empty() && (language == "plantuml" || language == "puml") {
            idx += 1;
            let mut body_lines = Vec::new();
            while idx < lines.len() {
                if lines[idx].trim_start().starts_with(fence) {
                    idx += 1;
                    break;
                }
                body_lines.push(lines[idx].to_string());
                idx += 1;
            }

            let body = body_lines.join("\n").trim().to_string();
            if !body.is_empty() {
                let src = plantuml_server_url(&body);
                let safe_src = escape_html_text(&src);
                transformed.push_str(&format!(
                    "\n\n<figure class=\"plantuml-embed\"><img src=\"{}\" alt=\"PlantUML diagram\" loading=\"lazy\" decoding=\"async\" /></figure>\n\n",
                    safe_src
                ));
            }
            continue;
        }

        transformed.push_str(line);
        transformed.push('\n');
        idx += 1;
    }

    if !markdown.ends_with('\n') && transformed.ends_with('\n') {
        transformed.pop();
    }

    transformed
}

fn plantuml_server_url(source: &str) -> String {
    let encoded = source
        .as_bytes()
        .iter()
        .map(|byte| format!("{:02x}", byte))
        .collect::<String>();
    format!("https://www.plantuml.com/plantuml/svg/~h{}", encoded)
}

fn apply_highlight_syntax(markdown: &str) -> String {
    let mut transformed = String::new();
    let mut in_fence = false;

    for line in markdown.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            in_fence = !in_fence;
            transformed.push_str(line);
            transformed.push('\n');
            continue;
        }

        if in_fence {
            transformed.push_str(line);
            transformed.push('\n');
            continue;
        }

        let replaced = HIGHLIGHT_RE.replace_all(line, "<mark>$1</mark>");
        transformed.push_str(&replaced);
        transformed.push('\n');
    }

    if !markdown.ends_with('\n') && transformed.ends_with('\n') {
        transformed.pop();
    }

    transformed
}

fn apply_callout_syntax(markdown: &str) -> String {
    let lines = markdown.lines().collect::<Vec<_>>();
    let mut transformed = String::new();
    let mut idx = 0usize;

    while idx < lines.len() {
        let line = lines[idx];
        if let Some(caps) = CALLOUT_MARKER_RE.captures(line) {
            let raw_type = caps.get(1).map(|m| m.as_str()).unwrap_or("note");
            let callout_type = {
                let normalized = normalize_class_name(raw_type);
                if normalized.is_empty() {
                    "note".to_string()
                } else {
                    normalized
                }
            };
            let fold = caps.get(2).map(|m| m.as_str()).unwrap_or("");
            let custom_title = caps.get(3).map(|m| m.as_str().trim()).unwrap_or("");
            let title = if custom_title.is_empty() {
                humanize_callout_type(&callout_type)
            } else {
                custom_title.to_string()
            };
            let safe_title = escape_html_text(&title);

            idx += 1;
            let mut body_lines = Vec::new();
            while idx < lines.len() {
                let Some(body_line) = strip_blockquote_marker(lines[idx]) else {
                    break;
                };
                body_lines.push(body_line.to_string());
                idx += 1;
            }

            let body_markdown = body_lines.join("\n");
            let body_html = if body_markdown.trim().is_empty() {
                "<p></p>".to_string()
            } else {
                markdown_fragment_to_html(&body_markdown)
            };

            if !transformed.is_empty() {
                transformed.push('\n');
            }

            if fold.is_empty() {
                transformed.push_str(&format!(
                    "<div class=\"dg-callout dg-callout-{kind}\" data-callout=\"{kind}\"><div class=\"dg-callout-title\">{title}</div><div class=\"dg-callout-body\">{body}</div></div>",
                    kind = callout_type,
                    title = safe_title,
                    body = body_html
                ));
            } else {
                let open_attr = if fold == "+" { " open" } else { "" };
                transformed.push_str(&format!(
                    "<details class=\"dg-callout dg-callout-{kind}\" data-callout=\"{kind}\"{open}><summary class=\"dg-callout-title\">{title}</summary><div class=\"dg-callout-body\">{body}</div></details>",
                    kind = callout_type,
                    open = open_attr,
                    title = safe_title,
                    body = body_html
                ));
            }

            continue;
        }

        transformed.push_str(line);
        transformed.push('\n');
        idx += 1;
    }

    if !markdown.ends_with('\n') && transformed.ends_with('\n') {
        transformed.pop();
    }

    transformed
}

fn strip_blockquote_marker(line: &str) -> Option<&str> {
    let trimmed = line.trim_start();
    let rest = trimmed.strip_prefix('>')?;
    Some(rest.strip_prefix(' ').unwrap_or(rest))
}

fn humanize_callout_type(kind: &str) -> String {
    let words = kind
        .split(['-', '_'])
        .filter(|word| !word.trim().is_empty())
        .map(|word| {
            let mut chars = word.chars();
            let Some(first) = chars.next() else {
                return String::new();
            };
            let mut title = String::new();
            title.push(first.to_ascii_uppercase());
            title.push_str(chars.as_str());
            title
        })
        .collect::<Vec<_>>();

    if words.is_empty() {
        "Note".to_string()
    } else {
        words.join(" ")
    }
}

fn escape_html_text(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn add_heading_ids(html: &str) -> String {
    let mut seen: HashMap<String, usize> = HashMap::new();

    HEADING_RE
        .replace_all(html, |caps: &Captures| {
            let level = caps.get(1).map(|m| m.as_str()).unwrap_or("2");
            let inner_html = caps.get(2).map(|m| m.as_str()).unwrap_or_default();
            let text = HTML_TAG_RE.replace_all(inner_html, "");
            let base = slugify(text.trim());

            if base.is_empty() {
                return caps
                    .get(0)
                    .map(|m| m.as_str().to_string())
                    .unwrap_or_default();
            }

            let count = seen
                .entry(base.clone())
                .and_modify(|count| *count += 1)
                .or_insert(1);

            let id = if *count == 1 {
                base
            } else {
                format!("{}-{}", base, count)
            };

            format!("<h{level} id=\"{id}\">{inner_html}</h{level}>")
        })
        .to_string()
}

fn extract_toc_entries(html: &str) -> Vec<TocEntry> {
    HEADING_WITH_ID_RE
        .captures_iter(html)
        .filter_map(|caps| {
            let level = caps
                .get(1)
                .and_then(|m| m.as_str().parse::<u8>().ok())
                .unwrap_or(2);
            let id = caps.get(2).map(|m| m.as_str().trim()).unwrap_or_default();
            let raw_title = caps.get(3).map(|m| m.as_str()).unwrap_or_default();
            let title = HTML_TAG_RE.replace_all(raw_title, "").trim().to_string();

            if id.is_empty() || title.is_empty() {
                return None;
            }

            Some(TocEntry {
                level,
                id: id.to_string(),
                title,
            })
        })
        .collect()
}

fn toc_items_for_post(post: &Post) -> Vec<TocItem> {
    post.toc
        .iter()
        .map(|entry| TocItem {
            id: entry.id.clone(),
            title: entry.title.clone(),
            depth: usize::from(entry.level.saturating_sub(2)),
        })
        .collect()
}

fn render_post_body_with_maud(
    markdown_html: &str,
    backlinks: &[Backlink],
    site_text: &SiteText,
) -> String {
    html! {
        article class="note-body" {
            (PreEscaped(markdown_html))
        }
        section class="backlinks" {
            h2 { (site_text.backlinks_heading) }
            @if backlinks.is_empty() {
                p class="backlinks-empty" { (site_text.backlinks_empty) }
            } @else {
                p class="backlinks-meta" {
                    (format!(
                        "{} linked note{} · sorted by recency",
                        backlinks.len(),
                        if backlinks.len() == 1 { "" } else { "s" }
                    ))
                }
                ul {
                    @for link in backlinks {
                        li {
                            div class="backlinks-item-head" {
                                a href=(link.url) { (link.title) }
                                span class="backlinks-item-date" { (link.date_display) }
                            }
                            p { (link.excerpt) }
                        }
                    }
                }
            }
        }
    }
    .into_string()
}

fn build_backlinks(
    posts: &[Post],
    known_posts: &HashMap<String, &Post>,
) -> HashMap<String, Vec<Backlink>> {
    let mut backlinks: HashMap<String, Vec<Backlink>> = HashMap::new();

    for source in posts {
        if source.hidden {
            continue;
        }
        for target in &source.outgoing_links {
            let Some(target_post) = known_posts.get(target) else {
                continue;
            };
            if target == &source.slug || target_post.hidden {
                continue;
            }
            let date = source.updated.or(source.date);
            let entry = Backlink {
                title: source.title.clone(),
                url: format!("/notes/{}/", source.slug),
                excerpt: source.excerpt.clone(),
                date_display: date
                    .map(|value| value.format("%Y-%m-%d").to_string())
                    .unwrap_or_else(|| "Undated".to_string()),
                sort_timestamp: date.map(|value| value.timestamp()).unwrap_or(i64::MIN),
            };

            let items = backlinks.entry(target.clone()).or_default();
            if !items.iter().any(|item| item.url == entry.url) {
                items.push(entry);
            }
        }
    }

    for items in backlinks.values_mut() {
        items.sort_by(|a, b| {
            b.sort_timestamp
                .cmp(&a.sort_timestamp)
                .then_with(|| a.title.to_lowercase().cmp(&b.title.to_lowercase()))
        });
    }

    backlinks
}

fn build_tag_index(posts: &[Post]) -> Vec<TagEntry> {
    let mut counts: BTreeMap<String, usize> = BTreeMap::new();

    for post in posts {
        if post.hidden {
            continue;
        }
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
        note_icon: post.note_icon.clone(),
        title: post.title.clone(),
        url: format!("/notes/{}/", post.slug),
        excerpt: post.excerpt.clone(),
        date_display: post
            .date
            .map(|date| date.format("%Y-%m-%d").to_string())
            .unwrap_or_else(|| "Undated".to_string()),
        updated_display: post.updated.map(|date| date.format("%Y-%m-%d").to_string()),
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
    posts: &[Post],
    page_title: String,
    page_description: String,
    page_path: &str,
    og_type: &str,
    published_time: &str,
    updated_time: &str,
    json_ld: String,
    toc_items: Vec<TocItem>,
    show_search: bool,
    show_graph_module: bool,
    graph_data_url: String,
    graph_center_id: String,
    show_side_graph: bool,
    extra_meta_tags: Vec<MetaTag>,
) -> LayoutContext {
    let canonical_url = absolute_url(&config.site.base_url, page_path);

    LayoutContext {
        site_title: config.site.title.clone(),
        site_description: config.site.description.clone(),
        site_url: normalize_base_url(&config.site.base_url),
        lang: config.site.language.clone(),
        page_title,
        page_description,
        canonical_url: canonical_url.clone(),
        page_url: canonical_url,
        og_type: og_type.to_string(),
        published_time: published_time.to_string(),
        updated_time: updated_time.to_string(),
        json_ld,
        extra_meta_tags,
        page_tabs: build_page_tabs(posts, page_path),
        toc_items,
        search_placeholder: config.site.text.search_placeholder.clone(),
        pages_heading: config.site.text.pages_heading.clone(),
        toc_heading: config.site.text.toc_heading.clone(),
        show_search,
        show_graph_module,
        graph_data_url,
        graph_center_id,
        show_side_graph,
    }
}

fn build_page_tabs(posts: &[Post], page_path: &str) -> Vec<PageTab> {
    posts
        .iter()
        .filter(|post| !post.hidden)
        .map(|post| {
            let url = format!("/notes/{}/", post.slug);
            PageTab {
                note_icon: post.note_icon.clone(),
                title: post.title.clone(),
                url: url.clone(),
                preview: post.excerpt.clone(),
                active: url == page_path,
            }
        })
        .collect()
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
        "datePublished": format_datetime(post.date),
        "dateModified": format_datetime(post.updated.or(post.date)),
        "author": {
            "@type": "Person",
            "name": &config.site.author,
        },
        "mainEntityOfPage": absolute_url(&config.site.base_url, &format!("/notes/{}/", post.slug)),
    })
    .to_string()
}

fn copy_content_assets(content_dir: &Path, output_dir: &Path) -> Result<()> {
    if !content_dir.exists() {
        return Ok(());
    }

    for entry in WalkDir::new(content_dir)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
    {
        let path = entry.path();
        let is_markdown = path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| matches!(ext, "md" | "markdown"))
            .unwrap_or(false);
        if is_markdown {
            continue;
        }

        let rel = path.strip_prefix(content_dir).with_context(|| {
            format!(
                "failed to create relative path for {} from {}",
                path.display(),
                content_dir.display()
            )
        })?;
        let dest = output_dir.join("content").join(rel);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)
                .with_context(|| format!("failed to create {}", parent.display()))?;
        }

        fs::copy(path, &dest)
            .with_context(|| format!("failed to copy {} to {}", path.display(), dest.display()))?;
    }

    Ok(())
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

.graph-panel {
  display: grid;
  gap: 0.9rem;
}

.graph-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-items: center;
}

.graph-toolbar label {
  font-size: 0.88rem;
  color: var(--muted);
}

.graph-toolbar input {
  flex: 1 1 220px;
  min-width: 210px;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 0.45rem 0.6rem;
  font: inherit;
}

.graph-toolbar button,
.graph-data-link {
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #f8fbff;
  color: #1b3b62;
  padding: 0.42rem 0.65rem;
  font: inherit;
  line-height: 1;
  text-decoration: none;
}

.graph-toolbar button:hover,
.graph-data-link:hover {
  background: #edf4ff;
}

.graph-stage {
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  background:
    radial-gradient(circle at 8% 15%, #eaf3ff 0, transparent 55%),
    radial-gradient(circle at 90% 85%, #eff8ff 0, transparent 45%),
    #f8fbff;
}

.graph-stage svg {
  width: 100%;
  height: 560px;
  display: block;
  cursor: grab;
}

.graph-stage svg.is-dragging {
  cursor: grabbing;
}

.graph-link {
  stroke: #98a8bf;
  stroke-width: 1.4;
  stroke-opacity: 0.58;
}

.graph-link.is-active {
  stroke: #0057b8;
  stroke-width: 2.1;
  stroke-opacity: 0.92;
}

.graph-link.is-dim {
  stroke-opacity: 0.12;
}

.graph-node {
  transition: opacity 130ms ease;
}

.graph-node circle {
  fill: #ffffff;
  stroke: #3a7bc7;
  stroke-width: 1.5;
}

.graph-node text {
  font-size: 12px;
  fill: #163a66;
  stroke: #f8fbff;
  stroke-width: 2.6;
  paint-order: stroke fill;
}

.graph-node:hover {
  cursor: pointer;
}

.graph-node.is-active circle {
  fill: #dbeafe;
  stroke: #0057b8;
  stroke-width: 2.2;
}

.graph-node.is-dim {
  opacity: 0.22;
}

.graph-detail {
  min-height: 3rem;
  padding: 0.75rem 0.85rem;
  border: 1px dashed var(--line);
  border-radius: 10px;
  background: #fbfdff;
  color: var(--muted);
  font-size: 0.92rem;
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

  .graph-stage svg {
    height: 460px;
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
        .map(|date| date.timestamp())
        .unwrap_or(i64::MIN / 2)
}

fn sort_posts_by_recency(a: &Post, b: &Post) -> Ordering {
    b.pinned
        .cmp(&a.pinned)
        .then_with(|| build_post_sort_key(b).cmp(&build_post_sort_key(a)))
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

fn normalize_slug_candidate(value: &str) -> String {
    value
        .trim()
        .trim_matches('/')
        .trim_end_matches(".md")
        .trim_end_matches(".markdown")
        .replace('\\', "/")
        .split('/')
        .map(str::trim)
        .filter(|segment| !segment.is_empty())
        .map(slugify)
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("/")
}

fn parse_frontmatter_metatags(raw: Option<&YamlValue>) -> Vec<MetaTag> {
    let mut tags = Vec::new();
    let Some(value) = raw else {
        return tags;
    };

    collect_metatags(value, &mut tags);

    let mut seen = HashSet::new();
    tags.into_iter()
        .filter(|tag| {
            let key = format!(
                "{}|{}|{}",
                tag.attr,
                tag.key.to_ascii_lowercase(),
                tag.content
            );
            seen.insert(key)
        })
        .collect()
}

fn collect_metatags(value: &YamlValue, tags: &mut Vec<MetaTag>) {
    match value {
        YamlValue::String(raw) => {
            for token in raw.split(|ch| ch == ',' || ch == '\n') {
                let token = token.trim();
                if token.is_empty() {
                    continue;
                }
                if let Some((key, content)) = token.split_once('=') {
                    push_metatag(tags, key, content);
                } else {
                    push_metatag(tags, token, "true");
                }
            }
        }
        YamlValue::Sequence(items) => {
            for item in items {
                collect_metatags(item, tags);
            }
        }
        YamlValue::Mapping(map) => {
            for (key, value) in map {
                let key = yaml_scalar_to_string(key);
                let content = yaml_scalar_to_string(value);
                push_metatag(tags, &key, &content);
            }
        }
        _ => {}
    }
}

fn push_metatag(tags: &mut Vec<MetaTag>, key: &str, content: &str) {
    let key = key.trim();
    if key.is_empty() {
        return;
    }

    let content = content.trim();
    let content = if content.is_empty() { "true" } else { content };
    let attr = if is_property_metatag(key) {
        "property"
    } else {
        "name"
    };

    tags.push(MetaTag {
        attr: attr.to_string(),
        key: key.to_string(),
        content: content.to_string(),
    });
}

fn is_property_metatag(key: &str) -> bool {
    let key = key.trim().to_ascii_lowercase();
    key.starts_with("og:")
        || key.starts_with("article:")
        || key.starts_with("book:")
        || key.starts_with("profile:")
}

fn parse_content_classes(raw: Option<&YamlValue>) -> Vec<String> {
    let mut classes = Vec::new();
    let Some(value) = raw else {
        return classes;
    };

    collect_content_classes(value, &mut classes);

    let mut seen = HashSet::new();
    classes
        .into_iter()
        .filter(|class_name| seen.insert(class_name.clone()))
        .collect()
}

fn collect_content_classes(value: &YamlValue, classes: &mut Vec<String>) {
    match value {
        YamlValue::String(raw) => classes.extend(parse_class_tokens(raw)),
        YamlValue::Sequence(items) => {
            for item in items {
                collect_content_classes(item, classes);
            }
        }
        _ => {
            let raw = yaml_scalar_to_string(value);
            classes.extend(parse_class_tokens(&raw));
        }
    }
}

fn parse_class_tokens(raw: &str) -> Vec<String> {
    raw.split(|ch: char| ch.is_whitespace() || ch == ',')
        .map(normalize_class_name)
        .filter(|token| !token.is_empty())
        .collect()
}

fn normalize_class_name(value: &str) -> String {
    let mut out = String::new();
    let mut prev_dash = false;

    for ch in value.trim().chars() {
        if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
            out.push(ch.to_ascii_lowercase());
            prev_dash = false;
            continue;
        }

        if !prev_dash {
            out.push('-');
            prev_dash = true;
        }
    }

    out.trim_matches('-').to_string()
}

fn yaml_scalar_to_string(value: &YamlValue) -> String {
    match value {
        YamlValue::Null => String::new(),
        YamlValue::Bool(value) => value.to_string(),
        YamlValue::Number(value) => value.to_string(),
        YamlValue::String(value) => value.trim().to_string(),
        _ => String::new(),
    }
}

fn clean_tag(tag: &str) -> String {
    tag.trim().to_ascii_lowercase()
}

fn extract_excerpt(markdown: &str, max_chars: usize) -> String {
    let rewritten = WIKILINK_RE
        .replace_all(markdown, |caps: &Captures| {
            caps.get(4)
                .map(|m| m.as_str().trim())
                .filter(|label| !label.is_empty())
                .or_else(|| caps.get(2).map(|m| m.as_str().trim()))
                .unwrap_or_default()
                .to_string()
        })
        .to_string();

    let stripped = rewritten
        .lines()
        .map(|line| line.trim())
        .filter(|line| !line.is_empty())
        .filter(|line| !line.starts_with("#"))
        .collect::<Vec<_>>()
        .join(" ");

    let normalized = stripped
        .replace("**", "")
        .replace(['*', '`', '[', ']', '(', ')', '>'], "")
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
    let base = normalize_base_url(base_url);
    let path = if path.starts_with('/') {
        path.to_string()
    } else {
        format!("/{}", path)
    };
    format!("{}{}", base, path)
}

fn normalize_base_url(base_url: &str) -> String {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return "https://example.com".to_string();
    }

    if trimmed.contains("://") {
        trimmed.to_string()
    } else {
        format!("https://{}", trimmed.trim_start_matches('/'))
    }
}

fn escape_xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering as AtomicOrdering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static TEST_DIR_COUNTER: AtomicU64 = AtomicU64::new(0);

    struct TestDir {
        path: PathBuf,
    }

    impl TestDir {
        fn new(prefix: &str) -> Self {
            let tick = TEST_DIR_COUNTER.fetch_add(1, AtomicOrdering::Relaxed);
            let nanos = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos();
            let path = std::env::temp_dir().join(format!("blog-core-{prefix}-{nanos}-{tick}"));
            fs::create_dir_all(&path).expect("failed to create test temp dir");
            Self { path }
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    fn write_text(path: &Path, contents: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("failed to create parent dir for test file");
        }
        fs::write(path, contents).expect("failed to write test file");
    }

    #[test]
    fn markdown_to_html_adds_unique_heading_ids() {
        let html = markdown_to_html(
            r#"
# Intro
## Important Section
## Important Section
"#,
        );

        assert!(html.contains(r#"<h1 id="intro">Intro</h1>"#));
        assert!(html.contains(r#"<h2 id="important-section">Important Section</h2>"#));
        assert!(html.contains(r#"<h2 id="important-section-2">Important Section</h2>"#));
    }

    #[test]
    fn markdown_to_html_renders_callout_blocks() {
        let html = markdown_to_html(
            r#"
> [!warning]- Safety
> Read this first.
"#,
        );

        assert!(html.contains(r#"details class="dg-callout dg-callout-warning""#));
        assert!(html.contains(r#"summary class="dg-callout-title">Safety</summary>"#));
        assert!(html.contains("Read this first."));
    }

    #[test]
    fn extract_excerpt_uses_wikilink_labels() {
        let excerpt = extract_excerpt(
            "Start with [[second-brain|Second Brain]] and [[seo-performance-guide#checklist]].",
            180,
        );

        assert!(excerpt.contains("Second Brain"));
        assert!(excerpt.contains("seo performance guide"));
        assert!(!excerpt.contains('|'));
        assert!(!excerpt.contains("[["));
    }

    #[test]
    fn rewrite_wikilinks_renders_pdf_embed_markup() {
        let slug_map = HashMap::new();
        let embed_sources = HashMap::new();
        let (html, outgoing) = rewrite_wikilinks(
            "![[https://example.com/specs/guide.pdf|Guide PDF]]",
            &slug_map,
            &embed_sources,
            "home",
            true,
        );

        assert!(outgoing.is_empty());
        assert!(html.contains("dg-pdf-embed"));
        assert!(html.contains("Guide PDF"));
        assert!(html.contains("https://example.com/specs/guide.pdf"));
    }

    #[test]
    fn rewrite_wikilinks_resolves_local_asset_links() {
        let slug_map = HashMap::new();
        let embed_sources = HashMap::new();
        let (html, outgoing) = rewrite_wikilinks(
            "[[attachments/spec.pdf|Spec PDF]]",
            &slug_map,
            &embed_sources,
            "home",
            true,
        );

        assert!(outgoing.is_empty());
        assert!(html.contains("[Spec PDF](/content/attachments/spec.pdf)"));
    }

    #[test]
    fn rewrite_wikilinks_links_unresolved_notes_to_placeholder_path() {
        let slug_map = HashMap::new();
        let embed_sources = HashMap::new();
        let (html, outgoing) = rewrite_wikilinks(
            "[[Missing Note#Overview|Open missing]]",
            &slug_map,
            &embed_sources,
            "home",
            true,
        );

        assert!(outgoing.is_empty());
        assert!(html.contains("[Open missing](/notes/missing-note/#overview)"));
    }

    #[test]
    fn apply_dataview_inline_supports_this_file_and_pages_length() {
        let seeds = vec![
            SeedSummary {
                slug: "home".to_string(),
                title: "Home".to_string(),
                tags: vec!["intro".to_string()],
            },
            SeedSummary {
                slug: "seo-note".to_string(),
                title: "SEO Note".to_string(),
                tags: vec!["seo".to_string()],
            },
            SeedSummary {
                slug: "seo-two".to_string(),
                title: "SEO Two".to_string(),
                tags: vec!["seo".to_string()],
            },
        ];
        let rendered = apply_dataview_inline(
            "Name: `= this.file.name`\nLink: `= this.file.link`\nCount: `= dv.pages(\"#seo\").length`",
            &seeds,
            "home",
            "Home",
        );

        assert!(rendered.contains("Name: Home"));
        assert!(rendered.contains("Link: [Home](/notes/home/)"));
        assert!(rendered.contains("Count: 2"));
    }

    #[test]
    fn apply_dataview_blocks_supports_list_from_tag() {
        let seeds = vec![
            SeedSummary {
                slug: "home".to_string(),
                title: "Home".to_string(),
                tags: vec!["intro".to_string()],
            },
            SeedSummary {
                slug: "seo-note".to_string(),
                title: "SEO Note".to_string(),
                tags: vec!["seo".to_string()],
            },
        ];
        let rendered = apply_dataview_blocks("```dataview\nLIST FROM #seo\n```", &seeds, "home");

        assert!(rendered.contains("Dataview"));
        assert!(rendered.contains("/notes/seo-note/"));
    }

    #[test]
    fn apply_dataview_blocks_supports_table_from_tag() {
        let seeds = vec![
            SeedSummary {
                slug: "home".to_string(),
                title: "Home".to_string(),
                tags: vec!["intro".to_string()],
            },
            SeedSummary {
                slug: "seo-note".to_string(),
                title: "SEO | Note".to_string(),
                tags: vec!["seo".to_string()],
            },
        ];
        let rendered = apply_dataview_blocks("```dataview\nTABLE FROM #seo\n```", &seeds, "home");

        assert!(rendered.contains("Query: `TABLE FROM #seo`"));
        assert!(rendered.contains("| Title | Note |"));
        assert!(rendered.contains("/notes/seo-note/"));
    }

    #[test]
    fn apply_dataview_blocks_supports_task_from_tag() {
        let seeds = vec![
            SeedSummary {
                slug: "home".to_string(),
                title: "Home".to_string(),
                tags: vec!["intro".to_string()],
            },
            SeedSummary {
                slug: "seo-note".to_string(),
                title: "SEO Task".to_string(),
                tags: vec!["seo".to_string()],
            },
        ];
        let rendered = apply_dataview_blocks("```dataview\nTASK FROM #seo\n```", &seeds, "home");

        assert!(rendered.contains("Query: `TASK FROM #seo`"));
        assert!(rendered.contains("- [ ] [SEO Task](/notes/seo-note/)"));
    }

    #[test]
    fn apply_dataview_blocks_supports_where_sort_and_limit() {
        let seeds = vec![
            SeedSummary {
                slug: "home".to_string(),
                title: "Home".to_string(),
                tags: vec!["intro".to_string()],
            },
            SeedSummary {
                slug: "alpha".to_string(),
                title: "Alpha SEO".to_string(),
                tags: vec!["seo".to_string()],
            },
            SeedSummary {
                slug: "beta".to_string(),
                title: "Beta SEO".to_string(),
                tags: vec!["seo".to_string()],
            },
            SeedSummary {
                slug: "gamma".to_string(),
                title: "Gamma Rust".to_string(),
                tags: vec!["seo".to_string(), "rust".to_string()],
            },
        ];
        let rendered = apply_dataview_blocks(
            "```dataview\nLIST FROM #seo\nWHERE contains(title, \"seo\")\nSORT title DESC\nLIMIT 1\n```",
            &seeds,
            "home",
        );

        assert!(rendered.contains(
            "Query: `LIST FROM #seo ; WHERE contains(title, \"seo\") ; SORT title DESC ; LIMIT 1`"
        ));
        assert!(rendered.contains("- [Beta SEO](/notes/beta/)"));
        assert!(!rendered.contains("/notes/alpha/"));
    }

    #[test]
    fn markdown_to_html_renders_plantuml_embed() {
        let html = markdown_to_html(
            r#"```plantuml
@startuml
Alice -> Bob: hi
@enduml
```"#,
        );

        assert!(html.contains("plantuml-embed"));
        assert!(html.contains("plantuml.com/plantuml/svg/~h"));
    }

    #[test]
    fn normalize_base_url_adds_https_scheme() {
        assert_eq!(
            normalize_base_url("mud-blog.pages.dev/"),
            "https://mud-blog.pages.dev"
        );
        assert_eq!(
            absolute_url("mud-blog.pages.dev/", "/notes/home/"),
            "https://mud-blog.pages.dev/notes/home/"
        );
    }

    #[test]
    fn build_site_generates_outputs_and_filters_unpublished_notes() -> Result<()> {
        let tmp = TestDir::new("build");
        let content_dir = tmp.path.join("content/posts");
        let static_dir = tmp.path.join("static");
        let output_dir = tmp.path.join("dist");

        write_text(
            &content_dir.join("home.md"),
            r#"---
title: Home
date: 2026-02-16
tags: [intro]
dg-publish: true
dg-home: true
---

# Home

Start with [[second-brain#Architecture Overview|architecture]].
See also [[ghost-note|Ghost Note]].
![[second-brain#Architecture Overview]]
"#,
        );

        write_text(
            &content_dir.join("second-brain.md"),
            r##"---
title: Second Brain
aliases: [brain]
date: 2026-02-15
tags: [rust, architecture]
dg-publish: true
dg-pinned: true
dg-metatags:
  - robots=max-image-preview:large
  - og:locale=ko_KR
dg-content-classes: [focus-mode, article-featured]
dg-experimental: true
---

# Second Brain

## Architecture Overview

See [[home]] and [[brain|self alias]].

> [!tip] Quick Tip
> Keep backlinks clean.

```mermaid
graph TD
  Home --> Brain
```

```plantuml
@startuml
Alice -> Bob: hi
@enduml
```

Inline math $E=mc^2$.

$$
a^2 + b^2 = c^2
$$

![[https://example.com/guide.pdf|Guide PDF]]
![[attachments/spec.pdf|Local Spec]]
![[attachments/diagram.excalidraw|System Sketch]]
![[attachments/knowledge.canvas|Knowledge Canvas]]
![[attachments/preview.png|Preview]]

```dataview
LIST FROM #seo
```

```dataview
TABLE FROM #seo
```

```dataview
TASK FROM #seo
```

```dataviewjs
dv.pages("#seo")
```
"##,
        );

        write_text(
            &content_dir.join("nested/seo.md"),
            r#"---
title: SEO Notes
date: 2026-02-14
tags: [seo]
dg-publish: true
dg-hide-in-graph: true
---

# SEO Notes

Linked from [[second-brain]].
"#,
        );

        write_text(
            &content_dir.join("isolated.md"),
            r#"---
title: Isolated
date: 2026-02-13
tags: [solo]
dg-publish: true
dg-enable-search: false
dg-show-local-graph: false
dg-hide: true
---

# Isolated

No links here.
"#,
        );

        write_text(
            &content_dir.join("path-note.md"),
            r#"---
title: Path Note
date: 2026-02-12
tags: [path]
dg-publish: true
dg-path: custom/path-note
dg-note-icon: "PIN"
---

# Path Note

Uses custom path.
            "#,
        );

        write_text(
            &content_dir.join("no-search.md"),
            r#"---
title: No Search
date: 2026-02-11
tags: [private]
dg-publish: true
dg-enable-search: false
---

# No Search

Visible page, excluded from search index.
"#,
        );

        write_text(
            &content_dir.join("no-flag.md"),
            r#"---
title: No Publish Flag
date: 2026-02-10
---

# No Publish Flag

Should only publish in permissive mode.
"#,
        );

        write_text(
            &content_dir.join("draft-note.md"),
            r#"---
title: Draft
draft: true
---

Not published.
"#,
        );

        write_text(
            &content_dir.join("hidden-note.md"),
            r#"---
title: Hidden
dg-publish: false
---

Not published.
"#,
        );

        write_text(
            &content_dir.join("attachments/spec.pdf"),
            "%PDF-1.4\nfake\n",
        );
        write_text(
            &content_dir.join("attachments/diagram.excalidraw"),
            "{\"type\":\"excalidraw\",\"elements\":[{\"id\":\"box1\",\"type\":\"rectangle\",\"x\":20,\"y\":20,\"width\":180,\"height\":80,\"strokeColor\":\"#315f91\"},{\"id\":\"txt1\",\"type\":\"text\",\"x\":44,\"y\":48,\"text\":\"Core\"},{\"id\":\"arr1\",\"type\":\"arrow\",\"x\":200,\"y\":60,\"width\":160,\"height\":0,\"points\":[[0,0],[160,0]],\"strokeColor\":\"#7a99bf\"}]}\n",
        );
        write_text(
            &content_dir.join("attachments/knowledge.canvas"),
            "{\"nodes\":[]}\n",
        );
        write_text(&content_dir.join("attachments/preview.png"), "fakepng");

        write_text(
            &static_dir.join("assets/style.css"),
            "body { color: #222; }\n",
        );
        write_text(
            &static_dir.join("_headers"),
            "/*\n  X-Robots-Tag: index, follow\n",
        );

        let config = BuildConfig {
            content_dir,
            output_dir: output_dir.clone(),
            static_dir,
            site: SiteConfig {
                base_url: "example.test".to_string(),
                title: "Test Garden".to_string(),
                description: "Test description".to_string(),
                author: "Tester".to_string(),
                language: "en".to_string(),
                ..SiteConfig::default()
            },
            publish_policy: PublishPolicy::DgOptIn,
        };

        let summary = build_site(&config)?;
        assert_eq!(summary.posts, 6);

        assert!(output_dir.join("index.html").exists());
        assert!(output_dir.join("notes/home/index.html").exists());
        assert!(output_dir.join("notes/second-brain/index.html").exists());
        assert!(output_dir.join("notes/nested/seo/index.html").exists());
        assert!(output_dir.join("notes/isolated/index.html").exists());
        assert!(output_dir.join("notes/no-search/index.html").exists());
        assert!(output_dir.join("notes/ghost-note/index.html").exists());
        assert!(output_dir
            .join("notes/custom/path-note/index.html")
            .exists());
        assert!(output_dir.join("_headers").exists());
        assert!(output_dir.join("filetree.json").exists());
        assert!(output_dir.join("content/attachments/spec.pdf").exists());
        assert!(output_dir
            .join("content/attachments/diagram.excalidraw")
            .exists());
        assert!(output_dir
            .join("content/attachments/knowledge.canvas")
            .exists());
        assert!(output_dir.join("content/attachments/preview.png").exists());
        assert!(output_dir.join("local-graph/second-brain.json").exists());
        assert!(output_dir.join("local-graph/isolated.json").exists());
        assert!(output_dir.join("tags/architecture/index.html").exists());
        assert!(!output_dir.join("notes/draft-note/index.html").exists());
        assert!(!output_dir.join("notes/hidden-note/index.html").exists());
        assert!(!output_dir.join("notes/no-flag/index.html").exists());
        assert!(output_dir.join("graph/index.html").exists());
        assert!(output_dir.join("404.html").exists());

        let index_html = fs::read_to_string(output_dir.join("index.html"))?;
        assert!(index_html.contains(r#"rel="canonical" href="https://example.test/""#));
        assert!(index_html.contains("loadScript(\"/assets/filetree.js\")"));
        assert!(index_html.contains("loadScript(\"/assets/toc-tracker.js\")"));
        assert!(index_html.contains("loadScript(\"/assets/link-preview.js\")"));
        assert!(index_html.contains("loadScript(\"/assets/math-render.js\")"));
        assert!(index_html.contains("loadScript(\"/assets/mermaid-render.js\")"));
        assert!(index_html.contains("loadScript(\"/assets/excalidraw-preview.js\")"));
        assert!(index_html.contains("loadScript(\"/assets/canvas-preview.js\")"));
        assert!(index_html.contains("loadScript(\"/assets/graph-view.js\")"));
        assert!(index_html.contains(r#"dataUrl: "/graph.json""#));
        assert!(index_html.contains("note-icon"));
        assert!(!index_html.contains("Isolated"));

        let home_html = fs::read_to_string(output_dir.join("notes/home/index.html"))?;
        assert!(home_html.contains("/notes/second-brain/#architecture-overview"));
        assert!(home_html.contains("/notes/ghost-note/"));
        assert!(home_html.contains(r#"dataUrl: "/local-graph/home.json""#));
        assert!(home_html.contains("Embedded from"));
        assert!(home_html.contains("self alias"));

        let second_html = fs::read_to_string(output_dir.join("notes/second-brain/index.html"))?;
        assert!(second_html.contains(r#"id="architecture-overview""#));
        assert!(second_html.contains("On This Page"));
        assert!(second_html.contains("href=\"#architecture-overview\""));
        assert!(second_html.contains("Linked Mentions"));
        assert!(second_html.contains("/notes/home/"));
        assert!(second_html.contains(r#"dataUrl: "/local-graph/second-brain.json""#));
        assert!(second_html.contains("dg-callout-tip"));
        assert!(second_html.contains("Quick Tip"));
        assert!(second_html.contains("graph TD"));
        assert!(second_html.contains("plantuml-embed"));
        assert!(second_html.contains("plantuml.com/plantuml/svg/~h"));
        assert!(second_html.contains("$E=mc^2$"));
        assert!(second_html.contains("dg-pdf-embed"));
        assert!(second_html.contains("Guide PDF"));
        assert!(second_html.contains("/content/attachments/spec.pdf"));
        assert!(second_html.contains("dg-excalidraw-embed"));
        assert!(second_html.contains("/content/attachments/diagram.excalidraw"));
        assert!(
            second_html.contains("data-excalidraw-src=\"/content/attachments/diagram.excalidraw\"")
        );
        assert!(second_html.contains("dg-canvas-embed"));
        assert!(second_html.contains("/content/attachments/knowledge.canvas"));
        assert!(second_html.contains("data-canvas-src=\"/content/attachments/knowledge.canvas\""));
        assert!(second_html.contains("/content/attachments/preview.png"));
        assert!(second_html.contains("Dataview"));
        assert!(second_html.contains("/notes/nested/seo/"));
        assert!(second_html.contains("TABLE FROM #seo"));
        assert!(second_html.contains("TASK FROM #seo"));
        assert!(second_html.contains("DataviewJS block is not executed"));
        assert!(second_html.contains(r#"<meta name="robots" content="max-image-preview:large" />"#));
        assert!(second_html.contains(r#"<meta property="og:locale" content="ko_KR" />"#));
        assert!(second_html.contains(r#"class="panel note focus-mode article-featured""#));

        assert!(index_html.contains(r#"id="side-graph-stage""#));

        let graph_html = fs::read_to_string(output_dir.join("graph/index.html"))?;
        assert!(graph_html.contains("id=\"global-graph-stage\""));
        assert!(graph_html.contains("id=\"global-graph-search\""));
        assert!(graph_html.contains(r#"dataUrl: "/graph.json""#));
        assert!(!graph_html.contains(r#"id="side-graph-stage""#));

        let graph: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(output_dir.join("graph.json"))?)?;
        let has_home_to_second =
            graph["links"]
                .as_array()
                .unwrap_or(&Vec::new())
                .iter()
                .any(|entry| {
                    entry.get("source").and_then(|v| v.as_str()) == Some("home")
                        && entry.get("target").and_then(|v| v.as_str()) == Some("second-brain")
                });
        assert!(has_home_to_second);
        assert!(!graph["nodes"]
            .as_array()
            .unwrap_or(&Vec::new())
            .iter()
            .any(|entry| entry.get("id").and_then(|value| value.as_str()) == Some("nested/seo")));

        let second_local_graph: serde_json::Value = serde_json::from_str(&fs::read_to_string(
            output_dir.join("local-graph/second-brain.json"),
        )?)?;
        assert_eq!(second_local_graph["center"].as_str(), Some("second-brain"));
        let local_nodes = second_local_graph["nodes"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        assert!(local_nodes
            .iter()
            .any(|entry| entry.get("id").and_then(|value| value.as_str()) == Some("home")));
        assert!(!local_nodes
            .iter()
            .any(|entry| entry.get("id").and_then(|value| value.as_str()) == Some("nested/seo")));

        let isolated_html = fs::read_to_string(output_dir.join("notes/isolated/index.html"))?;
        assert!(isolated_html.contains("No linked mentions yet."));
        assert!(!isolated_html.contains(r#"id="global-search-input""#));
        assert!(!isolated_html.contains(r#"id="side-graph-stage""#));

        let search_index = fs::read_to_string(output_dir.join("search-index.json"))?;
        assert!(!search_index.contains("draft-note"));
        assert!(!search_index.contains("hidden-note"));
        assert!(!search_index.contains("isolated"));
        assert!(!search_index.contains("no-search"));
        assert!(search_index.contains("/notes/custom/path-note/"));

        let filetree: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(output_dir.join("filetree.json"))?)?;
        assert!(filetree
            .as_array()
            .unwrap_or(&Vec::new())
            .iter()
            .any(|node| node.get("label").and_then(|value| value.as_str()) == Some("nested")));
        assert!(!filetree
            .as_array()
            .unwrap_or(&Vec::new())
            .iter()
            .any(|node| node.get("label").and_then(|value| value.as_str()) == Some("Isolated")));

        let robots_txt = fs::read_to_string(output_dir.join("robots.txt"))?;
        assert!(robots_txt.contains("Sitemap: https://example.test/sitemap.xml"));
        let cf_headers = fs::read_to_string(output_dir.join("_headers"))?;
        assert!(cf_headers.contains("X-Robots-Tag: index, follow"));

        let frontmatter_report = fs::read_to_string(output_dir.join("frontmatter-report.json"))?;
        assert!(frontmatter_report.contains("second-brain.md"));
        assert!(frontmatter_report.contains("dg-experimental"));

        let sitemap_xml = fs::read_to_string(output_dir.join("sitemap.xml"))?;
        assert!(!sitemap_xml.contains("/notes/isolated/"));

        let rss_xml = fs::read_to_string(output_dir.join("rss.xml"))?;
        assert!(!rss_xml.contains("/notes/isolated/"));

        let not_found_html = fs::read_to_string(output_dir.join("404.html"))?;
        assert!(not_found_html.contains("Page Not Found"));
        let missing_note_html = fs::read_to_string(output_dir.join("notes/ghost-note/index.html"))?;
        assert!(missing_note_html.contains("not published"));

        Ok(())
    }

    #[test]
    fn build_site_permissive_policy_publishes_non_draft_notes_without_dg_publish() -> Result<()> {
        let tmp = TestDir::new("permissive");
        let content_dir = tmp.path.join("content/posts");
        let static_dir = tmp.path.join("static");
        let output_dir = tmp.path.join("dist");

        write_text(
            &content_dir.join("no-flag.md"),
            r#"---
title: No Publish Flag
date: 2026-02-10
---

# No Publish Flag

Should publish in permissive mode.
"#,
        );

        write_text(
            &static_dir.join("assets/style.css"),
            "body { color: #222; }\n",
        );

        let config = BuildConfig {
            content_dir,
            output_dir: output_dir.clone(),
            static_dir,
            site: SiteConfig {
                base_url: "example.test".to_string(),
                title: "Test Garden".to_string(),
                description: "Test description".to_string(),
                author: "Tester".to_string(),
                language: "en".to_string(),
                ..SiteConfig::default()
            },
            publish_policy: PublishPolicy::Permissive,
        };

        let summary = build_site(&config)?;
        assert_eq!(summary.posts, 1);
        assert!(output_dir.join("notes/no-flag/index.html").exists());

        Ok(())
    }
}
