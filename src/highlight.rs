//! Zero-dependency static syntax highlighter and fenced code block wrapper.

fn escape_html(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            _ => out.push(ch),
        }
    }
    out
}

fn canonical_lang(raw: &str) -> &str {
    let token = raw
        .split(|c: char| c.is_whitespace() || c == ',' || c == '{')
        .next()
        .unwrap_or("")
        .trim();
    match token.to_ascii_lowercase().as_str() {
        "rs" | "rust" => "rust",
        "py" | "python" | "python3" => "python",
        "js" | "mjs" | "cjs" | "javascript" => "javascript",
        "ts" | "tsx" | "typescript" => "typescript",
        "sh" | "bash" | "zsh" | "shell" => "bash",
        "ps1" | "pwsh" | "powershell" => "powershell",
        "json" => "json",
        "yml" | "yaml" => "yaml",
        "toml" => "toml",
        "go" | "golang" => "go",
        "c" | "h" | "cpp" | "cc" | "cxx" => "cpp",
        "tex" | "latex" => "latex",
        "html" | "xml" | "svg" => "html",
        "css" => "css",
        "md" | "markdown" => "markdown",
        "text" | "txt" | "plain" | "" => "text",
        _ => "text",
    }
}

fn display_lang_label(raw: &str, canon: &str) -> String {
    let token = raw
        .split(|c: char| c.is_whitespace() || c == ',' || c == '{')
        .next()
        .unwrap_or("")
        .trim();
    if token.is_empty() {
        return "code".to_string();
    }
    match canon {
        "rust" => "rust",
        "python" => "python",
        "javascript" => "js",
        "typescript" => "ts",
        "bash" => "bash",
        "powershell" => "powershell",
        "json" => "json",
        "yaml" => "yaml",
        "toml" => "toml",
        "go" => "go",
        "cpp" => "c/c++",
        "latex" => "latex",
        "html" => "html",
        "css" => "css",
        "markdown" => "markdown",
        _ => token,
    }
    .to_string()
}

fn keywords_for(lang: &str) -> &'static [&'static str] {
    match lang {
        "rust" => &[
            "as", "async", "await", "break", "const", "continue", "crate", "dyn", "else", "enum",
            "extern", "false", "fn", "for", "if", "impl", "in", "let", "loop", "match", "mod",
            "move", "mut", "pub", "ref", "return", "self", "Self", "static", "struct", "super",
            "trait", "true", "type", "unsafe", "use", "where", "while",
        ],
        "python" => &[
            "and", "as", "assert", "async", "await", "break", "class", "continue", "def", "del",
            "elif", "else", "except", "False", "finally", "for", "from", "global", "if", "import",
            "in", "is", "lambda", "None", "nonlocal", "not", "or", "pass", "raise", "return",
            "True", "try", "while", "with", "yield",
        ],
        "javascript" | "typescript" => &[
            "as",
            "async",
            "await",
            "break",
            "case",
            "catch",
            "class",
            "const",
            "continue",
            "default",
            "delete",
            "do",
            "else",
            "enum",
            "export",
            "extends",
            "false",
            "finally",
            "for",
            "from",
            "function",
            "if",
            "implements",
            "import",
            "in",
            "instanceof",
            "interface",
            "let",
            "new",
            "null",
            "of",
            "private",
            "protected",
            "public",
            "readonly",
            "return",
            "static",
            "super",
            "switch",
            "this",
            "throw",
            "true",
            "try",
            "type",
            "typeof",
            "undefined",
            "var",
            "void",
            "while",
            "yield",
        ],
        "go" => &[
            "break",
            "case",
            "chan",
            "const",
            "continue",
            "default",
            "defer",
            "else",
            "false",
            "for",
            "func",
            "go",
            "if",
            "import",
            "interface",
            "map",
            "nil",
            "package",
            "range",
            "return",
            "select",
            "struct",
            "switch",
            "true",
            "type",
            "var",
        ],
        "cpp" => &[
            "auto",
            "bool",
            "break",
            "case",
            "catch",
            "char",
            "class",
            "const",
            "constexpr",
            "continue",
            "default",
            "delete",
            "do",
            "double",
            "else",
            "enum",
            "explicit",
            "extern",
            "false",
            "float",
            "for",
            "if",
            "inline",
            "int",
            "long",
            "namespace",
            "new",
            "nullptr",
            "private",
            "protected",
            "public",
            "return",
            "short",
            "signed",
            "sizeof",
            "static",
            "struct",
            "switch",
            "template",
            "this",
            "throw",
            "true",
            "try",
            "typedef",
            "typename",
            "unsigned",
            "using",
            "virtual",
            "void",
            "volatile",
            "while",
        ],
        "bash" | "powershell" => &[
            "case", "do", "done", "elif", "else", "esac", "export", "fi", "for", "function", "if",
            "in", "local", "return", "set", "then", "until", "while",
        ],
        "json" => &["true", "false", "null"],
        "yaml" | "toml" => &["true", "false", "null"],
        _ => &[],
    }
}

