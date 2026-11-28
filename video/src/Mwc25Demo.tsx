import React from 'react';
import { useCurrentFrame } from 'remotion';
import { DemoStage, PALETTE, phase } from './theme';

export const MWC25_DURATION = 315;

const roadY = (x: number) => 305 - x * 0.075;

function Beam({ x, target, color, opacity }: {
  x: number; target: number; color: string; opacity: number;
}) {
  const dx = target - x;
  const dy = roadY(target) - 418;
  const length = Math.hypot(dx, dy) + 67;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  return (
    <g transform={`translate(${x} 418) rotate(${angle})`} opacity={opacity}>
      <path
        d={`M0 0 Q${length * 0.55} -81 ${length - 38} -51 Q${length + 38} 0 ${length - 38} 51 Q${length * 0.55} 81 0 0Z`}
        fill={color} fillOpacity={0.24} stroke={color} strokeWidth={3}
      />
    </g>
  );
}

function Station({ x, label }: { x: number; label: string }) {
  return (
    <g transform={`translate(${x} 418)`}>
      <g fill="none" stroke={PALETTE.ink} strokeWidth={5} strokeLinejoin="round">
        <path d="M-12 -10 Q-24 0 -12 10 M12 -10 Q24 0 12 10 M0 4 L-12 42 L0 34 L12 42 Z" />
      </g>
      <circle r={6} fill={PALETTE.ink} />
      <text y={86} textAnchor="middle" fontSize={34} fontWeight={650}>{label}</text>
    </g>
  );
}

export const Mwc25DrlDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const x = 475 + 452 * phase(frame, -28, 233);
  const y = roadY(x);
  const handover = phase(frame, 117, 143);
  const prune = phase(frame, 147, 191);
  const bAim = 647 + (x - 647) * handover;
  const result = phase(frame, 186, 208);

  return (
    <DemoStage>
      <defs>
        <clipPath id="mwc25-city"><rect x={48} y={68} width={1184} height={397} rx={10} /></clipPath>
      </defs>
      <g clipPath="url(#mwc25-city)">
        <g fill={PALETTE.grid} stroke={PALETTE.border} strokeWidth={2} opacity={0.58}
          transform="rotate(-4.29 640 257)">
          <path d="M-40 62H224V215H-40Z M253 62H387V215H253Z M415 36H590V215H415Z M622 64H803V215H622Z M841 50H1032V215H841Z M1063 32H1320V215H1063Z" />
          <path d="M-38 301H161V502H-38Z M194 301H335V515H194Z M367 301H554V498H367Z M587 301H761V515H587Z M797 301H975V498H797Z M1010 301H1324V515H1010Z" />
        </g>
        <path d={`M48 ${roadY(48)} L1232 ${roadY(1232)}`} fill="none"
          stroke={PALETTE.border} strokeWidth={3} strokeDasharray="27 25" />
      </g>
      <Beam x={233} target={Math.min(x, 640)} color={PALETTE.orange} opacity={1 - prune} />
      <Beam x={1041} target={bAim} color={PALETTE.blue} opacity={1} />
      <path d={`M233 418 L${x} ${y}`} stroke={PALETTE.orange} strokeWidth={5}
        strokeDasharray="12 9" opacity={1 - handover} />
      <path d={`M1041 418 L${x} ${y}`} stroke={PALETTE.blue} strokeWidth={5} opacity={handover} />
      <Station x={233} label="Cell A" />
      <Station x={1041} label="Cell B" />
      <text x={279} y={433} fill={PALETTE.muted} fontSize={34} opacity={prune}>Beam off</text>
      <g transform={`translate(${x} ${y})`}>
        <text y={-45} textAnchor="middle" fontSize={36} fontWeight={650}
          stroke={PALETTE.bg} strokeWidth={8} paintOrder="stroke">
          {frame < 131 ? 'UE · Cell A' : 'UE · Cell B'}
        </text>
        <rect x={-16} y={-27} width={32} height={54} rx={7} fill={PALETTE.card} stroke={PALETTE.ink} strokeWidth={4} />
        <path d="M-5 -20H5 M-4 20H4" stroke={PALETTE.ink} strokeWidth={3} strokeLinecap="round" />
      </g>
      <text x={62} y={48} fontSize={25} fill={PALETTE.muted}>Handover schematic</text>

      <g transform="translate(96 599)">
        <text y={36} fontSize={35} fontWeight={600}>VIAVI · Avg. power</text>
        <text x={501} fontSize={30} fill={PALETTE.muted}>AI off</text>
        <text x={501} y={57} fontSize={49} fontWeight={650}>37.7 kW</text>
        <g opacity={result}>
          <path d="M733 39H785 M772 26L785 39L772 52" fill="none"
            stroke={PALETTE.muted} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          <text x={839} fontSize={30} fill={PALETTE.muted}>AI on</text>
          <text x={839} y={57} fontSize={49} fontWeight={650} fill={PALETTE.blue}>21.3 kW</text>
        </g>
      </g>
    </DemoStage>
  );
};
