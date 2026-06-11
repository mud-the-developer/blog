use std::{
    collections::HashMap,
    ffi::OsStr,
    fs as std_fs,
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};

use askama::Template;
use axum::{
    Json, Router,
    extract::{Path as AxumPath, State},
    http::{StatusCode, header::CONTENT_TYPE},
    response::{Html, IntoResponse},
    routing::{get, post},
};
use pulldown_cmark::{Options, Parser, html};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::{fs, net::TcpListener};
use tower_http::{compression::CompressionLayer, services::ServeDir};

pub type BlogResult<T> = Result<T, Box<dyn std::error::Error>>;
const PUBLIC_SITE_URL: &str = "https://mud-blog.pages.dev";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct Post {
    pub title: String,
    pub slug: String,
    pub date: String,
    pub tags: Vec<String>,
    pub tags_label: String,
    pub primary_tag: String,
    pub accent: String,
    pub excerpt: String,
    pub body: String,
    pub html: String,
    pub url: String,
    pub folder: String,
}

#[derive(Debug, Clone)]
pub struct BuildResult {
    pub posts: Vec<Post>,
    pub files: Vec<String>,
}

#[derive(Serialize)]
struct ArchivePost<'a> {
    title: &'a str,
    date: &'a str,
    tags: &'a [String],
    primary_tag: &'a str,
    accent: &'a str,
    url: &'a str,
    folder: &'a str,
}

#[derive(Debug, Clone)]
struct FolderGroup<'a> {
    slug: &'static str,
    label: &'static str,
    posts: Vec<&'a Post>,
}

#[derive(Debug, Clone)]
struct NewsMonthGroup<'a> {
    month: String,
    label: String,
    posts: Vec<&'a Post>,
}

#[derive(Clone)]
struct AppState {
    posts: Arc<Vec<Post>>,
    archive_json: Arc<String>,
}

#[derive(Debug, Deserialize)]
struct FocusedIssueRequest {
    date: Option<String>,
    keywords: Option<String>,
    keyword: Option<Vec<String>>,
    candidates: Option<Vec<serde_json::Value>>,
    sources: Option<Vec<serde_json::Value>>,
    limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
struct NewsSearchRequest {
    query: Option<String>,
    keywords: Option<String>,
    keyword: Option<String>,
    #[serde(rename = "queryMode")]
    query_mode: Option<String>,
    #[serde(rename = "searchMode")]
    search_mode: Option<String>,
    sources: Option<Vec<String>>,
    limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
struct LocalSearchQueryPlan {
    mode: String,
    #[serde(rename = "originalQuery")]
    original_query: String,
    #[serde(rename = "searchQuery")]
    search_query: String,
    keywords: Vec<String>,
    #[serde(rename = "usedGemma")]
    used_gemma: bool,
    warning: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct LocalIssue {
    title: String,
    summary: String,
    markdown: String,
    bullets: Vec<String>,
}

#[derive(Template)]
#[template(path = "index.html")]
struct IndexTemplate<'a> {
    posts: &'a [Post],
    groups: Vec<FolderGroup<'a>>,
    archive_json: &'a str,
    folder_count: usize,
    home_html: String,
    latest_title: String,
    latest_url: String,
    latest_date: String,
}

#[derive(Template)]
#[template(path = "post.html")]
struct PostTemplate<'a> {
    post: &'a Post,
}

#[derive(Template)]
#[template(path = "news.html")]
struct NewsTemplate<'a> {
    latest_issue: Vec<&'a Post>,
    recent_issues: Vec<&'a Post>,
    month_groups: Vec<NewsMonthGroup<'a>>,
    archive_post: Vec<&'a Post>,
    issue_count: usize,
    archive_json: &'a str,
}

#[derive(Template)]
#[template(path = "news_search.html")]
struct NewsSearchTemplate<'a> {
    archive_json: &'a str,
}

#[derive(Template)]
#[template(path = "posts_fragment.html")]
struct PostsFragmentTemplate<'a> {
    posts: &'a [Post],
}

pub fn slugify(value: &str) -> String {
    let mut slug = String::new();
    let mut last_dash = false;

    for ch in value.trim().to_lowercase().chars() {
        if ch.is_ascii_alphanumeric() || ('가'..='힣').contains(&ch) {
            slug.push(ch);
            last_dash = false;
        } else if !last_dash && !slug.is_empty() {
            slug.push('-');
            last_dash = true;
        }
    }

    while slug.ends_with('-') {
        slug.pop();
    }

    if slug.is_empty() {
        "post".to_string()
    } else {
        slug
    }
}

fn parse_frontmatter(source: &str) -> (Vec<(String, String)>, String) {
    if !source.starts_with("---\n") {
        return (Vec::new(), source.to_string());
    }

    let Some(end) = source[4..].find("\n---") else {
        return (Vec::new(), source.to_string());
    };
    let frontmatter_end = 4 + end;
    let raw = source[4..frontmatter_end].trim();
    let body = source[frontmatter_end + 4..].trim_start().to_string();
    let lines = raw.lines().collect::<Vec<_>>();
    let mut pairs = Vec::new();
    let mut index = 0;

    while index < lines.len() {
        let line = lines[index];
        let Some((key, value)) = line.split_once(':') else {
            index += 1;
            continue;
        };
        let key = key.trim().to_string();
        let cleaned = value
            .trim()
            .trim_matches('"')
            .trim_matches('\'')
            .to_string();

        if cleaned.is_empty() {
            let mut list_items = Vec::new();
            let mut next = index + 1;
            while next < lines.len() && lines[next].starts_with(char::is_whitespace) {
                let trimmed = lines[next].trim();
                if let Some(item) = trimmed.strip_prefix("- ") {
                    list_items.push(item.trim().trim_matches('"').trim_matches('\'').to_string());
                }
                next += 1;
            }
            if !list_items.is_empty() {
                pairs.push((key, format!("[{}]", list_items.join(","))));
                index = next;
                continue;
            }
        }

        pairs.push((key, cleaned));
        index += 1;
    }

    (pairs, body)
}

fn frontmatter_value(entries: &[(String, String)], key: &str) -> Option<String> {
    entries.iter().find_map(|(candidate, value)| {
        if candidate == key {
            Some(value.clone())
        } else {
            None
        }
    })
}

fn frontmatter_list(entries: &[(String, String)], key: &str) -> Vec<String> {
    let Some(value) = frontmatter_value(entries, key) else {
        return Vec::new();
    };
    let trimmed = value.trim();
    if trimmed.starts_with('[') && trimmed.ends_with(']') {
        trimmed[1..trimmed.len() - 1]
            .split(',')
            .map(|item| item.trim().trim_matches('"').trim_matches('\'').to_string())
            .filter(|item| !item.is_empty())
            .collect()
    } else if trimmed.is_empty() {
        Vec::new()
    } else {
        vec![trimmed.to_string()]
    }
}

fn link_key(value: &str) -> String {
    slugify(value)
}

fn add_link_alias(link_index: &mut HashMap<String, String>, alias: &str, url: &str) {
    let key = link_key(alias);
    if !key.is_empty() {
        link_index.entry(key).or_insert_with(|| url.to_string());
    }
}

fn add_post_link_aliases(
    link_index: &mut HashMap<String, String>,
    source: &str,
    fallback_slug: &str,
    post: &Post,
) {
    add_link_alias(link_index, fallback_slug, &post.url);
    add_link_alias(link_index, &post.slug, &post.url);
    add_link_alias(link_index, &post.title, &post.url);
    let (frontmatter, _) = parse_frontmatter(source);
    for alias in frontmatter_list(&frontmatter, "aliases") {
        add_link_alias(link_index, &alias, &post.url);
    }
    if post.folder == "about" {
        add_link_alias(link_index, "About_me", &post.url);
        add_link_alias(link_index, "about-me", &post.url);
    }
}

fn rewrite_wikilinks(markdown: &str, link_index: &HashMap<String, String>) -> String {
    let mut output = String::with_capacity(markdown.len());
    let mut rest = markdown;

    while let Some(start) = rest.find("[[") {
        output.push_str(&rest[..start]);
        let before = rest[..start].chars().next_back();
        let after_start = start + 2;
        let Some(end) = rest[after_start..].find("]]") else {
            output.push_str(&rest[start..]);
            return output;
        };
        let raw = &rest[after_start..after_start + end];
        if before == Some('!') {
            output.push_str("[[");
            output.push_str(raw);
            output.push_str("]]");
            rest = &rest[after_start + end + 2..];
            continue;
        }

        let (target, label) = raw.split_once('|').unwrap_or((raw, raw));
        let (note, heading) = target.split_once('#').unwrap_or((target, ""));
        let mut href = link_index
            .get(&link_key(note))
            .cloned()
            .unwrap_or_else(|| format!("/posts/{}/", slugify(note)));
        if !heading.trim().is_empty() {
            href.push('#');
            href.push_str(&slugify(heading));
        }
        output.push_str(&format!("[{}]({})", label.trim(), href));
        rest = &rest[after_start + end + 2..];
    }

    output.push_str(rest);
    output
}

