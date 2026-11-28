import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  BaseStationIcon,
  Chapter,
  enterSpring,
  fadeWindow,
  FONT_MONO,
  FrameChrome,
  GLASS_CARD_STYLE,
  PALETTE,
  UeDeviceIcon,
} from './theme';
export const MWC26_DURATION = 1350; // 45s @ 30fps

const CHAPTERS: Chapter[] = [
  { label: 'Overview', start: 0, end: 210 },
  { label: 'Anomalies', start: 210, end: 480 },
  { label: 'LLM AI-RIC', start: 480, end: 780 },
  { label: 'Predictive BF', start: 780, end: 1080 },
  { label: 'Results', start: 1080, end: 1350 },
];

const SceneOverview: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const opacity = fadeWindow(frame, 0, 210, 14);
  const s1 = enterSpring(frame, 4, fps);
  const s2 = enterSpring(frame, 18, fps);
  const s3 = enterSpring(frame, 36, fps);

  return (
    <div
      style={{
        position: 'absolute',
        inset: '26px 40px 22px',
        opacity,
        display: 'grid',
        gridTemplateColumns: '1.18fr 0.82fr',
        gap: 28,
        alignItems: 'center',
      }}
    >
      <div style={{ transform: `translateY(${(1 - s1) * 18}px)` }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 12px',
            borderRadius: 999,
            ...GLASS_CARD_STYLE,
            fontFamily: FONT_MONO,
            fontSize: 13,
            fontWeight: 600,
            color: PALETTE.navy,
            marginBottom: 18,
          }}
        >
          <span>MWC&apos;26 BARCELONA</span>
          <span style={{ color: PALETTE.border }}>·</span>
          <span>AI-RAN ALLIANCE BOOTH</span>
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 48,
            lineHeight: 1.08,
            fontWeight: 800,
            letterSpacing: '-0.035em',
            color: PALETTE.ink,
          }}
        >
          LLM-Based 5G Beamforming
        </h1>
        <p
          style={{
            margin: '14px 0 0',
            fontSize: 22,
            lineHeight: 1.4,
            fontWeight: 500,
            color: PALETTE.muted,
          }}
        >
          Mobility-Aware Interference Mitigation &amp; Power Saving under Real-World Anomalies
        </p>

        <div
          style={{
            marginTop: 26,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 12,
            opacity: s2,
            transform: `translateY(${(1 - s2) * 14}px)`,
          }}
        >
          {[
            { k: 'ADAPTATION', v: 'In-Context Learning', sub: 'Zero retraining' },
            { k: 'LATENCY FIX', v: 'Predictive BF', sub: '1-step ahead control' },
            { k: 'TESTBED', v: 'VIAVI AI RSG', sub: 'TeraVM 5G mMIMO' },
          ].map((item) => (
            <div
              key={item.k}
              style={{
                ...GLASS_CARD_STYLE,
                borderRadius: 15,
                padding: '15px 16px',
              }}
            >
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  fontWeight: 700,
                  color: PALETTE.muted,
                  letterSpacing: '0.06em',
                }}
              >
                {item.k}
              </div>
              <div
                style={{
                  marginTop: 5,
                  fontSize: 17,
                  fontWeight: 750,
                  color: PALETTE.navy,
                }}
              >
                {item.v}
              </div>
              <div style={{ marginTop: 2, fontSize: 13, color: PALETTE.muted }}>
                {item.sub}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right headline metrics preview card */}
      <div
        style={{
          backgroundColor: PALETTE.card,
          border: `1px solid ${PALETTE.border}`,
          borderRadius: 20,
          padding: 26,
          boxShadow: '0 14px 36px light-dark(rgba(20, 25, 35, 0.06), rgba(0, 0, 0, 0.22))',
          opacity: s3,
          transform: `translateY(${(1 - s3) * 16}px)`,
        }}
      >
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 12,
            fontWeight: 700,
            color: PALETTE.orange,
            letterSpacing: '0.07em',
          }}
        >
          KEY BENCHMARK HIGHLIGHTS · IRREGULAR UE REPORTS
        </div>

        <div style={{ marginTop: 18, display: 'grid', gap: 14 }}>
          {[
            {
              label: 'Downlink Throughput Gain',
              value: '+133.99%',
              detail: '7.03 → 16.45 Mbps vs. Conventional AI-BF',
              color: PALETTE.orange,
              bg: PALETTE.amberSoft,
            },
            {
              label: 'Anomaly Robustness Gain',
              value: '+310.34%',
              detail: '0.25 → 0.90 normalized throughput',
              color: PALETTE.navy,
              bg: PALETTE.blueSoft,
            },
            {
              label: 'Energy Efficiency Gain',
              value: '+95.7%',
              detail: '75.38 → 147.53 TP/Joule',
              color: PALETTE.teal,
              bg: PALETTE.greenSoft,
            },
          ].map((m) => (
            <div
              key={m.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: 12,
                backgroundColor: m.bg,
                border: `1px solid ${PALETTE.border}`,
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: PALETTE.ink }}>
                  {m.label}
                </div>
                <div style={{ fontSize: 12.5, color: PALETTE.muted, marginTop: 2 }}>
                  {m.detail}
                </div>
              </div>
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 25,
                  fontWeight: 800,
                  color: m.color,
                  letterSpacing: '-0.03em',
                }}
              >
                {m.value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: `1px solid ${PALETTE.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: FONT_MONO,
            fontSize: 12,
            color: PALETTE.muted,
          }}
        >
          <span>Yonsei University · SUTD · VIAVI</span>
          <span>5G Massive MIMO</span>
        </div>
      </div>
    </div>
  );
};

const SceneAnomalies: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 210;
  const opacity = fadeWindow(frame, 210, 480, 14);
  const c1 = enterSpring(local, 8, fps);
  const c2 = enterSpring(local, 28, fps);
  const c3 = enterSpring(local, 48, fps);
  const packetProgress = (local % 70) / 70;

  return (
    <div
      style={{
        position: 'absolute',
        inset: '26px 40px 22px',
        opacity,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 12,
            fontWeight: 700,
            color: PALETTE.red,
            letterSpacing: '0.07em',
          }}
        >
          PROBLEM · WHY CONVENTIONAL AI BEAMFORMING DEGRADES IN REAL NETWORKS
        </div>
        <h2 style={{ margin: '6px 0 0', fontSize: 32, fontWeight: 780, letterSpacing: '-0.025em' }}>
          Three Real-World Deployment Bottlenecks
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 18, flex: 1 }}>
        {/* Card 1: Irregular UE Report Timing */}
        <div
          style={{
            backgroundColor: PALETTE.card,
            border: `1px solid ${PALETTE.border}`,
            borderRadius: 18,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            transform: `translateY(${(1 - c1) * 20}px)`,
            opacity: c1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 12,
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 6,
                backgroundColor: PALETTE.amberSoft,
                color: PALETTE.orange,
              }}
            >
              ISSUE 01
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted }}>
              Missing / Delayed
            </span>
          </div>
          <h3 style={{ margin: '12px 0 6px', fontSize: 20, fontWeight: 750 }}>
            Irregular UE Report Timing
          </h3>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: PALETTE.muted }}>
            Handovers, Wi-Fi offloading, and short disconnections drop UE reports, leaving conventional AI-BF with stale observations.
          </p>

          <svg viewBox="0 0 320 175" style={{ width: '100%', marginTop: 'auto' }}>
            <rect x={8} y={14} width={304} height={150} rx={12} fill={PALETTE.cardSoft} stroke={PALETTE.border} />
            <UeDeviceIcon x={56} y={88} label="UE" color={PALETTE.ink} />
            <BaseStationIcon x={262} y={88} label="BS" color={PALETTE.navy} />
            <line x1={82} y1={88} x2={232} y2={88} stroke={PALETTE.border} strokeWidth={2} strokeDasharray="5 5" />
            {[0, 1, 2, 3, 4].map((i) => {
              const x = 96 + i * 28 + packetProgress * 10;
              const dropped = i === 2 || i === 3;
              return (
                <g key={i}>
                  <circle
                    cx={x}
                    cy={88}
                    r={6}
                    fill={dropped ? PALETTE.red : PALETTE.blue}
                    opacity={dropped ? 0.25 : 0.9}
                  />
                  {dropped && (
                    <text
                      x={x}
                      y={92}
                      textAnchor="middle"
                      fontFamily={FONT_MONO}
                      fontSize={12}
                      fontWeight={800}
                      fill={PALETTE.red}
                    >
                      ×
                    </text>
                  )}
                </g>
              );
            })}
            <text x={160} y={144} textAnchor="middle" fontFamily={FONT_MONO} fontSize={11.5} fontWeight={700} fill={PALETTE.red}>
              Stale CSI → Suboptimal Beam Angles
            </text>
          </svg>
        </div>

        {/* Card 2: External Interferers / Regional Anomaly */}
        <div
          style={{
            ...GLASS_CARD_STYLE,
            borderRadius: 18,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            transform: `translateY(${(1 - c2) * 20}px)`,
            opacity: c2,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 12,
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 6,
                backgroundColor: PALETTE.purpleSoft,
                color: PALETTE.purple,
              }}
            >
              ISSUE 02
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted }}>
              20 dB RF Loss
            </span>
          </div>
          <h3 style={{ margin: '12px 0 6px', fontSize: 20, fontWeight: 750 }}>
            Jamming &amp; Regional Anomaly
          </h3>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: PALETTE.muted }}>
            External interferers and environmental changes degrade RF quality outside normal CSI training distributions (VIAVI AI RSG anomaly zone).
          </p>

          <svg viewBox="0 0 320 175" style={{ width: '100%', marginTop: 'auto' }}>
            <rect x={8} y={14} width={304} height={150} rx={12} fill={PALETTE.cardSoft} stroke={PALETTE.border} />
            <rect
              x={116}
              y={32}
              width={92}
              height={88}
              rx={10}
              fill={PALETTE.redSoft}
              stroke={PALETTE.red}
              strokeWidth={1.8}
              strokeDasharray="4 4"
            />
            <text x={162} y={50} textAnchor="middle" fontFamily={FONT_MONO} fontSize={10.5} fontWeight={700} fill={PALETTE.red}>
              ANOMALY ZONE
            </text>
            <BaseStationIcon x={56} y={88} label="BS_A" color={PALETTE.navy} />
            <BaseStationIcon x={266} y={88} label="BS_B" color={PALETTE.navy} />
            <polygon points="62,64 185,68 175,98" fill={PALETTE.red} opacity={0.22} />
            <polygon points="260,64 138,70 148,100" fill={PALETTE.red} opacity={0.22} />
            <UeDeviceIcon x={162} y={86} color={PALETTE.red} />
            <text x={160} y={145} textAnchor="middle" fontFamily={FONT_MONO} fontSize={9.6} fontWeight={700} fill={PALETTE.purple}>
              RSRP -5 dB · RSSINR -10 dB · Overlapping Beams
            </text>
          </svg>
        </div>

        {/* Card 3: LLM Inference Latency */}
        <div
          style={{
            backgroundColor: PALETTE.card,
            border: `1px solid ${PALETTE.border}`,
            borderRadius: 18,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            transform: `translateY(${(1 - c3) * 20}px)`,
            opacity: c3,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 12,
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 6,
                backgroundColor: PALETTE.blueSoft,
                color: PALETTE.navy,
              }}
            >
              ISSUE 03
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted }}>
              Timing Budget
            </span>
          </div>
          <h3 style={{ margin: '12px 0 6px', fontSize: 20, fontWeight: 750 }}>
            LLM Inference Delay
          </h3>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: PALETTE.muted }}>
            LLM inference takes ~1,475 ms vs. 34 ms for conventional controllers — purely reactive LLM actions arrive too late for moving UEs.
          </p>

          <div
            style={{
              marginTop: 'auto',
              backgroundColor: PALETTE.cardSoft,
              border: `1px solid ${PALETTE.border}`,
              borderRadius: 12,
              padding: 16,
              display: 'grid',
              gap: 14,
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700 }}>
                <span>Conventional AI-BF</span>
                <span style={{ color: PALETTE.blue }}>34 ms</span>
              </div>
              <div style={{ marginTop: 6, height: 12, borderRadius: 6, backgroundColor: 'light-dark(#E2E8F0, #3B414B)' }}>
                <div style={{ width: '8%', height: '100%', borderRadius: 6, backgroundColor: PALETTE.blue }} />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700 }}>
                <span>LLM-Based AI-BF</span>
                <span style={{ color: PALETTE.orange }}>1,475 ms</span>
              </div>
              <div style={{ marginTop: 6, height: 12, borderRadius: 6, backgroundColor: 'light-dark(#E2E8F0, #3B414B)' }}>
                <div
                  style={{
                    width: `${interpolate(local, [55, 110], [10, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}%`,
                    height: '100%',
                    borderRadius: 6,
                    backgroundColor: PALETTE.orange,
                  }}
                />
              </div>
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 700, color: PALETTE.teal }}>
              → Solved via 1-Step-Ahead Predictive Beamforming
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SceneArchitecture: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 480;
  const opacity = fadeWindow(frame, 480, 780, 14);
  const s1 = enterSpring(local, 6, fps);
  const s2 = enterSpring(local, 28, fps);
  const s3 = enterSpring(local, 52, fps);

  return (
    <div
      style={{
        position: 'absolute',
        inset: '26px 40px 22px',
        opacity,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.teal, letterSpacing: '0.07em' }}>
          ARCHITECTURE · LLM-BASED AI-RIC WITH IN-CONTEXT LEARNING (ZERO RETRAINING)
        </div>
        <h2 style={{ margin: '6px 0 0', fontSize: 31, fontWeight: 780, letterSpacing: '-0.025em' }}>
          Situation-Specific Prompting + Predictive Control Loop
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '0.92fr 1.25fr 0.92fr', gap: 16, flex: 1 }}>
        {/* Left: VIAVI TeraVM AI RSG */}
        <div
          style={{
            backgroundColor: PALETTE.card,
            border: `1px solid ${PALETTE.border}`,
            borderRadius: 16,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            opacity: s1,
            transform: `translateY(${(1 - s1) * 16}px)`,
          }}
        >
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.purple }}>
            1. VIAVI TeraVM AI RSG
          </div>
          <div style={{ backgroundColor: PALETTE.cardSoft, borderRadius: 12, padding: 14, border: `1px solid ${PALETTE.border}` }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>UE Report Stream</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: PALETTE.muted, marginTop: 4 }}>
              • RSRP &amp; UE Location<br />• Missing / delayed flags
            </div>
          </div>
          <div style={{ backgroundColor: PALETTE.cardSoft, borderRadius: 12, padding: 14, border: `1px solid ${PALETTE.border}` }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>Cell Report Stream</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: PALETTE.muted, marginTop: 4 }}>
              • DL Throughput (Mbps)<br />• Avg. Tx Power (W)
            </div>
          </div>
          <div
            style={{
              marginTop: 'auto',
              padding: '12px 14px',
              borderRadius: 12,
              backgroundColor: PALETTE.amberSoft,
              border: `1px solid light-dark(#FDBA74, #BF8957)`,
              fontSize: 13,
              fontWeight: 650,
              color: PALETTE.orange,
            }}
          >
            Closed-Loop Feedback: BS Actions return directly to BS_A &amp; BS_B beam controllers
          </div>
        </div>

        {/* Center: LLM-Based AI-RIC Prompting */}
        <div
          style={{
            backgroundColor: PALETTE.card,
            border: `2px solid ${PALETTE.teal}`,
            borderRadius: 16,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            opacity: s2,
            transform: `translateY(${(1 - s2) * 16}px)`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.teal }}>
              2. LLM-BASED AI-RIC · IN-CONTEXT LEARNING
            </span>
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 999,
                backgroundColor: PALETTE.greenSoft,
                color: PALETTE.teal,
              }}
            >
              NO MODEL UPDATES
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ padding: 11, borderRadius: 10, backgroundColor: PALETTE.blueSoft, border: `1px solid ${PALETTE.border}` }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, color: PALETTE.navy }}>ONLINE CONTEXT</div>
              <div style={{ fontSize: 12.5, color: PALETTE.ink, marginTop: 3 }}>Recent network reports &amp; anomaly alerts</div>
            </div>
            <div style={{ padding: 11, borderRadius: 10, backgroundColor: PALETTE.cardSoft, border: `1px solid ${PALETTE.border}` }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, color: PALETTE.muted }}>OFFLINE GUIDANCE</div>
              <div style={{ fontSize: 12.5, color: PALETTE.ink, marginTop: 3 }}>Pre-labeled historical beam trajectories</div>
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#141923',
              color: '#E5E7EB',
              borderRadius: 12,
              padding: '13px 15px',
              fontFamily: FONT_MONO,
              fontSize: 12,
              lineHeight: 1.55,
              flex: 1,
            }}
          >
            <div style={{ color: '#93C5FD', fontWeight: 700 }}>// Structured Controller Prompt (JSON only)</div>
            <div style={{ color: '#FDE68A', marginTop: 5 }}># RULE 1: Irregular Timing Handling</div>
            <div>If report is MISSING or DELAYED → infer UE state from historical trajectory.</div>
            <div style={{ color: '#FDA4AF', marginTop: 7 }}># RULE 2: Anomaly Handling</div>
            <div>High interference in Region A → avoid overlapping beams in anomaly zones.</div>
            <div style={{ color: '#6EE7B7', marginTop: 8 }}>
              → Output: {`{"b1": [1,0,0,1], "b2": [0,1,0,0]}`}
            </div>
          </div>
        </div>

        {/* Right: Predictive Beamforming */}
        <div
          style={{
            backgroundColor: PALETTE.card,
            border: `1px solid ${PALETTE.border}`,
            borderRadius: 16,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            opacity: s3,
            transform: `translateY(${(1 - s3) * 16}px)`,
          }}
        >
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.navy }}>
            3. PREDICTIVE BEAMFORMING
          </div>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: PALETTE.muted }}>
            To overcome the 1,475 ms LLM inference time, the AI-RIC forecasts UE positions <strong>one step ahead</strong> and emits proactive beam actions on time.
          </p>

          <svg viewBox="0 0 300 215" style={{ width: '100%', marginTop: 'auto' }}>
            <rect x={4} y={6} width={292} height={202} rx={12} fill={PALETTE.cardSoft} stroke={PALETTE.border} />
            <BaseStationIcon x={46} y={78} label="BS_A" color={PALETTE.navy} />
            <BaseStationIcon x={252} y={78} label="BS_B" color={PALETTE.navy} />

            {/* Trajectory */}
            <path d="M 96 42 Q 145 78 134 114" fill="none" stroke={PALETTE.orange} strokeWidth={2.5} strokeDasharray="5 4" />
            <UeDeviceIcon x={96} y={42} label="t" color={PALETTE.muted} />
            <UeDeviceIcon x={134} y={114} label="t+1 (pred)" color={PALETTE.teal} />

            {/* Predicted beam toward t+1 */}
            <polygon points="50,56 144,100 124,132" fill={PALETTE.teal} opacity={0.24} />
            <polygon points="248,56 184,96 202,126" fill={PALETTE.blue} opacity={0.2} />

            {/* On-time badge */}
            <rect x={10} y={160} width={280} height={34} rx={8} fill={PALETTE.navy} />
            <text x={150} y={181} textAnchor="middle" fontFamily={FONT_MONO} fontSize={11.5} fontWeight={700} fill={PALETTE.onAccent}>
              1-Step Predict → Action ON TIME
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
};

