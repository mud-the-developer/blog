import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import {
  Chapter,
  enterSpring,
  FONT_MONO,
  FrameChrome,
  GLASS_CARD_STYLE,
  PALETTE,
  sceneStyle,
  TerminalWindow,
} from './theme';

export const HWP_EDITOR_DURATION = 1800; // 60s @ 30fps

const CHAPTERS: Chapter[] = [
  { label: 'Overview', start: 0, end: 320 },
  { label: 'Split Workspace', start: 320, end: 680 },
  { label: 'Checkpoints', start: 680, end: 1060 },
  { label: 'Isolated Runtime', start: 1060, end: 1440 },
  { label: 'Scope & Safety', start: 1440, end: 1800 },
];

const SceneOverview: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const motion = sceneStyle(frame, 0, 320);
  const s1 = enterSpring(frame, 4, fps);
  const s2 = enterSpring(frame, 18, fps);
  const s3 = enterSpring(frame, 34, fps);

  const pillars = [
    { name: 'Live HWPX Preview', tag: '@rhwp/core 0.8.7', color: PALETTE.blue, soft: PALETTE.blueSoft },
    { name: 'Embedded OMP Terminal', tag: 'OPT-IN AI', color: PALETTE.teal, soft: PALETTE.greenSoft },
    { name: 'Original Preservation', tag: '.hwpreview/', color: PALETTE.orange, soft: PALETTE.amberSoft },
    { name: 'Isolated Windows Kit', tag: 'AGPL-3.0', color: PALETTE.purple, soft: PALETTE.purpleSoft },
  ];

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', ...motion, display: 'grid', gridTemplateColumns: '1.16fr 0.84fr', gap: 28, alignItems: 'center' }}>
      <div style={{ transform: `translateY(${(1 - s1) * 18}px)` }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999, ...GLASS_CARD_STYLE, fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 600, color: PALETTE.blue, marginBottom: 16 }}>
          <span>WINDOWS LOCAL DESKTOP</span>
          <span style={{ color: PALETTE.border }}>·</span>
          <span>HWPX PREVIEW + OH-MY-PI</span>
        </div>

        <h1 style={{ margin: 0, fontSize: 50, lineHeight: 1.06, fontWeight: 800, letterSpacing: '-0.038em', color: PALETTE.ink }}>
          HWP Editor
        </h1>
        <p style={{ margin: '14px 0 0', fontSize: 19.5, lineHeight: 1.46, fontWeight: 500, color: PALETTE.muted }}>
          Local-first HWPX document authoring and review workspace pairing live local rendering with an embedded OMP terminal and automatic checkpoints.
        </p>

        <div style={{ marginTop: 26, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, opacity: s2, transform: `translateY(${(1 - s2) * 14}px)` }}>
          {[
            { value: 'rc.4', label: 'Public Source', sub: '1.0.0-rc.4 pre-release' },
            { value: '2-Pane', label: 'Split Desktop', sub: 'Preview + OMP shell' },
            { value: '0', label: 'Auto-Send', sub: 'Human-gated AI only' },
          ].map((stat) => (
            <div key={stat.label} style={{ ...GLASS_CARD_STYLE, borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 28, fontWeight: 800, color: PALETTE.blue, letterSpacing: '-0.03em' }}>{stat.value}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: PALETTE.ink, marginTop: 4 }}>{stat.label}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted, marginTop: 3 }}>{stat.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...GLASS_CARD_STYLE, borderRadius: 20, padding: '22px 24px', opacity: s3, transform: `translateY(${(1 - s3) * 18}px)`, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.blue, letterSpacing: '0.06em' }}>WORKSPACE ARCHITECTURE</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted }}>WPF · WebView2</span>
        </div>

        {pillars.map((item, idx) => {
          const itemIn = enterSpring(frame, 40 + idx * 11, fps);
          return (
            <div key={item.name} style={{ padding: '13px 16px', borderRadius: 13, backgroundColor: PALETTE.card, border: `1px solid ${PALETTE.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: itemIn, transform: `translateX(${(1 - itemIn) * 14}px)` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: item.color }}>0{idx + 1}</span>
                <span style={{ fontSize: 15.5, fontWeight: 700, color: PALETTE.ink }}>{item.name}</span>
              </div>
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 999, backgroundColor: item.soft, color: item.color }}>{item.tag}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SceneSplitWorkspace: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = Math.max(0, frame - 320);
  const motion = sceneStyle(frame, 320, 680);
  const head = enterSpring(local, 4, fps);
  const picked = local > 90;

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', ...motion, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.blue, letterSpacing: '0.07em' }}>
          02 · SPLIT HWPX PREVIEW + OMP TERMINAL
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 31, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Double-Click Paragraph Locators Without Auto-Sending to Models
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, flex: 1 }}>
        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: 38, padding: '0 16px', backgroundColor: 'light-dark(#F3F6FB, #2D3139)', borderBottom: `1px solid ${PALETTE.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: FONT_MONO, fontSize: 11.5 }}>
            <span style={{ color: PALETTE.blue, fontWeight: 800 }}>LEFT · HWPX LIVE PREVIEW</span>
            <span style={{ color: PALETTE.muted }}>Ctrl+O · Ctrl+N · Hancom</span>
          </div>

          <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ flex: 1, backgroundColor: PALETTE.card, borderRadius: 12, border: `1px solid ${PALETTE.border}`, padding: '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${PALETTE.cardSoft}`, paddingBottom: 8 }}>
                <span style={{ fontSize: 15.5, fontWeight: 800, color: PALETTE.ink }}>proposal_draft.hwpx</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: PALETTE.teal, fontWeight: 700 }}>@rhwp/core 0.8.7</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 13, color: PALETTE.muted }}>1. Research Objective &amp; System Scope</div>
                <div
                  style={{
                    padding: '11px 13px',
                    borderRadius: 10,
                    backgroundColor: picked ? PALETTE.blueSoft : 'light-dark(#F8FAFC, #282C33)',
                    border: `1.5px solid ${picked ? PALETTE.blue : PALETTE.border}`,
                    fontSize: 13.5,
                    color: PALETTE.ink,
                    fontWeight: 600,
                    lineHeight: 1.48,
                  }}
                >
                  Section 2.1 · Paragraph #14 — Double-click copies structural path &amp; excerpt into composer only.
                </div>
                <div style={{ padding: '12px 14px', borderRadius: 9, backgroundColor: PALETTE.cardSoft, border: `1px dashed ${PALETTE.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted }}>
                  <span>Table 2 · Hardware Matrix (4×6)</span>
                  <span style={{ color: PALETTE.green, fontWeight: 700 }}>INTACT</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT_MONO, fontSize: 11, color: PALETTE.muted, borderTop: `1px solid ${PALETTE.cardSoft}`, paddingTop: 8 }}>
                <span>Live file watcher active</span>
                <span style={{ color: PALETTE.blue, fontWeight: 700 }}>{picked ? 'Locator copied →' : 'Waiting for click'}</span>
              </div>
            </div>
          </div>
        </div>

        <TerminalWindow
          title="RIGHT · oh-my-pi (OMP) Terminal"
          badge="OPT-IN AI"
          command="/login && /model"
          localFrame={local}
          accentColor="#5EEAD4"
          lines={[
            { text: '# AI runs strictly when explicitly invoked by user', dim: true },
            { text: '[composer] section0.xml :: p#14 excerpt staged (NOT auto-sent)', color: '#93C5FD', highlight: true },
            { text: '→ Review prompt & approve edit locally before applying', color: '#E2E8F0' },
            { text: '✓ Hancom or OMP save detected -> refreshing left HWPX preview', color: '#86EFAC' },
            { text: '✓ Snapshot archived to .hwpreview/history/ckpt-02.hwpx', color: '#86EFAC' },
          ]}
          footer="User-Account Shell · Zero Hidden Cloud Upload"
        />
      </div>
    </div>
  );
};

const SceneCheckpoints: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = Math.max(0, frame - 680);
  const motion = sceneStyle(frame, 680, 1060);
  const head = enterSpring(local, 4, fps);
  const active = Math.floor((local / 80) % 4);

  const stages = [
    { num: '01', title: 'Immutable Original', path: '.hwpreview/originals/', desc: 'First opened state archived untouched.', color: PALETTE.navy },
    { num: '02', title: 'Auto Checkpoints', path: '.hwpreview/history/', desc: 'Timestamped snapshots before edits.', color: PALETTE.blue },
    { num: '03', title: 'Drawer Restore', path: 'Ctrl+B History Drawer', desc: 'Inspect and roll back any checkpoint.', color: PALETTE.teal },
    { num: '04', title: 'Clean Export Copy', path: 'Export Separate File', desc: 'Deliver clean output without mutating archive.', color: PALETTE.green },
  ];

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', ...motion, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.orange, letterSpacing: '0.07em' }}>
          03 · ORIGINALS, CHECKPOINTS &amp; FIDELITY
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 31, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Reversible Editing Without Stripping Complex Objects
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
        {stages.map((st, idx) => (
          <div key={st.num} style={{ ...GLASS_CARD_STYLE, borderRadius: 16, padding: '16px 17px', outline: idx === active ? `2px solid ${st.color}` : '2px solid transparent' }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 800, color: st.color }}>STEP {st.num}</div>
            <div style={{ fontSize: 16.5, fontWeight: 800, color: PALETTE.ink, marginTop: 5 }}>{st.title}</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: st.color, marginTop: 5 }}>{st.path}</div>
            <div style={{ fontSize: 13, color: PALETTE.muted, marginTop: 5 }}>{st.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 24px', flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.teal }}>STRICT STRUCTURE PRESERVATION</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: PALETTE.ink }}>No Silent Plain-Text Flattening</div>
          <div style={{ fontSize: 14.5, color: PALETTE.muted, lineHeight: 1.52 }}>
            Unsupported tables, embedded figures, control objects, and mixed runs are preserved instead of dropped or converted into plain paragraphs.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {['Tables ✓', 'Figures ✓', 'Controls ✓', 'Mixed Runs ✓'].map((tag) => (
              <span key={tag} style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 999, backgroundColor: PALETTE.greenSoft, color: PALETTE.green }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div style={{ padding: '16px 18px', borderRadius: 14, backgroundColor: PALETTE.card, border: `1px solid ${PALETTE.border}`, fontFamily: FONT_MONO, fontSize: 12.5, lineHeight: 1.75, color: PALETTE.ink }}>
          <div>work-folder/</div>
          <div>├─ report.hwpx <span style={{ color: PALETTE.blue, fontWeight: 700 }}>(active)</span></div>
          <div>├─ report_export.hwpx <span style={{ color: PALETTE.green, fontWeight: 700 }}>(export copy)</span></div>
          <div>└─ .hwpreview/</div>
          <div>&nbsp;&nbsp;&nbsp;├─ originals/report.hwpx</div>
          <div>&nbsp;&nbsp;&nbsp;└─ history/20261125-ckpt.hwpx</div>
        </div>
      </div>
    </div>
  );
};

const SceneRuntime: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = Math.max(0, frame - 1060);
  const motion = sceneStyle(frame, 1060, 1440);
  const head = enterSpring(local, 4, fps);

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', ...motion, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.purple, letterSpacing: '0.07em' }}>
          04 · ISOLATED PACKAGING &amp; CONSENT-GATED SETUP
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 31, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Pinned Dependencies That Never Mutate User Toolchains
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, flex: 1 }}>
        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: PALETTE.navy }}>ISOLATED APP PREFIX</div>
          <div style={{ padding: '14px 16px', borderRadius: 12, backgroundColor: '#101521', color: '#93C5FD', fontFamily: FONT_MONO, fontSize: 12.5, lineHeight: 1.65 }}>
            %LOCALAPPDATA%\HWPReview\Dependencies\<br />
            &nbsp;&nbsp;Bun-1.4.4-OMP-18.15.0
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {[
              'Reuses valid .NET 10 Desktop, WebView2, PowerShell 7 & fonts',
              'Installs only missing components under human UAC / terms',
              'Never touches or modifies user global ~/.bun',
            ].map((l) => (
              <div key={l} style={{ fontSize: 14, color: PALETTE.ink, fontWeight: 500 }}>✓ {l}</div>
            ))}
          </div>
        </div>

        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: PALETTE.teal }}>OPTIONAL 32-BIT HANCOM MODULE</div>
          {[
            { t: 'Compatibility Detection', d: 'Detects compatible 32-bit Hancom Office automatically.' },
            { t: 'Verified Official Archive', d: 'Downloads & verifies fixed HTTPS ZIP from Hancom docs.' },
            { t: 'Per-User Explicit Consent', d: 'Registers only after agreement; skips damaged entries.' },
            { t: 'Standalone HWPX Mode', d: 'Works cleanly even when Hancom Office is absent.' },
          ].map((row) => (
            <div key={row.t} style={{ padding: '10px 12px', borderRadius: 11, backgroundColor: PALETTE.card, border: `1px solid ${PALETTE.border}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: PALETTE.ink }}>{row.t}</div>
              <div style={{ fontSize: 12.5, color: PALETTE.muted, marginTop: 2 }}>{row.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SceneScope: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = Math.max(0, frame - 1440);
  const motion = sceneStyle(frame, 1440, 1800, true);
  const head = enterSpring(local, 4, fps);

  const cards = [
    { badge: 'HUMAN CONTROL', title: 'No Unattended Submission', desc: 'Original files stay guarded; review, approvals, and final Hancom layout verification stay human-owned.', color: PALETTE.blue },
    { badge: 'LEGACY .HWP', title: 'Separate Desktop Tool Window', desc: 'Binary .hwp workflow isolates review, approval, and apply steps while blocking schema-2 and arbitrary writes.', color: PALETTE.teal },
    { badge: 'DEV WORKFLOW', title: 'Single-Command Local Build', desc: '.\\start-desktop.cmd creates .venv, builds/verifies WPF UI, and halts on tamper or source mismatch.', color: PALETTE.orange },
    { badge: 'OPEN LICENSE', title: 'AGPL-3.0-only Public Source', desc: 'Corresponding source published for 1.0.0-rc.4 pre-release kits with third-party notices preserved.', color: PALETTE.purple },
  ];

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', ...motion, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.blue, letterSpacing: '0.07em' }}>
          05 · EXPLICIT BOUNDARIES &amp; PUBLIC RELEASE
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Local-First HWPX Authoring with Clear Guardrails
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
        {cards.map((c, idx) => {
          const itemIn = enterSpring(local, 12 + idx * 10, fps);
          return (
            <div key={c.title} style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '18px 20px', opacity: itemIn, transform: `translateY(${(1 - itemIn) * 12}px)` }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 800, color: c.color }}>{c.badge}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: PALETTE.ink, marginTop: 6 }}>{c.title}</div>
              <div style={{ fontSize: 14, lineHeight: 1.5, color: PALETTE.muted, marginTop: 6 }}>{c.desc}</div>
            </div>
          );
        })}
      </div>

      <div style={{ ...GLASS_CARD_STYLE, borderRadius: 14, padding: '12px 18px', display: 'flex', justifyContent: 'space-between', fontFamily: FONT_MONO, fontSize: 13 }}>
        <span style={{ color: PALETTE.blue, fontWeight: 700 }}>github.com/mud-the-developer/hwp-editor-public</span>
        <span style={{ color: PALETTE.muted }}>1.0.0-rc.4 · AGPL-3.0-only</span>
      </div>
    </div>
  );
};

export const HwpEditorDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <FrameChrome
      badge="HWP EDITOR"
      title="Local HWPX Live Preview & Embedded OMP Workspace"
      chapters={CHAPTERS}
      frame={frame}
      durationInFrames={HWP_EDITOR_DURATION}
      accentColor={PALETTE.blue}
      footerLabel="hwp-editor-public · WPF + WebView2 + @rhwp/core + OMP"
    >
      {frame < 334 && <SceneOverview frame={frame} fps={fps} />}
      {frame >= 306 && frame < 694 && <SceneSplitWorkspace frame={frame} fps={fps} />}
      {frame >= 666 && frame < 1074 && <SceneCheckpoints frame={frame} fps={fps} />}
      {frame >= 1046 && frame < 1454 && <SceneRuntime frame={frame} fps={fps} />}
      {frame >= 1426 && <SceneScope frame={frame} fps={fps} />}
    </FrameChrome>
  );
};