fn resolve_legacy_note_href(href: &str, link_index: &HashMap<String, String>) -> String {
    let Some(rest) = href.strip_prefix("/notes/") else {
        return href.to_string();
    };
    let (path, suffix) = rest
        .find(['#', '?'])
        .map(|index| (&rest[..index], &rest[index..]))
        .unwrap_or((rest, ""));
    let Some(candidate) = path.trim_matches('/').rsplit('/').next() else {
        return href.to_string();
    };
    link_index
        .get(&link_key(candidate))
        .map(|url| format!("{url}{suffix}"))
        .unwrap_or_else(|| href.to_string())
}

fn rewrite_legacy_note_hrefs_for_quote(
    html: &str,
    quote: char,
    link_index: &HashMap<String, String>,
) -> String {
    let prefix = format!("href={quote}");
    let needle = format!("{prefix}/notes/");
    let mut output = String::with_capacity(html.len());
    let mut rest = html;
    while let Some(start) = rest.find(&needle) {
        output.push_str(&rest[..start]);
        output.push_str(&prefix);
        let href_start = start + prefix.len();
        let Some(end) = rest[href_start..].find(quote) else {
            output.push_str(&rest[start..]);
            return output;
        };
        let href = &rest[href_start..href_start + end];
        output.push_str(&resolve_legacy_note_href(href, link_index));
        output.push(quote);
        rest = &rest[href_start + end + quote.len_utf8()..];
    }
    output.push_str(rest);
    output
}

fn rewrite_legacy_note_hrefs(html: &str, link_index: &HashMap<String, String>) -> String {
    let html = rewrite_legacy_note_hrefs_for_quote(html, '"', link_index);
    rewrite_legacy_note_hrefs_for_quote(&html, '\'', link_index)
}

fn markdown_to_html(markdown: &str) -> String {
    markdown_to_html_with_links(markdown, &HashMap::new())
}

fn markdown_to_html_with_links(markdown: &str, link_index: &HashMap<String, String>) -> String {
    let markdown = rewrite_wikilinks(markdown, link_index);
    let mut output = String::new();
    let parser = Parser::new_ext(
        &markdown,
        Options::ENABLE_TABLES | Options::ENABLE_STRIKETHROUGH | Options::ENABLE_HEADING_ATTRIBUTES,
    );
    html::push_html(&mut output, parser);
    rewrite_legacy_note_hrefs(&output, link_index)
}

fn excerpt_from_markdown(markdown: &str) -> String {
    let mut text = String::new();
    let mut in_code = false;

    for line in markdown.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("```") {
            in_code = !in_code;
            continue;
        }
        if in_code || trimmed.starts_with('#') {
            continue;
        }
        if !text.is_empty() {
            text.push(' ');
        }
        text.push_str(trimmed.trim_start_matches("- "));
    }

    let compact = text
        .replace(['*', '_', '`'], "")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    if compact.chars().count() <= 180 {
        return compact;
    }

    let shortened = compact.chars().take(176).collect::<String>();
    format!("{}…", shortened.trim_end())
}

pub fn parse_markdown_post(source: &str, fallback_slug: &str) -> Post {
    let (frontmatter, body) = parse_frontmatter(source);
    let title =
        frontmatter_value(&frontmatter, "title").unwrap_or_else(|| fallback_slug.to_string());
    let slug = frontmatter_value(&frontmatter, "slug").unwrap_or_else(|| slugify(fallback_slug));
    let date = frontmatter_value(&frontmatter, "date").unwrap_or_default();
    let tags = frontmatter_list(&frontmatter, "tags");
    let primary_tag = tags.first().cloned().unwrap_or_else(|| "note".to_string());
    let tags_label = if tags.is_empty() {
        "note".to_string()
    } else {
        tags.join(" / ")
    };
    let accent = frontmatter_value(&frontmatter, "accent").unwrap_or_else(|| "#b87945".to_string());
    let excerpt = frontmatter_value(&frontmatter, "excerpt")
        .or_else(|| frontmatter_value(&frontmatter, "description"))
        .unwrap_or_else(|| excerpt_from_markdown(&body));
    let html = markdown_to_html(&body);

    Post {
        title,
        slug: slug.clone(),
        date,
        tags,
        tags_label,
        primary_tag,
        accent,
        excerpt,
        body,
        html,
        url: format!("/posts/{slug}/"),
        folder: "notes".to_string(),
    }
}

fn collect_markdown_files(root: &Path, current: &Path, files: &mut Vec<PathBuf>) -> BlogResult<()> {
    for entry in std_fs::read_dir(current)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            if path.file_name() == Some(OsStr::new("assets")) {
                continue;
            }
            collect_markdown_files(root, &path, files)?;
        } else if path.extension() == Some(OsStr::new("md")) {
            files.push(path.strip_prefix(root)?.to_path_buf());
        }
    }
    Ok(())
}

fn folder_for_relative_path(relative_path: &Path) -> String {
    relative_path
        .components()
        .next()
        .and_then(|component| component.as_os_str().to_str())
        .filter(|component| relative_path.components().count() > 1 && *component != "assets")
        .unwrap_or("notes")
        .to_string()
}

pub async fn load_posts(posts_dir: impl AsRef<Path>) -> BlogResult<Vec<Post>> {
    let posts_dir = posts_dir.as_ref().to_path_buf();
    let mut files = Vec::new();
    collect_markdown_files(&posts_dir, &posts_dir, &mut files)?;

    files.sort();
    let mut entries = Vec::new();
    let mut link_index = HashMap::new();
    for relative_path in files {
        let path = posts_dir.join(&relative_path);
        let source = fs::read_to_string(&path).await?;
        let fallback = path
            .file_stem()
            .and_then(OsStr::to_str)
            .unwrap_or("post")
            .to_string();
        let mut post = parse_markdown_post(&source, &fallback);
        post.folder = folder_for_relative_path(&relative_path);
        add_post_link_aliases(&mut link_index, &source, &fallback, &post);
        entries.push((source, post));
    }

    let mut posts = Vec::new();
    for (source, mut post) in entries {
        post.html = markdown_to_html_with_links(&post.body, &link_index);
        if post.folder == "news" {
            post.html = demote_first_h1(&post.html);
        }
        debug_assert!(!source.is_empty());
        posts.push(post);
    }

    posts.sort_by(|a, b| b.date.cmp(&a.date).then_with(|| a.title.cmp(&b.title)));
    Ok(posts)
}

fn archive_json(posts: &[Post]) -> BlogResult<String> {
    let archive = posts
        .iter()
        .map(|post| ArchivePost {
            title: &post.title,
            date: &post.date,
            tags: &post.tags,
            primary_tag: &post.primary_tag,
            accent: &post.accent,
            url: &post.url,
            folder: &post.folder,
        })
        .collect::<Vec<_>>();
    let json = serde_json::to_string(&archive)?;
    Ok(json.replace('<', "\\u003c"))
}

fn copy_dir_sync(source: &Path, destination: &Path) -> BlogResult<()> {
    if !source.exists() {
        return Ok(());
    }

    std_fs::create_dir_all(destination)?;
    for entry in std_fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        if source_path.is_dir() {
            copy_dir_sync(&source_path, &destination_path)?;
        } else {
            std_fs::copy(&source_path, &destination_path)?;
        }
    }
    Ok(())
}

fn minify_css(source: &str) -> String {
    let mut without_comments = String::with_capacity(source.len());
    let mut chars = source.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '/' && chars.peek() == Some(&'*') {
            chars.next();
            let mut previous = '\0';
            for candidate in chars.by_ref() {
                if previous == '*' && candidate == '/' {
                    break;
                }
                previous = candidate;
            }
        } else {
            without_comments.push(ch);
        }
    }

    let mut output = String::with_capacity(without_comments.len());
    let mut pending_space = false;
    for ch in without_comments.chars() {
        if ch.is_whitespace() {
            pending_space = true;
            continue;
        }
        if matches!(ch, '{' | '}' | ';' | ',' | '>' | '+' | '~' | '(' | ')') {
            while output.ends_with(' ') {
                output.pop();
            }
            output.push(ch);
            pending_space = false;
        } else {
            if pending_space
                && output
                    .chars()
                    .last()
                    .is_some_and(|last| !matches!(last, '{' | '}' | ':' | ';' | ',' | '('))
            {
                output.push(' ');
            }
            output.push(ch);
            pending_space = false;
        }
    }
    output.trim().replace(";}", "}").replace("0.", ".")
}

