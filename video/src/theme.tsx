import React, { useEffect, useState } from 'react';
import { continueRender, delayRender, interpolate, spring } from 'remotion';

export const PALETTE = {
  bg: '#F4F6FA',
  grid: '#E3E8F1',
  card: '#FFFFFF',
  cardSoft: '#EFF3F8',
  border: '#D5DCE8',
  ink: '#111622',
  muted: '#4E586B',
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
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
export const FONT_MONO =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap';

let fontsInjected = false;

function useWebFonts(): void {
  const [handle] = useState(() => delayRender('Loading Inter and JetBrains Mono fonts'));

  useEffect(() => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      continueRender(handle);
    };

    const timer = setTimeout(done, 4000);

    if (typeof document !== 'undefined') {
      if (!fontsInjected) {
        fontsInjected = true;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = GOOGLE_FONTS_HREF;
        document.head.appendChild(link);
      }

      const loadAll = async () => {
        try {
          if (document.fonts) {
            await Promise.allSettled([
              document.fonts.load('500 16px Inter'),
              document.fonts.load('700 16px Inter'),
              document.fonts.load('800 32px Inter'),
              document.fonts.load('600 14px "JetBrains Mono"'),
              document.fonts.load('700 14px "JetBrains Mono"'),
            ]);
            await document.fonts.ready;
          }
        } finally {
          clearTimeout(timer);
          done();
        }
      };
      void loadAll();
    } else {
      clearTimeout(timer);
      done();
    }

    return () => clearTimeout(timer);
  }, [handle]);
}

export const GLASS_CARD_STYLE: React.CSSProperties = {
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(246,248,252,0.92) 52%, rgba(253,254,255,0.96) 100%) padding-box, linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(255,255,255,0.58) 5%, transparent 16%, transparent 84%, rgba(255,255,255,0.58) 95%, rgba(255,255,255,0.99) 100%) border-box, linear-gradient(90deg, rgba(17,22,34,0.32) 0%, rgba(17,22,34,0.12) 2%, transparent 6%, transparent 94%, rgba(17,22,34,0.12) 98%, rgba(17,22,34,0.32) 100%) border-box',
  border: '1px solid transparent',
  boxShadow:
    'inset 0 1.5px 0 rgba(255,255,255,0.98), inset 0 -1.5px 0 rgba(255,255,255,0.96), inset 1.5px 0 0 rgba(17,22,34,0.07), inset -1.5px 0 0 rgba(17,22,34,0.07), 0 12px 32px rgba(15,23,42,0.07), 0 2px 6px rgba(15,23,42,0.04)',
};

/**
 * Overlapping crossfade opacity window so chapter transitions never dip to a
 * blank white flash at `frame === start` or `frame === end`.
 */
