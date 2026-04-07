use anyhow::{Context, Result};
use askama::Template;
use better_minify_js::{
    minify as minify_javascript_bytes, Session as JsMinifierSession, TopLevelMode,
};
use chrono::{DateTime, NaiveDate, TimeZone, Utc};
use lightningcss::printer::PrinterOptions as CssPrinterOptions;
use lightningcss::stylesheet::{
    MinifyOptions as CssMinifyOptions, ParserOptions as CssParserOptions,
    StyleSheet as CssStyleSheet,
};
use maud::{html, PreEscaped};
use once_cell::sync::Lazy;
use pulldown_cmark::{html::push_html, Options, Parser};
use rayon::prelude::*;
use regex::{Captures, Regex};
use serde::{Deserialize, Serialize};
use serde_json::json;
use serde_yaml::Value as YamlValue;
use slug::slugify;
use std::cmp::Ordering;
use std::collections::{BTreeMap, HashMap, HashSet, VecDeque};
use std::fmt::Write as _;
use std::fs;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::{Path, PathBuf};
use std::process::Command;
use walkdir::WalkDir;

static WIKILINK_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(!?)\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]")
        .expect("invalid wikilink regex")
});

static IMG_TAG_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r#"(?is)<img\b([^>]*)>"#).expect("invalid img tag regex"));
static IMG_SRC_ATTR_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r#"(?i)\bsrc\s*=\s*"([^"]+)""#).expect("invalid img src attr regex"));
static IMG_ALT_ATTR_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r#"(?i)(?:^|\s)alt\s*="#).expect("invalid img alt attr regex"));
static IMG_LOADING_ATTR_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r#"(?i)(?:^|\s)loading\s*="#).expect("invalid img loading attr regex"));
static IMG_DECODING_ATTR_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?i)(?:^|\s)decoding\s*="#).expect("invalid img decoding attr regex")
});
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
    Regex::new(r#"(?i)^\s*LIST\s+FROM\s+(.+?)\s*$"#).expect("invalid dataview list regex")
});
static DATAVIEW_TABLE_FROM_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?i)^\s*TABLE(?:\s+(.+?))?\s+FROM\s+(.+?)\s*$"#)
        .expect("invalid dataview table regex")
});
static DATAVIEW_TASK_FROM_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?i)^\s*TASK\s+FROM\s+(.+?)\s*$"#).expect("invalid dataview task regex")
});
static DATAVIEW_SORT_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)^\s*SORT\s+(file\.name|title|file\.path|file\.folder)\s*(ASC|DESC)?\s*$")
        .expect("invalid dataview sort regex")
});
static DATAVIEW_LIMIT_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)^\s*LIMIT\s+([0-9]{1,4})\s*$").expect("invalid dataview limit regex")
});
static DATAVIEW_WHERE_LINE_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?i)^\s*WHERE\s+(.+?)\s*$"#).expect("invalid dataview where line regex")
});
static DATAVIEW_WHERE_AND_SPLIT_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)\s+AND\s+").expect("invalid dataview where and split regex"));
static DATAVIEW_WHERE_CONTAINS_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?i)^\s*contains\(\s*([A-Za-z0-9\._]+)\s*,\s*["']([^"']+)["']\s*\)\s*$"#)
        .expect("invalid dataview where contains regex")
});
static DATAVIEW_WHERE_STARTSWITH_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?i)^\s*startswith\(\s*([A-Za-z0-9\._]+)\s*,\s*["']([^"']+)["']\s*\)\s*$"#)
        .expect("invalid dataview where startswith regex")
});
static DATAVIEW_WHERE_EQUALS_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?i)^\s*([A-Za-z0-9\._]+)\s*(?:=|==)\s*["']([^"']+)["']\s*$"#)
        .expect("invalid dataview where equals regex")
});
static DATAVIEW_INLINE_THIS_FILE_NAME_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)`=\s*this\.file\.name\s*`").expect("invalid dataview inline file name regex")
});
static DATAVIEW_INLINE_THIS_FILE_LINK_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)`=\s*this\.file\.link\s*`").expect("invalid dataview inline file link regex")
});
static DATAVIEW_INLINE_THIS_FILE_PATH_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)`=\s*this\.file\.path\s*`").expect("invalid dataview inline file path regex")
});
static DATAVIEW_INLINE_THIS_FILE_FOLDER_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)`=\s*this\.file\.folder\s*`")
        .expect("invalid dataview inline file folder regex")
});
static DATAVIEW_INLINE_THIS_FILE_TAGS_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)`=\s*this\.file\.tags\s*`").expect("invalid dataview inline file tags regex")
});
static DATAVIEW_INLINE_PAGES_LENGTH_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?i)`=\s*dv\.pages\(\s*["']([^"']+)["']\s*\)\.length\s*`"#)
        .expect("invalid dataview inline pages length regex")
});
static DATAVIEWJS_DV_PAGES_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?is)dv\.pages\(\s*["']([^"']+)["']\s*\)"#)
        .expect("invalid dataviewjs pages regex")
});
static DATAVIEWJS_LIST_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?is)dv\.list\s*\(").expect("invalid dataviewjs list regex"));
static DATAVIEWJS_TABLE_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?is)dv\.table\s*\(").expect("invalid dataviewjs table regex"));
static DATAVIEWJS_TASKLIST_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?is)dv\.taskList\s*\(").expect("invalid dataviewjs task list regex")
});
static DATAVIEWJS_LIMIT_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?is)\.limit\s*\(\s*([0-9]{1,4})\s*\)").expect("invalid dataviewjs limit regex")
});
static DATAVIEWJS_SORT_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?is)\.sort\s*\(\s*[^)]*?(file\.name|title|file\.path|file\.folder)[^)]*?\)"#)
        .expect("invalid dataviewjs sort regex")
});
static DATAVIEWJS_SORT_DESC_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?is)\.sort\s*\(\s*[^)]*?["']desc["'][^)]*?\)"#)
        .expect("invalid dataviewjs sort desc regex")
});
static DATAVIEWJS_WHERE_CONTAINS_FN_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r#"(?is)contains\(\s*(?:\w+\.)?(file\.name|title|file\.path|file\.folder|tags|file\.tags)\s*,\s*["']([^"']+)["']\s*\)"#,
    )
    .expect("invalid dataviewjs where contains-fn regex")
});
static DATAVIEWJS_WHERE_INCLUDES_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r#"(?is)(?:\w+\.)?(file\.name|title|file\.path|file\.folder|tags|file\.tags)\s*\.includes\(\s*["']([^"']+)["']\s*\)"#,
    )
    .expect("invalid dataviewjs where includes regex")
});
static DATAVIEWJS_WHERE_STARTSWITH_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r#"(?is)(?:\w+\.)?(file\.name|title|file\.path|file\.folder)\s*\.startsWith\(\s*["']([^"']+)["']\s*\)"#,
    )
    .expect("invalid dataviewjs where startswith regex")
});
static DATAVIEWJS_WHERE_EQUALS_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r#"(?is)(?:\w+\.)?(file\.name|title|file\.path|file\.folder)\s*(?:===|==|=)\s*["']([^"']+)["']"#,
    )
    .expect("invalid dataviewjs where equals regex")
});
static DATAVIEWJS_TABLE_HEADERS_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?is)dv\.table\s*\(\s*\[([^\]]*)\]"#)
        .expect("invalid dataviewjs table headers regex")
});
static DATAVIEWJS_TABLE_MAP_ARRAY_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?is)\.map\s*\(\s*\w+\s*=>\s*\[([^\]]*)\]\s*\)"#)
        .expect("invalid dataviewjs table map array regex")
});
static NOTE_LINK_MARKDOWN_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\]\(/notes/([^)]+)\)").expect("invalid markdown note link regex"));
static HTML_TAG_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?s)<[^>]+>").expect("invalid html tag regex"));
static HIGHLIGHT_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"==([^=\n][^=\n]*?)==").expect("invalid highlight regex"));
static INLINE_SCRIPT_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"(?is)<script>(.*?)</script>"#).expect("invalid inline script regex")
});

const SUPPORTED_FRONTMATTER_KEYS: &[&str] = &[
    "title",
    "description",
    "slug",
    "path",
    "note-path",
    "permalink",
    "note-permalink",
    "date",
    "updated",
    "tags",
    "aliases",
    "draft",
    "publish",
    "note-publish",
    "home",
    "note-home",
    "enable-search",
    "note-enable-search",
    "show-local-graph",
    "note-show-local-graph",
    "pinned",
    "note-pinned",
    "hide",
    "note-hide",
    "hide-in-graph",
    "note-hide-in-graph",
    "note-icon",
    "metatags",
    "note-metatags",
    "content-classes",
    "note-content-classes",
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
            search_placeholder: "Search notes…".to_string(),
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
    pub social_image: String,
    pub text: SiteText,
    pub dataviewjs_mode: DataviewJsMode,
}