fn folder_groups(posts: &[Post]) -> Vec<FolderGroup<'_>> {
    [
        ("news", "News"),
        ("blog", "Blog"),
        ("papers", "Papers"),
        ("about", "About"),
    ]
    .into_iter()
    .filter_map(|(slug, label)| {
        let grouped = posts
            .iter()
            .filter(|post| post.folder == slug)
            .collect::<Vec<_>>();
        if grouped.is_empty() {
            None
        } else {
            Some(FolderGroup {
                slug,
                label,
                posts: grouped,
            })
        }
    })
    .collect()
}

fn home_index_posts(posts: &[Post]) -> Vec<Post> {
    posts
        .iter()
        .filter(|post| post.folder != "news")
        .cloned()
        .collect()
}

fn demote_first_h1(html: &str) -> String {
    let Some(start) = html.find("<h1") else {
        return html.to_string();
    };
    let Some(open_end_relative) = html[start..].find('>') else {
        return html.to_string();
    };
    let open_end = start + open_end_relative;
    let Some(close_relative) = html[open_end..].find("</h1>") else {
        return html.to_string();
    };
    let close_start = open_end + close_relative;
    let close_end = close_start + "</h1>".len();

    let mut output = String::with_capacity(html.len());
    output.push_str(&html[..start]);
    output.push_str("<h2");
    output.push_str(&html[start + "<h1".len()..open_end + 1]);
    output.push_str(&html[open_end + 1..close_start]);
    output.push_str("</h2>");
    output.push_str(&html[close_end..]);
    output
}

fn news_month_label(month: &str) -> String {
    let Some((year, number)) = month.split_once('-') else {
        return month.to_string();
    };
    let name = match number {
        "01" => "January",
        "02" => "February",
        "03" => "March",
        "04" => "April",
        "05" => "May",
        "06" => "June",
        "07" => "July",
        "08" => "August",
        "09" => "September",
        "10" => "October",
        "11" => "November",
        "12" => "December",
        _ => return month.to_string(),
    };
    format!("{name} {year}")
}

fn news_month_groups<'a>(posts: &[&'a Post]) -> Vec<NewsMonthGroup<'a>> {
    let mut groups: Vec<NewsMonthGroup<'a>> = Vec::new();
    for post in posts {
        let month = post.date.chars().take(7).collect::<String>();
        if month.len() != 7 {
            continue;
        }
        if let Some(group) = groups.last_mut().filter(|group| group.month == month) {
            group.posts.push(*post);
        } else {
            groups.push(NewsMonthGroup {
                label: news_month_label(&month),
                month,
                posts: vec![*post],
            });
        }
    }
    groups
}

pub fn render_index_page(posts: &[Post]) -> BlogResult<String> {
    let home_posts = home_index_posts(posts);
    let archive_json = archive_json(&home_posts)?;
    let groups = folder_groups(&home_posts);
    let latest = home_posts.first();
    let home_post = home_posts
        .iter()
        .find(|post| post.folder == "blog" && post.slug == "home")
        .or_else(|| home_posts.iter().find(|post| post.title == "Home"))
        .or(latest);
    Ok(IndexTemplate {
        posts: &home_posts,
        folder_count: groups.len(),
        home_html: home_post
            .map(|post| post.html.clone())
            .unwrap_or_else(|| "<p>Welcome to my notes.</p>".to_string()),
        latest_title: latest
            .map(|post| post.title.clone())
            .unwrap_or_else(|| "No public notes yet".to_string()),
        latest_url: latest
            .map(|post| post.url.clone())
            .unwrap_or_else(|| "#posts".to_string()),
        latest_date: latest
            .map(|post| post.date.clone())
            .unwrap_or_else(|| "draft".to_string()),
        groups,
        archive_json: &archive_json,
    }
    .render()?)
}

pub fn render_post_page(post: &Post, _posts: &[Post]) -> BlogResult<String> {
    Ok(PostTemplate { post }.render()?)
}

pub fn render_news_page(posts: &[Post]) -> BlogResult<String> {
    let archive_json = archive_json(posts)?;
    let archive_post = posts
        .iter()
        .filter(|post| post.folder == "news" && post.title == "Daily AI News Archive")
        .take(1)
        .collect::<Vec<_>>();
    let news_issues = posts
        .iter()
        .filter(|post| post.folder == "news" && post.title != "Daily AI News Archive")
        .collect::<Vec<_>>();
    let latest_issue = news_issues.iter().copied().take(1).collect::<Vec<_>>();
    let recent_issues = news_issues
        .iter()
        .copied()
        .skip(1)
        .take(7)
        .collect::<Vec<_>>();
    let month_groups = news_month_groups(&news_issues);
    Ok(NewsTemplate {
        latest_issue,
        recent_issues,
        month_groups,
        archive_post,
        issue_count: news_issues.len(),
        archive_json: &archive_json,
    }
    .render()?)
}

pub fn render_news_search_page(posts: &[Post]) -> BlogResult<String> {
    let archive_json = archive_json(posts)?;
    Ok(NewsSearchTemplate {
        archive_json: &archive_json,
    }
    .render()?)
}

pub fn render_robots_txt() -> String {
    format!("User-agent: *\nAllow: /\n\nSitemap: {PUBLIC_SITE_URL}/sitemap.xml\n")
}

pub fn render_sitemap_xml(posts: &[Post]) -> String {
    let mut output = String::from(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n",
    );
    for path in ["/", "/news/", "/news/search/"] {
        output.push_str("  <url>\n    <loc>");
        output.push_str(PUBLIC_SITE_URL);
        output.push_str(path);
        output.push_str("</loc>\n  </url>\n");
    }
    for post in posts {
        output.push_str("  <url>\n    <loc>");
        output.push_str(PUBLIC_SITE_URL);
        output.push_str(&post.url);
        output.push_str("</loc>\n  </url>\n");
    }
    output.push_str("</urlset>\n");
    output
}

pub fn render_posts_fragment(posts: &[Post]) -> BlogResult<String> {
    let home_posts = home_index_posts(posts);
    Ok(PostsFragmentTemplate { posts: &home_posts }.render()?)
}

pub async fn build_static_site(
    posts_dir: impl AsRef<Path>,
    out_dir: impl AsRef<Path>,
) -> BlogResult<BuildResult> {
    let posts_dir = posts_dir.as_ref().to_path_buf();
    let posts = load_posts(&posts_dir).await?;
    let out_dir = out_dir.as_ref();
    let assets_dir = out_dir.join("assets");
    let fragments_dir = out_dir.join("fragments");
    let news_dir = out_dir.join("news");
    let news_search_dir = news_dir.join("search");

    fs::remove_dir_all(out_dir).await.ok();
    fs::create_dir_all(&assets_dir).await?;
    fs::create_dir_all(&fragments_dir).await?;
    fs::create_dir_all(&news_dir).await?;
    fs::create_dir_all(&news_search_dir).await?;
    copy_dir_sync(
        &posts_dir.join("papers").join("assets"),
        &assets_dir.join("posts"),
    )?;
    copy_dir_sync(Path::new("static/news/assets"), &assets_dir.join("news"))?;
    copy_dir_sync(Path::new("static/news/data"), &out_dir.join("news/data"))?;
    let css = fs::read_to_string("src/style.css").await?;
    fs::write(assets_dir.join("style.css"), minify_css(&css)).await?;
    fs::copy("src/blog-lab.mjs", assets_dir.join("blog-lab.mjs")).await?;
    fs::copy(
        "src/blog-lab-machine.mjs",
        assets_dir.join("blog-lab-machine.mjs"),
    )
    .await?;
    fs::copy("src/site-chrome.mjs", assets_dir.join("site-chrome.mjs")).await?;
    fs::copy(
        "src/site-chrome-state.mjs",
        assets_dir.join("site-chrome-state.mjs"),
    )
    .await?;
    fs::copy(
        "src/site-chrome-effects.mjs",
        assets_dir.join("site-chrome-effects.mjs"),
    )
    .await?;

    let archive = archive_json(&posts)?;
    fs::write(out_dir.join("archive.json"), archive).await?;
    fs::write(out_dir.join("robots.txt"), render_robots_txt()).await?;
    fs::write(out_dir.join("sitemap.xml"), render_sitemap_xml(&posts)).await?;
    fs::write(out_dir.join("index.html"), render_index_page(&posts)?).await?;
    fs::write(news_dir.join("index.html"), render_news_page(&posts)?).await?;
    fs::write(
        news_search_dir.join("index.html"),
        render_news_search_page(&posts)?,
    )
    .await?;
    fs::write(
        fragments_dir.join("posts.html"),
        render_posts_fragment(&posts)?,
    )
    .await?;

    let mut files = vec![
        "index.html".to_string(),
        "archive.json".to_string(),
        "robots.txt".to_string(),
        "sitemap.xml".to_string(),
        "news/index.html".to_string(),
        "news/search/index.html".to_string(),
        "fragments/posts.html".to_string(),
    ];
    for post in &posts {
        let post_dir = out_dir.join("posts").join(&post.slug);
        fs::create_dir_all(&post_dir).await?;
        fs::write(post_dir.join("index.html"), render_post_page(post, &posts)?).await?;
        files.push(format!("posts/{}/index.html", post.slug));
    }

    Ok(BuildResult { posts, files })
}