fn line_comment_prefix(lang: &str) -> Option<&'static str> {
    match lang {
        "rust" | "javascript" | "typescript" | "go" | "cpp" => Some("//"),
        "python" | "bash" | "powershell" | "yaml" | "toml" => Some("#"),
        "latex" => Some("%"),
        _ => None,
    }
}

pub fn highlight_code(code: &str, raw_lang: &str) -> String {
    let canon = canonical_lang(raw_lang);
    if canon == "text" || canon == "markdown" {
        return escape_html(code);
    }

    let keywords = keywords_for(canon);
    let comment_prefix = line_comment_prefix(canon);
    let mut out = String::with_capacity(code.len() + code.len() / 3);

    for (line_idx, line) in code.split('\n').enumerate() {
        if line_idx > 0 {
            out.push('\n');
        }
        highlight_line(line, canon, keywords, comment_prefix, &mut out);
    }
    out
}

fn highlight_line(
    line: &str,
    lang: &str,
    keywords: &[&str],
    comment_prefix: Option<&str>,
    out: &mut String,
) {
    let bytes = line.as_bytes();
    let len = bytes.len();
    let mut i = 0;

    while i < len {
        // Line comment
        if let Some(prefix) = comment_prefix
            && line[i..].starts_with(prefix)
        {
            out.push_str("<span class=\"tok-c\">");
            out.push_str(&escape_html(&line[i..]));
            out.push_str("</span>");
            return;
        }

        let b = bytes[i];

        // Quoted strings
        if b == b'"'
            || b == b'\''
            || (b == b'`' && matches!(lang, "javascript" | "typescript" | "go"))
        {
            let quote = b;
            let start = i;
            i += 1;
            while i < len {
                if bytes[i] == b'\\' && i + 1 < len {
                    i += 2;
                    continue;
                }
                if bytes[i] == quote {
                    i += 1;
                    break;
                }
                i += 1;
            }
            let slice = &line[start..i];
            // JSON property key detection
            let is_json_key = lang == "json" && line[i..].trim_start().starts_with(':');
            let cls = if is_json_key { "tok-k" } else { "tok-s" };
            out.push_str("<span class=\"");
            out.push_str(cls);
            out.push_str("\">");
            out.push_str(&escape_html(slice));
            out.push_str("</span>");
            continue;
        }

        // LaTeX commands
        if lang == "latex" && b == b'\\' {
            let start = i;
            i += 1;
            while i < len && bytes[i].is_ascii_alphabetic() {
                i += 1;
            }
            out.push_str("<span class=\"tok-k\">");
            out.push_str(&escape_html(&line[start..i]));
            out.push_str("</span>");
            continue;
        }

        // HTML tags
        if lang == "html" && b == b'<' {
            let start = i;
            if let Some(rel_end) = line[i..].find('>') {
                i += rel_end + 1;
                out.push_str("<span class=\"tok-k\">");
                out.push_str(&escape_html(&line[start..i]));
                out.push_str("</span>");
                continue;
            }
        }

        // Numbers
        if b.is_ascii_digit()
            && (i == 0 || !(bytes[i - 1].is_ascii_alphanumeric() || bytes[i - 1] == b'_'))
        {
            let start = i;
            i += 1;
            while i < len
                && (bytes[i].is_ascii_alphanumeric() || bytes[i] == b'.' || bytes[i] == b'_')
            {
                i += 1;
            }
            out.push_str("<span class=\"tok-n\">");
            out.push_str(&escape_html(&line[start..i]));
            out.push_str("</span>");
            continue;
        }

        // Identifiers / keywords / types / YAML & TOML keys
        if b.is_ascii_alphabetic() || b == b'_' {
            let start = i;
            i += 1;
            while i < len
                && (bytes[i].is_ascii_alphanumeric()
                    || bytes[i] == b'_'
                    || (matches!(lang, "yaml" | "toml" | "css") && bytes[i] == b'-'))
            {
                i += 1;
            }
            let word = &line[start..i];
            let is_mapping_key = matches!(lang, "yaml" | "toml")
                && line[..start].trim().is_empty()
                && line[i..]
                    .trim_start()
                    .starts_with(if lang == "yaml" { ':' } else { '=' });
            if is_mapping_key || keywords.contains(&word) {
                out.push_str("<span class=\"tok-k\">");
                out.push_str(&escape_html(word));
                out.push_str("</span>");
            } else if word.chars().next().is_some_and(|c| c.is_ascii_uppercase())
                && matches!(lang, "rust" | "typescript" | "go" | "python" | "cpp")
            {
                out.push_str("<span class=\"tok-t\">");
                out.push_str(&escape_html(word));
                out.push_str("</span>");
            } else if line[i..].starts_with('(')
                && matches!(
                    lang,
                    "rust" | "python" | "javascript" | "typescript" | "go" | "cpp"
                )
            {
                out.push_str("<span class=\"tok-f\">");
                out.push_str(&escape_html(word));
                out.push_str("</span>");
            } else {
                out.push_str(&escape_html(word));
            }
            continue;
        }

        // Copy single UTF-8 char safely
        let ch = line[i..].chars().next().unwrap_or(' ');
        i += ch.len_utf8();
        out.push_str(&escape_html(&ch.to_string()));
    }
}

