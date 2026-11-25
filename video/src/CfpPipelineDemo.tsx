import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  Chapter,
  enterSpring,
  fadeWindow,
  FONT_MONO,
  FrameChrome,
  GLASS_CARD_STYLE,
  PALETTE,
} from './theme';

export const CFP_DURATION = 1350; // 45s @ 30fps

const CHAPTERS: Chapter[] = [
  { label: 'Overview', start: 0, end: 210 },
  { label: 'Problem', start: 210, end: 480 },
  { label: 'Rust Pipeline', start: 480, end: 780 },
  { label: 'Calendar & UID', start: 780, end: 1080 },
  { label: 'Live Feeds', start: 1080, end: 1350 },
];

const SceneOverview: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const opacity = fadeWindow(frame, 0, 210, 14);
  const s1 = enterSpring(frame, 4, fps);
  const s2 = enterSpring(frame, 20, fps);
  const s3 = enterSpring(frame, 36, fps);

  const sampleRows = [
    { venue: 'IEEE INFOCOM', track: 'Conference · Networking', badge: 'OPEN', color: PALETTE.green, soft: PALETTE.greenSoft, dates: 'Abstract + Full Paper' },
    { venue: 'ACM MobiCom', track: 'Conference · Wireless', badge: 'EXTENDED', color: PALETTE.amber, soft: PALETTE.amberSoft, dates: 'Stable UID Updated' },
    { venue: 'IEEE JSAC SI', track: 'Journal Special Issue', badge: 'VERIFIED', color: PALETTE.navy, soft: PALETTE.blueSoft, dates: 'Official CFP Domain' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        inset: '26px 40px 22px',
        opacity,
        display: 'grid',
        gridTemplateColumns: '1.15fr 0.85fr',
        gap: 28,
        alignItems: 'center',
      }}
    >
      <div style={{ transform: `translateY(${(1 - s1) * 18}px)` }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 12px',
            borderRadius: 999,
            ...GLASS_CARD_STYLE,
            fontFamily: FONT_MONO,
            fontSize: 13,
            fontWeight: 600,
            color: PALETTE.navy,
            marginBottom: 18,
          }}
        >
          <span>MUD BLOG AUTOMATION</span>
          <span style={{ color: PALETTE.border }}>·</span>
          <span>RUST + TOKIO + ICALENDAR</span>
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 48,
            lineHeight: 1.08,
            fontWeight: 800,
            letterSpacing: '-0.035em',
            color: PALETTE.ink,
          }}
        >
          Call for Papers Radar
        </h1>
        <p
          style={{
            margin: '14px 0 0',
            fontSize: 21,
            lineHeight: 1.44,
            fontWeight: 500,
            color: PALETTE.muted,
          }}
        >
          Daily Rust pipeline tracking official wireless, AI/systems, and networking deadlines with verified JSON and subscribable .ics feeds.
        </p>

        <div
          style={{
            marginTop: 26,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 12,
            opacity: s2,
            transform: `translateY(${(1 - s2) * 14}px)`,
          }}
        >
          {[
            { value: '67', label: 'Official Sources', sub: '58 live fetched' },
            { value: '140', label: 'Tracked Venues', sub: '46 conf · 11 ws · 83 SI' },
            { value: '46', label: 'Active Calls', sub: '135 dated deadlines' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                ...GLASS_CARD_STYLE,
                borderRadius: 16,
                padding: '16px 18px',
              }}
            >
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 32,
                  fontWeight: 800,
                  color: PALETTE.navy,
                  letterSpacing: '-0.03em',
                }}
              >
                {stat.value}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: PALETTE.ink, marginTop: 4 }}>
                {stat.label}
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted, marginTop: 3 }}>
                {stat.sub}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          ...GLASS_CARD_STYLE,
          borderRadius: 20,
          padding: '22px 24px',
          opacity: s3,
          transform: `translateY(${(1 - s3) * 18}px)`,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.navy, letterSpacing: '0.06em' }}>
            LIVE SNAPSHOT PREVIEW
          </span>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11.5,
              padding: '3px 8px',
              borderRadius: 6,
              backgroundColor: PALETTE.greenSoft,
              color: PALETTE.green,
              fontWeight: 700,
            }}
          >
            SINGLE-SNAPSHOT
          </span>
        </div>

        {sampleRows.map((row, idx) => {
          const rowIn = enterSpring(frame, 44 + idx * 14, fps);
          return (
            <div
              key={row.venue}
              style={{
                padding: '14px 16px',
                borderRadius: 14,
                backgroundColor: '#FFFFFF',
                border: `1px solid ${PALETTE.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                opacity: rowIn,
                transform: `translateX(${(1 - rowIn) * 16}px)`,
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: PALETTE.ink }}>{row.venue}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: PALETTE.muted, marginTop: 3 }}>
                  {row.track} · {row.dates}
                </div>
              </div>
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '4px 9px',
                  borderRadius: 999,
                  backgroundColor: row.soft,
                  color: row.color,
                  whiteSpace: 'nowrap',
                }}
              >
                {row.badge}
              </span>
            </div>
          );
        })}

        <div
          style={{
            marginTop: 4,
            padding: '10px 14px',
            borderRadius: 10,
            backgroundColor: PALETTE.cardSoft,
            border: `1px solid ${PALETTE.border}`,
            fontFamily: FONT_MONO,
            fontSize: 12,
            color: PALETTE.muted,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>/cfp/ · /cfp/data/latest.json</span>
          <span style={{ color: PALETTE.navy, fontWeight: 700 }}>webcal:// radar.ics</span>
        </div>
      </div>
    </div>
  );
};

const SceneProblem: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 210;
  const opacity = fadeWindow(frame, 210, 480, 14);
  const s1 = enterSpring(local, 6, fps);
  const s2 = enterSpring(local, 24, fps);

  const painPoints = [
    { title: 'Stale Crowdsourced Dates', desc: 'Community wikis lag behind official venue extensions or silently carry last year’s schedule.' },
    { title: 'Collapsed Milestones', desc: 'Single-date entries blur mandatory Abstract registration, Full Paper, and Camera-Ready dates.' },
    { title: 'Duplicate Calendar Events', desc: 'Ad-hoc .ics exports regenerate random UIDs on updates, cluttering subscribed calendars.' },
  ];

  const guarantees = [
    { title: 'Official Domain Evidence Gate', desc: 'Fetches only configured official IEEE, ACM, USENIX, and journal CFP pages with stored source evidence.' },
    { title: 'Separate Milestone Parsing', desc: 'Tracks Abstract, Paper, and Camera-Ready dates independently without conflating phases.' },
    { title: 'Transparent Stale Flagging', desc: 'Blocked or unconfirmed venues retain last verified dates and are flagged—never silently faked.' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        inset: '26px 40px 22px',
        opacity,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <div style={{ transform: `translateY(${(1 - s1) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, color: PALETTE.navy, letterSpacing: '0.06em' }}>
          WHY AN EVIDENCE-GATED PIPELINE
        </div>
        <h2 style={{ margin: '6px 0 0', fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em' }}>
          Zero Guesswork Across Fast-Moving Research Deadlines
        </h2>
      </div>

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 24,
          alignItems: 'stretch',
        }}
      >
        <div
          style={{
            ...GLASS_CARD_STYLE,
            borderRadius: 20,
            padding: '22px 24px',
            opacity: s1,
            transform: `translateY(${(1 - s1) * 18}px)`,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 18, fontWeight: 750, color: PALETTE.red }}>Manual &amp; Wiki Trackers</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 12, padding: '4px 10px', borderRadius: 999, backgroundColor: PALETTE.redSoft, color: PALETTE.red, fontWeight: 700 }}>
              FRAGILE
            </span>
          </div>
          {painPoints.map((item, idx) => {
            const p = enterSpring(local, 18 + idx * 14, fps);
            return (
              <div
                key={item.title}
                style={{
                  padding: '15px 16px',
                  borderRadius: 14,
                  backgroundColor: '#FFFFFF',
                  border: `1px solid ${PALETTE.border}`,
                  borderLeft: `4px solid ${PALETTE.red}`,
                  opacity: p,
                  transform: `translateX(${(1 - p) * -14}px)`,
                }}
              >
                <div style={{ fontSize: 15.5, fontWeight: 700, color: PALETTE.ink }}>{item.title}</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.48, color: PALETTE.muted, marginTop: 5 }}>{item.desc}</div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            ...GLASS_CARD_STYLE,
            borderRadius: 20,
            padding: '22px 24px',
            opacity: s2,
            transform: `translateY(${(1 - s2) * 18}px)`,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 18, fontWeight: 750, color: PALETTE.navy }}>CFP Radar Evidence Gate</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 12, padding: '4px 10px', borderRadius: 999, backgroundColor: PALETTE.greenSoft, color: PALETTE.green, fontWeight: 700 }}>
              VERIFIED
            </span>
          </div>
          {guarantees.map((item, idx) => {
            const g = enterSpring(local, 32 + idx * 14, fps);
            return (
              <div
                key={item.title}
                style={{
                  padding: '15px 16px',
                  borderRadius: 14,
                  backgroundColor: '#FFFFFF',
                  border: `1px solid ${PALETTE.border}`,
                  borderLeft: `4px solid ${PALETTE.green}`,
                  opacity: g,
                  transform: `translateX(${(1 - g) * 14}px)`,
                }}
              >
                <div style={{ fontSize: 15.5, fontWeight: 700, color: PALETTE.ink }}>{item.title}</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.48, color: PALETTE.muted, marginTop: 5 }}>{item.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const ScenePipeline: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 480;
  const opacity = fadeWindow(frame, 480, 780, 14);
  const head = enterSpring(local, 4, fps);
  const pulse = (local % 75) / 75;

  const stages = [
    { num: '01', title: 'Scheduled Trigger', cmd: 'update-cfp-radar.yml', desc: 'Daily GitHub Actions cron triggers the compiled Rust binary.', color: PALETTE.navy },
    { num: '02', title: 'Async Official Fetch', cmd: 'mud-blog cfp update', desc: 'Tokio client queries 67 official venue CFP pages with retry backoff.', color: PALETTE.blue },
    { num: '03', title: 'Evidence & Date Gate', cmd: 'src/cfp.rs parser', desc: 'Extracts ISO dates, separates Abstract / Paper / Camera-Ready, detects extensions.', color: PALETTE.teal },
    { num: '04', title: 'Validate & Emit', cmd: 'mud-blog cfp validate', desc: 'Verifies schema consistency, updates single snapshot JSON, Markdown, and .ics.', color: PALETTE.green },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        inset: '26px 40px 22px',
        opacity,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, color: PALETTE.navy, letterSpacing: '0.06em' }}>
          END-TO-END RUST ARCHITECTURE
        </div>
        <h2 style={{ margin: '6px 0 0', fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em' }}>
          Four-Stage Automated Snapshot Pipeline
        </h2>
      </div>

      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18, marginTop: 6 }}>
        {stages.map((st, idx) => {
          const sp = enterSpring(local, 14 + idx * 14, fps);
          const active = Math.floor(pulse * 4) === idx;
          return (
            <div
              key={st.num}
              style={{
                ...GLASS_CARD_STYLE,
                borderRadius: 18,
                padding: '20px 18px',
                opacity: sp,
                transform: `translateY(${(1 - sp) * 20}px)`,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                outline: active ? `2px solid ${st.color}` : '2px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 12,
                    fontWeight: 800,
                    padding: '4px 9px',
                    borderRadius: 8,
                    backgroundColor: st.color,
                    color: '#FFFFFF',
                  }}
                >
                  STAGE {st.num}
                </span>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    backgroundColor: active ? st.color : PALETTE.border,
                  }}
                />
              </div>
              <div style={{ fontSize: 18, fontWeight: 750, color: PALETTE.ink }}>{st.title}</div>
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 12,
                  padding: '5px 8px',
                  borderRadius: 7,
                  backgroundColor: PALETTE.cardSoft,
                  border: `1px solid ${PALETTE.border}`,
                  color: st.color,
                  fontWeight: 600,
                }}
              >
                {st.cmd}
              </div>
              <div style={{ fontSize: 13.5, lineHeight: 1.5, color: PALETTE.muted }}>{st.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Live animated dataflow + validation strip */}
      <div
        style={{
          ...GLASS_CARD_STYLE,
          borderRadius: 18,
          padding: '18px 22px',
          marginTop: 'auto',
          display: 'grid',
          gridTemplateColumns: '1.2fr 0.8fr',
          gap: 22,
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.muted, marginBottom: 8 }}>
            VALIDATION GATE · CONTINUOUS INTEGRITY CHECK
          </div>
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 13.5,
              lineHeight: 1.65,
              padding: '12px 14px',
              borderRadius: 12,
              backgroundColor: '#141923',
              color: '#E2E8F0',
            }}
          >
            <div><span style={{ color: '#49D9B9' }}>$</span> mud-blog cfp validate</div>
            <div><span style={{ color: '#A4BBFF' }}>✓</span> sources: 67 configured · 58 live fetched · 0 schema errors</div>
            <div><span style={{ color: '#A4BBFF' }}>✓</span> snapshot: 140 tracked · 46 active calls · 135 dated deadlines</div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {[
            { k: 'Conferences', v: '46', pct: 33, c: PALETTE.navy },
            { k: 'Journal Special Issues', v: '83', pct: 59, c: PALETTE.teal },
            { k: 'Workshops', v: '11', pct: 8, c: PALETTE.purple },
          ].map((bar, idx) => {
            const w = interpolate(local, [40 + idx * 12, 80 + idx * 12], [0, bar.pct], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return (
              <div key={bar.k}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 650, marginBottom: 4 }}>
                  <span>{bar.k}</span>
                  <span style={{ fontFamily: FONT_MONO, color: bar.c }}>{bar.v}</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, backgroundColor: PALETTE.cardSoft, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${w}%`, borderRadius: 999, backgroundColor: bar.c }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const SceneCalendar: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 780;
  const opacity = fadeWindow(frame, 780, 1080, 14);
  const s1 = enterSpring(local, 6, fps);
  const s2 = enterSpring(local, 24, fps);
  const extended = local > 110;

  return (
    <div
      style={{
        position: 'absolute',
        inset: '26px 40px 22px',
        opacity,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 24,
        alignItems: 'stretch',
      }}
    >
      <div
        style={{
          ...GLASS_CARD_STYLE,
          borderRadius: 20,
          padding: '24px 26px',
          opacity: s1,
          transform: `translateY(${(1 - s1) * 16}px)`,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 700, color: PALETTE.navy, letterSpacing: '0.06em' }}>
          MILESTONE SEPARATION &amp; EXTENSIONS
        </div>
        <h3 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.025em' }}>
          Stable UIDs Preserve Calendar Subscriptions
        </h3>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: PALETTE.muted }}>
          Each milestone is parsed into its own structured entry. When a conference extends a deadline, the Rust emitter updates the date while preserving the exact iCalendar UID.
        </p>

        <div style={{ display: 'grid', gap: 10, marginTop: 4 }}>
          {[
            { phase: 'Abstract Registration', date: '2026-07-24', tag: 'REQUIRED', color: PALETTE.navy, soft: PALETTE.blueSoft },
            {
              phase: 'Full Paper Deadline',
              date: extended ? '2026-08-07 (Extended +7d)' : '2026-07-31',
              tag: extended ? 'UID UPDATED' : 'ORIGINAL',
              color: extended ? PALETTE.green : PALETTE.amber,
              soft: extended ? PALETTE.greenSoft : PALETTE.amberSoft,
            },
            { phase: 'Camera-Ready Final', date: '2026-12-15', tag: 'MILESTONE', color: PALETTE.teal, soft: PALETTE.greenSoft },
          ].map((m) => (
            <div
              key={m.phase}
              style={{
                padding: '13px 16px',
                borderRadius: 12,
                backgroundColor: '#FFFFFF',
                border: `1px solid ${PALETTE.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: PALETTE.ink }}>{m.phase}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, color: m.color, fontWeight: 600, marginTop: 3 }}>
                  {m.date}
                </div>
              </div>
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '4px 9px',
                  borderRadius: 999,
                  backgroundColor: m.soft,
                  color: m.color,
                }}
              >
                {m.tag}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          ...GLASS_CARD_STYLE,
          borderRadius: 20,
          padding: '24px 26px',
          opacity: s2,
          transform: `translateY(${(1 - s2) * 16}px)`,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 700, color: PALETTE.teal, letterSpacing: '0.06em' }}>
            RFC 5545 ICALENDAR OUTPUT
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted }}>
            /cfp/radar.ics
          </span>
        </div>

        <div
          style={{
            flex: 1,
            padding: '18px 20px',
            borderRadius: 14,
            backgroundColor: '#141923',
            color: '#E2E8F0',
            fontFamily: FONT_MONO,
            fontSize: 13.5,
            lineHeight: 1.72,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div style={{ color: '#94A3B8' }}>BEGIN:VEVENT</div>
          <div>
            <span style={{ color: '#A4BBFF' }}>UID:</span>cfp-ieee-infocom-2027-paper@mud-blog
          </div>
          <div>
            <span style={{ color: '#A4BBFF' }}>DTSTART;VALUE=DATE:</span>
            <span style={{ color: extended ? '#49D9B9' : '#FBBF24', fontWeight: 700 }}>
              {extended ? '20260807' : '20260731'}
            </span>
          </div>
          <div>
            <span style={{ color: '#A4BBFF' }}>SUMMARY:</span>IEEE INFOCOM 2027 — Full Paper
          </div>
          <div>
            <span style={{ color: '#A4BBFF' }}>STATUS:</span>CONFIRMED
          </div>
          <div>
            <span style={{ color: '#A4BBFF' }}>SEQUENCE:</span>
            <span style={{ color: extended ? '#49D9B9' : '#E2E8F0', fontWeight: 700 }}>
              {extended ? '2' : '1'}
            </span>
          </div>
          <div style={{ color: '#94A3B8' }}>END:VEVENT</div>
        </div>

        <div
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            backgroundColor: PALETTE.blueSoft,
            border: `1px solid ${PALETTE.border}`,
            fontSize: 13.5,
            color: PALETTE.navy,
            fontWeight: 600,
          }}
        >
          Apple Calendar · Google Calendar · Outlook sync cleanly via <span style={{ fontFamily: FONT_MONO }}>webcal://</span> with zero duplicate rows.
        </div>
      </div>
    </div>
  );
};

