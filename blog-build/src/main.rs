use anyhow::Result;
use blog_core::{build_site, BuildConfig, SiteConfig};
use clap::Parser;
use std::path::PathBuf;

#[derive(Debug, Parser)]
#[command(author, version, about = "Build a static digital-garden style blog")]
struct Cli {
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

fn main() -> Result<()> {
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
        "Built {} posts ({} tags) into {} at {}",
        summary.posts,
        summary.tags,
        summary.output_dir.display(),
        summary.generated_at
    );

    Ok(())
}
