import React from 'react';
import { useCurrentFrame } from 'remotion';
import { DemoStage, FONT_MONO, PALETTE, Pointer, phase, useCompactDemo } from './theme';

export const NIRI_SUITE_DURATION = 240;

const WindowBar: React.FC<{ title: string }> = ({ title }) => (
  <g>
    <rect x="87" y="171" width="1106" height="468" rx="10" fill={PALETTE.card} stroke={PALETTE.border} strokeWidth="2" />
    <text x="117" y="216" fontSize="33" fontWeight="550">{title}</text>
    <path d="M87 238H1193 M1142 194l13 13m0-13-13 13" stroke={PALETTE.muted} strokeWidth="2" />
  </g>
);

const artworkDefs = (
  <defs>
    <linearGradient id="niri-wallpaper" x1="0" y1="0" x2="1" y2="1">
      <stop stopColor="light-dark(#d6e6df, #153337)" />
      <stop offset="1" stopColor="light-dark(#afc6c4, #2b424a)" />
    </linearGradient>
      <g id="niri-fish" strokeLinejoin="round" strokeLinecap="round">
        <path d="M2 50C34 14 85 4 152 15c32 5 66 21 94 29l35-24-8 30 11 26-38-19c-42 9-71 26-125 24C59 80 19 69 2 50Z" fill="#cedfd2" stroke="#ecf2d8" strokeWidth="2" />
        <g fill="#8faeae" stroke="#ecf2d8" strokeWidth="1.2">
          <path d="m79 15 17-17 6 14 20-17 11 17" /><path d="m152 19 17-11 7 16" />
          <path d="m116 77 19 16 10-16" /><path d="m169 72 16 9 8-16" />
        </g>
        <g fill="none" stroke="#32576a" strokeWidth="1.8">
          <path d="M2 49c23 5 27 4 38 1 M52 27c19 10 15 31-1 43 M61 26c15 12 14 31 0 42 M64 53l34 2-25 13" />
          <path d="M69 44c45-8 92-5 133 5l44 4 M84 21q14 2 19 12m-7-14q15 2 20 13m-8-13q17 4 22 13m-6-12q16 5 20 14m-4-12q14 5 19 14m-5-11q13 5 17 13" />
          <path d="m248 50 22-18m-19 20 22-10m-23 12 24 11 M13 57q18 3 29 8" />
        </g>
        <circle cx="35" cy="42" r="6.5" fill="#244456" stroke="#faf0cd" strokeWidth="2" />
      </g>
  </defs>
);

const desktopWindows = (
  <>
    <WindowBar title="Terminal" />
    <g transform="translate(132 313)" fontSize="38" fontFamily={FONT_MONO}>
      <text fill={PALETTE.teal}>~/prints</text>
      <text y="72"><tspan fill={PALETTE.muted}>$ </tspan>ls</text>
      <text y="135">inlet.svg   shoal.svg</text>
      <text y="222" fill={PALETTE.muted}>$</text>
      <rect x="46" y="191" width="18" height="37" fill={PALETTE.ink} />
    </g>
    <g transform="translate(0 515)">
      <WindowBar title="shoal.svg" />
      <rect x="111" y="256" width="1058" height="361" fill="#244456" />
      <path d="M127 272h1026v329H127z" fill="none" stroke="#92b2b3" opacity=".6" strokeWidth="1.4" />
      <use href="#niri-fish" transform="translate(175 335) rotate(-5) scale(1.62)" />
      <use href="#niri-fish" transform="translate(690 370) rotate(8) scale(1.38)" />
      <use href="#niri-fish" transform="translate(440 495) rotate(-6) scale(1.07)" />
    </g>
  </>
);

