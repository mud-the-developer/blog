import React from 'react';
import { useCurrentFrame } from 'remotion';
import { DemoStage, PALETTE, phase, useCompactDemo } from './theme';

export const MWC26_DURATION = 318;

// Angles and report arrivals are illustrative, not VIAVI telemetry.
const reports = [
  { frame: -14, angle: -60 },
  { frame: 9, angle: -48 },
  { frame: 37, angle: -34 },
  { frame: 74, angle: -14 },
];
const origin = { x: 630, y: 496 };
const trackRadius = 321;
const aperture = 421;

function pointAt(angle: number, radius: number) {
  const a = angle * Math.PI / 180;
  return { x: origin.x + radius * Math.sin(a), y: origin.y - radius * Math.cos(a) };
}

function arc(from: number, to: number, radius: number) {
  const start = pointAt(from, radius);
  const end = pointAt(to, radius);
  return `M${start.x} ${start.y} A${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
}

export const Mwc26AiRanDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const compact = useCompactDemo();
  const fixes = reports.filter((report) => report.frame <= frame);
  const latest = fixes[fixes.length - 1];
  const previous = fixes[Math.max(0, fixes.length - 2)];
  const arrival = phase(frame, latest.frame, latest.frame + 21);
  const fix = pointAt(latest.angle, trackRadius);
  const paused = frame >= 102;
  const predict = phase(frame, 107, 190);
  const predictionAngle = -14 + 39 * predict;
  const prediction = pointAt(predictionAngle, trackRadius);
  const beamAngle = paused
    ? -14 + 39 * phase(frame, 147, 218)
    : previous.angle + (latest.angle - previous.angle) * arrival;
  const showPrediction = phase(frame, 112, 143);
  const comparison = phase(frame, 191, 214);

  return (
    <DemoStage>
      {compact ? <>
        <text x={28} y={46} fontSize={40} fontWeight={650}>Beam steering schematic</text>
        <circle cx={34} cy={83} r={8} />
        <text x={53} y={95} fontSize={36}>{paused ? 'Reports paused' : 'UE reports'}</text>
        <g opacity={showPrediction}>
          <path d="M378 71L390 83L378 95L366 83Z" stroke={PALETTE.teal} strokeWidth={4} fill={PALETTE.bg} />
          <text x={401} y={95} fontSize={36} fill={PALETTE.teal}>Predicted UE</text>
        </g>
      </> :
        <text x={62} y={49} fontSize={25} fill={PALETTE.muted}>Beam steering schematic</text>
      }
      <g transform={compact ? `translate(320 356) scale(0.59) translate(${-origin.x} ${-origin.y})` : undefined}>
      <g fill="none" stroke={PALETTE.border} strokeWidth={3}>
        <path d={arc(-67, 67, aperture)} />
        <path d={arc(-67, 67, 150)} />
        {[-67, -42, -17, 8, 33, 58, 67].map((angle) => {
          const end = pointAt(angle, aperture);
          return <line key={angle} x1={origin.x} y1={origin.y} x2={end.x} y2={end.y} />;
        })}
      </g>
      <g transform={`translate(${origin.x} ${origin.y}) rotate(${beamAngle})`}>
        <path d="M0 0L-76 -414A421 421 0 0 1 76 -414Z"
          stroke={PALETTE.teal} strokeWidth={3} fill={PALETTE.teal} fillOpacity={0.17} />
        <path d="M0 0V-415" stroke={PALETTE.teal} strokeWidth={compact ? 6 : 3} strokeDasharray="13 9" />
      </g>
      <g transform={`translate(${origin.x} ${origin.y})`}>
        <path d="M-38 9H38 M-24 19H24" stroke={PALETTE.ink} strokeWidth={5} strokeLinecap="round" />
        {[-30, -15, 0, 15, 30].map((x) => <rect key={x} x={x - 5} y={-10} width={10} height={14} rx={2} />)}
      </g>

      <path d={arc(-60, latest.angle, trackRadius)} fill="none" stroke={PALETTE.ink} strokeWidth={compact ? 7 : 4} />
      {fixes.map(({ angle }) => {
        const { x, y } = pointAt(angle, trackRadius);
        return <circle key={angle} cx={x} cy={y} r={compact ? 14 : 9} fill={PALETTE.ink} stroke={PALETTE.bg} strokeWidth={3} />;
      })}
      <circle cx={fix.x} cy={fix.y} r={14 + arrival * 16} stroke={PALETTE.ink}
        strokeWidth={3} fill="none" opacity={1 - arrival} />
      {!compact && <>
      <path d={`M232 258 H272 L${fix.x - 14} ${fix.y + 4}`} stroke={PALETTE.muted}
        strokeWidth={2} fill="none" />
      <text x={59} y={247} fontSize={32} fontWeight={650}>UE reports</text>
      <text x={59} y={288} fontSize={32} fill={PALETTE.muted}>{paused ? 'Paused' : 'Arriving'}</text>
      </>}

      <g opacity={showPrediction}>
        <path d={arc(-14, predictionAngle, trackRadius)} fill="none" stroke={PALETTE.teal}
          strokeWidth={compact ? 8 : 5} strokeDasharray="4 9" strokeLinecap="round" />
        {!compact &&
        <path d={`M${prediction.x + 17} ${prediction.y - 3} L912 160 H941`}
          stroke={PALETTE.teal} strokeWidth={2} fill="none" />}
        <path transform={`translate(${prediction.x} ${prediction.y}) scale(${compact ? 1.55 : 1})`} d="M0 -14L14 0L0 14L-14 0Z"
          stroke={PALETTE.teal} strokeWidth={5} fill={PALETTE.bg} />
        {!compact && <text x={956} y={168} fontSize={32} fontWeight={650} fill={PALETTE.teal}>Predicted UE</text>}
      </g>
      </g>

      {compact ? <>
        <line x1={28} x2={612} y1={382} y2={382} stroke={PALETTE.border} strokeWidth={3} />
        <text x={28} y={427} fontSize={38} fontWeight={600}>VIAVI downlink · Mbps</text>
        <text x={28} y={468} fontSize={36} fill={PALETTE.muted}>Conventional</text>
        <text x={28} y={520} fontSize={56} fontWeight={650}>7.03</text>
        <g opacity={comparison}>
          <path d="M279 499H318 M305 486L318 499L305 512" stroke={PALETTE.muted} fill="none"
            strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          <text x={346} y={468} fontSize={36} fill={PALETTE.muted}>Predictive</text>
          <text x={346} y={520} fontSize={56} fontWeight={650} fill={PALETTE.teal}>16.45</text>
        </g>
      </> :

      <g transform="translate(64 603)">
        <text fontSize={30} fill={PALETTE.muted}>VIAVI · Irregular reports</text>
        <text y={50} fontSize={36} fontWeight={650}>Downlink throughput</text>
        <text x={488} fontSize={30} fill={PALETTE.muted}>Conventional</text>
        <text x={488} y={51} fontSize={45} fontWeight={650}>7.03 Mbps</text>
        <g opacity={comparison}>
          <path d="M754 35H806 M793 22L806 35L793 48" stroke={PALETTE.muted} fill="none"
            strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          <text x={858} fontSize={30} fill={PALETTE.muted}>Predictive</text>
          <text x={858} y={51} fontSize={45} fontWeight={650} fill={PALETTE.teal}>16.45 Mbps</text>
        </g>
      </g>}
    </DemoStage>
  );
};
