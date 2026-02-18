use anyhow::Result;
use blog_core::{build_site, BuildConfig, DataviewJsMode, PublishPolicy, SiteConfig, SiteText};
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
    #[arg(long, default_value = "opt-in", value_parser = ["opt-in", "permissive"])]
    publish_policy: String,
}

fn parse_publish_policy(raw: &str) -> PublishPolicy {
    match raw {
        "permissive" => PublishPolicy::Permissive,
        _ => PublishPolicy::OptIn,
    }
}

fn parse_dataviewjs_mode(raw: &str) -> DataviewJsMode {
    match raw {
        "tag-pages" => DataviewJsMode::TagPages,
        _ => DataviewJsMode::Disabled,
    }
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
        "Built {} posts ({} tags) into {} at {}",
        summary.posts,
        summary.tags,
        summary.output_dir.display(),
        summary.generated_at
    );

    Ok(())
}
