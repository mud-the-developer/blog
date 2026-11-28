import React, { useEffect, useState } from 'react';
import { cancelRender, continueRender, delayRender, useVideoConfig } from 'remotion';

export const PALETTE = {
  bg: 'light-dark(#F4F6FA, #141416)',
  grid: 'light-dark(#E3E8F1, #222226)',
  card: 'light-dark(#FFFFFF, #1E1E22)',
  cardSoft: 'light-dark(#EFF3F8, #27272C)',
  border: 'light-dark(#D5DCE8, #4D4E56)',
  ink: 'light-dark(#111622, #F4F4F6)',
  muted: 'light-dark(#4E586B, #B2B5BE)',
  onAccent: 'light-dark(#FFFFFF, #14171F)',
  navy: 'light-dark(#1E3A8A, #A4BBFF)',
  blue: 'light-dark(#2563EB, #8DB4FF)',
  blueSoft: 'light-dark(#EFF6FF, #222C40)',
  teal: 'light-dark(#0F766E, #49D9B9)',
  green: 'light-dark(#059669, #70DBA5)',
  greenSoft: 'light-dark(#ECFDF5, #1C332C)',
  orange: 'light-dark(#C2410C, #FFAB7F)',
  amber: 'light-dark(#D97706, #F4C573)',
  amberSoft: 'light-dark(#FFF7ED, #393022)',
  red: 'light-dark(#BE123C, #FF95AA)',
  redSoft: 'light-dark(#FFF1F2, #39262D)',
  purple: 'light-dark(#6D28D9, #C4ABFF)',
  purpleSoft: 'light-dark(#F5F3FF, #30293D)',
};

export const FONT_SANS =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
export const FONT_MONO =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// The same Latin variable faces and weights in a still, Studio and every encoder tab.
const renderFonts = [
  ['Inter', 'https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2'],
  ['JetBrains Mono', 'https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxDcwg.woff2'],
] as const;
let fontsReady: Promise<void> | undefined;

async function loadFonts() {
  await Promise.all(renderFonts.map(async ([family, url]) => {
    const face = new FontFace(family, `url(${url})`, { weight: '400 800' });
    document.fonts.add(await face.load());
  }));
}

function useWebFonts() {
  const [handle] = useState(() => delayRender('Loading demo fonts'));
  useEffect(() => {
    let mounted = true;
    (fontsReady ??= loadFonts()).then(
      () => { if (mounted) continueRender(handle); },
      (error) => { if (mounted) cancelRender(error); },
    );
    return () => { mounted = false; };
  }, [handle]);
}

/** Deterministic ease between two frame numbers, including still renders. */
export function phase(frame: number, from: number, to: number): number {
  const t = Math.min(1, Math.max(0, (frame - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

export function DemoStage({ children }: { children: React.ReactNode }) {
  useWebFonts();
  const { props } = useVideoConfig();
  return (
    <svg width="1280" height="720" viewBox="0 0 1280 720" fontFamily={FONT_SANS} fill={PALETTE.ink}
      style={{ display: 'block', colorScheme: props.theme === 'dark' ? 'dark' : 'light', color: PALETTE.ink, fontVariantNumeric: 'tabular-nums' }}>
      <rect width="1280" height="720" fill={PALETTE.bg} />
      {children}
    </svg>
  );
}

export function Pointer({ x, y, pressed = false }: { x: number; y: number; pressed?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {pressed && <circle r="16" fill="none" stroke={PALETTE.blue} strokeWidth="3" />}
      <path d="M0 0 6 32 13 23 20 36 26 33 19 20 31 18Z" fill={PALETTE.ink}
        stroke={PALETTE.card} strokeWidth="2.5" strokeLinejoin="round" />
    </g>
  );
}
