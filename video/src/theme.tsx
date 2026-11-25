import React from 'react';
import { interpolate, spring } from 'remotion';

export const PALETTE = {
  bg: '#F7F8FA',
  grid: '#E6EAF2',
  card: '#FFFFFF',
  cardSoft: '#F1F4F9',
  border: '#D7DEE9',
  ink: '#141923',
  muted: '#535D71',
  navy: '#1E3A8A',
  blue: '#2563EB',
  blueSoft: '#EFF6FF',
  teal: '#0F766E',
  green: '#059669',
  greenSoft: '#ECFDF5',
  orange: '#C2410C',
  amber: '#D97706',
  amberSoft: '#FFF7ED',
  red: '#BE123C',
  redSoft: '#FFF1F2',
  purple: '#6D28D9',
  purpleSoft: '#F5F3FF',
};

export const FONT_SANS =
  "Inter, Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
export const FONT_MONO =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export const GLASS_CARD_STYLE: React.CSSProperties = {
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(244,245,248,0.9) 50%, rgba(252,253,255,0.95) 100%) padding-box, linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.52) 5%, transparent 16%, transparent 84%, rgba(255,255,255,0.52) 95%, rgba(255,255,255,0.98) 100%) border-box, linear-gradient(90deg, rgba(20,25,35,0.34) 0%, rgba(20,25,35,0.12) 2%, transparent 6%, transparent 94%, rgba(20,25,35,0.12) 98%, rgba(20,25,35,0.34) 100%) border-box',
  border: '1px solid transparent',
  boxShadow:
    'inset 0 1.5px 0 rgba(255,255,255,0.98), inset 0 -1.5px 0 rgba(255,255,255,0.98), inset 1.5px 0 0 rgba(20,25,35,0.08), inset -1.5px 0 0 rgba(20,25,35,0.08), 0 10px 28px rgba(15,23,42,0.07), 0 2px 5px rgba(15,23,42,0.04)',
};
export function fadeWindow(
  frame: number,
  start: number,
  end: number,
  fade = 14
): number {
  const fadeIn = interpolate(frame, [start, start + fade], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(frame, [end - fade, end], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return Math.min(fadeIn, fadeOut);
}

export function enterSpring(frame: number, start: number, fps = 30): number {
  return spring({
    frame: Math.max(0, frame - start),
    fps,
    config: { damping: 20, stiffness: 120, mass: 0.7 },
  });
}

export interface Chapter {
  label: string;
  start: number;
  end: number;
}

export const FrameChrome: React.FC<{
  badge: string;
  title: string;
  chapters: Chapter[];
  frame: number;
  durationInFrames: number;
  accentColor?: string;
  footerLabel?: string;
  children: React.ReactNode;
}> = ({
  badge,
  title,
  chapters,
  frame,
  durationInFrames,
  accentColor = PALETTE.navy,
  footerLabel = 'Yonsei RAMO · VIAVI · SUTD · AI-RAN Alliance',
  children,
}) => {
  const activeIdx = Math.max(
    0,
    chapters.findIndex((c) => frame >= c.start && frame < c.end)
  );
  const currentIdx = activeIdx === -1 ? chapters.length - 1 : activeIdx;
  const progress = Math.min(1, Math.max(0, frame / Math.max(1, durationInFrames - 1)));

  return (
    <div
      style={{
        width: 1280,
        height: 720,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: PALETTE.bg,
        backgroundImage: `linear-gradient(to right, ${PALETTE.grid} 1px, transparent 1px), linear-gradient(to bottom, ${PALETTE.grid} 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
        fontFamily: FONT_SANS,
        color: PALETTE.ink,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top chrome bar */}
      <div
        style={{
          height: 58,
          padding: '0 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${PALETTE.border}`,
          backgroundColor: 'rgba(255, 255, 255, 0.92)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.06em',
              padding: '4px 10px',
              borderRadius: 6,
              backgroundColor: accentColor,
              color: '#FFFFFF',
            }}
          >
            {badge}
          </span>
          <span
            style={{
              fontSize: 16,
              fontWeight: 650,
              letterSpacing: '-0.02em',
              color: PALETTE.ink,
            }}
          >
            {title}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 13,
              fontWeight: 600,
              color: accentColor,
            }}
          >
            0{currentIdx + 1} / 0{chapters.length}
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: PALETTE.muted,
            }}
          >
            {chapters[currentIdx]?.label}
          </span>
        </div>
      </div>

      {/* Main stage */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          padding: '26px 40px 22px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>

      {/* Bottom chapter rail */}
      <div
        style={{
          height: 44,
          padding: '0 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: `1px solid ${PALETTE.border}`,
          backgroundColor: 'rgba(255, 255, 255, 0.94)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {chapters.map((ch, idx) => {
            const active = idx === currentIdx;
            const past = idx < currentIdx;
            return (
              <div
                key={ch.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  opacity: active ? 1 : past ? 0.65 : 0.38,
                }}
              >
                <div
                  style={{
                    width: active ? 18 : 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: active ? accentColor : PALETTE.muted,
                  }}
                />
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 12,
                    fontWeight: active ? 700 : 500,
                    color: active ? PALETTE.ink : PALETTE.muted,
                  }}
                >
                  {ch.label}
                </span>
              </div>
            );
          })}
        </div>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: 12,
            color: PALETTE.muted,
          }}
        >
          {footerLabel}
        </span>
      </div>

      {/* Thin progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: 3,
          width: `${progress * 100}%`,
          backgroundColor: accentColor,
          zIndex: 20,
        }}
      />
    </div>
  );
};

export const BaseStationIcon: React.FC<{
  x: number;
  y: number;
  label: string;
  color?: string;
}> = ({ x, y, label, color = PALETTE.navy }) => (
  <g transform={`translate(${x}, ${y})`}>
    <polygon
      points="0,-24 -12,18 12,18"
      fill="none"
      stroke={color}
      strokeWidth={2.5}
      strokeLinejoin="round"
    />
    <line x1={-7} y1={2} x2={7} y2={2} stroke={color} strokeWidth={2} />
    <line x1={-10} y1={10} x2={10} y2={10} stroke={color} strokeWidth={2} />
    <circle cx={0} cy={-26} r={4.5} fill={color} />
    <path
      d="M -11,-32 A 13,13 0 0,1 -11,-20"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <path
      d="M 11,-32 A 13,13 0 0,0 11,-20"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <text
      x={0}
      y={36}
      textAnchor="middle"
      fontFamily={FONT_MONO}
      fontSize={13}
      fontWeight={700}
      fill={PALETTE.ink}
    >
      {label}
    </text>
  </g>
);

export const UeDeviceIcon: React.FC<{
  x: number;
  y: number;
  label?: string;
  color?: string;
}> = ({ x, y, label, color = PALETTE.ink }) => (
  <g transform={`translate(${x}, ${y})`}>
    <rect
      x={-8}
      y={-13}
      width={16}
      height={26}
      rx={3.5}
      fill="#FFFFFF"
      stroke={color}
      strokeWidth={2.2}
    />
    <line x1={-3} y1={8} x2={3} y2={8} stroke={color} strokeWidth={2} strokeLinecap="round" />
    {label ? (
      <text
        x={0}
        y={-18}
        textAnchor="middle"
        fontFamily={FONT_MONO}
        fontSize={11}
        fontWeight={700}
        fill={color}
      >
        {label}
      </text>
    ) : null}
  </g>
);
