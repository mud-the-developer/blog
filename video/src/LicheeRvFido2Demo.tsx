import React from 'react';
import { useCurrentFrame } from 'remotion';
import { DemoStage, FONT_MONO, PALETTE, phase } from './theme';

export const LICHEERV_FIDO2_DURATION = 252;

const pins = Array.from({ length: 16 }, (_, i) => 553 + i * 39);
const traces = [
  'M528 343h69l46-46h79l22 22h38', 'M528 351h73l46-46h70l22 22h43',
  'M528 380h73l44 44h78l19-19h40', 'M528 388h68l44 44h87l19-19h36',
  'M855 294v-29l29-29h89', 'M863 294v-25l26-25h84',
  'M938 323h35l29-29h72', 'M938 331h39l29-29h68',
  'M935 387h62l41 41h46', 'M935 395h58l41 41h50',
  'M844 437v27l24 24h104', 'M852 437v23l20 20h100',
];

const Board: React.FC<{ press: number }> = ({ press }) => (
  <g>
    <defs>
      <linearGradient id="nano-pcb" x2=".7" y2="1">
        <stop stopColor="#354346" /><stop offset="1" stopColor="#182326" />
      </linearGradient>
      <linearGradient id="nano-shell" x2=".12" y2="1">
        <stop stopColor="#8d999b" /><stop offset=".19" stopColor="#edf0ed" />
        <stop offset=".67" stopColor="#b9c1bf" /><stop offset="1" stopColor="#768285" />
      </linearGradient>
    </defs>
    <rect x="492" y="172" width="728" height="387" rx="19" fill="#121b1c" />
    <rect x="492" y="162" width="728" height="387" rx="19" fill="url(#nano-pcb)" stroke="#566663" strokeWidth="3" />
    {pins.map(x => (
      <g key={x} fill="#151e21" stroke="#c2a86e" strokeWidth="5">
        <circle cx={x} cy="183" r="7.5" /><circle cx={x} cy="527" r="7.5" />
      </g>
    ))}
    <g fill="none" stroke="#77877d" strokeWidth="2.4" opacity=".72">
      {traces.map(d => <path key={d} d={d} />)}
    </g>
    <text x="545" y="254" fill="#eff1de" fontSize="36" fontWeight="650" letterSpacing="-1">LicheeRV Nano</text>
    <rect x="523" y="299" width="47" height="109" rx="3" fill="#11191b" />
    <rect x="481" y="306" width="71" height="106" rx="7" fill="url(#nano-shell)" stroke="#e2e4d9" strokeWidth="2" />
    <path d="M496 315v87 M539 315v15m0 58v15" stroke="#637073" strokeWidth="4" />

    <rect x="781" y="286" width="163" height="163" rx="9" fill="#101819" stroke="#8a938e" strokeWidth="2" />
    <rect x="791" y="296" width="143" height="143" rx="4" fill="#343c3d" />
    <circle cx="806" cy="311" r="4" fill="#9faaa4" />
    <text x="862" y="378" textAnchor="middle" fontFamily={FONT_MONO} fontSize="30" fontWeight="550" fill="#e4e9df">SG2002</text>
    <g fill="#b5b8a9" stroke="#313534" strokeWidth="3">
      <path d="M652 336h32v13h-32z M652 357h32v13h-32z M652 378h32v13h-32z" />
      <path d="M986 350h22v11h-22z M1019 350h22v11h-22z" />
      <rect x="1017" y="250" width="59" height="25" rx="7" />
    </g>
    <g strokeWidth="3">
      <rect x="1084" y="383" width="79" height="82" rx="8" fill="url(#nano-shell)" stroke="#0e191d" />
      <circle cx="1124" cy="426" r="25" fill="#202526" stroke="#757c76" />
      <circle cx="1124" cy={419 + 6 * press} r={24 - 2 * press} fill="#444b4a" stroke="#b3bab2" />
    </g>
    <text x="1123" y="369" textAnchor="middle" fill="#f0f0df" fontFamily={FONT_MONO} fontSize="32" fontWeight="650">USER</text>
  </g>
);

