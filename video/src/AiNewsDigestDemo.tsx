import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import {
  Chapter,
  enterSpring,
  fadeWindow,
  FONT_MONO,
  FrameChrome,
  GLASS_CARD_STYLE,
  PALETTE,
} from './theme';

export const NEWS_DURATION = 1350; // 45s @ 30fps

const CHAPTERS: Chapter[] = [
  { label: 'Overview', start: 0, end: 210 },
  { label: 'Daily Pipeline', start: 210, end: 480 },
  { label: 'Static + Edge', start: 480, end: 780 },
  { label: 'Search & Export', start: 780, end: 1080 },
  { label: 'Guarantees', start: 1080, end: 1350 },
];

const SceneOverview: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const opacity = fadeWindow(frame, 0, 210, 14);
  const s1 = enterSpring(frame, 4, fps);
  const s2 = enterSpring(frame, 20, fps);
  const s3 = enterSpring(frame, 36, fps);

  const sections = [
    { name: 'Hot in 24 Hours', tag: 'TOP SIGNAL', color: PALETTE.red, soft: PALETTE.redSoft },
    { name: 'Repository Momentum', tag: 'GITHUB', color: PALETTE.navy, soft: PALETTE.blueSoft },
    { name: 'Fresh Papers', tag: 'ARXIV + HF', color: PALETTE.teal, soft: PALETTE.greenSoft },
    { name: 'Community Chatter', tag: 'X · GEEKNEWS', color: PALETTE.purple, soft: PALETTE.purpleSoft },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        inset: '26px 40px 22px',
        opacity,
        display: 'grid',
        gridTemplateColumns: '1.16fr 0.84fr',
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
            color: PALETTE.teal,
            marginBottom: 18,
          }}
        >
          <span>MUD BLOG AUTOMATION</span>
          <span style={{ color: PALETTE.border }}>·</span>
          <span>PYTHON + RUST + CLOUDFLARE EDGE</span>
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 46,
            lineHeight: 1.08,
            fontWeight: 800,
            letterSpacing: '-0.035em',
            color: PALETTE.ink,
          }}
        >
          AI News Digest &amp; Search Desk
        </h1>
        <p
          style={{
            margin: '14px 0 0',
            fontSize: 20.5,
            lineHeight: 1.44,
            fontWeight: 500,
            color: PALETTE.muted,
          }}
        >
          Daily structured AI/research signal briefs statically compiled in Rust, paired with live multi-source candidate search on Cloudflare Pages Functions.
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
            { value: '7', label: 'Curated Sources', sub: 'arXiv · HF · GH · X · etc.' },
            { value: '4', label: 'Editorial Sections', sub: 'Structured daily brief' },
            { value: '60d', label: 'Rolling Retention', sub: '54 active daily issues' },
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
                  color: PALETTE.teal,
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
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.teal, letterSpacing: '0.06em' }}>
            DAILY BRIEF STRUCTURE
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted }}>
            /news/
          </span>
        </div>

        {sections.map((sec, idx) => {
          const itemIn = enterSpring(frame, 42 + idx * 12, fps);
          return (
            <div
              key={sec.name}
              style={{
                padding: '13px 16px',
                borderRadius: 13,
                backgroundColor: '#FFFFFF',
                border: `1px solid ${PALETTE.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                opacity: itemIn,
                transform: `translateX(${(1 - itemIn) * 14}px)`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: sec.color }}>
                  0{idx + 1}
                </span>
                <span style={{ fontSize: 15.5, fontWeight: 700, color: PALETTE.ink }}>{sec.name}</span>
              </div>
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '4px 9px',
                  borderRadius: 999,
                  backgroundColor: sec.soft,
                  color: sec.color,
                }}
              >
                {sec.tag}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SceneDailyPipeline: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 210;
  const opacity = fadeWindow(frame, 210, 480, 14);
  const head = enterSpring(local, 4, fps);
  const pulseIdx = Math.floor(((local % 80) / 80) * 4);

  const stages = [
    { num: '01', title: 'Scheduled Cron', cmd: 'update-news-digest.yml', desc: 'Daily GitHub Actions job collects fresh AI, systems, and open-source signals.', color: PALETTE.navy },
    { num: '02', title: '7-Source Ingestion', cmd: 'generate_news_digest.py', desc: 'Fetches GitHub, arXiv, HF Papers, X, LinkedIn, GeekNews, and Endigest.', color: PALETTE.teal },
    { num: '03', title: 'Rank & Synthesize', cmd: '4-section brief builder', desc: 'Deduplicates URLs, ranks signal momentum, and writes one compact daily issue.', color: PALETTE.purple },
    { num: '04', title: '60-Day Static Build', cmd: 'mud-blog build (Rust)', desc: 'Prunes issues older than 60 days and compiles Askama HTML in under 2 seconds.', color: PALETTE.green },
  ];

  const sources = ['GitHub', 'arXiv', 'HF Papers', 'X', 'LinkedIn', 'GeekNews', 'Endigest'];

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
        <div style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, color: PALETTE.teal, letterSpacing: '0.06em' }}>
          DAILY AUTOMATED DIGEST PIPELINE
        </div>
        <h2 style={{ margin: '6px 0 0', fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em' }}>
          From Seven Live Signal Feeds to Bounded Static Briefs
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18 }}>
        {stages.map((st, idx) => {
          const sp = enterSpring(local, 14 + idx * 14, fps);
          const active = pulseIdx === idx;
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                  STEP {st.num}
                </span>
                <div style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: active ? st.color : PALETTE.border }} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 750, color: PALETTE.ink }}>{st.title}</div>
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11.5,
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

      <div
        style={{
          ...GLASS_CARD_STYLE,
          borderRadius: 18,
          padding: '18px 22px',
          marginTop: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.muted }}>
            CURATED SIGNAL SOURCES (7 ACTIVE CHANNELS)
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: PALETTE.teal, fontWeight: 700 }}>
            Rolling 60-Day Window · 54 Live Briefs
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {sources.map((src, idx) => {
            const p = enterSpring(local, 40 + idx * 8, fps);
            return (
              <div
                key={src}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  backgroundColor: '#FFFFFF',
                  border: `1px solid ${PALETTE.border}`,
                  fontFamily: FONT_MONO,
                  fontSize: 13,
                  fontWeight: 650,
                  color: PALETTE.ink,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  opacity: p,
                  transform: `translateY(${(1 - p) * 10}px)`,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: PALETTE.teal }} />
                <span>{src}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const SceneHybridArch: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 480;
  const opacity = fadeWindow(frame, 480, 780, 14);
  const s1 = enterSpring(local, 6, fps);
  const s2 = enterSpring(local, 24, fps);

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
        <div style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, color: PALETTE.teal, letterSpacing: '0.06em' }}>
          STATIC + EDGE HYBRID ARCHITECTURE
        </div>
        <h2 style={{ margin: '6px 0 0', fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em' }}>
          Instant Static Archives Meet On-Demand Edge Compute
        </h2>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '0.95fr 1.05fr', gap: 24 }}>
        <div
          style={{
            ...GLASS_CARD_STYLE,
            borderRadius: 20,
            padding: '24px 26px',
            opacity: s1,
            transform: `translateY(${(1 - s1) * 18}px)`,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: PALETTE.navy }}>Static Pre-Rendered Core</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, padding: '4px 9px', borderRadius: 999, backgroundColor: PALETTE.blueSoft, color: PALETTE.navy, fontWeight: 700 }}>
              RUST + ASKAMA
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: PALETTE.muted }}>
            All daily briefs under <span style={{ fontFamily: FONT_MONO, color: PALETTE.ink }}>/news/</span> compile directly into static HTML served from Cloudflare Pages CDN with zero runtime database dependency.
          </p>
          <div style={{ display: 'grid', gap: 10, marginTop: 'auto' }}>
            {[
              'Sub-20ms CDN response for daily briefs & monthly archive',
              '60-day rolling prune keeps dist/ fast and bounded',
              'Zero API keys or secrets ever shipped to the browser',
            ].map((pt) => (
              <div
                key={pt}
                style={{
                  padding: '11px 14px',
                  borderRadius: 11,
                  backgroundColor: '#FFFFFF',
                  border: `1px solid ${PALETTE.border}`,
                  fontSize: 13.5,
                  color: PALETTE.ink,
                  fontWeight: 550,
                }}
              >
                • {pt}
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
            transform: `translateY(${(1 - s2) * 18}px)`,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: PALETTE.teal }}>Cloudflare Pages Functions</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, padding: '4px 9px', borderRadius: 999, backgroundColor: PALETTE.greenSoft, color: PALETTE.teal, fontWeight: 700 }}>
              EDGE RUNTIME
            </span>
          </div>

          <div
            style={{
              padding: '15px 18px',
              borderRadius: 14,
              backgroundColor: '#FFFFFF',
              border: `1px solid ${PALETTE.border}`,
              borderLeft: `4px solid ${PALETTE.teal}`,
            }}
          >
            <div style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 750, color: PALETTE.teal }}>
              GET /api/news-search
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.5, color: PALETTE.muted, marginTop: 6 }}>
              Multi-source candidate retrieval protected by <strong>10-min Edge Cache</strong> and <strong>2-min per-source cooldown</strong>, plus strict HTTP/HTTPS URL sanitization.
            </div>
          </div>

          <div
            style={{
              padding: '15px 18px',
              borderRadius: 14,
              backgroundColor: '#FFFFFF',
              border: `1px solid ${PALETTE.border}`,
              borderLeft: `4px solid ${PALETTE.navy}`,
            }}
          >
            <div style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 750, color: PALETTE.navy }}>
              POST /api/focused-issue
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.5, color: PALETTE.muted, marginTop: 6 }}>
              Supports both <strong>Exact Keyword</strong> filtering and server-side <strong>Gemma query expansion</strong> to compose source-locked draft briefs without exposing credentials.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SceneSearchExport: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 780;
  const opacity = fadeWindow(frame, 780, 1080, 14);
  const s1 = enterSpring(local, 6, fps);
  const s2 = enterSpring(local, 28, fps);
  const selectedCount = local > 120 ? 3 : local > 75 ? 2 : 1;

  const candidates = [
    { src: 'ARXIV', title: 'Predictive LLM Beamforming for 6G AI-RAN', url: 'arxiv.org/abs/2603.xxxxx', checked: selectedCount >= 1 },
    { src: 'GITHUB', title: 'open-ran-ric / xapp-inference-runtime', url: 'github.com/open-ran-ric/...', checked: selectedCount >= 2 },
    { src: 'HF PAPERS', title: 'Speculative Decoding for Edge Wireless Controllers', url: 'huggingface.co/papers/...', checked: selectedCount >= 3 },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        inset: '26px 40px 22px',
        opacity,
        display: 'grid',
        gridTemplateColumns: '1.15fr 0.85fr',
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
          transform: `translateY(${(1 - s1) * 16}px)`,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 700, color: PALETTE.teal }}>
            INTERACTIVE SEARCH DESK · /news/search/
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, padding: '3px 9px', borderRadius: 999, backgroundColor: PALETTE.blueSoft, color: PALETTE.navy, fontWeight: 700 }}>
            EXACT | GEMMA EXPAND
          </span>
        </div>

        <div
          style={{
            padding: '11px 14px',
            borderRadius: 11,
            backgroundColor: '#FFFFFF',
            border: `1.5px solid ${PALETTE.teal}`,
            fontFamily: FONT_MONO,
            fontSize: 14,
            color: PALETTE.ink,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>query: &quot;AI-RAN beamforming edge inference&quot;</span>
          <span style={{ color: PALETTE.teal, fontWeight: 700 }}>{selectedCount}/3 selected</span>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {candidates.map((c) => (
            <div
              key={c.title}
              style={{
                padding: '13px 15px',
                borderRadius: 12,
                backgroundColor: '#FFFFFF',
                border: `1px solid ${c.checked ? PALETTE.teal : PALETTE.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  backgroundColor: c.checked ? PALETTE.teal : PALETTE.cardSoft,
                  border: `1px solid ${c.checked ? PALETTE.teal : PALETTE.border}`,
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: FONT_MONO,
                  fontSize: 13,
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {c.checked ? '✓' : ''}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: PALETTE.ink }}>{c.title}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted, marginTop: 2 }}>
                  {c.src} · {c.url}
                </div>
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
          opacity: s2,
          transform: `translateY(${(1 - s2) * 16}px)`,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 700, color: PALETTE.navy }}>
          SOURCE-LOCKED DRAFT EXPORTER
        </div>

        <div
          style={{
            flex: 1,
            padding: '16px 18px',
            borderRadius: 14,
            backgroundColor: '#141923',
            color: '#E2E8F0',
            fontFamily: FONT_MONO,
            fontSize: 12.5,
            lineHeight: 1.65,
          }}
        >
          <div style={{ color: '#49D9B9', fontWeight: 700 }}># Focused Research Brief</div>
          <div style={{ color: '#94A3B8', marginTop: 6 }}>## Verified Citations ({selectedCount})</div>
          <div style={{ marginTop: 6 }}>- [1] arxiv.org/abs/2603.xxxxx</div>
          {selectedCount >= 2 && <div>- [2] github.com/open-ran-ric/...</div>}
          {selectedCount >= 3 && <div>- [3] huggingface.co/papers/...</div>}
          <div style={{ color: '#A4BBFF', marginTop: 10 }}>✓ URL sanitizer passed</div>
          <div style={{ color: '#A4BBFF' }}>✓ Zero unverified links</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div
            style={{
              padding: '11px 12px',
              borderRadius: 10,
              backgroundColor: PALETTE.blueSoft,
              border: `1px solid ${PALETTE.border}`,
              fontFamily: FONT_MONO,
              fontSize: 12.5,
              fontWeight: 700,
              color: PALETTE.navy,
              textAlign: 'center',
            }}
          >
            Export Markdown
          </div>
          <div
            style={{
              padding: '11px 12px',
              borderRadius: 10,
              backgroundColor: PALETTE.greenSoft,
              border: `1px solid ${PALETTE.border}`,
              fontFamily: FONT_MONO,
              fontSize: 12.5,
              fontWeight: 700,
              color: PALETTE.teal,
              textAlign: 'center',
            }}
          >
            Print-Isolated PDF
          </div>
        </div>
      </div>
    </div>
  );
};

