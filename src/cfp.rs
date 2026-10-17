use std::{collections::BTreeMap, env, path::Path, time::Duration};

use chrono::{Datelike, FixedOffset, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::fs;

use crate::BlogResult;

const USER_AGENT: &str = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 mud-blog-cfp-radar/0.1 (+https://mud-blog.pages.dev/cfp/)";

const BLOCKED_CFP_SOURCE_PATTERNS: &[&str] = &[
    "waset.org",
    "omics",
    "scirp.org",
    "longdom.org",
    "conferenceindex.org",
    "allconferencealert",
    "10times.com",
    "researchfora",
    "worldresearchlibrary",
    "eurasiaweb",
    "scientificfederation",
    "wi-opt.org/cfp.html",
];

const TRUSTED_CFP_SOURCE_PATTERNS: &[&str] = &[
    "aaai.org",
    "acm-ieee-sec.org",
    "acmsocc.org",
    "acm.org",
    "comsoc.org",
    "conf-icnc.org",
    "eucnc.eu",
    "iclr.cc",
    "icml.cc",
    "ieee.org",
    "ieee-ants.org",
    "ieee-blackseacom.org",
    "ieee-camad.org",
    "ieee-ccnc.org",
    "ieee-cloudnet.org",
    "ieee-cns.org",
    "ieee-cscn.org",
    "ieee-dyspan.org",
    "ieee-globecom.org",
    "ieee-hpsr.org",
    "ieee-icc.org",
    "ieee-icmlcn.org",
    "ieee-infocom.org",
    "ieee-iotj.org",
    "ieee-isit.org",
    "ieee-iwqos.org",
    "ieee-lanman.org",
    "ieee-latincom.org",
    "ieee-meditcom.org",
    "ieee-milcom.org",
    "ieee-netsoft.org",
    "ieee-noms.org",
    "ieee-pimrc.org",
    "ieee-secon.org",
    "ieee-security.org",
    "ieee-wcnc.org",
    "ieeelcn.org",
    "ifip.org",
    "milcom.org",
    "neurips.cc",
    "sciencedirect.com",
    "sigcomm.org",
    "sigmobile.org",
    "sigsac.org",
    "spawc2026.org",
    "usenix.org",
    "vtsociety.org",
    "wi-opt.org",
    "wimob.org",
];

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CfpSource {
    pub title: String,
    pub acronym: String,
    #[serde(default = "default_venue_type", rename = "venueType")]
    pub venue_type: String,
    pub track: String,
    pub url: String,
    #[serde(default, rename = "conferenceDates")]
    pub conference_dates: String,
    pub location: String,
    #[serde(default, rename = "qualityTier")]
    pub quality_tier: String,
    #[serde(default, rename = "rankingSource")]
    pub ranking_source: String,
    #[serde(default, rename = "rankingYear")]
    pub ranking_year: String,
    #[serde(default, rename = "verifiedRank")]
    pub verified_rank: String,
    #[serde(default, rename = "verifiedRankSource")]
    pub verified_rank_source: String,
    #[serde(default, rename = "verifiedRankYear")]
    pub verified_rank_year: String,
    #[serde(default, rename = "impactFactor")]
    pub impact_factor: String,
    #[serde(default, rename = "impactFactorYear")]
    pub impact_factor_year: String,
    pub note: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub deadline: Option<String>,
    #[serde(default)]
    pub edition: Option<i32>,
    #[serde(default, rename = "editionUrlTemplate")]
    pub edition_url_template: Option<String>,
}

fn default_venue_type() -> String {
    "Conference".to_string()
}

#[derive(Debug, Clone, Deserialize)]
struct CfpConfig {
    conferences: Vec<CfpSource>,
}

#[derive(Debug, Clone, Deserialize)]
struct AiDeadlineFinding {
    #[serde(default)]
    deadline: Option<String>,
    #[serde(default)]
    status: String,
    #[serde(default)]
    evidence: String,
    #[serde(default)]
    source_url: String,
}

#[derive(Debug, Clone)]
struct AiDeadlineSignal {
    deadline: Option<String>,
    source_url: String,
    signal: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CfpItem {
    pub title: String,
    pub acronym: String,
    pub venue_type: String,
    pub track: String,
    pub url: String,
    pub conference_dates: String,
    pub location: String,
    pub verified_rank: String,
    pub verified_rank_source: String,
    pub verified_rank_year: String,
    pub impact_factor: String,
    pub impact_factor_year: String,
    pub note: String,
    pub tags: Vec<String>,
    pub configured_deadline: Option<String>,
    pub days_until_deadline: Option<i64>,
    pub deadline_status: String,
    pub fetch_status: String,
    pub deadline_signals: Vec<String>,
    #[serde(default)]
    pub edition: Option<i32>,
    #[serde(default)]
    pub deadline_verified: bool,
    #[serde(default)]
    pub last_verified_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CfpIssue {
    pub generated_at: String,
    pub issue_date: String,
    pub source_count: usize,
    pub active_count: usize,
    pub conference_count: usize,
    pub workshop_count: usize,
    pub journal_count: usize,
    pub with_configured_deadline_count: usize,
    pub fetched_count: usize,
    pub tracks: BTreeMap<String, usize>,
    pub items: Vec<CfpItem>,
}

fn today_kst() -> String {
    let kst = FixedOffset::east_opt(9 * 3600).expect("valid KST offset");
    Utc::now().with_timezone(&kst).date_naive().to_string()
}

fn generated_at_utc() -> String {
    Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

fn days_until(issue_date: &str, deadline: &str) -> Option<i64> {
    let issue = chrono::NaiveDate::parse_from_str(issue_date, "%Y-%m-%d").ok()?;
    let deadline = chrono::NaiveDate::parse_from_str(deadline, "%Y-%m-%d").ok()?;
    Some((deadline - issue).num_days())
}

fn deadline_status(days: Option<i64>) -> String {
    match days {
        Some(days) if days < 0 => "closed".to_string(),
        Some(0) => "due today".to_string(),
        Some(days) if days <= 14 => format!("due in {days} days"),
        Some(days) if days <= 45 => format!("upcoming in {days} days"),
        Some(days) => format!("watching: {days} days out"),
        None => "watching official CFP page".to_string(),
    }
}

fn html_without_comments(input: &str) -> String {
    let mut html = input.to_string();
    while let Some(start) = html.find("<!--") {
        let end = html[start..]
            .find("-->")
            .map(|end| start + end + 3)
            .unwrap_or(html.len());
        html.replace_range(start..end, " ");
    }
    html
}

fn strip_html(input: &str) -> String {
    let mut cleaned = html_without_comments(input);
    for tag in ["script", "style", "noscript", "del", "s", "strike"] {
        for block in crate::xml_blocks(input, tag) {
            cleaned = cleaned.replace(block, " ");
        }
    }
    let mut output = String::with_capacity(cleaned.len());
    let mut in_tag = false;
    for ch in cleaned.chars() {
        match ch {
            '<' => {
                in_tag = true;
                output.push(' ');
            }
            '>' => {
                in_tag = false;
                output.push(' ');
            }
            _ if !in_tag => output.push(ch),
            _ => {}
        }
    }
    output
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

fn compact_whitespace(input: &str) -> String {
    input.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn floor_char_boundary(value: &str, mut index: usize) -> usize {
    index = index.min(value.len());
    while index > 0 && !value.is_char_boundary(index) {
        index -= 1;
    }
    index
}

fn ceil_char_boundary(value: &str, mut index: usize) -> usize {
    index = index.min(value.len());
    while index < value.len() && !value.is_char_boundary(index) {
        index += 1;
    }
    index
}

fn month_number(token: &str) -> Option<u32> {
    let normalized = token
        .trim_matches(|ch: char| !ch.is_ascii_alphabetic())
        .to_ascii_lowercase();
    match normalized.as_str() {
        "jan" | "january" => Some(1),
        "feb" | "february" => Some(2),
        "mar" | "march" => Some(3),
        "apr" | "april" => Some(4),
        "may" => Some(5),
        "jun" | "june" => Some(6),
        "jul" | "july" => Some(7),
        "aug" | "august" => Some(8),
        "sep" | "sept" | "september" => Some(9),
        "oct" | "october" => Some(10),
        "nov" | "november" => Some(11),
        "dec" | "december" => Some(12),
        _ => None,
    }
}

fn numeric_token(token: &str) -> Option<u32> {
    let digits: String = token.chars().take_while(|ch| ch.is_ascii_digit()).collect();
    if digits.is_empty() {
        None
    } else {
        digits.parse().ok()
    }
}

fn year_token(token: &str) -> Option<i32> {
    let digits: String = token.chars().filter(|ch| ch.is_ascii_digit()).collect();
    if digits.len() == 4 {
        digits.parse().ok()
    } else {
        None
    }
}

fn parse_iso_date_token(token: &str) -> Option<chrono::NaiveDate> {
    let cleaned = token.trim_matches(|ch: char| !(ch.is_ascii_digit() || ch == '-'));
    chrono::NaiveDate::parse_from_str(cleaned, "%Y-%m-%d").ok()
}

fn push_unique_date(dates: &mut Vec<chrono::NaiveDate>, date: Option<chrono::NaiveDate>) {
    match date {
        Some(date) if !dates.contains(&date) => dates.push(date),
        _ => {}
    }
}

fn candidate_dates_from_text(text: &str) -> Vec<chrono::NaiveDate> {
    let tokens: Vec<&str> = text.split_whitespace().collect();
    let mut dates = Vec::new();
    for index in 0..tokens.len() {
        push_unique_date(&mut dates, parse_iso_date_token(tokens[index]));
        if index + 2 >= tokens.len() {
            continue;
        }
        if let (Some(day), Some(month), Some(year)) = (
            numeric_token(tokens[index]),
            month_number(tokens[index + 1]),
            year_token(tokens[index + 2]),
        ) {
            push_unique_date(
                &mut dates,
                chrono::NaiveDate::from_ymd_opt(year, month, day),
            );
        }
        if let (Some(month), Some(day), Some(year)) = (
            month_number(tokens[index]),
            numeric_token(tokens[index + 1]),
            year_token(tokens[index + 2]),
        ) {
            push_unique_date(
                &mut dates,
                chrono::NaiveDate::from_ymd_opt(year, month, day),
            );
        }
    }
    dates
}

fn candidate_deadline_dates_from_signal(signal: &str) -> Vec<chrono::NaiveDate> {
    let lowered = signal.to_ascii_lowercase();
    let mut dates = Vec::new();
    for keyword in [
        "submission deadline",
        "paper submission",
        "paper deadline",
        "papers deadline",
        "deadline for paper",
        "manuscript deadline",
        "manuscript submission",
        "papers due",
        "final deadline",
        "extended deadline",
        "extended",
        "extension",
    ] {
        let mut search_from = 0;
        while let Some(relative) = lowered[search_from..].find(keyword) {
            let position = search_from + relative;
            let position = floor_char_boundary(signal, position);
            let context_start = floor_char_boundary(signal, position.saturating_sub(45));
            let context_end = ceil_char_boundary(signal, position + keyword.len());
            let context = signal[context_start..context_end].to_ascii_lowercase();
            let wide_context_start = floor_char_boundary(signal, position.saturating_sub(100));
            let wide_context_end =
                ceil_char_boundary(signal, (position + keyword.len() + 100).min(signal.len()));
            let wide_context = signal[wide_context_start..wide_context_end].to_ascii_lowercase();
            if context.contains("camera")
                || context.contains("notification")
                || context.contains("acceptance")
                || context.contains("registration")
                || [
                    "travel grant",
                    "poster",
                    "demo",
                    "tutorial",
                    "proposal",
                    "revision",
                    "rebuttal",
                    "final version",
                    "final papers",
                ]
                .iter()
                .any(|word| context.contains(word))
                || non_submission_deadline_context(&wide_context)
            {
                search_from = (position + keyword.len()).min(lowered.len());
                continue;
            }
            if context.contains("abstract") && !context.contains("full paper") {
                search_from = (position + keyword.len()).min(lowered.len());
                continue;
            }
            let before_start = floor_char_boundary(signal, position.saturating_sub(90));
            let before = &signal[before_start..position];
            let before_date = candidate_dates_from_text(before)
                .last()
                .copied()
                .filter(|date| {
                    before
                        .rfind(&date.year().to_string())
                        .is_some_and(|offset| {
                            let suffix = &before[offset + 4..];
                            !suffix.contains('.')
                                && suffix.split_whitespace().all(|word| {
                                    matches!(
                                        word.trim_matches(|ch: char| !ch.is_ascii_alphabetic())
                                            .to_ascii_lowercase()
                                            .as_str(),
                                        "" | "paper"
                                            | "papers"
                                            | "manuscript"
                                            | "submission"
                                            | "full"
                                            | "technical"
                                            | "regular"
                                            | "workshop"
                                            | "firm"
                                            | "final"
                                    )
                                })
                        })
                });
            let after_start = ceil_char_boundary(signal, position + keyword.len());
            let after_end = ceil_char_boundary(signal, (after_start + 200).min(signal.len()));
            let after = &signal[after_start..after_end];
            let lowered_after = after.to_ascii_lowercase();
            if matches!(
                keyword,
                "paper submission" | "manuscript submission" | "extended"
            ) && lowered_after.trim_start().starts_with("deadline")
            {
                search_from = (position + keyword.len()).min(lowered.len());
                continue;
            }
            let next_milestone = [
                "notification",
                "acceptance",
                "camera",
                "registration",
                "travel grant",
                "workshop event",
                "event date",
                "conference begins",
                "tutorial",
                "poster",
                "rebuttal",
                "final papers",
            ]
            .iter()
            .filter_map(|label| lowered_after.find(label))
            .min()
            .unwrap_or(after.len());
            let after = &after[..floor_char_boundary(after, next_milestone)];
            let after_dates = candidate_dates_from_text(after);
            let prefer_after = before_date.is_none()
                || (!after_dates.is_empty() && after.trim_start().starts_with(':'));
            push_unique_date(
                &mut dates,
                if prefer_after {
                    after_dates.first().copied()
                } else {
                    before_date
                },
            );
            let after_lowered = after.to_ascii_lowercase();
            if (after_lowered.contains("extended")
                || after_lowered.contains("final deadline")
                || after_lowered.contains("extension"))
                && !non_submission_deadline_context(&after_lowered)
            {
                push_unique_date(
                    &mut dates,
                    after_dates.get(usize::from(prefer_after)).copied(),
                );
            }
            search_from = (position + keyword.len()).min(lowered.len());
        }
    }
    if (lowered.contains("extended")
        || lowered.contains("final deadline")
        || lowered.contains("extension"))
        && let Some(latest) = dates.iter().copied().max()
    {
        return vec![latest];
    }
    dates
}

fn non_submission_deadline_context(context: &str) -> bool {
    let lowered = context.to_ascii_lowercase();
    let positive_submission = [
        "paper submission",
        "papers due",
        "full paper",
        "technical paper",
        "manuscript",
        "abstract",
        "workshop paper",
        "call for workshop papers",
    ]
    .iter()
    .any(|needle| lowered.contains(needle));

    let negative_context = [
        "camera",
        "notification",
        "acceptance",
        "registration",
        "rebuttal",
        "travel grant",
        "student travel",
        "poster",
        "demo",
        "tutorial",
        "final version",
        "material due",
        "proposal",
        "revision",
    ]
    .iter()
    .any(|needle| lowered.contains(needle));

    negative_context && !positive_submission
}

fn select_deadline_date(
    dates: &[chrono::NaiveDate],
    issue: chrono::NaiveDate,
) -> Option<chrono::NaiveDate> {
    dates
        .iter()
        .copied()
        .filter(|date| *date >= issue)
        .min()
        .or_else(|| dates.iter().copied().max())
}

fn inferred_deadline_from_signals(signals: &[String], issue_date: &str) -> Option<String> {
    let issue = chrono::NaiveDate::parse_from_str(issue_date, "%Y-%m-%d").ok()?;
    let dates: Vec<chrono::NaiveDate> = signals
        .iter()
        .flat_map(|signal| candidate_deadline_dates_from_signal(signal))
        .collect();
    Some(select_deadline_date(&dates, issue)?.to_string())
}

fn google_api_key() -> Option<String> {
    ["GOOGLE_AI_API_KEY", "GOOGLE_API_KEY", "GEMINI_API_KEY"]
        .iter()
        .filter_map(|name| env::var(name).ok())
        .map(|value| value.trim().to_string())
        .find(|value| !value.is_empty())
}

fn cfp_ai_model_names() -> Vec<String> {
    let configured = env::var("CFP_AI_MODELS")
        .or_else(|_| env::var("GOOGLE_AI_FALLBACK_MODELS"))
        .unwrap_or_default();
    let primary = env::var("GOOGLE_AI_MODEL").unwrap_or_default();
    let defaults = if primary.trim().is_empty() && configured.trim().is_empty() {
        "models/gemini-2.5-flash-lite"
    } else {
        ""
    };
    let mut names = Vec::new();
    for raw in primary
        .split(',')
        .chain(configured.split(','))
        .chain(defaults.split(','))
    {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }
        let model = if trimmed.starts_with("models/") {
            trimmed.to_string()
        } else {
            format!("models/{trimmed}")
        };
        if !names.contains(&model) {
            names.push(model);
        }
    }
    names
}

fn env_truthy(name: &str) -> bool {
    env::var(name).ok().is_some_and(|value| {
        matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "1" | "true" | "yes" | "on"
        )
    })
}

fn cfp_ai_fallback_enabled() -> bool {
    env_truthy("CFP_AI_FALLBACK_ENABLED") || env_truthy("CFP_AI_FALLBACK")
}

fn cfp_ai_max_requests() -> usize {
    env::var("CFP_AI_MAX_REQUESTS")
        .ok()
        .and_then(|value| value.trim().parse::<usize>().ok())
        .unwrap_or(3)
}

fn cfp_ai_target_tokens() -> Vec<String> {
    env::var("CFP_AI_TARGETS")
        .unwrap_or_default()
        .split(',')
        .map(|token| token.trim().to_ascii_lowercase())
        .filter(|token| !token.is_empty())
        .collect()
}

fn cfp_ai_target_matches(source: &CfpSource, targets: &[String]) -> bool {
    if targets.is_empty() {
        return true;
    }
    let acronym = source.acronym.to_ascii_lowercase();
    let title = source.title.to_ascii_lowercase();
    targets
        .iter()
        .any(|target| acronym == *target || title.contains(target))
}

fn strip_model_thinking(value: &str) -> String {
    let mut output = value.to_string();
    loop {
        let lowered = output.to_ascii_lowercase();
        let Some(start) = lowered.find("<think>") else {
            break;
        };
        let Some(relative_end) = lowered[start..].find("</think>") else {
            break;
        };
        let end = start + relative_end + "</think>".len();
        output.replace_range(start..end, "");
    }
    output.trim().to_string()
}

fn parse_ai_deadline_text(text: &str) -> Option<AiDeadlineFinding> {
    let stripped = strip_model_thinking(text);
    let candidate = if let Some(start) = stripped.find('{') {
        let end = stripped.rfind('}')?;
        &stripped[start..=end]
    } else {
        stripped.as_str()
    };
    serde_json::from_str(candidate).ok()
}

fn trusted_cfp_url(value: &str) -> bool {
    if value
        .chars()
        .any(|ch| ch.is_control() || ch.is_whitespace() || matches!(ch, '<' | '>' | '"' | '`'))
    {
        return false;
    }
    let Ok(url) = reqwest::Url::parse(value) else {
        return false;
    };
    let host = url.host_str().unwrap_or_default();
    matches!(url.scheme(), "https" | "http")
        && url.username().is_empty()
        && url.password().is_none()
        && contains_any(&value.to_ascii_lowercase(), BLOCKED_CFP_SOURCE_PATTERNS).is_none()
        && TRUSTED_CFP_SOURCE_PATTERNS
            .iter()
            .any(|domain| host == *domain || host.ends_with(&format!(".{domain}")))
}

fn trusted_ai_source_url(source_url: &str, source: &CfpSource) -> bool {
    if !trusted_cfp_url(source_url) {
        return false;
    }
    let (Ok(found), Ok(configured)) = (
        reqwest::Url::parse(source_url),
        reqwest::Url::parse(&source.url),
    ) else {
        return false;
    };
    let host = found.host_str().unwrap_or_default();
    let venue = source.acronym.to_ascii_lowercase();
    for domain in [format!("ieee-{venue}.org"), format!("conf-{venue}.org")] {
        if host == domain || host.ends_with(&format!(".{domain}")) {
            return true;
        }
    }
    let normalize_path = |url: &reqwest::Url| {
        edition_in_url(url.as_str())
            .map(|year| url.path().replace(&year.to_string(), "{year}"))
            .unwrap_or_else(|| url.path().to_string())
    };
    host.trim_start_matches("www.")
        == configured
            .host_str()
            .unwrap_or_default()
            .trim_start_matches("www.")
        && normalize_path(&found) == normalize_path(&configured)
}

fn accepted_ai_deadline_signal(
    finding: AiDeadlineFinding,
    source: &CfpSource,
    model: &str,
) -> Option<AiDeadlineSignal> {
    let status = finding.status.to_ascii_lowercase();
    if !matches!(status.as_str(), "found" | "active" | "closed") {
        return None;
    }
    let deadline = finding.deadline.as_deref()?.trim();
    chrono::NaiveDate::parse_from_str(deadline, "%Y-%m-%d").ok()?;
    let evidence = compact_whitespace(&finding.evidence);
    if evidence.len() < 24 || !evidence.to_ascii_lowercase().contains("deadline") {
        return None;
    }
    let source_url = finding.source_url.trim();
    if !trusted_ai_source_url(source_url, source) {
        return None;
    }
    if !candidate_deadline_dates_from_signal(&evidence)
        .iter()
        .any(|date| date.to_string() == deadline)
    {
        return None;
    }
    Some(AiDeadlineSignal {
        deadline: Some(deadline.to_string()),
        source_url: source_url.to_string(),
        signal: format!(
            "AI-assisted official CFP lookup via {model}: {evidence} Source: {source_url}"
        ),
    })
}

fn cfp_ai_prompt(source: &CfpSource, issue_date: &str, fetch_status: &str) -> String {
    format!(
        "Find the official CFP submission deadline for this research venue source. Use only official society, publisher, or venue pages. If the current URL is inaccessible, use Google Search grounding to find the official current page. Do not use WikiCFP, WASET, OMICS, SCIRP, conference-index, allconferencealert, or generic SEO deadline aggregators. Return JSON only with fields: status ('found' or 'not_found'), deadline (YYYY-MM-DD or null), evidence (one short quote containing the deadline wording), source_url (official URL used). Prefer paper/manuscript/submission deadlines over notification, camera-ready, registration, or event dates. Issue date: {issue_date}. Fetch status from crawler: {fetch_status}. Venue title: {}. Acronym: {}. Venue type: {}. Track: {}. Configured URL: {}. Notes: {}.",
        source.title, source.acronym, source.venue_type, source.track, source.url, source.note
    )
}

async fn ai_deadline_signal(
    client: &reqwest::Client,
    source: &CfpSource,
    issue_date: &str,
    fetch_status: &str,
) -> Option<AiDeadlineSignal> {
    let api_key = google_api_key()?;
    let prompt = cfp_ai_prompt(source, issue_date, fetch_status);
    for model in cfp_ai_model_names() {
        let endpoint =
            format!("https://generativelanguage.googleapis.com/v1beta/{model}:generateContent");
        let body = json!({
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "tools": [{"google_search": {}}],
            "generationConfig": {
                "temperature": 0.0,
                "maxOutputTokens": 1200
            }
        });
        let Ok(response) = client
            .post(&endpoint)
            .query(&[("key", api_key.as_str())])
            .json(&body)
            .send()
            .await
        else {
            continue;
        };
        if !response.status().is_success() {
            if matches!(
                response.status().as_u16(),
                400 | 404 | 429 | 500 | 502 | 503 | 504
            ) {
                continue;
            }
            return None;
        }
        let Ok(value) = response.json::<serde_json::Value>().await else {
            continue;
        };
        let text = value["candidates"]
            .as_array()
            .and_then(|candidates| candidates.first())
            .and_then(|candidate| candidate["content"]["parts"].as_array())
            .map(|parts| {
                parts
                    .iter()
                    .filter_map(|part| part["text"].as_str())
                    .collect::<Vec<_>>()
                    .join("\n")
            })
            .unwrap_or_default();
        let Some(finding) = parse_ai_deadline_text(&text) else {
            continue;
        };
        if let Some(signal) = accepted_ai_deadline_signal(finding, source, &model) {
            return Some(signal);
        }
    }
    None
}

fn should_use_ai_deadline_fallback(
    source: &CfpSource,
    fetch_status: &str,
    targets: &[String],
) -> bool {
    if !cfp_ai_fallback_enabled() || !cfp_ai_target_matches(source, targets) {
        return false;
    }
    env_truthy("CFP_AI_ASSIST_ALL_NO_DEADLINE") || fetch_status != "fetched"
}

fn signal_deadline_sort_key(signal: &str, issue: chrono::NaiveDate) -> (u8, i64) {
    let dates = candidate_deadline_dates_from_signal(signal);
    let Some(selected) = select_deadline_date(&dates, issue) else {
        return (2, i64::MAX);
    };
    if selected >= issue {
        (0, (selected - issue).num_days())
    } else {
        (1, (issue - selected).num_days())
    }
}

fn useful_deadline_signal(signal: &str) -> bool {
    let lowered = signal.to_ascii_lowercase();
    if lowered.contains("submission of camera-ready")
        || lowered.contains("submission of camera ready")
    {
        return false;
    }
    if !candidate_deadline_dates_from_signal(signal).is_empty() {
        return true;
    }
    let journal_deadline_evidence = (lowered.contains("special issue")
        || lowered.contains("feature topic")
        || lowered.contains("call for special issue proposals"))
        && (lowered.contains("deadline")
            || lowered.contains("manuscript")
            || lowered.contains("submission"));
    journal_deadline_evidence || lowered.contains("manuscript submission deadline")
}

fn contains_any<'a>(value: &str, patterns: &'a [&'a str]) -> Option<&'a str> {
    patterns
        .iter()
        .copied()
        .find(|pattern| value.contains(pattern))
}

fn validate_source_quality(items: &[CfpItem]) -> BlogResult<()> {
    for item in items {
        let url = item.url.to_ascii_lowercase();
        let haystack = format!(
            "{} {} {} {} {}",
            url,
            item.title.to_ascii_lowercase(),
            item.acronym.to_ascii_lowercase(),
            item.track.to_ascii_lowercase(),
            item.note.to_ascii_lowercase()
        );
        if let Some(pattern) = contains_any(&haystack, BLOCKED_CFP_SOURCE_PATTERNS) {
            return Err(format!(
                "CFP source quality gate rejected {}: blocked low-quality pattern `{}`",
                item.acronym, pattern
            )
            .into());
        }
        if !trusted_cfp_url(&item.url) {
            return Err(format!(
                "CFP source quality gate rejected {}: untrusted CFP domain `{}`; use an official society, publisher, or venue URL and extend the allowlist intentionally if needed",
                item.acronym, item.url
            )
            .into());
        }
    }
    Ok(())
}

fn deadline_signals_from_text(text: &str, issue_date: &str) -> Vec<String> {
    let compact = compact_whitespace(text);
    let text = compact.as_str();
    let lowered = text.to_ascii_lowercase();
    let keywords = [
        "deadline",
        "submission",
        "manuscript",
        "important dates",
        "call for papers",
        "cfp",
    ];
    let mut signals = Vec::new();
    for keyword in keywords {
        let mut search_from = 0;
        while let Some(relative) = lowered[search_from..].find(keyword) {
            let position = search_from + relative;
            let context_before = if matches!(keyword, "important dates" | "call for papers" | "cfp")
            {
                0
            } else {
                90
            };
            let start = floor_char_boundary(text, position.saturating_sub(context_before));
            let end = ceil_char_boundary(text, position + 650);
            let snippet = compact_whitespace(&text[start..end]);
            if snippet.len() > 24
                && useful_deadline_signal(&snippet)
                && !signals.iter().any(|seen| seen == &snippet)
            {
                signals.push(snippet);
            }
            if signals.len() >= 40 {
                break;
            }
            search_from = (position + keyword.len()).min(lowered.len());
        }
        if signals.len() >= 40 {
            break;
        }
    }
    if let Ok(issue) = chrono::NaiveDate::parse_from_str(issue_date, "%Y-%m-%d") {
        signals.sort_by_key(|signal| signal_deadline_sort_key(signal, issue));
    } else {
        signals.sort_by_key(|signal| candidate_deadline_dates_from_signal(signal).is_empty());
    }
    signals.truncate(8);
    signals
}

#[derive(Debug)]
struct CfpPage {
    status: String,
    url: String,
    html: String,
}

#[derive(Clone)]
struct CfpHttpClient {
    primary: reqwest::Client,
    system: reqwest::Client,
}

impl CfpHttpClient {
    async fn get(&self, url: &str) -> Result<reqwest::Response, reqwest::Error> {
        match self.primary.get(url).send().await {
            Ok(response) => Ok(response),
            Err(error) if error.is_timeout() => Err(error),
            Err(_) => self.system.get(url).send().await,
        }
    }
}

fn cfp_http_client(system_tls: bool) -> BlogResult<reqwest::Client> {
    let builder = reqwest::Client::builder()
        .timeout(Duration::from_secs(18))
        .user_agent(USER_AGENT)
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() >= 5 || !trusted_cfp_url(attempt.url().as_str()) {
                attempt.stop()
            } else {
                attempt.follow()
            }
        }));
    Ok(if system_tls {
        builder.use_native_tls()
    } else {
        builder.use_rustls_tls()
    }
    .build()?)
}

async fn fetch_cfp_page(client: &CfpHttpClient, url: &str) -> CfpPage {
    let mut page = CfpPage {
        status: "fetch failed".to_string(),
        url: url.to_string(),
        html: String::new(),
    };
    if !trusted_cfp_url(url) {
        page.status = "untrusted URL".to_string();
        return page;
    }
    let Ok(response) = client.get(url).await else {
        return page;
    };
    if !response.status().is_success() {
        page.status = format!("http {}", response.status());
        return page;
    }
    page.url = response.url().to_string();
    match response.text().await {
        Ok(html) => {
            page.status = "fetched".to_string();
            let frames = cfp_frame_urls(&html, &page.url);
            let has_frames = !frames.is_empty();
            page.html = html;
            for url in frames {
                if let Ok(response) = client.get(&url).await
                    && response.status().is_success()
                    && let Ok(html) = response.text().await
                {
                    page.html.push_str(&html);
                }
            }
            if has_frames {
                let base = reqwest::Url::parse(&page.url).expect("validated source URL");
                let call_url = crate::xml_blocks(&page.html, "a")
                    .into_iter()
                    .find_map(|link| {
                        let (href, label) = crate::html_link(link);
                        let label = label.to_ascii_lowercase();
                        if !label.contains("cfp") && !label.contains("call for paper") {
                            return None;
                        }
                        let url = base.join(&href).ok()?;
                        (trusted_cfp_url(url.as_str()) && !url.path().ends_with(".pdf"))
                            .then_some(url)
                    });
                if let Some(url) = call_url
                    && let Ok(response) = client.get(url.as_str()).await
                    && response.status().is_success()
                {
                    let url = response.url().to_string();
                    if let Ok(html) = response.text().await {
                        page.html.push_str(&html);
                        page.url = url;
                    }
                }
            }
        }
        Err(_) => page.status = "decode failed".to_string(),
    }
    page
}

fn cfp_frame_urls(html: &str, base_url: &str) -> Vec<String> {
    let Ok(base) = reqwest::Url::parse(base_url) else {
        return Vec::new();
    };
    html.split("<frame")
        .skip(1)
        .filter_map(|part| {
            if !part.starts_with(char::is_whitespace) {
                return None;
            }
            let tag = part.split('>').next()?;
            let source = ["src=\"", "src='"].iter().find_map(|prefix| {
                let value = tag.get(tag.find(prefix)? + prefix.len()..)?;
                value.split(prefix.chars().last()?).next()
            })?;
            let url = base.join(source).ok()?;
            trusted_cfp_url(url.as_str()).then(|| url.to_string())
        })
        .take(4)
        .collect()
}

fn source_edition(source: &CfpSource) -> Option<i32> {
    source.edition.or_else(|| edition_in_url(&source.url))
}

fn edition_in_url(url: &str) -> Option<i32> {
    url.split(|ch: char| !ch.is_ascii_digit())
        .filter(|token| token.len() == 4)
        .filter_map(|token| token.parse::<i32>().ok())
        .filter(|year| (2020..=2100).contains(year))
        .max()
        .or_else(|| {
            ["nsdi", "atc", "usenixsecurity", "aaai-", "sec"]
                .iter()
                .find_map(|prefix| {
                    let suffix = url.split(prefix).nth(1)?;
                    let year = suffix.get(..2)?.parse::<i32>().ok()?;
                    (20..=99).contains(&year).then_some(2000 + year)
                })
        })
}

fn next_edition_url(source: &CfpSource, year: i32) -> Option<String> {
    let candidate = if let Some(template) = &source.edition_url_template {
        template.replace("{year}", &year.to_string())
    } else {
        let previous = source_edition(source)?;
        if source.url.contains(&previous.to_string()) {
            source.url.replace(&previous.to_string(), &year.to_string())
        } else {
            let old = format!("{:02}", previous % 100);
            let new = format!("{:02}", year % 100);
            let mut url = source.url.clone();
            for prefix in ["nsdi", "atc", "usenixsecurity", "aaai-", "sec"] {
                url = url.replace(&format!("{prefix}{old}"), &format!("{prefix}{new}"));
            }
            url
        }
    };
    (candidate != source.url && trusted_cfp_url(&candidate)).then_some(candidate)
}

fn confirms_edition(
    page: &CfpPage,
    year: i32,
    issue_date: &str,
    previous_deadline: Option<&str>,
) -> bool {
    let heading = ["title", "h1", "h2"]
        .iter()
        .map(|tag| crate::xml_tag(&page.html, tag))
        .collect::<Vec<_>>()
        .join(" ");
    page.status == "fetched"
        && heading.contains(&year.to_string())
        && edition_in_url(&page.url).is_none_or(|edition| edition == year)
        && inferred_deadline_from_signals(
            &deadline_signals_from_text(&strip_html(&page.html), issue_date),
            issue_date,
        )
        .and_then(|deadline| chrono::NaiveDate::parse_from_str(&deadline, "%Y-%m-%d").ok())
        .is_some_and(|date| {
            (year - 1..=year).contains(&date.year())
                && previous_deadline.is_none_or(|previous| date.to_string().as_str() > previous)
        })
}

fn is_cfp_document_url(value: &str) -> bool {
    let Ok(url) = reqwest::Url::parse(value) else {
        return false;
    };
    let path = url.path().to_ascii_lowercase();
    path.contains("cfp") || (path.contains("call") && path.contains("paper"))
}

fn same_venue_url(source: &CfpSource, base_url: &str, target: &str) -> bool {
    if trusted_ai_source_url(target, source) {
        return true;
    }
    let (Ok(base), Ok(target)) = (reqwest::Url::parse(base_url), reqwest::Url::parse(target))
    else {
        return false;
    };
    let Some((directory, _)) = base.path().rsplit_once('/') else {
        return false;
    };
    base.host_str().map(|host| host.trim_start_matches("www."))
        == target
            .host_str()
            .map(|host| host.trim_start_matches("www."))
        && target.path().starts_with(&format!("{directory}/"))
}

fn official_cfp_link(source: &CfpSource, page: &CfpPage) -> Option<String> {
    if is_cfp_document_url(&page.url) || source.venue_type.to_ascii_lowercase().contains("journal")
    {
        return None;
    }
    let base = reqwest::Url::parse(&page.url).ok()?;
    let edition = edition_in_url(&page.url).or(source.edition);
    let workshop = source.venue_type.to_ascii_lowercase().contains("workshop");
    crate::xml_blocks(&html_without_comments(&page.html), "a")
        .into_iter()
        .filter_map(|link| {
            let (href, label) = crate::html_link(link);
            let url = base.join(&href).ok()?;
            let label = label.to_ascii_lowercase();
            let path = url.path().to_ascii_lowercase();
            let context = format!("{label} {path}");
            let same_venue = same_venue_url(source, &page.url, url.as_str());
            if !trusted_cfp_url(url.as_str())
                || !same_venue
                || url.as_str() == page.url
                || path.ends_with(".pdf")
                || edition
                    .zip(edition_in_url(url.as_str()))
                    .is_some_and(|(expected, found)| expected != found)
                || ["proposal", "poster", "tutorial", "demo"]
                    .iter()
                    .any(|word| context.contains(word))
                || context.contains("workshop") != workshop
            {
                return None;
            }
            let priority = if (label.contains("call") && label.contains("paper"))
                || is_cfp_document_url(url.as_str())
            {
                0
            } else if label.contains("website") && url.host_str() != base.host_str() {
                1
            } else {
                return None;
            };
            Some((priority, url.to_string()))
        })
        .min_by_key(|(priority, _)| *priority)
        .map(|(_, url)| url)
}

async fn resolve_primary_cfp_page(
    client: &CfpHttpClient,
    source: &CfpSource,
    mut page: CfpPage,
    issue_date: &str,
) -> CfpPage {
    for _ in 0..2 {
        let Some(url) = official_cfp_link(source, &page) else {
            break;
        };
        let next = fetch_cfp_page(client, &url).await;
        let same_edition = source
            .edition
            .is_none_or(|year| edition_in_url(&next.url).is_none_or(|found| found == year));
        if next.status != "fetched"
            || !same_edition
            || !same_venue_url(source, &page.url, &next.url)
        {
            page.status = "primary CFP unavailable — verify official link".to_string();
            page.html.clear();
            break;
        }
        page = next;
    }
    if is_cfp_document_url(&page.url)
        && page.status == "fetched"
        && let Some(year) = source.edition
        && !inferred_deadline_from_signals(
            &deadline_signals_from_text(&strip_html(&page.html), issue_date),
            issue_date,
        )
        .and_then(|date| chrono::NaiveDate::parse_from_str(&date, "%Y-%m-%d").ok())
        .is_some_and(|date| (year - 1..=year).contains(&date.year()))
    {
        page.status = "primary CFP has no verified submission date".to_string();
        page.html.clear();
    }
    page
}

async fn resolve_source_page(
    client: &CfpHttpClient,
    mut source: CfpSource,
    issue_date: &str,
    previous: Option<&CfpItem>,
) -> (CfpSource, CfpPage) {
    source.edition = source_edition(&source);
    if let Some(previous) = previous
        && previous.deadline_verified
        && ((previous.edition > source.edition
            && previous.configured_deadline.as_deref() > source.deadline.as_deref())
            || (previous.edition == source.edition
                && is_cfp_document_url(&previous.url)
                && !is_cfp_document_url(&source.url)))
        && trusted_cfp_url(&previous.url)
    {
        source.url = previous.url.clone();
        source.edition = previous.edition;
        source.deadline = None;
        source.conference_dates = previous.conference_dates.clone();
        source.location = previous.location.clone();
        source.note = previous.note.clone();
    }
    let issue_year = chrono::NaiveDate::parse_from_str(issue_date, "%Y-%m-%d")
        .expect("validated issue date")
        .year();
    if let Some(edition) = source.edition
        && edition <= issue_year
        && !source.venue_type.to_ascii_lowercase().contains("journal")
        && let Some(url) = next_edition_url(&source, (edition + 1).max(issue_year))
    {
        let next_year = (edition + 1).max(issue_year);
        let mut next_source = source.clone();
        next_source.url = url.clone();
        next_source.edition = Some(next_year);
        let page = fetch_cfp_page(client, &url).await;
        let page = resolve_primary_cfp_page(client, &next_source, page, issue_date).await;
        let previous_deadline = previous
            .and_then(|item| item.configured_deadline.as_deref())
            .or(source.deadline.as_deref());
        if confirms_edition(&page, next_year, issue_date, previous_deadline) {
            source.note = format!(
                "Official {} {next_year} submission call. Automatically resolved from {}.",
                source.acronym, source.url
            );
            source.url = page.url.clone();
            source.edition = Some(next_year);
            source.deadline = None;
            source.conference_dates = "TBD / official page".to_string();
            source.location = "TBD / official page".to_string();
            return (source, page);
        }
    }
    let page = fetch_cfp_page(client, &source.url).await;
    let page = resolve_primary_cfp_page(client, &source, page, issue_date).await;
    if page.status == "fetched" {
        source.url = page.url.clone();
    }
    (source, page)
}

fn journal_calls_from_html(source: &CfpSource, html: &str) -> Vec<CfpSource> {
    let mut calls = Vec::new();
    let Ok(base) = reqwest::Url::parse(&source.url) else {
        return calls;
    };
    let html = html_without_comments(html);
    for table in crate::xml_blocks(&html, "table") {
        let heading = strip_html(table).to_ascii_lowercase();
        if !heading.contains("submission") || !heading.contains("deadline") {
            continue;
        }
        for row in crate::xml_blocks(table, "tr") {
            let cells = crate::xml_blocks(row, "td");
            if cells.len() < 3 {
                continue;
            }
            let deadline_text = compact_whitespace(&strip_html(cells[cells.len() - 1]));
            if deadline_text.to_ascii_lowercase().contains("closed") {
                continue;
            }
            let Some(deadline) = candidate_dates_from_text(&deadline_text).first().copied() else {
                continue;
            };
            let (href, title) = crate::html_link(cells[0]);
            let Ok(url) = base.join(&href) else {
                continue;
            };
            if href.is_empty() || title.is_empty() || !trusted_cfp_url(url.as_str()) {
                continue;
            }
            let mut call = special_issue_source(source, &title, url.to_string(), deadline);
            call.conference_dates = compact_whitespace(&strip_html(cells[1]));
            calls.push(call);
        }
    }
    for block in crate::xml_blocks(&html, "li") {
        let text = compact_whitespace(&strip_html(block));
        if !text.to_ascii_lowercase().contains("submission deadline") {
            continue;
        }
        let signals = vec![text];
        let Some(deadline) = inferred_deadline_from_signals(&signals, "2000-01-01")
            .and_then(|date| chrono::NaiveDate::parse_from_str(&date, "%Y-%m-%d").ok())
        else {
            continue;
        };
        let (href, title) = crate::html_link(block);
        let Ok(url) = base.join(&href) else { continue };
        if href.is_empty() || title.is_empty() || !trusted_cfp_url(url.as_str()) {
            continue;
        }
        calls.push(special_issue_source(
            source,
            &title,
            url.to_string(),
            deadline,
        ));
    }
    calls.sort_by(|a, b| a.url.cmp(&b.url));
    calls.dedup_by(|a, b| a.url == b.url);
    calls
}

fn special_issue_source(
    source: &CfpSource,
    title: &str,
    url: String,
    deadline: chrono::NaiveDate,
) -> CfpSource {
    let mut call = source.clone();
    call.title = format!(
        "{} — {title}",
        source.title.split(" — ").next().unwrap_or(&source.title)
    );
    call.url = url;
    call.deadline = Some(deadline.to_string());
    call.note = format!(
        "Special issue: {title}. Manuscript submission deadline: {deadline}. Source hub: {}",
        source.url
    );
    call
}

fn has_dated_submission_evidence(item: &CfpItem) -> bool {
    let Some(deadline) = item
        .configured_deadline
        .as_deref()
        .and_then(|date| chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d").ok())
    else {
        return false;
    };
    item.deadline_signals
        .iter()
        .flat_map(|signal| candidate_deadline_dates_from_signal(signal))
        .any(|date| date == deadline)
}

fn item_from_source(
    source: CfpSource,
    fetch_status: String,
    signals: Vec<String>,
    issue_date: &str,
    previous: Option<&CfpItem>,
    verified_deadline: Option<String>,
) -> CfpItem {
    let cached = previous.filter(|item| {
        fetch_status != "fetched"
            && fetch_status != "primary CFP has no verified submission date"
            && item.url == source.url
            && item.deadline_verified
            && has_dated_submission_evidence(item)
    });
    let detected = verified_deadline
        .or_else(|| inferred_deadline_from_signals(&signals, issue_date))
        .filter(|candidate| {
            cached
                .and_then(|item| item.configured_deadline.as_ref())
                .is_none_or(|confirmed| candidate >= confirmed)
        });
    let verified = detected.is_some();
    let deadline = detected
        .or_else(|| cached.and_then(|item| item.configured_deadline.clone()))
        .or(source.deadline);
    let days = deadline
        .as_deref()
        .and_then(|date| days_until(issue_date, date));
    let last_verified_at = if verified {
        Some(generated_at_utc())
    } else {
        cached.and_then(|item| item.last_verified_at.clone())
    };
    CfpItem {
        title: source.title,
        acronym: source.acronym,
        venue_type: configured_or_tbd(&source.venue_type),
        track: source.track,
        url: source.url,
        conference_dates: configured_or_tbd(&source.conference_dates),
        location: source.location,
        verified_rank: source.verified_rank,
        verified_rank_source: source.verified_rank_source,
        verified_rank_year: source.verified_rank_year,
        impact_factor: configured_or_tbd(&source.impact_factor),
        impact_factor_year: source.impact_factor_year,
        note: source.note,
        tags: source.tags,
        configured_deadline: deadline,
        days_until_deadline: days,
        deadline_status: deadline_status(days),
        fetch_status,
        deadline_signals: if signals.is_empty() || (!verified && cached.is_some()) {
            cached
                .map(|item| item.deadline_signals.clone())
                .unwrap_or_default()
        } else {
            signals
        },
        edition: source.edition,
        deadline_verified: verified || cached.is_some(),
        last_verified_at,
    }
}

fn markdown_escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('|', "\\|")
        .replace(['\r', '\n'], " ")
        .replace('[', "\\[")
        .replace(']', "\\]")
        .replace('*', "\\*")
        .replace('_', "\\_")
        .replace('`', "\\`")
}

fn configured_or_tbd(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        "TBD / official page".to_string()
    } else {
        trimmed.to_string()
    }
}

fn deadline_label(item: &CfpItem) -> String {
    item.configured_deadline
        .as_ref()
        .map(|deadline| {
            if !item.deadline_verified {
                format!("{deadline} (unverified — check official page)")
            } else if item.fetch_status != "fetched" {
                format!(
                    "{deadline} ({}) · cached; verify official page",
                    item.deadline_status
                )
            } else {
                format!("{deadline} ({})", item.deadline_status)
            }
        })
        .unwrap_or_else(|| {
            if item.fetch_status == "fetched" {
                "No dated CFP posted on official page".to_string()
            } else if item.fetch_status.starts_with("http")
                || item.fetch_status == "fetch failed"
                || item.fetch_status.starts_with("primary CFP")
            {
                "Fetch blocked — verify official link".to_string()
            } else {
                "TBD / official page".to_string()
            }
        })
}

fn impact_label(item: &CfpItem) -> String {
    let impact = item.impact_factor.trim();
    let year = item.impact_factor_year.trim();
    match (impact.is_empty(), year.is_empty()) {
        (true, _) => "N/A / verify official metric source".to_string(),
        (false, true) => impact.to_string(),
        (false, false) => format!("{impact} ({year})"),
    }
}

fn verified_rank_label(item: &CfpItem) -> String {
    let rank = item.verified_rank.trim();
    if rank.is_empty() {
        "—".to_string()
    } else {
        rank.to_string()
    }
}

fn verified_rank_source_label(item: &CfpItem) -> String {
    if item.verified_rank.trim().is_empty() {
        return "—".to_string();
    }
    let source = item.verified_rank_source.trim();
    let year = item.verified_rank_year.trim();
    match (source.is_empty(), year.is_empty()) {
        (true, _) => "verified source needed".to_string(),
        (false, true) => source.to_string(),
        (false, false) => format!("{source} ({year})"),
    }
}

fn compact_metric_label(item: &CfpItem) -> String {
    let impact = item.impact_factor.trim();
    if impact.is_empty()
        || impact.starts_with("N/A")
        || impact.eq_ignore_ascii_case("TBD")
        || impact.eq_ignore_ascii_case("TBD / official page")
        || impact.contains("update from latest")
        || impact.contains("annual refresh")
        || impact.contains("verify")
    {
        "—".to_string()
    } else {
        impact_label(item)
    }
}

fn has_verified_rank_or_metric(item: &CfpItem) -> bool {
    verified_rank_label(item) != "—"
        || verified_rank_source_label(item) != "—"
        || compact_metric_label(item) != "—"
}

fn is_wireless_or_communications(item: &CfpItem) -> bool {
    let track = item.track.to_ascii_lowercase();
    let tags = item.tags.join(" ").to_ascii_lowercase();
    [
        "wireless",
        "communication",
        "ran",
        "6g",
        "spectrum",
        "vehicular",
    ]
    .iter()
    .any(|needle| track.contains(needle) || tags.contains(needle))
}

fn is_journal(item: &CfpItem) -> bool {
    item.venue_type.to_ascii_lowercase().contains("journal")
}

fn journal_special_issue_signal_evidence(item: &CfpItem) -> bool {
    item.deadline_signals.iter().any(|signal| {
        let lowered = signal.to_ascii_lowercase();
        lowered.contains("special issue")
            || lowered.contains("feature topic")
            || lowered.contains("manuscript submission deadline")
            || lowered.contains("submission deadline")
            || lowered.contains("call for special issue proposals")
    })
}

fn is_workshop(item: &CfpItem) -> bool {
    item.venue_type.to_ascii_lowercase().contains("workshop")
}

fn is_conference(item: &CfpItem) -> bool {
    !is_journal(item) && !is_workshop(item)
}

fn deadline_sort_value(item: &CfpItem) -> i64 {
    item.days_until_deadline.unwrap_or(i64::MAX)
}

fn sorted_item_refs<'a>(items: impl Iterator<Item = &'a CfpItem>) -> Vec<&'a CfpItem> {
    let mut refs: Vec<&CfpItem> = items.collect();
    refs.sort_by(|a, b| {
        deadline_sort_value(a)
            .cmp(&deadline_sort_value(b))
            .then_with(|| a.track.cmp(&b.track))
            .then_with(|| a.acronym.cmp(&b.acronym))
    });
    refs
}

