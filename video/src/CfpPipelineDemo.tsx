import React from 'react';
import { useCurrentFrame } from 'remotion';
import { DemoStage, FONT_MONO, PALETTE, phase } from './theme';

export const CFP_DURATION = 210;

// The official ICC snapshots in tests/fixtures/cfp move the same deadline
// from Friday the 16th to Friday the 30th. October 1, 2026 was a Thursday.
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const gridX = 88, gridY = 193, cellW = 158, cellH = 78;
const dates = Array.from({ length: 31 }, (_, i) => ({
  day: i + 1, x: gridX + ((i + 3) % 7) * cellW, y: gridY + Math.floor((i + 3) / 7) * cellH,
}));
const from = dates[15], to = dates[29];

export const CfpPipelineDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const notice = phase(frame, 11, 42);
  const move = phase(frame, 58, 108);
  const landed = phase(frame, 109, 133);
  const tagX = from.x + 3 + 31 * Math.sin(Math.PI * move);
  const tagY = from.y + 37 + (to.y - from.y) * move;

  return (
    <DemoStage>
      <rect x="56" y="37" width="1168" height="645" rx="22" fill={PALETTE.card} stroke={PALETTE.border} strokeWidth="2" />
      <text x="88" y="116" fontSize="54" fontWeight="700">October <tspan fill={PALETTE.muted} fontWeight="450">2026</tspan></text>
      <text x="1190" y="107" textAnchor="end" fontFamily={FONT_MONO} fontSize="26" fill={PALETTE.teal}>radar.ics</text>
      {weekdays.map((d, i) => (
        <text key={d} x={gridX + cellW * i + 12} y="171" fontSize="25" fill={PALETTE.muted}>{d}</text>
      ))}
      {Array.from({ length: 5 }, (_, i) => (
        <path key={i} d={`M88 ${gridY + i * cellH}h1106`} stroke={PALETTE.border} strokeWidth="1.4" />
      ))}
      {dates.map(({ day, x, y }) => (
        <text key={day} x={x + 12} y={y + 31} fontSize="29" fontWeight={day === 16 || day === 30 ? 720 : 450}>{day}</text>
      ))}
      <rect x={from.x + 3} y={from.y + 37} width="149" height="38" rx="8" fill="none" stroke={PALETTE.muted}
        strokeDasharray="5 6" strokeWidth="1.8" opacity={move * (1 - landed)} />
      <g transform={`translate(${tagX} ${tagY})`}>
        <rect width="149" height="38" rx="8" fill={PALETTE.teal} />
        <text x="74.5" y="28" textAnchor="middle" fontSize="26" fontWeight="700" fill={PALETTE.onAccent}>ICC 2027</text>
      </g>

      <path d="M56 600h1168" stroke={PALETTE.border} strokeWidth="2" />
      <text x="88" y="652" fontSize="27" fill={PALETTE.muted}>Official CFP · Paper submission</text>
      <text x="769" y="652" fontFamily={FONT_MONO} fontSize="32" fill={notice === 0 ? PALETTE.ink : PALETTE.muted}>16 Oct</text>
      <path d={`M765 641h${130 * notice}`} stroke={PALETTE.ink} strokeWidth="3" />
      <g opacity={notice} transform={`translate(${(1 - notice) * 14} 0)`}>
        <path d="M921 641h32m-10-9 10 9-10 9" fill="none" stroke={PALETTE.muted} strokeWidth="3" />
        <text x="982" y="652" fontSize="36" fontWeight="720" fill={PALETTE.teal}>30 Oct</text>
        <text x="1109" y="651" fontSize="23" fill={PALETTE.muted}>Firm</text>
      </g>
    </DemoStage>
  );
};
