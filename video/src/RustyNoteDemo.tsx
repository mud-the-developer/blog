import React from 'react';
import { useCurrentFrame } from 'remotion';
import { DemoStage, PALETTE, Pointer, phase } from './theme';

export const RUSTY_NOTE_DURATION = 246;

export const RustyNoteDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const click = phase(frame, 0, 20);
  const saved = frame >= 171;
  const editing = frame >= 22 && !saved;
  const suffix = ' at noon.';
  const typed = Math.max(0, Math.min(suffix.length, Math.floor((frame - 43) / 6)));
  const dirty = typed > 0 && !saved;
  const keys = phase(frame, 143, 153) * (1 - phase(frame, 198, 211));
  const paper = 'light-dark(#fff9df, #2e2c29)';
  const rim = 'light-dark(#c6b979, #777267)';
  const rule = 'light-dark(#e4d9a7, #58554d)';
  const print = 'light-dark(#373021, #fff5d8)';
  const quiet = 'light-dark(#645a3e, #c6bda5)';

  return (
    <DemoStage>
      <g fill={print}>
        <rect x="160" y="62" width="960" height="602" rx="12" fill={PALETTE.ink} opacity=".08" />
        <rect x="160" y="52" width="960" height="602" rx="12" fill={paper} stroke={rim} strokeWidth="2" />
        <path d="M160 134H1120" stroke={rule} strokeWidth="2" />
        <g transform="translate(203 80)" stroke={quiet} strokeWidth="3" fill="none" strokeLinejoin="round">
          <path d="M4 1h19l8 8v23H4z M23 1v9h8 M10 18h15 M10 25h12" />
        </g>
        <text x="258" y="108" fontSize="34" fontWeight="550">weekend.md</text>
        <text x="1065" y="107" textAnchor="end" fontSize="31" fill={quiet}>
          {dirty ? '• Unsaved' : saved ? '✓ Saved' : ''}
        </text>

        <text x="221" y="240" fontSize="64" fontWeight="720" letterSpacing="-2">Saturday walk</text>
        {editing && <rect x="207" y="269" width="826" height="77" rx="5" fill={PALETTE.card} stroke={PALETTE.orange} strokeWidth="2.5" />}
        <text x="223" y="320" fontSize="42">
          Meet at the gate{suffix.slice(0, typed)}
          {editing && (frame < 106 || Math.floor(frame / 15) % 2 === 0) && <tspan dx="1" fill={PALETTE.orange} fontWeight="300">|</tspan>}
        </text>

        <path d="M222 378H1056" stroke={rule} strokeWidth="2" />
        <text x="222" y="437" fontSize="35" fontWeight="650">Before leaving</text>
        <g fill="none" stroke={quiet} strokeWidth="3">
          <rect x="225" y="478" width="29" height="29" rx="5" />
          <rect x="225" y="549" width="29" height="29" rx="5" />
          <path d="m230 491 7 8 13-17" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <text x="279" y="505" fontSize="38">Charge the camera</text>
        <text x="279" y="576" fontSize="38">Pack the map</text>
      </g>
      <g opacity={1 - phase(frame, 33, 46)}>
        <Pointer x={800 - 257 * click} y={364 - 54 * click} pressed={frame >= 20 && frame <= 26} />
      </g>
      <g transform={`translate(798 ${563 + 4 * (phase(frame, 166, 171) - phase(frame, 178, 184))})`} opacity={keys}>
        <rect width="222" height="65" rx="11" fill={PALETTE.ink} />
        <text x="111" y="44" textAnchor="middle" fill={PALETTE.card} fontSize="34" fontWeight="650">Ctrl + S</text>
      </g>
    </DemoStage>
  );
};