pub fn router(posts: Vec<Post>, assets_root: impl Into<PathBuf>) -> BlogResult<Router> {
    let archive_json = archive_json(&posts)?;
    let state = AppState {
        posts: Arc::new(posts),
        archive_json: Arc::new(archive_json),
    };
    let assets_root = assets_root.into();

    Ok(Router::new()
        .route("/", get(index_handler))
        .route("/robots.txt", get(robots_handler))
        .route("/sitemap.xml", get(sitemap_handler))
        .route("/news", get(news_handler))
        .route("/news/", get(news_handler))
        .route("/news/search", get(news_search_page_handler))
        .route("/news/search/", get(news_search_page_handler))
        .route("/fragments/posts", get(posts_fragment_handler))
        .route("/archive.json", get(archive_handler))
        .route("/api/focused-issue", post(focused_issue_handler))
        .route("/api/news-search", post(news_search_handler))
        .route("/posts/{slug}/", get(post_handler))
        .nest_service("/news/data", ServeDir::new(assets_root.join("news/data")))
        .nest_service("/assets", ServeDir::new(assets_root.join("assets")))
        .layer(CompressionLayer::new())
        .with_state(state))
}

async fn index_handler(State(state): State<AppState>) -> impl IntoResponse {
    match render_index_page(&state.posts) {
        Ok(html) => Html(html).into_response(),
        Err(error) => (StatusCode::INTERNAL_SERVER_ERROR, error.to_string()).into_response(),
    }
}

async fn robots_handler() -> impl IntoResponse {
    (
        [(CONTENT_TYPE, "text/plain; charset=utf-8")],
        render_robots_txt(),
    )
}

async fn sitemap_handler(State(state): State<AppState>) -> impl IntoResponse {
    (
        [(CONTENT_TYPE, "application/xml; charset=utf-8")],
        render_sitemap_xml(&state.posts),
    )
}

async fn news_handler(State(state): State<AppState>) -> impl IntoResponse {
    match render_news_page(&state.posts) {
        Ok(html) => Html(html).into_response(),
        Err(error) => (StatusCode::INTERNAL_SERVER_ERROR, error.to_string()).into_response(),
    }
}

async fn news_search_page_handler(State(state): State<AppState>) -> impl IntoResponse {
    match render_news_search_page(&state.posts) {
        Ok(html) => Html(html).into_response(),
        Err(error) => (StatusCode::INTERNAL_SERVER_ERROR, error.to_string()).into_response(),
    }
}

async fn posts_fragment_handler(State(state): State<AppState>) -> impl IntoResponse {
    match render_posts_fragment(&state.posts) {
        Ok(html) => Html(html).into_response(),
        Err(error) => (StatusCode::INTERNAL_SERVER_ERROR, error.to_string()).into_response(),
    }
}

async fn archive_handler(State(state): State<AppState>) -> impl IntoResponse {
    match serde_json::from_str::<serde_json::Value>(&state.archive_json) {
        Ok(value) => Json(value).into_response(),
        Err(error) => (StatusCode::INTERNAL_SERVER_ERROR, error.to_string()).into_response(),
    }
}

async fn focused_issue_handler(
    State(state): State<AppState>,
    Json(request): Json<FocusedIssueRequest>,
) -> impl IntoResponse {
    let keywords = normalize_api_keywords(&request);
    if keywords.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "ok": false, "error": "keywords required" })),
        )
            .into_response();
    }
    let date = request.date.unwrap_or_else(|| "today".to_string());
    let limit = request.limit.unwrap_or(8).clamp(1, 12);
    let selected_candidates = request
        .candidates
        .clone()
        .or_else(|| request.sources.clone())
        .unwrap_or_default();
    let sources = if selected_candidates.is_empty() {
        ranked_post_sources(&state.posts, &keywords, limit)
    } else {
        normalize_selected_candidates(selected_candidates, &keywords, limit)
    };
    let fallback = fallback_local_issue(&date, &keywords, &sources);
    let gemma_result = call_gemma_for_issue(&date, &keywords, &sources, &state.posts).await;
    let (issue, used_gemma, warning) = match gemma_result {
        Ok(issue) => (issue, true, None),
        Err(message) => (fallback, false, Some(message)),
    };

    Json(json!({
        "ok": true,
        "date": date,
        "keywords": keywords,
        "issue": issue,
        "sources": sources,
        "usedGemma": used_gemma,
        "warning": warning
    }))
    .into_response()
}

fn fallback_local_issue(
    date: &str,
    keywords: &[String],
    sources: &[serde_json::Value],
) -> LocalIssue {
    let title = format!("{} Focused Brief — {}", keywords.join(", "), date);
    let source_lines = sources
        .iter()
        .enumerate()
        .map(|(index, source)| {
            format!(
                "{}. [{}]({}) — {}",
                index + 1,
                source["title"].as_str().unwrap_or_default(),
                source["url"].as_str().unwrap_or("#"),
                source["summary"].as_str().unwrap_or_default()
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    LocalIssue {
        title: title.clone(),
        summary: format!(
            "Local preview draft from {} ranked source candidates.",
            sources.len()
        ),
        markdown: format!("## {title}\n\n### Ranked sources\n{source_lines}"),
        bullets: sources
            .iter()
            .take(3)
            .filter_map(|source| source["title"].as_str().map(str::to_string))
            .collect(),
    }
}

fn google_api_key() -> Option<String> {
    ["GOOGLE_AI_API_KEY", "GOOGLE_API_KEY", "GEMINI_API_KEY"]
        .iter()
        .find_map(|name| {
            std::env::var(name)
                .ok()
                .filter(|value| !value.trim().is_empty())
        })
}

fn google_model_name() -> String {
    let raw = std::env::var("GOOGLE_AI_MODEL")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "models/gemma-4-31b-it".to_string());
    if raw.starts_with("models/") {
        raw
    } else {
        format!("models/{raw}")
    }
}

async fn call_gemma_for_issue(
    date: &str,
    keywords: &[String],
    sources: &[serde_json::Value],
    posts: &[Post],
) -> Result<LocalIssue, String> {
    let Some(api_key) = google_api_key() else {
        return Err("Google AI API key is not configured in this preview process.".to_string());
    };
    let blog_context = posts
        .iter()
        .take(24)
        .map(|post| json!({ "title": post.title, "folder": post.folder, "excerpt": post.excerpt, "url": post.url }))
        .collect::<Vec<_>>();
    let payload = json!({
        "task": "Draft a focused public blog news issue. Return JSON only with title, summary, markdown, and bullets. Format important phrases with Markdown bold where useful. Do not include diagrams or overview figures.",
        "date": date,
        "keywords": keywords,
        "ranking_policy": "Use live searched candidates first, then latest digest/archive context as fallback. Score by query match, recency, source quality, and blog relevance. Do not invent unsupported facts.",
        "searched_news_candidates": sources.iter().filter(|source| source["origin"].as_str() == Some("live-search")).cloned().collect::<Vec<_>>(),
        "ranked_news_items": sources,
        "blog_archive_context": blog_context
    });
    let endpoint = format!(
        "https://generativelanguage.googleapis.com/v1beta/{}:generateContent?key={}",
        google_model_name(),
        api_key
    );
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(25))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());
    let response = client
        .post(endpoint)
        .json(&json!({
            "contents": [{ "role": "user", "parts": [{ "text": serde_json::to_string_pretty(&payload).unwrap_or_default() }] }],
            "generationConfig": { "temperature": 0.35, "topP": 0.9, "maxOutputTokens": 2400 }
        }))
        .send()
        .await
        .map_err(|_| "Gemma request failed locally before a response was received.".to_string())?;
    if !response.status().is_success() {
        return Err(format!(
            "Gemma request failed locally: {}",
            response.status()
        ));
    }
    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|error| format!("Gemma response decode failed locally: {error}"))?;
    let text = json["candidates"][0]["content"]["parts"]
        .as_array()
        .map(|parts| {
            parts
                .iter()
                .filter_map(|part| part["text"].as_str())
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default();
    parse_gemma_issue(&text)
        .ok_or_else(|| "Gemma returned non-JSON issue content locally.".to_string())
}

fn extract_json_object(text: &str) -> Option<&str> {
    let start = text.find('{')?;
    let end = text.rfind('}')?;
    if end <= start {
        return None;
    }
    text.get(start..=end)
}

fn parse_gemma_issue(text: &str) -> Option<LocalIssue> {
    let trimmed = text.trim();
    let candidate = trimmed
        .strip_prefix("```json")
        .and_then(|value| value.strip_suffix("```"))
        .or_else(|| {
            trimmed
                .strip_prefix("```")
                .and_then(|value| value.strip_suffix("```"))
        })
        .unwrap_or(trimmed)
        .trim();
    let candidate = extract_json_object(candidate).unwrap_or(candidate);
    let value = serde_json::from_str::<serde_json::Value>(candidate).ok()?;
    let issue = LocalIssue {
        title: value["title"].as_str()?.trim().chars().take(200).collect(),
        summary: value["summary"]
            .as_str()
            .unwrap_or_default()
            .trim()
            .chars()
            .take(800)
            .collect(),
        markdown: value["markdown"].as_str()?.to_string(),
        bullets: value["bullets"]
            .as_array()
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| {
                        item.as_str()
                            .map(|text| text.trim().chars().take(220).collect())
                    })
                    .take(6)
                    .collect()
            })
            .unwrap_or_default(),
    };
    Some(issue)
}

