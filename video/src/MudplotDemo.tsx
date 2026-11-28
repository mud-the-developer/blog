import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  Chapter,
  countUp,
  enterSpring,
  FONT_MONO,
  FrameChrome,
  GLASS_CARD_STYLE,
  PALETTE,
  sceneStyle,
  TerminalWindow,
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
  const motion = sceneStyle(frame, 0, 320);
  const s1 = enterSpring(frame, 4, fps);
  const s2 = enterSpring(frame, 18, fps);
  const s3 = enterSpring(frame, 34, fps);

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
        inset: '24px 40px 20px',
        ...motion,
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
            fontSize: 12.5,
            fontWeight: 600,
            color: PALETTE.navy,
            marginBottom: 16,
          }}
        >
          <span>OPEN SOURCE</span>
          <span style={{ color: PALETTE.border }}>·</span>
          <span>PYTHON + MATPLOTLIB + RUST EDITOR</span>
        </div>

        <h1 style={{ margin: 0, fontSize: 50, lineHeight: 1.06, fontWeight: 800, letterSpacing: '-0.038em', color: PALETTE.ink }}>
          mudplot
        </h1>
        <p style={{ margin: '14px 0 0', fontSize: 20, lineHeight: 1.46, fontWeight: 500, color: PALETTE.muted }}>
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
            { value: `ΔE ${countUp(frame, 20, 40, 24.6, 1)}`, label: 'Min Separation', sub: 'CIEDE2000 verified' },
            { value: '300 DPI', label: 'Vector & Raster', sub: 'PDF · SVG · PNG' },
          ].map((stat) => (
            <div key={stat.label} style={{ ...GLASS_CARD_STYLE, borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 26, fontWeight: 800, color: PALETTE.navy, letterSpacing: '-0.03em' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: PALETTE.ink, marginTop: 4 }}>{stat.label}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted, marginTop: 3 }}>{stat.sub}</div>
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
          const itemIn = enterSpring(frame, 40 + idx * 11, fps);
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
                <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: item.color }}>0{idx + 1}</span>
                <span style={{ fontSize: 15.5, fontWeight: 700, color: PALETTE.ink }}>{item.name}</span>
              </div>
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 999, backgroundColor: item.soft, color: item.color }}>
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
  const local = Math.max(0, frame - 320);
  const motion = sceneStyle(frame, 320, 680);
  const head = enterSpring(local, 4, fps);
  const activeView = Math.floor((local / 82) % 4);
  const sweepDeg = (local * 1.4) % 360;

  const views = [
    { name: 'Normal Vision', badge: 'ΔE00 min = 24.6', swatches: ['#24408A', '#0F766E', '#C2410C', '#6D28D9'] },
    { name: 'Protanopia (Machado)', badge: 'ΔE00 min = 18.2', swatches: ['#2F4C86', '#4D6B68', '#8F7726', '#46589B'] },
    { name: 'Deuteranopia (Machado)', badge: 'ΔE00 min = 17.9', swatches: ['#2A4E8E', '#526C6B', '#9D6E1F', '#4E5797'] },
    { name: 'Greyscale Print + Hatch', badge: 'L* balanced + ////', swatches: ['#4A4A4A', '#626262', '#7A7A7A', '#929292'] },
  ];

  const gauge = interpolate(local, [18, 95], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', ...motion, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.teal, letterSpacing: '0.07em' }}>
          02 · CIELAB LCH PERCEPTUAL ENGINE
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 31, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Worst-Case Separation Under Colour-Vision Deficiency
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.08fr 0.92fr', gap: 20, flex: 1 }}>
        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '18px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.navy }}>
              SIMULATED VISION MATRIX · Palette.report()
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: PALETTE.green, fontWeight: 700, padding: '3px 9px', borderRadius: 999, backgroundColor: PALETTE.greenSoft }}>
              PASS · ALL 4 MODES
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                              ? `repeating-linear-gradient(${45 + sIdx * 30}deg, rgba(255,255,255,0.4) 0 2px, transparent 2px 6px)`
                              : undefined,
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '18px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 122px', gap: 14, alignItems: 'center' }}>
            <div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.teal }}>
                MINIMAX OBJECTIVE
              </div>
              <div
                style={{
                  marginTop: 8,
                  padding: '12px 14px',
                  borderRadius: 12,
                  backgroundColor: '#FFFFFF',
                  border: `1px solid ${PALETTE.border}`,
                  fontFamily: FONT_MONO,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: PALETTE.ink,
                  lineHeight: 1.55,
                }}
              >
                ΔE_min(P) = min_(i≠j) min_v ΔE00(c_i^(v), c_j^(v))
                <div style={{ fontSize: 11, color: PALETTE.muted, marginTop: 4 }}>
                  v ∈ {'{ normal, protan, deutan }'}
                </div>
              </div>
            </div>

            {/* Animated CIELAB LCH Hue Wheel */}
            <svg viewBox="0 0 120 120" style={{ width: 120, height: 120 }}>
              <circle cx={60} cy={60} r={46} fill="none" stroke={PALETTE.border} strokeWidth={1.5} strokeDasharray="3 3" />
              <circle cx={60} cy={60} r={32} fill="none" stroke={PALETTE.border} strokeWidth={1} />
              {[
                { a: 235, c: '#24408A' },
                { a: 165, c: '#0F766E' },
                { a: 28, c: '#C2410C' },
                { a: 295, c: '#6D28D9' },
              ].map((pt, i) => {
                const rad = ((pt.a + sweepDeg * 0.25) * Math.PI) / 180;
                const x = 60 + Math.cos(rad) * 44;
                const y = 60 + Math.sin(rad) * 44;
                return (
                  <g key={i}>
                    <line x1={60} y1={60} x2={x} y2={y} stroke={pt.c} strokeWidth={1.5} opacity={0.45} />
                    <circle cx={x} cy={y} r={8} fill={pt.c} stroke="#FFFFFF" strokeWidth={2} />
                  </g>
                );
              })}
              <text x={60} y={63} textAnchor="middle" fontFamily={FONT_MONO} fontSize={10} fontWeight={800} fill={PALETTE.ink}>
                L* = 52
              </text>
            </svg>
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

          <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted }}>
            Zero arbitrary RGB defaults · Explicit Palette.report() audit
          </div>
        </div>
      </div>
    </div>
  );
};

