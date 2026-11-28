import React from 'react';
import { useCurrentFrame } from 'remotion';
import { DemoStage, PALETTE, phase, useCompactDemo } from './theme';

export const MUDPLOT_DURATION = 288;

// The two VIAVI scenarios in posts/projects/mwc26-ai-ran-beamforming.md.
// Proof passes change ink only; the data and axis never move.
const scenarios = [
  { label: ['Irregular', 'UE reports'], conventional: 7.03, predictive: 16.45 },
  { label: ['Regional', 'interference'], conventional: 8.04, predictive: 10.12 },
];
const series = [
  { key: 'conventional', name: 'Conventional', color: 'lch(72% 45 37)' },
  { key: 'predictive', name: 'Predictive', color: 'lch(72% 45 225)' },
] as const;
const widePlot = {
  baseline: 538, unit: 16, groups: [418, 882], offsets: [-109, 5], barWidth: 104,
  legend: [211, 633], legendTop: 157, swatchWidth: 49, passStart: 156, passWidth: 966,
};
const compactPlot = {
  baseline: 420, unit: 11, groups: [208, 475], offsets: [-95, 6], barWidth: 90,
  legend: [28, 359], legendTop: 125, swatchWidth: 44, passStart: 24, passWidth: 592,
};

export const MudplotDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const compact = useCompactDemo();
  const { baseline, unit, groups, offsets, barWidth, legend, legendTop, swatchWidth, passStart, passWidth } =
    compact ? compactPlot : widePlot;
  const gray = phase(frame, -18, 98);
  const hatch = phase(frame, 139, 233);
  const proof = frame < 14 ? 'Color proof' : frame < 139 ? 'Grayscale proof' : 'Hatched proof';

  return (
    <DemoStage>
      <defs>
        {series.map(({ key }, method) => (
          <g key={key} id={`mudplot-${key}`}>
            <rect x={legend[method]} y={legendTop} width={swatchWidth} height={32} />
            {scenarios.map((s, group) => (
              <rect key={group} x={groups[group] + offsets[method]} y={baseline - s[key] * unit}
                width={barWidth} height={s[key] * unit} />
            ))}
          </g>
        ))}
        <pattern id="mudplot-hatch-conventional" width={18} height={18} patternUnits="userSpaceOnUse">
          <path d="M-4 4L4 -4 M-4 22L22 -4 M14 22L22 14" fill="none" stroke="#35383c" strokeWidth={4} />
        </pattern>
        <pattern id="mudplot-hatch-predictive" width={18} height={18} patternUnits="userSpaceOnUse">
          <circle cx={9} cy={9} r={3.8} fill="#35383c" />
        </pattern>
        <clipPath id="mudplot-gray-pass"><rect x={passStart} width={passWidth * gray} height={720} /></clipPath>
        <clipPath id="mudplot-hatch-pass"><rect x={passStart} width={passWidth * hatch} height={720} /></clipPath>
      </defs>

      {compact ? <>
        <text x={28} y={52} fontSize={46} fontWeight={650}>Downlink throughput</text>
        <text x={612} y={52} textAnchor="end" fontSize={36} fill={PALETTE.muted}>Mbps</text>
        <text x={28} y={102} fontSize={38} fill={PALETTE.muted}>{proof}</text>
      </> : <>
        <rect x={82} y={53} width={1116} height={614} fill={PALETTE.card} stroke={PALETTE.border} strokeWidth={2} />
        <text x={146} y={121} fontSize={40} fontWeight={650}>Downlink throughput <tspan fill={PALETTE.muted} fontSize={30} fontWeight={450}>/ Mbps</tspan></text>
        <text x={1130} y={121} textAnchor="end" fontSize={30} fill={PALETTE.muted}>{proof}</text>
      </>}

      {[0, 5, 10, 15, 20].map((rate) => {
        const y = baseline - rate * unit;
        return (
          <g key={rate}>
            <line x1={compact ? 83 : 187} y1={y} x2={compact ? 612 : 1101} y2={y}
              stroke={rate === 0 ? PALETTE.ink : PALETTE.border} strokeWidth={rate === 0 ? 3 : 1.6} />
            <text x={compact ? 67 : 167} y={y + 10} textAnchor="end" fontSize={compact ? 36 : 31} fill={PALETTE.muted}>{rate}</text>
          </g>
        );
      })}
      {series.map(({ key, name, color }, method) => (
        <g key={key}>
          <use href={`#mudplot-${key}`} fill={color} />
          <use href={`#mudplot-${key}`} fill="lch(72% 0 0)" clipPath="url(#mudplot-gray-pass)" />
          <use href={`#mudplot-${key}`} fill={`url(#mudplot-hatch-${key})`} clipPath="url(#mudplot-hatch-pass)" />
          <use href={`#mudplot-${key}`} fill="none" stroke={PALETTE.ink} strokeOpacity={0.72} strokeWidth={2} />
          <text x={legend[method] + swatchWidth + (compact ? 12 : 16)} y={legendTop + 28} fontSize={compact ? 36 : 34}>{name}</text>
          {scenarios.map((s, group) => (
            <text key={group} x={groups[group] + offsets[method] + barWidth / 2} y={baseline - s[key] * unit - 10}
              textAnchor="middle" fontSize={compact ? 40 : 27} fontWeight={compact ? 650 : undefined}>{s[key].toFixed(2)}</text>
          ))}
        </g>
      ))}
      {scenarios.map(({ label }, group) => (
        <text key={group} x={groups[group]} y={compact ? 469 : 593} textAnchor="middle" fontSize={compact ? 38 : 32}>
          {compact ? <>
            <tspan>{label[0]}</tspan>
            <tspan x={groups[group]} dy={43}>{label[1]}</tspan>
          </> : label.join(' ')}
        </text>
      ))}
    </DemoStage>
  );
};
