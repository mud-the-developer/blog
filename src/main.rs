use std::path::PathBuf;

use mud_blog::{
    BlogResult, build_static_site,
    cfp::{update_cfp_artifacts, validate_cfp_artifacts},
    serve,
};

#[tokio::main]
async fn main() -> BlogResult<()> {
    let mut args = std::env::args().skip(1);
    let command = args.next().unwrap_or_else(|| "build".to_string());

    match command.as_str() {
        "build" => {
            let result = build_static_site("posts", "dist").await?;
            println!(
                "Built {} posts into dist with Tokio + Askama",
                result.posts.len()
            );
        }
        "cfp" => {
            let subcommand = args.next().unwrap_or_else(|| "update".to_string());
            let mut date = None;
            while let Some(arg) = args.next() {
                if arg.as_str() == "--date"
                    && let Some(value) = args.next()
                {
                    date = Some(value);
                }
            }

            match subcommand.as_str() {
                "update" => {
                    let issue = update_cfp_artifacts(".", date.as_deref()).await?;
                    println!(
                        "Updated CFP Radar for {} with {} sources ({} fetched)",
                        issue.issue_date, issue.source_count, issue.fetched_count
                    );
                }
                "validate" => {
                    let issue = validate_cfp_artifacts(".").await?;
                    println!(
                        "Validated CFP Radar for {} with {} sources across {} tracks",
                        issue.issue_date,
                        issue.source_count,
                        issue.tracks.len()
                    );
                }
                other => {
                    eprintln!(
                        "unknown cfp command: {other}\nusage: mud-blog cfp [update|validate] [--date YYYY-MM-DD]"
                    );
                    std::process::exit(2);
                }
            }
        }
        "serve" => {
            let mut host = "127.0.0.1".to_string();
            let mut port = 4173_u16;
            while let Some(arg) = args.next() {
                match arg.as_str() {
                    "--host" => {
                        if let Some(value) = args.next() {
                            host = value;
                        }
                    }
                    "--port" => {
                        if let Some(value) = args.next() {
                            port = value.parse()?;
                        }
                    }
                    _ => {}
                }
            }
            serve(PathBuf::from("posts"), PathBuf::from("dist"), &host, port).await?;
        }
        other => {
            eprintln!(
                "unknown command: {other}\nusage: mud-blog [build|cfp update|cfp validate|serve --host 0.0.0.0 --port 4173]"
            );
            std::process::exit(2);
        }
    }

    Ok(())
}
