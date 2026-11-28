import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  Chapter,
  enterSpring,
  FONT_MONO,
  FrameChrome,
  GLASS_CARD_STYLE,
  PALETTE,
  sceneStyle,
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
  const motion = sceneStyle(frame, 0, 320);
  const s1 = enterSpring(frame, 4, fps);
  const s2 = enterSpring(frame, 18, fps);
  const s3 = enterSpring(frame, 34, fps);

  const features = [
    { name: 'Edit Where You Read', tag: 'BLOCK MODE', color: PALETTE.orange, soft: PALETTE.amberSoft },
    { name: 'Cached Pretext Layout', tag: 'ZERO JANK', color: PALETTE.navy, soft: PALETTE.blueSoft },
    { name: 'Explicit Ctrl+S Guard', tag: 'UNDO / REDO', color: PALETTE.teal, soft: PALETTE.greenSoft },
    { name: 'Native Image Viewer', tag: 'ZOOM & PAN', color: PALETTE.purple, soft: PALETTE.purpleSoft },
  ];

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', ...motion, display: 'grid', gridTemplateColumns: '1.16fr 0.84fr', gap: 28, alignItems: 'center' }}>
      <div style={{ transform: `translateY(${(1 - s1) * 18}px)` }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999, ...GLASS_CARD_STYLE, fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 600, color: PALETTE.orange, marginBottom: 16 }}>
          <span>NATIVE WINDOWS x64</span>
          <span style={{ color: PALETTE.border }}>·</span>
          <span>PURE RUST + WIN32</span>
        </div>

        <h1 style={{ margin: 0, fontSize: 50, lineHeight: 1.06, fontWeight: 800, letterSpacing: '-0.038em', color: PALETTE.ink }}>
          Rusty Note
        </h1>
        <p style={{ margin: '14px 0 0', fontSize: 20, lineHeight: 1.46, fontWeight: 500, color: PALETTE.muted }}>
          Editable Markdown sticky notes in a single portable Rust binary—zero Electron, WebView, or JavaScript runtime overhead.
        </p>

        <div style={{ marginTop: 26, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, opacity: s2, transform: `translateY(${(1 - s2) * 14}px)` }}>
          {[
            { value: '0 MB', label: 'Browser Engine', sub: 'No Electron / WebView' },
            { value: '1 .exe', label: 'Portable Binary', sub: 'Windows 10/11 x64' },
            { value: '80–160%', label: 'Smooth Zoom', sub: 'Cached glyph reflow' },
          ].map((stat) => (
            <div key={stat.label} style={{ ...GLASS_CARD_STYLE, borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 26, fontWeight: 800, color: PALETTE.orange, letterSpacing: '-0.03em' }}>{stat.value}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: PALETTE.ink, marginTop: 4 }}>{stat.label}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted, marginTop: 3 }}>{stat.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...GLASS_CARD_STYLE, borderRadius: 20, padding: '22px 24px', opacity: s3, transform: `translateY(${(1 - s3) * 18}px)`, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.orange, letterSpacing: '0.06em' }}>DESIGN PILLARS</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted }}>v1.0.1</span>
        </div>

        {features.map((item, idx) => {
          const itemIn = enterSpring(frame, 40 + idx * 11, fps);
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

const SceneInPlaceEdit: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = Math.max(0, frame - 320);
  const motion = sceneStyle(frame, 320, 680);
  const head = enterSpring(local, 4, fps);
  const editing = local > 95 && local < 275;
  const saved = local >= 275;
  const cursorOn = Math.floor(local / 11) % 2 === 0;

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', ...motion, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.orange, letterSpacing: '0.07em' }}>
          02 · EDIT WHERE YOU READ
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 31, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Single-Block Inline Editing with Exact Byte Preservation
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.16fr 0.84fr', gap: 20, flex: 1 }}>
        <div style={{ borderRadius: 18, backgroundColor: '#FFFDF7', border: `1.5px solid ${PALETTE.border}`, boxShadow: '0 16px 34px rgba(15,23,42,0.09)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Win32 sticky note titlebar */}
          <div style={{ height: 40, padding: '0 16px', backgroundColor: '#F6F1E3', borderBottom: '1px solid #E5DEC9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 700, color: PALETTE.ink }}>
                experiment-notes.md {editing ? '●' : ''}
              </span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, backgroundColor: saved ? PALETTE.greenSoft : PALETTE.amberSoft, color: saved ? PALETTE.green : PALETTE.orange }}>
                {editing ? 'INLINE BLOCK 2' : saved ? 'SAVED (Ctrl+S)' : 'RENDERED'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, fontFamily: FONT_MONO, fontSize: 11, color: PALETTE.muted }}>
              <span style={{ padding: '2px 7px', borderRadius: 6, backgroundColor: '#FFFFFF', border: '1px solid #E5DEC9' }}>P Pin</span>
              <span style={{ padding: '2px 7px', borderRadius: 6, backgroundColor: '#FFFFFF', border: '1px solid #E5DEC9' }}>T Paper</span>
              <span style={{ padding: '2px 7px', borderRadius: 6, backgroundColor: '#FFFFFF', border: '1px solid #E5DEC9' }}>100%</span>
            </div>
          </div>

          <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: PALETTE.ink }}>MWC Beamforming Checklist</div>

            <div
              style={{
                padding: '13px 15px',
                borderRadius: 12,
                backgroundColor: editing ? '#FFF7ED' : '#FFFFFF',
                border: `1.5px solid ${editing ? PALETTE.orange : '#E5DEC9'}`,
                fontFamily: editing ? FONT_MONO : undefined,
                fontSize: editing ? 13.5 : 15,
                color: PALETTE.ink,
                lineHeight: 1.65,
              }}
            >
              {editing ? (
                <>
                  <div>- [x] Verify **UE trajectory** lookahead latency (34ms -&gt; 1475ms)</div>
                  <div>
                    - [x] Capture clean `ablation.pdf` before rehearsal
                    <span style={{ display: 'inline-block', width: 2, height: 15, backgroundColor: PALETTE.orange, marginLeft: 2, verticalAlign: 'middle', opacity: cursorOn ? 1 : 0 }} />
                  </div>
                </>
              ) : (
                <>
                  <div>☑ Verify <strong>UE trajectory</strong> lookahead latency (34ms → 1475ms)</div>
                  <div>{saved ? '☑' : '☐'} Capture clean <code style={{ fontFamily: FONT_MONO, fontSize: 13 }}>ablation.pdf</code> before rehearsal</div>
                </>
              )}
            </div>

            <div style={{ padding: '11px 14px', borderRadius: 10, backgroundColor: '#F6F3EA', fontSize: 13.5, color: PALETTE.muted, lineHeight: 1.5 }}>
              Block 3 (untouched): surrounding headings, fenced code blocks, and trailing CRLF/LF endings stay byte-identical.
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted, borderTop: '1px solid #ECE6D6', paddingTop: 10 }}>
              <span>Unedited bytes modified: <strong style={{ color: PALETTE.green }}>0 B</strong></span>
              <span>Line endings: <strong>CRLF preserved</strong></span>
            </div>
          </div>
        </div>

        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.navy }}>PRESERVATION INVARIANTS</div>
          {[
            { t: 'Zero Format Rewriting', d: 'Only the edited Markdown span is patched; untouched blocks stay byte-identical.' },
            { t: 'Direct Task Toggles', d: 'Click checkboxes right inside rendered mode without raw-source flicker.' },
            { t: 'Owned Image Viewer', d: 'Click local Markdown images for native zoom/pan (Home, Space, Esc).' },
          ].map((item) => (
            <div key={item.t} style={{ padding: '12px 14px', borderRadius: 12, backgroundColor: '#FFFFFF', border: `1px solid ${PALETTE.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: PALETTE.ink }}>{item.t}</div>
              <div style={{ fontSize: 13.5, color: PALETTE.muted, marginTop: 3, lineHeight: 1.45 }}>{item.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SceneCachedLayout: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = Math.max(0, frame - 680);
  const motion = sceneStyle(frame, 680, 1060);
  const head = enterSpring(local, 4, fps);
  const widthPct = 66 + Math.sin(local / 26) * 28;
  const pxWidth = Math.round(widthPct * 5.2);
  const linesEst = pxWidth < 260 ? 6 : pxWidth < 360 ? 4 : 3;

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', ...motion, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.navy, letterSpacing: '0.07em' }}>
          03 · CACHED PRETEXT-INSPIRED LAYOUT
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 31, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Measure Glyph Advances Once · Reflow Smoothly on Every Resize
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.12fr 0.88fr', gap: 20, flex: 1 }}>
        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '18px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: FONT_MONO, fontSize: 12 }}>
            <span style={{ color: PALETTE.navy, fontWeight: 700 }}>LIVE REFLOW THEATER</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ padding: '2px 8px', borderRadius: 6, backgroundColor: PALETTE.blueSoft, color: PALETTE.navy, fontWeight: 700 }}>{pxWidth} px</span>
              <span style={{ padding: '2px 8px', borderRadius: 6, backgroundColor: PALETTE.greenSoft, color: PALETTE.green, fontWeight: 700 }}>{linesEst} lines</span>
            </div>
          </div>

          {/* Horizontal width ruler */}
          <div style={{ width: `${widthPct}%`, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ height: 2, flex: 1, backgroundColor: PALETTE.blue }} />
            <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 700, color: PALETTE.blue }}>↔ {pxWidth}px</span>
            <div style={{ height: 2, flex: 1, backgroundColor: PALETTE.blue }} />
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'stretch' }}>
            <div
              style={{
                width: `${widthPct}%`,
                borderRadius: 14,
                backgroundColor: '#FFFFFF',
                border: `2px solid ${PALETTE.blue}`,
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
              }}
            >
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: PALETTE.ink }}>Cached Word &amp; Glyph Metrics</div>
                <div style={{ fontSize: 14, lineHeight: 1.58, color: PALETTE.muted, marginTop: 8 }}>
                  Font advances are measured once per scale and reused on every resize so line breaks recompute in pure arithmetic with zero re-shaping.
                </div>
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: PALETTE.teal, fontWeight: 700, marginTop: 10 }}>
                cache hit: 99.4% · reflow: 0.08 ms
              </div>
              {/* Right drag handle grip */}
              <div style={{ position: 'absolute', right: -5, top: '50%', transform: 'translateY(-50%)', width: 8, height: 34, borderRadius: 4, backgroundColor: PALETTE.blue }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.green, fontWeight: 700 }}>
            <span>Event-driven Win32 paint loop</span>
            <span>0% idle CPU · No browser IPC</span>
          </div>
        </div>

        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.teal }}>RENDER PIPELINE</div>
          {[
            { step: '01', title: 'Parse Markdown Blocks', desc: 'Paragraphs, ATX headings, lists, task items, local images.' },
            { step: '02', title: 'Cache Font Advances', desc: 'Measure glyph widths once per font scale (80%–160%).' },
            { step: '03', title: 'Reflow on Resize / Edit', desc: 'Pure arithmetic line wrapping in microseconds.' },
            { step: '04', title: 'Paint on Demand', desc: 'Redraws only on input, resize, or file change events.' },
          ].map((row) => (
            <div key={row.step} style={{ padding: '10px 12px', borderRadius: 11, backgroundColor: '#FFFFFF', border: `1px solid ${PALETTE.border}`, display: 'flex', gap: 11, alignItems: 'flex-start' }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: PALETTE.orange, paddingTop: 2 }}>{row.step}</span>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: PALETTE.ink }}>{row.title}</div>
                <div style={{ fontSize: 13, color: PALETTE.muted, marginTop: 2 }}>{row.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SceneSaveDiscipline: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = Math.max(0, frame - 1060);
  const motion = sceneStyle(frame, 1060, 1440);
  const head = enterSpring(local, 4, fps);
  const pulse = Math.floor((local / 75) % 4);

  const steps = [
    { title: 'Block Edit / Toggle', sub: 'Mutate in-memory draft', color: PALETTE.orange },
    { title: 'Bounded Undo Stack', sub: 'Ctrl+Z / Ctrl+Y history', color: PALETTE.navy },
    { title: 'External Watch Guard', sub: 'Reload clean · Protect dirty', color: PALETTE.teal },
    { title: 'Explicit Ctrl+S Commit', sub: 'Atomic write to disk', color: PALETTE.green },
  ];

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', ...motion, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.teal, letterSpacing: '0.07em' }}>
          04 · EXPLICIT SAVE &amp; CONFLICT DISCIPLINE
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 31, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Never Silently Overwrite Dirty Local Drafts
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
        {steps.map((s, idx) => (
          <div key={s.title} style={{ ...GLASS_CARD_STYLE, borderRadius: 16, padding: '16px 18px', outline: idx === pulse ? `2px solid ${s.color}` : '2px solid transparent' }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: s.color }}>0{idx + 1}</div>
            <div style={{ fontSize: 16.5, fontWeight: 800, color: PALETTE.ink, marginTop: 6 }}>{s.title}</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted, marginTop: 5 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '22px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, flex: 1, alignItems: 'center' }}>
        <div style={{ padding: '18px 20px', borderRadius: 14, backgroundColor: PALETTE.greenSoft, border: `1.5px solid ${PALETTE.green}` }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: PALETTE.green }}>CLEAN BUFFER + EXTERNAL EDIT</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: PALETTE.ink, marginTop: 6 }}>Auto-Reloads Latest Disk File</div>
          <div style={{ fontSize: 14, color: PALETTE.muted, marginTop: 6, lineHeight: 1.5 }}>
            Seamless when Git checkout, another editor, or an agent updates the underlying Markdown file.
          </div>
        </div>
        <div style={{ padding: '18px 20px', borderRadius: 14, backgroundColor: PALETTE.amberSoft, border: `1.5px solid ${PALETTE.orange}` }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: PALETTE.orange }}>DIRTY BUFFER + EXTERNAL EDIT</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: PALETTE.ink, marginTop: 6 }}>Keeps Unsaved Work Safe</div>
          <div style={{ fontSize: 14, color: PALETTE.muted, marginTop: 6, lineHeight: 1.5 }}>
            Blocks silent clobbering—every disk write happens strictly on explicit Ctrl+S.
          </div>
        </div>
      </div>
    </div>
  );
};

const SceneControls: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = Math.max(0, frame - 1440);
  const motion = sceneStyle(frame, 1440, 1800, true);
  const head = enterSpring(local, 4, fps);

  const shortcuts = [
    { key: 'P', label: 'Pin Always-on-Top', desc: 'Keep debugging checklists above active windows' },
    { key: 'T', label: 'Warm Paper / Charcoal', desc: 'Instant light & dark sticky-note palettes' },
    { key: 'Ctrl + / − / 0', label: '80%–160% Zoom', desc: 'Re-wraps cached layout cleanly at every scale' },
    { key: 'Ctrl + F', label: 'Bounded Search', desc: 'Fast ASCII case-insensitive in-note search' },
  ];

  const bar = interpolate(local, [14, 90], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', ...motion, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
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
          const itemIn = enterSpring(local, 12 + idx * 10, fps);
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
        <span style={{ color: PALETTE.orange, fontWeight: 700 }}>.\rusty-note.exe &quot;C:\path\note.md&quot;</span>
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
      {frame < 334 && <SceneOverview frame={frame} fps={fps} />}
      {frame >= 306 && frame < 694 && <SceneInPlaceEdit frame={frame} fps={fps} />}
      {frame >= 666 && frame < 1074 && <SceneCachedLayout frame={frame} fps={fps} />}
      {frame >= 1046 && frame < 1454 && <SceneSaveDiscipline frame={frame} fps={fps} />}
      {frame >= 1426 && <SceneControls frame={frame} fps={fps} />}
    </FrameChrome>
  );
};
