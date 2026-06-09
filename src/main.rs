use std::path::PathBuf;

use mud_blog::{BlogResult, build_static_site, serve};

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
                "unknown command: {other}\nusage: mud-blog [build|serve --host 0.0.0.0 --port 4173]"
            );
            std::process::exit(2);
        }
    }

    Ok(())
}
