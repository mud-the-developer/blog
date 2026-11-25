use std::{fs, path::Path};

use serde::Serialize;

#[derive(Debug, Clone, Serialize, Default)]
pub struct CvProfile {
    pub full_name: String,
    pub position: String,
    pub address: String,
    pub email: String,
    pub homepage: String,
    pub github: String,
    pub scholar_id: String,
    pub linkedin: String,
    pub summary: String,
    pub has_pdf: bool,
    pub pdf_url: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CvEntry {
    pub title: String,
    pub organization: String,
    pub location: String,
    pub period: String,
    pub logo_url: String,
    pub logo_alt: String,
    pub bullets: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CvPublication {
    pub id: String,
    pub venue: String,
    pub venue_short: String,
    pub title: String,
    pub authors_html: String,
    pub authors_plain: String,
    pub year: String,
    pub bibtex: String,
    pub themes: Vec<String>,
    pub themes_csv: String,
    pub note_url: String,
    pub arxiv_url: String,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct CvData {
    pub profile: CvProfile,
    pub education: Vec<CvEntry>,
    pub experience: Vec<CvEntry>,
    pub publications: Vec<CvPublication>,
    pub programs: Vec<CvEntry>,
}

fn strip_latex_comments(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    for line in input.lines() {
        let mut escaped = false;
        let mut cut = line.len();
        for (idx, ch) in line.char_indices() {
            if escaped {
                escaped = false;
                continue;
            }
            if ch == '\\' {
                escaped = true;
                continue;
            }
            if ch == '%' {
                cut = idx;
                break;
            }
        }
        output.push_str(&line[..cut]);
        output.push('\n');
    }
    output
}

fn skip_whitespace(bytes: &[u8], mut idx: usize) -> usize {
    while idx < bytes.len() && bytes[idx].is_ascii_whitespace() {
        idx += 1;
    }
    idx
}

fn parse_braced_arg(input: &str, start: usize) -> Option<(String, usize)> {
    let bytes = input.as_bytes();
    let idx = skip_whitespace(bytes, start);
    if idx >= bytes.len() || bytes[idx] != b'{' {
        return None;
    }
    let mut depth = 0usize;
    let mut escaped = false;
    let mut pos = idx;
    while pos < bytes.len() {
        let b = bytes[pos];
        if escaped {
            escaped = false;
            pos += 1;
            continue;
        }
        if b == b'\\' {
            escaped = true;
            pos += 1;
            continue;
        }
        if b == b'{' {
            depth += 1;
        } else if b == b'}' {
            depth -= 1;
            if depth == 0 {
                return Some((input[idx + 1..pos].to_string(), pos + 1));
            }
        }
        pos += 1;
    }
    None
}

fn extract_macro_args(input: &str, macro_name: &str, arg_count: usize) -> Option<Vec<String>> {
    let needle = format!("\\{macro_name}");
    let mut search_from = 0;
    while let Some(rel) = input[search_from..].find(&needle) {
        let start = search_from + rel + needle.len();
        let next_is_alpha = input[start..]
            .chars()
            .next()
            .is_some_and(|c| c.is_ascii_alphabetic());
        if next_is_alpha {
            search_from = start;
            continue;
        }
        let mut cursor = start;
        let mut args = Vec::with_capacity(arg_count);
        let mut ok = true;
        for _ in 0..arg_count {
            if let Some((arg, next)) = parse_braced_arg(input, cursor) {
                args.push(arg);
                cursor = next;
            } else {
                ok = false;
                break;
            }
        }
        if ok {
            return Some(args);
        }
        search_from = start;
    }
    None
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn normalize_latex_text(raw: &str, allow_html: bool) -> String {
    let pre = raw
        .replace("\\enskip\\cdotp\\enskip", " · ")
        .replace("~~~·~~~", " · ")
        .replace("\\&", "&")
        .replace("\\%", "%")
        .replace("\\_", "_")
        .replace("\\$", "$")
        .replace("---", "—")
        .replace("--", "–")
        .replace('~', " ");

    let mut out = String::with_capacity(pre.len());
    let mut i = 0;
    while i < pre.len() {
        let rest = &pre[i..];
        if let Some(after) = rest.strip_prefix("\\textbf")
            && let Some((inner, consumed)) = parse_braced_arg(after, 0)
        {
            let rendered = normalize_latex_text(&inner, allow_html);
            if allow_html {
                out.push_str("<strong>");
                out.push_str(&rendered);
                out.push_str("</strong>");
            } else {
                out.push_str(&rendered);
            }
            i += "\\textbf".len() + consumed;
            continue;
        }
        if let Some(after) = rest
            .strip_prefix("\\textit")
            .or_else(|| rest.strip_prefix("\\emph"))
            && let Some((inner, consumed)) = parse_braced_arg(after, 0)
        {
            let prefix_len = if rest.starts_with("\\textit") {
                "\\textit".len()
            } else {
                "\\emph".len()
            };
            let rendered = normalize_latex_text(&inner, allow_html);
            if allow_html {
                out.push_str("<em>");
                out.push_str(&rendered);
                out.push_str("</em>");
            } else {
                out.push_str(&rendered);
            }
            i += prefix_len + consumed;
            continue;
        }
        let ch = rest.chars().next().unwrap_or(' ');
        if ch == '{' || ch == '}' {
            i += ch.len_utf8();
            continue;
        }
        if allow_html {
            match ch {
                '&' => out.push_str("&amp;"),
                '<' => out.push_str("&lt;"),
                '>' => out.push_str("&gt;"),
                '"' => out.push_str("&quot;"),
                _ => out.push(ch),
            }
        } else {
            out.push(ch);
        }
        i += ch.len_utf8();
    }

    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn extract_cvitems(block: &str) -> Vec<String> {
    let mut bullets = Vec::new();
    let mut cursor = 0;
    while let Some(rel) = block[cursor..].find("\\item") {
        let after_item = cursor + rel + "\\item".len();
        if let Some((arg, next)) = parse_braced_arg(block, after_item) {
            let cleaned = normalize_latex_text(&arg, false);
            if !cleaned.is_empty() {
                bullets.push(cleaned);
            }
            cursor = next;
        } else {
            let rest = &block[after_item..];
            let end = rest.find('\n').unwrap_or(rest.len());
            let cleaned = normalize_latex_text(&rest[..end], false);
            if !cleaned.is_empty() {
                bullets.push(cleaned);
            }
            cursor = after_item + end;
        }
    }
    bullets
}

fn find_last_logo(before_entry: &str) -> (String, String) {
    let Some(pos) = before_entry.rfind("\\includegraphics") else {
        return (String::new(), String::new());
    };
    let tail = &before_entry[pos + "\\includegraphics".len()..];
    let after_opt = if let Some(rest) = tail.trim_start().strip_prefix('[') {
        rest.find(']').map(|end| &rest[end + 1..]).unwrap_or(tail)
    } else {
        tail
    };
    let Some((raw_path, _)) = parse_braced_arg(after_opt, 0) else {
        return (String::new(), String::new());
    };
    let filename = Path::new(raw_path.trim())
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or_default();
    if filename.is_empty() {
        return (String::new(), String::new());
    }
    let alt = match filename {
        "yonsei_logo.png" => "Yonsei University emblem",
        "sutd_logo.png" => "SUTD emblem",
        "logo_isct.png" => "Institute of Science Tokyo emblem",
        "mwc26_logo.jpg" => "MWC 2026 emblem",
        "mwc25_logo.jpg" => "MWC 2025 emblem",
        _ => "Organization emblem",
    };
    (format!("/assets/cv/{filename}"), alt.to_string())
}

fn parse_cventries(raw: &str) -> Vec<CvEntry> {
    let cleaned = strip_latex_comments(raw);
    let mut entries = Vec::new();
    let mut cursor = 0;
    let mut last_end = 0;
    while let Some(rel) = cleaned[cursor..].find("\\cventry") {
        let start = cursor + rel;
        let mut arg_cursor = start + "\\cventry".len();
        let mut args = Vec::with_capacity(5);
        let mut ok = true;
        for _ in 0..5 {
            if let Some((arg, next)) = parse_braced_arg(&cleaned, arg_cursor) {
                args.push(arg);
                arg_cursor = next;
            } else {
                ok = false;
                break;
            }
        }
        if !ok {
            cursor = start + "\\cventry".len();
            continue;
        }
        let (logo_url, logo_alt) = find_last_logo(&cleaned[last_end..start]);
        entries.push(CvEntry {
            title: normalize_latex_text(&args[0], false),
            organization: normalize_latex_text(&args[1], false),
            location: normalize_latex_text(&args[2], false),
            period: normalize_latex_text(&args[3], false),
            logo_url,
            logo_alt,
            bullets: extract_cvitems(&args[4]),
        });
        last_end = arg_cursor;
        cursor = arg_cursor;
    }
    entries
}

fn short_venue(venue: &str) -> String {
    let lower = venue.to_ascii_lowercase();
    if lower.contains("transactions on communications") {
        "IEEE TCOM".to_string()
    } else if lower.contains("icmlcn") {
        "IEEE ICMLCN".to_string()
    } else if lower.contains("supercomputing") {
        "J. Supercomputing".to_string()
    } else {
        venue.chars().take(28).collect()
    }
}

fn infer_publication_themes(title: &str, venue: &str) -> Vec<String> {
    let hay = format!("{} {}", title, venue).to_ascii_lowercase();
    let mut themes = Vec::new();
    if hay.contains("hybrid") || hay.contains("language model") || hay.contains("llm") {
        themes.push("hybrid-llm".to_string());
    }
    if hay.contains("communication") || hay.contains("compressed transmission") {
        themes.push("semantic-comm".to_string());
    }
    if hay.contains("ran") || hay.contains("beamforming") || hay.contains("mobile") {
        themes.push("ai-ran".to_string());
    }
    if hay.contains("quantum") {
        themes.push("quantum-ai".to_string());
    }
    if themes.is_empty() {
        themes.push("ai-ran".to_string());
    }
    themes
}

fn make_bibtex(venue: &str, title: &str, authors_plain: &str, year: &str) -> (String, String) {
    let is_conf = venue.to_ascii_lowercase().contains("conference");
    let first_author = authors_plain
        .split(',')
        .next()
        .unwrap_or("kim")
        .trim_start_matches('*')
        .split_whitespace()
        .last()
        .unwrap_or("kim")
        .to_ascii_lowercase();
    let first_word = title
        .split(|c: char| !c.is_ascii_alphanumeric())
        .find(|w| w.len() > 3)
        .unwrap_or("paper")
        .to_ascii_lowercase();
    let key = format!("{first_author}{year}{first_word}");
    let bib_authors = authors_plain
        .replace('*', "")
        .replace(", and ", " and ")
        .replace(", ", " and ");
    let entry_type = if is_conf { "inproceedings" } else { "article" };
    let venue_field = if is_conf { "booktitle" } else { "journal" };
    let bibtex = format!(
        "@{entry_type}{{{key},\n  author = {{{bib_authors}}},\n  title = {{{title}}},\n  {venue_field} = {{{venue}}},\n  year = {{{year}}}\n}}"
    );
    (key, bibtex)
}

fn parse_publications(raw: &str) -> Vec<CvPublication> {
    let cleaned = strip_latex_comments(raw);
    let mut pubs = Vec::new();
    let mut cursor = 0;
    while let Some(rel) = cleaned[cursor..].find("\\cventry") {
        let start = cursor + rel;
        let mut arg_cursor = start + "\\cventry".len();
        let mut args = Vec::with_capacity(5);
        let mut ok = true;
        for _ in 0..5 {
            if let Some((arg, next)) = parse_braced_arg(&cleaned, arg_cursor) {
                args.push(arg);
                arg_cursor = next;
            } else {
                ok = false;
                break;
            }
        }
        if !ok {
            cursor = start + "\\cventry".len();
            continue;
        }
        let venue = normalize_latex_text(&args[0], false);
        let title = normalize_latex_text(&args[1], false);
        let authors_html = normalize_latex_text(&args[2], true);
        let authors_plain = normalize_latex_text(&args[2], false);
        let year = normalize_latex_text(&args[3], false);
        let venue_short = short_venue(&venue);
        let themes = infer_publication_themes(&title, &venue);
        let themes_csv = themes.join(",");
        let (id, bibtex) = make_bibtex(&venue, &title, &authors_plain, &year);

        let title_lower = title.to_ascii_lowercase();
        let (note_url, arxiv_url) = if title_lower.contains("uncertainty-aware hybrid inference") {
            (
                String::new(),
                "https://arxiv.org/pdf/2412.12687.pdf".to_string(),
            )
        } else {
            (String::new(), String::new())
        };

        pubs.push(CvPublication {
            id,
            venue,
            venue_short,
            title,
            authors_html,
            authors_plain,
            year,
            bibtex,
            themes,
            themes_csv,
            note_url,
            arxiv_url,
        });
        cursor = arg_cursor;
    }
    pubs
}

fn parse_summary(raw: &str) -> String {
    let cleaned = strip_latex_comments(raw);
    let start = cleaned
        .find("\\begin{cvparagraph}")
        .map(|i| i + "\\begin{cvparagraph}".len())
        .unwrap_or(0);
    let end = cleaned.find("\\end{cvparagraph}").unwrap_or(cleaned.len());
    normalize_latex_text(&cleaned[start..end], false)
}

pub fn load_cv_data(cv_dir: impl AsRef<Path>) -> CvData {
    let root = cv_dir.as_ref();
    let resume_tex = fs::read_to_string(root.join("resume.tex")).unwrap_or_default();
    if resume_tex.trim().is_empty() {
        return default_fallback_cv();
    }
    let cleaned_resume = strip_latex_comments(&resume_tex);

    let full_name = extract_macro_args(&cleaned_resume, "name", 2)
        .map(|args| {
            format!(
                "{} {}",
                normalize_latex_text(&args[0], false),
                normalize_latex_text(&args[1], false)
            )
            .trim()
            .to_string()
        })
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Jinhyuk Kim".to_string());

    let position = extract_macro_args(&cleaned_resume, "position", 1)
        .map(|args| normalize_latex_text(&args[0], false))
        .unwrap_or_else(|| "Ph.D. Student · vRAN / Hybrid LLM / Quantum AI".to_string())
        .replace("Ph.d student", "Ph.D. Student");

    let address = extract_macro_args(&cleaned_resume, "address", 1)
        .map(|args| normalize_latex_text(&args[0], false))
        .unwrap_or_default();
    let email = extract_macro_args(&cleaned_resume, "email", 1)
        .map(|args| normalize_latex_text(&args[0], false))
        .unwrap_or_default();
    let homepage = extract_macro_args(&cleaned_resume, "homepage", 1)
        .map(|args| normalize_latex_text(&args[0], false))
        .unwrap_or_else(|| "mud-blog.pages.dev".to_string());
    let github = extract_macro_args(&cleaned_resume, "github", 1)
        .map(|args| normalize_latex_text(&args[0], false))
        .unwrap_or_else(|| "mud-the-developer".to_string());
    let scholar_id = extract_macro_args(&cleaned_resume, "googlescholar", 2)
        .map(|args| normalize_latex_text(&args[0], false))
        .unwrap_or_else(|| "-Uiul2AAAAAJ".to_string());
    let linkedin = extract_macro_args(&cleaned_resume, "linkedin", 1)
        .map(|args| normalize_latex_text(&args[0], false))
        .unwrap_or_else(|| "mud-the-developer".to_string());

    let summary_raw = fs::read_to_string(root.join("resume/summary.tex")).unwrap_or_default();
    let edu_raw = fs::read_to_string(root.join("resume/education.tex")).unwrap_or_default();
    let exp_raw = fs::read_to_string(root.join("resume/experience.tex")).unwrap_or_default();
    let pub_raw = fs::read_to_string(root.join("resume/publications.tex")).unwrap_or_default();
    let prog_raw = fs::read_to_string(root.join("resume/programs.tex")).unwrap_or_default();

    let has_pdf = root.join("resume.pdf").exists();
    let pdf_url = if has_pdf {
        "/cv/jinhyuk-kim-cv.pdf".to_string()
    } else {
        String::new()
    };

    CvData {
        profile: CvProfile {
            full_name,
            position,
            address,
            email,
            homepage,
            github,
            scholar_id,
            linkedin,
            summary: parse_summary(&summary_raw),
            has_pdf,
            pdf_url,
        },
        education: parse_cventries(&edu_raw),
        experience: parse_cventries(&exp_raw),
        publications: parse_publications(&pub_raw),
        programs: parse_cventries(&prog_raw),
    }
}

fn default_fallback_cv() -> CvData {
    CvData {
        profile: CvProfile {
            full_name: "Jinhyuk Kim".to_string(),
            position: "Ph.D. Student · AI-RAN / Hybrid LLM / Quantum AI".to_string(),
            address: "Seoul, Republic of Korea".to_string(),
            email: "jh.kim@ramo.yonsei.ac.kr".to_string(),
            homepage: "mud-blog.pages.dev".to_string(),
            github: "mud-the-developer".to_string(),
            scholar_id: "-Uiul2AAAAAJ".to_string(),
            linkedin: "mud-the-developer".to_string(),
            summary: "Ph.D. student in the Robotics and Mobile Networks (RAMO) Laboratory at Yonsei University researching AI-native RAN, O-RAN, hybrid LLM inference, semantic communications, and quantum AI.".to_string(),
            has_pdf: false,
            pdf_url: String::new(),
        },
        education: Vec::new(),
        experience: Vec::new(),
        publications: Vec::new(),
        programs: Vec::new(),
    }
}

pub fn escape_attr(value: &str) -> String {
    escape_html(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_real_cv_directory_and_skips_commented_submissions() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("cv");
        let cv = load_cv_data(&root);
        assert_eq!(cv.profile.full_name, "Jinhyuk Kim");
        assert_eq!(cv.profile.email, "jh.kim@ramo.yonsei.ac.kr");
        assert_eq!(cv.profile.github, "mud-the-developer");
        assert_eq!(cv.profile.scholar_id, "-Uiul2AAAAAJ");
        assert!(cv.profile.summary.contains("RAMO"));
        assert_eq!(cv.education.len(), 2);
        assert_eq!(cv.experience.len(), 5);
        assert_eq!(cv.publications.len(), 3);
        assert_eq!(cv.programs.len(), 2);
        let synthetic = parse_publications(
            r#"
\begin{cventries}
  \cventry
  {IEEE Test Conf}
  {Published Paper}
  {\textbf{Jinhyuk Kim}}
  {2026}
  {}
  % \cventry
  %   {Submitted Venue}
  %   {Unpublished Draft}
  %   {\textbf{Jinhyuk Kim}}
  %   {2026}
  %   {}
\end{cventries}
"#,
        );
        assert_eq!(synthetic.len(), 1);
        assert_eq!(synthetic[0].title, "Published Paper");
        assert!(
            cv.publications[0]
                .authors_html
                .contains("<strong>Jinhyuk Kim</strong>")
        );
        assert_eq!(cv.publications[1].note_url, "");
        assert_eq!(
            cv.publications[1].arxiv_url,
            "https://arxiv.org/pdf/2412.12687.pdf"
        );
        assert!(cv.publications[0].bibtex.contains("@article{"));
        assert!(cv.publications[1].bibtex.contains("@inproceedings{"));
        assert_eq!(cv.programs[0].logo_url, "/assets/cv/mwc26_logo.jpg");
    }
}