impl Default for SiteConfig {
    fn default() -> Self {
        Self {
            base_url: "https://example.com".to_string(),
            title: "Mud's Blog".to_string(),
            description: String::new(),
            author: "Author".to_string(),
            language: "en".to_string(),
            social_image: "/og-image.png".to_string(),
            text: SiteText::default(),
            dataviewjs_mode: DataviewJsMode::default(),
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum PublishPolicy {
    #[default]
    OptIn,
    Permissive,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum DataviewJsMode {
    #[default]
    Disabled,
    TagPages,
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
    #[serde(rename = "path", alias = "note-path")]
    path: Option<String>,
    #[serde(rename = "permalink", alias = "note-permalink")]
    permalink: Option<String>,
    date: Option<String>,
    updated: Option<String>,
    tags: Option<Vec<String>>,
    aliases: Option<Vec<String>>,
    draft: Option<bool>,
    #[serde(rename = "publish", alias = "note-publish")]
    publish: Option<bool>,
    #[serde(rename = "home", alias = "note-home")]
    home: Option<bool>,
    #[serde(rename = "enable-search", alias = "note-enable-search")]
    enable_search: Option<bool>,
    #[serde(rename = "show-local-graph", alias = "note-show-local-graph")]
    show_local_graph: Option<bool>,
    #[serde(rename = "pinned", alias = "note-pinned")]
    pinned: Option<bool>,
    #[serde(rename = "hide", alias = "note-hide")]
    hide: Option<bool>,
    #[serde(rename = "hide-in-graph", alias = "note-hide-in-graph")]
    hide_in_graph: Option<bool>,
    #[serde(rename = "note-icon")]
    note_icon: Option<String>,
    #[serde(rename = "metatags", alias = "note-metatags")]
    metatags: Option<YamlValue>,
    #[serde(rename = "content-classes", alias = "note-content-classes")]
    content_classes: Option<YamlValue>,
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
    has_rich_note_styles: bool,
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
    icon: String,
    icon_open: String,
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
    icon: String,
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

#[derive(Debug, Deserialize)]
struct RawRegexFilterRule {
    pattern: String,
    replace: String,
}

#[derive(Debug, Clone)]
struct RegexFilterRule {
    regex: Regex,
    replace: String,
}

#[derive(Debug, Deserialize, Default)]
struct RawStyleSettings {
    root: Option<BTreeMap<String, String>>,
    light: Option<BTreeMap<String, String>>,
    dark: Option<BTreeMap<String, String>>,
}

#[derive(Debug, Clone, Default)]
struct ThemeAssets {
    obsidian_theme_css_url: String,
    style_settings_css_url: String,
    user_overrides_css_url: String,
    style_settings_inline_css: String,
}

#[derive(Debug, Clone, Copy)]
enum DataviewKind {
    List,
    Table,
    Task,
}

#[derive(Debug, Clone)]
enum DataviewSource {
    Tag(String),
    Folder(String),
    Note(String),
}

#[derive(Debug, Clone)]
struct DataviewMatch {
    title: String,
    slug: String,
    tags: Vec<String>,
}

#[derive(Debug, Clone, Copy, Default)]
enum DataviewSortKey {
    #[default]
    Title,
    FileName,
    FilePath,
    FileFolder,
}

#[derive(Debug, Clone, Copy)]
enum DataviewFilterField {
    Title,
    Tag,
    FileName,
    FilePath,
    FileFolder,
}

#[derive(Debug, Clone, Copy)]
enum DataviewFilterOp {
    Contains,
    Equals,
    StartsWith,
}

#[derive(Debug, Clone)]
struct DataviewFilter {
    field: DataviewFilterField,
    op: DataviewFilterOp,
    value: String,
}

#[derive(Debug, Clone, Copy)]
enum DataviewTableColumnValue {
    Title,
    FileLink,
    FileName,
    FilePath,
    FileFolder,
    Tags,
    Url,
}

#[derive(Debug, Clone)]
struct DataviewTableColumnSpec {
    header: String,
    value: DataviewTableColumnValue,
}

#[derive(Debug, Clone, Default)]
struct DataviewQueryOptions {
    filters: Vec<DataviewFilter>,
    sort_key: DataviewSortKey,
    sort_desc: bool,
    limit: Option<usize>,
    table_columns: Vec<DataviewTableColumnSpec>,
}

#[derive(Debug, Clone)]
struct LayoutContext {
    body_class: String,
    site_title: String,
    site_description: String,
    site_url: String,
    lang: String,
    page_title: String,
    page_description: String,
    canonical_url: String,
    page_url: String,
    social_image_url: String,
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
    obsidian_theme_css_url: String,
    style_settings_css_url: String,
    user_overrides_css_url: String,
    style_settings_inline_css: String,
    show_search: bool,
    show_graph_module: bool,
    graph_data_url: String,
    graph_center_id: String,
    show_side_graph: bool,
    asset_version: String,
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
    description: String,
    excerpt: String,
    folder_label: String,
    path_label: String,
    date_display: String,
    updated_display: Option<String>,
    reading_time_min: usize,
    tags: Vec<TagEntry>,
}

#[derive(Debug, Clone)]
struct TagEntry {
    name: String,
    slug: String,
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
    total_notes: usize,
    total_tags: usize,
    total_folders: usize,
    featured_posts: Vec<PostCard>,
    news_spotlight: Option<HomeNewsSpotlight>,
}

#[derive(Template)]
#[template(path = "post.html")]
struct PostTemplate {
    layout: LayoutContext,
    post: PostCard,
    body_html: String,
    load_note_rich_css: bool,
    content_classes: String,
    show_note_header: bool,
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

#[derive(Debug, Clone)]
struct HomeNewsSpotlight {
    issue_label: String,
    summary: String,
    url: String,
}

#[derive(Template)]
#[template(path = "missing-note.html")]
struct MissingNoteTemplate {
    layout: LayoutContext,
    missing_title: String,
    missing_slug: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
struct NewsHubData {
    #[serde(default)]
    issue_label: String,
    #[serde(default)]
    summary: String,
    #[serde(default)]
    digest: NewsDigestLink,
    #[serde(default)]
    archives: Vec<NewsArchiveEntry>,
}

#[derive(Debug, Clone, Default, Deserialize)]
struct NewsDigestLink {
    #[serde(default)]
    url: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
struct NewsArchiveEntry {
    #[serde(default)]
    url: String,
    #[serde(default)]
    date_label: String,
    #[serde(default)]
    description: String,
}

pub fn build_site(config: &BuildConfig) -> Result<BuildSummary> {
    let seeds = collect_post_seeds(config)?;
    let slug_map = build_slug_map(&seeds);
    let regex_filters = load_regex_filters(&config.static_dir)?;
    let theme_assets = collect_theme_assets(&config.static_dir)?;
    let mut posts = render_posts(
        &seeds,
        &slug_map,
        config.site.dataviewjs_mode,
        &regex_filters,
    )?;

    posts.sort_by(sort_posts_by_recency);

    let post_by_slug: HashMap<String, &Post> = posts.iter().map(|p| (p.slug.clone(), p)).collect();
    let backlinks = build_backlinks(&posts, &post_by_slug);
    let tags = build_tag_index(&posts);
    let asset_version = asset_version_token();

    if config.output_dir.exists() {
        fs::remove_dir_all(&config.output_dir)
            .with_context(|| format!("failed to clear {}", config.output_dir.display()))?;
    }

    fs::create_dir_all(&config.output_dir)
        .with_context(|| format!("failed to create {}", config.output_dir.display()))?;

    copy_static_assets(&config.static_dir, &config.output_dir)?;
    copy_content_assets(&config.content_dir, &config.output_dir)?;
    copy_embedded_news_site(&config.output_dir)?;
    ensure_default_css(&config.output_dir)?;

    render_index(config, &posts, &tags, &theme_assets, &asset_version)?;
    render_posts_pages(config, &posts, &backlinks, &theme_assets, &asset_version)?;
    render_missing_note_pages(config, &posts, &theme_assets, &asset_version)?;
    render_tag_pages(config, &tags, &posts, &theme_assets, &asset_version)?;
    render_graph_page(config, &posts, &theme_assets, &asset_version)?;
    render_news_page(config, &posts)?;
    render_not_found_page(config, &posts, &theme_assets, &asset_version)?;
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
            PublishPolicy::OptIn => frontmatter.publish.unwrap_or(false),
            PublishPolicy::Permissive => frontmatter
                .publish
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
            .or(frontmatter.path.as_deref())
            .or(frontmatter.permalink.as_deref())
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
            is_home: frontmatter.home.unwrap_or(false),
            enable_search: frontmatter.enable_search.unwrap_or(true),
            show_local_graph: frontmatter.show_local_graph.unwrap_or(true),
            pinned: frontmatter.pinned.unwrap_or(false),
            hidden: frontmatter.hide.unwrap_or(false),
            hide_in_graph: frontmatter.hide_in_graph.unwrap_or(false),
            note_icon: frontmatter
                .note_icon
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(|value| value.to_string()),
            meta_tags: parse_frontmatter_metatags(frontmatter.metatags.as_ref()),
            content_classes: parse_content_classes(frontmatter.content_classes.as_ref()),
        });
    }

    Ok(seeds)
}

fn render_posts(
    seeds: &[PostSeed],
    slug_map: &HashMap<String, String>,
    dataviewjs_mode: DataviewJsMode,
    regex_filters: &[RegexFilterRule],
) -> Result<Vec<Post>> {
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

    let posts = seeds
        .par_iter()
        .map(|seed| {
            let body = embed_sources
                .get(&seed.slug)
                .map(|source| source.markdown.as_str())
                .unwrap_or_default();
            let filtered_body = apply_custom_regex_filters(body, regex_filters);
            let with_dataview_blocks =
                apply_dataview_blocks(&filtered_body, &seed_summaries, &seed.slug, dataviewjs_mode);
            let with_dataview = apply_dataview_inline(
                &with_dataview_blocks,
                &seed_summaries,
                &seed.slug,
                &seed.title,
                &seed.tags,
            );

            let (rewritten, outgoing_links) =
                rewrite_wikilinks(&with_dataview, slug_map, &embed_sources, &seed.slug, true);
            let unresolved_note_slugs = extract_referenced_note_slugs(&rewritten)
                .into_iter()
                .filter(|slug| !known_slugs.contains(slug))
                .collect::<Vec<_>>();
            let markdown_html = rewrite_relative_image_asset_urls(
                &markdown_to_html(&rewritten),
                &seed.source_rel_path,
            );
            let toc = extract_toc_entries(&markdown_html);
            let rich_content_classes = detect_rich_note_content_classes(&markdown_html);
            let has_rich_note_styles = !rich_content_classes.is_empty();
            let mut content_classes = seed.content_classes.clone();
            for class_name in rich_content_classes {
                if !content_classes.iter().any(|item| item == class_name) {
                    content_classes.push(class_name.to_string());
                }
            }
            let excerpt = extract_excerpt(body, 200);
            let description = seed.description.clone().unwrap_or_else(|| excerpt.clone());

            Post {
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
                has_rich_note_styles,
                content_classes,
            }
        })
        .collect::<Vec<_>>();

    Ok(posts)
}

fn render_index(
    config: &BuildConfig,
    posts: &[Post],
    tags: &[TagEntry],
    theme_assets: &ThemeAssets,
    asset_version: &str,
) -> Result<()> {
    let layout = website_layout(
        config,
        posts,
        theme_assets,
        config.site.title.clone(),
        config.site.description.clone(),
        "/",
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
        asset_version,
    );

    let mut visible_posts: Vec<&Post> = posts
        .iter()
        .filter(|post| !post.hidden && !is_news_digest_post(post))
        .collect();
    visible_posts.sort_by(|a, b| sort_posts_by_recency(a, b));

    let featured_posts = visible_posts
        .iter()
        .copied()
        .filter(|post| !post.is_home)
        .take(8)
        .map(post_to_card)
        .collect();
    let news_spotlight = load_generated_news_hub_data(posts)?.and_then(build_home_news_spotlight);
    let total_notes = visible_posts.len();
    let total_tags = tags.len();
    let total_folders = posts
        .iter()
        .filter(|post| !post.hidden && !is_news_digest_post(post))
        .filter_map(|post| post.slug.split_once('/').map(|(folder, _)| folder.trim()))
        .filter(|folder| !folder.is_empty())
        .collect::<HashSet<_>>()
        .len();

    let template = IndexTemplate {
        layout,
        total_notes,
        total_tags,
        total_folders,
        featured_posts,
        news_spotlight,
    };

    write_file(config.output_dir.join("index.html"), template.render()?)
}

fn render_posts_pages(
    config: &BuildConfig,
    posts: &[Post],
    backlinks: &HashMap<String, Vec<Backlink>>,
    theme_assets: &ThemeAssets,
    asset_version: &str,
) -> Result<()> {
    for post in posts {
        let page_path = format!("/notes/{}/", post.slug);
        let json_ld = article_json_ld(config, post);
        let toc_items = toc_items_for_post(post);
        let show_side_graph = post.show_local_graph || !toc_items.is_empty();
        let layout = website_layout(
            config,
            posts,
            theme_assets,
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
            asset_version,
        );

        let backlink_list = backlinks.get(&post.slug).cloned().unwrap_or_default();
        let body_html =
            render_post_body_with_maud(&post.markdown_html, &backlink_list, &config.site.text);

        let template = PostTemplate {
            layout,
            post: post_to_card(post),
            body_html,
            load_note_rich_css: post.has_rich_note_styles,
            content_classes: post.content_classes.join(" "),
            show_note_header: !is_news_digest_post(post),
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

fn render_tag_pages(
    config: &BuildConfig,
    tags: &[TagEntry],
    posts: &[Post],
    theme_assets: &ThemeAssets,
    asset_version: &str,
) -> Result<()> {
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
            theme_assets,
            format!("#{} | {}", tag.name, config.site.title),
            format!("Posts tagged '{}'", tag.name),
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
            asset_version,
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

fn render_graph_page(
    config: &BuildConfig,
    posts: &[Post],
    theme_assets: &ThemeAssets,
    asset_version: &str,
) -> Result<()> {
    let (nodes, links) = build_graph_data(posts);
    let layout = website_layout(
        config,
        posts,
        theme_assets,
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
        asset_version,
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

fn render_news_page(config: &BuildConfig, posts: &[Post]) -> Result<()> {
    let Some(mut news) = load_generated_news_hub_data(posts)? else {
        return Ok(());
    };

    if news.digest.url.trim().is_empty() {
        if let Some(first) = news.archives.first() {
            news.digest = NewsDigestLink {
                url: first.url.clone(),
            };
        }
    }

    write_file(
        config.output_dir.join("news").join("index.html"),
        render_news_redirect_html(
            &format!("News Radar | {}", config.site.title),
            if news.summary.trim().is_empty() {
                "Daily repo, paper, and social signal digest."
            } else {
                &news.summary
            },
            if news.digest.url.trim().is_empty() {
                "/"
            } else {
                &news.digest.url
            },
        ),
    )
}

fn render_news_redirect_html(title: &str, description: &str, target: &str) -> String {
    let safe_title = escape_html_text(title);
    let safe_description = escape_html_text(description);
    let safe_target = escape_html_text(target);
    format!(
        r#"<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{safe_title}</title>
  <meta name="description" content="{safe_description}" />
  <meta http-equiv="refresh" content="0; url={safe_target}" />
  <link rel="canonical" href="{safe_target}" />
  <style>
    html, body {{
      margin: 0;
      background: #0b1120;
    }}
    html.redirecting body {{
      display: none;
    }}
  </style>
  <script>document.documentElement.classList.add("redirecting"); window.location.replace("{safe_target}");</script>
</head>
<body>
  <noscript>
    <main>
      <a href="{safe_target}">Continue to the current Daily AI News Digest</a>
    </main>
  </noscript>
</body>
</html>"#
    )
}

fn render_not_found_page(
    config: &BuildConfig,
    posts: &[Post],
    theme_assets: &ThemeAssets,
    asset_version: &str,
) -> Result<()> {
    let layout = website_layout(
        config,
        posts,
        theme_assets,
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
        asset_version,
    );

    let template = NotFoundTemplate { layout };
    write_file(config.output_dir.join("404.html"), template.render()?)
}

fn render_missing_note_pages(
    config: &BuildConfig,
    posts: &[Post],
    theme_assets: &ThemeAssets,
    asset_version: &str,
) -> Result<()> {
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
            theme_assets,
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
            asset_version,
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
            icon: file_tree_note_icon(leaf_segment).to_string(),
        });
    }

    file_tree_nodes_from_builder(&root, "")
}

fn file_tree_folder_icons(folder_name: &str) -> (&'static str, &'static str) {
    let normalized = folder_name.trim().to_ascii_lowercase();
    let normalized = normalized.trim_matches('.').replace('_', "-");
    let key = normalized.as_str();
    let tokens = key
        .split(|ch: char| !ch.is_ascii_alphanumeric())
        .filter(|token| !token.is_empty())
        .collect::<Vec<_>>();
    let has = |needle: &str| tokens.contains(&needle);

    if has("workflow") || has("workflows") || key == "gh-workflows" {
        return ("folder-gh-workflows.svg", "folder-gh-workflows-open.svg");
    }

    if has("github") {
        return ("folder-github.svg", "folder-github-open.svg");
    }

    if has("git") {
        return ("folder-git.svg", "folder-git-open.svg");
    }

    if has("cloudflare") {
        return ("folder-cloudflare.svg", "folder-cloudflare-open.svg");
    }

    if has("function") || has("functions") || has("worker") || has("workers") {
        return ("folder-functions.svg", "folder-functions-open.svg");
    }

    if has("api")
        || has("apis")
        || has("graphql")
        || has("schema")
        || has("openapi")
        || has("swagger")
    {
        return ("folder-api.svg", "folder-api-open.svg");
    }

    if has("database") || has("db") || has("data") || has("sql") || has("store") {
        return ("folder-database.svg", "folder-database-open.svg");
    }

    if has("test") || has("tests") || has("spec") || has("specs") || has("qa") || has("e2e") {
        return ("folder-test.svg", "folder-test-open.svg");
    }

    if has("task") || has("tasks") || has("todo") {
        return ("folder-tasks.svg", "folder-tasks-open.svg");
    }

    if has("script") || has("scripts") || has("tool") || has("tools") || has("bin") {
        return ("folder-scripts.svg", "folder-scripts-open.svg");
    }

    if has("server") || has("backend") {
        return ("folder-server.svg", "folder-server-open.svg");
    }

    if has("client") || has("frontend") || has("webapp") {
        return ("folder-client.svg", "folder-client-open.svg");
    }

    if has("component") || has("components") || has("ui") {
        return ("folder-components.svg", "folder-components-open.svg");
    }

    if has("home") || has("root") {
        return ("folder-home.svg", "folder-home-open.svg");
    }

    if has("link") || has("links") {
        return ("folder-link.svg", "folder-link-open.svg");
    }

    if key == "node_modules" || has("node") || has("npm") {
        return ("folder-node.svg", "folder-node-open.svg");
    }

    if has("target") {
        return ("folder-target.svg", "folder-target-open.svg");
    }

    if has("dist") || has("build") || has("out") {
        return ("folder-dist.svg", "folder-dist-open.svg");
    }

    if has("archive") || has("archives") || has("backup") || has("old") {
        return ("folder-archive.svg", "folder-archive-open.svg");
    }

    if has("config")
        || has("configs")
        || has("setting")
        || has("settings")
        || has("vscode")
        || has("idea")
    {
        return ("folder-config.svg", "folder-config-open.svg");
    }

    if has("src") || has("source") || has("lib") {
        return ("folder-src.svg", "folder-src-open.svg");
    }

    if has("public") || has("static") || has("assets") || has("www") {
        return ("folder-public.svg", "folder-public-open.svg");
    }

    if has("images")
        || has("image")
        || has("img")
        || has("media")
        || has("photos")
        || has("screenshots")
    {
        return ("folder-images.svg", "folder-images-open.svg");
    }

    if has("docs")
        || has("doc")
        || has("documentation")
        || has("guide")
        || has("guides")
        || has("manual")
        || has("wiki")
        || has("kb")
    {
        return ("folder-docs.svg", "folder-docs-open.svg");
    }

    if has("markdown") || has("md") {
        return ("folder-markdown.svg", "folder-markdown-open.svg");
    }

    if has("content") || has("posts") || has("post") || has("notes") || has("note") || has("blog") {
        return ("folder-content.svg", "folder-content-open.svg");
    }

    ("folder-base.svg", "folder-base-open.svg")
}

fn file_tree_note_icon(file_name: &str) -> &'static str {
    let normalized = file_name.trim().to_ascii_lowercase();
    let is_known_ext = |ext: &str| {
        matches!(
            ext,
            "md" | "markdown"
                | "mdx"
                | "json"
                | "pdf"
                | "png"
                | "jpg"
                | "jpeg"
                | "gif"
                | "webp"
                | "svg"
                | "bmp"
                | "excalidraw"
                | "canvas"
                | "mermaid"
                | "toml"
                | "yaml"
                | "yml"
                | "ini"
                | "conf"
                | "rs"
        )
    };
    let (stem_raw, ext) = match normalized.rsplit_once('.') {
        Some((stem, ext)) if !stem.is_empty() && is_known_ext(ext) => (stem, ext),
        _ => (normalized.as_str(), ""),
    };
    let stem_normalized = stem_raw.replace('_', "-");
    let stem = stem_normalized.as_str();
    let tokens = stem
        .split(|ch: char| !ch.is_ascii_alphanumeric())
        .filter(|token| !token.is_empty())
        .collect::<Vec<_>>();
    let has = |needle: &str| tokens.contains(&needle);

    if normalized == "readme.md" || stem == "readme" {
        return "readme.svg";
    }

    match ext {
        "json" => return "json.svg",
        "pdf" => return "pdf.svg",
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp" => return "image.svg",
        "excalidraw" => return "excalidraw.svg",
        "canvas" | "mermaid" => return "mermaid.svg",
        "toml" | "yaml" | "yml" | "ini" | "conf" => return "settings.svg",
        "rs" => return "rust.svg",
        _ => {}
    }

    if has("about")
        || has("profile")
        || has("portfolio")
        || has("resume")
        || has("cv")
        || has("bio")
    {
        return "bibliography.svg";
    }

    if has("changelog") || has("history") || has("release") {
        return "changelog.svg";
    }

    if has("license") || has("licence") || has("copying") {
        return "license.svg";
    }

    if has("search") {
        return "search.svg";
    }

    if has("seo") || has("lighthouse") || has("performance") {
        return "lighthouse.svg";
    }

    if has("deploy") || has("pipeline") || has("ship") || has("launch") {
        return "rocket.svg";
    }

    if has("git") || has("github") || has("workflow") || has("commit") {
        return "git.svg";
    }

    if has("graphql") || has("api") || has("schema") {
        return "graphql.svg";
    }

    if has("database") || has("db") || has("sql") || has("data") {
        return "database.svg";
    }

    if has("mermaid") || has("diagram") || has("flowchart") || has("graph") {
        return "mermaid.svg";
    }

    if has("rust") {
        return "rust.svg";
    }

    if has("setting") || has("settings") || has("config") {
        return "settings.svg";
    }

    match ext {
        "md" | "markdown" => "markdown.svg",
        "mdx" => "mdx.svg",
        "" => "markdown.svg",
        _ => "document.svg",
    }
}

fn file_tree_nodes_from_builder(builder: &FileTreeDirBuilder, path: &str) -> Vec<FileTreeNode> {
    let mut nodes = Vec::new();

    for (name, child) in &builder.dirs {
        let child_path = if path.is_empty() {
            name.to_string()
        } else {
            format!("{path}/{name}")
        };
        let (icon, icon_open) = file_tree_folder_icons(name);

        nodes.push(FileTreeNode {
            id: format!("dir:{child_path}"),
            label: name.to_string(),
            kind: "folder".to_string(),
            url: String::new(),
            preview: String::new(),
            icon: icon.to_string(),
            icon_open: icon_open.to_string(),
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
            icon: note.icon,
            icon_open: String::new(),
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

fn include_in_graph(post: &Post) -> bool {
    !post.hidden && !post.hide_in_graph && !is_news_digest_post(post)
}

fn build_graph_data(posts: &[Post]) -> (Vec<GraphNode>, Vec<GraphLink>) {
    let graph_posts = posts
        .iter()
        .filter(|post| include_in_graph(post))
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
    posts.par_iter().try_for_each(|post| -> Result<()> {
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
        )
    })?;

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
        .filter(|post| include_in_graph(post))
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
    if news_page_available() {
        append_sitemap_url(
            &mut xml,
            &absolute_url(&config.site.base_url, "/news/"),
            None,
        );
    }

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

fn load_regex_filters(static_dir: &Path) -> Result<Vec<RegexFilterRule>> {
    let path = static_dir.join("regex-filters.json");
    if !path.exists() {
        return Ok(Vec::new());
    }

    let raw =
        fs::read_to_string(&path).with_context(|| format!("failed to read {}", path.display()))?;
    let rules: Vec<RawRegexFilterRule> = serde_json::from_str(&raw)
        .with_context(|| format!("failed to parse {}", path.display()))?;

    let mut compiled = Vec::new();
    for (index, rule) in rules.into_iter().enumerate() {
        let pattern = rule.pattern.trim();
        if pattern.is_empty() {
            continue;
        }
        let regex = Regex::new(pattern).with_context(|| {
            format!(
                "failed to compile regex filter #{} in {}: {}",
                index + 1,
                path.display(),
                pattern
            )
        })?;
        compiled.push(RegexFilterRule {
            regex,
            replace: rule.replace,
        });
    }

    Ok(compiled)
}

fn apply_custom_regex_filters(markdown: &str, filters: &[RegexFilterRule]) -> String {
    let mut transformed = markdown.to_string();
    for rule in filters {
        transformed = rule
            .regex
            .replace_all(&transformed, rule.replace.as_str())
            .to_string();
    }
    transformed
}

fn collect_theme_assets(static_dir: &Path) -> Result<ThemeAssets> {
    Ok(ThemeAssets {
        obsidian_theme_css_url: static_css_url_if_exists(static_dir, "obsidian-theme.css"),
        style_settings_css_url: static_css_url_if_exists(static_dir, "style-settings.css"),
        user_overrides_css_url: static_css_url_if_exists(static_dir, "user-overrides.css"),
        style_settings_inline_css: load_style_settings_inline_css(static_dir)?,
    })
}

fn static_css_url_if_exists(static_dir: &Path, file_name: &str) -> String {
    if static_dir.join(file_name).exists() {
        format!("/{}", file_name.replace('\\', "/"))
    } else {
        String::new()
    }
}

fn load_style_settings_inline_css(static_dir: &Path) -> Result<String> {
    let path = static_dir.join("style-settings.json");
    if !path.exists() {
        return Ok(String::new());
    }

    let raw =
        fs::read_to_string(&path).with_context(|| format!("failed to read {}", path.display()))?;
    let parsed: RawStyleSettings = serde_json::from_str(&raw)
        .with_context(|| format!("failed to parse {}", path.display()))?;

    let mut css = String::new();
    if let Some(root) = parsed.root.as_ref() {
        append_css_var_block(&mut css, ":root", root);
    }
    if let Some(light) = parsed.light.as_ref() {
        append_css_var_block(&mut css, "[data-theme=\"light\"]", light);
    }
    if let Some(dark) = parsed.dark.as_ref() {
        append_css_var_block(&mut css, "[data-theme=\"dark\"]", dark);
    }

    Ok(css)
}

fn append_css_var_block(css: &mut String, selector: &str, vars: &BTreeMap<String, String>) {
    let mut declarations = String::new();
    for (name, value) in vars {
        let Some(safe_name) = sanitize_css_var_name(name) else {
            continue;
        };
        let Some(safe_value) = sanitize_css_var_value(value) else {
            continue;
        };
        declarations.push_str(&safe_name);
        declarations.push(':');
        declarations.push_str(&safe_value);
        declarations.push(';');
    }

    if declarations.is_empty() {
        return;
    }

    css.push_str(selector);
    css.push('{');
    css.push_str(&declarations);
    css.push('}');
}

fn sanitize_css_var_name(name: &str) -> Option<String> {
    let trimmed = name.trim();
    if !trimmed.starts_with("--") || trimmed.len() <= 2 {
        return None;
    }
    if trimmed
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
    {
        Some(trimmed.to_string())
    } else {
        None
    }
}

fn sanitize_css_var_value(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    if trimmed.contains(';') || trimmed.contains('{') || trimmed.contains('}') {
        return None;
    }
    if trimmed.contains('<') || trimmed.contains('>') {
        return None;
    }
    Some(trimmed.to_string())
}

fn minify_inline_scripts_in_html(input: &str) -> String {
    INLINE_SCRIPT_RE
        .replace_all(input, |captures: &Captures<'_>| {
            let script_body = captures.get(1).map(|m| m.as_str()).unwrap_or_default();
            let minified = minify_javascript(script_body);
            format!("<script>{}</script>", minified)
        })
        .into_owned()
}

fn write_file(path: PathBuf, contents: String) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }

    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(str::to_ascii_lowercase);

    let to_write = match extension.as_deref() {
        Some("html") | Some("htm") => minify_inline_scripts_in_html(&contents),
        _ => contents,
    };

    fs::write(&path, to_write).with_context(|| format!("failed to write {}", path.display()))
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
    if let Some(stripped) = raw.strip_prefix("---\n") {
        if let Some(end) = stripped.find("\n---\n") {
            let frontmatter = &stripped[..end];
            let body = &stripped[end + 5..];
            return Some((frontmatter, body));
        }
    }

    if let Some(stripped) = raw.strip_prefix("---\r\n") {
        if let Some(end) = stripped.find("\r\n---\r\n") {
            let frontmatter = &stripped[..end];
            let body = &stripped[end + 8..];
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
    extensions.contains(&ext)
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
        .replace(['-', '_'], " ");
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
        "\n\n<div class=\"note-pdf-embed\"><div class=\"note-pdf-embed-head\">{title}</div><object data=\"{url}\" type=\"application/pdf\"><p>PDF preview is not available. <a href=\"{url}\" target=\"_blank\" rel=\"noopener\">Open PDF</a></p></object></div>\n\n",
        title = safe_title,
        url = safe_url
    )
}

fn apply_dataview_blocks(
    markdown: &str,
    seeds: &[SeedSummary],
    current_slug: &str,
    dataviewjs_mode: DataviewJsMode,
) -> String {
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
                render_dataviewjs_fallback(
                    &block_lines.join("\n"),
                    seeds,
                    current_slug,
                    dataviewjs_mode,
                )
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
    current_tags: &[String],
) -> String {
    let mut transformed = String::new();
    let mut in_fence = false;
    let current_folder = current_slug
        .rsplit_once('/')
        .map(|(folder, _)| folder)
        .unwrap_or("");
    let tags_display = if current_tags.is_empty() {
        "[]".to_string()
    } else {
        current_tags
            .iter()
            .map(|tag| format!("#{tag}"))
            .collect::<Vec<_>>()
            .join(", ")
    };

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
        let with_path = DATAVIEW_INLINE_THIS_FILE_PATH_RE
            .replace_all(&with_link, current_slug)
            .to_string();
        let with_folder = DATAVIEW_INLINE_THIS_FILE_FOLDER_RE
            .replace_all(&with_path, current_folder)
            .to_string();
        let with_tags = DATAVIEW_INLINE_THIS_FILE_TAGS_RE
            .replace_all(&with_folder, tags_display.as_str())
            .to_string();
        let with_count = DATAVIEW_INLINE_PAGES_LENGTH_RE
            .replace_all(&with_tags, |caps: &Captures| {
                let raw_source = caps.get(1).map(|m| m.as_str()).unwrap_or_default();
                let count = parse_dataview_source(raw_source)
                    .map(|source| {
                        seeds
                            .iter()
                            .filter(|seed| dataview_source_matches(seed, &source))
                            .count()
                    })
                    .unwrap_or(0);
                count.to_string()
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

fn parse_dataview_source(raw_source: &str) -> Option<DataviewSource> {
    let trimmed = raw_source.trim();
    if trimmed.is_empty() {
        return None;
    }

    let unquoted = if let Some(stripped) = trimmed
        .strip_prefix('"')
        .and_then(|value| value.strip_suffix('"'))
    {
        stripped.trim()
    } else if let Some(stripped) = trimmed
        .strip_prefix('\'')
        .and_then(|value| value.strip_suffix('\''))
    {
        stripped.trim()
    } else {
        trimmed
    };

    if unquoted.is_empty() {
        return None;
    }

    if let Some(raw_tag) = unquoted.strip_prefix('#') {
        let cleaned = clean_tag(raw_tag);
        if cleaned.is_empty() {
            return None;
        }
        return Some(DataviewSource::Tag(cleaned.to_ascii_lowercase()));
    }

    if let Some(wikilink) = unquoted
        .strip_prefix("[[")
        .and_then(|value| value.strip_suffix("]]"))
    {
        let head = wikilink.split(['|', '#']).next().unwrap_or_default().trim();
        let normalized = normalize_slug_candidate(head);
        if normalized.is_empty() {
            return None;
        }
        return Some(DataviewSource::Note(normalized));
    }

    let folder = unquoted
        .trim_start_matches("./")
        .trim_matches('/')
        .replace('\\', "/")
        .trim()
        .to_ascii_lowercase();
    if folder.is_empty() {
        None
    } else {
        Some(DataviewSource::Folder(folder))
    }
}

fn dataview_source_label(source: &DataviewSource) -> String {
    match source {
        DataviewSource::Tag(tag) => format!("#{tag}"),
        DataviewSource::Folder(folder) => folder.clone(),
        DataviewSource::Note(slug) => format!("[[{slug}]]"),
    }
}

fn dataview_source_matches(seed: &SeedSummary, source: &DataviewSource) -> bool {
    match source {
        DataviewSource::Tag(tag) => seed.tags.iter().any(|item| item == tag),
        DataviewSource::Folder(folder) => {
            let slug = seed.slug.to_ascii_lowercase();
            slug == *folder || slug.starts_with(&format!("{folder}/"))
        }
        DataviewSource::Note(slug) => seed.slug == *slug,
    }
}

impl DataviewMatch {
    fn file_path(&self) -> &str {
        &self.slug
    }

    fn file_folder(&self) -> &str {
        self.slug
            .rsplit_once('/')
            .map(|(folder, _)| folder)
            .unwrap_or("")
    }

    fn file_name(&self) -> &str {
        self.slug.rsplit('/').next().unwrap_or(self.slug.as_str())
    }

    fn note_url(&self) -> String {
        format!("/notes/{}/", self.slug)
    }

    fn note_link_markdown(&self) -> String {
        format!("[{}]({})", self.title, self.note_url())
    }
}

fn parse_dataview_sort_key(raw_key: &str) -> DataviewSortKey {
    match raw_key.trim().to_ascii_lowercase().as_str() {
        "file.path" => DataviewSortKey::FilePath,
        "file.folder" => DataviewSortKey::FileFolder,
        "file.name" => DataviewSortKey::FileName,
        _ => DataviewSortKey::Title,
    }
}

fn parse_dataview_filter_field(raw_field: &str) -> Option<DataviewFilterField> {
    match raw_field.trim().to_ascii_lowercase().as_str() {
        "title" => Some(DataviewFilterField::Title),
        "tags" | "file.tags" => Some(DataviewFilterField::Tag),
        "file.name" => Some(DataviewFilterField::FileName),
        "file.path" => Some(DataviewFilterField::FilePath),
        "file.folder" => Some(DataviewFilterField::FileFolder),
        _ => None,
    }
}

fn normalize_dataview_filter_value(field: DataviewFilterField, value: &str) -> Option<String> {
    let normalized = match field {
        DataviewFilterField::Tag => {
            let cleaned = clean_tag(value.trim().trim_start_matches('#'));
            if cleaned.is_empty() {
                return None;
            }
            cleaned.to_ascii_lowercase()
        }
        DataviewFilterField::FilePath | DataviewFilterField::FileFolder => {
            let normalized = value
                .trim()
                .trim_matches('/')
                .replace('\\', "/")
                .to_ascii_lowercase();
            if normalized.is_empty() {
                return None;
            }
            normalized
        }
        _ => {
            let normalized = value.trim().to_ascii_lowercase();
            if normalized.is_empty() {
                return None;
            }
            normalized
        }
    };

    Some(normalized)
}

fn push_dataview_filter(
    options: &mut DataviewQueryOptions,
    raw_field: &str,
    op: DataviewFilterOp,
    raw_value: &str,
) -> bool {
    let Some(field) = parse_dataview_filter_field(raw_field) else {
        return false;
    };
    let Some(value) = normalize_dataview_filter_value(field, raw_value) else {
        return false;
    };
    options.filters.push(DataviewFilter { field, op, value });
    true
}

fn parse_dataview_where_condition(condition: &str, options: &mut DataviewQueryOptions) -> bool {
    if let Some(caps) = DATAVIEW_WHERE_CONTAINS_RE.captures(condition) {
        return push_dataview_filter(
            options,
            caps.get(1).map(|m| m.as_str()).unwrap_or_default(),
            DataviewFilterOp::Contains,
            caps.get(2).map(|m| m.as_str()).unwrap_or_default(),
        );
    }

    if let Some(caps) = DATAVIEW_WHERE_STARTSWITH_RE.captures(condition) {
        return push_dataview_filter(
            options,
            caps.get(1).map(|m| m.as_str()).unwrap_or_default(),
            DataviewFilterOp::StartsWith,
            caps.get(2).map(|m| m.as_str()).unwrap_or_default(),
        );
    }

    if let Some(caps) = DATAVIEW_WHERE_EQUALS_RE.captures(condition) {
        return push_dataview_filter(
            options,
            caps.get(1).map(|m| m.as_str()).unwrap_or_default(),
            DataviewFilterOp::Equals,
            caps.get(2).map(|m| m.as_str()).unwrap_or_default(),
        );
    }

    false
}

fn parse_dataview_where_line(line: &str, options: &mut DataviewQueryOptions) -> bool {
    let Some(caps) = DATAVIEW_WHERE_LINE_RE.captures(line) else {
        return false;
    };

    let body = caps.get(1).map(|m| m.as_str()).unwrap_or_default().trim();
    if body.is_empty() {
        return true;
    }

    for condition in DATAVIEW_WHERE_AND_SPLIT_RE.split(body) {
        let condition = condition.trim();
        if condition.is_empty() {
            continue;
        }
        let _ = parse_dataview_where_condition(condition, options);
    }

    true
}

fn dataview_default_table_columns() -> Vec<DataviewTableColumnSpec> {
    vec![
        DataviewTableColumnSpec {
            header: "Title".to_string(),
            value: DataviewTableColumnValue::Title,
        },
        DataviewTableColumnSpec {
            header: "Note".to_string(),
            value: DataviewTableColumnValue::FileLink,
        },
    ]
}

fn split_dataview_alias(raw: &str) -> (String, Option<String>) {
    let lower = raw.to_ascii_lowercase();
    if let Some(idx) = lower.rfind(" as ") {
        let expr = raw[..idx].trim().to_string();
        let alias = raw[idx + 4..]
            .trim()
            .trim_matches('"')
            .trim_matches('\'')
            .trim()
            .to_string();
        if expr.is_empty() || alias.is_empty() {
            return (raw.trim().to_string(), None);
        }
        return (expr, Some(alias));
    }

    (raw.trim().to_string(), None)
}

fn default_dataview_table_header(value: DataviewTableColumnValue) -> &'static str {
    match value {
        DataviewTableColumnValue::Title => "Title",
        DataviewTableColumnValue::FileLink => "Note",
        DataviewTableColumnValue::FileName => "File Name",
        DataviewTableColumnValue::FilePath => "Path",
        DataviewTableColumnValue::FileFolder => "Folder",
        DataviewTableColumnValue::Tags => "Tags",
        DataviewTableColumnValue::Url => "URL",
    }
}

fn parse_dataview_table_column(raw_expr: &str) -> Option<DataviewTableColumnSpec> {
    let (expr, alias) = split_dataview_alias(raw_expr);
    let normalized = expr
        .trim()
        .trim_start_matches("p.")
        .trim_start_matches("row.")
        .trim()
        .to_ascii_lowercase();
    if normalized.is_empty() {
        return None;
    }

    let value = match normalized.as_str() {
        "title" => DataviewTableColumnValue::Title,
        "file.link" | "link" => DataviewTableColumnValue::FileLink,
        "file.name" => DataviewTableColumnValue::FileName,
        "file.path" => DataviewTableColumnValue::FilePath,
        "file.folder" => DataviewTableColumnValue::FileFolder,
        "tags" | "file.tags" => DataviewTableColumnValue::Tags,
        "url" | "file.url" => DataviewTableColumnValue::Url,
        _ => return None,
    };

    Some(DataviewTableColumnSpec {
        header: alias.unwrap_or_else(|| default_dataview_table_header(value).to_string()),
        value,
    })
}

fn parse_dataview_table_columns(raw_columns: Option<&str>) -> Vec<DataviewTableColumnSpec> {
    let Some(raw_columns) = raw_columns else {
        return dataview_default_table_columns();
    };
    let columns = raw_columns
        .split(',')
        .filter_map(parse_dataview_table_column)
        .collect::<Vec<_>>();
    if columns.is_empty() {
        dataview_default_table_columns()
    } else {
        columns
    }
}

fn parse_dataview_query(
    raw_query: &str,
) -> Option<(DataviewKind, DataviewSource, DataviewQueryOptions)> {
    let mut lines = raw_query
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty());
    let head = lines.next()?;

    let mut options = DataviewQueryOptions::default();
    let (kind, source) = if let Some(caps) = DATAVIEW_TASK_FROM_RE.captures(head) {
        (
            DataviewKind::Task,
            parse_dataview_source(caps.get(1).map(|m| m.as_str()).unwrap_or_default())?,
        )
    } else if let Some(caps) = DATAVIEW_TABLE_FROM_RE.captures(head) {
        options.table_columns =
            parse_dataview_table_columns(caps.get(1).map(|m| m.as_str().trim()));
        (
            DataviewKind::Table,
            parse_dataview_source(caps.get(2).map(|m| m.as_str()).unwrap_or_default())?,
        )
    } else if let Some(caps) = DATAVIEW_LIST_FROM_RE.captures(head) {
        (
            DataviewKind::List,
            parse_dataview_source(caps.get(1).map(|m| m.as_str()).unwrap_or_default())?,
        )
    } else {
        return None;
    };

    for line in lines {
        if let Some(caps) = DATAVIEW_SORT_RE.captures(line) {
            let raw_key = caps.get(1).map(|m| m.as_str()).unwrap_or("title");
            options.sort_key = parse_dataview_sort_key(raw_key);
            let direction = caps
                .get(2)
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

        if parse_dataview_where_line(line, &mut options) {
            continue;
        }
    }

    Some((kind, source, options))
}

fn dataview_filter_value_for_field(entry: &DataviewMatch, field: DataviewFilterField) -> Vec<&str> {
    match field {
        DataviewFilterField::Title => vec![entry.title.as_str()],
        DataviewFilterField::Tag => entry.tags.iter().map(|tag| tag.as_str()).collect(),
        DataviewFilterField::FileName => vec![entry.file_name()],
        DataviewFilterField::FilePath => vec![entry.file_path()],
        DataviewFilterField::FileFolder => vec![entry.file_folder()],
    }
}

fn dataview_filter_matches(entry: &DataviewMatch, filter: &DataviewFilter) -> bool {
    let values = dataview_filter_value_for_field(entry, filter.field);
    values.into_iter().any(|value| {
        let value = value.to_ascii_lowercase();
        match filter.op {
            DataviewFilterOp::Contains => value.contains(&filter.value),
            DataviewFilterOp::Equals => value == filter.value,
            DataviewFilterOp::StartsWith => value.starts_with(&filter.value),
        }
    })
}

fn collect_dataview_matches(
    seeds: &[SeedSummary],
    current_slug: &str,
    source: &DataviewSource,
    options: &DataviewQueryOptions,
) -> Vec<DataviewMatch> {
    let mut matches = seeds
        .iter()
        .filter(|seed| seed.slug != current_slug)
        .filter(|seed| dataview_source_matches(seed, source))
        .map(|seed| DataviewMatch {
            title: seed.title.clone(),
            slug: seed.slug.clone(),
            tags: seed.tags.clone(),
        })
        .filter(|entry| {
            options
                .filters
                .iter()
                .all(|filter| dataview_filter_matches(entry, filter))
        })
        .collect::<Vec<_>>();

    matches.sort_by(|a, b| {
        let lhs = match options.sort_key {
            DataviewSortKey::Title => a.title.to_ascii_lowercase(),
            DataviewSortKey::FileName => a.file_name().to_ascii_lowercase(),
            DataviewSortKey::FilePath => a.file_path().to_ascii_lowercase(),
            DataviewSortKey::FileFolder => a.file_folder().to_ascii_lowercase(),
        };
        let rhs = match options.sort_key {
            DataviewSortKey::Title => b.title.to_ascii_lowercase(),
            DataviewSortKey::FileName => b.file_name().to_ascii_lowercase(),
            DataviewSortKey::FilePath => b.file_path().to_ascii_lowercase(),
            DataviewSortKey::FileFolder => b.file_folder().to_ascii_lowercase(),
        };
        lhs.cmp(&rhs).then_with(|| {
            a.title
                .to_ascii_lowercase()
                .cmp(&b.title.to_ascii_lowercase())
                .then(
                    a.slug
                        .to_ascii_lowercase()
                        .cmp(&b.slug.to_ascii_lowercase()),
                )
        })
    });

    if options.sort_desc {
        matches.reverse();
    }
    if let Some(limit) = options.limit {
        matches.truncate(limit);
    }

    matches
}

fn dataview_table_cell_value(entry: &DataviewMatch, column: DataviewTableColumnValue) -> String {
    match column {
        DataviewTableColumnValue::Title => entry.title.clone(),
        DataviewTableColumnValue::FileLink => entry.note_link_markdown(),
        DataviewTableColumnValue::FileName => entry.file_name().to_string(),
        DataviewTableColumnValue::FilePath => entry.file_path().to_string(),
        DataviewTableColumnValue::FileFolder => entry.file_folder().to_string(),
        DataviewTableColumnValue::Tags => entry
            .tags
            .iter()
            .map(|tag| format!("#{tag}"))
            .collect::<Vec<_>>()
            .join(", "),
        DataviewTableColumnValue::Url => entry.note_url(),
    }
}

fn escape_markdown_table_cell(value: &str) -> String {
    value.replace('|', "\\|")
}

fn render_dataview_table(
    rendered: &mut String,
    matches: &[DataviewMatch],
    columns: &[DataviewTableColumnSpec],
) {
    let columns = if columns.is_empty() {
        dataview_default_table_columns()
    } else {
        columns.to_vec()
    };

    let headers = columns
        .iter()
        .map(|column| escape_markdown_table_cell(&column.header))
        .collect::<Vec<_>>();
    rendered.push_str(&format!("> | {} |\n", headers.join(" | ")));
    rendered.push_str(&format!(
        "> | {} |\n",
        columns
            .iter()
            .map(|_| "---")
            .collect::<Vec<_>>()
            .join(" | ")
    ));

    for entry in matches {
        let cells = columns
            .iter()
            .map(|column| {
                escape_markdown_table_cell(&dataview_table_cell_value(entry, column.value))
            })
            .collect::<Vec<_>>();
        rendered.push_str(&format!("> | {} |\n", cells.join(" | ")));
    }
}

fn render_dataview_query_block(query: &str, seeds: &[SeedSummary], current_slug: &str) -> String {
    let raw_query = query.trim();
    if raw_query.is_empty() {
        return "> [!info] Dataview\n> Empty Dataview query.\n".to_string();
    }

    let Some((kind, source, options)) = parse_dataview_query(raw_query) else {
        return format!(
            "> [!info] Dataview\n> Query is not supported yet.\n>\n> ```text\n> {}\n> ```\n",
            raw_query.replace('\n', "\n> ")
        );
    };

    let matches = collect_dataview_matches(seeds, current_slug, &source, &options);
    let mut rendered = String::new();
    rendered.push_str("> [!info] Dataview\n");
    let display_query = raw_query.replace('`', "\\`").replace('\n', " ; ");
    rendered.push_str(&format!("> Query: `{}`\n>\n", display_query));

    if matches.is_empty() {
        rendered.push_str(&format!(
            "> _No notes found for {}._\n",
            dataview_source_label(&source)
        ));
        return rendered;
    }

    match kind {
        DataviewKind::Task => {
            for entry in matches {
                rendered.push_str(&format!("> - [ ] {}\n", entry.note_link_markdown()));
            }
        }
        DataviewKind::Table => {
            render_dataview_table(&mut rendered, &matches, &options.table_columns);
        }
        DataviewKind::List => {
            for entry in matches {
                rendered.push_str(&format!("> - {}\n", entry.note_link_markdown()));
            }
        }
    }

    rendered
}

fn parse_dataviewjs_query_options(body: &str) -> DataviewQueryOptions {
    let mut options = DataviewQueryOptions::default();

    for captures in DATAVIEWJS_WHERE_CONTAINS_FN_RE.captures_iter(body) {
        let _ = push_dataview_filter(
            &mut options,
            captures.get(1).map(|m| m.as_str()).unwrap_or_default(),
            DataviewFilterOp::Contains,
            captures.get(2).map(|m| m.as_str()).unwrap_or_default(),
        );
    }

    for captures in DATAVIEWJS_WHERE_INCLUDES_RE.captures_iter(body) {
        let _ = push_dataview_filter(
            &mut options,
            captures.get(1).map(|m| m.as_str()).unwrap_or_default(),
            DataviewFilterOp::Contains,
            captures.get(2).map(|m| m.as_str()).unwrap_or_default(),
        );
    }

    for captures in DATAVIEWJS_WHERE_STARTSWITH_RE.captures_iter(body) {
        let _ = push_dataview_filter(
            &mut options,
            captures.get(1).map(|m| m.as_str()).unwrap_or_default(),
            DataviewFilterOp::StartsWith,
            captures.get(2).map(|m| m.as_str()).unwrap_or_default(),
        );
    }

    for captures in DATAVIEWJS_WHERE_EQUALS_RE.captures_iter(body) {
        let _ = push_dataview_filter(
            &mut options,
            captures.get(1).map(|m| m.as_str()).unwrap_or_default(),
            DataviewFilterOp::Equals,
            captures.get(2).map(|m| m.as_str()).unwrap_or_default(),
        );
    }

    if let Some(caps) = DATAVIEWJS_SORT_RE.captures(body) {
        let raw_key = caps.get(1).map(|m| m.as_str()).unwrap_or("title");
        options.sort_key = parse_dataview_sort_key(raw_key);
        options.sort_desc = DATAVIEWJS_SORT_DESC_RE.is_match(body);
    }

    if let Some(caps) = DATAVIEWJS_LIMIT_RE.captures(body) {
        options.limit = caps
            .get(1)
            .and_then(|m| m.as_str().parse::<usize>().ok())
            .map(|value| value.clamp(1, 200));
    }

    options
}

fn parse_dataviewjs_table_columns(body: &str) -> Vec<DataviewTableColumnSpec> {
    let header_labels = DATAVIEWJS_TABLE_HEADERS_RE
        .captures(body)
        .and_then(|caps| caps.get(1).map(|m| m.as_str().to_string()))
        .map(|raw| {
            raw.split(',')
                .map(|item| item.trim().trim_matches('"').trim_matches('\'').trim())
                .filter(|item| !item.is_empty())
                .map(|item| item.to_string())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let mut columns = DATAVIEWJS_TABLE_MAP_ARRAY_RE
        .captures(body)
        .and_then(|caps| caps.get(1).map(|m| m.as_str().to_string()))
        .map(|raw| {
            raw.split(',')
                .filter_map(parse_dataview_table_column)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    if columns.is_empty() {
        let known = [
            "file.link",
            "title",
            "file.name",
            "file.path",
            "file.folder",
            "file.tags",
            "tags",
            "url",
        ];
        for key in known {
            if body.to_ascii_lowercase().contains(key) {
                if let Some(column) = parse_dataview_table_column(key) {
                    columns.push(column);
                }
            }
        }
    }

    if columns.is_empty() {
        columns = dataview_default_table_columns();
    }

    if !header_labels.is_empty() {
        for (idx, header) in header_labels.into_iter().enumerate() {
            if let Some(column) = columns.get_mut(idx) {
                column.header = header;
            }
        }
    }

    columns
}

fn render_dataviewjs_fallback(
    query: &str,
    seeds: &[SeedSummary],
    current_slug: &str,
    dataviewjs_mode: DataviewJsMode,
) -> String {
    let body = query.trim();
    if body.is_empty() {
        return "> [!info] DataviewJS\n> DataviewJS block is not executed.\n".to_string();
    }

    if dataviewjs_mode == DataviewJsMode::TagPages {
        if let Some(caps) = DATAVIEWJS_DV_PAGES_RE.captures(body) {
            let raw_source = caps.get(1).map(|m| m.as_str().trim()).unwrap_or_default();
            let Some(source) = parse_dataview_source(raw_source) else {
                return format!(
                    "> [!info] DataviewJS\n> DataviewJS block is not executed.\n>\n> ```javascript\n> {}\n> ```\n",
                    body.replace('\n', "\n> ")
                );
            };

            let mut options = parse_dataviewjs_query_options(body);
            if DATAVIEWJS_TABLE_RE.is_match(body) {
                options.table_columns = parse_dataviewjs_table_columns(body);
            }

            let matches = collect_dataview_matches(seeds, current_slug, &source, &options);
            let source_label = dataview_source_label(&source);

            let mut rendered = String::new();
            rendered.push_str("> [!info] DataviewJS\n");
            rendered.push_str(&format!(
                "> Rendered in safe mode (`tag-pages`) for `dv.pages(\"{}\")`.\n>\n",
                source_label
            ));

            if matches.is_empty() {
                rendered.push_str(&format!("> _No notes found for {}._\n", source_label));
                return rendered;
            }

            if DATAVIEWJS_TABLE_RE.is_match(body) {
                render_dataview_table(&mut rendered, &matches, &options.table_columns);
                return rendered;
            }

            if DATAVIEWJS_TASKLIST_RE.is_match(body) {
                for entry in matches {
                    rendered.push_str(&format!("> - [ ] {}\n", entry.note_link_markdown()));
                }
                return rendered;
            }

            if DATAVIEWJS_LIST_RE.is_match(body) || body.contains(".file.link") {
                for entry in matches {
                    rendered.push_str(&format!("> - {}\n", entry.note_link_markdown()));
                }
                return rendered;
            }

            rendered
                .push_str("> DataviewJS expression parsed, but output shape is not recognized.\n");
            rendered.push_str("> Falling back to note list.\n>\n");
            for entry in matches {
                rendered.push_str(&format!("> - {}\n", entry.note_link_markdown()));
            }
            return rendered;
        }
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
        "\n\n<div class=\"note-excalidraw-embed\" data-excalidraw-src=\"{source}\"><div class=\"note-excalidraw-embed-head\">{title}</div><div class=\"note-excalidraw-embed-body\"><p class=\"note-excalidraw-placeholder\">Loading drawing preview...</p><div class=\"note-excalidraw-preview-wrap\" hidden></div><img class=\"note-excalidraw-preview\" src=\"{svg}\" alt=\"{title}\" loading=\"lazy\" decoding=\"async\" /><p class=\"note-excalidraw-links\"><a href=\"{source}\" target=\"_blank\" rel=\"noopener\">Open Excalidraw Source</a> · <a href=\"{png}\" target=\"_blank\" rel=\"noopener\">Try PNG Preview</a></p></div></div>\n\n",
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
        "\n\n<div class=\"note-canvas-embed\" data-canvas-src=\"{url}\"><div class=\"note-canvas-embed-head\">{title}</div><div class=\"note-canvas-embed-body\"><p class=\"note-canvas-placeholder\">Loading canvas preview...</p><div class=\"note-canvas-preview\" hidden></div><p class=\"note-canvas-links\"><a href=\"{url}\" target=\"_blank\" rel=\"noopener\">Open Canvas Source</a></p></div></div>\n\n",
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

    enhance_image_tags(&html)
}

fn enhance_image_tags(html: &str) -> String {
    IMG_TAG_RE
        .replace_all(html, |captures: &Captures| {
            let attrs = captures.get(1).map(|entry| entry.as_str()).unwrap_or("");
            let mut tag = String::from("<img");

            if !IMG_LOADING_ATTR_RE.is_match(attrs) {
                tag.push_str(r#" loading="lazy""#);
            }

            if !IMG_DECODING_ATTR_RE.is_match(attrs) {
                tag.push_str(r#" decoding="async""#);
            }

            if !IMG_ALT_ATTR_RE.is_match(attrs) {
                tag.push_str(r#" alt="""#);
            }

            if !attrs.is_empty() {
                if !attrs.starts_with(char::is_whitespace) {
                    tag.push(' ');
                }
                tag.push_str(attrs);
            }

            tag.push('>');
            tag
        })
        .to_string()
}

fn rewrite_relative_image_asset_urls(html: &str, source_rel_path: &str) -> String {
    if !html.contains("<img") {
        return html.to_string();
    }

    IMG_TAG_RE
        .replace_all(html, |captures: &Captures| {
            let full_tag = captures
                .get(0)
                .map(|entry| entry.as_str())
                .unwrap_or_default();
            let attrs = captures
                .get(1)
                .map(|entry| entry.as_str())
                .unwrap_or_default();
            let Some(src_caps) = IMG_SRC_ATTR_RE.captures(attrs) else {
                return full_tag.to_string();
            };
            let source = src_caps
                .get(1)
                .map(|entry| entry.as_str())
                .unwrap_or_default();
            let Some(rewritten) = resolve_relative_image_asset_url(source, source_rel_path) else {
                return full_tag.to_string();
            };

            let replaced_attrs = IMG_SRC_ATTR_RE
                .replace(attrs, format!(r#"src="{rewritten}""#))
                .to_string();
            format!("<img{replaced_attrs}>")
        })
        .to_string()
}

fn resolve_relative_image_asset_url(source: &str, source_rel_path: &str) -> Option<String> {
    let trimmed = source.trim();
    if trimmed.is_empty()
        || trimmed.starts_with('/')
        || trimmed.starts_with("http://")
        || trimmed.starts_with("https://")
        || trimmed.starts_with("data:")
        || trimmed.starts_with('#')
        || trimmed.starts_with("mailto:")
        || trimmed.starts_with("tel:")
        || trimmed.starts_with("javascript:")
    {
        return None;
    }

    let candidate = trimmed.to_ascii_lowercase();
    if !(candidate.starts_with("./")
        || candidate.starts_with("../")
        || candidate.starts_with("assets/"))
    {
        return None;
    }

    let path_end = trimmed.find(['?', '#']).unwrap_or(trimmed.len());
    let raw_path = &trimmed[..path_end];
    let suffix = &trimmed[path_end..];
    if !is_image_target(raw_path) {
        return None;
    }

    if raw_path.starts_with("content/") {
        return Some(format!("/{raw_path}{suffix}"));
    }

    let normalized_source = source_rel_path
        .trim_matches('/')
        .replace('\\', "/")
        .to_string();
    let base_dir = normalized_source
        .rsplit_once('/')
        .map(|(dir, _)| dir)
        .unwrap_or_default();
    let mut segments = base_dir
        .split('/')
        .filter(|segment| !segment.is_empty())
        .map(str::to_string)
        .collect::<Vec<_>>();

    let normalized_raw = raw_path.replace('\\', "/");
    for segment in normalized_raw.split('/') {
        match segment {
            "" | "." => {}
            ".." => {
                segments.pop();
            }
            value => segments.push(value.to_string()),
        }
    }

    if segments.is_empty() {
        return None;
    }

    Some(format!("/content/{}{}", segments.join("/"), suffix))
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
                    "<div class=\"note-callout note-callout-{kind}\" data-callout=\"{kind}\"><div class=\"note-callout-title\">{title}</div><div class=\"note-callout-body\">{body}</div></div>",
                    kind = callout_type,
                    title = safe_title,
                    body = body_html
                ));
            } else {
                let open_attr = if fold == "+" { " open" } else { "" };
                transformed.push_str(&format!(
                    "<details class=\"note-callout note-callout-{kind}\" data-callout=\"{kind}\"{open}><summary class=\"note-callout-title\">{title}</summary><div class=\"note-callout-body\">{body}</div></details>",
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

fn detect_rich_note_content_classes(markdown_html: &str) -> Vec<&'static str> {
    let mut classes = Vec::new();

    let mut push = |class_name: &'static str| {
        if !classes.contains(&class_name) {
            classes.push(class_name);
        }
    };

    if markdown_html.contains("note-callout") {
        push("note-has-callouts");
    }

    if markdown_html.contains("mermaid-render") || markdown_html.contains("plantuml-embed") {
        push("note-has-diagrams");
    }

    if markdown_html.contains("note-pdf-embed")
        || markdown_html.contains("note-excalidraw-embed")
        || markdown_html.contains("note-canvas-embed")
    {
        push("note-has-embeds");
    }

    if markdown_html.contains("profile-publication-wrap")
        || markdown_html.contains("profile-link-grid")
        || markdown_html.contains("profile-publication-widget")
    {
        push("note-has-publication-widget");
    }

    classes
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
            h2 data-pretext-target="" { (site_text.backlinks_heading) }
            @if backlinks.is_empty() {
                p class="backlinks-empty" data-pretext-target="" { (site_text.backlinks_empty) }
            } @else {
                p class="backlinks-meta" data-pretext-target="" {
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
        .into_keys()
        .map(|name| TagEntry {
            slug: slugify(&name),
            name,
        })
        .collect()
}

fn post_to_card(post: &Post) -> PostCard {
    PostCard {
        note_icon: post.note_icon.clone(),
        title: post.title.clone(),
        url: format!("/notes/{}/", post.slug),
        description: post.description.clone(),
        excerpt: post.excerpt.clone(),
        folder_label: display_section_name_from_slug(&post.slug),
        path_label: post.source_rel_path.clone(),
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
            })
            .collect(),
    }
}

fn build_home_news_spotlight(news: NewsHubData) -> Option<HomeNewsSpotlight> {
    let url = resolve_news_digest_url(&news);
    let summary = if news.summary.trim().is_empty() {
        "Daily repo, paper, and community signal digest.".to_string()
    } else {
        news.summary.trim().to_string()
    };
    let issue_label = if news.issue_label.trim().is_empty() {
        news.archives
            .first()
            .map(|entry| entry.date_label.clone())
            .filter(|label| !label.trim().is_empty())
            .unwrap_or_else(|| "Current issue".to_string())
    } else {
        news.issue_label.trim().to_string()
    };
    if url.trim().is_empty() && summary.trim().is_empty() {
        return None;
    }

    Some(HomeNewsSpotlight {
        issue_label,
        summary,
        url,
    })
}

fn resolve_news_digest_url(news: &NewsHubData) -> String {
    if !news.digest.url.trim().is_empty() {
        return news.digest.url.trim().to_string();
    }

    news.archives
        .first()
        .map(|entry| entry.url.trim().to_string())
        .filter(|url| !url.is_empty())
        .unwrap_or_else(|| "/news/".to_string())
}

fn display_section_name_from_slug(slug: &str) -> String {
    slug.split('/')
        .next()
        .filter(|segment| !segment.trim().is_empty() && *segment != slug)
        .map(humanize_slug_segment)
        .unwrap_or_else(|| "Note".to_string())
}

fn humanize_slug_segment(segment: &str) -> String {
    segment
        .split(['-', '_'])
        .filter(|part| !part.trim().is_empty())
        .map(|part| {
            let mut characters = part.chars();
            match characters.next() {
                Some(first) => {
                    let mut label = first.to_uppercase().collect::<String>();
                    label.push_str(&characters.as_str().to_lowercase());
                    label
                }
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn is_news_digest_post(post: &Post) -> bool {
    post.slug.starts_with("news/")
        || post
            .tags
            .iter()
            .any(|tag| tag.eq_ignore_ascii_case("news-digest"))
}

#[allow(clippy::too_many_arguments)]
fn website_layout(
    config: &BuildConfig,
    posts: &[Post],
    theme_assets: &ThemeAssets,
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
    asset_version: &str,
) -> LayoutContext {
    let canonical_url = absolute_url(&config.site.base_url, page_path);
    let social_image_url =
        resolve_social_image_url(&config.site.base_url, &config.site.social_image);
    let page_description = normalize_page_description(page_description, &config.site.title);

    LayoutContext {
        body_class: body_class_for_path(page_path).to_string(),
        site_title: config.site.title.clone(),
        site_description: config.site.description.clone(),
        site_url: normalize_base_url(&config.site.base_url),
        lang: config.site.language.clone(),
        page_title,
        page_description,
        canonical_url: canonical_url.clone(),
        page_url: canonical_url,
        social_image_url,
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
        obsidian_theme_css_url: theme_assets.obsidian_theme_css_url.clone(),
        style_settings_css_url: theme_assets.style_settings_css_url.clone(),
        user_overrides_css_url: theme_assets.user_overrides_css_url.clone(),
        style_settings_inline_css: theme_assets.style_settings_inline_css.clone(),
        show_search,
        show_graph_module,
        graph_data_url,
        graph_center_id,
        show_side_graph,
        asset_version: asset_version.to_string(),
    }
}

fn body_class_for_path(page_path: &str) -> &'static str {
    if page_path == "/" {
        "page-home"
    } else if page_path == "/graph/" {
        "page-graph"
    } else if page_path.starts_with("/tags/") {
        "page-tag"
    } else if page_path == "/404.html" || page_path.starts_with("/notes/ghost-note") {
        "page-system"
    } else if page_path.starts_with("/notes/") {
        "page-note"
    } else {
        "page-site"
    }
}

fn asset_version_token() -> String {
    let git_hash = Command::new("git")
        .args(["rev-parse", "--short=12", "HEAD"])
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| {
            let hash = String::from_utf8_lossy(&output.stdout).trim().to_string();
            (!hash.is_empty()).then_some(hash)
        });

    git_hash.unwrap_or_else(|| Utc::now().format("%Y%m%d%H%M%S").to_string())
}

fn normalize_page_description(value: String, fallback: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        fallback.to_string()
    } else {
        trimmed.to_string()
    }
}

fn build_page_tabs(posts: &[Post], page_path: &str) -> Vec<PageTab> {
    let mut visible_posts = posts
        .iter()
        .filter(|post| !post.hidden && !is_news_digest_post(post))
        .collect::<Vec<_>>();

    visible_posts.sort_by(|a, b| match (a.is_home, b.is_home) {
        (true, false) => Ordering::Less,
        (false, true) => Ordering::Greater,
        _ => sort_posts_by_recency(a, b),
    });

    visible_posts
        .into_iter()
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

fn embedded_news_site_dir() -> PathBuf {
    PathBuf::from("vendor/blog_news/site")
}

fn embedded_news_site_available() -> bool {
    embedded_news_site_dir().join("index.html").exists()
}

fn generated_news_hub_data_path() -> PathBuf {
    PathBuf::from("content/generated/news/latest.json")
}

fn news_page_available() -> bool {
    embedded_news_site_available() || generated_news_hub_data_path().exists()
}

fn load_generated_news_hub_data(posts: &[Post]) -> Result<Option<NewsHubData>> {
    let path = generated_news_hub_data_path();
    if !path.exists() {
        return Ok(None);
    }

    let raw = fs::read_to_string(&path)
        .with_context(|| format!("failed to read generated news hub data {}", path.display()))?;
    let mut news: NewsHubData = serde_json::from_str(&raw)
        .with_context(|| format!("failed to parse generated news hub data {}", path.display()))?;
    let archive_by_url = news
        .archives
        .iter()
        .map(|entry| (entry.url.clone(), entry.clone()))
        .collect::<HashMap<_, _>>();

    let mut archives = posts
        .iter()
        .filter(|post| is_news_digest_post(post))
        .map(|post| {
            let url = format!("/notes/{}/", post.slug);
            let fallback = archive_by_url.get(&url);
            NewsArchiveEntry {
                url,
                date_label: post
                    .date
                    .map(|date| date.format("%Y-%m-%d").to_string())
                    .or_else(|| fallback.map(|entry| entry.date_label.clone()))
                    .unwrap_or_else(|| "Undated".to_string()),
                description: if !post.description.trim().is_empty() {
                    post.description.clone()
                } else {
                    fallback
                        .map(|entry| entry.description.clone())
                        .filter(|description| !description.trim().is_empty())
                        .unwrap_or_else(|| post.excerpt.clone())
                },
            }
        })
        .collect::<Vec<_>>();
    archives.sort_by(|a, b| b.date_label.cmp(&a.date_label));
    if !archives.is_empty() {
        news.archives = archives.into_iter().take(8).collect();
    }

    Ok(Some(news))
}

fn rewrite_embedded_news_html(input: &str) -> String {
    let rewritten = input
        .replace("href='/data/", "href='/news/data/")
        .replace("href=\"/data/", "href=\"/news/data/")
        .replace("src='/assets/", "src='/news/assets/")
        .replace("src=\"/assets/", "src=\"/news/assets/")
        .replace("this.src='/assets/", "this.src='/news/assets/")
        .replace("this.src=\"/assets/", "this.src=\"/news/assets/");

    let head_injection = concat!(
        "<link rel='icon' type='image/svg+xml' href='/favicon.svg'>",
        "<link rel='stylesheet' href='/assets/style-news-bridge.css'>"
    );
    let with_head = if rewritten.contains("style-news-bridge.css") {
        rewritten
    } else {
        rewritten.replacen("</head>", &format!("{head_injection}</head>"), 1)
    };

    let bridge_bar = concat!(
        "<div class='news-bridge-bar'>",
        "<a class='news-bridge-brand' href='/'>",
        "<p class='news-bridge-kicker'>Connected Notes</p>",
        "<p class='news-bridge-title'>Mud's Blog</p>",
        "</a>",
        "<div class='news-bridge-links'>",
        "<a class='news-bridge-link news-bridge-link--primary' href='/news/'>News Radar</a>",
        "<a class='news-bridge-link' href='/'>Notes</a>",
        "<a class='news-bridge-link' href='/graph/'>Graph</a>",
        "<a class='news-bridge-link' href='/news/data/latest.json' target='_blank' rel='noreferrer'>JSON</a>",
        "</div>",
        "</div>"
    );

    if with_head.contains("news-bridge-bar") {
        with_head
    } else {
        with_head.replacen("<body>", &format!("<body>{bridge_bar}"), 1)
    }
}

fn compact_embedded_news_payload(raw: &str) -> Result<String> {
    let payload: serde_json::Value =
        serde_json::from_str(raw).with_context(|| "failed to parse embedded news payload")?;

    let paper_count = payload
        .get("papers")
        .and_then(|value| value.as_array())
        .map(|items| items.len())
        .unwrap_or(0);

    let compact = json!({
        "generatedAt": payload.get("generatedAt").cloned().unwrap_or(serde_json::Value::Null),
        "errors": payload
            .get("errors")
            .cloned()
            .unwrap_or_else(|| serde_json::Value::Array(Vec::new())),
        "all": payload
            .get("all")
            .cloned()
            .unwrap_or_else(|| serde_json::Value::Array(Vec::new())),
        "sourceCounts": payload
            .get("sourceCounts")
            .cloned()
            .unwrap_or_else(|| serde_json::Value::Object(Default::default())),
        "paperCount": paper_count,
    });

    let mut body = serde_json::to_string(&compact)
        .with_context(|| "failed to serialize embedded news payload")?;
    body.push('\n');
    Ok(body)
}

fn copy_embedded_news_site(output_dir: &Path) -> Result<()> {
    let news_site_dir = embedded_news_site_dir();
    if !news_site_dir.exists() {
        return Ok(());
    }

    let news_output_dir = output_dir.join("news");

    for entry in WalkDir::new(&news_site_dir)
        .into_iter()
        .filter_map(|entry| entry.ok())
    {
        let entry_path = entry.path();
        let rel = entry_path.strip_prefix(&news_site_dir).with_context(|| {
            format!(
                "failed to create relative path for {} from {}",
                entry_path.display(),
                news_site_dir.display()
            )
        })?;

        if rel.as_os_str().is_empty() {
            continue;
        }

        let dest = news_output_dir.join(rel);

        if entry.file_type().is_dir() {
            fs::create_dir_all(&dest)
                .with_context(|| format!("failed to create {}", dest.display()))?;
            continue;
        }

        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)
                .with_context(|| format!("failed to create {}", parent.display()))?;
        }

        let extension = entry_path
            .extension()
            .and_then(|ext| ext.to_str())
            .map(str::to_ascii_lowercase);

        match extension.as_deref() {
            Some("html") | Some("htm") => {
                let html = fs::read_to_string(entry_path).with_context(|| {
                    format!("failed to read embedded news page {}", entry_path.display())
                })?;
                write_file(dest, rewrite_embedded_news_html(&html))?;
            }
            Some("json") if rel == Path::new("data/latest.json") => {
                let raw = fs::read_to_string(entry_path).with_context(|| {
                    format!(
                        "failed to read embedded news payload {}",
                        entry_path.display()
                    )
                })?;
                write_file(dest, compact_embedded_news_payload(&raw)?)?;
            }
            _ => {
                fs::copy(entry_path, &dest).with_context(|| {
                    format!(
                        "failed to copy embedded news asset {} to {}",
                        entry_path.display(),
                        dest.display()
                    )
                })?;
            }
        }
    }

    Ok(())
}

fn minify_css(input: &str) -> String {
    let mut stylesheet = match CssStyleSheet::parse(input, CssParserOptions::default()) {
        Ok(stylesheet) => stylesheet,
        Err(_) => return input.to_string(),
    };

    if stylesheet.minify(CssMinifyOptions::default()).is_err() {
        return input.to_string();
    }

    match stylesheet.to_css(CssPrinterOptions {
        minify: true,
        ..CssPrinterOptions::default()
    }) {
        Ok(result) if result.code.len() < input.len() => result.code,
        Err(_) => input.to_string(),
        _ => input.to_string(),
    }
}

fn minify_javascript(input: &str) -> String {
    let previous_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(|_| {}));
    let output = catch_unwind(AssertUnwindSafe(|| {
        let session = JsMinifierSession::new();
        let mut out = Vec::with_capacity(input.len());
        if minify_javascript_bytes(&session, TopLevelMode::Global, input.as_bytes(), &mut out)
            .is_err()
        {
            return None;
        }
        String::from_utf8(out).ok()
    }));
    std::panic::set_hook(previous_hook);

    match output {
        Ok(Some(minified)) if minified.len() < input.len() => minified,
        _ => input.to_string(),
    }
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

            let extension = entry_path
                .extension()
                .and_then(|ext| ext.to_str())
                .map(str::to_ascii_lowercase);

            match extension.as_deref() {
                Some("css") => {
                    let css = fs::read_to_string(entry_path).with_context(|| {
                        format!("failed to read CSS asset {}", entry_path.display())
                    })?;
                    let minified = minify_css(&css);
                    fs::write(&dest, minified).with_context(|| {
                        format!(
                            "failed to write minified CSS from {} to {}",
                            entry_path.display(),
                            dest.display()
                        )
                    })?;
                }
                Some("js") => {
                    let javascript = fs::read_to_string(entry_path).with_context(|| {
                        format!("failed to read JS asset {}", entry_path.display())
                    })?;
                    let minified = minify_javascript(&javascript);
                    fs::write(&dest, minified).with_context(|| {
                        format!(
                            "failed to write minified JS from {} to {}",
                            entry_path.display(),
                            dest.display()
                        )
                    })?;
                }
                _ => {
                    fs::copy(entry_path, &dest).with_context(|| {
                        format!(
                            "failed to copy {} to {}",
                            entry_path.display(),
                            dest.display()
                        )
                    })?;
                }
            }
        }
    }

    Ok(())
}

fn ensure_default_css(output_dir: &Path) -> Result<()> {
    let css_path = output_dir.join("assets").join("style-core.css");
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

    fs::write(&css_path, minify_css(default_css))
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
            for token in raw.split([',', '\n']) {
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
        format!("{}…", excerpt.trim_end())
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

fn resolve_social_image_url(base_url: &str, value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return absolute_url(base_url, "/og-image.png");
    }

    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_string()
    } else {
        absolute_url(base_url, trimmed)
    }
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

        assert!(html.contains(r#"details class="note-callout note-callout-warning""#));
        assert!(html.contains(r#"summary class="note-callout-title">Safety</summary>"#));
        assert!(html.contains("Read this first."));
    }

    #[test]
    fn markdown_to_html_adds_default_alt_to_raw_html_images() {
        let html = markdown_to_html(
            r#"
<img src="https://img.shields.io/badge/GitHub-181717?style=flat-square&logo=GitHub&logoColor=white"/>
"#,
        );

        assert!(html.contains(r#"loading="lazy""#));
        assert!(html.contains(r#"decoding="async""#));
        assert!(html.contains(r#"alt="""#));
    }

    #[test]
    fn markdown_to_html_preserves_existing_image_alt_text() {
        let html = markdown_to_html(
            r#"
![GitHub Badge](https://img.shields.io/badge/GitHub-181717?style=flat-square&logo=GitHub&logoColor=white)
"#,
        );

        assert!(html.contains(r#"alt="GitHub Badge""#));
        assert!(html.contains(r#"loading="lazy""#));
        assert!(html.contains(r#"decoding="async""#));
    }

    #[test]
    fn rewrite_relative_image_asset_urls_resolves_note_local_assets() {
        let html = markdown_to_html(
            r#"
![Local A](./assets/diagram-a.svg)
![Local B](assets/diagram-b.png?raw=1)
![Local C](../shared/diagram-c.webp#v1)
![Absolute](/content/papers/assets/diagram-d.png)
"#,
        );
        let rewritten = rewrite_relative_image_asset_urls(&html, "papers/uhlm-2412-12687.md");

        assert!(rewritten.contains(r#"src="/content/papers/assets/diagram-a.svg""#));
        assert!(rewritten.contains(r#"src="/content/papers/assets/diagram-b.png?raw=1""#));
        assert!(rewritten.contains(r#"src="/content/shared/diagram-c.webp#v1""#));
        assert!(rewritten.contains(r#"src="/content/papers/assets/diagram-d.png""#));
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
    fn load_and_apply_regex_filters_from_static_dir() -> Result<()> {
        let tmp = TestDir::new("regex-filters");
        let static_dir = tmp.path.join("static");
        write_text(
            &static_dir.join("regex-filters.json"),
            r#"[{"pattern":"Alpha","replace":"Beta"},{"pattern":"\\bWorld\\b","replace":"Garden"}]"#,
        );

        let filters = load_regex_filters(&static_dir)?;
        assert_eq!(filters.len(), 2);

        let rendered = apply_custom_regex_filters("Alpha World", &filters);
        assert_eq!(rendered, "Beta Garden");

        Ok(())
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
        assert!(html.contains("note-pdf-embed"));
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
    fn apply_dataview_inline_supports_this_file_fields_and_pages_length() {
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
        let current_tags = vec!["intro".to_string(), "daily".to_string()];
        let rendered = apply_dataview_inline(
            "Name: `= this.file.name`\nLink: `= this.file.link`\nPath: `= this.file.path`\nFolder: `= this.file.folder`\nTags: `= this.file.tags`\nCount: `= dv.pages(\"#seo\").length`",
            &seeds,
            "journal/home",
            "Home",
            &current_tags,
        );

        assert!(rendered.contains("Name: Home"));
        assert!(rendered.contains("Link: [Home](/notes/journal/home/)"));
        assert!(rendered.contains("Path: journal/home"));
        assert!(rendered.contains("Folder: journal"));
        assert!(rendered.contains("Tags: #intro, #daily"));
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
        let rendered = apply_dataview_blocks(
            "```dataview\nLIST FROM #seo\n```",
            &seeds,
            "home",
            DataviewJsMode::Disabled,
        );

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
        let rendered = apply_dataview_blocks(
            "```dataview\nTABLE FROM #seo\n```",
            &seeds,
            "home",
            DataviewJsMode::Disabled,
        );

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
        let rendered = apply_dataview_blocks(
            "```dataview\nTASK FROM #seo\n```",
            &seeds,
            "home",
            DataviewJsMode::Disabled,
        );

        assert!(rendered.contains("Query: `TASK FROM #seo`"));
        assert!(rendered.contains("- [ ] [SEO Task](/notes/seo-note/)"));
    }

    #[test]
    fn apply_dataview_blocks_renders_dataviewjs_in_tag_pages_mode() {
        let seeds = vec![
            SeedSummary {
                slug: "home".to_string(),
                title: "Home".to_string(),
                tags: vec!["intro".to_string()],
            },
            SeedSummary {
                slug: "alpha-seo".to_string(),
                title: "Alpha SEO".to_string(),
                tags: vec!["seo".to_string()],
            },
            SeedSummary {
                slug: "beta-seo".to_string(),
                title: "Beta SEO".to_string(),
                tags: vec!["seo".to_string()],
            },
        ];

        let rendered = apply_dataview_blocks(
            "```dataviewjs\ndv.list(dv.pages(\"#seo\").map(p => p.file.link))\n```",
            &seeds,
            "home",
            DataviewJsMode::TagPages,
        );

        assert!(rendered.contains("Rendered in safe mode"));
        assert!(rendered.contains("[Alpha SEO](/notes/alpha-seo/)"));
        assert!(rendered.contains("[Beta SEO](/notes/beta-seo/)"));
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
            DataviewJsMode::Disabled,
        );

        assert!(rendered.contains(
            "Query: `LIST FROM #seo ; WHERE contains(title, \"seo\") ; SORT title DESC ; LIMIT 1`"
        ));
        assert!(rendered.contains("- [Beta SEO](/notes/beta/)"));
        assert!(!rendered.contains("/notes/alpha/"));
    }

    #[test]
    fn apply_dataview_blocks_supports_folder_sources_and_file_path_where() {
        let seeds = vec![
            SeedSummary {
                slug: "home".to_string(),
                title: "Home".to_string(),
                tags: vec!["intro".to_string()],
            },
            SeedSummary {
                slug: "blog/alpha".to_string(),
                title: "Alpha SEO".to_string(),
                tags: vec!["seo".to_string()],
            },
            SeedSummary {
                slug: "blog/zeta".to_string(),
                title: "Zeta Rust".to_string(),
                tags: vec!["rust".to_string()],
            },
            SeedSummary {
                slug: "journal/seo-log".to_string(),
                title: "SEO Journal".to_string(),
                tags: vec!["seo".to_string()],
            },
        ];
        let rendered = apply_dataview_blocks(
            "```dataview\nLIST FROM \"blog\"\nWHERE contains(file.path, \"alpha\")\nSORT file.path DESC\n```",
            &seeds,
            "home",
            DataviewJsMode::Disabled,
        );

        assert!(rendered.contains("Query: `LIST FROM \"blog\" ; WHERE contains(file.path, \"alpha\") ; SORT file.path DESC`"));
        assert!(rendered.contains("- [Alpha SEO](/notes/blog/alpha/)"));
        assert!(!rendered.contains("/notes/blog/zeta/"));
        assert!(!rendered.contains("/notes/journal/seo-log/"));
    }

    #[test]
    fn apply_dataview_blocks_renders_dataviewjs_for_folder_sources_in_tag_pages_mode() {
        let seeds = vec![
            SeedSummary {
                slug: "home".to_string(),
                title: "Home".to_string(),
                tags: vec!["intro".to_string()],
            },
            SeedSummary {
                slug: "blog/alpha".to_string(),
                title: "Alpha".to_string(),
                tags: vec!["seo".to_string()],
            },
            SeedSummary {
                slug: "blog/beta".to_string(),
                title: "Beta".to_string(),
                tags: vec!["seo".to_string()],
            },
            SeedSummary {
                slug: "notes/gamma".to_string(),
                title: "Gamma".to_string(),
                tags: vec!["seo".to_string()],
            },
        ];
        let rendered = apply_dataview_blocks(
            "```dataviewjs\ndv.list(dv.pages(\"blog\").map(p => p.file.link))\n```",
            &seeds,
            "home",
            DataviewJsMode::TagPages,
        );

        assert!(rendered.contains("Rendered in safe mode"));
        assert!(rendered.contains("dv.pages(\"blog\")"));
        assert!(rendered.contains("[Alpha](/notes/blog/alpha/)"));
        assert!(rendered.contains("[Beta](/notes/blog/beta/)"));
        assert!(!rendered.contains("/notes/notes/gamma/"));
    }

    #[test]
    fn apply_dataview_inline_supports_pages_length_for_folder_sources() {
        let seeds = vec![
            SeedSummary {
                slug: "home".to_string(),
                title: "Home".to_string(),
                tags: vec!["intro".to_string()],
            },
            SeedSummary {
                slug: "blog/alpha".to_string(),
                title: "Alpha".to_string(),
                tags: vec!["seo".to_string()],
            },
            SeedSummary {
                slug: "blog/beta".to_string(),
                title: "Beta".to_string(),
                tags: vec!["seo".to_string()],
            },
            SeedSummary {
                slug: "journal/gamma".to_string(),
                title: "Gamma".to_string(),
                tags: vec!["daily".to_string()],
            },
        ];
        let rendered = apply_dataview_inline(
            "Blog count: `= dv.pages(\"blog\").length`",
            &seeds,
            "home",
            "Home",
            &["intro".to_string()],
        );

        assert!(rendered.contains("Blog count: 2"));
    }

    #[test]
    fn apply_dataview_blocks_supports_where_and_equals_startswith() {
        let seeds = vec![
            SeedSummary {
                slug: "home".to_string(),
                title: "Home".to_string(),
                tags: vec!["intro".to_string()],
            },
            SeedSummary {
                slug: "blog/alpha".to_string(),
                title: "Alpha SEO".to_string(),
                tags: vec!["seo".to_string()],
            },
            SeedSummary {
                slug: "blog/beta".to_string(),
                title: "Beta SEO".to_string(),
                tags: vec!["seo".to_string()],
            },
            SeedSummary {
                slug: "docs/alpha".to_string(),
                title: "Docs Alpha".to_string(),
                tags: vec!["seo".to_string()],
            },
        ];
        let rendered = apply_dataview_blocks(
            "```dataview\nLIST FROM #seo\nWHERE startswith(file.path, \"blog\") AND file.name = \"alpha\"\n```",
            &seeds,
            "home",
            DataviewJsMode::Disabled,
        );

        assert!(rendered.contains("- [Alpha SEO](/notes/blog/alpha/)"));
        assert!(!rendered.contains("/notes/blog/beta/"));
        assert!(!rendered.contains("/notes/docs/alpha/"));
    }

    #[test]
    fn apply_dataview_blocks_supports_table_columns_and_alias() {
        let seeds = vec![
            SeedSummary {
                slug: "home".to_string(),
                title: "Home".to_string(),
                tags: vec!["intro".to_string()],
            },
            SeedSummary {
                slug: "blog/alpha".to_string(),
                title: "Alpha SEO".to_string(),
                tags: vec!["seo".to_string(), "rust".to_string()],
            },
        ];
        let rendered = apply_dataview_blocks(
            "```dataview\nTABLE file.link AS \"Note\", file.path, file.tags FROM #seo\n```",
            &seeds,
            "home",
            DataviewJsMode::Disabled,
        );

        assert!(rendered.contains("| Note | Path | Tags |"));
        assert!(rendered.contains("[Alpha SEO](/notes/blog/alpha/)"));
        assert!(rendered.contains("blog/alpha"));
        assert!(rendered.contains("#seo"));
    }

    #[test]
    fn apply_dataview_blocks_supports_note_sources() {
        let seeds = vec![
            SeedSummary {
                slug: "home".to_string(),
                title: "Home".to_string(),
                tags: vec!["intro".to_string()],
            },
            SeedSummary {
                slug: "blog/alpha".to_string(),
                title: "Alpha".to_string(),
                tags: vec!["seo".to_string()],
            },
            SeedSummary {
                slug: "blog/beta".to_string(),
                title: "Beta".to_string(),
                tags: vec!["seo".to_string()],
            },
        ];
        let rendered = apply_dataview_blocks(
            "```dataview\nLIST FROM [[blog/alpha]]\n```",
            &seeds,
            "home",
            DataviewJsMode::Disabled,
        );

        assert!(rendered.contains("[Alpha](/notes/blog/alpha/)"));
        assert!(!rendered.contains("/notes/blog/beta/"));
    }

    #[test]
    fn apply_dataview_blocks_renders_dataviewjs_with_where_sort_limit_and_table_columns() {
        let seeds = vec![
            SeedSummary {
                slug: "home".to_string(),
                title: "Home".to_string(),
                tags: vec!["intro".to_string()],
            },
            SeedSummary {
                slug: "blog/alpha".to_string(),
                title: "Alpha".to_string(),
                tags: vec!["seo".to_string()],
            },
            SeedSummary {
                slug: "blog/beta".to_string(),
                title: "Beta".to_string(),
                tags: vec!["seo".to_string()],
            },
            SeedSummary {
                slug: "blog/gamma".to_string(),
                title: "Gamma".to_string(),
                tags: vec!["dev".to_string()],
            },
        ];
        let rendered = apply_dataview_blocks(
            "```dataviewjs\ndv.table([\"Note\", \"Path\"], dv.pages(\"blog\").where(p => p.file.path.includes(\"a\")).sort(p => p.file.path, \"desc\").limit(1).map(p => [p.file.link, p.file.path]))\n```",
            &seeds,
            "home",
            DataviewJsMode::TagPages,
        );

        assert!(rendered.contains("Rendered in safe mode"));
        assert!(rendered.contains("| Note | Path |"));
        assert!(rendered.contains("[Gamma](/notes/blog/gamma/)"));
        assert!(!rendered.contains("/notes/blog/alpha/"));
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
    fn normalize_page_description_uses_fallback_for_empty_values() {
        assert_eq!(
            normalize_page_description(String::new(), "Mud's Blog"),
            "Mud's Blog"
        );
        assert_eq!(
            normalize_page_description("   ".to_string(), "Mud's Blog"),
            "Mud's Blog"
        );
        assert_eq!(
            normalize_page_description("  Custom description  ".to_string(), "Mud's Blog"),
            "Custom description"
        );
    }

    #[test]
    fn resolve_social_image_url_supports_relative_and_absolute_inputs() {
        assert_eq!(
            resolve_social_image_url("mud-blog.pages.dev/", "/og-image.png"),
            "https://mud-blog.pages.dev/og-image.png"
        );
        assert_eq!(
            resolve_social_image_url("mud-blog.pages.dev/", "assets/preview.png"),
            "https://mud-blog.pages.dev/assets/preview.png"
        );
        assert_eq!(
            resolve_social_image_url("mud-blog.pages.dev/", "https://cdn.example.com/cover.png"),
            "https://cdn.example.com/cover.png"
        );
    }

    #[test]
    fn file_tree_folder_icons_maps_common_workspace_folders() {
        assert_eq!(
            file_tree_folder_icons("blog"),
            ("folder-content.svg", "folder-content-open.svg")
        );
        assert_eq!(
            file_tree_folder_icons(".github"),
            ("folder-github.svg", "folder-github-open.svg")
        );
        assert_eq!(
            file_tree_folder_icons("workflows"),
            ("folder-gh-workflows.svg", "folder-gh-workflows-open.svg")
        );
        assert_eq!(
            file_tree_folder_icons("scripts"),
            ("folder-scripts.svg", "folder-scripts-open.svg")
        );
        assert_eq!(
            file_tree_folder_icons("tests"),
            ("folder-test.svg", "folder-test-open.svg")
        );
    }

    #[test]
    fn file_tree_note_icon_maps_keywords_and_extensions() {
        assert_eq!(file_tree_note_icon("about_me.md"), "bibliography.svg");
        assert_eq!(
            file_tree_note_icon("github-cloudflare-pipeline.md"),
            "rocket.svg"
        );
        assert_eq!(
            file_tree_note_icon("seo-performance-guide.md"),
            "lighthouse.svg"
        );
        assert_eq!(file_tree_note_icon("api-design.md"), "graphql.svg");
        assert_eq!(file_tree_note_icon("schema.json"), "json.svg");
        assert_eq!(file_tree_note_icon("architecture.mermaid"), "mermaid.svg");
        assert_eq!(file_tree_note_icon("diagram.excalidraw"), "excalidraw.svg");
        assert_eq!(file_tree_note_icon("README.md"), "readme.svg");
        assert_eq!(file_tree_note_icon("project.v1"), "markdown.svg");
        assert_eq!(file_tree_note_icon("team.sync.2026"), "markdown.svg");
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
note-publish: true
note-home: true
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
note-publish: true
note-pinned: true
note-metatags:
  - robots=max-image-preview:large
  - og:locale=ko_KR
note-content-classes: [focus-mode, article-featured]
note-experimental: true
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
note-publish: true
note-hide-in-graph: true
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
note-publish: true
note-enable-search: false
note-show-local-graph: false
note-hide: true
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
note-publish: true
note-path: custom/path-note
note-icon: "PIN"
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
note-publish: true
note-enable-search: false
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
note-publish: false
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
            &static_dir.join("obsidian-theme.css"),
            ":root { --obsidian-accent: #4d7ca8; }\n",
        );
        write_text(
            &static_dir.join("style-settings.css"),
            ".note { letter-spacing: 0.01em; }\n",
        );
        write_text(
            &static_dir.join("user-overrides.css"),
            ".site-title { text-transform: none; }\n",
        );
        write_text(
            &static_dir.join("style-settings.json"),
            r##"{
  "root": { "--note-accent": "#2c6fa8" },
  "dark": { "--bg": "#101820", "--text": "#e7edf4" }
}"##,
        );
        write_text(
            &static_dir.join("assets/pretext-runtime.mjs"),
            "export const fixture = true;\n",
        );
        write_text(
            &static_dir.join("assets/vendor/pretext/layout.mjs"),
            "export const fixture = true;\n",
        );
        write_text(
            &static_dir.join("assets/pretext-masonry.mjs"),
            "export const fixture = true;\n",
        );
        write_text(
            &static_dir.join("assets/pretext-note-web.mjs"),
            "export const fixture = true;\n",
        );
        write_text(
            &static_dir.join("assets/pretext-dragon-reflow.mjs"),
            "export const fixture = true;\n",
        );
        write_text(
            &static_dir.join("assets/style-editorial.css"),
            ":root { --fixture-editorial: 1; }\n",
        );
        write_text(
            &static_dir.join("assets/style-home-editorial.css"),
            ".fixture-home { display: block; }\n",
        );
        write_text(
            &static_dir.join("assets/style-note-editorial.css"),
            ".fixture-note { display: block; }\n",
        );
        write_text(
            &static_dir.join("assets/style-collection-editorial.css"),
            ".fixture-collection { display: block; }\n",
        );
        write_text(
            &static_dir.join("assets/style-graph-editorial.css"),
            ".fixture-graph { display: block; }\n",
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
            publish_policy: PublishPolicy::OptIn,
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
        assert!(output_dir.join("assets/pretext-runtime.mjs").exists());
        assert!(output_dir.join("assets/vendor/pretext/layout.mjs").exists());
        assert!(output_dir.join("assets/pretext-masonry.mjs").exists());
        assert!(output_dir.join("assets/pretext-note-web.mjs").exists());
        assert!(output_dir.join("assets/pretext-dragon-reflow.mjs").exists());
        assert!(output_dir.join("assets/style-editorial.css").exists());
        assert!(output_dir.join("assets/style-home-editorial.css").exists());
        assert!(output_dir.join("assets/style-note-editorial.css").exists());
        assert!(output_dir
            .join("assets/style-collection-editorial.css")
            .exists());
        assert!(output_dir.join("assets/style-graph-editorial.css").exists());
        assert!(output_dir.join("tags/architecture/index.html").exists());
        assert!(!output_dir.join("notes/draft-note/index.html").exists());
        assert!(!output_dir.join("notes/hidden-note/index.html").exists());
        assert!(!output_dir.join("notes/no-flag/index.html").exists());
        assert!(output_dir.join("graph/index.html").exists());
        assert!(output_dir.join("404.html").exists());
        assert!(output_dir.join("obsidian-theme.css").exists());
        assert!(output_dir.join("style-settings.css").exists());
        assert!(output_dir.join("user-overrides.css").exists());

        let index_html = fs::read_to_string(output_dir.join("index.html"))?;
        assert!(index_html.contains(r#"rel="canonical" href="https://example.test/""#));
        assert!(index_html
            .contains(r#"property="og:image" content="https://example.test/og-image.png""#));
        assert!(index_html
            .contains(r#"name="twitter:image" content="https://example.test/og-image.png""#));
        assert!(index_html.contains(r#"href="/obsidian-theme.css""#));
        assert!(index_html.contains(r#"href="/style-settings.css""#));
        assert!(index_html.contains(r#"href="/user-overrides.css""#));
        assert!(index_html.contains(":root{--note-accent:#2c6fa8;}"));
        assert!(index_html.contains(r#"[data-theme="dark"]{--bg:#101820;--text:#e7edf4;}"#));
        assert!(index_html.contains(r#"src="/assets/pretext-runtime.mjs?v="#));
        assert!(index_html.contains(r#"href="/assets/style-editorial.css?v="#));
        assert!(index_html.contains(r#"src="/assets/site-runtime.js""#));
        assert!(index_html.contains(r#"src="/assets/pretext-note-web.mjs?v="#));
        assert!(index_html.contains("window.__BLOG_RUNTIME_CONFIG__"));
        assert!(index_html.contains("graphDataUrl:"));
        assert!(index_html.contains("/graph.json"));
        assert!(index_html.contains("note-icon"));
        assert!(index_html.contains("data-pretext-target"));
        assert!(!index_html.contains("Isolated"));

        let home_html = fs::read_to_string(output_dir.join("notes/home/index.html"))?;
        assert!(home_html.contains("/notes/second-brain/#architecture-overview"));
        assert!(home_html.contains("/notes/ghost-note/"));
        assert!(home_html.contains("graphDataUrl:"));
        assert!(home_html.contains("/local-graph/home.json"));
        assert!(home_html.contains("Embedded from"));
        assert!(home_html.contains("self alias"));

        let second_html = fs::read_to_string(output_dir.join("notes/second-brain/index.html"))?;
        assert!(second_html.contains(r#"id="architecture-overview""#));
        assert!(second_html.contains("On This Page"));
        assert!(second_html.contains("href=\"#architecture-overview\""));
        assert!(second_html.contains("Linked Mentions"));
        assert!(second_html.contains("/notes/home/"));
        assert!(second_html.contains("graphDataUrl:"));
        assert!(second_html.contains("/local-graph/second-brain.json"));
        assert!(second_html.contains("note-callout-tip"));
        assert!(second_html.contains("Quick Tip"));
        assert!(second_html.contains("graph TD"));
        assert!(second_html.contains("plantuml-embed"));
        assert!(second_html.contains("plantuml.com/plantuml/svg/~h"));
        assert!(second_html.contains("$E=mc^2$"));
        assert!(second_html.contains("note-pdf-embed"));
        assert!(second_html.contains("Guide PDF"));
        assert!(second_html.contains("/content/attachments/spec.pdf"));
        assert!(second_html.contains("note-excalidraw-embed"));
        assert!(second_html.contains("/content/attachments/diagram.excalidraw"));
        assert!(
            second_html.contains("data-excalidraw-src=\"/content/attachments/diagram.excalidraw\"")
        );
        assert!(second_html.contains("note-canvas-embed"));
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
        assert!(second_html.contains(r#"class="panel note-shell "#));
        assert!(second_html.contains("focus-mode"));
        assert!(second_html.contains("article-featured"));

        assert!(!index_html.contains(r#"id="side-graph-stage""#));
        assert!(index_html.contains(r#"src="/assets/pretext-note-web.mjs?v="#));

        let graph_html = fs::read_to_string(output_dir.join("graph/index.html"))?;
        assert!(graph_html.contains("id=\"global-graph-stage\""));
        assert!(graph_html.contains("id=\"global-graph-reset\""));
        assert!(!graph_html.contains("id=\"global-graph-search\""));
        assert!(!graph_html.contains("id=\"global-graph-toggle\""));
        assert!(graph_html.contains("graphDataUrl:"));
        assert!(graph_html.contains("/graph.json"));
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

        let filetree_raw = fs::read_to_string(output_dir.join("filetree.json"))?;
        let filetree: serde_json::Value = serde_json::from_str(&filetree_raw)?;
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
        assert!(filetree_raw.contains(r#""icon": "folder-base.svg""#));
        assert!(filetree_raw.contains(r#""icon_open": "folder-base-open.svg""#));
        assert!(
            filetree_raw.contains(r#""icon": "markdown.svg""#)
                || filetree_raw.contains(r#""icon": "readme.svg""#)
                || filetree_raw.contains(r#""icon": "document.svg""#)
                || filetree_raw.contains(r#""icon": "settings.svg""#)
        );

        let robots_txt = fs::read_to_string(output_dir.join("robots.txt"))?;
        assert!(robots_txt.contains("Sitemap: https://example.test/sitemap.xml"));
        let cf_headers = fs::read_to_string(output_dir.join("_headers"))?;
        assert!(cf_headers.contains("X-Robots-Tag: index, follow"));

        let frontmatter_report = fs::read_to_string(output_dir.join("frontmatter-report.json"))?;
        assert!(frontmatter_report.contains("second-brain.md"));
        assert!(frontmatter_report.contains("note-experimental"));

        let sitemap_xml = fs::read_to_string(output_dir.join("sitemap.xml"))?;
        assert!(!sitemap_xml.contains("/notes/isolated/"));

        let rss_xml = fs::read_to_string(output_dir.join("rss.xml"))?;
        assert!(!rss_xml.contains("/notes/isolated/"));

        let not_found_html = fs::read_to_string(output_dir.join("404.html"))?;
        assert!(not_found_html.contains("Page not found"));
        let missing_note_html = fs::read_to_string(output_dir.join("notes/ghost-note/index.html"))?;
        assert!(missing_note_html.contains("not been published"));

        Ok(())
    }

    #[test]
    fn build_site_permissive_policy_publishes_non_draft_notes_without_publish_flag() -> Result<()> {
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

    #[test]
    fn minify_css_removes_comments_and_compacts_tokens() {
        let source = r#"
/* test comment */
.a  {
  color : red ;
  margin : 0  1rem ;
}
"#;

        let minified = minify_css(source);
        assert!(!minified.contains("test comment"));
        assert!(minified.contains(".a{"));
        assert!(minified.contains("color:red"));
        assert!(minified.contains("margin:0 1rem"));
    }

    #[test]
    fn minify_css_preserves_css_function_values() {
        let source = r#"
.box {
  width: calc(100% - 1rem);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E");
}
"#;

        let minified = minify_css(source);
        assert!(minified.contains("calc(100% - 1rem)"));
        assert!(minified.contains("data:image/svg+xml"));
    }

    #[test]
    fn minify_javascript_compacts_script() {
        let source = r#"
// comment
const add = (left, right) => {
  const total = left + right;
  return total;
};
console.log(add(1, 2));
"#;

        let minified = minify_javascript(source);
        assert!(minified.len() < source.len());
        assert!(!minified.contains('\n'));
        assert!(!minified.contains("// comment"));
        assert!(minified.contains("console.log"));
    }

    #[test]
    fn minify_javascript_falls_back_on_invalid_input() {
        let source = "function {";
        let minified = minify_javascript(source);
        assert_eq!(minified, source);
    }

    #[test]
    fn minify_inline_scripts_in_html_skips_script_tags_with_attributes() {
        let source = r#"
<html>
  <head>
    <script>
      const value = 1 + 2;
    </script>
    <script type="application/ld+json">{ "name": "Test" }</script>
  </head>
</html>
"#;

        let minified = minify_inline_scripts_in_html(source);
        assert!(minified.contains("<script>"));
        assert!(!minified.contains("const value = 1 + 2;"));
        assert!(
            minified.contains(r#"<script type="application/ld+json">{ "name": "Test" }</script>"#)
        );
    }

    #[test]
    fn frontmatter_supports_non_prefixed_keys() -> Result<()> {
        let raw = r#"---
title: Alias Check
publish: true
home: true
path: custom/post-path
enable-search: false
show-local-graph: false
pinned: true
hide: false
hide-in-graph: true
note-icon: "PIN"
---

Body
"#;

        let (frontmatter, body) = parse_frontmatter_and_body(raw)?;

        assert_eq!(frontmatter.title.as_deref(), Some("Alias Check"));
        assert_eq!(frontmatter.publish, Some(true));
        assert_eq!(frontmatter.home, Some(true));
        assert_eq!(frontmatter.path.as_deref(), Some("custom/post-path"));
        assert_eq!(frontmatter.enable_search, Some(false));
        assert_eq!(frontmatter.show_local_graph, Some(false));
        assert_eq!(frontmatter.pinned, Some(true));
        assert_eq!(frontmatter.hide, Some(false));
        assert_eq!(frontmatter.hide_in_graph, Some(true));
        assert_eq!(frontmatter.note_icon.as_deref(), Some("PIN"));
        assert!(body.contains("Body"));

        Ok(())
    }
}
