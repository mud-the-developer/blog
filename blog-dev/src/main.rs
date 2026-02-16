use anyhow::Result;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::post;
use axum::Router;
use blog_core::{build_site, BuildConfig, SiteConfig};
use clap::Parser;
use std::net::SocketAddr;
use std::path::PathBuf;
use tower_http::services::ServeDir;

#[derive(Clone)]
struct AppState {
    config: BuildConfig,
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
    #[arg(long, default_value = "My Digital Garden")]
    title: String,
    #[arg(long, default_value = "Thoughts, notes, and connected ideas.")]
    description: String,
    #[arg(long, default_value = "Author")]
    author: String,
    #[arg(long, default_value = "en")]
    language: String,
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
        },
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