export const LicheeRvFido2Demo: React.FC = () => {
  const frame = useCurrentFrame();
  const inbound = phase(frame, -4, 50);
  const touch = phase(frame, 103, 112) * (1 - phase(frame, 131, 143));
  const hand = phase(frame, 57, 105) * (1 - phase(frame, 137, 180));
  const outbound = phase(frame, 139, 201);
  const received = frame >= 201;
  const waiting = frame >= 50 && frame < 139;
  const travel = frame < 50 || (frame >= 139 && !received);
  const packetX = frame < 50 ? 245 + 240 * inbound : 485 - 240 * outbound;
  const packetColor = frame < 50 ? PALETTE.blue : PALETTE.teal;

  return (
    <DemoStage>
      <path d="M235 359H504" fill="none" stroke="#323b40" strokeWidth="29" />
      <path d="M235 353H504" fill="none" stroke="#687174" strokeWidth="3" />
      <rect x="426" y="326" width="63" height="67" rx="9" fill="#404a4e" stroke="#243034" strokeWidth="3" />
      <path d="M439 333v52 M448 333v52" fill="none" stroke="#778083" strokeWidth="3" />
      {travel && (
        <g transform={`translate(${packetX} 359) scale(${frame < 50 ? 1 : -1} 1)`}>
          <circle r="17" fill={PALETTE.card} stroke={packetColor} strokeWidth="3" />
          <path d="M-6 0H7 M1-6 7 0 1 6" fill="none" stroke={packetColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}

      <rect x="-100" y="173" width="354" height="370" rx="19" fill={PALETTE.cardSoft} stroke={PALETTE.border} strokeWidth="3" />
      <rect x="-100" y="187" width="340" height="342" rx="10" fill={PALETTE.card} />
      <g transform="translate(29 208)">
        <path d="M4 17V9a9 9 0 0 1 18 0v8 M0 16h26v19H0z" fill="none" stroke={PALETTE.muted} strokeWidth="3" strokeLinejoin="round" />
        <text x="41" y="29" fontSize="29" fill={PALETTE.muted}>Browser</text>
      </g>
      <path d="M0 264H240" stroke={PALETTE.border} strokeWidth="2" />
      <g transform="translate(28 300)" fill={received ? PALETTE.teal : PALETTE.ink}>
        <text y="43" fontSize="39" fontWeight="650">{received ? 'Signed' : 'WebAuthn'}</text>
        <text y="91" fontSize="39" fontWeight="650">{received ? 'response' : 'request'}</text>
        {received ? (
          <path d="m4 154 12 12 28-32" fill="none" stroke={PALETTE.teal} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        ) : <text y="158" fontSize="30" fill={PALETTE.muted}>{waiting ? 'Touch key…' : 'Pending…'}</text>}
      </g>

      <Board press={touch} />
      {frame >= 50 && frame < 112 && (
        <circle cx="1124" cy="421" r={38 + 5 * Math.sin((frame - 50) / 8)} fill="none" stroke="#e7cd80" strokeWidth="3" />
      )}
      <g transform={`translate(${1124 + 253 * (1 - hand)} ${417 + 377 * (1 - hand) + 7 * touch}) rotate(-27)`}>
        <path d="M-32 371v-123c0-43 4-89 4-136L-28 38C-28 13-18-1 0-1s30 14 31 37l6 87 15 65c10 23 29 44 42 71l48 112z" fill="#d6aa8d" stroke="#684d42" strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M-18 43c-2-18 1-28 15-30 13-2 21 7 22 26l1 24c-12 6-26 6-37 1z" fill="#edd0b7" stroke="#95705e" strokeWidth="2.5" />
        <path d="M-18 112q15-5 31 0m-27 6q13-4 22-1" fill="none" stroke="#a7806b" strokeWidth="2" strokeLinecap="round" />
      </g>
    </DemoStage>
  );
};
