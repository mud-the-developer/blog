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

export const HWP_EDITOR_DURATION = 1800; // 60s @ 30fps

const CHAPTERS: Chapter[] = [
  { label: 'Overview', start: 0, end: 320 },
  { label: 'Split Workspace', start: 320, end: 680 },
  { label: 'Checkpoints', start: 680, end: 1060 },
  { label: 'Isolated Runtime', start: 1060, end: 1440 },
  { label: 'Scope & Safety', start: 1440, end: 1800 },
];

const SceneOverview: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const opacity = fadeWindow(frame, 0, 320, 14);
  const s1 = enterSpring(frame, 4, fps);
  const s2 = enterSpring(frame, 20, fps);
  const s3 = enterSpring(frame, 36, fps);

  const pillars = [
    { name: 'Live HWPX Preview', tag: '@rhwp/core 0.8.7', color: PALETTE.blue, soft: PALETTE.blueSoft },
    { name: 'Embedded OMP Terminal', tag: 'OPT-IN AI', color: PALETTE.teal, soft: PALETTE.greenSoft },
    { name: 'Original Preservation', tag: '.hwpreview/', color: PALETTE.orange, soft: PALETTE.amberSoft },
    { name: 'Isolated Windows Kit', tag: 'AGPL-3.0', color: PALETTE.purple, soft: PALETTE.purpleSoft },
  ];

  return (
    <div style={{ position: 'absolute', inset: '26px 40px 22px', opacity, display: 'grid', gridTemplateColumns: '1.16fr 0.84fr', gap: 28, alignItems: 'center' }}>
      <div style={{ transform: `translateY(${(1 - s1) * 18}px)` }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999, ...GLASS_CARD_STYLE, fontFamily: FONT_MONO, fontSize: 13, fontWeight: 600, color: PALETTE.blue, marginBottom: 18 }}>
          <span>WINDOWS LOCAL DESKTOP</span>
          <span style={{ color: PALETTE.border }}>·</span>
          <span>HWPX PREVIEW + OH-MY-PI</span>
        </div>

        <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1.08, fontWeight: 800, letterSpacing: '-0.035em', color: PALETTE.ink }}>
          HWP Editor
        </h1>
        <p style={{ margin: '14px 0 0', fontSize: 20, lineHeight: 1.44, fontWeight: 500, color: PALETTE.muted }}>
          Local-first HWPX document authoring and review workspace pairing live local rendering with an embedded OMP terminal and automatic checkpoints.
        </p>

        <div style={{ marginTop: 26, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, opacity: s2, transform: `translateY(${(1 - s2) * 14}px)` }}>
          {[
            { value: 'rc.4', label: 'Public Source', sub: '1.0.0-rc.4 pre-release' },
            { value: '2-Pane', label: 'Split Desktop', sub: 'Preview + OMP shell' },
            { value: '0', label: 'Auto-Send', sub: 'Human-gated AI only' },
          ].map((stat) => (
            <div key={stat.label} style={{ ...GLASS_CARD_STYLE, borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 30, fontWeight: 800, color: PALETTE.blue, letterSpacing: '-0.03em' }}>{stat.value}</div>
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
          const itemIn = enterSpring(frame, 42 + idx * 12, fps);
          return (
            <div key={item.name} style={{ padding: '13px 16px', borderRadius: 13, backgroundColor: '#FFFFFF', border: `1px solid ${PALETTE.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: itemIn, transform: `translateX(${(1 - itemIn) * 14}px)` }}>
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
  const local = frame - 320;
  const opacity = fadeWindow(frame, 320, 680, 14);
  const head = enterSpring(local, 4, fps);
  const picked = local > 120;

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', opacity, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.blue, letterSpacing: '0.07em' }}>
          02 · SPLIT HWPX PREVIEW + OMP TERMINAL
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Double-Click Paragraph Locators Without Auto-Sending to Models
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, flex: 1 }}>
        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT_MONO, fontSize: 12 }}>
            <span style={{ color: PALETTE.blue, fontWeight: 800 }}>LEFT · HWPX LIVE PREVIEW</span>
            <span style={{ color: PALETTE.muted }}>Ctrl+O · Ctrl+N · Open in Hancom</span>
          </div>

          <div style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, border: `1px solid ${PALETTE.border}`, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: PALETTE.ink }}>proposal_draft.hwpx</div>
            <div style={{ height: 10, width: '88%', borderRadius: 4, backgroundColor: PALETTE.cardSoft }} />
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                backgroundColor: picked ? PALETTE.blueSoft : '#F8FAFC',
                border: `1.5px solid ${picked ? PALETTE.blue : PALETTE.border}`,
                fontSize: 13.5,
                color: PALETTE.ink,
                fontWeight: 600,
              }}
            >
              Section 2.1 · Paragraph #14 — Double-click copies structural path &amp; excerpt only.
            </div>
            <div style={{ height: 42, borderRadius: 8, backgroundColor: PALETTE.cardSoft, border: `1px dashed ${PALETTE.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT_MONO, fontSize: 12, color: PALETTE.muted }}>
              Complex table / figure preserved intact
            </div>
          </div>
        </div>

        <div style={{ borderRadius: 18, backgroundColor: '#141923', color: '#E2E8F0', padding: '18px 20px', fontFamily: FONT_MONO, fontSize: 13.5, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94A3B8' }}>
            <span style={{ color: '#5EEAD4', fontWeight: 700 }}>RIGHT · OH-MY-PI (OMP) TERMINAL</span>
            <span>User-Gated /login · /model</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, lineHeight: 1.6 }}>
            <div style={{ color: '#94A3B8' }}># AI runs only when explicitly invoked</div>
            <div><span style={{ color: '#93C5FD' }}>&gt;</span> /model</div>
            {picked && (
              <div style={{ padding: '10px 12px', borderRadius: 10, backgroundColor: '#1E293B', border: '1px solid #38BDF8', color: '#E0F2FE' }}>
                [composer] section0.xml :: p#14 excerpt pasted (not sent)
              </div>
            )}
            <div style={{ color: '#86EFAC' }}>✓ File watcher refreshes left preview on Hancom or OMP save</div>
          </div>

          <div style={{ fontSize: 11.5, color: '#94A3B8' }}>
            Runs with user account permissions · No hidden cloud upload
          </div>
        </div>
      </div>
    </div>
  );
};

const SceneCheckpoints: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 680;
  const opacity = fadeWindow(frame, 680, 1060, 14);
  const head = enterSpring(local, 4, fps);
  const active = Math.floor((local / 85) % 4);

  const stages = [
    { num: '01', title: 'Immutable Original', path: '.hwpreview/originals/', desc: 'First opened state archived untouched.', color: PALETTE.navy },
    { num: '02', title: 'Auto Checkpoints', path: '.hwpreview/history/', desc: 'Timestamped snapshots before edits.', color: PALETTE.blue },
    { num: '03', title: 'Drawer Restore', path: 'Ctrl+B History Drawer', desc: 'Inspect and roll back any checkpoint.', color: PALETTE.teal },
    { num: '04', title: 'Clean Export Copy', path: 'Export Separate File', desc: 'Deliver clean output without mutating archive.', color: PALETTE.green },
  ];

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', opacity, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.orange, letterSpacing: '0.07em' }}>
          03 · ORIGINALS, CHECKPOINTS &amp; FIDELITY
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Reversible Editing Without Stripping Complex Objects
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
        {stages.map((st, idx) => (
          <div key={st.num} style={{ ...GLASS_CARD_STYLE, borderRadius: 16, padding: '18px 18px', outline: idx === active ? `2px solid ${st.color}` : '2px solid transparent' }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: st.color }}>STEP {st.num}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: PALETTE.ink, marginTop: 6 }}>{st.title}</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: st.color, marginTop: 6 }}>{st.path}</div>
            <div style={{ fontSize: 13.5, color: PALETTE.muted, marginTop: 6 }}>{st.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 24px', flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.teal }}>STRICT STRUCTURE PRESERVATION</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: PALETTE.ink, marginTop: 6 }}>No Silent Plain-Text Flattening</div>
          <div style={{ fontSize: 14.5, color: PALETTE.muted, marginTop: 6, lineHeight: 1.5 }}>
            Unsupported tables, embedded figures, control objects, and mixed runs are preserved instead of dropped or converted into plain paragraphs.
          </div>
        </div>
        <div style={{ padding: '16px 18px', borderRadius: 14, backgroundColor: '#FFFFFF', border: `1px solid ${PALETTE.border}`, fontFamily: FONT_MONO, fontSize: 12.5, lineHeight: 1.7, color: PALETTE.ink }}>
          <div>work-folder/</div>
          <div>├─ report.hwpx <span style={{ color: PALETTE.blue }}>(active)</span></div>
          <div>└─ .hwpreview/</div>
          <div>&nbsp;&nbsp;&nbsp;├─ originals/report.hwpx</div>
          <div>&nbsp;&nbsp;&nbsp;└─ history/20261125-ckpt.hwpx</div>
        </div>
      </div>
    </div>
  );
};