fn simple_url_encode(value: &str) -> String {
    value
        .bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                (byte as char).to_string()
            }
            b' ' => "+".to_string(),
            _ => format!("%{byte:02X}"),
        })
        .collect()
}

fn strip_xml_tags(value: &str) -> String {
    let mut output = String::new();
    let mut in_tag = false;
    for ch in value.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => output.push(ch),
            _ => {}
        }
    }
    let decoded = decode_xml_text(&output);
    let mut clean = String::new();
    let mut in_tag = false;
    for ch in decoded.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => clean.push(ch),
            _ => {}
        }
    }
    clean.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn decode_xml_text(value: &str) -> String {
    value
        .replace("<![CDATA[", "")
        .replace("]]>", "")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn xml_tag(block: &str, tag: &str) -> String {
    let open = format!("<{tag}");
    let close = format!("</{tag}>");
    let Some(open_start) = block.find(&open) else {
        return String::new();
    };
    let Some(open_end) = block[open_start..].find('>') else {
        return String::new();
    };
    let content_start = open_start + open_end + 1;
    let Some(close_start) = block[content_start..].find(&close) else {
        return String::new();
    };
    strip_xml_tags(&block[content_start..content_start + close_start])
}

fn xml_blocks<'a>(xml: &'a str, tag: &str) -> Vec<&'a str> {
    let mut blocks = Vec::new();
    let open = format!("<{tag}");
    let close = format!("</{tag}>");
    let mut rest = xml;
    while let Some(start) = rest.find(&open) {
        let after_start = &rest[start..];
        let Some(end) = after_start.find(&close) else {
            break;
        };
        let block_end = end + close.len();
        blocks.push(&after_start[..block_end]);
        rest = &after_start[block_end..];
    }
    blocks
}

