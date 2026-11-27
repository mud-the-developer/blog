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

export const LICHEERV_FIDO2_DURATION = 1800; // 60s @ 30fps

const CHAPTERS: Chapter[] = [
  { label: 'Overview', start: 0, end: 320 },
  { label: 'USB HID Stack', start: 320, end: 680 },
  { label: 'Physical Tests', start: 680, end: 1060 },
  { label: 'SD Vault CLI', start: 1060, end: 1440 },
  { label: 'Threat Scope', start: 1440, end: 1800 },
];

const SceneOverview: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const opacity = fadeWindow(frame, 0, 320, 14);
  const s1 = enterSpring(frame, 4, fps);
  const s2 = enterSpring(frame, 20, fps);
  const s3 = enterSpring(frame, 36, fps);

  const items = [
    { name: 'Linux USB HID Gadget', tag: '/dev/hidg0', color: PALETTE.teal, soft: PALETTE.greenSoft },
    { name: 'Go CTAPHID + CTAP2', tag: 'FIDO2', color: PALETTE.navy, soft: PALETTE.blueSoft },
    { name: 'On-Board USER Button', tag: 'PHYSICAL UP', color: PALETTE.orange, soft: PALETTE.amberSoft },
    { name: 'Encrypted SD Vault', tag: 'RAM PASSPHRASE', color: PALETTE.purple, soft: PALETTE.purpleSoft },
  ];

  return (
    <div style={{ position: 'absolute', inset: '26px 40px 22px', opacity, display: 'grid', gridTemplateColumns: '1.16fr 0.84fr', gap: 28, alignItems: 'center' }}>
      <div style={{ transform: `translateY(${(1 - s1) * 18}px)` }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 999, ...GLASS_CARD_STYLE, fontFamily: FONT_MONO, fontSize: 13, fontWeight: 600, color: PALETTE.teal, marginBottom: 18 }}>
          <span>EMBEDDED SECURITY EXPERIMENT</span>
          <span style={{ color: PALETTE.border }}>·</span>
          <span>GO + RISC-V SG2002</span>
        </div>

        <h1 style={{ margin: 0, fontSize: 45, lineHeight: 1.08, fontWeight: 800, letterSpacing: '-0.035em', color: PALETTE.ink }}>
          LicheeRV Nano FIDO2
        </h1>
        <p style={{ margin: '14px 0 0', fontSize: 20, lineHeight: 1.44, fontWeight: 500, color: PALETTE.muted }}>
          Experimental Go USB FIDO2/CTAP2 authenticator running on Buildroot Linux 5.10 with physical USER-button approval and explicit security boundaries.
        </p>

        <div style={{ marginTop: 26, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, opacity: s2, transform: `translateY(${(1 - s2) * 14}px)` }}>
          {[
            { value: 'C906', label: 'RISC-V Core', sub: 'SG2002 Buildroot' },
            { value: '6/6', label: 'USB Tests Pass', sub: 'Real physical host' },
            { value: '1→2', label: 'Counter Persist', sub: 'Across restart' },
          ].map((stat) => (
            <div key={stat.label} style={{ ...GLASS_CARD_STYLE, borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 30, fontWeight: 800, color: PALETTE.teal, letterSpacing: '-0.03em' }}>{stat.value}</div>
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

const SceneUsbStack: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 320;
  const opacity = fadeWindow(frame, 320, 680, 14);
  const head = enterSpring(local, 4, fps);
  const packetStep = Math.floor((local / 60) % 5);
  const packets = ['CTAPHID INIT', 'CTAPHID PING', 'CTAP2 GetInfo', 'MakeCredential + USER', 'GetAssertion (cnt++)'];
  const pulseX = interpolate((local % 60), [0, 59], [0, 1]);

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', opacity, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.navy, letterSpacing: '0.07em' }}>
          02 · RISC-V USB HID GADGET ARCHITECTURE
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Host WebAuthn Requests Bridged to On-Board GPIO &amp; Vault
        </h2>
      </div>

      <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '22px 24px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.teal }}>ACTIVE FRAME EXCHANGE</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 800, padding: '4px 12px', borderRadius: 999, backgroundColor: PALETTE.blueSoft, color: PALETTE.navy }}>
            {packets[packetStep]}
          </span>
        </div>

        <svg viewBox="0 0 1120 210" style={{ width: '100%', height: 210 }}>
          {[
            { x: 14, w: 230, title: 'Host OS / Browser', sub: 'WebAuthn / FIDO2 Client', color: PALETTE.navy },
            { x: 298, w: 230, title: 'Linux USB HID Gadget', sub: 'ConfigFS · /dev/hidg0', color: PALETTE.blue },
            { x: 582, w: 230, title: 'Go FIDO2 Daemon', sub: 'CTAPHID · PIN v1 · CBOR', color: PALETTE.teal },
            { x: 866, w: 240, title: 'USER Button + SD Vault', sub: 'Physical UP · Encrypted DB', color: PALETTE.purple },
          ].map((node) => (
            <g key={node.title}>
              <rect x={node.x} y={40} width={node.w} height={116} rx={16} fill="#FFFFFF" stroke={node.color} strokeWidth={2.2} />
              <text x={node.x + 18} y={84} fontSize={17} fontWeight={800} fill={PALETTE.ink}>{node.title}</text>
              <text x={node.x + 18} y={114} fontSize={13} fontFamily={FONT_MONO} fill={PALETTE.muted}>{node.sub}</text>
            </g>
          ))}

          {[244, 528, 812].map((x, idx) => (
            <g key={x}>
              <line x1={x} y1={98} x2={x + 54} y2={98} stroke={PALETTE.border} strokeWidth={3} />
              <circle cx={x + pulseX * 54} cy={98} r={6} fill={idx === 2 ? PALETTE.purple : PALETTE.teal} />
            </g>
          ))}
        </svg>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, fontFamily: FONT_MONO, fontSize: 12.5 }}>
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
  const local = frame - 680;
  const opacity = fadeWindow(frame, 680, 1060, 14);
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
    <div style={{ position: 'absolute', inset: '24px 40px 20px', opacity, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.green, letterSpacing: '0.07em' }}>
          03 · VERIFIED PHYSICAL USB CAPABILITIES
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Tested End-to-End Over Real Hardware USB
        </h2>
      </div>

      <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '18px 22px', display: 'grid', gap: 10, flex: 1 }}>
        {rows.map(([area, detail], idx) => {
          const itemIn = enterSpring(local, 10 + idx * 14, fps);
          return (
            <div
              key={area}
              style={{
                padding: '11px 16px',
                borderRadius: 12,
                backgroundColor: '#FFFFFF',
                border: `1px solid ${PALETTE.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                opacity: itemIn,
                transform: `translateX(${(1 - itemIn) * 16}px)`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: PALETTE.teal }}>0{idx + 1}</span>
                <span style={{ fontSize: 15.5, fontWeight: 700, color: PALETTE.ink }}>{area}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: PALETTE.muted }}>{detail}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 800, padding: '3px 10px', borderRadius: 999, backgroundColor: PALETTE.greenSoft, color: PALETTE.green }}>
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
  const local = frame - 1060;
  const opacity = fadeWindow(frame, 1060, 1440, 14);
  const head = enterSpring(local, 4, fps);

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', opacity, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.purple, letterSpacing: '0.07em' }}>
          04 · INTERACTIVE PROVISIONING CONSOLE
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Out-of-Band SSH Vault Unlock Without Heavy TUI Dependencies
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 20, flex: 1 }}>
        <div style={{ borderRadius: 18, backgroundColor: '#141923', color: '#E2E8F0', padding: '22px 24px', fontFamily: FONT_MONO, fontSize: 14, lineHeight: 1.7, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 8 }}># Separate management session</div>
          <div><span style={{ color: '#5EEAD4' }}>$</span> ssh -t root@&lt;NANO_HOST&gt; /opt/nano-fido/configure.sh</div>
          <div style={{ marginTop: 12, color: '#93C5FD' }}>[nano-fido] Vault status: LOCKED (encrypted SD image)</div>
          <div>[nano-fido] Action: 1) Provision  2) Unlock  3) Lock</div>
          <div style={{ color: '#86EFAC', marginTop: 6 }}>→ Passphrase held in RAM only (never written to SD)</div>
          <div style={{ color: '#86EFAC' }}>→ USB HID gadget /dev/hidg0 active · waiting for USER key</div>
          <div style={{ color: '#FDE68A', marginTop: 8 }}>Fallback ready: TERM=dumb &amp; NO_COLOR=1</div>
        </div>

        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.purple }}>OPERATIONAL PROPERTIES</div>
          {[
            { t: 'RAM-Only Secrets', d: 'Passphrases stay volatile in memory across unlock sessions.' },
            { t: 'Persistent Encrypted Vault', d: 'Credentials and monotonic counters survive lock/stop cycles.' },
            { t: 'Zero Heavyweight TUI', d: 'Plain terminal fallback works over serial or minimal SSH.' },
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

const SceneThreatScope: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 1440;
  const opacity = fadeWindow(frame, 1440, 1800, 14);
  const head = enterSpring(local, 4, fps);

  return (
    <div style={{ position: 'absolute', inset: '24px 40px 20px', opacity, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div style={{ transform: `translateY(${(1 - head) * 14}px)` }}>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.red, letterSpacing: '0.07em' }}>
          05 · EXPLICIT SECURITY BOUNDARIES
        </div>
        <h2 style={{ margin: '4px 0 0', fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', color: PALETTE.ink }}>
          Transparent Research Boundaries — No Overclaimed Hardware Trust
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 800, color: PALETTE.green }}>VERIFIED SCOPE</div>
          {[
            'Physical USB CTAPHID + CTAP2 protocol flow',
            'On-board USER button presence enforcement',
            'Encrypted SD vault & signature counter persistence',
            'Reproducible checked nano/ bundle deployment',
          ].map((t) => (
            <div key={t} style={{ fontSize: 15, fontWeight: 600, color: PALETTE.ink }}>✓ {t}</div>
          ))}
        </div>

        <div style={{ ...GLASS_CARD_STYLE, borderRadius: 18, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
      {frame < 320 && <SceneOverview frame={frame} fps={fps} />}
      {frame >= 306 && frame < 680 && <SceneUsbStack frame={frame} fps={fps} />}
      {frame >= 666 && frame < 1060 && <ScenePhysicalTests frame={frame} fps={fps} />}
      {frame >= 1046 && frame < 1440 && <SceneVaultCli frame={frame} fps={fps} />}
      {frame >= 1426 && <SceneThreatScope frame={frame} fps={fps} />}
    </FrameChrome>
  );
};
