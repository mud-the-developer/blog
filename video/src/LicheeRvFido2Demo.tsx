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
  TerminalWindow,
} from './theme';

export const LICHEERV_FIDO2_DURATION = 1800; // 60s @ 30fps

const CHAPTERS: Chapter[] = [
  { label: 'Overview', start: 0, end: 320 },
  { label: 'USB HID Stack', start: 320, end: 680 },
  { label: 'Physical Tests', start: 680, end: 1060 },
  { label: 'SD Vault CLI', start: 1060, end: 1440 },
  { label: 'Threat Scope', start: 1440, end: 1800 },
];

const SceneOverview: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const motion = sceneStyle(frame, 0, 320);
  const s1 = enterSpring(frame, 4, fps);
  const s2 = enterSpring(frame, 18, fps);
  const s3 = enterSpring(frame, 34, fps);

  const items = [
    { name: 'Linux USB HID Gadget', tag: '/dev/hidg0', color: PALETTE.teal, soft: PALETTE.greenSoft },
    { name: 'Go CTAPHID + CTAP2', tag: 'FIDO2', color: PALETTE.navy, soft: PALETTE.blueSoft },
    { name: 'On-Board USER Button', tag: 'PHYSICAL UP', color: PALETTE.orange, soft: PALETTE.amberSoft },
    { name: 'Encrypted SD Vault', tag: 'RAM PASSPHRASE', color: PALETTE.purple, soft: PALETTE.purpleSoft },
  ];

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', ...motion, display: 'grid', gridTemplateColumns: '1.16fr 0.84fr', gap: 28, alignItems: 'center' }}>
      <div style={{ transform: `translateY(${(1 - s1) * 18}px)` }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999, ...GLASS_CARD_STYLE, fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 600, color: PALETTE.teal, marginBottom: 16 }}>
          <span>EMBEDDED SECURITY EXPERIMENT</span>
          <span style={{ color: PALETTE.border }}>·</span>
          <span>GO + RISC-V SG2002</span>
        </div>

        <h1 style={{ margin: 0, fontSize: 46, lineHeight: 1.08, fontWeight: 800, letterSpacing: '-0.036em', color: PALETTE.ink }}>
          LicheeRV Nano FIDO2
        </h1>
        <p style={{ margin: '14px 0 0', fontSize: 19.5, lineHeight: 1.46, fontWeight: 500, color: PALETTE.muted }}>
          Experimental Go USB FIDO2/CTAP2 authenticator running on Buildroot Linux 5.10 with physical USER-button approval and explicit security boundaries.
        </p>

        <div style={{ marginTop: 26, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, opacity: s2, transform: `translateY(${(1 - s2) * 14}px)` }}>
          {[
            { value: 'C906', label: 'RISC-V Core', sub: 'SG2002 Buildroot' },
            { value: '6 / 6', label: 'USB Tests Pass', sub: 'Real physical host' },
            { value: '1 → 2', label: 'Counter Persist', sub: 'Across restart' },
          ].map((stat) => (
            <div key={stat.label} style={{ ...GLASS_CARD_STYLE, borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 28, fontWeight: 800, color: PALETTE.teal, letterSpacing: '-0.03em' }}>{stat.value}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: PALETTE.ink, marginTop: 4 }}>{stat.label}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted, marginTop: 3 }}>{stat.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...GLASS_CARD_STYLE, borderRadius: 20, padding: '22px 24px', opacity: s3, transform: `translateY(${(1 - s3) * 18}px)`, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.teal, letterSpacing: '0.06em' }}>HARDWARE &amp; PROTOCOL STACK</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted }}>Go · USB HID</span>
        </div>

        {items.map((item, idx) => {
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

const SceneUsbStack: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = Math.max(0, frame - 320);
  const motion = sceneStyle(frame, 320, 680);
  const head = enterSpring(local, 4, fps);
  const packetStep = Math.floor((local / 60) % 5);
  const packets = ['CTAPHID INIT', 'CTAPHID PING', 'CTAP2 GetInfo', 'MakeCredential + USER', 'GetAssertion (cnt++)'];
  const pulseF = interpolate(local % 60, [0, 59], [0, 1]);
  const pulseR = interpolate((local + 30) % 60, [0, 59], [1, 0]);
  const userPressRing = packetStep >= 3 ? interpolate(local % 30, [0, 29], [10, 24]) : 0;

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', ...motion, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.navy, letterSpacing: '0.07em' }}>
          02 · RISC-V USB HID GADGET ARCHITECTURE
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 31, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Host WebAuthn Requests Bridged to On-Board GPIO &amp; Vault
        </h2>
      </div>

      <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 24px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.teal }}>BIDIRECTIONAL CTAPHID / CTAP2 EXCHANGE</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, padding: '4px 12px', borderRadius: 999, backgroundColor: PALETTE.blueSoft, color: PALETTE.navy }}>
            {packets[packetStep]}
          </span>
        </div>

        <svg viewBox="0 0 1120 225" style={{ width: '100%', height: 225 }}>
          {[
            { x: 14, w: 230, title: 'Host OS / Browser', sub: 'WebAuthn / FIDO2 Client', color: PALETTE.navy },
            { x: 298, w: 230, title: 'Linux USB HID Gadget', sub: 'ConfigFS · /dev/hidg0', color: PALETTE.blue },
            { x: 582, w: 230, title: 'Go FIDO2 Daemon', sub: 'CTAPHID · PIN v1 · CBOR', color: PALETTE.teal },
            { x: 866, w: 240, title: 'USER Button + SD Vault', sub: 'Physical UP · Encrypted DB', color: PALETTE.purple },
          ].map((node, i) => (
            <g key={node.title}>
              <rect x={node.x} y={42} width={node.w} height={124} rx={16} fill="#FFFFFF" stroke={node.color} strokeWidth={2.2} />
              <text x={node.x + 18} y={84} fontSize={16.5} fontWeight={800} fill={PALETTE.ink}>{node.title}</text>
              <text x={node.x + 18} y={114} fontSize={12.5} fontFamily={FONT_MONO} fill={PALETTE.muted}>{node.sub}</text>
              {i === 3 && userPressRing > 0 && (
                <g transform={`translate(${node.x + 206}, 136)`}>
                  <circle cx={0} cy={0} r={userPressRing} fill="none" stroke={PALETTE.orange} strokeWidth={2} opacity={0.45} />
                  <circle cx={0} cy={0} r={9} fill={PALETTE.orange} />
                </g>
              )}
            </g>
          ))}

          {[244, 528, 812].map((x) => (
            <g key={x}>
              <line x1={x} y1={88} x2={x + 54} y2={88} stroke={PALETTE.border} strokeWidth={2.5} />
              <circle cx={x + pulseF * 54} cy={88} r={5.5} fill={PALETTE.blue} />
              <line x1={x} y1={118} x2={x + 54} y2={118} stroke={PALETTE.border} strokeWidth={2.5} strokeDasharray="4 4" />
              <circle cx={x + pulseR * 54} cy={118} r={5.5} fill={PALETTE.teal} />
            </g>
          ))}
          <text x={271} y={76} textAnchor="middle" fontFamily={FONT_MONO} fontSize={9.5} fill={PALETTE.blue}>REQ →</text>
          <text x={271} y={136} textAnchor="middle" fontFamily={FONT_MONO} fontSize={9.5} fill={PALETTE.teal}>← SIG</text>
        </svg>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, fontFamily: FONT_MONO, fontSize: 12 }}>
          <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: '#FFFFFF', border: `1px solid ${PALETTE.border}`, color: PALETTE.ink }}>
            Board: <strong>LicheeRV Nano (SG2002)</strong>
          </div>
          <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: '#FFFFFF', border: `1px solid ${PALETTE.border}`, color: PALETTE.ink }}>
            Kernel: <strong>Buildroot Linux 5.10</strong>
          </div>
          <div style={{ padding: '10px 14px', borderRadius: 10, backgroundColor: '#FFFFFF', border: `1px solid ${PALETTE.border}`, color: PALETTE.ink }}>
            Approval: <strong>Physical GPIO USER Key</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