fn venue_cell(item: &CfpItem) -> String {
    let short = item
        .acronym
        .strip_suffix(" CFP")
        .or_else(|| item.acronym.strip_suffix(" SI"))
        .unwrap_or(&item.acronym);
    let short = match item.edition {
        Some(year) => format!("{short} {year}"),
        None => short.to_string(),
    };
    let escape = |text: &str| {
        text.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('|', "&#124;")
            .replace(['\r', '\n'], " ")
    };
    let (full, topic) = if is_journal(item) {
        item.title
            .split_once(" — ")
            .map(|(full, topic)| (full, Some(topic)))
            .unwrap_or((&item.title, None))
    } else {
        (item.title.as_str(), None)
    };
    let topic = topic
        .map(|topic| format!("<span class=\"cfp-venue-topic\">{}</span>", escape(topic)))
        .unwrap_or_default();
    format!(
        "<details class=\"cfp-venue\"><summary><span class=\"cfp-venue-name\">{}</span>{topic}</summary><span class=\"cfp-venue-full\">{}</span></details>",
        escape(&short),
        escape(full)
    )
}

fn render_watchlist_table(output: &mut String, items: &[&CfpItem]) {
    if items.is_empty() {
        output.push_str(
            "No sources configured for this group yet.

",
        );
        return;
    }
    output.push_str("<div class=\"cfp-table-scroll cfp-watchlist-table\" role=\"region\" aria-label=\"CFP watchlist\" tabindex=\"0\">\n\n");
    let show_rank_columns = items.iter().any(|item| has_verified_rank_or_metric(item));
    if show_rank_columns {
        output.push_str(
            "| Venue | Deadline | Field | Dates | Location | Verified rank | Rank source | Metric | Link |
",
        );
        output.push_str(
            "| --- | --- | --- | --- | --- | --- | --- | --- | --- |
",
        );
    } else {
        output.push_str(
            "| Venue | Deadline | Field | Dates | Location | Link |
",
        );
        output.push_str(
            "| --- | --- | --- | --- | --- | --- |
",
        );
    }
    for item in items {
        let venue = venue_cell(item);
        let cfp_link = format!(
            "[<span class=\"ui-icon\" data-icon=\"external-link\"></span> CFP]({})",
            item.url
        );
        if show_rank_columns {
            output.push_str(&format!(
                "| {} | {} | {} | {} | {} | {} | {} | {} | {} |\n",
                venue,
                markdown_escape(&deadline_label(item)),
                markdown_escape(&item.track),
                markdown_escape(&item.conference_dates),
                markdown_escape(&item.location),
                markdown_escape(&verified_rank_label(item)),
                markdown_escape(&verified_rank_source_label(item)),
                markdown_escape(&compact_metric_label(item)),
                cfp_link
            ));
        } else {
            output.push_str(&format!(
                "| {} | {} | {} | {} | {} | {} |\n",
                venue,
                markdown_escape(&deadline_label(item)),
                markdown_escape(&item.track),
                markdown_escape(&item.conference_dates),
                markdown_escape(&item.location),
                cfp_link
            ));
        }
    }
    output.push_str("\n</div>\n\n");
}