const SceneRuntime: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 1060;
  const opacity = fadeWindow(frame, 1060, 1440, 14);
  const head = enterSpring(local, 4, fps);

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', opacity, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.purple, letterSpacing: '0.07em' }}>
          04 · ISOLATED PACKAGING &amp; CONSENT-GATED SETUP
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Pinned Dependencies That Never Mutate User Toolchains
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, flex: 1 }}>
        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: PALETTE.navy }}>ISOLATED PREFIX</div>
          <div style={{ padding: '12px 14px', borderRadius: 12, backgroundColor: '#141923', color: '#93C5FD', fontFamily: FONT_MONO, fontSize: 12.5, lineHeight: 1.6 }}>
            %LOCALAPPDATA%\HWPReview\Dependencies\<br />
            &nbsp;&nbsp;Bun-1.4.4-OMP-18.15.0
          </div>
          <div style={{ fontSize: 14.5, color: PALETTE.muted, lineHeight: 1.55 }}>
            Installs only missing runtimes (.NET 10 Desktop, WebView2, PowerShell 7, fonts) under explicit UAC/terms review. Never touches user <code>~/.bun</code>.
          </div>
        </div>

        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: PALETTE.teal }}>OPTIONAL 32-BIT HANCOM MODULE</div>
          {[
            'Detects compatible 32-bit Hancom Office automatically',
            'Verifies official Hancom HTTPS security module archive',
            'Registers per-user only after explicit consent',
            'HWPX preview works independently without Hancom installed',
          ].map((line) => (
            <div key={line} style={{ fontSize: 14.5, fontWeight: 600, color: PALETTE.ink }}>• {line}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SceneScope: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 1440;
  const opacity = fadeWindow(frame, 1440, 1800, 14);
  const head = enterSpring(local, 4, fps);

  const cards = [
    { badge: 'HUMAN CONTROL', title: 'No Unattended Submission', desc: 'Original files stay guarded; review, approvals, and final Hancom layout verification stay human-owned.', color: PALETTE.blue },
    { badge: 'LEGACY .HWP', title: 'Separate Desktop Tool Window', desc: 'Binary .hwp workflow isolates review, approval, and apply steps while blocking schema-2 and arbitrary writes.', color: PALETTE.teal },
    { badge: 'DEV WORKFLOW', title: 'Single-Command Local Build', desc: '.\\start-desktop.cmd creates .venv, builds/verifies WPF UI, and halts on tamper or source mismatch.', color: PALETTE.orange },
    { badge: 'OPEN LICENSE', title: 'AGPL-3.0-only Public Source', desc: 'Corresponding source published for 1.0.0-rc.4 pre-release kits with third-party notices preserved.', color: PALETTE.purple },
  ];

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', opacity, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
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
          const itemIn = enterSpring(local, 14 + idx * 10, fps);
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
      {frame < 320 && <SceneOverview frame={frame} fps={fps} />}
      {frame >= 306 && frame < 680 && <SceneSplitWorkspace frame={frame} fps={fps} />}
      {frame >= 666 && frame < 1060 && <SceneCheckpoints frame={frame} fps={fps} />}
      {frame >= 1046 && frame < 1440 && <SceneRuntime frame={frame} fps={fps} />}
      {frame >= 1426 && <SceneScope frame={frame} fps={fps} />}
    </FrameChrome>
  );
};
