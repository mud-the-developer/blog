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

export const NIRI_SUITE_DURATION = 1800; // 60s @ 30fps

const CHAPTERS: Chapter[] = [
  { label: 'Overview', start: 0, end: 320 },
  { label: 'Notch Daemon', start: 320, end: 680 },
  { label: 'Control Center', start: 680, end: 1060 },
  { label: 'Choreography', start: 1060, end: 1440 },
  { label: 'Safety & CI', start: 1440, end: 1800 },
];

const SceneOverview: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const opacity = fadeWindow(frame, 0, 320, 14);
  const s1 = enterSpring(frame, 4, fps);
  const s2 = enterSpring(frame, 20, fps);
  const s3 = enterSpring(frame, 36, fps);

  const modules = [
    { name: 'niri-notch-rs', tag: 'RUST + GTK3', color: PALETTE.purple, soft: PALETTE.purpleSoft },
    { name: 'mako & playerctl Bridge', tag: 'LAYER-SHELL', color: PALETTE.navy, soft: PALETTE.blueSoft },
    { name: 'niri-hermes-control-center', tag: 'WOFI + BASH', color: PALETTE.teal, soft: PALETTE.greenSoft },
    { name: 'Hermes & Codex Actions', tag: 'AI WORKFLOW', color: PALETTE.orange, soft: PALETTE.amberSoft },
  ];

  return (
    <div style={{ position: 'absolute', inset: '26px 40px 22px', opacity, display: 'grid', gridTemplateColumns: '1.16fr 0.84fr', gap: 28, alignItems: 'center' }}>
      <div style={{ transform: `translateY(${(1 - s1) * 18}px)` }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999, ...GLASS_CARD_STYLE, fontFamily: FONT_MONO, fontSize: 13, fontWeight: 600, color: PALETTE.purple, marginBottom: 18 }}>
          <span>WAYLAND · NIRI COMPOSITOR</span>
          <span style={{ color: PALETTE.border }}>·</span>
          <span>COMPANION SUITE</span>
        </div>

        <h1 style={{ margin: 0, fontSize: 44, lineHeight: 1.08, fontWeight: 800, letterSpacing: '-0.035em', color: PALETTE.ink }}>
          Niri Notch &amp; Hermes Control Center
        </h1>
        <p style={{ margin: '14px 0 0', fontSize: 19.5, lineHeight: 1.44, fontWeight: 500, color: PALETTE.muted }}>
          Two paired Wayland companions: an animated Rust Dynamic Island notch daemon integrated directly with a Wofi + Hermes Agent keyboard palette.
        </p>

        <div style={{ marginTop: 26, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, opacity: s2, transform: `translateY(${(1 - s2) * 14}px)` }}>
          {[
            { value: '2', label: 'Paired Repos', sub: 'Notch + Control Center' },
            { value: 'Spring', label: 'Layer-Shell UI', sub: 'GTK3 companion daemon' },
            { value: 'ALT+SPC', label: 'Wofi Palette', sub: 'Niri · AI · System · App' },
          ].map((stat) => (
            <div key={stat.label} style={{ ...GLASS_CARD_STYLE, borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 28, fontWeight: 800, color: PALETTE.purple, letterSpacing: '-0.03em' }}>{stat.value}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: PALETTE.ink, marginTop: 4 }}>{stat.label}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted, marginTop: 3 }}>{stat.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...GLASS_CARD_STYLE, borderRadius: 20, padding: '22px 24px', opacity: s3, transform: `translateY(${(1 - s3) * 18}px)`, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.purple, letterSpacing: '0.06em' }}>STACK OVERVIEW</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted }}>CachyOS · Niri</span>
        </div>

        {modules.map((item, idx) => {
          const itemIn = enterSpring(frame, 42 + idx * 12, fps);
          return (
            <div key={item.name} style={{ padding: '13px 16px', borderRadius: 13, backgroundColor: '#FFFFFF', border: `1px solid ${PALETTE.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: itemIn, transform: `translateX(${(1 - itemIn) * 14}px)` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: item.color }}>0{idx + 1}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: PALETTE.ink }}>{item.name}</span>
              </div>
              <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, padding: '4px 9px', borderRadius: 999, backgroundColor: item.soft, color: item.color }}>{item.tag}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SceneNotchDaemon: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 320;
  const opacity = fadeWindow(frame, 320, 680, 14);
  const head = enterSpring(local, 4, fps);
  const expanded = local > 100 && local < 270;
  const expandSpring = enterSpring(local, 100, fps);
  const islandW = expanded ? interpolate(expandSpring, [0, 1], [270, 490]) : 270;
  const islandH = expanded ? interpolate(expandSpring, [0, 1], [42, 92]) : 42;

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', opacity, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.purple, letterSpacing: '0.07em' }}>
          02 · NIRI-NOTCH-RS COMPANION DAEMON
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Out-of-Process Dynamic Island Over Waybar Companion Rails
        </h2>
      </div>

      <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>
        <div style={{ position: 'relative', height: 132, borderRadius: 14, backgroundColor: '#111622', padding: '14px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ padding: '7px 14px', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', color: '#CBD5E1', fontFamily: FONT_MONO, fontSize: 12 }}>
            Waybar Left · WS 1 [2] 3 · niri
          </div>

          <div
            style={{
              width: islandW,
              height: islandH,
              borderRadius: 22,
              backgroundColor: '#090D16',
              border: '1.5px solid rgba(139,92,246,0.65)',
              boxShadow: '0 10px 26px rgba(0,0,0,0.45)',
              padding: '10px 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              color: '#F8FAFC',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: FONT_MONO, fontSize: 12.5 }}>
              <span style={{ color: '#A78BFA', fontWeight: 700 }}>{expanded ? '● mako intercepted' : '● WS 2 · Rio Terminal'}</span>
              <span style={{ color: '#94A3B8' }}>{expanded ? 'auto-dismiss dup' : 'playerctl'}</span>
            </div>
            {expanded && (
              <div style={{ marginTop: 8, fontSize: 13.5, color: '#E2E8F0' }}>
                Hermes Task Done — Build &amp; clippy green on niri-notch-rs
              </div>
            )}
          </div>

          <div style={{ padding: '7px 14px', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', color: '#CBD5E1', fontFamily: FONT_MONO, fontSize: 12 }}>
            Waybar Right · CPU · Vol · 23:55
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
          {[
            { file: 'src/core.rs', title: 'Pure Reducer (Zero I/O)', desc: 'reduce(AppState, AppEvent) -> (AppState, Vec<Effect>)' },
            { file: 'src/install.rs', title: 'Managed KDL Blocks', desc: 'Idempotent ~/.config/niri/config.kdl updates with backup' },
            { file: 'src/main.rs', title: 'GTK3 Layer-Shell Shell', desc: 'Renders damped spring island + mako/playerctl effects' },
          ].map((col) => (
            <div key={col.file} style={{ padding: '14px 16px', borderRadius: 14, backgroundColor: '#FFFFFF', border: `1px solid ${PALETTE.border}` }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: PALETTE.purple }}>{col.file}</div>
              <div style={{ fontSize: 15.5, fontWeight: 700, color: PALETTE.ink, marginTop: 4 }}>{col.title}</div>
              <div style={{ fontSize: 13, color: PALETTE.muted, marginTop: 4 }}>{col.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SceneControlCenter: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 680;
  const opacity = fadeWindow(frame, 680, 1060, 14);
  const head = enterSpring(local, 4, fps);
  const activeIdx = Math.floor((local / 60) % 5);

  const actions = [
    { ns: 'Niri ·', label: 'Focus floating / tiling & workspace HUD', tag: 'MOD+I' },
    { ns: 'Wayland ·', label: 'Wallpaper fade transition via awww', tag: 'MOD+CTRL+W' },
    { ns: 'AI ·', label: 'Hermes TUI chat (PTY) · one-shot -q · codex exec', tag: 'HERMES' },
    { ns: 'System ·', label: 'Confirmation-gated logout / suspend / reboot', tag: 'MOD+ALT+P' },
    { ns: 'App ·', label: 'Spotlight fallback → wofi --show drun --search', tag: 'AUTO/KO/EN' },
  ];

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', opacity, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.teal, letterSpacing: '0.07em' }}>
          03 · NIRI-HERMES-CONTROL-CENTER (ALT+SPACE)
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Hackable Wofi + Bash Command Palette with Hermes Agent Integration
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 18, flex: 1 }}>
        <div style={{ borderRadius: 18, backgroundColor: '#0E1722', border: '1.5px solid rgba(20,184,166,0.45)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ padding: '9px 14px', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', color: '#99F6E4', fontFamily: FONT_MONO, fontSize: 13 }}>
            ⌘ ALT+SPACE · Search Niri, Hermes AI, or any desktop app…
          </div>

          {actions.map((act, idx) => {
            const focused = idx === activeIdx;
            return (
              <div
                key={act.ns}
                style={{
                  padding: '10px 14px',
                  borderRadius: 11,
                  backgroundColor: focused ? 'rgba(20,184,166,0.22)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${focused ? '#2DD4BF' : 'rgba(255,255,255,0.08)'}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 14, color: '#F1F5F9' }}>
                  <span style={{ fontFamily: FONT_MONO, color: '#2DD4BF', fontWeight: 700 }}>{act.ns}</span> {act.label}
                </div>
                <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: '#CBD5E1', flexShrink: 0 }}>{act.tag}</span>
              </div>
            );
          })}
        </div>

        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: PALETTE.teal }}>
            PTY vs. ONE-SHOT AGENT SPLIT
          </div>
          {[
            { t: 'Interactive TUI', d: 'Opens hermes --tui chat inside Rio / Alacritty real PTY.' },
            { t: 'Wofi One-Shot Prompt', d: 'Runs hermes chat -q directly without spawning a TUI.' },
            { t: 'Window Context Forward', d: 'Sends focused Niri window state straight into Hermes.' },
            { t: 'Completion Alerts', d: 'Emits Niri/mako notifications when Codex or Hermes finishes.' },
          ].map((item) => (
            <div key={item.t} style={{ padding: '10px 12px', borderRadius: 11, backgroundColor: '#FFFFFF', border: `1px solid ${PALETTE.border}` }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: PALETTE.ink }}>{item.t}</div>
              <div style={{ fontSize: 13, color: PALETTE.muted, marginTop: 2 }}>{item.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SceneChoreography: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 1060;
  const opacity = fadeWindow(frame, 1060, 1440, 14);
  const head = enterSpring(local, 4, fps);

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', opacity, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.navy, letterSpacing: '0.07em' }}>
          04 · POINTER &amp; KEYBOARD CHOREOGRAPHY
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Notch Right-Click Bridges Directly Into the Control Center
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, flex: 1 }}>
        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: PALETTE.purple }}>NOTCH POINTER ACTIONS</div>
          {[
            ['Hover', 'Spring-expand live status & notification card'],
            ['Left Click', 'Clear active notification or toggle playerctl'],
            ['Right Click', 'Launch Niri Hermes Control Center immediately'],
            ['Mouse Wheel', 'Scroll up / down to switch Niri workspaces'],
          ].map(([k, v]) => (
            <div key={k} style={{ padding: '11px 14px', borderRadius: 12, backgroundColor: '#FFFFFF', border: `1px solid ${PALETTE.border}`, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 13, fontWeight: 800, color: PALETTE.purple }}>{k}</span>
              <span style={{ fontSize: 13.5, color: PALETTE.ink, textAlign: 'right' }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: PALETTE.teal }}>KEYBOARD BINDINGS</div>
          {[
            ['ALT + SPACE', 'Open Wofi Control Center + Spotlight search'],
            ['MOD + SHIFT + ENTER', 'Toggle dedicated floating scratch terminal'],
            ['MOD + I', 'Display Focused-Window HUD overlay'],
            ['MOD + GRAVE / T', 'Switch or move windows between float & tile'],
          ].map(([k, v]) => (
            <div key={k} style={{ padding: '11px 14px', borderRadius: 12, backgroundColor: '#FFFFFF', border: `1px solid ${PALETTE.border}`, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 800, color: PALETTE.teal }}>{k}</span>
              <span style={{ fontSize: 13.5, color: PALETTE.ink, textAlign: 'right' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SceneSafety: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 1440;
  const opacity = fadeWindow(frame, 1440, 1800, 14);
  const head = enterSpring(local, 4, fps);

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', opacity, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.green, letterSpacing: '0.07em' }}>
          05 · SAFE INSTALLERS &amp; CI QUALITY GATES
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Auditable Configs, Dry-Run Installs, and Zero Stored Secrets
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: PALETTE.purple }}>NIRI-NOTCH-RS CLI &amp; CI</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: PALETTE.ink }}>• niri-notch-rs doctor --json</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: PALETTE.ink }}>• niri-notch-rs install --user --dry-run</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: PALETTE.ink }}>• cargo test --locked &amp; clippy -D warnings</div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 13, color: PALETTE.ink }}>• RUSTDOCFLAGS="-D warnings" cargo doc</div>
        </div>

        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: PALETTE.teal }}>CONTROL CENTER SAFETY</div>
          <div style={{ fontSize: 14.5, color: PALETTE.ink }}>• Plain Bash scripts copied to ~/.local/bin</div>
          <div style={{ fontSize: 14.5, color: PALETTE.ink }}>• Never auto-mutates ~/.config/niri/config.kdl</div>
          <div style={{ fontSize: 14.5, color: PALETTE.ink }}>• Confirmation dialog on logout / reboot / shutdown</div>
          <div style={{ fontSize: 14.5, color: PALETTE.ink }}>• Zero API keys or secrets stored in scripts</div>
        </div>
      </div>

      <div style={{ ...GLASS_CARD_STYLE, borderRadius: 14, padding: '12px 18px', display: 'flex', justifyContent: 'space-between', fontFamily: FONT_MONO, fontSize: 12.5 }}>
        <span style={{ color: PALETTE.purple, fontWeight: 700 }}>mud-the-developer/niri-notch-rs</span>
        <span style={{ color: PALETTE.teal, fontWeight: 700 }}>mud-the-developer/niri-hermes-control-center</span>
      </div>
    </div>
  );
};

export const NiriDesktopSuiteDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <FrameChrome
      badge="NIRI SUITE"
      title="Niri Wayland Companion Notch & Hermes Control Center"
      chapters={CHAPTERS}
      frame={frame}
      durationInFrames={NIRI_SUITE_DURATION}
      accentColor={PALETTE.purple}
      footerLabel="niri-notch-rs + niri-hermes-control-center · Wayland / Niri"
    >
      {frame < 320 && <SceneOverview frame={frame} fps={fps} />}
      {frame >= 306 && frame < 680 && <SceneNotchDaemon frame={frame} fps={fps} />}
      {frame >= 666 && frame < 1060 && <SceneControlCenter frame={frame} fps={fps} />}
      {frame >= 1046 && frame < 1440 && <SceneChoreography frame={frame} fps={fps} />}
      {frame >= 1426 && <SceneSafety frame={frame} fps={fps} />}
    </FrameChrome>
  );
};