fn percent_encode(input: &str) -> String {
    let mut out = String::with_capacity(input.len() * 2);
    for b in input.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => {
                out.push_str(&format!("%{b:02X}"));
            }
        }
    }
    out
}

fn google_calendar_url(item: &CfpItem) -> Option<String> {
    let deadline = item.configured_deadline.as_deref()?;
    let naive_date = chrono::NaiveDate::parse_from_str(deadline, "%Y-%m-%d").ok()?;
    let next_date = naive_date + chrono::Days::new(1);
    let dates_param = format!(
        "{}/{}",
        naive_date.format("%Y%m%d"),
        next_date.format("%Y%m%d")
    );
    let title = format!("[CFP] {} ({}) Submission", item.acronym, item.venue_type);
    let details = format!(
        "Track: {}\nDeadline Status: {}\nOfficial CFP Page: {}\nNote: {}",
        item.track, item.deadline_status, item.url, item.note
    );

    let mut url = String::from("https://calendar.google.com/calendar/render?action=TEMPLATE");
    url.push_str("&text=");
    url.push_str(&percent_encode(&title));
    url.push_str("&dates=");
    url.push_str(&dates_param);
    url.push_str("&details=");
    url.push_str(&percent_encode(&details));
    if !item.location.is_empty() && item.location != "TBD / official page" {
        url.push_str("&location=");
        url.push_str(&percent_encode(&item.location));
    }
    Some(url)
}