const ScenePhysicalTests: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = Math.max(0, frame - 680);
  const motion = sceneStyle(frame, 680, 1060);
  const head = enterSpring(local, 4, fps);

  const rows = [
    ['CTAPHID INIT, PING & Canonical GetInfo', 'Physical USB'],
    ['PIN Protocol 1 & Incorrect-PIN Rejection', 'Verified'],
    ['Credential Registration & Authentication', 'Physical USB'],
    ['Independent RP / UP / UV & Packed Attestation', 'Signature Verified'],
    ['Process Restart & SD Vault Persistence', 'Counter 1 → 2'],
    ['On-Board Physical USER Button Approval', 'Reg + Auth + Restart'],
  ];

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', ...motion, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.green, letterSpacing: '0.07em' }}>
          03 · VERIFIED PHYSICAL USB CAPABILITIES
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 31, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Tested End-to-End Over Real Hardware USB
        </h2>
      </div>

      <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '18px 22px', display: 'grid', gap: 10, flex: 1 }}>
        {rows.map(([area, detail], idx) => {
          const itemIn = enterSpring(local, 8 + idx * 13, fps);
          return (
            <div key={area} style={{ padding: '11px 16px', borderRadius: 12, backgroundColor: '#FFFFFF', border: `1px solid ${PALETTE.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: itemIn, transform: `translateX(${(1 - itemIn) * 16}px)` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: PALETTE.teal }}>0{idx + 1}</span>
                <span style={{ fontSize: 15.5, fontWeight: 700, color: PALETTE.ink }}>{area}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: PALETTE.muted }}>{detail}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 999, backgroundColor: PALETTE.greenSoft, color: PALETTE.green }}>
                  PASSED
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SceneVaultCli: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = Math.max(0, frame - 1060);
  const motion = sceneStyle(frame, 1060, 1440);
  const head = enterSpring(local, 4, fps);

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', ...motion, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.purple, letterSpacing: '0.07em' }}>
          04 · INTERACTIVE PROVISIONING CONSOLE
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 31, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Out-of-Band SSH Vault Unlock Without Heavy TUI Dependencies
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.16fr 0.84fr', gap: 20, flex: 1 }}>
        <TerminalWindow
          title="ssh root@nano-host — /opt/nano-fido/configure.sh"
          badge="RAM-ONLY"
          command="ssh -t root@nano-host /opt/nano-fido/configure.sh"
          localFrame={local}
          accentColor="#5EEAD4"
          lines={[
            { text: '[nano-fido] Vault status: LOCKED (encrypted SD image)', color: '#93C5FD' },
            { text: '[nano-fido] Select: 1) Provision  2) Unlock  3) Lock  -> 2', color: '#E2E8F0' },
            { text: '[nano-fido] Passphrase: •••••••••••••••• (held in volatile RAM only)', color: '#C4B5FD', highlight: true },
            { text: '✓ Decrypted credential vault · monotonic signature counter ready', color: '#86EFAC' },
            { text: '✓ USB HID gadget /dev/hidg0 active · waiting for GPIO USER press', color: '#86EFAC' },
            { text: 'Fallback verified: TERM=dumb & NO_COLOR=1 plain console', color: '#FDE68A' },
          ]}
          footer="Out-of-Band Management Session"
        />

        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.purple }}>MEMORY vs. STORAGE BOUNDARY</div>
          {[
            { t: 'RAM-Only Passphrases', d: 'Volatile in memory during unlock; never persisted to SD card.', badge: 'VOLATILE', color: PALETTE.purple, soft: PALETTE.purpleSoft },
            { t: 'Encrypted SD Vault', d: 'Credentials and monotonic counters survive lock and reboot cycles.', badge: 'PERSISTENT', color: PALETTE.teal, soft: PALETTE.greenSoft },
            { t: 'Plain Terminal Fallback', d: 'Works cleanly over minimal SSH or serial console without ncurses.', badge: 'NO_COLOR', color: PALETTE.navy, soft: PALETTE.blueSoft },
          ].map((item) => (
            <div key={item.t} style={{ padding: '12px 14px', borderRadius: 12, backgroundColor: '#FFFFFF', border: `1px solid ${PALETTE.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14.5, fontWeight: 700, color: PALETTE.ink }}>{item.t}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, backgroundColor: item.soft, color: item.color }}>{item.badge}</span>
              </div>
              <div style={{ fontSize: 13, color: PALETTE.muted, marginTop: 4 }}>{item.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SceneThreatScope: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = Math.max(0, frame - 1440);
  const motion = sceneStyle(frame, 1440, 1800, true);
  const head = enterSpring(local, 4, fps);

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', ...motion, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.red, letterSpacing: '0.07em' }}>
          05 · EXPLICIT SECURITY BOUNDARIES
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 33, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Transparent Research Scope — Zero Overclaimed Hardware Trust
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: PALETTE.green }}>VERIFIED ENGINEERING SCOPE</div>
          {[
            'Physical USB CTAPHID + CTAP2 protocol flow',
            'On-board USER button presence enforcement',
            'Encrypted SD vault & signature counter persistence',
            'Reproducible checked nano/ bundle deployment',
          ].map((t) => (
            <div key={t} style={{ fontSize: 15, fontWeight: 600, color: PALETTE.ink }}>✓ {t}</div>
          ))}
        </div>

        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: PALETTE.red }}>DOCUMENTED LIMITATIONS</div>
          {[
            'Not a FIDO-certified commercial security key',
            'Linux host OS sits outside tamper-resistance boundary',
            'Remaining test scope: CANCEL & concurrent channels',
            'Power-loss resilience & independent audit pending',
          ].map((t) => (
            <div key={t} style={{ fontSize: 15, fontWeight: 600, color: PALETTE.ink }}>! {t}</div>
          ))}
        </div>
      </div>

      <div style={{ ...GLASS_CARD_STYLE, borderRadius: 14, padding: '12px 18px', display: 'flex', justifyContent: 'space-between', fontFamily: FONT_MONO, fontSize: 13 }}>
        <span style={{ color: PALETTE.teal, fontWeight: 700 }}>github.com/mud-the-developer/licheerv-nano-fido2</span>
        <span style={{ color: PALETTE.muted }}>RISC-V SG2002 · Go · CTAP2</span>
      </div>
    </div>
  );
};

export const LicheeRvFido2Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <FrameChrome
      badge="FIDO2 · RISC-V"
      title="LicheeRV Nano Experimental USB FIDO2/CTAP2 Authenticator"
      chapters={CHAPTERS}
      frame={frame}
      durationInFrames={LICHEERV_FIDO2_DURATION}
      accentColor={PALETTE.teal}
      footerLabel="licheerv-nano-fido2 · Go + RISC-V + Linux USB HID Gadget"
    >
      {frame < 334 && <SceneOverview frame={frame} fps={fps} />}
      {frame >= 306 && frame < 694 && <SceneUsbStack frame={frame} fps={fps} />}
      {frame >= 666 && frame < 1074 && <ScenePhysicalTests frame={frame} fps={fps} />}
      {frame >= 1046 && frame < 1454 && <SceneVaultCli frame={frame} fps={fps} />}
      {frame >= 1426 && <SceneThreatScope frame={frame} fps={fps} />}
    </FrameChrome>
  );
};
