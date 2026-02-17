use anyhow::Result;
use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use blog_core::{build_site, BuildConfig, DataviewJsMode, PublishPolicy, SiteConfig, SiteText};
use clap::Parser;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::path::PathBuf;
use tower_http::services::ServeDir;

#[derive(Clone)]
struct AppState {
    config: BuildConfig,
}

#[derive(Debug, Deserialize)]
struct SearchQuery {
    q: Option<String>,
    limit: Option<usize>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct SearchRecord {
    title: String,
    slug: String,
    url: String,
    excerpt: String,
    tags: Vec<String>,
}

#[derive(Debug, Parser)]
#[command(author, version, about = "Serve dist/ with axum for local preview")]
struct Cli {
    #[arg(long, default_value = "127.0.0.1")]
    host: String,
    #[arg(long, default_value_t = 8788)]
    port: u16,
    #[arg(long, default_value = "content/posts")]
    content: PathBuf,
    #[arg(long, default_value = "dist")]
    output: PathBuf,
    #[arg(long, default_value = "static")]
    static_dir: PathBuf,
    #[arg(long, default_value = "http://localhost:8788")]
    site_url: String,
    #[arg(long, default_value = "Mud's Blog")]
    title: String,
    #[arg(long, default_value = "Thoughts, notes, and connected ideas.")]
    description: String,
    #[arg(long, default_value = "Author")]
    author: String,
    #[arg(long, default_value = "en")]
    language: String,
    #[arg(long, default_value = "Search notes...")]
    search_placeholder: String,
    #[arg(long, default_value = "Pages")]
    pages_heading: String,
    #[arg(long, default_value = "On This Page")]
    toc_heading: String,
    #[arg(long, default_value = "Linked Mentions")]
    backlinks_heading: String,
    #[arg(long, default_value = "No linked mentions yet.")]
    backlinks_empty: String,
    #[arg(long, default_value = "disabled", value_parser = ["disabled", "tag-pages"])]
    dataviewjs_mode: String,
    #[arg(long, default_value = "dg-opt-in", value_parser = ["dg-opt-in", "permissive"])]
    publish_policy: String,
}

fn parse_publish_policy(raw: &str) -> PublishPolicy {
    match raw {
        "permissive" => PublishPolicy::Permissive,
        _ => PublishPolicy::DgOptIn,
    }
}

fn parse_dataviewjs_mode(raw: &str) -> DataviewJsMode {
    match raw {
        "tag-pages" => DataviewJsMode::TagPages,
        _ => DataviewJsMode::Disabled,
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    let config = BuildConfig {
        content_dir: cli.content,
        output_dir: cli.output,
        static_dir: cli.static_dir,
        site: SiteConfig {
            base_url: cli.site_url,
            title: cli.title,
            description: cli.description,
            author: cli.author,
            language: cli.language,
            text: SiteText {
                search_placeholder: cli.search_placeholder,
                pages_heading: cli.pages_heading,
                toc_heading: cli.toc_heading,
                backlinks_heading: cli.backlinks_heading,
                backlinks_empty: cli.backlinks_empty,
            },
            dataviewjs_mode: parse_dataviewjs_mode(&cli.dataviewjs_mode),
            ..SiteConfig::default()
        },
        publish_policy: parse_publish_policy(&cli.publish_policy),
    };

    let summary = build_site(&config)?;
    println!(
        "Initial build complete: {} posts into {}",
        summary.posts,
        summary.output_dir.display()
    );

    let state = AppState {
        config: config.clone(),
    };

    let addr: SocketAddr = format!("{}:{}", cli.host, cli.port).parse()?;

    let app = Router::new()
        .route("/api/search", get(search_handler))
        .route("/__rebuild", post(rebuild_handler))
        .with_state(state)
        .fallback_service(ServeDir::new(config.output_dir));

    println!("Preview server: http://{}", addr);
    println!("Manual rebuild: curl -X POST http://{}/__rebuild", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn rebuild_handler(State(state): State<AppState>) -> impl IntoResponse {
    match tokio::task::spawn_blocking(move || build_site(&state.config)).await {
        Ok(Ok(summary)) => (
            StatusCode::OK,
            format!(
                "rebuilt {} posts into {} at {}",
                summary.posts,
                summary.output_dir.display(),
                summary.generated_at
            ),
        ),
        Ok(Err(err)) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("build failed: {err:#}"),
        ),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("build task failed: {err}"),
        ),
    }
}

async fn search_handler(
    State(state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> impl IntoResponse {
    let query_text = query.q.unwrap_or_default();
    let limit = query.limit.unwrap_or(8).clamp(1, 30);
    let index_path = state.config.output_dir.join("search-index.json");

    let raw = match tokio::fs::read_to_string(&index_path).await {
        Ok(raw) => raw,
        Err(err) => {
            return (
                StatusCode::NOT_FOUND,
                format!("search index is missing: {err}"),
            )
                .into_response();
        }
    };

    let records = match serde_json::from_str::<Vec<SearchRecord>>(&raw) {
        Ok(records) => records,
        Err(err) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("search index parse error: {err}"),
            )
                .into_response();
        }
    };

    let results = search_records(records, &query_text, limit);
    (StatusCode::OK, Json(results)).into_response()
}

fn search_records(records: Vec<SearchRecord>, query: &str, limit: usize) -> Vec<SearchRecord> {
    let terms = query
        .split_whitespace()
        .map(|term| term.trim().to_lowercase())
        .filter(|term| !term.is_empty())
        .collect::<Vec<_>>();

    if terms.is_empty() {
        return records.into_iter().take(limit).collect();
    }

    let mut scored = records
        .into_iter()
        .filter_map(|record| {
            let title = record.title.to_lowercase();
            let slug = record.slug.to_lowercase();
            let excerpt = record.excerpt.to_lowercase();
            let tags = record
                .tags
                .iter()
                .map(|tag| tag.to_lowercase())
                .collect::<Vec<_>>();

            let mut score = 0usize;
            for term in &terms {
                if title.starts_with(term) {
                    score += 32;
                }
                if title.contains(term) {
                    score += 20;
                }
                if slug.contains(term) {
                    score += 12;
                }
                if tags.iter().any(|tag| tag.contains(term)) {
                    score += 10;
                }
                if excerpt.contains(term) {
                    score += 5;
                }
            }

            if score == 0 {
                None
            } else {
                Some((score, record))
            }
        })
        .collect::<Vec<_>>();

    scored.sort_by(|a, b| {
        b.0.cmp(&a.0)
            .then_with(|| a.1.title.to_lowercase().cmp(&b.1.title.to_lowercase()))
    });

    scored
        .into_iter()
        .take(limit)
        .map(|(_, record)| record)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{search_records, SearchRecord};

    fn record(title: &str, slug: &str, excerpt: &str, tags: &[&str]) -> SearchRecord {
        SearchRecord {
            title: title.to_string(),
            slug: slug.to_string(),
            url: format!("/notes/{slug}/"),
            excerpt: excerpt.to_string(),
            tags: tags.iter().map(|tag| tag.to_string()).collect(),
        }
    }

    #[test]
    fn empty_query_returns_top_limited_records() {
        let records = vec![
            record("Alpha", "alpha", "a", &[]),
            record("Beta", "beta", "b", &[]),
            record("Gamma", "gamma", "c", &[]),
        ];

        let results = search_records(records, "", 2);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].slug, "alpha");
        assert_eq!(results[1].slug, "beta");
    }

    #[test]
    fn query_scores_title_and_tags() {
        let records = vec![
            record("Rust Rendering", "rust-render", "notes", &["rendering"]),
            record("Graph Notes", "graph-notes", "rust links", &["graph"]),
            record("SEO", "seo", "metadata", &["search"]),
        ];

        let results = search_records(records, "rust render", 5);
        assert!(!results.is_empty());
        assert_eq!(results[0].slug, "rust-render");
    }
}