pub fn render_code_block(code: &str, raw_lang: &str) -> String {
    let canon = canonical_lang(raw_lang);
    let label = display_lang_label(raw_lang, canon);
    let highlighted = highlight_code(code, raw_lang);
    let safe_label = escape_html(&label);
    format!(
        "<div class=\"code-block\" data-lang=\"{canon}\"><div class=\"code-block-bar\"><span class=\"code-block-lang\">{safe_label}</span><button class=\"code-copy-btn\" type=\"button\" data-copy-code aria-label=\"Copy code\">Copy</button></div><pre><code class=\"language-{canon}\">{highlighted}</code></pre></div>"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn highlights_rust_and_wraps_with_copy_button() {
        let html = render_code_block(
            "pub fn add(a: u32) -> u32 {\n  // sum\n  a + 1\n}\n",
            "rust",
        );
        assert!(html.contains("data-lang=\"rust\""));
        assert!(html.contains("data-copy-code"));
        assert!(html.contains("<span class=\"tok-k\">pub</span>"));
        assert!(html.contains("<span class=\"tok-f\">add</span>"));
        assert!(html.contains("<span class=\"tok-c\">// sum</span>"));
        assert!(html.contains("<span class=\"tok-n\">1</span>"));
    }

    #[test]
    fn escapes_html_in_code_blocks() {
        let html = render_code_block("let x = \"<script>alert(1)</script>\";", "js");
        assert!(!html.contains("<script>"));
        assert!(html.contains("&lt;script&gt;"));
    }
}
