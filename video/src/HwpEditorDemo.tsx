import React from 'react';
import { useCurrentFrame } from 'remotion';
import { DemoStage, FONT_MONO, PALETTE, Pointer, phase } from './theme';

export const HWP_EDITOR_DURATION = 240;

const EXCERPT = 'Start at the north gate.';
const PAPER = 'light-dark(#fffefa, #2e2d2b)';
const INK = 'light-dark(#25292b, #f3f1e8)';

export const HwpEditorDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const approach = phase(frame, 0, 48);
  const copied = frame >= 61;
  const leave = phase(frame, 97, 161);
  const focus = phase(frame, 85, 160);
  const clickTimes = [50, 59];
  const x = 519 - 172 * approach + 564 * leave;
  const y = 522 - 96 * approach + 157 * leave;

  return (
    <DemoStage>
      <g transform={`translate(660 350) scale(${1 + .065 * focus}) translate(-660 -350)`}>
        <rect x="51" y="55" width="1178" height="610" rx="13" fill={PALETTE.cardSoft} stroke={PALETTE.border} strokeWidth="2" />
        <path d="M52 131H1228 M652 131V664" fill="none" stroke={PALETTE.border} strokeWidth="2" />
        <path d="M83 77h24l9 9v24H83z M107 77v10h9" fill="none" stroke={PALETTE.muted} strokeWidth="2.5" strokeLinejoin="round" />
        <text x="136" y="107" fontSize="34" fontWeight="600">survey.hwpx</text>
        <text x="691" y="107" fontSize="34" fontWeight="600">OMP</text>
        <text x="1190" y="105" textAnchor="end" fontSize="30" fill={PALETTE.muted}>Local composer</text>

        <rect x="83" y="153" width="536" height="488" fill={PAPER} stroke={PALETTE.border} strokeWidth="2" />
        <g fill={INK}>
          <text x="126" y="221" fontFamily="Georgia, serif" fontSize="54" fontWeight="700">Field survey</text>
          <path d="M126 242H573" stroke={INK} strokeWidth="1.5" />
          <g transform="translate(127 264)" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <rect width="446" height="92" rx="3" fill={PALETTE.blueSoft} />
            <path d="M0 20c67 9 58 45 121 42s86-43 158-13 106 29 167 15" stroke={PALETTE.blue} strokeWidth="8" opacity=".65" />
            <path d="M0 27c67 9 58 45 121 42s86-43 158-13 106 29 167 15" stroke={PALETTE.blue} strokeWidth="1.5" opacity=".6" />
            <path d="m50 73 76-28 61 7 59-27h71l61-14" stroke={INK} strokeWidth="3" strokeDasharray="6 8" />
            <circle cx="50" cy="73" r="6.5" fill={PAPER} stroke={INK} strokeWidth="3" />
            <circle cx="378" cy="11" r="6.5" fill={INK} />
          </g>
          <text x="126" y="402" fontSize="31" fontWeight="650">Arrival</text>
          {copied && <rect x="117" y="412" width="441" height="49" rx="3" fill={PALETTE.blueSoft} stroke={PALETTE.blue} strokeWidth="2" />}
          <text x="126" y="448" fontSize="36" fontFamily="Georgia, serif">{EXCERPT}</text>
          <path d="M126 486H572" stroke={PALETTE.border} strokeWidth="1.5" />
          <text x="126" y="532" fontSize="31" fontWeight="650">Equipment</text>
          <text x="126" y="578" fontSize="34" fontFamily="Georgia, serif">Map and compass</text>
          <text x="558" y="617" textAnchor="end" fontSize="23" fill={PALETTE.muted}>1</text>
        </g>

        <g>
          <rect x="685" y="305" width="514" height="278" rx="6" fill={PALETTE.card} stroke={copied ? PALETTE.teal : PALETTE.border} strokeWidth={copied ? 3 : 2} />
          <text x="711" y="358" fontSize="31" fontWeight="600" fill={PALETTE.muted}>Draft</text>
          {copied ? (
            <>
              <text x="711" y="427" fontSize="30" fontFamily={FONT_MONO} fill={PALETTE.teal}>section0.xml :: p#14</text>
              <text x="711" y="499" fontSize="35">{EXCERPT}</text>
              <path d="M713 522v32" stroke={PALETTE.ink} strokeWidth="3" opacity={Math.floor(frame / 18) % 2 ? 1 : .15} />
              <text x="1198" y="630" textAnchor="end" fontSize="32" fill={PALETTE.muted}>Not sent</text>
            </>
          ) : <text x="711" y="428" fontSize="35" fill={PALETTE.muted}>Message…</text>}
        </g>
        {clickTimes.map(start => {
          const t = phase(frame, start, start + 13);
          return <circle key={start} cx="347" cy="426" r={8 + 34 * t} fill="none" stroke={PALETTE.blue} strokeWidth="3" opacity={frame >= start ? 1 - t : 0} />;
        })}
        <Pointer x={x} y={y} pressed={clickTimes.some(start => frame >= start && frame < start + 4)} />
      </g>
    </DemoStage>
  );
};