const SceneLiveComparison: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 780;
  const opacity = fadeWindow(frame, 780, 1080, 14);
  const progress = interpolate(local, [15, 250], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const s = enterSpring(local, 6, fps);

  // Build throughput chart points (0..100%)
  // Regular (0..0.28), Irregularity Window (0.28..0.78), Recovery (0.78..1.0)
  const samples = 44;
  const llmPts: string[] = [];
  const convPts: string[] = [];
  const visibleCount = Math.max(2, Math.floor(progress * samples));

  for (let i = 0; i <= visibleCount; i++) {
    const t = i / samples;
    const x = 44 + t * 500;
    const inAnomaly = t >= 0.28 && t <= 0.78;
    const llmMbps = inAnomaly
      ? 16.45 + Math.sin(i * 1.1) * 0.7
      : 16.9 + Math.cos(i * 0.9) * 0.6;
    const convMbps = inAnomaly
      ? 7.03 + Math.sin(i * 2.1) * 2.1
      : 16.5 + Math.sin(i * 1.4) * 2.4;
    const yLlm = 184 - (llmMbps / 22) * 145;
    const yConv = 184 - (convMbps / 22) * 145;
    llmPts.push(`${x.toFixed(1)},${yLlm.toFixed(1)}`);
    convPts.push(`${x.toFixed(1)},${yConv.toFixed(1)}`);
  }

  // UE movement animation
  const ueX = interpolate(progress, [0, 1], [150, 315]);
  const ueY = 128 + Math.sin(progress * Math.PI * 1.5) * 32;
  const predX = Math.min(340, ueX + 34);
  const predY = 128 + Math.sin(Math.min(1, progress + 0.12) * Math.PI * 1.5) * 32;

  return (
    <div
      style={{
        position: 'absolute',
        inset: '26px 40px 22px',
        opacity,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.orange, letterSpacing: '0.07em' }}>
          LIVE EVALUATION · VIAVI TeraVM AI RSG (IRREGULAR UE REPORT TIMING)
        </div>
        <h2 style={{ margin: '6px 0 0', fontSize: 30, fontWeight: 780, letterSpacing: '-0.025em' }}>
          Proactive Beam Tracking Keeps Throughput Stable Through Missing Reports
        </h2>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '0.96fr 1.04fr',
          gap: 18,
          flex: 1,
          opacity: s,
        }}
      >
        {/* Left: Live multi-cell predictive beamforming SVG */}
        <div
          style={{
            backgroundColor: PALETTE.card,
            border: `1px solid ${PALETTE.border}`,
            borderRadius: 18,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.navy }}>
              MULTI-CELL PREDICTIVE BEAM STEERING
            </span>
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 6,
                backgroundColor: progress >= 0.28 && progress <= 0.78 ? PALETTE.redSoft : PALETTE.greenSoft,
                color: progress >= 0.28 && progress <= 0.78 ? PALETTE.red : PALETTE.teal,
              }}
            >
              {progress >= 0.28 && progress <= 0.78 ? 'REPORTS MISSING · ICL ACTIVE' : 'REGULAR REPORTS'}
            </span>
          </div>

          <svg viewBox="0 0 480 265" style={{ width: '100%', flex: 1 }}>
            <rect x={4} y={4} width={472} height={257} rx={12} fill={PALETTE.cardSoft} stroke={PALETTE.border} />

            {/* BS_A & BS_B */}
            <BaseStationIcon x={68} y={134} label="BS_A" color={PALETTE.navy} />
            <BaseStationIcon x={412} y={134} label="BS_B" color={PALETTE.navy} />

            {/* Trajectory arc */}
            <path
              d="M 150 128 Q 230 175 315 100"
              fill="none"
              stroke={PALETTE.border}
              strokeWidth={2}
              strokeDasharray="5 5"
            />

            {/* Predictive beam from handover BS */}
            {ueX < 245 ? (
              <polygon
                points={`72,110 ${predX - 18},${predY - 22} ${predX + 18},${predY + 22}`}
                fill={PALETTE.teal}
                opacity={0.28}
              />
            ) : (
              <polygon
                points={`408,110 ${predX - 18},${predY - 22} ${predX + 18},${predY + 22}`}
                fill={PALETTE.teal}
                opacity={0.28}
              />
            )}

            {/* Secondary static UE served cleanly by the other BS */}
            {ueX < 245 ? (
              <polygon points="408,110 315,172 340,204" fill={PALETTE.blue} opacity={0.18} />
            ) : (
              <polygon points="72,110 135,172 162,202" fill={PALETTE.blue} opacity={0.18} />
            )}

            {/* Predicted target ring */}
            <circle cx={predX} cy={predY} r={16} fill="none" stroke={PALETTE.teal} strokeWidth={2} strokeDasharray="3 3" />
            <line x1={ueX} y1={ueY} x2={predX} y2={predY} stroke={PALETTE.teal} strokeWidth={2} />

            {/* Moving UE */}
            <UeDeviceIcon x={ueX} y={ueY} label="UE 1" color={PALETTE.orange} />
            <UeDeviceIcon x={ueX < 245 ? 328 : 148} y={188} label="UE 2" color={PALETTE.blue} />

            {/* Legend */}
            <text x={240} y={244} textAnchor="middle" fontFamily={FONT_MONO} fontSize={10.5} fontWeight={600} fill={PALETTE.muted}>
              Dashed ring: 1-step predicted UE · Non-overlapping BS_A / BS_B beams
            </text>
          </svg>
        </div>

        {/* Right: Animated Throughput Time-Series Chart */}
        <div
          style={{
            backgroundColor: PALETTE.card,
            border: `1px solid ${PALETTE.border}`,
            borderRadius: 18,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.ink }}>
              DOWNLINK THROUGHPUT (Mbps)
            </span>
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 13,
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: 6,
                backgroundColor: PALETTE.amberSoft,
                color: PALETTE.orange,
              }}
            >
              Gain +133.99%
            </span>
          </div>

          <svg viewBox="0 0 568 265" style={{ width: '100%', flex: 1 }}>
            {/* Anomaly shaded region */}
            <rect x={44 + 0.28 * 500} y={26} width={0.5 * 500} height={158} fill={PALETTE.redSoft} />
            <text
              x={44 + 0.53 * 500}
              y={44}
              textAnchor="middle"
              fontFamily={FONT_MONO}
              fontSize={11}
              fontWeight={700}
              fill={PALETTE.red}
            >
              IRREGULAR UE REPORT TIMING REGION
            </text>

            {/* Horizontal grid lines */}
            {[0, 5, 10, 15, 20].map((v) => {
              const y = 184 - (v / 22) * 145;
              return (
                <g key={v}>
                  <line x1={44} y1={y} x2={544} y2={y} stroke={PALETTE.grid} strokeWidth={1} />
                  <text x={36} y={y + 4} textAnchor="end" fontFamily={FONT_MONO} fontSize={10.5} fill={PALETTE.muted}>
                    {v}
                  </text>
                </g>
              );
            })}

            {/* Axes */}
            <line x1={44} y1={26} x2={44} y2={184} stroke={PALETTE.border} strokeWidth={1.5} />
            <line x1={44} y1={184} x2={544} y2={184} stroke={PALETTE.border} strokeWidth={1.5} />

            {/* Curves */}
            <polyline fill="none" stroke={PALETTE.blue} strokeWidth={2.6} points={convPts.join(' ')} />
            <polyline fill="none" stroke={PALETTE.orange} strokeWidth={3.2} points={llmPts.join(' ')} />

            {/* Mean callouts */}
            {progress > 0.55 && (
              <g>
                <line x1={44 + 0.28 * 500} y1={184 - (16.45 / 22) * 145} x2={44 + 0.78 * 500} y2={184 - (16.45 / 22) * 145} stroke={PALETTE.orange} strokeWidth={1.4} strokeDasharray="4 3" />
                <rect x={44 + 0.53 * 500 - 106} y={184 - (16.45 / 22) * 145 - 24} width={212} height={19} rx={5} fill={PALETTE.card} fillOpacity={0.92} />
                <text x={44 + 0.53 * 500} y={184 - (16.45 / 22) * 145 - 10} textAnchor="middle" fontFamily={FONT_MONO} fontSize={11.5} fontWeight={800} fill={PALETTE.orange}>
                  LLM-Based AI-BF: 16.45 Mbps
                </text>
                <line x1={44 + 0.28 * 500} y1={184 - (7.03 / 22) * 145} x2={44 + 0.78 * 500} y2={184 - (7.03 / 22) * 145} stroke={PALETTE.blue} strokeWidth={1.4} strokeDasharray="4 3" />
                <rect x={44 + 0.53 * 500 - 108} y={184 - (7.03 / 22) * 145 + 14} width={216} height={19} rx={5} fill={PALETTE.card} fillOpacity={0.92} />
                <text x={44 + 0.53 * 500} y={184 - (7.03 / 22) * 145 + 27} textAnchor="middle" fontFamily={FONT_MONO} fontSize={11.5} fontWeight={700} fill={PALETTE.blue}>
                  Conventional AI-BF: 7.03 Mbps
                </text>
              </g>
            )}

            {/* Legend row */}
            <g transform="translate(52, 214)">
              <rect x={0} y={0} width={16} height={4} rx={2} fill={PALETTE.orange} />
              <text x={24} y={6} fontFamily={FONT_MONO} fontSize={12} fontWeight={700} fill={PALETTE.ink}>
                LLM-Based AI-BF (Predictive)
              </text>
              <rect x={260} y={0} width={16} height={4} rx={2} fill={PALETTE.blue} />
              <text x={284} y={6} fontFamily={FONT_MONO} fontSize={12} fontWeight={600} fill={PALETTE.muted}>
                Conventional AI-BF
              </text>
            </g>
            <text x={294} y={248} textAnchor="middle" fontFamily={FONT_MONO} fontSize={11} fill={PALETTE.muted}>
              Time (Simulation Steps) · Regular → Irregularity Window → Recovery
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
};