export function fadeWindow(
  frame: number,
  start: number,
  end: number,
  fade = 14
): number {
  const half = Math.max(4, Math.floor(fade / 2));
  const fadeIn =
    start === 0
      ? interpolate(frame, [0, Math.min(10, fade)], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : interpolate(frame, [start - half, start + half], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

  const fadeOut = interpolate(frame, [end - half, end + half], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return Math.min(fadeIn, fadeOut);
}

/**
 * Kinetic scene entrance/exit style combining overlapping crossfade with subtle
 * vertical glide and scale choreography.
 */
export function sceneStyle(
  frame: number,
  start: number,
  end: number,
  isLast = false
): React.CSSProperties {
  const half = 7;
  const enterT =
    start === 0
      ? interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
      : interpolate(frame, [start - half, start + half], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const exitT = isLast
    ? 1
    : interpolate(frame, [end - half, end + half], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const opacity = Math.min(enterT, exitT);
  const enterY = (1 - enterT) * 14;
  const exitY = isLast ? 0 : (1 - exitT) * -10;
  const scale = 0.992 + 0.008 * Math.min(enterT, exitT);

  return {
    opacity,
    transform: `translateY(${(enterY + exitY).toFixed(2)}px) scale(${scale.toFixed(4)})`,
  };
}

export function enterSpring(frame: number, start: number, fps = 30): number {
  return spring({
    frame: Math.max(0, frame - start),
    fps,
    config: { damping: 20, stiffness: 125, mass: 0.68 },
  });
}

export function countUp(
  frame: number,
  start: number,
  duration: number,
  target: number,
  decimals = 0
): string {
  const t = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const eased = 1 - Math.pow(1 - t, 3);
  return (target * eased).toFixed(decimals);
}

function formatTimecode(frame: number, fps = 30): string {
  const sec = Math.floor(Math.max(0, frame) / fps);
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export interface Chapter {
  label: string;
  start: number;
  end: number;
}

export const TerminalWindow: React.FC<{
  title: string;
  badge?: string;
  command: string;
  lines: Array<{ text: string; color?: string; dim?: boolean; highlight?: boolean }>;
  footer?: string;
  localFrame: number;
  startFrame?: number;
  accentColor?: string;
}> = ({
  title,
  badge,
  command,
  lines,
  footer,
  localFrame,
  startFrame = 8,
  accentColor = '#5EEAD4',
}) => {
  const typedLen = Math.floor(
    interpolate(localFrame, [startFrame, startFrame + 38], [0, command.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  const typedCmd = command.slice(0, typedLen);
  const cursorOn = Math.floor(localFrame / 12) % 2 === 0;
  const cmdDone = typedLen >= command.length;

  return (
    <div
      style={{
        borderRadius: 18,
        backgroundColor: '#101521',
        border: '1px solid rgba(148,163,184,0.22)',
        boxShadow: '0 18px 36px rgba(15,23,42,0.16), inset 0 1px 0 rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      {/* Window chrome */}
      <div
        style={{
          height: 38,
          padding: '0 16px',
          backgroundColor: '#171E2E',
          borderBottom: '1px solid rgba(148,163,184,0.14)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, backgroundColor: 'rgba(148,163,184,0.38)' }} />
            <span style={{ width: 9, height: 9, borderRadius: 99, backgroundColor: 'rgba(148,163,184,0.28)' }} />
            <span style={{ width: 9, height: 9, borderRadius: 99, backgroundColor: 'rgba(148,163,184,0.2)' }} />
          </div>
          <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 600, color: '#CBD5E1' }}>
            {title}
          </span>
        </div>
        {badge && (
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10.5,
              fontWeight: 700,
              color: accentColor,
              padding: '2px 8px',
              borderRadius: 999,
              backgroundColor: 'rgba(255,255,255,0.06)',
            }}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Body */}
      <div
        style={{
          padding: '16px 20px',
          fontFamily: FONT_MONO,
          fontSize: 13.2,
          lineHeight: 1.66,
          color: '#E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          flex: 1,
        }}
      >
        <div>
          <span style={{ color: accentColor, fontWeight: 700 }}>$ </span>
          <span style={{ color: '#F8FAFC', fontWeight: 600 }}>{typedCmd}</span>
          {!cmdDone && (
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 15,
                marginLeft: 2,
                verticalAlign: 'middle',
                backgroundColor: accentColor,
                opacity: cursorOn ? 0.95 : 0.25,
              }}
            />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
          {lines.map((line, idx) => {
            const lineStart = startFrame + 42 + idx * 14;
            const lineAlpha = interpolate(localFrame, [lineStart, lineStart + 10], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const lineY = (1 - lineAlpha) * 6;
            return (
              <div
                key={`${idx}-${line.text}`}
                style={{
                  opacity: lineAlpha,
                  transform: `translateY(${lineY}px)`,
                  color: line.color || (line.dim ? '#94A3B8' : '#E2E8F0'),
                  padding: line.highlight ? '6px 10px' : '0px',
                  borderRadius: line.highlight ? 8 : 0,
                  backgroundColor: line.highlight ? 'rgba(56,189,248,0.12)' : 'transparent',
                  border: line.highlight ? '1px solid rgba(56,189,248,0.38)' : 'none',
                }}
              >
                {line.text}
              </div>
            );
          })}
        </div>

        {cmdDone && (
          <div style={{ marginTop: 'auto', paddingTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: accentColor, fontWeight: 700 }}>$</span>
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 14,
                backgroundColor: accentColor,
                opacity: cursorOn ? 0.9 : 0.15,
              }}
            />
          </div>
        )}
      </div>

      {footer && (
        <div
          style={{
            padding: '9px 18px',
            backgroundColor: '#151B29',
            borderTop: '1px solid rgba(148,163,184,0.14)',
            fontFamily: FONT_MONO,
            fontSize: 11,
            color: '#94A3B8',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>{footer}</span>
          <span style={{ color: accentColor }}>READY</span>
        </div>
      )}
    </div>
  );
};

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
  useWebFonts();

  const activeIdx = chapters.findIndex((c) => frame >= c.start && frame < c.end);
  const currentIdx = activeIdx === -1 ? chapters.length - 1 : activeIdx;
  const progress = Math.min(1, Math.max(0, frame / Math.max(1, durationInFrames - 1)));
  const gridShiftX = -(frame * 0.24) % 48;
  const gridShiftY = -(frame * 0.12) % 48;

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
        backgroundPosition: `${gridShiftX}px ${gridShiftY}px`,
        fontFamily: FONT_SANS,
        color: PALETTE.ink,
        display: 'flex',
        flexDirection: 'column',
        WebkitFontSmoothing: 'antialiased',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {/* Subtle architectural vignette framing (neutral silver-slate, no neon/blobs) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(244,246,250,0) 18%, rgba(244,246,250,0) 82%, rgba(226,232,240,0.35) 100%)',
          zIndex: 1,
        }}
      />

      {/* Top chrome bar */}
      <div
        style={{
          height: 56,
          padding: '0 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${PALETTE.border}`,
          backgroundColor: 'rgba(255, 255, 255, 0.94)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.9), 0 4px 16px rgba(15,23,42,0.03)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: '0.07em',
              padding: '4px 10px',
              borderRadius: 7,
              backgroundColor: accentColor,
              color: '#FFFFFF',
            }}
          >
            {badge}
          </span>
          <span
            style={{
              fontSize: 15.5,
              fontWeight: 650,
              letterSpacing: '-0.02em',
              color: PALETTE.ink,
            }}
          >
            {title}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 12.5,
                fontWeight: 700,
                color: accentColor,
              }}
            >
              0{currentIdx + 1} / 0{chapters.length}
            </span>
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: PALETTE.muted,
              }}
            >
              {chapters[currentIdx]?.label}
            </span>
          </div>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11.5,
              fontWeight: 600,
              color: PALETTE.muted,
              padding: '3px 8px',
              borderRadius: 6,
              backgroundColor: PALETTE.cardSoft,
              border: `1px solid ${PALETTE.border}`,
            }}
          >
            {formatTimecode(frame)} / {formatTimecode(durationInFrames)}
          </span>
        </div>
      </div>

      {/* Main stage */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          padding: '24px 40px 20px',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 5,
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
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {chapters.map((ch, idx) => {
            const active = idx === currentIdx;
            const past = idx < currentIdx;
            const chProgress = active
              ? Math.min(1, Math.max(0, (frame - ch.start) / Math.max(1, ch.end - ch.start)))
              : past
                ? 1
                : 0;
            return (
              <div
                key={ch.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  opacity: active ? 1 : past ? 0.72 : 0.42,
                }}
              >
                <div
                  style={{
                    width: active ? 28 : 8,
                    height: 6,
                    borderRadius: 99,
                    backgroundColor: PALETTE.border,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${chProgress * 100}%`,
                      height: '100%',
                      borderRadius: 99,
                      backgroundColor: active ? accentColor : PALETTE.muted,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 11.5,
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
            fontSize: 11.5,
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
    <path d="M -12 22 L 0 -16 L 12 22 Z" fill="none" stroke={color} strokeWidth={2.4} strokeLinejoin="round" />
    <line x1={-7} y1={10} x2={7} y2={10} stroke={color} strokeWidth={2} />
    <line x1={-4} y1={0} x2={4} y2={0} stroke={color} strokeWidth={2} />
    <circle cx={0} cy={-20} r={3.5} fill={color} />
    <path d="M -9 -26 A 12 12 0 0 0 -9 -14" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    <path d="M 9 -26 A 12 12 0 0 1 9 -14" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    <text
      x={0}
      y={38}
      textAnchor="middle"
      fontFamily={FONT_MONO}
      fontSize={12}
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
    <rect x={-9} y={-15} width={18} height={30} rx={4} fill="#FFFFFF" stroke={color} strokeWidth={2.2} />
    <line x1={-4} y1={10} x2={4} y2={10} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    {label && (
      <text
        x={0}
        y={-22}
        textAnchor="middle"
        fontFamily={FONT_MONO}
        fontSize={11}
        fontWeight={700}
        fill={color}
      >
        {label}
      </text>
    )}
  </g>
);
