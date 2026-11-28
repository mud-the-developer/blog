import React from 'react';
import { useCurrentFrame } from 'remotion';
import { DemoStage, FONT_MONO, PALETTE, Pointer, phase } from './theme';

export const NEWS_DURATION = 210;

// Public papers from the 2026-11-28 digest. The unchecked result must not
// appear in the draft, even though it was part of the original search.
const papers = [
  { title: 'ProxyGenBench', subject: 'Proxy-guided video generation', id: '2611.34457' },
  { title: 'DexEngine', subject: 'Whole-robot demonstration data', id: '2611.33579' },
  { title: 'ShowNow', subject: 'Streaming for responsive world models', id: '2611.34693' },
];

export const AiNewsDigestDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const excluded = frame >= 32;
  const draft = phase(frame, 94, 135);
  const fadeRow = phase(frame, 92, 109);
  const reach = phase(frame, 0, 29);
  const submit = phase(frame, 46, 83);
  const cursorX = 324 - 178 * reach + 752 * submit;
  const cursorY = 411 - 57 * reach + 229 * submit;

  return (
    <DemoStage>
      <g transform={`translate(0 ${39 * draft})`}>
        <rect x="72" y="47" width="1136" height={614 - 82 * draft} rx="20" fill={PALETTE.card} stroke={PALETTE.border} strokeWidth="2" />
        <text x="116" y="104" fontFamily={FONT_MONO} fontSize="25" fill={PALETTE.teal}>
          {frame < 107 ? 'News Search' : 'Draft preview / Sources'}
        </text>
        <text x="112" y="174" fontSize="62" fontWeight="680">Video generation</text>
        <path d="M116 202h1048" stroke={PALETTE.border} strokeWidth="2" />
        {papers.map((paper, i) => {
          const rejected = excluded && i === 1;
          const y = 225 + i * 102 - (i === 2 ? 82 * draft : 0);
          return (
            <g key={paper.id} transform={`translate(0 ${y})`} opacity={i === 1 ? 1 - fadeRow : 1}>
              <g opacity={1 - phase(frame, 94, 107)}>
                <rect x="121" y="6" width="38" height="38" rx="7" fill={rejected ? PALETTE.card : PALETTE.teal}
                  stroke={rejected ? PALETTE.muted : PALETTE.teal} strokeWidth="2.5" />
                {!rejected && <path d="m129 26 7 7 15-18" fill="none" stroke={PALETTE.onAccent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
              </g>
              {i !== 1 && <text x="120" y="38" opacity={phase(frame, 111, 130)} fill={PALETTE.teal} fontSize="32" fontFamily={FONT_MONO}>{i === 0 ? '01' : '02'}</text>}
              <text x="192" y="40" fontWeight="650" fontSize="42" fill={rejected ? PALETTE.muted : PALETTE.ink}>{paper.title}</text>
              <text x="193" y="76" fontSize="25" fill={PALETTE.muted} opacity={1 - phase(frame, 94, 107)}>{paper.subject}</text>
              {i !== 1 && <text x="193" y="76" fontSize="24" fontFamily={FONT_MONO} fill={PALETTE.teal} opacity={phase(frame, 111, 130)}>huggingface.co/papers/{paper.id}</text>}
            </g>
          );
        })}
        <g transform={`translate(0 ${-82 * draft})`}>
          <path d="M116 536h1048" stroke={PALETTE.border} strokeWidth="2" />
          <text x="118" y="604" fontSize="29" fill={PALETTE.muted}>
            {frame >= 115 ? '2 cited sources' : `${excluded ? 2 : 3} selected`}
          </text>
          <rect x="734" y="554" width="426" height="74" rx="12" fill={frame >= 115 ? PALETTE.cardSoft : PALETTE.ink} />
          <text x="947" y="602" textAnchor="middle" fontSize="30" fontWeight="620" fill={frame >= 115 ? PALETTE.ink : PALETTE.bg}>
            {frame >= 115 ? 'Download Markdown' : 'Draft from selected news'}
          </text>
        </g>
      </g>
      <g opacity={1 - phase(frame, 93, 104)}>
        <Pointer x={cursorX} y={cursorY} pressed={(frame >= 30 && frame < 36) || (frame >= 87 && frame < 94)} />
      </g>
    </DemoStage>
  );
};
