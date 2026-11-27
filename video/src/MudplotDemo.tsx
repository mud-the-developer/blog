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

export const MUDPLOT_DURATION = 1800; // 60s @ 30fps

const CHAPTERS: Chapter[] = [
  { label: 'Overview', start: 0, end: 320 },
  { label: 'LCH & CVD Math', start: 320, end: 680 },
  { label: 'Spec Reducer', start: 680, end: 1060 },
  { label: 'Lint & Editor', start: 1060, end: 1440 },
  { label: 'Guarantees', start: 1440, end: 1800 },
];

const SceneOverview: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const opacity = fadeWindow(frame, 0, 320, 14);
  const s1 = enterSpring(frame, 4, fps);
  const s2 = enterSpring(frame, 20, fps);
  const s3 = enterSpring(frame, 36, fps);

  const pillars = [
    { name: 'Fixed Lightness L*', tag: 'GREYSCALE FAIR', color: PALETTE.navy, soft: PALETTE.blueSoft },
    { name: 'Protan / Deutan Audit', tag: 'CIEDE2000', color: PALETTE.teal, soft: PALETTE.greenSoft },
    { name: 'Hatch Pattern Fallback', tag: 'NON-COLOR', color: PALETTE.orange, soft: PALETTE.amberSoft },
    { name: 'Rust Axum + Askama UI', tag: 'LOCAL EDITOR', color: PALETTE.purple, soft: PALETTE.purpleSoft },
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
            color: PALETTE.navy,
            marginBottom: 18,
          }}
        >
          <span>OPEN SOURCE</span>
          <span style={{ color: PALETTE.border }}>·</span>
          <span>PYTHON + MATPLOTLIB + RUST EDITOR</span>
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
          mudplot
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
          Perceptually uniform, colourblind-aware scientific plotting on Matplotlib with a declarative FigureSpec core and local Rust/Askama editor.
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
            { value: 'L*C*h', label: 'CIELAB Engine', sub: 'Equal-lightness palettes' },
            { value: 'ΔE00', label: 'CVD Separation', sub: 'Machado 2009 checks' },
            { value: 'JSON', label: 'FigureSpec', sub: 'Pure reducer snapshots' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{ ...GLASS_CARD_STYLE, borderRadius: 16, padding: '16px 18px' }}
            >
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 30,
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
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.navy, letterSpacing: '0.06em' }}>
            PUBLICATION-FIRST DESIGN
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted }}>
            mudplot
          </span>
        </div>

        {pillars.map((item, idx) => {
          const itemIn = enterSpring(frame, 42 + idx * 12, fps);
          return (
            <div
              key={item.name}
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
                <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: item.color }}>
                  0{idx + 1}
                </span>
                <span style={{ fontSize: 15.5, fontWeight: 700, color: PALETTE.ink }}>{item.name}</span>
              </div>
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '4px 9px',
                  borderRadius: 999,
                  backgroundColor: item.soft,
                  color: item.color,
                }}
              >
                {item.tag}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SceneLchMath: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 320;
  const opacity = fadeWindow(frame, 320, 680, 14);
  const head = enterSpring(local, 4, fps);
  const activeView = Math.floor((local / 85) % 4);

  const views = [
    { name: 'Normal Vision', badge: 'ΔE00 min = 24.6', swatches: ['#24408A', '#0F766E', '#C2410C', '#6D28D9'] },
    { name: 'Protanopia (Machado)', badge: 'ΔE00 min = 18.2', swatches: ['#2F4C86', '#4D6B68', '#8F7726', '#46589B'] },
    { name: 'Deuteranopia (Machado)', badge: 'ΔE00 min = 17.9', swatches: ['#2A4E8E', '#526C6B', '#9D6E1F', '#4E5797'] },
    { name: 'Greyscale Print + Hatch', badge: 'L* balanced + ////', swatches: ['#4A4A4A', '#626262', '#7A7A7A', '#929292'] },
  ];

  const gauge = interpolate(local, [20, 110], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', opacity, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.teal, letterSpacing: '0.07em' }}>
          02 · CIELAB LCH PERCEPTUAL ENGINE
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Worst-Case Separation Under Colour-Vision Deficiency
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.08fr 0.92fr', gap: 20, flex: 1 }}>
        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.navy }}>
              SIMULATED VISION MATRIX · Palette.report()
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.green, fontWeight: 700 }}>
              PASS · ALL MODES
            </span>
          </div>

          {views.map((view, idx) => {
            const focused = idx === activeView;
            return (
              <div
                key={view.name}
                style={{
                  padding: '12px 14px',
                  borderRadius: 13,
                  backgroundColor: focused ? PALETTE.blueSoft : '#FFFFFF',
                  border: `1.5px solid ${focused ? PALETTE.blue : PALETTE.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: PALETTE.ink }}>{view.name}</div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted, marginTop: 2 }}>{view.badge}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {view.swatches.map((hex, sIdx) => (
                    <div
                      key={sIdx}
                      style={{
                        width: 44,
                        height: 28,
                        borderRadius: 8,
                        backgroundColor: hex,
                        border: '1px solid rgba(15,23,42,0.16)',
                        backgroundImage:
                          idx === 3
                            ? `repeating-linear-gradient(${45 + sIdx * 30}deg, rgba(255,255,255,0.38) 0 2px, transparent 2px 6px)`
                            : undefined,
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.teal }}>
              MINIMAX OBJECTIVE
            </div>
            <div
              style={{
                marginTop: 12,
                padding: '14px 16px',
                borderRadius: 12,
                backgroundColor: '#FFFFFF',
                border: `1px solid ${PALETTE.border}`,
                fontFamily: FONT_MONO,
                fontSize: 14,
                fontWeight: 600,
                color: PALETTE.ink,
                lineHeight: 1.55,
              }}
            >
              ΔE_min(P) = min_(i≠j) min_v ΔE00(c_i^(v), c_j^(v))
              <div style={{ fontSize: 11.5, color: PALETTE.muted, marginTop: 6 }}>
                v ∈ {'{ normal, protanopia, deuteranopia }'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Lightness Uniformity (L*)', pct: 0.94, color: PALETTE.navy },
              { label: 'CVD Contrast Margin (ΔE00)', pct: 0.88, color: PALETTE.teal },
              { label: 'Hatch Redundancy Coverage', pct: 1.0, color: PALETTE.green },
            ].map((bar) => (
              <div key={bar.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: PALETTE.ink }}>
                  <span>{bar.label}</span>
                  <span style={{ fontFamily: FONT_MONO, color: bar.color }}>{Math.round(bar.pct * gauge * 100)}%</span>
                </div>
                <div style={{ height: 10, borderRadius: 999, backgroundColor: PALETTE.cardSoft, marginTop: 5, overflow: 'hidden' }}>
                  <div style={{ width: `${bar.pct * gauge * 100}%`, height: '100%', borderRadius: 999, backgroundColor: bar.color }} />
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: PALETTE.muted }}>
            Zero arbitrary RGB defaults · Explicit Palette.report() audit
          </div>
        </div>
      </div>
    </div>
  );
};

const SceneSpecReducer: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 680;
  const opacity = fadeWindow(frame, 680, 1060, 14);
  const head = enterSpring(local, 4, fps);
  const stepIdx = Math.floor((local / 75) % 4);

  const stages = [
    { num: '01', title: 'Fluent Python API', sub: 'mp.figure().palette().line()', color: PALETTE.navy },
    { num: '02', title: 'Pure State Reducer', sub: 'reduce(state, action) -> state\'', color: PALETTE.teal },
    { num: '03', title: 'Declarative Snapshot', sub: 'ablation.mplot.json', color: PALETTE.purple },
    { num: '04', title: 'Canonical Vector Render', sub: 'Matplotlib PNG · PDF · SVG', color: PALETTE.green },
  ];

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', opacity, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.purple, letterSpacing: '0.07em' }}>
          03 · SPEC-CENTRIC ARCHITECTURE
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Functional Core / Imperative Shell for Reproducible Figures
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
        {stages.map((st, idx) => {
          const active = idx === stepIdx;
          const cardIn = enterSpring(local, 10 + idx * 10, fps);
          return (
            <div
              key={st.num}
              style={{
                ...GLASS_CARD_STYLE,
                borderRadius: 16,
                padding: '16px 18px',
                opacity: cardIn,
                transform: `translateY(${(1 - cardIn) * 14}px)`,
                outline: active ? `2px solid ${st.color}` : '2px solid transparent',
              }}
            >
              <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: st.color }}>
                STAGE {st.num}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: PALETTE.ink, marginTop: 6 }}>{st.title}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: PALETTE.muted, marginTop: 6 }}>{st.sub}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 18, flex: 1 }}>
        <div
          style={{
            borderRadius: 16,
            backgroundColor: '#141923',
            color: '#E6EDF7',
            padding: '20px 22px',
            fontFamily: FONT_MONO,
            fontSize: 14,
            lineHeight: 1.65,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 8 }}># Declarative publication figure</div>
          <div><span style={{ color: '#93C5FD' }}>import</span> mudplot <span style={{ color: '#93C5FD' }}>as</span> mp</div>
          <div style={{ marginTop: 6 }}>fig = (</div>
          <div>&nbsp;&nbsp;mp.figure(size=(3.5, 2.4), dpi=300)</div>
          <div>&nbsp;&nbsp;&nbsp;&nbsp;.palette(<span style={{ color: '#86EFAC' }}>"ieee-okabe"</span>, colorblind_check=<span style={{ color: '#FDE68A' }}>True</span>)</div>
          <div>&nbsp;&nbsp;&nbsp;&nbsp;.line(x=epochs, y=baseline, label=<span style={{ color: '#86EFAC' }}>"Baseline"</span>)</div>
          <div>&nbsp;&nbsp;&nbsp;&nbsp;.line(x=epochs, y=proposed, label=<span style={{ color: '#86EFAC' }}>"Proposed"</span>)</div>
          <div>&nbsp;&nbsp;&nbsp;&nbsp;.save(<span style={{ color: '#86EFAC' }}>"ablation.pdf"</span>, layout_policy=<span style={{ color: '#86EFAC' }}>"smart"</span>)</div>
          <div>)</div>
        </div>

        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 16, padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.navy }}>
            WHY SERIALIZABLE STATE MATTERS
          </div>
          {[
            'Deterministic undo / redo across CLI & UI',
            'Version-controllable .mplot.json diffs in Git',
            'Zero hidden Matplotlib rcParams drift',
            'Re-render single-column or double-column cleanly',
          ].map((bullet) => (
            <div key={bullet} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: PALETTE.ink, fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: PALETTE.teal, flexShrink: 0 }} />
              <span>{bullet}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SceneLintAndEditor: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 1060;
  const opacity = fadeWindow(frame, 1060, 1440, 14);
  const head = enterSpring(local, 4, fps);
  const fixed = local > 140;
  const shift = interpolate(local, [120, 165], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', opacity, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.orange, letterSpacing: '0.07em' }}>
          04 · VISUAL LINTING &amp; RUST EDITOR BRIDGE
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Catch Label Collisions Early · Edit Visually Without Losing Code Parity
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, flex: 1 }}>
        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.navy }}>
              fig.lint(visual=True)
            </span>
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11.5,
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: 999,
                backgroundColor: fixed ? PALETTE.greenSoft : PALETTE.redSoft,
                color: fixed ? PALETTE.green : PALETTE.red,
              }}
            >
              {fixed ? '0 COLLISIONS · SMART LAYOUT' : 'WARN · LEGEND OVERLAPS CURVE'}
            </span>
          </div>

          <svg viewBox="0 0 460 220" style={{ width: '100%', height: 220, borderRadius: 12, backgroundColor: '#FFFFFF', border: `1px solid ${PALETTE.border}` }}>
            <line x1="48" y1="185" x2="430" y2="185" stroke={PALETTE.border} strokeWidth="2" />
            <line x1="48" y1="24" x2="48" y2="185" stroke={PALETTE.border} strokeWidth="2" />
            <path d="M 54 168 C 140 148, 220 112, 420 52" fill="none" stroke={PALETTE.navy} strokeWidth="3.2" />
            <path d="M 54 176 C 150 162, 230 144, 420 118" fill="none" stroke={PALETTE.teal} strokeWidth="3.2" strokeDasharray="7 5" />
            <g transform={`translate(${interpolate(shift, [0, 1], [270, 68])}, ${interpolate(shift, [0, 1], [58, 32])})`}>
              <rect
                x="0"
                y="0"
                width="136"
                height="48"
                rx="8"
                fill="#FFFFFF"
                stroke={fixed ? PALETTE.green : PALETTE.red}
                strokeWidth="2"
              />
              <line x1="12" y1="16" x2="32" y2="16" stroke={PALETTE.navy} strokeWidth="3" />
              <text x="40" y="20" fontSize="12" fontWeight="700" fill={PALETTE.ink}>Proposed</text>
              <line x1="12" y1="34" x2="32" y2="34" stroke={PALETTE.teal} strokeWidth="3" strokeDasharray="5 3" />
              <text x="40" y="38" fontSize="12" fontWeight="600" fill={PALETTE.muted}>Baseline</text>
            </g>
          </svg>

          <div style={{ fontSize: 14, color: PALETTE.muted }}>
            Checks bounding-box overlaps, axis tick legibility, and font scale at actual IEEE / ACM print dimensions.
          </div>
        </div>

        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.purple }}>
              MUDPLOT-EDITOR · RUST AXUM + ASKAMA
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 15.5, lineHeight: 1.5, color: PALETTE.muted }}>
              Interactive browser inspector backed by Rust that dispatches the exact same declarative actions while delegating canonical rendering to Matplotlib.
            </p>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {[
              { k: 'Shared Action Schema', v: 'CLI + Rust UI mutate one JSON spec' },
              { k: 'Instant Preview Loop', v: 'Palette, size, and legend controls' },
              { k: 'Zero Divergent Renderer', v: 'Final PDF/SVG always from Matplotlib' },
            ].map((row) => (
              <div key={row.k} style={{ padding: '11px 14px', borderRadius: 12, backgroundColor: '#FFFFFF', border: `1px solid ${PALETTE.border}` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: PALETTE.ink }}>{row.k}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: PALETTE.muted, marginTop: 2 }}>{row.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const SceneGuarantees: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 1440;
  const opacity = fadeWindow(frame, 1440, 1800, 14);
  const head = enterSpring(local, 4, fps);

  const cards = [
    { badge: 'COLOUR ENGINE', title: 'Perceptually Uniform LCH', desc: 'Fixed-lightness palettes verified with CIEDE2000 under protanopia, deuteranopia, and greyscale print.', color: PALETTE.navy },
    { badge: 'ARCHITECTURE', title: 'Pure Reducer & .mplot.json', desc: 'Every chart edit is an explicit action on serializable JSON state—diffable, replayable, and testable.', color: PALETTE.teal },
    { badge: 'QUALITY GATE', title: 'Opt-In Visual Linting', desc: 'Detects legend/data collisions and cramped labels at exact journal column widths before submission.', color: PALETTE.orange },
    { badge: 'TOOLING', title: 'Rust Local Editor Bridge', desc: 'Lightweight Axum + Askama UI paired with canonical Matplotlib PDF/SVG/PNG output.', color: PALETTE.purple },
  ];

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', opacity, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.navy, letterSpacing: '0.07em' }}>
          05 · PUBLICATION SUMMARY
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Accessible Research Figures by Construction
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
        {cards.map((c, idx) => {
          const itemIn = enterSpring(local, 14 + idx * 10, fps);
          return (
            <div
              key={c.title}
              style={{
                ...GLASS_CARD_STYLE,
                borderRadius: 18,
                padding: '20px 22px',
                opacity: itemIn,
                transform: `translateY(${(1 - itemIn) * 14}px)`,
              }}
            >
              <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 800, color: c.color }}>{c.badge}</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: PALETTE.ink, marginTop: 6 }}>{c.title}</div>
              <div style={{ fontSize: 14.5, lineHeight: 1.5, color: PALETTE.muted, marginTop: 6 }}>{c.desc}</div>
            </div>
          );
        })}
      </div>

      <div style={{ ...GLASS_CARD_STYLE, borderRadius: 14, padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: FONT_MONO, fontSize: 13 }}>
        <span style={{ color: PALETTE.navy, fontWeight: 700 }}>github.com/mud-the-developer/mudplot</span>
        <span style={{ color: PALETTE.muted }}>mud-the-developer.github.io/mudplot/</span>
      </div>
    </div>
  );
};

export const MudplotDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <FrameChrome
      badge="MUDPLOT"
      title="Perceptually Uniform, Colourblind-Safe Scientific Plotting"
      chapters={CHAPTERS}
      frame={frame}
      durationInFrames={MUDPLOT_DURATION}
      accentColor={PALETTE.navy}
      footerLabel="mudplot · Python + Matplotlib + Rust Axum/Askama"
    >
      {frame < 320 && <SceneOverview frame={frame} fps={fps} />}
      {frame >= 306 && frame < 680 && <SceneLchMath frame={frame} fps={fps} />}
      {frame >= 666 && frame < 1060 && <SceneSpecReducer frame={frame} fps={fps} />}
      {frame >= 1046 && frame < 1440 && <SceneLintAndEditor frame={frame} fps={fps} />}
      {frame >= 1426 && <SceneGuarantees frame={frame} fps={fps} />}
    </FrameChrome>
  );
};