fn api_query_text(request: &NewsSearchRequest) -> String {
    request
        .query
        .as_deref()
        .or(request.keywords.as_deref())
        .or(request.keyword.as_deref())
        .unwrap_or_default()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn news_query_mode(request: &NewsSearchRequest) -> String {
    request
        .query_mode
        .as_deref()
        .or(request.search_mode.as_deref())
        .filter(|mode| mode.eq_ignore_ascii_case("gemma-expand"))
        .map(|_| "gemma-expand".to_string())
        .unwrap_or_else(|| "exact".to_string())
}

fn normalize_expanded_keywords(query: &str, values: Vec<String>) -> Vec<String> {
    let mut keywords = Vec::new();
    for raw in std::iter::once(query.to_string()).chain(values) {
        let keyword = raw
            .replace(['\"', '`', '{', '}', '[', ']', '<', '>'], "")
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");
        if keyword.len() < 2
            || keywords
                .iter()
                .any(|item: &String| item.eq_ignore_ascii_case(&keyword))
        {
            continue;
        }
        keywords.push(keyword.chars().take(70).collect());
        if keywords.len() >= 8 {
            break;
        }
    }
    keywords
}

fn search_query_from_keywords(keywords: &[String]) -> String {
    keywords
        .iter()
        .map(|keyword| {
            if keyword.contains(' ') {
                format!("\"{keyword}\"")
            } else {
                keyword.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join(" OR ")
}

async fn call_gemma_for_query_plan(query: &str) -> Result<(Vec<String>, String), String> {
    let Some(api_key) = google_api_key() else {
        return Err("Gemma keyword expansion is unavailable without a Google AI API key; using the exact query.".to_string());
    };
    let payload = json!({
        "task": "Expand an editorial news search query into precise source-search keywords.",
        "originalQuery": query,
        "instructions": [
            "Return JSON only: {\"keywords\": string[], \"searchQuery\": string}.",
            "Preserve the original phrase as the first keyword.",
            "Add 4-7 adjacent technical keywords, aliases, paper terms, and community phrases that improve search recall.",
            "Keep each keyword short enough for Google News, arXiv, Scholar, GitHub, and social/search sources.",
            "Do not invent specific paper titles, dates, companies, or claims."
        ]
    });
    let endpoint = format!(
        "https://generativelanguage.googleapis.com/v1beta/{}:generateContent?key={}",
        google_model_name(),
        api_key
    );
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(16))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());
    let response = client
        .post(endpoint)
        .json(&json!({
            "contents": [{ "role": "user", "parts": [{ "text": serde_json::to_string_pretty(&payload).unwrap_or_default() }] }],
            "generationConfig": { "temperature": 0.25, "topP": 0.9, "maxOutputTokens": 900, "responseMimeType": "application/json" }
        }))
        .send()
        .await
        .map_err(|_| "Gemma keyword expansion failed before a response was received.".to_string())?;
    if !response.status().is_success() {
        return Err(format!(
            "Gemma keyword expansion failed locally: {}",
            response.status()
        ));
    }
    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|error| format!("Gemma query-plan decode failed locally: {error}"))?;
    let text = json["candidates"][0]["content"]["parts"]
        .as_array()
        .map(|parts| {
            parts
                .iter()
                .filter(|part| part["thought"].as_bool() != Some(true))
                .filter_map(|part| part["text"].as_str())
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default();
    let candidate = extract_json_object(&text).unwrap_or(text.trim());
    let parsed: serde_json::Value = serde_json::from_str(candidate)
        .map_err(|_| "Gemma returned non-JSON keyword expansion locally.".to_string())?;
    let keywords = parsed["keywords"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(str::to_string))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let search_query = parsed["searchQuery"]
        .as_str()
        .unwrap_or_default()
        .to_string();
    Ok((keywords, search_query))
}

async fn plan_local_search_query(query: &str, request: &NewsSearchRequest) -> LocalSearchQueryPlan {
    let mode = news_query_mode(request);
    if mode == "exact" {
        let keywords = normalize_expanded_keywords(query, Vec::new());
        return LocalSearchQueryPlan {
            mode,
            original_query: query.to_string(),
            search_query: query.to_string(),
            keywords,
            used_gemma: false,
            warning: None,
        };
    }
    match call_gemma_for_query_plan(query).await {
        Ok((raw_keywords, raw_search_query)) => {
            let keywords = normalize_expanded_keywords(query, raw_keywords);
            let search_query = if raw_search_query.trim().is_empty() {
                search_query_from_keywords(&keywords)
            } else {
                raw_search_query
                    .split_whitespace()
                    .collect::<Vec<_>>()
                    .join(" ")
            };
            LocalSearchQueryPlan {
                mode,
                original_query: query.to_string(),
                search_query,
                keywords,
                used_gemma: true,
                warning: None,
            }
        }
        Err(message) => {
            let keywords = normalize_expanded_keywords(query, Vec::new());
            LocalSearchQueryPlan {
                mode,
                original_query: query.to_string(),
                search_query: query.to_string(),
                keywords,
                used_gemma: false,
                warning: Some(message),
            }
        }
    }
}

fn selected_news_sources(request: &NewsSearchRequest) -> Vec<&'static str> {
    let allowed = [
        "gdelt",
        "google-news-rss",
        "hacker-news",
        "github-repositories",
        "arxiv",
        "huggingface-papers",
        "openalex",
        "crossref",
        "semantic-scholar",
        "google-scholar",
        "x",
        "linkedin",
        "geeknews",
        "endigest",
    ];
    let requested = request
        .sources
        .as_deref()
        .unwrap_or(&[])
        .iter()
        .filter_map(|source| {
            allowed
                .iter()
                .copied()
                .find(|allowed_source| allowed_source == source)
        })
        .collect::<Vec<_>>();
    if requested.is_empty() {
        allowed.to_vec()
    } else {
        requested
    }
}

fn candidate_score(candidate: &serde_json::Value, keywords: &[String], index: usize) -> f32 {
    let haystack = format!(
        "{} {} {}",
        candidate["title"].as_str().unwrap_or_default(),
        candidate["summary"].as_str().unwrap_or_default(),
        candidate["source"].as_str().unwrap_or_default()
    )
    .to_lowercase();
    let mut score = 3.0 - (index as f32 * 0.15);
    for keyword in keywords {
        score += keyword_score(&haystack, keyword);
    }
    if candidate["url"].as_str().is_some_and(|url| !url.is_empty()) {
        score += 0.5;
    }
    if candidate["title"]
        .as_str()
        .unwrap_or_default()
        .to_lowercase()
        .starts_with("open ")
        && candidate["title"]
            .as_str()
            .unwrap_or_default()
            .to_lowercase()
            .contains(" results for ")
    {
        score -= 8.0;
    }
    score.max(0.1)
}

fn thumbnail_for_source(candidate: &serde_json::Value) -> &'static str {
    let text = format!(
        "{} {} {}",
        candidate["source"].as_str().unwrap_or_default(),
        candidate["type"].as_str().unwrap_or_default(),
        candidate["url"].as_str().unwrap_or_default()
    )
    .to_lowercase();
    if text.contains("github") || text.contains("repo") {
        "/assets/news/thumb-repo.svg"
    } else if text.contains("arxiv") || text.contains("paper") || text.contains("huggingface") {
        "/assets/news/thumb-paper.svg"
    } else if text.contains("ran") || text.contains("vran") || text.contains("o-ran") {
        "/assets/news/thumb-vran.svg"
    } else {
        "/assets/news/thumb-ai.svg"
    }
}

fn normalize_selected_candidates(
    candidates: Vec<serde_json::Value>,
    keywords: &[String],
    limit: usize,
) -> Vec<serde_json::Value> {
    let mut normalized = candidates
        .into_iter()
        .enumerate()
        .map(|(index, candidate)| {
            let score = candidate["score"]
                .as_f64()
                .map(|score| score as f32)
                .unwrap_or_else(|| candidate_score(&candidate, keywords, index));
            json!({
                "title": candidate["title"].as_str().unwrap_or("Untitled candidate"),
                "summary": candidate["summary"].as_str().unwrap_or_default(),
                "url": candidate["url"].as_str().unwrap_or_default(),
                "source": candidate["source"].as_str().unwrap_or("live search"),
                "publishedAt": candidate["publishedAt"].as_str().unwrap_or_default(),
                "score": (score * 100.0).round() / 100.0,
                "origin": candidate["origin"].as_str().unwrap_or("live-search"),
                "type": candidate["type"].as_str().unwrap_or("news"),
                "thumbnail": candidate["thumbnail"].as_str().unwrap_or_else(|| thumbnail_for_source(&candidate))
            })
        })
        .collect::<Vec<_>>();
    normalized.sort_by(|left, right| {
        right["score"]
            .as_f64()
            .unwrap_or_default()
            .total_cmp(&left["score"].as_f64().unwrap_or_default())
    });
    normalized.truncate(limit);
    normalized
}

async fn fetch_google_news_candidates(
    client: &reqwest::Client,
    query: &str,
    limit: usize,
) -> Result<Vec<serde_json::Value>, String> {
    let url = format!(
        "https://news.google.com/rss/search?q={}&hl=en-US&gl=US&ceid=US:en",
        simple_url_encode(query)
    );
    let xml = client
        .get(url)
        .header("user-agent", "mud-blog-news-search/1.0")
        .send()
        .await
        .map_err(|error| format!("google-news-rss: {error}"))?
        .text()
        .await
        .map_err(|error| format!("google-news-rss: {error}"))?;
    Ok(xml_blocks(&xml, "item")
        .into_iter()
        .take(limit)
        .enumerate()
        .map(|(index, block)| {
            let source = xml_tag(block, "source");
            let source = if source.is_empty() {
                "Google News".to_string()
            } else {
                source
            };
            json!({
                "id": format!("google-news-{}", index + 1),
                "title": xml_tag(block, "title"),
                "url": xml_tag(block, "link"),
                "source": source,
                "summary": xml_tag(block, "description"),
                "publishedAt": xml_tag(block, "pubDate"),
                "origin": "live-search",
                "type": "news"
            })
        })
        .collect())
}

async fn fetch_github_candidates(
    client: &reqwest::Client,
    query: &str,
    limit: usize,
) -> Result<Vec<serde_json::Value>, String> {
    let url = format!(
        "https://api.github.com/search/repositories?q={}&sort=updated&order=desc&per_page={}",
        simple_url_encode(query),
        limit.min(10)
    );
    let body = client
        .get(url)
        .header("accept", "application/vnd.github+json")
        .header("user-agent", "mud-blog-news-search/1.0")
        .send()
        .await
        .map_err(|error| format!("github-repositories: {error}"))?
        .json::<serde_json::Value>()
        .await
        .map_err(|error| format!("github-repositories: {error}"))?;
    Ok(body["items"]
        .as_array()
        .into_iter()
        .flatten()
        .take(limit)
        .enumerate()
        .map(|(index, repo)| {
            json!({
                "id": format!("github-{}", index + 1),
                "title": repo["full_name"].as_str().unwrap_or_default(),
                "url": repo["html_url"].as_str().unwrap_or_default(),
                "source": "GitHub",
                "summary": repo["description"].as_str().unwrap_or_default(),
                "publishedAt": repo["updated_at"].as_str().unwrap_or_default(),
                "origin": "live-search",
                "type": "repo",
                "stars": repo["stargazers_count"].as_u64().unwrap_or_default()
            })
        })
        .collect())
}

async fn fetch_arxiv_candidates(
    client: &reqwest::Client,
    query: &str,
    limit: usize,
) -> Result<Vec<serde_json::Value>, String> {
    let url = format!(
        "https://export.arxiv.org/api/query?search_query=all:{}&start=0&max_results={}&sortBy=submittedDate&sortOrder=descending",
        simple_url_encode(query),
        limit.min(10)
    );
    let xml = client
        .get(url)
        .header("user-agent", "mud-blog-news-search/1.0")
        .send()
        .await
        .map_err(|error| format!("arxiv: {error}"))?
        .text()
        .await
        .map_err(|error| format!("arxiv: {error}"))?;
    Ok(xml_blocks(&xml, "entry")
        .into_iter()
        .take(limit)
        .enumerate()
        .map(|(index, block)| {
            let published = xml_tag(block, "published");
            let published = if published.is_empty() {
                xml_tag(block, "updated")
            } else {
                published
            };
            json!({
                "id": format!("arxiv-{}", index + 1),
                "title": xml_tag(block, "title"),
                "url": xml_tag(block, "id"),
                "source": "arXiv",
                "summary": xml_tag(block, "summary"),
                "publishedAt": published,
                "origin": "live-search",
                "type": "paper"
            })
        })
        .collect())
}

async fn fetch_gdelt_candidates(
    client: &reqwest::Client,
    query: &str,
    limit: usize,
) -> Result<Vec<serde_json::Value>, String> {
    let gdelt_query = query
        .split_whitespace()
        .map(|token| {
            if token.contains('-') {
                format!("\"{token}\"")
            } else {
                token.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join(" ");
    let url = format!(
        "https://api.gdeltproject.org/api/v2/doc/doc?query={}&mode=artlist&format=json&maxrecords={}&sort=hybridrel",
        simple_url_encode(&gdelt_query),
        limit.min(10)
    );
    let body = client
        .get(url)
        .header(
            "user-agent",
            "Mozilla/5.0 (compatible; mud-blog-news-search/1.0)",
        )
        .send()
        .await
        .map_err(|error| format!("gdelt: {error}"))?
        .json::<serde_json::Value>()
        .await
        .map_err(|error| format!("gdelt: {error}"))?;
    Ok(body["articles"]
        .as_array()
        .into_iter()
        .flatten()
        .take(limit)
        .enumerate()
        .map(|(index, article)| {
            json!({
                "id": format!("gdelt-{}", index + 1),
                "title": article["title"].as_str().unwrap_or("GDELT article"),
                "url": article["url"].as_str().unwrap_or_default(),
                "source": article["sourceCommonName"].as_str().or_else(|| article["domain"].as_str()).unwrap_or("GDELT"),
                "summary": "Live web/news article indexed by GDELT.",
                "publishedAt": article["seendate"].as_str().unwrap_or_default(),
                "origin": "live-search",
                "type": "news",
                "thumbnail": article["socialimage"].as_str().unwrap_or_default()
            })
        })
        .collect())
}

async fn fetch_openalex_candidates(
    client: &reqwest::Client,
    query: &str,
    limit: usize,
) -> Result<Vec<serde_json::Value>, String> {
    let url = format!(
        "https://api.openalex.org/works?search={}&per-page={}&sort=relevance_score:desc",
        simple_url_encode(query),
        limit.min(10)
    );
    let body = client
        .get(url)
        .header("user-agent", "mud-blog-news-search/1.0")
        .send()
        .await
        .map_err(|error| format!("openalex: {error}"))?
        .json::<serde_json::Value>()
        .await
        .map_err(|error| format!("openalex: {error}"))?;
    Ok(body["results"]
        .as_array()
        .into_iter()
        .flatten()
        .take(limit)
        .enumerate()
        .map(|(index, work)| {
            let doi = work["doi"].as_str().unwrap_or_default().replace("https://doi.org/", "");
            let url = if doi.is_empty() {
                work["primary_location"]["landing_page_url"].as_str().or_else(|| work["id"].as_str()).unwrap_or_default().to_string()
            } else {
                format!("https://doi.org/{doi}")
            };
            json!({
                "id": format!("openalex-{}", index + 1),
                "title": work["display_name"].as_str().unwrap_or("OpenAlex work"),
                "url": url,
                "source": "OpenAlex",
                "summary": work["primary_location"]["source"]["display_name"].as_str().unwrap_or("OpenAlex paper metadata."),
                "publishedAt": work["publication_date"].as_str().unwrap_or_default(),
                "origin": "live-search",
                "type": "paper"
            })
        })
        .collect())
}

async fn fetch_crossref_candidates(
    client: &reqwest::Client,
    query: &str,
    limit: usize,
) -> Result<Vec<serde_json::Value>, String> {
    let url = format!(
        "https://api.crossref.org/works?query={}&rows={}&sort=relevance",
        simple_url_encode(query),
        limit.min(10)
    );
    let body = client
        .get(url)
        .header("user-agent", "mud-blog-news-search/1.0")
        .send()
        .await
        .map_err(|error| format!("crossref: {error}"))?
        .json::<serde_json::Value>()
        .await
        .map_err(|error| format!("crossref: {error}"))?;
    Ok(body["message"]["items"]
        .as_array()
        .into_iter()
        .flatten()
        .take(limit)
        .enumerate()
        .map(|(index, work)| {
            json!({
                "id": format!("crossref-{}", index + 1),
                "title": work["title"].as_array().and_then(|items| items.first()).and_then(|item| item.as_str()).unwrap_or("Crossref work"),
                "url": work["URL"].as_str().unwrap_or_default(),
                "source": "Crossref",
                "summary": work["publisher"].as_str().unwrap_or("Crossref DOI metadata."),
                "publishedAt": "",
                "origin": "live-search",
                "type": "paper"
            })
        })
        .collect())
}

async fn fetch_semantic_scholar_candidates(
    client: &reqwest::Client,
    query: &str,
    limit: usize,
) -> Result<Vec<serde_json::Value>, String> {
    let url = format!(
        "https://api.semanticscholar.org/graph/v1/paper/search?query={}&limit={}&fields=title,url,abstract,year,authors,publicationDate,venue",
        simple_url_encode(query),
        limit.min(10)
    );
    let mut request = client
        .get(url)
        .header("user-agent", "mud-blog-news-search/1.0")
        .header("accept", "application/json");
    if let Ok(key) = std::env::var("SEMANTIC_SCHOLAR_API_KEY") {
        request = request.header("x-api-key", key);
    }
    let body = request
        .send()
        .await
        .map_err(|error| format!("semantic-scholar: {error}"))?
        .json::<serde_json::Value>()
        .await
        .map_err(|error| format!("semantic-scholar: {error}"))?;
    Ok(body["data"]
        .as_array()
        .into_iter()
        .flatten()
        .take(limit)
        .enumerate()
        .map(|(index, paper)| {
            json!({
                "id": format!("semantic-scholar-{}", index + 1),
                "title": paper["title"].as_str().unwrap_or("Semantic Scholar paper"),
                "url": paper["url"].as_str().unwrap_or_default(),
                "source": "Semantic Scholar",
                "summary": paper["abstract"].as_str().unwrap_or("Semantic Scholar paper metadata."),
                "publishedAt": paper["publicationDate"].as_str().unwrap_or_default(),
                "origin": "live-search",
                "type": "paper"
            })
        })
        .collect())
}

async fn fetch_hacker_news_candidates(
    client: &reqwest::Client,
    query: &str,
    limit: usize,
) -> Result<Vec<serde_json::Value>, String> {
    let url = format!(
        "https://hn.algolia.com/api/v1/search?query={}&tags=story&hitsPerPage={}",
        simple_url_encode(query),
        limit.min(10)
    );
    let body = client
        .get(url)
        .header("user-agent", "mud-blog-news-search/1.0")
        .send()
        .await
        .map_err(|error| format!("hacker-news: {error}"))?
        .json::<serde_json::Value>()
        .await
        .map_err(|error| format!("hacker-news: {error}"))?;
    Ok(body["hits"]
        .as_array()
        .into_iter()
        .flatten()
        .take(limit)
        .enumerate()
        .map(|(index, hit)| {
            let object_id = hit["objectID"].as_str().unwrap_or_default();
            let url = hit["url"].as_str().map(str::to_string).unwrap_or_else(|| format!("https://news.ycombinator.com/item?id={object_id}"));
            json!({
                "id": format!("hacker-news-{}", index + 1),
                "title": hit["title"].as_str().or_else(|| hit["story_title"].as_str()).unwrap_or("Hacker News story"),
                "url": url,
                "source": "Hacker News",
                "summary": format!("{} points · {} comments", hit["points"].as_i64().unwrap_or_default(), hit["num_comments"].as_i64().unwrap_or_default()),
                "publishedAt": hit["created_at"].as_str().unwrap_or_default(),
                "origin": "live-search",
                "type": "social"
            })
        })
        .collect())
}

async fn fetch_huggingface_paper_candidates(
    client: &reqwest::Client,
    query: &str,
    limit: usize,
) -> Result<Vec<serde_json::Value>, String> {
    let url = format!(
        "https://huggingface.co/papers?q={}",
        simple_url_encode(query)
    );
    let html = client
        .get(url)
        .header(
            "user-agent",
            "Mozilla/5.0 (compatible; mud-blog-news-search/1.0)",
        )
        .send()
        .await
        .map_err(|error| format!("huggingface-papers: {error}"))?
        .text()
        .await
        .map_err(|error| format!("huggingface-papers: {error}"))?;
    let mut candidates = Vec::new();
    let mut rest = html.as_str();
    while let Some(pos) = rest.find("/papers/") {
        rest = &rest[pos + "/papers/".len()..];
        let paper_id = rest.split(['"', '\'', '?', '#']).next().unwrap_or_default();
        if paper_id.is_empty()
            || candidates.iter().any(|item: &serde_json::Value| {
                item["url"].as_str().unwrap_or_default().ends_with(paper_id)
            })
        {
            continue;
        }
        let title = format!("Hugging Face paper {paper_id}");
        candidates.push(json!({
            "id": format!("huggingface-paper-{}", candidates.len() + 1),
            "title": title,
            "url": format!("https://huggingface.co/papers/{paper_id}"),
            "source": "Hugging Face Papers",
            "summary": "Paper card surfaced from Hugging Face Papers search.",
            "publishedAt": "",
            "origin": "live-search",
            "type": "paper"
        }));
        if candidates.len() >= limit {
            break;
        }
    }
    Ok(candidates)
}

fn html_class_text(block: &str, class_name: &str) -> String {
    let Some(class_pos) = block.find(class_name) else {
        return String::new();
    };
    let Some(open_end) = block[class_pos..].find('>') else {
        return String::new();
    };
    let content_start = class_pos + open_end + 1;
    let close_start = block[content_start..]
        .find("</div>")
        .or_else(|| block[content_start..].find("</h3>"))
        .unwrap_or(block.len() - content_start);
    strip_xml_tags(&block[content_start..content_start + close_start])
}

fn html_link(block: &str) -> (String, String) {
    let search = block
        .find("gs_rt")
        .map(|pos| &block[pos..])
        .unwrap_or(block);
    let Some(link_start) = search.find("<a") else {
        return (String::new(), html_class_text(block, "gs_rt"));
    };
    let link = &search[link_start..];
    let href = ["href=\"", "href='"]
        .iter()
        .find_map(|prefix| {
            let start = link.find(prefix)? + prefix.len();
            let quote = prefix.chars().last()?;
            Some(
                link[start..]
                    .split(quote)
                    .next()
                    .unwrap_or_default()
                    .to_string(),
            )
        })
        .unwrap_or_default();
    let title = link
        .find('>')
        .and_then(|start| link[start + 1..].find("</a>").map(|end| (start, end)))
        .map(|(start, end)| strip_xml_tags(&link[start + 1..start + 1 + end]))
        .unwrap_or_default();
    (decode_xml_text(&href), title)
}

async fn fetch_google_scholar_candidates(
    client: &reqwest::Client,
    query: &str,
    limit: usize,
) -> Result<Vec<serde_json::Value>, String> {
    let url = format!(
        "https://scholar.google.com/scholar?hl=en&q={}",
        simple_url_encode(query)
    );
    let html = client
        .get(&url)
        .header(
            "user-agent",
            "mud-blog-news-search/1.0 (+https://mud.blog/news/search)",
        )
        .send()
        .await
        .map_err(|error| format!("google-scholar: {error}"))?
        .text()
        .await
        .map_err(|error| format!("google-scholar: {error}"))?;
    let mut items = html
        .split("gs_r gs_or")
        .skip(1)
        .take(limit)
        .enumerate()
        .filter_map(|(index, block)| {
            let (url, title) = html_link(block);
            if title.is_empty() {
                return None;
            }
            let meta = html_class_text(block, "gs_a");
            let year = meta
                .split(|ch: char| !ch.is_ascii_digit())
                .find(|part| part.len() == 4 && (part.starts_with("19") || part.starts_with("20")))
                .unwrap_or_default()
                .to_string();
            let summary = html_class_text(block, "gs_rs");
            Some(json!({
                "id": format!("google-scholar-{}", index + 1),
                "title": title,
                "url": url,
                "source": "Google Scholar",
                "summary": if summary.is_empty() { meta } else { summary },
                "publishedAt": if year.is_empty() { String::new() } else { format!("{year}-01-01") },
                "origin": "live-search",
                "type": "paper"
            }))
        })
        .collect::<Vec<_>>();
    if items.is_empty() {
        items.push(json!({
            "id": "google-scholar-search",
            "title": format!("Open Google Scholar results for {query}"),
            "url": url,
            "source": "Google Scholar",
            "summary": "Google Scholar did not expose parseable result cards to this runtime; open the citation search page directly.",
            "publishedAt": "",
            "origin": "live-search",
            "type": "paper"
        }));
    }
    Ok(items)
}

fn dedupe_candidates(candidates: Vec<serde_json::Value>) -> Vec<serde_json::Value> {
    let mut seen = std::collections::HashSet::new();
    let mut unique = Vec::new();
    for candidate in candidates {
        let key = candidate["url"]
            .as_str()
            .filter(|url| !url.is_empty())
            .unwrap_or_else(|| candidate["title"].as_str().unwrap_or_default())
            .to_ascii_lowercase();
        if !key.is_empty() && seen.insert(key) {
            unique.push(candidate);
        }
    }
    unique
}

async fn news_search_handler(
    State(state): State<AppState>,
    Json(request): Json<NewsSearchRequest>,
) -> impl IntoResponse {
    let query = api_query_text(&request);
    if query.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "ok": false, "error": "query required" })),
        )
            .into_response();
    }
    let limit = request.limit.unwrap_or(9).clamp(3, 15);
    let per_source = ((limit as f32 / 3.0).ceil() as usize).max(3);
    let query_plan = plan_local_search_query(&query, &request).await;
    let search_query = if query_plan.search_query.trim().is_empty() {
        query.clone()
    } else {
        query_plan.search_query.clone()
    };
    let keywords = query_plan.keywords.clone();
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());
    let mut warnings = Vec::new();
    if let Some(warning) = query_plan.warning.clone() {
        warnings.push(warning);
    }
    let mut candidates = Vec::new();
    let mut searched = Vec::new();
    for source in selected_news_sources(&request) {
        searched.push(source);
        let result = match source {
            "gdelt" => fetch_gdelt_candidates(&client, &search_query, per_source).await,
            "google-news-rss" => {
                fetch_google_news_candidates(&client, &search_query, per_source).await
            }
            "hacker-news" => fetch_hacker_news_candidates(&client, &search_query, per_source).await,
            "github-repositories" => {
                fetch_github_candidates(&client, &search_query, per_source).await
            }
            "arxiv" => fetch_arxiv_candidates(&client, &search_query, per_source).await,
            "huggingface-papers" => {
                fetch_huggingface_paper_candidates(&client, &search_query, per_source).await
            }
            "openalex" => fetch_openalex_candidates(&client, &search_query, per_source).await,
            "crossref" => fetch_crossref_candidates(&client, &search_query, per_source).await,
            "semantic-scholar" => {
                fetch_semantic_scholar_candidates(&client, &search_query, per_source).await
            }
            "google-scholar" => {
                fetch_google_scholar_candidates(&client, &search_query, per_source).await
            }
            _ => Ok(Vec::new()),
        };
        match result {
            Ok(mut items) => candidates.append(&mut items),
            Err(message) => warnings.push(message),
        }
    }
    let mut candidates = dedupe_candidates(candidates);
    if candidates.is_empty() {
        candidates = ranked_post_sources(&state.posts, &keywords, limit)
            .into_iter()
            .map(|source| {
                json!({
                    "id": source["url"].as_str().unwrap_or_default(),
                    "title": source["title"].as_str().unwrap_or_default(),
                    "url": source["url"].as_str().unwrap_or_default(),
                    "source": "blog news archive",
                    "summary": source["summary"].as_str().unwrap_or_default(),
                    "publishedAt": source["publishedAt"].as_str().unwrap_or_default(),
                    "score": source["score"].as_f64().unwrap_or_default(),
                    "origin": "archive-fallback",
                    "type": "archive"
                })
            })
            .collect();
    }
    let mut candidates = normalize_selected_candidates(candidates, &keywords, limit);
    candidates.truncate(limit);
    Json(json!({
        "ok": true,
        "query": query,
        "queryMode": query_plan.mode,
        "searchQuery": search_query,
        "keywords": keywords,
        "queryPlan": query_plan,
        "searched": searched,
        "candidates": candidates,
        "warning": if warnings.is_empty() { None::<String> } else { Some(warnings.join("; ")) }
    }))
    .into_response()
}

