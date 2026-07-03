use std::{collections::BTreeMap, path::Path, time::Duration};

use chrono::{FixedOffset, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::fs;

use crate::BlogResult;

const USER_AGENT: &str = "mud-blog-cfp-radar/0.1 (+https://mud-blog.pages.dev/cfp/)";

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
    pub quality_tier: String,
    pub ranking_source: String,
    pub ranking_year: String,
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

fn deadline_signals_from_text(text: &str) -> Vec<String> {
    let lowered = text.to_ascii_lowercase();
    let keywords = [
        "deadline",
        "submission",
        "important dates",
        "call for papers",
        "cfp",
    ];
    let mut signals = Vec::new();
    for keyword in keywords {
        let mut search_from = 0;
        while let Some(relative) = lowered[search_from..].find(keyword) {
            let position = search_from + relative;
            let start = position.saturating_sub(90);
            let end = (position + 180).min(text.len());
            let snippet = compact_whitespace(&text[start..end]);
            if snippet.len() > 24 && !signals.iter().any(|seen| seen == &snippet) {
                signals.push(snippet);
            }
            if signals.len() >= 3 {
                return signals;
            }
            search_from = (position + keyword.len()).min(lowered.len());
        }
    }
    signals
}

async fn fetch_deadline_signals(
    client: &reqwest::Client,
    source: &CfpSource,
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
    let signals = deadline_signals_from_text(&stripped);
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
        .unwrap_or_else(|| "TBD / official page".to_string())
}

fn ranking_label(item: &CfpItem) -> String {
    let mut parts = Vec::new();
    if !item.quality_tier.trim().is_empty() {
        parts.push(item.quality_tier.trim().to_string());
    }
    if !item.ranking_source.trim().is_empty() {
        parts.push(item.ranking_source.trim().to_string());
    }
    if !item.ranking_year.trim().is_empty() {
        parts.push(format!("year: {}", item.ranking_year.trim()));
    }
    if parts.is_empty() {
        "TBD / verify in annual ranking source".to_string()
    } else {
        parts.join("; ")
    }
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

fn compact_level_label(item: &CfpItem) -> String {
    let level = item.quality_tier.trim();
    if level.is_empty() {
        "TBD".to_string()
    } else {
        level.to_string()
    }
}

fn compact_metric_label(item: &CfpItem) -> String {
    if is_journal(item) {
        "JIF: annual refresh".to_string()
    } else {
        "N/A".to_string()
    }
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
    output.push_str(
        "| Venue | Field | Dates | Deadline | Location | Level | Metric | Link |
",
    );
    output.push_str(
        "| --- | --- | --- | --- | --- | --- | --- | --- |
",
    );
    for item in items {
        let venue = format!("{} ({})", item.title, item.acronym);
        output.push_str(&format!(
            "| {} | {} | {} | {} | {} | {} | {} | [CFP]({}) |
",
            markdown_escape(&venue),
            markdown_escape(&item.track),
            markdown_escape(&item.conference_dates),
            markdown_escape(&deadline_label(item)),
            markdown_escape(&item.location),
            markdown_escape(&compact_level_label(item)),
            markdown_escape(&compact_metric_label(item)),
            item.url
        ));
    }
    output.push('\n');
}

fn render_deadline_radar(output: &mut String, issue: &CfpIssue) {
    output.push_str(
        "## Nearest submission deadlines

",
    );
    output.push_str("Configured open deadlines, sorted from the current issue date. Items without a configured date stay in the grouped watchlists below.

");
    let upcoming = sorted_item_refs(
        issue
            .items
            .iter()
            .filter(|item| item.days_until_deadline.is_some_and(|days| days >= 0)),
    );
    if upcoming.is_empty() {
        output.push_str("No open configured submission deadlines are available yet; check the grouped watchlists below for official CFP pages being monitored.

");
        return;
    }
    output.push_str(
        "| Deadline | Days | Venue | Kind | Field | Link |
",
    );
    output.push_str(
        "| --- | --- | --- | --- | --- | --- |
",
    );
    for item in upcoming.iter().take(12) {
        let venue = format!("{} ({})", item.title, item.acronym);
        let days = item.days_until_deadline.unwrap_or_default();
        output.push_str(&format!(
            "| {} | {} | {} | {} | {} | [CFP]({}) |
",
            markdown_escape(item.configured_deadline.as_deref().unwrap_or("TBD")),
            days,
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
    output.push_str("**Ranking note.** Journal Q1/Q2 labels are year-specific and category-specific; they must be refreshed from the latest JCR/SCImago-style journal quartile source each year. Conferences and workshops do not have journal-style Impact Factors or official Q1/Q2 quartiles, so those rows use a separate conference/workshop-ranking basis such as CORE rank, society flagship status, or field reputation.\n\n");
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
        "- Entries with configured deadlines: **{}**\n\n",
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
    output.push_str("- **Journal rows:** use the configured annual journal-quartile source and year. A Q1/Q2 label is only meaningful with its category and ranking year. Impact Factor means Journal Impact Factor, when the journal publicly exposes it or when the value is updated from JCR by the maintainer.\n");
    output.push_str("- **Conference/workshop rows:** do not use journal Impact Factor. The ranking column records a venue-specific proxy such as CORE rank, IEEE/ACM flagship status, or field reputation.\n");
    output.push_str("- **Annual refresh:** the weekly job keeps deadlines fresh; the configured Q/JIF metadata should be reviewed yearly when new JCR/SJR/CORE releases are available.\n\n");

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
        output.push_str(&format!("- Ranking basis: {}\n", ranking_label(item)));
        output.push_str(&format!(
            "- Impact factor / metric: {}\n",
            impact_label(item)
        ));
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
    for source in config.conferences {
        *tracks.entry(source.track.clone()).or_insert(0) += 1;
        let (fetch_status, deadline_signals) = fetch_deadline_signals(&client, &source).await;
        if fetch_status == "fetched" {
            fetched_count += 1;
        }
        let days = source
            .deadline
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
            quality_tier: configured_or_tbd(&source.quality_tier),
            ranking_source: source.ranking_source,
            ranking_year: source.ranking_year,
            impact_factor: configured_or_tbd(&source.impact_factor),
            impact_factor_year: source.impact_factor_year,
            note: source.note,
            tags: source.tags,
            configured_deadline: source.deadline,
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
        || !post.contains("## Nearest submission deadlines")
        || !post.contains("## Three-by-three quick view")
        || !post.contains("## Full grouped watchlists")
        || !post.contains("| Deadline | Days | Venue | Kind | Field | Link |")
        || !post.contains("| Venue | Field | Dates | Deadline | Location | Level | Metric | Link |")
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