fn venue_label(item: &CfpItem) -> String {
    match item.edition {
        Some(year) => format!("{} ({} {year})", item.title, item.acronym),
        None => format!("{} ({})", item.title, item.acronym),
    }
}

fn ics_escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('\r', "")
        .replace('\n', "\\n")
        .replace(';', "\\;")
        .replace(',', "\\,")
}

fn push_ics_line(output: &mut String, line: &str) {
    let mut rest = line;
    let mut width = 75;
    while rest.len() > width {
        let split = floor_char_boundary(rest, width);
        output.push_str(&rest[..split]);
        output.push_str("\r\n ");
        rest = &rest[split..];
        width = 74;
    }
    output.push_str(rest);
    output.push_str("\r\n");
}

fn render_ics(issue: &CfpIssue) -> String {
    let mut out = String::new();
    out.push_str("BEGIN:VCALENDAR\r\n");
    out.push_str("VERSION:2.0\r\n");
    out.push_str("PRODID:-//Mud's Blog//CFP Radar//EN\r\n");
    out.push_str("CALSCALE:GREGORIAN\r\n");
    out.push_str("METHOD:PUBLISH\r\n");
    out.push_str("X-WR-CALNAME:CFP Radar Deadlines\r\n");
    out.push_str("X-WR-TIMEZONE:Asia/Seoul\r\n");

    let now_stamp = chrono::DateTime::parse_from_rfc3339(&issue.generated_at)
        .expect("validated generation timestamp")
        .with_timezone(&Utc)
        .format("%Y%m%dT%H%M%SZ")
        .to_string();

    for item in &issue.items {
        if !item.deadline_verified || !item.days_until_deadline.is_some_and(|days| days >= 0) {
            continue;
        }
        if let Some(deadline) = &item.configured_deadline
            && let Ok(dt) = chrono::NaiveDate::parse_from_str(deadline, "%Y-%m-%d")
        {
            let dt_start = dt.format("%Y%m%d").to_string();
            let dt_end = (dt + chrono::Days::new(1)).format("%Y%m%d").to_string();
            let uid = format!(
                "{}@mud-blog.pages.dev",
                percent_encode(&format!("{}:{}", item.url, item.title))
            );

            out.push_str("BEGIN:VEVENT\r\n");
            push_ics_line(&mut out, &format!("UID:{uid}"));
            out.push_str(&format!("DTSTAMP:{now_stamp}\r\n"));
            out.push_str(&format!("DTSTART;VALUE=DATE:{dt_start}\r\n"));
            out.push_str(&format!("DTEND;VALUE=DATE:{dt_end}\r\n"));
            push_ics_line(
                &mut out,
                &format!(
                    "SUMMARY:{}",
                    ics_escape(&format!("[CFP] {} Submission Deadline", venue_label(item)))
                ),
            );
            push_ics_line(
                &mut out,
                &format!(
                    "DESCRIPTION:{}",
                    ics_escape(&format!(
                        "Field: {}\nStatus: {}\nOfficial CFP: {}\nNote: {}",
                        item.track, item.deadline_status, item.url, item.note
                    ))
                ),
            );
            push_ics_line(&mut out, &format!("URL:{}", item.url));
            if !item.location.is_empty() && item.location != "TBD / official page" {
                push_ics_line(
                    &mut out,
                    &format!("LOCATION:{}", ics_escape(&item.location)),
                );
            }
            out.push_str("END:VEVENT\r\n");
        }
    }

    out.push_str("END:VCALENDAR\r\n");
    out
}

fn render_deadline_radar(output: &mut String, issue: &CfpIssue) {
    output.push_str("## Nearest submission deadlines\n\n");
    output.push_str("Configured or automatically detected open deadlines, sorted from the current issue date. Items without an official date signal stay in the grouped watchlists below.\n\n");
    let upcoming = sorted_item_refs(issue.items.iter().filter(|item| {
        item.deadline_verified && item.days_until_deadline.is_some_and(|days| days >= 0)
    }));
    if upcoming.is_empty() {
        output.push_str("No open configured or detected submission deadlines are available yet; check the grouped watchlists below for official CFP pages being monitored.\n\n");
        return;
    }
    output.push_str("<div class=\"cfp-table-scroll cfp-radar-table\" role=\"region\" aria-label=\"Nearest CFP deadlines\" tabindex=\"0\">\n\n");
    output.push_str("| Deadline | Venue | Kind | Field | Link |\n");
    output.push_str("| --- | --- | --- | --- | --- |\n");
    for item in upcoming.iter().take(12) {
        let venue = venue_cell(item);
        let link_col = match google_calendar_url(item) {
            Some(gcal) => format!(
                "[<span class=\"ui-icon\" data-icon=\"external-link\"></span> CFP]({}) · [<span class=\"ui-icon\" data-icon=\"calendar-plus\"></span> + GCal]({})",
                item.url, gcal
            ),
            None => format!(
                "[<span class=\"ui-icon\" data-icon=\"external-link\"></span> CFP]({})",
                item.url
            ),
        };
        output.push_str(&format!(
            "| {} | {} | {} | {} | {} |\n",
            markdown_escape(&deadline_label(item)),
            venue,
            markdown_escape(&item.venue_type),
            markdown_escape(&item.track),
            link_col
        ));
    }
    output.push_str("\n</div>\n\n");
}