fn normalize_api_keywords(request: &FocusedIssueRequest) -> Vec<String> {
    let mut raw = request
        .keywords
        .as_deref()
        .unwrap_or_default()
        .split([',', ';'])
        .map(str::to_string)
        .collect::<Vec<_>>();
    if let Some(items) = &request.keyword {
        raw.extend(items.iter().cloned());
    }
    let mut keywords = Vec::new();
    for item in raw {
        let trimmed = item.trim();
        if trimmed.is_empty()
            || keywords
                .iter()
                .any(|keyword: &String| keyword.eq_ignore_ascii_case(trimmed))
        {
            continue;
        }
        keywords.push(trimmed.to_string());
    }
    keywords.truncate(6);
    keywords
}

fn ranked_post_sources(
    posts: &[Post],
    keywords: &[String],
    limit: usize,
) -> Vec<serde_json::Value> {
    let mut ranked = posts
        .iter()
        .filter(|post| post.folder == "news")
        .map(|post| {
            let haystack = format!(
                "{} {} {} {}",
                post.title, post.excerpt, post.tags_label, post.body
            )
            .to_lowercase();
            let score = keywords
                .iter()
                .map(|keyword| keyword_score(&haystack, keyword))
                .sum::<f32>();
            (score, post)
        })
        .collect::<Vec<_>>();
    ranked.sort_by(|(left, _), (right, _)| right.total_cmp(left));
    ranked
        .into_iter()
        .take(limit)
        .map(|(score, post)| {
            json!({
                "title": post.title,
                "summary": post.excerpt,
                "url": post.url,
                "source": "blog news archive",
                "publishedAt": post.date,
                "score": (score * 100.0).round() / 100.0
            })
        })
        .collect()
}