const SceneGuarantees: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 1080;
  const opacity = fadeWindow(frame, 1080, 1350, 14);
  const head = enterSpring(local, 4, fps);

  const cards = [
    {
      title: 'Pure Reducer / Effect Architecture',
      tag: 'LINT VERIFIED',
      color: PALETTE.navy,
      soft: PALETTE.blueSoft,
      desc: 'UI state transitions are isolated in pure state machines with automated architecture lint preventing DOM or network leaks.',
    },
    {
      title: 'Edge Cache & Cooldown Shield',
      tag: '10M CACHE · 2M COOLDOWN',
      color: PALETTE.teal,
      soft: PALETTE.greenSoft,
      desc: 'Cloudflare Edge Cache and per-source cooldowns prevent upstream rate-limit exhaustion while keeping responses snappy.',
    },
    {
      title: 'Strict Citation & URL Sanitization',
      tag: 'SOURCE-LOCKED',
      color: PALETTE.purple,
      soft: PALETTE.purpleSoft,
      desc: 'Only validated external HTTP/HTTPS URLs from selected candidates enter exported Markdown or print-isolated PDF drafts.',
    },
    {
      title: '60-Day Bounded Build Footprint',
      tag: 'FAST RUST BUILD',
      color: PALETTE.green,
      soft: PALETTE.greenSoft,
      desc: 'Automated retention keeps the daily archive focused and preserves sub-2-second Rust static builds on every push.',
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
        gap: 18,
      }}
    >
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 700, color: PALETTE.teal, letterSpacing: '0.06em' }}>
          SYSTEM GUARANTEES &amp; LIVE ENDPOINTS
        </div>
        <h2 style={{ margin: '6px 0 0', fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em' }}>
          Engineered for Daily Reliability &amp; Clean Exports
        </h2>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {cards.map((c, idx) => {
          const sp = enterSpring(local, 12 + idx * 10, fps);
          return (
            <div
              key={c.title}
              style={{
                ...GLASS_CARD_STYLE,
                borderRadius: 18,
                padding: '20px 22px',
                opacity: sp,
                transform: `translateY(${(1 - sp) * 16}px)`,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
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
                  backgroundColor: c.soft,
                  color: c.color,
                }}
              >
                {c.tag}
              </span>
              <div style={{ fontSize: 19, fontWeight: 800, color: PALETTE.ink }}>{c.title}</div>
              <div style={{ fontSize: 14, lineHeight: 1.52, color: PALETTE.muted }}>{c.desc}</div>
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
        <span>Daily Desk: /news/ · Search Desk: /news/search/</span>
        <span style={{ color: PALETTE.teal }}>API: /api/news-search · /api/focused-issue</span>
      </div>
    </div>
  );
};

export const AiNewsDigestDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <FrameChrome
      badge="HYBRID EDGE · AI NEWS DESK"
      title="AI News Digest & Interactive Source Search Desk"
      chapters={CHAPTERS}
      frame={frame}
      durationInFrames={NEWS_DURATION}
      accentColor={PALETTE.teal}
      footerLabel="mud blog · Python + Rust + Cloudflare Pages Functions"
    >
      {frame < 224 && <SceneOverview frame={frame} fps={fps} />}
      {frame >= 196 && frame < 494 && <SceneDailyPipeline frame={frame} fps={fps} />}
      {frame >= 466 && frame < 794 && <SceneHybridArch frame={frame} fps={fps} />}
      {frame >= 766 && frame < 1094 && <SceneSearchExport frame={frame} fps={fps} />}
      {frame >= 1066 && <SceneGuarantees frame={frame} fps={fps} />}
    </FrameChrome>
  );
};