fn render_type_preview(output: &mut String, title: &str, items: Vec<&CfpItem>) {
    output.push_str(&format!("### {title}\n\n"));
    let mut ranked: Vec<&CfpItem> = items
        .into_iter()
        .filter(|item| !item.days_until_deadline.is_some_and(|days| days < 0))
        .collect();
    ranked.sort_by(|a, b| {
        b.deadline_verified
            .cmp(&a.deadline_verified)
            .then_with(|| deadline_sort_value(a).cmp(&deadline_sort_value(b)))
            .then_with(|| a.acronym.cmp(&b.acronym))
    });
    let preview: Vec<&CfpItem> = ranked.into_iter().take(3).collect();
    render_watchlist_table(output, &preview);
}

fn render_markdown(issue: &CfpIssue) -> String {
    let mut output = String::new();
    output.push_str("---\n");
    output.push_str(&format!("title: \"CFP Radar — {}\"\n", issue.issue_date));
    output.push_str(&format!("date: {}\n", issue.issue_date));
    output.push_str("slug: cfp-radar\n");
    output.push_str("tags:\n  - cfp\n  - conferences\n  - workshops\n  - journals\n  - special-issues\n  - wireless\n  - communications\nexcerpt: \"Weekly Call For Papers Dashboard with nearest submission deadlines, 1-click Google Calendar add links, and grouped watchlists for wireless/communications venues.\"\n---\n\n");
    output.push_str("Weekly CFP radar for conferences, workshops, and journal special issues relevant to wireless communications, RAN/6G, networking, edge systems, AI systems, and security. Dates are operational leads: always verify the linked official CFP page before planning a submission.\n\n");
    output.push_str("<div class=\"cfp-calendar-sync-banner\"><span class=\"ui-icon\" data-icon=\"calendar\"></span> <strong>1-Click Calendar Sync:</strong> <a class=\"cfp-sync-link\" href=\"webcal://mud-blog.pages.dev/cfp/radar.ics\"><span class=\"ui-icon\" data-icon=\"calendar-plus\"></span><span>Subscribe via Webcal</span></a> <span class=\"cfp-sync-sep\">|</span> <a class=\"cfp-sync-link\" href=\"/cfp/radar.ics\" download><span class=\"ui-icon\" data-icon=\"download\"></span><span>Download .ics</span></a></div>\n\n");
    output.push_str(&format!("**Last refreshed:** `{}` · **{} confirmed open** · **{}/{} sources fetched**. Expand a venue to see its full name or special-issue topic. Tables scroll horizontally on narrow screens.\n\n", issue.generated_at, issue.active_count, issue.fetched_count, issue.source_count));
    output.push_str("<details class=\"cfp-collection-details\">\n<summary>Collection status and source policy</summary>\n\n");
    let wireless_count = issue
        .items
        .iter()
        .filter(|item| is_wireless_or_communications(item))
        .count();
    output.push_str("## Snapshot\n\n");
    output.push_str(&format!("- Generated: `{}`\n", issue.generated_at));
    output.push_str(&format!("- Sources watched: **{}**\n", issue.source_count));
    output.push_str(&format!(
        "- Confirmed open submission deadlines: **{}**\n",
        issue.active_count
    ));
    output.push_str(&format!("- Conferences: **{}**\n", issue.conference_count));
    output.push_str(&format!("- Workshops: **{}**\n", issue.workshop_count));
    output.push_str(&format!(
        "- Journal special-issue entries: **{}**\n",
        issue.journal_count
    ));
    output.push_str(&format!(
        "- Wireless / communications-heavy entries: **{}**\n",
        wireless_count
    ));
    output.push_str(&format!(
        "- Sources fetched this run: **{}**\n",
        issue.fetched_count
    ));
    output.push_str(&format!(
        "- Entries with configured or detected deadlines: **{}**\n\n",
        issue.with_configured_deadline_count
    ));

    output.push_str("## Source quality filters\n\n");
    output.push_str("- Sources are limited to official society, publisher, or venue domains; low-signal CFP aggregators are rejected during validation.\n");
    output.push_str("- Fetched journal-special rows must expose special-issue, feature-topic, or manuscript-deadline evidence on the official page.\n");
    output.push_str("- Next editions are adopted only after their official page and a submission date are confirmed. A failed candidate URL never replaces the last known edition.\n");
    output.push_str("- Configured dates without official evidence are marked unverified and excluded from the deadline radar and calendar. Fetch failures retain last-confirmed dates with a cached warning.\n\n");

    output.push_str("</details>\n\n");
    render_deadline_radar(&mut output, issue);

    output.push_str("## Three-by-three quick view\n\n");
    output.push_str(
        "Three compact rows per venue type, keeping only the fields needed for quick scanning.\n\n",
    );
    render_type_preview(
        &mut output,
        "Conferences",
        issue
            .items
            .iter()
            .filter(|item| is_conference(item))
            .collect(),
    );
    render_type_preview(
        &mut output,
        "Workshops",
        issue
            .items
            .iter()
            .filter(|item| is_workshop(item))
            .collect(),
    );
    render_type_preview(
        &mut output,
        "Journal special issues",
        issue.items.iter().filter(|item| is_journal(item)).collect(),
    );

    output.push_str("## Full grouped watchlists\n\n");
    output.push_str("### Conferences\n\n");
    let conferences = sorted_item_refs(issue.items.iter().filter(|item| {
        is_conference(item) && !item.days_until_deadline.is_some_and(|days| days < 0)
    }));
    render_watchlist_table(&mut output, &conferences);

    output.push_str("### Workshops\n\n");
    let workshops = sorted_item_refs(issue.items.iter().filter(|item| {
        is_workshop(item) && !item.days_until_deadline.is_some_and(|days| days < 0)
    }));
    render_watchlist_table(&mut output, &workshops);

    output.push_str("### Journal special issues\n\n");
    let journals =
        sorted_item_refs(issue.items.iter().filter(|item| {
            is_journal(item) && !item.days_until_deadline.is_some_and(|days| days < 0)
        }));
    render_watchlist_table(&mut output, &journals);

    output.push_str("## Closed / previous editions\n\n<details>\n<summary>Closed calls retained for reference; next editions are checked daily</summary>\n\n");
    let closed = sorted_item_refs(
        issue
            .items
            .iter()
            .filter(|item| item.days_until_deadline.is_some_and(|days| days < 0)),
    );
    render_watchlist_table(&mut output, &closed);
    output.push_str("</details>\n\n");

    output.push_str(
        "<details class=\"cfp-collection-details\">\n<summary>Ranking policy</summary>\n\n",
    );
    output.push_str("- **Verified-rank only:** table rank cells stay `—` unless a concrete source/year is recorded, such as CORE A*/A/B/C, CCF A/B/C, SCImago/JCR Q1/Q2, or an official society flagship statement.\n");
    output.push_str("- **No proxy levels:** conferences and workshops do not use journal Impact Factors or journal-style Q1/Q2 quartiles. Heuristic labels such as top-tier, flagship, or specialized are not shown as verified rank.\n");
    output.push_str("- **Annual refresh:** verified rank and journal metrics must be refreshed when new JCR/SJR/CORE/CCF releases are available.\n\n");

    output.push_str("</details>\n\n## Detailed source evidence\n\n");
    output.push_str(&format!("<details class=\"cfp-collection-details\">\n<summary>Inspect all {} source evidence records</summary>\n\n", issue.items.len()));
    output.push_str("Audit trail for the official-page snippets used by the crawler. Use this section for verification; the deadline radar and quick view above are the readable operating view.\n\n");
    for item in &issue.items {
        output.push_str(&format!("### {}\n\n", markdown_escape(&venue_label(item))));
        output.push_str(&format!("- Type: {}\n", item.venue_type));
        output.push_str(&format!("- Field: {}\n", item.track));
        output.push_str(&format!(
            "- Event / issue dates: {}\n",
            item.conference_dates
        ));
        output.push_str(&format!("- Location: {}\n", item.location));
        if has_verified_rank_or_metric(item) {
            output.push_str(&format!("- Verified rank: {}\n", verified_rank_label(item)));
            output.push_str(&format!(
                "- Rank source: {}\n",
                verified_rank_source_label(item)
            ));
            output.push_str(&format!("- Metric: {}\n", compact_metric_label(item)));
        }
        output.push_str(&format!("- Source: [{}]({})\n", item.url, item.url));
        output.push_str(&format!("- Fetch status: `{}`\n", item.fetch_status));
        if let Some(deadline) = &item.configured_deadline {
            output.push_str(&format!(
                "- Configured deadline: `{deadline}` ({})\n",
                item.deadline_status
            ));
        }
        output.push_str(&format!(
            "- Date verified: **{}**\n",
            item.deadline_verified
        ));
        if let Some(verified) = &item.last_verified_at {
            output.push_str(&format!("- Last verified: `{verified}`\n"));
        }
        output.push_str(&format!("- Note: {}\n", markdown_escape(&item.note)));
        if item.deadline_signals.is_empty() {
            output.push_str(
                "- Page signal: no compact deadline snippet was detected in this run.\n\n",
            );
        } else {
            output.push_str("- Page signals:\n");
            for signal in &item.deadline_signals {
                output.push_str(&format!("  - {}\n", markdown_escape(signal)));
            }
            output.push('\n');
        }
    }

    output.push_str("</details>\n\n## Track coverage\n\n");
    for (track, count) in &issue.tracks {
        output.push_str(&format!("- **{}**: {} source(s)\n", track, count));
    }
    output
}

fn sort_items(items: &mut [CfpItem]) {
    items.sort_by(|a, b| {
        let a_days = a.days_until_deadline.unwrap_or(i64::MAX);
        let b_days = b.days_until_deadline.unwrap_or(i64::MAX);
        a_days
            .cmp(&b_days)
            .then_with(|| a.track.cmp(&b.track))
            .then_with(|| a.acronym.cmp(&b.acronym))
    });
}

pub async fn update_cfp_artifacts(
    root: impl AsRef<Path>,
    issue_date: Option<&str>,
) -> BlogResult<CfpIssue> {
    let root = root.as_ref();
    let issue_date = issue_date.map(str::to_string).unwrap_or_else(today_kst);
    chrono::NaiveDate::parse_from_str(&issue_date, "%Y-%m-%d")?;
    let config: CfpConfig =
        serde_json::from_str(&fs::read_to_string(root.join("config/cfp_sources.json")).await?)?;
    let previous: Option<CfpIssue> =
        match fs::read_to_string(root.join("data/cfp/latest.json")).await {
            Ok(json) => Some(serde_json::from_str(&json)?),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
            Err(error) => return Err(error.into()),
        };
    let client = CfpHttpClient {
        primary: cfp_http_client(false)?,
        system: cfp_http_client(true)?,
    };
    let source_count = config.conferences.len();
    let mut pending = tokio::task::JoinSet::new();
    let mut sources = config.conferences.into_iter();
    let mut items = Vec::new();
    let mut tracks = BTreeMap::new();
    let mut fetched_count = 0;
    let ai_targets = cfp_ai_target_tokens();
    let mut ai_requests_remaining = cfp_ai_max_requests();
    loop {
        while pending.len() < 8 {
            let Some(source) = sources.next() else { break };
            let previous = previous
                .as_ref()
                .and_then(|issue| {
                    issue
                        .items
                        .iter()
                        .find(|item| item.acronym == source.acronym)
                })
                .cloned();
            let client = client.clone();
            let date = issue_date.clone();
            pending.spawn(async move {
                resolve_source_page(&client, source, &date, previous.as_ref()).await
            });
        }
        let Some(result) = pending.join_next().await else {
            break;
        };
        let (mut source, page) = result?;
        *tracks.entry(source.track.clone()).or_insert(0) += 1;
        if page.status == "fetched" {
            fetched_count += 1;
        }
        let previous_items: Vec<&CfpItem> = previous
            .as_ref()
            .map(|issue| {
                issue
                    .items
                    .iter()
                    .filter(|item| item.acronym == source.acronym)
                    .collect()
            })
            .unwrap_or_default();
        if source.venue_type.to_ascii_lowercase().contains("journal") {
            let calls = journal_calls_from_html(&source, &page.html);
            if !calls.is_empty() {
                for call in calls {
                    let deadline = call.deadline.clone();
                    let signals = vec![call.note.clone()];
                    items.push(item_from_source(
                        call,
                        page.status.clone(),
                        signals,
                        &issue_date,
                        None,
                        deadline,
                    ));
                }
                continue;
            }
            if page.status != "fetched" && !previous_items.is_empty() {
                for old in previous_items {
                    let mut item = old.clone();
                    item.fetch_status = page.status.clone();
                    item.days_until_deadline = item
                        .configured_deadline
                        .as_deref()
                        .and_then(|date| days_until(&issue_date, date));
                    item.deadline_status = deadline_status(item.days_until_deadline);
                    items.push(item);
                }
                continue;
            }
        }
        let mut signals = deadline_signals_from_text(&strip_html(&page.html), &issue_date);
        let mut detected = inferred_deadline_from_signals(&signals, &issue_date);
        if detected.is_none()
            && ai_requests_remaining > 0
            && should_use_ai_deadline_fallback(&source, &page.status, &ai_targets)
        {
            ai_requests_remaining -= 1;
            if let Some(ai) =
                ai_deadline_signal(&client.primary, &source, &issue_date, &page.status).await
                && edition_in_url(&ai.source_url).is_none_or(|edition| {
                    source
                        .edition
                        .is_none_or(|configured| edition >= configured)
                })
            {
                source.edition = edition_in_url(&ai.source_url).or(source.edition);
                source.url = ai.source_url;
                detected = ai.deadline;
                signals.push(ai.signal);
            }
        }
        let old = previous_items
            .into_iter()
            .find(|item| item.url == source.url);
        items.push(item_from_source(
            source,
            page.status,
            signals,
            &issue_date,
            old,
            detected,
        ));
    }
    if fetched_count == 0 {
        return Err("No official CFP pages could be fetched; keeping the previous radar".into());
    }
    sort_items(&mut items);
    let issue = CfpIssue {
        generated_at: generated_at_utc(),
        issue_date,
        source_count,
        active_count: items
            .iter()
            .filter(|item| {
                item.deadline_verified && item.days_until_deadline.is_some_and(|days| days >= 0)
            })
            .count(),
        conference_count: items.iter().filter(|item| is_conference(item)).count(),
        workshop_count: items.iter().filter(|item| is_workshop(item)).count(),
        journal_count: items.iter().filter(|item| is_journal(item)).count(),
        with_configured_deadline_count: items
            .iter()
            .filter(|item| item.configured_deadline.is_some())
            .count(),
        fetched_count,
        tracks,
        items,
    };
    validate_issue(&issue)?;
    persist_cfp_artifacts(root, &issue).await?;
    Ok(issue)
}