fn keyword_score(haystack: &str, keyword: &str) -> f32 {
    let needle = keyword.to_lowercase();
    let mut score = if haystack.contains(&needle) { 5.0 } else { 0.0 };
    for token in needle.split_whitespace().filter(|token| token.len() > 2) {
        if haystack.contains(token) {
            score += 1.5;
        }
    }
    if score == 0.0 { 0.25 } else { score }
}

async fn post_handler(
    State(state): State<AppState>,
    AxumPath(slug): AxumPath<String>,
) -> impl IntoResponse {
    let Some(post) = state.posts.iter().find(|post| post.slug == slug) else {
        return (StatusCode::NOT_FOUND, "post not found").into_response();
    };

    match render_post_page(post, &state.posts) {
        Ok(html) => Html(html).into_response(),
        Err(error) => (StatusCode::INTERNAL_SERVER_ERROR, error.to_string()).into_response(),
    }
}

pub async fn serve(
    posts_dir: impl AsRef<Path>,
    dist_dir: impl AsRef<Path>,
    host: &str,
    port: u16,
) -> BlogResult<()> {
    let build = build_static_site(posts_dir, dist_dir.as_ref()).await?;
    let app = router(build.posts, dist_dir.as_ref())?;
    let listener = TcpListener::bind((host, port)).await?;
    println!("mud-blog listening on http://{}:{}/", host, port);
    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await?;
    Ok(())
}