const SceneSpecReducer: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = Math.max(0, frame - 680);
  const motion = sceneStyle(frame, 680, 1060);
  const head = enterSpring(local, 4, fps);
  const stepIdx = Math.floor((local / 75) % 4);

  const stages = [
    { num: '01', title: 'Fluent Python API', sub: 'mp.figure().palette().line()', color: PALETTE.navy },
    { num: '02', title: 'Pure State Reducer', sub: "reduce(state, action) -> state'", color: PALETTE.teal },
    { num: '03', title: 'Declarative Snapshot', sub: 'ablation.mplot.json', color: PALETTE.purple },
    { num: '04', title: 'Canonical Vector Render', sub: 'Matplotlib PNG · PDF · SVG', color: PALETTE.green },
  ];

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', ...motion, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.purple, letterSpacing: '0.07em' }}>
          03 · SPEC-CENTRIC ARCHITECTURE
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 31, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Functional Core / Imperative Shell for Reproducible Figures
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
        {stages.map((st, idx) => {
          const active = idx === stepIdx;
          const cardIn = enterSpring(local, 8 + idx * 9, fps);
          return (
            <div
              key={st.num}
              style={{
                ...GLASS_CARD_STYLE,
                borderRadius: 16,
                padding: '15px 17px',
                opacity: cardIn,
                transform: `translateY(${(1 - cardIn) * 14}px)`,
                outline: active ? `2px solid ${st.color}` : '2px solid transparent',
              }}
            >
              <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 800, color: st.color }}>STAGE {st.num}</div>
              <div style={{ fontSize: 16.5, fontWeight: 700, color: PALETTE.ink, marginTop: 5 }}>{st.title}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted, marginTop: 5 }}>{st.sub}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.18fr 0.82fr', gap: 18, flex: 1 }}>
        <TerminalWindow
          title="ablation.py — mudplot CLI"
          badge="FigureSpec"
          command="python scripts/ablation.py --save ablation.pdf"
          localFrame={local}
          accentColor="#93C5FD"
          lines={[
            { text: 'mp.figure(size=(3.5, 2.4), dpi=300).palette("ieee-okabe", colorblind_check=True)', color: '#93C5FD' },
            { text: '  .line(x=epochs, y=baseline, label="Baseline").line(x=epochs, y=proposed, label="Proposed")', color: '#E2E8F0' },
            { text: '→ reducer emitted FigureSpec snapshot: ablation.mplot.json (4 actions)', color: '#C4B5FD', highlight: true },
            { text: '✓ Palette.report(): protan ΔE00=18.2 · deutan ΔE00=17.9 · greyscale OK', color: '#86EFAC' },
            { text: '✓ Saved canonical Matplotlib PDF (3.5 × 2.4 in, 300 DPI)', color: '#86EFAC' },
          ]}
          footer="Functional Core · Zero rcParams Drift"
        />

        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.navy }}>
            WHY SERIALIZABLE STATE MATTERS
          </div>
          {[
            { t: 'Deterministic Undo / Redo', d: 'Replay exact action logs across CLI & Rust UI' },
            { t: 'Git-Diffable .mplot.json', d: 'Review styling changes as clean JSON diffs' },
            { t: 'Column-Width Re-Render', d: 'Reflow single-column to double-column cleanly' },
            { t: 'Zero Hidden rcParams', d: 'Every font, tick, and hatch is explicit state' },
          ].map((b) => (
            <div key={b.t} style={{ padding: '10px 12px', borderRadius: 11, backgroundColor: '#FFFFFF', border: `1px solid ${PALETTE.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: PALETTE.ink }}>{b.t}</div>
              <div style={{ fontSize: 12.5, color: PALETTE.muted, marginTop: 2 }}>{b.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SceneLintAndEditor: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = Math.max(0, frame - 1060);
  const motion = sceneStyle(frame, 1060, 1440);
  const head = enterSpring(local, 4, fps);
  const fixed = local > 145;
  const shift = interpolate(local, [125, 170], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scanX = interpolate(local % 120, [0, 119], [52, 428]);

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', ...motion, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.orange, letterSpacing: '0.07em' }}>
          04 · VISUAL LINTING &amp; RUST EDITOR BRIDGE
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 31, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Catch Label Collisions Early · Edit Visually Without Code Drift
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.08fr 0.92fr', gap: 20, flex: 1 }}>
        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.navy }}>
              fig.lint(visual=True) · 3.5 × 2.4 in
            </span>
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
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

          <svg viewBox="0 0 460 275" style={{ width: '100%', height: 275, borderRadius: 12, backgroundColor: '#FFFFFF', border: `1px solid ${PALETTE.border}` }}>
            {/* Gridlines */}
            {[60, 110, 160, 210].map((y) => (
              <line key={y} x1="54" y1={y} x2="432" y2={y} stroke="#EEF2F7" strokeWidth="1" />
            ))}
            <line x1="54" y1="235" x2="432" y2="235" stroke={PALETTE.border} strokeWidth="2" />
            <line x1="54" y1="24" x2="54" y2="235" stroke={PALETTE.border} strokeWidth="2" />

            {/* Confidence band */}
            <path d="M 58 214 C 150 185, 240 132, 424 52 L 424 78 C 240 156, 150 205, 58 224 Z" fill={PALETTE.navy} opacity={0.11} />
            <path d="M 58 219 C 150 195, 240 144, 424 65" fill="none" stroke={PALETTE.navy} strokeWidth="3.2" />
            <path d="M 58 226 C 150 212, 240 190, 424 150" fill="none" stroke={PALETTE.teal} strokeWidth="3" strokeDasharray="7 5" />

            {/* Subtle bounding-box scan line before fix */}
            {!fixed && (
              <line x1={scanX} y1="24" x2={scanX} y2="235" stroke={PALETTE.orange} strokeWidth="1.5" opacity={0.45} strokeDasharray="4 4" />
            )}

            {/* Axes ticks */}
            {['0', '20', '40', '60', '80', '100'].map((lbl, idx) => (
              <text key={lbl} x={58 + idx * 72} y={253} textAnchor="middle" fontFamily={FONT_MONO} fontSize={10.5} fill={PALETTE.muted}>
                {lbl}
              </text>
            ))}
            <text x={243} y={268} textAnchor="middle" fontFamily={FONT_MONO} fontSize={10.5} fontWeight={700} fill={PALETTE.ink}>
              Training Epochs
            </text>

            <g transform={`translate(${interpolate(shift, [0, 1], [272, 70])}, ${interpolate(shift, [0, 1], [68, 34])})`}>
              <rect x="0" y="0" width="142" height="52" rx="9" fill="#FFFFFF" stroke={fixed ? PALETTE.green : PALETTE.red} strokeWidth="2" />
              <line x1="12" y1="18" x2="34" y2="18" stroke={PALETTE.navy} strokeWidth="3" />
              <text x="42" y="22" fontSize="12" fontWeight="700" fill={PALETTE.ink}>Proposed</text>
              <line x1="12" y1="36" x2="34" y2="36" stroke={PALETTE.teal} strokeWidth="3" strokeDasharray="5 3" />
              <text x="42" y="40" fontSize="12" fontWeight="600" fill={PALETTE.muted}>Baseline</text>
            </g>
          </svg>

          <div style={{ fontSize: 13.5, color: PALETTE.muted }}>
            Audits legend/curve overlaps, tick crowding, and legibility at exact IEEE / ACM column widths.
          </div>
        </div>

        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.purple }}>
              MUDPLOT-EDITOR · AXUM + ASKAMA
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: PALETTE.muted }}>127.0.0.1:8080</span>
          </div>

          {/* Interactive inspector control panel mockup */}
          <div style={{ padding: '14px 16px', borderRadius: 14, backgroundColor: '#FFFFFF', border: `1px solid ${PALETTE.border}`, display: 'grid', gap: 10 }}>
            {[
              { k: 'Palette', v: 'ieee-okabe (CVD ✓)', accent: PALETTE.navy },
              { k: 'Dimensions', v: '3.50 × 2.40 in · 300 DPI', accent: PALETTE.teal },
              { k: 'Layout Policy', v: fixed ? 'smart (top-left clear)' : 'auto (collision flagged)', accent: fixed ? PALETTE.green : PALETTE.orange },
            ].map((ctl) => (
              <div key={ctl.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: FONT_MONO, fontSize: 12 }}>
                <span style={{ color: PALETTE.muted }}>{ctl.k}</span>
                <span style={{ fontWeight: 700, color: ctl.accent }}>{ctl.v}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 9 }}>
            {[
              { k: 'Shared Action Schema', v: 'CLI + Rust UI mutate the exact same JSON spec' },
              { k: 'Canonical Matplotlib Output', v: 'Zero divergent browser-only chart renderer' },
              { k: 'Instant Undo & Export', v: 'Exports PDF, SVG, and .mplot.json together' },
            ].map((row) => (
              <div key={row.k} style={{ padding: '10px 13px', borderRadius: 11, backgroundColor: '#FFFFFF', border: `1px solid ${PALETTE.border}` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: PALETTE.ink }}>{row.k}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted, marginTop: 2 }}>{row.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const SceneGuarantees: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = Math.max(0, frame - 1440);
  const motion = sceneStyle(frame, 1440, 1800, true);
  const head = enterSpring(local, 4, fps);

  const cards = [
    { badge: 'COLOUR ENGINE', title: 'Perceptually Uniform LCH', desc: 'Fixed-lightness palettes verified with CIEDE2000 under protanopia, deuteranopia, and greyscale print.', color: PALETTE.navy },
    { badge: 'ARCHITECTURE', title: 'Pure Reducer & .mplot.json', desc: 'Every chart edit is an explicit action on serializable JSON state—diffable, replayable, and testable.', color: PALETTE.teal },
    { badge: 'QUALITY GATE', title: 'Opt-In Visual Linting', desc: 'Detects legend/data collisions and cramped labels at exact journal column widths before submission.', color: PALETTE.orange },
    { badge: 'TOOLING', title: 'Rust Local Editor Bridge', desc: 'Lightweight Axum + Askama UI paired with canonical Matplotlib PDF/SVG/PNG output.', color: PALETTE.purple },
  ];

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', ...motion, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
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
          const itemIn = enterSpring(local, 12 + idx * 10, fps);
          return (
            <div key={c.title} style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 22px', opacity: itemIn, transform: `translateY(${(1 - itemIn) * 14}px)` }}>
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
      {frame < 334 && <SceneOverview frame={frame} fps={fps} />}
      {frame >= 306 && frame < 694 && <SceneLchMath frame={frame} fps={fps} />}
      {frame >= 666 && frame < 1074 && <SceneSpecReducer frame={frame} fps={fps} />}
      {frame >= 1046 && frame < 1454 && <SceneLintAndEditor frame={frame} fps={fps} />}
      {frame >= 1426 && <SceneGuarantees frame={frame} fps={fps} />}
    </FrameChrome>
  );
};