fn cfp_week_start(issue_date: &str) -> BlogResult<String> {
    let date = chrono::NaiveDate::parse_from_str(issue_date, "%Y-%m-%d")?;
    Ok((date - chrono::Days::new(date.weekday().num_days_from_monday().into())).to_string())
}

pub async fn render_cfp_artifacts(root: impl AsRef<Path>) -> BlogResult<CfpIssue> {
    let root = root.as_ref();
    let issue: CfpIssue =
        serde_json::from_str(&fs::read_to_string(root.join("data/cfp/latest.json")).await?)?;
    validate_issue(&issue)?;
    persist_cfp_artifacts(root, &issue).await?;
    Ok(issue)
}

async fn persist_cfp_artifacts(root: &Path, issue: &CfpIssue) -> BlogResult<()> {
    let data_dir = root.join("data/cfp");
    let static_data_dir = root.join("static/cfp/data");
    let posts_dir = root.join("posts/cfp");
    fs::create_dir_all(&data_dir).await?;
    fs::create_dir_all(&static_data_dir).await?;
    fs::create_dir_all(&posts_dir).await?;
    let pretty = serde_json::to_string_pretty(issue)?;
    let markdown = render_markdown(issue);
    let week = cfp_week_start(&issue.issue_date)?;
    let weekly = markdown
        .replacen(
            &format!("title: \"CFP Radar — {}\"", issue.issue_date),
            &format!("title: \"CFP Radar — Week of {week}\""),
            1,
        )
        .replacen(
            &format!("date: {}", issue.issue_date),
            &format!("date: {week}"),
            1,
        )
        .replacen("slug: cfp-radar", &format!("slug: {week}-cfp-radar"), 1);
    fs::write(posts_dir.join(format!("{week}-cfp-radar.md")), weekly).await?;
    fs::write(posts_dir.join("cfp-radar.md"), markdown).await?;
    let calendar = render_ics(issue);
    for path in [
        data_dir.join("radar.ics"),
        static_data_dir.join("radar.ics"),
        root.join("static/cfp/radar.ics"),
    ] {
        fs::write(path, &calendar).await?;
    }
    fs::write(static_data_dir.join("latest.json"), &pretty).await?;
    fs::write(data_dir.join("latest.json"), &pretty).await?;
    Ok(())
}

fn validate_issue(issue: &CfpIssue) -> BlogResult<()> {
    chrono::NaiveDate::parse_from_str(&issue.issue_date, "%Y-%m-%d")?;
    let generated = chrono::DateTime::parse_from_rfc3339(&issue.generated_at)?;
    let age = Utc::now().signed_duration_since(generated);
    if age > chrono::Duration::hours(36) || age < chrono::Duration::minutes(-5) {
        return Err("CFP latest.json generation timestamp is stale or in the future".into());
    }
    if issue.source_count < 48 || issue.tracks.len() < 4 || issue.items.is_empty() {
        return Err("CFP source coverage is too low".into());
    }
    validate_source_quality(&issue.items)?;
    if issue.fetched_count == 0 || issue.fetched_count > issue.source_count {
        return Err("CFP fetch coverage is invalid".into());
    }
    let active = issue
        .items
        .iter()
        .filter(|item| {
            item.deadline_verified && item.days_until_deadline.is_some_and(|days| days >= 0)
        })
        .count();
    if issue.active_count != active
        || issue.conference_count
            != issue
                .items
                .iter()
                .filter(|item| is_conference(item))
                .count()
        || issue.workshop_count != issue.items.iter().filter(|item| is_workshop(item)).count()
        || issue.journal_count != issue.items.iter().filter(|item| is_journal(item)).count()
        || issue.with_configured_deadline_count
            != issue
                .items
                .iter()
                .filter(|item| item.configured_deadline.is_some())
                .count()
        || issue.source_count
            != issue
                .items
                .iter()
                .map(|item| &item.acronym)
                .collect::<std::collections::BTreeSet<_>>()
                .len()
        || issue.tracks.values().sum::<usize>() != issue.source_count
    {
        return Err("CFP snapshot counts do not match its entries".into());
    }
    let mut urls = std::collections::BTreeSet::new();
    for item in &issue.items {
        if !urls.insert((&item.url, &item.title)) {
            return Err(format!("Duplicate CFP entry: {}", item.url).into());
        }
        let expected_days = item
            .configured_deadline
            .as_deref()
            .map(|deadline| {
                days_until(&issue.issue_date, deadline)
                    .ok_or_else(|| format!("Invalid CFP deadline: {deadline}"))
            })
            .transpose()?;
        if item.days_until_deadline != expected_days
            || item.deadline_status != deadline_status(expected_days)
        {
            return Err(format!(
                "CFP deadline status does not match its date: {}",
                item.acronym
            )
            .into());
        }
        if item.deadline_verified
            && (item.last_verified_at.is_none()
                || item.configured_deadline.is_none()
                || !has_dated_submission_evidence(item))
        {
            return Err(format!("Verified CFP lacks dated evidence: {}", item.acronym).into());
        }
        if let Some(verified) = &item.last_verified_at {
            chrono::DateTime::parse_from_rfc3339(verified)?;
        }
        if is_journal(item)
            && item.deadline_verified
            && !journal_special_issue_signal_evidence(item)
        {
            return Err(
                format!("Journal CFP lacks special-issue evidence: {}", item.acronym).into(),
            );
        }
    }
    Ok(())
}