const SceneFeeds: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 1080;
  const opacity = fadeWindow(frame, 1080, 1350, 14);
  const head = enterSpring(local, 4, fps);

  const outputs = [
    {
      path: '/cfp/',
      title: 'Live Static Dashboard',
      badge: 'ASKAMA HTML',
      color: PALETTE.navy,
      soft: PALETTE.blueSoft,
      points: [
        'Pre-rendered Rust/Askama page with instant TTFB',
        'Live client-side countdown badges & category filters',
        'Flagged unconfirmed venues separated from open calls',
      ],
    },
    {
      path: '/cfp/data/latest.json',
      title: 'Structured JSON Feed',
      badge: 'MACHINE READABLE',
      color: PALETTE.teal,
      soft: PALETTE.greenSoft,
      points: [
        '140 tracked venues with verified official CFP URLs',
        'Source fetch telemetry & evidence audit timestamps',
        'Ready for CLI scripts, Slack alerts, or lab dashboards',
      ],
    },
    {
      path: '/cfp/radar.ics',
      title: 'Subscribable Calendar',
      badge: 'WEBCAL · RFC 5545',
      color: PALETTE.purple,
      soft: PALETTE.purpleSoft,
      points: [
        'One-click subscribe in Apple / Google / Outlook',
        'Separate events for Abstract, Paper, and Camera-Ready',
        'Deterministic UIDs update seamlessly on extensions',
      ],
    },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        inset: '26px 40px 22px',
        opacity,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, color: PALETTE.navy, letterSpacing: '0.06em' }}>
          PUBLISHED ENDPOINTS · ZERO ARCHIVE CLUTTER
        </div>
        <h2 style={{ margin: '6px 0 0', fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em' }}>
          Three Synchronized Outputs from One Rust Build
        </h2>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
        {outputs.map((out, idx) => {
          const sp = enterSpring(local, 14 + idx * 14, fps);
          return (
            <div
              key={out.path}
              style={{
                ...GLASS_CARD_STYLE,
                borderRadius: 20,
                padding: '22px 22px',
                opacity: sp,
                transform: `translateY(${(1 - sp) * 20}px)`,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <span
                style={{
                  alignSelf: 'flex-start',
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '4px 9px',
                  borderRadius: 999,
                  backgroundColor: out.soft,
                  color: out.color,
                }}
              >
                {out.badge}
              </span>
              <div style={{ fontSize: 21, fontWeight: 800, color: PALETTE.ink }}>{out.title}</div>
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '6px 10px',
                  borderRadius: 8,
                  backgroundColor: PALETTE.cardSoft,
                  border: `1px solid ${PALETTE.border}`,
                  color: out.color,
                }}
              >
                {out.path}
              </div>
              <div style={{ display: 'grid', gap: 9, marginTop: 4 }}>
                {out.points.map((pt) => (
                  <div key={pt} style={{ display: 'flex', gap: 8, fontSize: 13.5, lineHeight: 1.48, color: PALETTE.muted }}>
                    <span style={{ color: out.color, fontWeight: 800 }}>•</span>
                    <span>{pt}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          ...GLASS_CARD_STYLE,
          borderRadius: 14,
          padding: '13px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: FONT_MONO,
          fontSize: 13,
          color: PALETTE.ink,
          fontWeight: 600,
        }}
      >
        <span>mud-blog · Rust + Tokio + Askama + GitHub Actions + Cloudflare Pages</span>
        <span style={{ color: PALETTE.navy }}>67 sources · 140 venues · Daily verified snapshot</span>
      </div>
    </div>
  );
};

export const CfpPipelineDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <FrameChrome
      badge="RUST · CFP PIPELINE"
      title="Call for Papers — Automated Deadline Pipeline"
      chapters={CHAPTERS}
      frame={frame}
      durationInFrames={CFP_DURATION}
      accentColor={PALETTE.navy}
      footerLabel="mud blog · Rust + Tokio + Askama + iCalendar"
    >
      {frame < 224 && <SceneOverview frame={frame} fps={fps} />}
      {frame >= 196 && frame < 494 && <SceneProblem frame={frame} fps={fps} />}
      {frame >= 466 && frame < 794 && <ScenePipeline frame={frame} fps={fps} />}
      {frame >= 766 && frame < 1094 && <SceneCalendar frame={frame} fps={fps} />}
      {frame >= 1066 && <SceneFeeds frame={frame} fps={fps} />}
    </FrameChrome>
  );
};
