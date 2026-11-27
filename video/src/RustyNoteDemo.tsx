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

export const RUSTY_NOTE_DURATION = 1800; // 60s @ 30fps

const CHAPTERS: Chapter[] = [
  { label: 'Overview', start: 0, end: 320 },
  { label: 'In-Place Edit', start: 320, end: 680 },
  { label: 'Cached Layout', start: 680, end: 1060 },
  { label: 'Save Discipline', start: 1060, end: 1440 },
  { label: 'Controls', start: 1440, end: 1800 },
];

const SceneOverview: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const opacity = fadeWindow(frame, 0, 320, 14);
  const s1 = enterSpring(frame, 4, fps);
  const s2 = enterSpring(frame, 20, fps);
  const s3 = enterSpring(frame, 36, fps);

  const features = [
    { name: 'Edit Where You Read', tag: 'BLOCK MODE', color: PALETTE.orange, soft: PALETTE.amberSoft },
    { name: 'Cached Pretext Layout', tag: 'ZERO JANK', color: PALETTE.navy, soft: PALETTE.blueSoft },
    { name: 'Explicit Ctrl+S Guard', tag: 'UNDO / REDO', color: PALETTE.teal, soft: PALETTE.greenSoft },
    { name: 'Native Image Viewer', tag: 'ZOOM & PAN', color: PALETTE.purple, soft: PALETTE.purpleSoft },
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
            color: PALETTE.orange,
            marginBottom: 18,
          }}
        >
          <span>NATIVE WINDOWS x64</span>
          <span style={{ color: PALETTE.border }}>·</span>
          <span>PURE RUST + WIN32</span>
        </div>

        <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1.08, fontWeight: 800, letterSpacing: '-0.035em', color: PALETTE.ink }}>
          Rusty Note
        </h1>
        <p style={{ margin: '14px 0 0', fontSize: 20.5, lineHeight: 1.44, fontWeight: 500, color: PALETTE.muted }}>
          Editable Markdown sticky notes in a single portable Rust binary—zero Electron, WebView, or JavaScript runtime overhead.
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
            { value: '0', label: 'Browser Runtime', sub: 'No Electron / WebView' },
            { value: '1', label: 'Portable .exe', sub: 'Windows 10/11 x64' },
            { value: '160%', label: 'Smooth Zoom', sub: '80%–160% cached reflow' },
          ].map((stat) => (
            <div key={stat.label} style={{ ...GLASS_CARD_STYLE, borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 30, fontWeight: 800, color: PALETTE.orange, letterSpacing: '-0.03em' }}>
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
          <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.orange, letterSpacing: '0.06em' }}>
            DESIGN PILLARS
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted }}>v1.0.1</span>
        </div>

        {features.map((item, idx) => {
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

const SceneInPlaceEdit: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 320;
  const opacity = fadeWindow(frame, 320, 680, 14);
  const head = enterSpring(local, 4, fps);
  const editing = local > 110 && local < 280;

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', opacity, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.orange, letterSpacing: '0.07em' }}>
          02 · EDIT WHERE YOU READ
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Single-Block Inline Editing with Exact Byte Preservation
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 20, flex: 1 }}>
        <div
          style={{
            borderRadius: 18,
            backgroundColor: '#FFFDF7',
            border: `1.5px solid ${PALETTE.border}`,
            boxShadow: '0 14px 30px rgba(15,23,42,0.08)',
            padding: '18px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${PALETTE.border}`, paddingBottom: 10 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 700, color: PALETTE.ink }}>
              experiment-notes.md {editing ? '●' : ''}
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.orange, fontWeight: 700 }}>
              {editing ? 'EDITING BLOCK 2' : 'RENDERED VIEW'}
            </span>
          </div>

          <div style={{ fontSize: 22, fontWeight: 800, color: PALETTE.ink }}>MWC Beamforming Checklist</div>

          <div
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              backgroundColor: editing ? PALETTE.amberSoft : '#FFFFFF',
              border: `1.5px solid ${editing ? PALETTE.orange : PALETTE.border}`,
              fontFamily: editing ? FONT_MONO : undefined,
              fontSize: editing ? 14 : 15,
              color: PALETTE.ink,
              lineHeight: 1.55,
            }}
          >
            {editing
              ? '- [x] Verify **UE trajectory** lookahead latency (34ms -> 1475ms)\n- [ ] Capture clean `ablation.pdf` before rehearsal'
              : '☑ Verify UE trajectory lookahead latency (34ms → 1475ms)\n☐ Capture clean ablation.pdf before rehearsal'}
          </div>

          <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: '#F5F4EE', fontSize: 14, color: PALETTE.muted }}>
            Surrounding headings, code blocks, and trailing CRLF/LF line endings stay completely untouched on save.
          </div>
        </div>

        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.navy }}>
            PRESERVATION INVARIANTS
          </div>
          {[
            { t: 'Zero Format Rewriting', d: 'Unedited Markdown bytes and prefixes stay byte-identical.' },
            { t: 'Inline Task Toggles', d: 'Click checkboxes directly without switching into raw source.' },
            { t: 'Owned Image Viewer', d: 'Click embedded local images for native zoom/pan (Home, Space, Esc).' },
          ].map((item) => (
            <div key={item.t} style={{ padding: '12px 14px', borderRadius: 12, backgroundColor: '#FFFFFF', border: `1px solid ${PALETTE.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: PALETTE.ink }}>{item.t}</div>
              <div style={{ fontSize: 13.5, color: PALETTE.muted, marginTop: 3 }}>{item.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SceneCachedLayout: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 680;
  const opacity = fadeWindow(frame, 680, 1060, 14);
  const head = enterSpring(local, 4, fps);
  const widthPct = 62 + Math.sin(local / 28) * 26;

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', opacity, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.navy, letterSpacing: '0.07em' }}>
          03 · CACHED PRETEXT-INSPIRED LAYOUT
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Measure Glyph Advances Once · Reflow Smoothly on Every Resize
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 20, flex: 1 }}>
        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT_MONO, fontSize: 12 }}>
            <span style={{ color: PALETTE.navy, fontWeight: 700 }}>LIVE REFLOW SIMULATION</span>
            <span style={{ color: PALETTE.muted }}>width: {Math.round(widthPct * 5.2)} px</span>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', margin: '12px 0' }}>
            <div
              style={{
                width: `${widthPct}%`,
                minHeight: 165,
                borderRadius: 14,
                backgroundColor: '#FFFFFF',
                border: `2px solid ${PALETTE.blue}`,
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: PALETTE.ink }}>Cached Word Metrics</div>
              <div style={{ fontSize: 14, lineHeight: 1.55, color: PALETTE.muted }}>
                Font advances are cached per run so window resizing recomputes line breaks immediately without re-shaping unchanged paragraphs.
              </div>
            </div>
          </div>

          <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: PALETTE.green, fontWeight: 700 }}>
            Event-driven Win32 paint loop · Zero background spin or browser IPC
          </div>
        </div>

        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.teal }}>
            RENDER PIPELINE
          </div>
          {[
            { step: '01', title: 'Parse Markdown Blocks', desc: 'Paragraphs, ATX headings, lists, task items, local images.' },
            { step: '02', title: 'Cache Font Advances', desc: 'Measure glyph widths once per font scale (80%–160%).' },
            { step: '03', title: 'Reflow on Resize / Edit', desc: 'Pure arithmetic line wrapping in microseconds.' },
            { step: '04', title: 'Paint on Demand', desc: 'Redraws only on input, resize, or file change events.' },
          ].map((row) => (
            <div key={row.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: PALETTE.orange, paddingTop: 2 }}>{row.step}</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: PALETTE.ink }}>{row.title}</div>
                <div style={{ fontSize: 13.5, color: PALETTE.muted }}>{row.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SceneSaveDiscipline: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 1060;
  const opacity = fadeWindow(frame, 1060, 1440, 14);
  const head = enterSpring(local, 4, fps);
  const pulse = Math.floor((local / 80) % 4);

  const steps = [
    { title: 'Block Edit / Toggle', sub: 'Mutate in-memory draft', color: PALETTE.orange },
    { title: 'Bounded Undo Stack', sub: 'Ctrl+Z / Ctrl+Y history', color: PALETTE.navy },
    { title: 'External Watch Guard', sub: 'Reload clean · Protect dirty', color: PALETTE.teal },
    { title: 'Explicit Ctrl+S Commit', sub: 'Atomic write to disk', color: PALETTE.green },
  ];

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', opacity, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.teal, letterSpacing: '0.07em' }}>
          04 · EXPLICIT SAVE &amp; CONFLICT DISCIPLINE
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Never Silently Overwrite Dirty Local Drafts
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
        {steps.map((s, idx) => (
          <div
            key={s.title}
            style={{
              ...GLASS_CARD_STYLE,
              borderRadius: 16,
              padding: '18px 18px',
              outline: idx === pulse ? `2px solid ${s.color}` : '2px solid transparent',
            }}
          >
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: s.color }}>0{idx + 1}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: PALETTE.ink, marginTop: 6 }}>{s.title}</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: PALETTE.muted, marginTop: 6 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '22px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, flex: 1, alignItems: 'center' }}>
        <div style={{ padding: '16px 18px', borderRadius: 14, backgroundColor: PALETTE.greenSoft, border: `1px solid ${PALETTE.green}` }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: PALETTE.green }}>CLEAN BUFFER + EXTERNAL EDIT</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: PALETTE.ink, marginTop: 6 }}>Auto-Reloads Latest Disk File</div>
          <div style={{ fontSize: 14, color: PALETTE.muted, marginTop: 4 }}>Seamless when another editor or Git updates your note.</div>
        </div>
        <div style={{ padding: '16px 18px', borderRadius: 14, backgroundColor: PALETTE.amberSoft, border: `1px solid ${PALETTE.orange}` }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: PALETTE.orange }}>DIRTY BUFFER + EXTERNAL EDIT</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: PALETTE.ink, marginTop: 6 }}>Keeps Unsaved Work Safe</div>
          <div style={{ fontSize: 14, color: PALETTE.muted, marginTop: 4 }}>No silent clobbering—commits only on explicit Ctrl+S.</div>
        </div>
      </div>
    </div>
  );
};

const SceneControls: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 1440;
  const opacity = fadeWindow(frame, 1440, 1800, 14);
  const head = enterSpring(local, 4, fps);

  const shortcuts = [
    { key: 'P', label: 'Pin Always-on-Top', desc: 'Keep debugging checklists above active windows' },
    { key: 'T', label: 'Warm Paper / Charcoal', desc: 'Instant light & dark sticky-note palettes' },
    { key: 'Ctrl + / − / 0', label: '80%–160% Zoom', desc: 'Re-wraps cached layout cleanly at every scale' },
    { key: 'Ctrl + F', label: 'Bounded Search', desc: 'Fast ASCII case-insensitive in-note search' },
  ];

  const bar = interpolate(local, [20, 120], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', opacity, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.orange, letterSpacing: '0.07em' }}>
          05 · DAILY ERGONOMICS &amp; PORTABLE RELEASE
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Fast Keyboard Controls in One Portable Binary
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
        {shortcuts.map((sc, idx) => {
          const itemIn = enterSpring(local, 14 + idx * 10, fps);
          return (
            <div key={sc.key} style={{ ...GLASS_CARD_STYLE, borderRadius: 16, padding: '18px 20px', opacity: itemIn, transform: `translateY(${(1 - itemIn) * 12}px)` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 800, padding: '4px 10px', borderRadius: 8, backgroundColor: PALETTE.amberSoft, color: PALETTE.orange }}>
                  {sc.key}
                </span>
                <span style={{ fontSize: 17, fontWeight: 800, color: PALETTE.ink }}>{sc.label}</span>
              </div>
              <div style={{ fontSize: 14, color: PALETTE.muted, marginTop: 8 }}>{sc.desc}</div>
            </div>
          );
        })}
      </div>

      <div style={{ ...GLASS_CARD_STYLE, borderRadius: 14, padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: FONT_MONO, fontSize: 13, opacity: 0.4 + 0.6 * bar }}>
        <span style={{ color: PALETTE.orange, fontWeight: 700 }}>.\rusty-note.exe "C:\path\note.md"</span>
        <span style={{ color: PALETTE.muted }}>github.com/mud-the-developer/rusty-note</span>
      </div>
    </div>
  );
};

export const RustyNoteDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <FrameChrome
      badge="RUSTY NOTE"
      title="Native Rust Editable Markdown Sticky Notes for Windows"
      chapters={CHAPTERS}
      frame={frame}
      durationInFrames={RUSTY_NOTE_DURATION}
      accentColor={PALETTE.orange}
      footerLabel="rusty-note · Pure Rust + Win32 + Cached Pretext Layout"
    >
      {frame < 320 && <SceneOverview frame={frame} fps={fps} />}
      {frame >= 306 && frame < 680 && <SceneInPlaceEdit frame={frame} fps={fps} />}
      {frame >= 666 && frame < 1060 && <SceneCachedLayout frame={frame} fps={fps} />}
      {frame >= 1046 && frame < 1440 && <SceneSaveDiscipline frame={frame} fps={fps} />}
      {frame >= 1426 && <SceneControls frame={frame} fps={fps} />}
    </FrameChrome>
  );
};