pub async fn validate_cfp_artifacts(root: impl AsRef<Path>) -> BlogResult<CfpIssue> {
    let root = root.as_ref();
    let issue: CfpIssue =
        serde_json::from_str(&fs::read_to_string(root.join("data/cfp/latest.json")).await?)?;
    validate_issue(&issue)?;
    let static_issue: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(root.join("static/cfp/data/latest.json")).await?)?;
    if static_issue != serde_json::to_value(&issue)? {
        return Err("Static CFP JSON differs from the source snapshot".into());
    }
    let expected_calendar = render_ics(&issue);
    for path in [
        "data/cfp/radar.ics",
        "static/cfp/data/radar.ics",
        "static/cfp/radar.ics",
    ] {
        if fs::read_to_string(root.join(path)).await? != expected_calendar {
            return Err(format!("CFP calendar is out of sync: {path}").into());
        }
    }
    let expected_markdown = render_markdown(&issue);
    if fs::read_to_string(root.join("posts/cfp/cfp-radar.md")).await? != expected_markdown {
        return Err("Latest CFP note differs from its source snapshot".into());
    }
    let week = cfp_week_start(&issue.issue_date)?;
    let weekly = fs::read_to_string(root.join(format!("posts/cfp/{week}-cfp-radar.md"))).await?;
    if !weekly.contains(&format!("slug: {week}-cfp-radar\n"))
        || !weekly.contains(&format!("date: {week}\n"))
        || !weekly.contains(&format!("- Generated: `{}`", issue.generated_at))
    {
        return Err("Weekly CFP note is missing or out of sync".into());
    }
    Ok(issue)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn quality_test_item(acronym: &str, url: &str) -> CfpItem {
        CfpItem {
            title: format!("{acronym} test venue"),
            acronym: acronym.to_string(),
            venue_type: "Conference".to_string(),
            track: "Wireless / Communications".to_string(),
            url: url.to_string(),
            conference_dates: "TBD / official page".to_string(),
            location: "TBD / official page".to_string(),
            verified_rank: String::new(),
            verified_rank_source: String::new(),
            verified_rank_year: String::new(),
            impact_factor: String::new(),
            impact_factor_year: String::new(),
            note: "Official source quality test item".to_string(),
            tags: vec!["wireless".to_string()],
            configured_deadline: None,
            days_until_deadline: None,
            deadline_status: "watching official CFP page".to_string(),
            fetch_status: "not fetched".to_string(),
            deadline_signals: Vec::new(),
            edition: None,
            deadline_verified: false,
            last_verified_at: None,
        }
    }

    fn quality_test_source(acronym: &str, url: &str) -> CfpSource {
        CfpSource {
            title: format!("{acronym} test venue"),
            acronym: acronym.to_string(),
            venue_type: "Conference".to_string(),
            track: "Wireless / Communications".to_string(),
            url: url.to_string(),
            conference_dates: "TBD / official page".to_string(),
            location: "TBD / official page".to_string(),
            quality_tier: String::new(),
            ranking_source: String::new(),
            ranking_year: String::new(),
            verified_rank: String::new(),
            verified_rank_source: String::new(),
            verified_rank_year: String::new(),
            impact_factor: String::new(),
            impact_factor_year: String::new(),
            note: "Official source quality test item".to_string(),
            tags: vec!["wireless".to_string()],
            deadline: None,
            edition: None,
            edition_url_template: None,
        }
    }

    #[test]
    fn extracts_nearest_open_deadline_from_official_page_signals() {
        let signals = vec![
            "Special Issue on Low-Altitude Wireless Networks Deadline: 1 Mar 2026 (Extended)"
                .to_string(),
            "Integrated Sensing and Communication for IoT Networking in 6G and Beyond Submission Deadline: August 15th, 2026 Guest Editors"
                .to_string(),
            "06 Jun 2026 Paper Submission Deadline : Final Deadline 30 Jun 2026 Acceptance Notification"
                .to_string(),
        ];
        assert_eq!(
            inferred_deadline_from_signals(&signals, "2026-07-03"),
            Some("2026-08-15".to_string())
        );
        assert_eq!(
            inferred_deadline_from_signals(&signals[2..], "2026-07-03"),
            Some("2026-06-30".to_string())
        );
    }

    #[test]
    fn ignores_non_submission_operational_milestones() {
        let signals = vec![
            "Important Dates 15 May 2026 Call for Posters & Demos - Final Version Submission : Deadline Closed 01 Jun 2026 Call for Tutorials - Tutorial Material Due : Deadline Closed 09 Jun 2026 Apply for a Travel Grant : Deadline Closed 17 Jun 2026 Conference Begins".to_string(),
        ];

        assert_eq!(inferred_deadline_from_signals(&signals, "2026-07-03"), None);
        assert!(deadline_signals_from_text(&signals[0], "2026-07-03").is_empty());
    }

    #[test]
    fn filters_navigation_only_cfp_signal_snippets() {
        let text = "Important Dates Call for Papers Call for Posters & Demos Call for Workshop Proposals Call for Tutorials";

        assert!(deadline_signals_from_text(text, "2026-07-03").is_empty());
    }

    #[test]
    fn keeps_latest_closed_deadline_when_no_open_signal_exists() {
        let signals = vec![
            "Important Dates 06 Jun 2026 Paper Submission Deadline : Final Deadline".to_string(),
            "30 Jun 2026 Acceptance Notification".to_string(),
        ];

        assert_eq!(
            inferred_deadline_from_signals(&signals, "2026-07-03"),
            Some("2026-06-06".to_string())
        );
    }

    #[test]
    fn accepts_ai_deadline_only_with_official_source_and_evidence() {
        let source = quality_test_source(
            "INFOCOM",
            "https://infocom2026.ieee-infocom.org/call-papers",
        );
        let mut finding = AiDeadlineFinding {
            deadline: Some("2026-07-24".to_string()),
            status: "found".to_string(),
            evidence: "Paper submission deadline: 24 July 2026".to_string(),
            source_url: "https://infocom2026.ieee-infocom.org/call-papers".to_string(),
        };

        let signal =
            accepted_ai_deadline_signal(finding.clone(), &source, "models/gemini-2.5-flash")
                .expect("official AI finding should be accepted");
        assert_eq!(signal.deadline.as_deref(), Some("2026-07-24"));
        assert!(signal.signal.contains("AI-assisted official CFP lookup"));
        assert!(signal.signal.contains("Paper submission deadline"));
        finding.source_url = "https://wcnc2026.ieee-wcnc.org/call-papers".to_string();
        assert!(
            accepted_ai_deadline_signal(finding.clone(), &source, "models/gemini-2.5-flash")
                .is_none()
        );
        finding.source_url = source.url.clone();
        finding.evidence = "Registration deadline: 24 July 2026".to_string();
        assert!(
            accepted_ai_deadline_signal(finding.clone(), &source, "models/gemini-2.5-flash")
                .is_none()
        );
        finding.evidence = "Paper submission deadline: 24 July 2026".to_string();
        finding.status = "not_found".to_string();
        assert!(
            accepted_ai_deadline_signal(finding.clone(), &source, "models/gemini-2.5-flash")
                .is_none()
        );
        finding.status = "found".to_string();
        finding.evidence = "Paper submission deadline: 1 July 2026".to_string();
        assert!(accepted_ai_deadline_signal(finding, &source, "models/gemini-2.5-flash").is_none());
    }

    #[test]
    fn rejects_ai_deadline_from_blocked_aggregator() {
        let source = quality_test_source(
            "INFOCOM",
            "https://infocom2026.ieee-infocom.org/call-papers",
        );
        let finding = AiDeadlineFinding {
            deadline: Some("2026-07-24".to_string()),
            status: "found".to_string(),
            evidence: "Paper submission deadline: 24 July 2026".to_string(),
            source_url: "https://conferenceindex.org/event/infocom".to_string(),
        };

        assert!(accepted_ai_deadline_signal(finding, &source, "models/gemini-2.5-flash").is_none());
    }

    #[test]
    fn parses_ai_deadline_json_wrapped_in_model_text() {
        let text = r#"```json
        {"status":"found","deadline":"2026-08-31","evidence":"Workshop Paper Submission Deadline August 31, 2026","source_url":"https://www.sigmobile.org/mobihoc/2026/workshop-ai-ran.html"}
        ```"#;
        let parsed = parse_ai_deadline_text(text).expect("JSON object should parse");
        assert_eq!(parsed.deadline.as_deref(), Some("2026-08-31"));
        assert!(
            parsed
                .evidence
                .contains("Workshop Paper Submission Deadline")
        );
    }

    #[test]
    fn ai_fallback_target_filter_limits_which_sources_can_spend_quota() {
        let icc = quality_test_source("ICC", "https://www.ieee-icc.org/2026/authors/");
        let tmlcn = quality_test_source(
            "IEEE TMLCN CFP",
            "https://www.comsoc.org/publications/journals/ieee-tmlcn/cfp",
        );
        let targets = vec!["icnc".to_string(), "icc".to_string(), "wiopt".to_string()];

        assert!(cfp_ai_target_matches(&icc, &targets));
        assert!(!cfp_ai_target_matches(&tmlcn, &targets));
    }

    #[test]
    fn journal_special_issue_evidence_rejects_generic_cfp_rows() {
        let mut generic = quality_test_item(
            "IEEE TWC CFP",
            "https://www.comsoc.org/publications/journals/ieee-transactions-wireless-communications/cfp",
        );
        generic.venue_type = "Journal special issue".to_string();
        generic.fetch_status = "fetched".to_string();
        generic.deadline_signals = Vec::new();

        let mut special = quality_test_item(
            "IEEE JSAC CFP",
            "https://www.comsoc.org/publications/journals/ieee-jsac/cfp",
        );
        special.venue_type = "Journal special issue".to_string();
        special.fetch_status = "fetched".to_string();
        special.deadline_signals = vec![
            "Special Issue Paper Topic Publication Date Manuscript Submission Deadline 1 October 2026"
                .to_string(),
        ];

        assert!(!journal_special_issue_signal_evidence(&generic));
        assert!(journal_special_issue_signal_evidence(&special));
    }

    #[test]
    fn source_quality_gate_allows_official_society_and_publisher_sources() {
        let items = vec![
            quality_test_item("AAAI", "https://aaai.org/conference/aaai/aaai-26/"),
            quality_test_item(
                "TVT",
                "https://vtsociety.org/publication/ieee-transactions-vehicular-technology",
            ),
            quality_test_item(
                "COMNET",
                "https://www.sciencedirect.com/journal/computer-networks/about/call-for-papers",
            ),
        ];

        assert!(validate_source_quality(&items).is_ok());
    }

    #[test]
    fn source_quality_gate_rejects_predatory_aggregators() {
        let items = vec![quality_test_item(
            "FAKE",
            "https://waset.org/wireless-communications-conference",
        )];

        let error = validate_source_quality(&items)
            .expect_err("WASET-style aggregator source should be rejected")
            .to_string();
        assert!(error.contains("blocked low-quality pattern"));
        assert!(error.contains("waset.org"));
    }

    #[test]
    fn source_quality_gate_rejects_known_stale_official_pages() {
        let items = vec![quality_test_item("WiOpt", "https://wi-opt.org/cfp.html")];

        let error = validate_source_quality(&items)
            .expect_err("stale WiOpt 2022 CFP page should not be reintroduced")
            .to_string();
        assert!(error.contains("blocked low-quality pattern"));
        assert!(error.contains("wi-opt.org/cfp.html"));
    }

    #[test]
    fn source_quality_gate_rejects_untrusted_domains_by_default() {
        let items = vec![quality_test_item(
            "UNKNOWN",
            "https://example-conference-hub.test/cfp",
        )];

        let error = validate_source_quality(&items)
            .expect_err("unknown CFP domains should require explicit allowlisting")
            .to_string();
        assert!(error.contains("untrusted CFP domain"));
    }

    #[test]
    fn official_url_validation_checks_the_host_not_substrings() {
        assert!(trusted_cfp_url("https://icc2027.ieee-icc.org/cfp"));
        for url in [
            "https://ieee-icc.org.evil.example/cfp",
            "https://evil.example/?source=https://www.comsoc.org/cfp",
            "https://www.comsoc.org@evil.example/cfp",
            "javascript:https://www.comsoc.org/cfp",
            "https://www.comsoc.org/cfp\nBEGIN:VEVENT",
            "https://www.comsoc.org/cfp\"<script>",
        ] {
            assert!(!trusted_cfp_url(url), "{url}");
        }
    }

    #[test]
    fn next_editions_need_a_real_matching_page_and_submission_date() {
        let source = quality_test_source("ICC", "https://icc2026.ieee-icc.org/cfp");
        assert_eq!(
            next_edition_url(&source, 2027).as_deref(),
            Some("https://icc2027.ieee-icc.org/cfp")
        );
        let mut page = CfpPage {
            status: "fetched".to_string(),
            url: "https://icc2027.ieee-icc.org/cfp".to_string(),
            html: "<title>IEEE ICC 2027</title><p>Paper submission deadline: October 2, 2026</p>"
                .to_string(),
        };
        assert!(confirms_edition(
            &page,
            2027,
            "2026-10-15",
            Some("2025-11-10")
        ));
        assert!(!confirms_edition(
            &page,
            2027,
            "2026-10-15",
            Some("2026-10-02")
        ));
        page.html = "<title>IEEE ICC 2027</title><p>Conference May 30, 2027</p>".to_string();
        assert!(!confirms_edition(&page, 2027, "2026-10-15", None));
        page.html = "<title>IEEE ICC 2026</title><a href='/2027'>Next year</a><p>Paper submission deadline: October 2, 2025</p>".to_string();
        assert!(!confirms_edition(&page, 2027, "2026-10-15", None));
        page.status = "http 404 Not Found".to_string();
        assert!(!confirms_edition(&page, 2027, "2026-10-15", None));
    }

    #[test]
    fn frame_sources_are_bounded_and_official() {
        let html = "<frameset><frame src='top.html'><frame src=\"body.html\"><frame src='https://evil.example/date.html'></frameset>";
        let frames = cfp_frame_urls(html, "http://www.conf-icnc.org/2027/index.html");
        assert_eq!(
            frames,
            vec![
                "http://www.conf-icnc.org/2027/top.html",
                "http://www.conf-icnc.org/2027/body.html"
            ]
        );
    }

    #[test]
    fn submission_dates_do_not_borrow_event_or_abstract_dates() {
        let signals = vec!["Date 30 May - 3 June 2027 Location Washington DC Call for Technical Papers Deadline 2 October 2026".to_string()];
        assert_eq!(
            inferred_deadline_from_signals(&signals, "2026-10-15").as_deref(),
            Some("2026-10-02")
        );
        let signals = vec!["Abstract submission deadline: May 4, 2026. Full paper submission deadline: May 6, 2026. Author notification: September 24, 2026".to_string()];
        assert_eq!(
            inferred_deadline_from_signals(&signals, "2026-01-01").as_deref(),
            Some("2026-05-06")
        );
        assert!(deadline_signals_from_text(&strip_html("<!-- Paper submission deadline: May 1, 2027 --><script>deadline = '2027-05-02'</script>"), "2026-10-15").is_empty());
        let signals = vec!["August 31, 2026 Workshop Paper Submission Deadline September 21, 2026 Workshop Paper Acceptance Notification September 30, 2026 Workshop Paper Camera-Ready Deadline".to_string()];
        assert_eq!(
            inferred_deadline_from_signals(&signals, "2026-10-15").as_deref(),
            Some("2026-08-31")
        );
        let signals = vec!["Paper submission: September 19, 2026 Extended: October 18, 2026 (Firm) Paper Acceptance: November 15, 2026 Camera-ready paper: November 30, 2026".to_string()];
        assert_eq!(
            inferred_deadline_from_signals(&signals, "2026-10-15").as_deref(),
            Some("2026-10-18")
        );
        let signals = vec!["September 30, 2026 Workshop Paper Camera-Ready Deadline October 12, 2026 Student Travel Grant Application Deadline October 20, 2026 Student Travel Grant Notification of Acceptance".to_string()];
        assert_eq!(inferred_deadline_from_signals(&signals, "2026-10-15"), None);
    }

    async fn mock_icc_pages(
        pages: Vec<(u16, String)>,
    ) -> (CfpHttpClient, String, tokio::task::JoinHandle<()>) {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            for (status, body) in pages {
                let (mut stream, _) = listener.accept().await.unwrap();
                let mut request = [0; 4096];
                assert!(stream.read(&mut request).await.unwrap() > 0);
                let response = format!(
                    "HTTP/1.1 {status} Response\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                );
                stream.write_all(response.as_bytes()).await.unwrap();
            }
        });
        let client = reqwest::Client::builder()
            .no_proxy()
            .resolve("icc2027.ieee-icc.org", address)
            .timeout(Duration::from_secs(2))
            .build()
            .unwrap();
        (
            CfpHttpClient {
                primary: client.clone(),
                system: client,
            },
            format!("http://icc2027.ieee-icc.org:{}/", address.port()),
            server,
        )
    }

    #[tokio::test]
    async fn dated_catalogue_still_follows_the_live_cfp_and_uses_its_extension() {
        let source = quality_test_source(
            "ICC",
            "https://www.comsoc.org/conferences-events/ieee-international-conference-communications-2027",
        );
        let primary = include_str!("../tests/fixtures/cfp/icc2027-submission.html");
        let (client, root, server) = mock_icc_pages(vec![
            (200, "<title>IEEE ICC 2027</title><a href='/authors/call-workshop-papers'>Call for Workshop Papers</a><a href='/authors/call-symposium-papers'>Call for Symposium Papers</a>".to_string()),
            (200, primary.to_string()),
        ]).await;
        let catalogue = CfpPage {
            status: "fetched".to_string(),
            url: source.url.clone(),
            html: format!(
                "<h1>IEEE ICC 2027</h1><p>Call for Technical Papers Deadline 2 October 2026</p><a href='{root}'>Visit the 2027 IEEE ICC Website!</a>"
            ),
        };
        assert_eq!(
            inferred_deadline_from_signals(
                &deadline_signals_from_text(&strip_html(&catalogue.html), "2026-10-01"),
                "2026-10-01"
            )
            .as_deref(),
            Some("2026-10-02")
        );
        let page = resolve_primary_cfp_page(&client, &source, catalogue, "2026-10-01").await;
        server.abort();
        assert_eq!(page.status, "fetched");
        assert!(page.url.ends_with("/authors/call-symposium-papers"));
        let signals = deadline_signals_from_text(&strip_html(&page.html), "2026-10-01");
        assert_eq!(
            inferred_deadline_from_signals(&signals, "2026-10-01").as_deref(),
            Some("2026-10-16")
        );
    }

    #[tokio::test]
    async fn unavailable_primary_does_not_freshly_verify_the_old_catalogue_date() {
        let source = quality_test_source(
            "ICC",
            "https://www.comsoc.org/conferences-events/ieee-international-conference-communications-2027",
        );
        let (client, root, server) = mock_icc_pages(vec![(503, "Unavailable".to_string())]).await;
        let catalogue = CfpPage {
            status: "fetched".to_string(),
            url: source.url.clone(),
            html: format!(
                "<h1>IEEE ICC 2027</h1><p>Call for Technical Papers Deadline 2 October 2026</p><a href='{root}'>Visit Website</a>"
            ),
        };
        let page = resolve_primary_cfp_page(&client, &source, catalogue, "2026-10-15").await;
        server.abort();
        let signals = deadline_signals_from_text(&strip_html(&page.html), "2026-10-15");
        let item = item_from_source(source, page.status, signals, "2026-10-15", None, None);
        assert!(!item.deadline_verified);
        assert!(item.last_verified_at.is_none());
        assert!(item.configured_deadline.is_none());
    }

    #[tokio::test]
    async fn confirmed_primary_is_reused_in_the_same_edition_and_never_reverts_to_catalogue() {
        let mut source = quality_test_source(
            "ICC",
            "https://www.comsoc.org/conferences-events/ieee-international-conference-communications-2027",
        );
        source.edition = Some(2027);
        let (client, root, server) = mock_icc_pages(vec![(503, "Unavailable".to_string())]).await;
        let mut previous =
            quality_test_item("ICC", &format!("{root}authors/call-symposium-papers"));
        previous.edition = Some(2027);
        previous.configured_deadline = Some("2026-10-16".to_string());
        previous.deadline_verified = true;
        previous.last_verified_at = Some("2026-10-06T08:00:00Z".to_string());
        previous.deadline_signals = vec!["Paper Submission Deadline 16 October 2026".to_string()];
        let (source, page) =
            resolve_source_page(&client, source, "2026-10-15", Some(&previous)).await;
        server.abort();
        assert_eq!(source.url, previous.url);
        let item = item_from_source(
            source,
            page.status,
            vec![],
            "2026-10-15",
            Some(&previous),
            None,
        );
        assert_eq!(item.configured_deadline.as_deref(), Some("2026-10-16"));
        assert_eq!(item.last_verified_at, previous.last_verified_at);
        assert!(deadline_label(&item).contains("cached"));
    }

    #[test]
    fn withdrawn_dates_and_wrong_edition_or_workshop_links_are_not_primary() {
        for tag in ["del", "s", "strike"] {
            let html = format!(
                "<p>Paper submission deadline: <{tag}>2 October 2026</{tag}> 16 October 2026</p>"
            );
            let signals = deadline_signals_from_text(&strip_html(&html), "2026-10-01");
            assert_eq!(
                inferred_deadline_from_signals(&signals, "2026-10-01").as_deref(),
                Some("2026-10-16")
            );
        }
        let mut source = quality_test_source("ICC", "https://icc2027.ieee-icc.org/");
        source.edition = Some(2027);
        let page = CfpPage {status: "fetched".to_string(), url: source.url.clone(), html:
            "<a href='https://icc2026.ieee-icc.org/authors/call-papers'>Call for Papers</a><a href='/authors/call-workshop-papers'>Call for Workshop Papers</a><a href='https://evil.example/cfp'>Call for Papers</a><a href='/authors/call-symposium-papers'>Call for Symposium Papers</a>".to_string()};
        assert_eq!(
            official_cfp_link(&source, &page).as_deref(),
            Some("https://icc2027.ieee-icc.org/authors/call-symposium-papers")
        );
    }

    #[test]
    fn venue_cells_are_compact_expandable_and_escape_untrusted_titles() {
        let mut item = quality_test_item("ICC", "https://icc2027.ieee-icc.org/cfp");
        item.title = "IEEE International Conference on Communications".to_string();
        item.edition = Some(2027);
        let cell = venue_cell(&item);
        assert!(cell.contains("class=\"cfp-venue-name\">ICC 2027</span>"));
        assert!(
            !cell
                .split("</summary>")
                .next()
                .unwrap()
                .contains(&item.title)
        );
        assert!(cell.contains(&item.title));
        assert!(venue_label(&item).starts_with(&item.title));
        item.acronym = "IEEE JSAC CFP".to_string();
        item.venue_type = "Journal special issue".to_string();
        item.edition = None;
        item.title = "IEEE Journal — <img src=x onerror=alert(1)> A | B".to_string();
        let cell = venue_cell(&item);
        assert!(cell.contains(">IEEE JSAC</span>"));
        assert!(!cell.contains("<img"));
        assert!(cell.contains("&lt;img"));
        assert!(cell.contains("&#124;"));
        let mut markdown = String::new();
        render_watchlist_table(&mut markdown, &[&item]);
        let html = crate::markdown_to_html(&markdown);
        assert_eq!(html.matches("<td>").count(), 6);
        assert!(markdown.contains("| Venue | Deadline | Field | Dates | Location | Link |"));
    }

    #[test]
    fn preview_prioritizes_confirmed_calls_over_earlier_unverified_dates() {
        let mut uncertain = quality_test_item("UNCERTAIN", "https://www.ieee.org/cfp/uncertain");
        uncertain.days_until_deadline = Some(0);
        let mut confirmed = quality_test_item("CONFIRMED", "https://www.ieee.org/cfp/confirmed");
        confirmed.days_until_deadline = Some(15);
        confirmed.deadline_verified = true;
        let mut expired = quality_test_item("EXPIRED", "https://www.ieee.org/cfp/expired");
        expired.days_until_deadline = Some(-30);
        let mut output = String::new();
        render_type_preview(
            &mut output,
            "Journal calls",
            vec![&expired, &uncertain, &confirmed],
        );
        assert!(!output.contains("EXPIRED"));
        assert!(output.find("CONFIRMED").unwrap() < output.find("UNCERTAIN").unwrap());
    }

    #[test]
    fn camera_ready_abstract_and_event_dates_never_become_paper_deadlines() {
        for (html, expected) in [
            (
                include_str!("../tests/fixtures/cfp/sp2027-submission-cycles.html"),
                Some("2026-11-17"),
            ),
            (
                include_str!("../tests/fixtures/cfp/sensys2027-submission.html"),
                Some("2026-11-05"),
            ),
            (
                include_str!("../tests/fixtures/cfp/mobihoc-closed-workshop.html"),
                None,
            ),
        ] {
            let signals = deadline_signals_from_text(&strip_html(html), "2026-10-15");
            assert_eq!(
                inferred_deadline_from_signals(&signals, "2026-10-15").as_deref(),
                expected
            );
        }
        let html = "<span>Paper submission deadline: 16 October 2026</span><s>2 October 2026</s>";
        assert_eq!(
            inferred_deadline_from_signals(
                &deadline_signals_from_text(&strip_html(html), "2026-10-01"),
                "2026-10-01"
            )
            .as_deref(),
            Some("2026-10-16")
        );
    }

    #[test]
    fn disproved_cached_dates_are_invalidated_instead_of_preserved() {
        let mut previous = quality_test_item(
            "MobiHoc AI-RAN",
            "https://www.sigmobile.org/mobihoc/2026/workshop-ai-ran.html",
        );
        previous.configured_deadline = Some("2026-11-26".to_string());
        previous.deadline_verified = true;
        previous.last_verified_at = Some(generated_at_utc());
        previous.deadline_signals = vec!["Workshop Paper Submission Deadline Workshop Paper Acceptance Notification Workshop Paper Camera-Ready Deadline November 26, 2026 Workshop Event Date".to_string()];
        assert!(!has_dated_submission_evidence(&previous));
        let source = quality_test_source("MobiHoc AI-RAN", &previous.url);
        let item = item_from_source(
            source,
            "primary CFP has no verified submission date".to_string(),
            vec![],
            "2026-10-15",
            Some(&previous),
            None,
        );
        assert!(!item.deadline_verified);
        assert!(item.configured_deadline.is_none());
        let mut issue = test_issue("2026-10-15");
        issue.items[0].deadline_signals =
            vec!["Camera-ready deadline: October 30, 2026".to_string()];
        assert!(validate_issue(&issue).is_err());
    }

    #[test]
    fn official_deadline_changes_override_config_and_survive_fetch_failures() {
        let mut source = quality_test_source("ICC", "https://icc2027.ieee-icc.org/cfp");
        source.deadline = Some("2026-10-02".to_string());
        let item = item_from_source(
            source.clone(),
            "fetched".to_string(),
            vec!["Paper submission deadline: October 30, 2026".to_string()],
            "2026-10-15",
            None,
            None,
        );
        assert_eq!(item.configured_deadline.as_deref(), Some("2026-10-30"));
        assert!(item.deadline_verified);
        let cached = item_from_source(
            source.clone(),
            "http 403 Forbidden".to_string(),
            vec![],
            "2026-10-16",
            Some(&item),
            None,
        );
        assert_eq!(cached.configured_deadline, item.configured_deadline);
        assert_eq!(cached.last_verified_at, item.last_verified_at);
        assert!(deadline_label(&cached).contains("cached"));
        let stale_lookup = item_from_source(
            source.clone(),
            "fetch failed".to_string(),
            vec!["Paper submission deadline: 2 October 2026".to_string()],
            "2026-10-15",
            Some(&item),
            Some("2026-10-02".to_string()),
        );
        assert_eq!(stale_lookup.configured_deadline, item.configured_deadline);
        assert_eq!(stale_lookup.last_verified_at, item.last_verified_at);
        assert_eq!(stale_lookup.deadline_signals, item.deadline_signals);
        let corrected_primary = item_from_source(
            source.clone(),
            "fetched".to_string(),
            vec!["Paper submission deadline: 2 October 2026".to_string()],
            "2026-10-15",
            Some(&item),
            Some("2026-10-02".to_string()),
        );
        assert_eq!(
            corrected_primary.configured_deadline.as_deref(),
            Some("2026-10-02")
        );
        let unverified = item_from_source(
            source,
            "http 403 Forbidden".to_string(),
            vec![],
            "2026-10-15",
            None,
            None,
        );
        assert!(!unverified.deadline_verified);
        assert!(deadline_label(&unverified).contains("unverified"));
    }

    #[test]
    fn journal_table_rows_keep_topic_dates_and_individual_links_together() {
        let source = quality_test_source(
            "JSAC",
            "https://www.comsoc.org/publications/journals/ieee-jsac/cfp",
        );
        let html = r#"<table><tr><th>Paper Topic</th><th>Publication Date</th><th>Manuscript Submission Deadline</th></tr>
            <tr><td><a href='/cfp/underwater'>Underwater</a></td><td>2028</td><td>31 March 2027</td></tr>
            <tr><td><a href='/cfp/antennas'>Movable Antennas</a></td><td>July 2027</td><td>30 October 2026</td></tr>
            <tr><td><a href='/cfp/closed'>Old call</a></td><td>2026</td><td>Closed</td></tr>
            <tr><td><a href='https://evil.example/cfp'>Fake</a></td><td>2027</td><td>1 November 2026</td></tr></table>"#;
        let calls = journal_calls_from_html(&source, html);
        assert_eq!(calls.len(), 2);
        assert!(
            calls
                .iter()
                .any(|call| call.title.contains("Movable Antennas")
                    && call.deadline.as_deref() == Some("2026-10-30")
                    && call.url.ends_with("/cfp/antennas"))
        );
        assert!(
            calls
                .iter()
                .any(|call| call.deadline.as_deref() == Some("2027-03-31"))
        );
    }

    #[test]
    fn journal_lists_extract_every_call_and_ignore_commented_out_ones() {
        let source = quality_test_source("IoT-J", "https://ieee-iotj.org/special-issues/");
        let html = r#"<ul><!-- <li><a href='/old.pdf'>Commented out</a> Submission Deadline: January 1, 2027</li> -->
            <li><a href='/graph.pdf'>Graph Learning</a><br>Submission Deadline: November 30th, 2026</li>
            <li><a href='/agents.pdf'>AI Agents</a><br>Submission Deadline: December 15th, 2026</li></ul>"#;
        let calls = journal_calls_from_html(&source, html);
        assert_eq!(calls.len(), 2);
        assert!(
            calls
                .iter()
                .any(|call| call.deadline.as_deref() == Some("2026-11-30"))
        );
        assert!(
            calls
                .iter()
                .any(|call| call.deadline.as_deref() == Some("2026-12-15"))
        );
    }

    fn test_issue(date: &str) -> CfpIssue {
        let mut items: Vec<CfpItem> = (0..48)
            .map(|index| {
                quality_test_item(
                    &format!("TEST{index}"),
                    &format!("https://www.ieee.org/cfp/{index}"),
                )
            })
            .collect();
        items[0].configured_deadline = Some("2026-10-30".to_string());
        items[0].days_until_deadline = days_until(date, "2026-10-30");
        items[0].deadline_status = deadline_status(items[0].days_until_deadline);
        items[0].deadline_verified = true;
        items[0].last_verified_at = Some(generated_at_utc());
        items[0].deadline_signals = vec!["Paper submission deadline: October 30, 2026".to_string()];
        items[0].fetch_status = "fetched".to_string();
        CfpIssue {
            generated_at: generated_at_utc(),
            issue_date: date.to_string(),
            source_count: 48,
            active_count: usize::from(items[0].days_until_deadline.is_some_and(|days| days >= 0)),
            conference_count: 48,
            workshop_count: 0,
            journal_count: 0,
            with_configured_deadline_count: 1,
            fetched_count: 48,
            tracks: (0..4).map(|index| (format!("Track {index}"), 12)).collect(),
            items,
        }
    }

    #[test]
    fn icc2027_firm_extension_updates_notes_and_calendar_without_date_overrides() {
        let source = quality_test_source(
            "ICC",
            "https://icc2027.ieee-icc.org/authors/call-symposium-papers",
        );
        assert!(source.deadline.is_none());
        let before = item_from_source(
            source.clone(),
            "fetched".to_string(),
            deadline_signals_from_text(
                &strip_html(include_str!(
                    "../tests/fixtures/cfp/icc2027-submission.html"
                )),
                "2026-10-15",
            ),
            "2026-10-15",
            None,
            None,
        );
        assert_eq!(before.configured_deadline.as_deref(), Some("2026-10-16"));
        let after = item_from_source(
            source.clone(),
            "fetched".to_string(),
            deadline_signals_from_text(
                &strip_html(include_str!(
                    "../tests/fixtures/cfp/icc2027-firm-extension.html"
                )),
                "2026-10-17",
            ),
            "2026-10-17",
            Some(&before),
            None,
        );
        assert_eq!(after.configured_deadline.as_deref(), Some("2026-10-30"));
        assert_eq!(after.days_until_deadline, Some(13));
        assert!(after.deadline_verified);
        assert!(
            after
                .deadline_signals
                .iter()
                .any(|signal| signal.contains("Firm Deadline"))
        );
        let cached = item_from_source(
            source,
            "fetch failed".to_string(),
            vec![],
            "2026-10-18",
            Some(&after),
            None,
        );
        assert_eq!(cached.configured_deadline, after.configured_deadline);
        assert_eq!(cached.last_verified_at, after.last_verified_at);
        assert!(deadline_label(&cached).contains("cached"));
        let mut old_issue = test_issue("2026-10-15");
        old_issue.items[0] = before;
        let old_calendar = render_ics(&old_issue).replace("\r\n ", "");
        let mut issue = test_issue("2026-10-17");
        issue.items[0] = after;
        let calendar = render_ics(&issue).replace("\r\n ", "");
        assert!(old_calendar.contains("DTSTART;VALUE=DATE:20261016"));
        assert!(calendar.contains("DTSTART;VALUE=DATE:20261030"));
        assert!(!calendar.contains("DTSTART;VALUE=DATE:20261016"));
        assert_eq!(calendar.matches("BEGIN:VEVENT").count(), 1);
        assert_eq!(
            old_calendar.lines().find(|line| line.starts_with("UID:")),
            calendar.lines().find(|line| line.starts_with("UID:"))
        );
        let markdown = render_markdown(&issue);
        assert!(
            markdown
                .lines()
                .any(|line| line.starts_with("| 2026-10-30") && line.contains(">ICC</span>"))
        );
        assert!(!markdown.contains("2026-10-16"));
    }

    #[test]
    fn calendar_is_reproducible_and_uids_survive_deadline_extensions() {
        let mut issue = test_issue("2026-10-15");
        issue.items[0].title = "A, B; 연구".to_string();
        issue.items[0].location = "Washington, DC".to_string();
        let before = render_ics(&issue);
        assert_eq!(before, render_ics(&issue));
        assert_eq!(before.matches("BEGIN:VEVENT").count(), 1);
        assert!(before.contains("LOCATION:Washington\\, DC"));
        assert!(before.lines().all(|line| line.len() <= 75));
        issue.items[0].configured_deadline = Some("2026-11-01".to_string());
        issue.items[0].days_until_deadline = days_until("2026-10-15", "2026-11-01");
        let after = render_ics(&issue);
        let unfold = |calendar: &str| calendar.replace("\r\n ", "");
        let before = unfold(&before);
        let after = unfold(&after);
        assert_eq!(
            before.lines().find(|line| line.starts_with("UID:")),
            after.lines().find(|line| line.starts_with("UID:"))
        );
        issue.items[0].deadline_verified = false;
        assert_eq!(render_ics(&issue).matches("BEGIN:VEVENT").count(), 0);
    }

    #[test]
    fn snapshot_validation_rejects_stale_or_misleading_counts() {
        let mut issue = test_issue("2026-10-15");
        assert!(validate_issue(&issue).is_ok());
        issue.active_count += 1;
        assert!(validate_issue(&issue).is_err());
        issue.active_count -= 1;
        issue.conference_count -= 1;
        issue.workshop_count += 1;
        assert!(validate_issue(&issue).is_err());
        issue.conference_count += 1;
        issue.workshop_count -= 1;
        issue.generated_at = (Utc::now() - chrono::Duration::hours(37)).to_rfc3339();
        assert!(validate_issue(&issue).is_err());
    }

    #[tokio::test]
    async fn weekly_notes_update_in_place_without_overwriting_previous_weeks() -> BlogResult<()> {
        let root = std::env::temp_dir().join(format!(
            "blog-cfp-weeks-{}-{}",
            std::process::id(),
            Utc::now().timestamp_micros()
        ));
        let first = test_issue("2026-10-15");
        persist_cfp_artifacts(&root, &first).await?;
        let second = test_issue("2026-10-16");
        persist_cfp_artifacts(&root, &second).await?;
        let old_path = root.join("posts/cfp/2026-10-12-cfp-radar.md");
        let old_week = fs::read_to_string(&old_path).await?;
        let third = test_issue("2026-10-19");
        persist_cfp_artifacts(&root, &third).await?;
        assert_eq!(fs::read_to_string(old_path).await?, old_week);
        let posts = crate::load_posts(root.join("posts")).await?;
        assert_eq!(posts.len(), 3);
        assert_eq!(
            posts.iter().filter(|post| post.slug == "cfp-radar").count(),
            1
        );
        let page = crate::render_cfp_page(&posts)?;
        assert!(page.contains("/posts/2026-10-12-cfp-radar/"));
        assert!(page.contains("/posts/2026-10-19-cfp-radar/"));
        validate_cfp_artifacts(&root).await?;
        let data_before = fs::read(root.join("data/cfp/latest.json")).await?;
        let calendar_before = fs::read(root.join("data/cfp/radar.ics")).await?;
        render_cfp_artifacts(&root).await?;
        assert_eq!(
            fs::read(root.join("data/cfp/latest.json")).await?,
            data_before
        );
        assert_eq!(
            fs::read(root.join("data/cfp/radar.ics")).await?,
            calendar_before
        );
        validate_cfp_artifacts(&root).await?;
        fs::remove_dir_all(root).await?;
        Ok(())
    }

    #[tokio::test]
    async fn validation_does_not_repair_and_hide_a_stale_calendar() -> BlogResult<()> {
        let root = std::env::temp_dir().join(format!(
            "blog-cfp-validate-{}-{}",
            std::process::id(),
            Utc::now().timestamp_micros()
        ));
        persist_cfp_artifacts(&root, &test_issue("2026-10-15")).await?;
        let path = root.join("static/cfp/radar.ics");
        fs::write(&path, "stale calendar").await?;
        assert!(validate_cfp_artifacts(&root).await.is_err());
        assert_eq!(fs::read_to_string(path).await?, "stale calendar");
        fs::remove_dir_all(root).await?;
        Ok(())
    }
}
