import React from 'react';
import { useCurrentFrame } from 'remotion';
import { DemoStage, PALETTE, phase } from './theme';

export const MUDPLOT_DURATION = 288;

// The two VIAVI scenarios in posts/projects/mwc26-ai-ran-beamforming.md.
// Proof passes change ink only; the data and axis never move.
const scenarios = [
  { x: 418, label: 'Irregular UE reports', conventional: 7.03, predictive: 16.45 },
  { x: 882, label: 'Regional interference', conventional: 8.04, predictive: 10.12 },
];
const series = [
  { key: 'conventional', name: 'Conventional', legendX: 211, offset: -109, color: 'lch(72% 45 37)' },
  { key: 'predictive', name: 'Predictive', legendX: 633, offset: 5, color: 'lch(72% 45 225)' },
] as const;
const baseline = 538;
const unit = 16;

export const MudplotDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const gray = phase(frame, -18, 98);
  const hatch = phase(frame, 139, 233);

  return (
    <DemoStage>
      <defs>
        {series.map(({ key, legendX, offset }) => (
          <g key={key} id={`mudplot-${key}`}>
            <rect x={legendX} y={157} width={49} height={32} />
            {scenarios.map((s) => (
              <rect key={s.x} x={s.x + offset} y={baseline - s[key] * unit}
                width={104} height={s[key] * unit} />
            ))}
          </g>
        ))}
        <pattern id="mudplot-hatch-conventional" width={18} height={18} patternUnits="userSpaceOnUse">
          <path d="M-4 4L4 -4 M-4 22L22 -4 M14 22L22 14" fill="none" stroke="#35383c" strokeWidth={4} />
        </pattern>
        <pattern id="mudplot-hatch-predictive" width={18} height={18} patternUnits="userSpaceOnUse">
          <circle cx={9} cy={9} r={3.8} fill="#35383c" />
        </pattern>
        <clipPath id="mudplot-gray-pass"><rect x={156} width={966 * gray} height={720} /></clipPath>
        <clipPath id="mudplot-hatch-pass"><rect x={156} width={966 * hatch} height={720} /></clipPath>
      </defs>

      <rect x={82} y={53} width={1116} height={614} fill={PALETTE.card} stroke={PALETTE.border} strokeWidth={2} />
      <text x={146} y={121} fontSize={40} fontWeight={650}>Downlink throughput <tspan fill={PALETTE.muted} fontSize={30} fontWeight={450}>/ Mbps</tspan></text>
      <text x={1130} y={121} textAnchor="end" fontSize={30} fill={PALETTE.muted}>
        {frame < 14 ? 'Color proof' : frame < 139 ? 'Grayscale proof' : 'Hatched proof'}
      </text>

      {[0, 5, 10, 15, 20].map((rate) => {
        const y = baseline - rate * unit;
        return (
          <g key={rate}>
            <line x1={187} y1={y} x2={1101} y2={y}
              stroke={rate === 0 ? PALETTE.ink : PALETTE.border} strokeWidth={rate === 0 ? 3 : 1.6} />
            <text x={167} y={y + 10} textAnchor="end" fontSize={31} fill={PALETTE.muted}>{rate}</text>
          </g>
        );
      })}
      {series.map(({ key, name, color, legendX, offset }) => (
        <g key={key}>
          <use href={`#mudplot-${key}`} fill={color} />
          <use href={`#mudplot-${key}`} fill="lch(72% 0 0)" clipPath="url(#mudplot-gray-pass)" />
          <use href={`#mudplot-${key}`} fill={`url(#mudplot-hatch-${key})`} clipPath="url(#mudplot-hatch-pass)" />
          <use href={`#mudplot-${key}`} fill="none" stroke={PALETTE.ink} strokeOpacity={0.72} strokeWidth={2} />
          <text x={legendX + 65} y={185} fontSize={34}>{name}</text>
          {scenarios.map((s) => (
            <text key={s.x} x={s.x + offset + 52} y={baseline - s[key] * unit - 10} textAnchor="middle" fontSize={27}>{s[key].toFixed(2)}</text>
          ))}
        </g>
      ))}
      {scenarios.map(({ x, label }) => (
        <text key={x} x={x} y={593} textAnchor="middle" fontSize={32}>{label}</text>
      ))}
    </DemoStage>
  );
};
