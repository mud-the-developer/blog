use std::{collections::BTreeMap, env, path::Path, time::Duration};

use chrono::{FixedOffset, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::fs;

use crate::BlogResult;

const USER_AGENT: &str = "mud-blog-cfp-radar/0.1 (+https://mud-blog.pages.dev/cfp/)";

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
    "ieee",
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

fn strip_html(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut in_tag = false;
    for ch in input.chars() {
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
        "manuscript deadline",
        "deadline",
        "due",
    ] {
        let mut search_from = 0;
        while let Some(relative) = lowered[search_from..].find(keyword) {
            let position = search_from + relative;
            let position = floor_char_boundary(signal, position);
            let context_start = floor_char_boundary(signal, position.saturating_sub(45));
            let context_end = ceil_char_boundary(signal, position + keyword.len());
            let context = signal[context_start..context_end].to_ascii_lowercase();
            if context.contains("camera")
                || context.contains("notification")
                || context.contains("acceptance")
                || context.contains("registration")
            {
                search_from = (position + keyword.len()).min(lowered.len());
                continue;
            }
            let before = &signal[..position];
            if let Some(date) = candidate_dates_from_text(before).last().copied() {
                push_unique_date(&mut dates, Some(date));
                let after_start = ceil_char_boundary(signal, position + keyword.len());
                let after = &signal[after_start..];
                let after_lowered = after.to_ascii_lowercase();
                if after_lowered
                    .find("final deadline")
                    .or_else(|| after_lowered.find("extended"))
                    .is_some_and(|offset| offset < 120)
                {
                    push_unique_date(
                        &mut dates,
                        candidate_dates_from_text(after).first().copied(),
                    );
                }
            } else {
                let after_start = ceil_char_boundary(signal, position + keyword.len());
                let after = &signal[after_start..];
                let after_dates = candidate_dates_from_text(after);
                push_unique_date(&mut dates, after_dates.first().copied());
                if after
                    .to_ascii_lowercase()
                    .find("extended")
                    .is_some_and(|offset| offset < 90)
                {
                    push_unique_date(&mut dates, after_dates.get(1).copied());
                }
            }
            search_from = (position + keyword.len()).min(lowered.len());
        }
    }
    dates
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
    let defaults = "models/gemini-2.5-flash-lite";
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

fn trusted_ai_source_url(source_url: &str, source: &CfpSource) -> bool {
    let url = source_url.to_ascii_lowercase();
    if url.is_empty() || contains_any(&url, BLOCKED_CFP_SOURCE_PATTERNS).is_some() {
        return false;
    }
    if contains_any(&url, TRUSTED_CFP_SOURCE_PATTERNS).is_some() {
        return true;
    }
    let configured_host = source.url.to_ascii_lowercase();
    !configured_host.is_empty() && url.contains(&configured_host)
}

fn accepted_ai_deadline_signal(
    finding: AiDeadlineFinding,
    source: &CfpSource,
    model: &str,
) -> Option<AiDeadlineSignal> {
    let status = finding.status.to_ascii_lowercase();
    if !(status.contains("found") || status == "active" || status == "closed") {
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
    Some(AiDeadlineSignal {
        deadline: Some(deadline.to_string()),
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
        if contains_any(&url, TRUSTED_CFP_SOURCE_PATTERNS).is_none() {
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
            let start = floor_char_boundary(text, position.saturating_sub(90));
            let end = ceil_char_boundary(text, position + 650);
            let snippet = compact_whitespace(&text[start..end]);
            if snippet.len() > 24 && !signals.iter().any(|seen| seen == &snippet) {
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

async fn fetch_deadline_signals(
    client: &reqwest::Client,
    source: &CfpSource,
    issue_date: &str,
) -> (String, Vec<String>) {
    let response = client.get(&source.url).send().await;
    let Ok(response) = response else {
        return ("fetch failed".to_string(), Vec::new());
    };
    if !response.status().is_success() {
        return (format!("http {}", response.status()), Vec::new());
    }
    let Ok(text) = response.text().await else {
        return ("decode failed".to_string(), Vec::new());
    };
    let stripped = strip_html(&text);
    let signals = deadline_signals_from_text(&stripped, issue_date);
    ("fetched".to_string(), signals)
}

fn markdown_escape(value: &str) -> String {
    value.replace('|', "\\|").replace('\n', " ")
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
        .map(|deadline| format!("{deadline} ({})", item.deadline_status))
        .unwrap_or_else(|| {
            if item.fetch_status == "fetched" {
                "No dated CFP posted on official page".to_string()
            } else if item.fetch_status.starts_with("http") || item.fetch_status == "fetch failed" {
                "Manual check required".to_string()
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

fn render_watchlist_table(output: &mut String, items: &[&CfpItem]) {
    if items.is_empty() {
        output.push_str(
            "No sources configured for this group yet.

",
        );
        return;
    }
    let show_rank_columns = items.iter().any(|item| has_verified_rank_or_metric(item));
    if show_rank_columns {
        output.push_str(
            "| Venue | Field | Dates | Deadline | Location | Verified rank | Rank source | Metric | Link |
",
        );
        output.push_str(
            "| --- | --- | --- | --- | --- | --- | --- | --- | --- |
",
        );
    } else {
        output.push_str(
            "| Venue | Field | Dates | Deadline | Location | Link |
",
        );
        output.push_str(
            "| --- | --- | --- | --- | --- | --- |
",
        );
    }
    for item in items {
        let venue = format!("{} ({})", item.title, item.acronym);
        if show_rank_columns {
            output.push_str(&format!(
                "| {} | {} | {} | {} | {} | {} | {} | {} | [CFP]({}) |
",
                markdown_escape(&venue),
                markdown_escape(&item.track),
                markdown_escape(&item.conference_dates),
                markdown_escape(&deadline_label(item)),
                markdown_escape(&item.location),
                markdown_escape(&verified_rank_label(item)),
                markdown_escape(&verified_rank_source_label(item)),
                markdown_escape(&compact_metric_label(item)),
                item.url
            ));
        } else {
            output.push_str(&format!(
                "| {} | {} | {} | {} | {} | [CFP]({}) |
",
                markdown_escape(&venue),
                markdown_escape(&item.track),
                markdown_escape(&item.conference_dates),
                markdown_escape(&deadline_label(item)),
                markdown_escape(&item.location),
                item.url
            ));
        }
    }
    output.push('\n');
}

fn render_deadline_radar(output: &mut String, issue: &CfpIssue) {
    output.push_str(
        "## Nearest submission deadlines

",
    );
    output.push_str("Configured or automatically detected open deadlines, sorted from the current issue date. Items without an official date signal stay in the grouped watchlists below.\n\n");
    let upcoming = sorted_item_refs(
        issue
            .items
            .iter()
            .filter(|item| item.days_until_deadline.is_some_and(|days| days >= 0)),
    );
    if upcoming.is_empty() {
        output.push_str("No open configured or detected submission deadlines are available yet; check the grouped watchlists below for official CFP pages being monitored.\n\n");
        return;
    }
    output.push_str(
        "| Deadline | Venue | Kind | Field | Link |
",
    );
    output.push_str(
        "| --- | --- | --- | --- | --- |
",
    );
    for item in upcoming.iter().take(12) {
        let venue = format!("{} ({})", item.title, item.acronym);
        output.push_str(&format!(
            "| {} | {} | {} | {} | [CFP]({}) |
",
            markdown_escape(&deadline_label(item)),
            markdown_escape(&venue),
            markdown_escape(&item.venue_type),
            markdown_escape(&item.track),
            item.url
        ));
    }
    output.push('\n');
}

fn render_type_preview(output: &mut String, title: &str, items: Vec<&CfpItem>) {
    output.push_str(&format!("### {title}\n\n"));
    let mut ranked = items;
    ranked.sort_by(|a, b| {
        let a_closed = a.days_until_deadline.is_some_and(|days| days < 0);
        let b_closed = b.days_until_deadline.is_some_and(|days| days < 0);
        a_closed
            .cmp(&b_closed)
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
    output.push_str("tags:\n  - cfp\n  - conferences\n  - workshops\n  - journals\n  - special-issues\n  - wireless\n  - communications\nexcerpt: \"Weekly CFP watchlist with nearest deadlines plus grouped conference, workshop, and journal-special-issue tables for wireless/communications-heavy venues.\"\n---\n\n");
    output.push_str("Weekly CFP radar for conferences, workshops, and journal special issues relevant to wireless communications, RAN/6G, networking, edge systems, AI systems, and security. Dates are operational leads: always verify the linked official CFP page before planning a submission.\n\n");
    output.push_str("**Ranking note.** Rank cells are verified-only: they stay `—` until a concrete source/year is recorded, such as CORE A*/A/B/C, CCF A/B/C, SCImago/JCR Q1/Q2, or an official society flagship statement. Conferences and workshops do not have journal-style Impact Factors or official Q1/Q2 quartiles.\n\n");
    let wireless_count = issue
        .items
        .iter()
        .filter(|item| is_wireless_or_communications(item))
        .count();
    output.push_str("## Snapshot\n\n");
    output.push_str(&format!("- Generated: `{}`\n", issue.generated_at));
    output.push_str(&format!("- Sources watched: **{}**\n", issue.source_count));
    output.push_str(&format!("- Conferences: **{}**\n", issue.conference_count));
    output.push_str(&format!("- Workshops: **{}**\n", issue.workshop_count));
    output.push_str(&format!(
        "- Journal special-issue sources: **{}**\n",
        issue.journal_count
    ));
    output.push_str(&format!(
        "- Wireless / communications-heavy sources: **{}**\n",
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
    let conferences = sorted_item_refs(issue.items.iter().filter(|item| is_conference(item)));
    render_watchlist_table(&mut output, &conferences);

    output.push_str("### Workshops\n\n");
    let workshops = sorted_item_refs(issue.items.iter().filter(|item| is_workshop(item)));
    render_watchlist_table(&mut output, &workshops);

    output.push_str("### Journal special issues\n\n");
    let journals = sorted_item_refs(issue.items.iter().filter(|item| is_journal(item)));
    render_watchlist_table(&mut output, &journals);

    output.push_str("## Ranking policy\n\n");
    output.push_str("- **Verified-rank only:** table rank cells stay `—` unless a concrete source/year is recorded, such as CORE A*/A/B/C, CCF A/B/C, SCImago/JCR Q1/Q2, or an official society flagship statement.\n");
    output.push_str("- **No proxy levels:** conferences and workshops do not use journal Impact Factors or journal-style Q1/Q2 quartiles. Heuristic labels such as top-tier, flagship, or specialized are not shown as verified rank.\n");
    output.push_str("- **Annual refresh:** verified rank and journal metrics must be refreshed when new JCR/SJR/CORE/CCF releases are available.\n\n");

    output.push_str("## Deadline signals from official pages\n\n");
    for item in &issue.items {
        output.push_str(&format!("### {} ({})\n\n", item.title, item.acronym));
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
        output.push_str(&format!("- Note: {}\n", item.note));
        if item.deadline_signals.is_empty() {
            output.push_str(
                "- Page signal: no compact deadline snippet was detected in this run.\n\n",
            );
        } else {
            output.push_str("- Page signals:\n");
            for signal in &item.deadline_signals {
                output.push_str(&format!("  - {}\n", signal));
            }
            output.push('\n');
        }
    }

    output.push_str("## Track coverage\n\n");
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

    let config_path = root.join("config/cfp_sources.json");
    let config: CfpConfig = serde_json::from_str(&fs::read_to_string(&config_path).await?)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(18))
        .user_agent(USER_AGENT)
        .build()?;

    let mut items = Vec::new();
    let mut tracks = BTreeMap::new();
    let mut fetched_count = 0;
    let ai_targets = cfp_ai_target_tokens();
    let mut ai_requests_remaining = cfp_ai_max_requests();
    for source in config.conferences {
        *tracks.entry(source.track.clone()).or_insert(0) += 1;
        let (fetch_status, mut deadline_signals) =
            fetch_deadline_signals(&client, &source, &issue_date).await;
        if fetch_status == "fetched" {
            fetched_count += 1;
        }
        let mut detected_deadline = source
            .deadline
            .clone()
            .or_else(|| inferred_deadline_from_signals(&deadline_signals, &issue_date));
        if detected_deadline.is_none()
            && ai_requests_remaining > 0
            && should_use_ai_deadline_fallback(&source, &fetch_status, &ai_targets)
        {
            ai_requests_remaining -= 1;
            if let Some(ai_signal) =
                ai_deadline_signal(&client, &source, &issue_date, &fetch_status).await
            {
                detected_deadline = ai_signal.deadline;
                deadline_signals.push(ai_signal.signal);
            }
        }
        let days = detected_deadline
            .as_deref()
            .and_then(|deadline| days_until(&issue_date, deadline));
        items.push(CfpItem {
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
            configured_deadline: detected_deadline,
            days_until_deadline: days,
            deadline_status: deadline_status(days),
            fetch_status,
            deadline_signals,
        });
    }
    sort_items(&mut items);
    let with_configured_deadline_count = items
        .iter()
        .filter(|item| item.configured_deadline.is_some())
        .count();
    let active_count = items
        .iter()
        .filter(|item| item.days_until_deadline.is_none_or(|days| days >= 0))
        .count();
    let conference_count = items.iter().filter(|item| is_conference(item)).count();
    let workshop_count = items.iter().filter(|item| is_workshop(item)).count();
    let journal_count = items.iter().filter(|item| is_journal(item)).count();
    let issue = CfpIssue {
        generated_at: generated_at_utc(),
        issue_date: issue_date.clone(),
        source_count: items.len(),
        active_count,
        conference_count,
        workshop_count,
        journal_count,
        with_configured_deadline_count,
        fetched_count,
        tracks,
        items,
    };

    let data_dir = root.join("data/cfp");
    let archive_dir = data_dir.join("archive");
    let static_data_dir = root.join("static/cfp/data");
    let posts_dir = root.join("posts/cfp");
    fs::create_dir_all(&archive_dir).await?;
    fs::create_dir_all(&static_data_dir).await?;
    fs::create_dir_all(&posts_dir).await?;

    let pretty = serde_json::to_string_pretty(&issue)?;
    fs::write(data_dir.join("latest.json"), &pretty).await?;
    fs::write(archive_dir.join(format!("{issue_date}.json")), &pretty).await?;
    fs::write(static_data_dir.join("latest.json"), &pretty).await?;
    fs::write(
        posts_dir.join(format!("{issue_date}-cfp-radar.md")),
        render_markdown(&issue),
    )
    .await?;

    Ok(issue)
}

pub async fn validate_cfp_artifacts(root: impl AsRef<Path>) -> BlogResult<CfpIssue> {
    let root = root.as_ref();
    let latest_path = root.join("data/cfp/latest.json");
    let static_latest_path = root.join("static/cfp/data/latest.json");
    let issue: CfpIssue = serde_json::from_str(&fs::read_to_string(&latest_path).await?)?;
    if issue.source_count < 8 {
        return Err(format!("CFP source coverage is too low: {}", issue.source_count).into());
    }
    if issue.source_count < 48 {
        return Err(format!(
            "CFP source list should include a broad communications-heavy radar: {}",
            issue.source_count
        )
        .into());
    }
    if issue.items.is_empty() {
        return Err("CFP latest.json has no items".into());
    }
    validate_source_quality(&issue.items)?;
    if issue.tracks.len() < 4 {
        return Err(format!("CFP track coverage is too narrow: {}", issue.tracks.len()).into());
    }
    let wireless_count = issue
        .items
        .iter()
        .filter(|item| is_wireless_or_communications(item))
        .count();
    if wireless_count < 36 {
        return Err(
            format!("Wireless/communications CFP coverage is too low: {wireless_count}").into(),
        );
    }
    if issue.workshop_count < 3 {
        return Err(format!("Workshop CFP coverage is too low: {}", issue.workshop_count).into());
    }
    if issue.journal_count < 6 {
        return Err(format!(
            "Journal special-issue CFP coverage is too low: {}",
            issue.journal_count
        )
        .into());
    }
    let workshop_deadline_count = issue
        .items
        .iter()
        .filter(|item| is_workshop(item) && item.configured_deadline.is_some())
        .count();
    if workshop_deadline_count < issue.workshop_count {
        return Err(format!(
            "Workshop CFP deadline coverage is incomplete: {workshop_deadline_count}/{}",
            issue.workshop_count
        )
        .into());
    }
    let journal_deadline_count = issue
        .items
        .iter()
        .filter(|item| is_journal(item) && item.configured_deadline.is_some())
        .count();
    if journal_deadline_count < 7 {
        return Err(format!(
            "Journal special-issue deadline extraction is too sparse: {journal_deadline_count}"
        )
        .into());
    }
    if !static_latest_path.exists() {
        return Err("static/cfp/data/latest.json is missing".into());
    }
    let post_path = root
        .join("posts/cfp")
        .join(format!("{}-cfp-radar.md", issue.issue_date));
    if !post_path.exists() {
        return Err(format!("CFP markdown issue is missing: {}", post_path.display()).into());
    }
    let post = fs::read_to_string(&post_path).await?;
    if post.contains("| 학회명 |")
        || post.contains("Q1/Q2 / ranking basis")
        || post.contains("Q1-like")
        || post.contains("Q2-like")
        || post.contains("Q1/Q2-like")
        || !post.contains("## Nearest submission deadlines")
        || !post.contains("## Three-by-three quick view")
        || !post.contains("## Full grouped watchlists")
        || post.contains("| Deadline | Days | Venue | Kind | Field | Link |")
        || !post.contains("| Deadline | Venue | Kind | Field | Link |")
        || post.contains("| Venue | Field | Dates | Deadline | Location | Verified rank | Rank source | Metric | Link |")
        || !post.contains("| Venue | Field | Dates | Deadline | Location | Link |")
        || !post.contains("Journal special")
        || !post.contains("### Conferences")
        || !post.contains("### Workshops")
    {
        return Err("CFP markdown issue is missing required public sections".into());
    }
    let static_issue: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(static_latest_path).await?)?;
    if static_issue["issueDate"] != json!(issue.issue_date) {
        return Err("static CFP latest.json does not match data/cfp/latest.json".into());
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
        let finding = AiDeadlineFinding {
            deadline: Some("2026-07-24".to_string()),
            status: "found".to_string(),
            evidence: "Paper submission deadline: 24 July 2026".to_string(),
            source_url: "https://infocom2026.ieee-infocom.org/call-papers".to_string(),
        };

        let signal = accepted_ai_deadline_signal(finding, &source, "models/gemini-2.5-flash")
            .expect("official AI finding should be accepted");
        assert_eq!(signal.deadline.as_deref(), Some("2026-07-24"));
        assert!(signal.signal.contains("AI-assisted official CFP lookup"));
        assert!(signal.signal.contains("Paper submission deadline"));
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
}