const SceneResults: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 1080;
  const opacity = fadeWindow(frame, 1080, 1350, 14);
  const s1 = enterSpring(local, 6, fps);
  const s2 = enterSpring(local, 24, fps);

  const renderMetricRow = (
    label: string,
    gain: string,
    baseVal: string,
    llmVal: string,
    basePct: number,
    llmPct: number,
    accent: string
  ) => {
    const barScale = interpolate(local, [18, 65], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    return (
      <div
        key={label}
        style={{
          padding: '13px 16px',
          borderRadius: 12,
          backgroundColor: PALETTE.cardSoft,
          border: `1px solid ${PALETTE.border}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: PALETTE.ink }}>{label}</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 19, fontWeight: 800, color: accent }}>
            {gain}
          </span>
        </div>
        <div style={{ marginTop: 8, display: 'grid', gap: 5 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '108px 1fr 82px', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: PALETTE.muted }}>AI-BF + LLM</span>
            <div style={{ height: 9, borderRadius: 5, backgroundColor: 'light-dark(#E2E8F0, #3B414B)' }}>
              <div style={{ width: `${llmPct * barScale}%`, height: '100%', borderRadius: 5, backgroundColor: accent }} />
            </div>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 700, textAlign: 'right' }}>{llmVal}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '108px 1fr 82px', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: PALETTE.muted }}>Conventional</span>
            <div style={{ height: 9, borderRadius: 5, backgroundColor: 'light-dark(#E2E8F0, #3B414B)' }}>
              <div style={{ width: `${basePct * barScale}%`, height: '100%', borderRadius: 5, backgroundColor: 'light-dark(#94A3B8, #9DA9BB)' }} />
            </div>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted, textAlign: 'right' }}>{baseVal}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: '26px 40px 22px',
        opacity,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.teal, letterSpacing: '0.07em' }}>
          EXPERIMENTAL RESULTS · SUMMARY ACROSS ANOMALY SCENARIOS
        </div>
        <h2 style={{ margin: '6px 0 0', fontSize: 31, fontWeight: 780, letterSpacing: '-0.025em' }}>
          Higher Throughput, Robustness &amp; Energy Efficiency Without Retraining
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, flex: 1 }}>
        {/* Left: Irregular UE Report Timing */}
        <div
          style={{
            ...GLASS_CARD_STYLE,
            borderRadius: 18,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            opacity: s1,
            transform: `translateY(${(1 - s1) * 16}px)`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 17, fontWeight: 750 }}>Scenario A · Irregular UE Report Timing</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, color: PALETTE.orange }}>MISSING / DELAYED</span>
          </div>
          {renderMetricRow('DL Throughput', '+133.99%', '7.03 Mbps', '16.45 Mbps', 43, 100, PALETTE.orange)}
          {renderMetricRow('Robustness (Norm. TP)', '+310.34%', '0.25', '0.90', 28, 90, PALETTE.navy)}
          {renderMetricRow('Energy Efficiency (TP/J)', '+95.7%', '75.38', '147.53', 51, 100, PALETTE.teal)}
        </div>

        {/* Right: Regional Anomaly */}
        <div
          style={{
            ...GLASS_CARD_STYLE,
            borderRadius: 18,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            opacity: s2,
            transform: `translateY(${(1 - s2) * 16}px)`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 17, fontWeight: 750 }}>Scenario B · Regional Anomaly</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, color: PALETTE.purple }}>EXTERNAL INTERFERERS</span>
          </div>
          {renderMetricRow('DL Throughput', '+25.87%', '8.04 Mbps', '10.12 Mbps', 79, 100, PALETTE.orange)}
          {renderMetricRow('Robustness (Norm. TP)', '+23.40%', '0.530', '0.654', 53, 66, PALETTE.navy)}
          {renderMetricRow('Energy Efficiency (TP/J)', '+3.15%', '85.39', '88.08', 91, 95, PALETTE.teal)}
        </div>
      </div>

      <div
        style={{
          padding: '12px 18px',
          borderRadius: 12,
          ...GLASS_CARD_STYLE,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 13.5,
          color: PALETTE.muted,
        }}
      >
        <span>
          <strong style={{ color: PALETTE.ink }}>Joint Demo Team:</strong> Yonsei University (RAMO Lab) · SUTD · VIAVI Solutions
        </span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.navy }}>
          MWC&apos;26 Barcelona · AI-RAN Alliance
        </span>
      </div>
    </div>
  );
};

export const Mwc26AiRanDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <FrameChrome
      badge="MWC'26"
      title="LLM-Based 5G Beamforming · Mobility-Aware Interference Mitigation & Power Saving"
      chapters={CHAPTERS}
      frame={frame}
      durationInFrames={MWC26_DURATION}
      accentColor={PALETTE.navy}
    >
      {frame < 224 && <SceneOverview frame={frame} fps={fps} />}
      {frame >= 196 && frame < 494 && <SceneAnomalies frame={frame} fps={fps} />}
      {frame >= 466 && frame < 794 && <SceneArchitecture frame={frame} fps={fps} />}
      {frame >= 766 && frame < 1094 && <SceneLiveComparison frame={frame} fps={fps} />}
      {frame >= 1066 && <SceneResults frame={frame} fps={fps} />}
    </FrameChrome>
  );
};