export const NiriDesktopSuiteDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const compact = useCompactDemo();
  const approach = phase(frame, 0, 44);
  const leave = phase(frame, 145, 201);
  const hover = phase(frame, 35, 62) * (1 - phase(frame, 159, 181));
  const scroll = phase(frame, 78, 123);
  const second = frame >= 95;
  const wheel = phase(frame, 59, 71) * (1 - phase(frame, 120, 137));
  if (compact) {
    const notchHalf = 157 + 25 * hover;
    const l = 320 - notchHalf;
    const r = 320 + notchHalf;
    const depth = 80 + 8 * hover;
    return (
      <DemoStage>
        {artworkDefs}
        <defs><clipPath id="niri-compact-desks"><rect x="30" y="163" width="580" height="399" /></clipPath></defs>
        <rect x="16" y="26" width="608" height="565" rx="18" fill="url(#niri-wallpaper)" stroke={PALETTE.border} strokeWidth="3" />
        <g clipPath="url(#niri-compact-desks)">
          <g transform={`translate(0 ${-408 * scroll})`}>
            <rect x="37" y="175" width="566" height="376" rx="11" fill={PALETTE.card} stroke={PALETTE.border} strokeWidth="3" />
            <text x="65" y="233" fontSize="46" fontWeight="600">Terminal</text>
            <path d="M38 254H602" stroke={PALETTE.border} strokeWidth="2" />
            <g transform="translate(66 314)" fontSize="40" fontFamily={FONT_MONO}>
              <text fill={PALETTE.teal}>~/prints</text>
              <text y="57"><tspan fill={PALETTE.muted}>$ </tspan>ls</text>
              <text y="114">inlet.svg  shoal.svg</text>
              <text y="178" fill={PALETTE.muted}>$</text>
              <rect x="39" y="145" width="19" height="36" fill={PALETTE.ink} />
            </g>
            <g transform="translate(0 408)">
              <rect x="37" y="175" width="566" height="376" rx="11" fill={PALETTE.card} stroke={PALETTE.border} strokeWidth="3" />
              <text x="65" y="233" fontSize="46" fontWeight="600">shoal.svg</text>
              <rect x="52" y="254" width="536" height="281" fill="#244456" />
              <path d="M64 267h512v255H64z" fill="none" stroke="#92b2b3" strokeWidth="2" opacity=".6" />
              <use href="#niri-fish" transform="translate(80 313) rotate(-5) scale(1.02)" />
              <use href="#niri-fish" transform="translate(322 363) rotate(8) scale(.86)" />
              <use href="#niri-fish" transform="translate(132 435) rotate(-6) scale(.72)" />
            </g>
          </g>
        </g>
        <g transform="translate(0 26)">
          <path d={`M${l - 19} 0H${r + 19}Q${r} 0 ${r} 20V${depth - 28}Q${r} ${depth} ${r - 29} ${depth}H${l + 29}Q${l} ${depth} ${l} ${depth - 28}V20Q${l} 0 ${l - 19} 0Z`} fill="#171c20" />
          <text x="320" y={55 + 3 * hover} textAnchor="middle" fill="#f0f5ed" fontSize="42" fontWeight="600">Workspace {second ? 2 : 1}</text>
        </g>
        <g opacity={wheel} transform="translate(388 118)">
          <rect width="212" height="59" rx="13" fill={PALETTE.ink} />
          <rect x="17" y="9" width="27" height="40" rx="13" fill="none" stroke={PALETTE.card} strokeWidth="3" />
          <rect x="27" y={14 + 9 * phase(frame, 71, 83)} width="7" height="13" rx="3" fill={PALETTE.card} />
          <text x="57" y="42" fill={PALETTE.card} fontSize="36" fontWeight="600">Wheel ↓</text>
        </g>
        <Pointer x={498 - 46 * approach + 87 * leave} y={282 - 201 * approach + 151 * leave} />
      </DemoStage>
    );
  }
  const notchWidth = 297 + 62 * hover;
  const notchDepth = 67 + 9 * hover;
  const l = 640 - notchWidth / 2;
  const r = 640 + notchWidth / 2;

  return (
    <DemoStage>
      {artworkDefs}
      <defs>
        <clipPath id="niri-desks"><rect x="39" y="143" width="1202" height="503" /></clipPath>
      </defs>
      <rect x="34" y="37" width="1212" height="643" rx="19" fill="url(#niri-wallpaper)" stroke={PALETTE.border} strokeWidth="2" />
      <g clipPath="url(#niri-desks)">
        <g transform={`translate(0 ${-515 * scroll})`}>{desktopWindows}</g>
      </g>

      <g transform="translate(68 60)">
        <rect width="186" height="60" rx="30" fill={PALETTE.card} />
        <rect x={second ? 92 : 9} y="7" width="83" height="46" rx="23" fill={PALETTE.ink} />
        <text x="52" y="42" textAnchor="middle" fontWeight="650" fontSize="33" fill={second ? PALETTE.muted : PALETTE.card}>1</text>
        <text x="134" y="42" textAnchor="middle" fontWeight="650" fontSize="33" fill={second ? PALETTE.card : PALETTE.muted}>2</text>
      </g>
      <g transform="translate(1114 60)" fill={PALETTE.muted}>
        <rect width="98" height="60" rx="30" fill={PALETTE.card} />
        <path d="M18 25q14-13 28 0m-23 5q9-8 18 0m-13 6q4-4 8 0 M59 24h18v13H59z M80 28v5" fill="none" stroke={PALETTE.muted} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g transform="translate(0 37)">
        <path d={`M${l - 18} 0H${r + 18}Q${r} 0 ${r} 20V${notchDepth - 25}Q${r} ${notchDepth} ${r - 27} ${notchDepth}H${l + 27}Q${l} ${notchDepth} ${l} ${notchDepth - 25}V20Q${l} 0 ${l - 18} 0Z`} fill="#171c20" />
        <text x="640" y={45 + 3 * hover} textAnchor="middle" fill="#f0f5ed" fontSize="32" fontWeight="600">{second ? '2 · shoal.svg' : '1 · Terminal'}</text>
      </g>

      <g opacity={wheel} transform="translate(722 124)">
        <rect width="205" height="62" rx="15" fill={PALETTE.ink} />
        <rect x="19" y="10" width="27" height="42" rx="13" fill="none" stroke={PALETTE.card} strokeWidth="2.5" />
        <rect x="29" y={17 + 7 * phase(frame, 71, 83)} width="7" height="12" rx="3" fill={PALETTE.card} />
        <text x="62" y="41" fill={PALETTE.card} fontSize="30" fontWeight="600">Wheel ↓</text>
      </g>
      <Pointer x={883 - 180 * approach + 302 * leave} y={270 - 177 * approach + 158 * leave} />
    </DemoStage>
  );
};
