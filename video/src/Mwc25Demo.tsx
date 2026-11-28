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

export const MWC25_DURATION = 1260; // 42s @ 30fps

const CHAPTERS: Chapter[] = [
  { label: 'Overview', start: 0, end: 195 },
  { label: 'Mobility', start: 195, end: 435 },
  { label: 'AI-RIC', start: 435, end: 720 },
  { label: 'AI Off vs On', start: 720, end: 990 },
  { label: 'AVE Results', start: 990, end: 1260 },
];

const SceneOverview: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const opacity = fadeWindow(frame, 0, 195, 14);
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
            border: `1px solid ${PALETTE.border}`,
            backgroundColor: PALETTE.card,
            fontFamily: FONT_MONO,
            fontSize: 13,
            fontWeight: 600,
            color: PALETTE.teal,
            marginBottom: 18,
          }}
        >
          <span>MWC&apos;25 BARCELONA</span>
          <span style={{ color: PALETTE.border }}>·</span>
          <span>AI-FOR-RAN DEMO</span>
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 47,
            lineHeight: 1.08,
            fontWeight: 800,
            letterSpacing: '-0.035em',
            color: PALETTE.ink,
          }}
        >
          Mobility-Aware AI-RIC Beamforming
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
          Hierarchical Deep RL for 5G Massive MIMO Interference Mitigation &amp; Energy Saving
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
            { k: 'BAND & ARRAY', v: 'FR1 3.6 GHz', sub: '64×64 Massive MIMO' },
            { k: 'TX BUDGET', v: '37 dBm', sub: '2 BS · 3 Moving UEs' },
            { k: 'SIMULATOR', v: 'VIAVI AI RSG', sub: 'AVE Analytics Console' },
          ].map((item) => (
            <div
              key={item.k}
              style={{
                backgroundColor: PALETTE.card,
                border: `1px solid ${PALETTE.border}`,
                borderRadius: 14,
                padding: '14px 16px',
              }}
            >
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, color: PALETTE.muted, letterSpacing: '0.06em' }}>
                {item.k}
              </div>
              <div style={{ marginTop: 5, fontSize: 17, fontWeight: 750, color: PALETTE.teal }}>
                {item.v}
              </div>
              <div style={{ marginTop: 2, fontSize: 13, color: PALETTE.muted }}>
                {item.sub}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right AVE Console highlights card */}
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
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.teal, letterSpacing: '0.07em' }}>
          VIAVI AVE CONSOLE · AI ON VS. AI OFF
        </div>

        <div style={{ marginTop: 18, display: 'grid', gap: 13 }}>
          {[
            {
              label: 'Energy Saving (Avg. Power)',
              value: '43.49%',
              detail: '37.7 kW → 21.3 kW average Tx power',
              color: PALETTE.teal,
              bg: PALETTE.greenSoft,
            },
            {
              label: 'DL Throughput Gain',
              value: '+22.71%',
              detail: '0.00290 → 0.00356 Gb/s',
              color: PALETTE.navy,
              bg: PALETTE.blueSoft,
            },
            {
              label: 'Energy Efficiency Gain',
              value: '+50.62%',
              detail: '0.161 → 0.243 Kbits/Joule',
              color: PALETTE.orange,
              bg: PALETTE.amberSoft,
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
                <div style={{ fontSize: 14, fontWeight: 700, color: PALETTE.ink }}>{m.label}</div>
                <div style={{ fontSize: 12.5, color: PALETTE.muted, marginTop: 2 }}>{m.detail}</div>
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 25, fontWeight: 800, color: m.color, letterSpacing: '-0.03em' }}>
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
          <span>AI-RAN Alliance</span>
        </div>
      </div>
    </div>
  );
};

const SceneMobility: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 195;
  const opacity = fadeWindow(frame, 195, 435, 14);
  const s1 = enterSpring(local, 6, fps);
  const s2 = enterSpring(local, 24, fps);
  const t = interpolate(local, [15, 200], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const ue1X = interpolate(t, [0, 1], [150, 310]);
  const ue1Y = 76 + Math.sin(t * Math.PI) * 32;
  const ue2X = interpolate(t, [0, 1], [340, 210]);
  const ue2Y = 178 - Math.sin(t * Math.PI) * 28;

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
          PROBLEM &amp; SCENARIO · MOVING UEs IN MULTI-BS 5G MASSIVE MIMO
        </div>
        <h2 style={{ margin: '6px 0 0', fontSize: 31, fontWeight: 780, letterSpacing: '-0.025em' }}>
          Rapid Mobility Turns Optimal Associations Into Interfering Beams
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 18, flex: 1 }}>
        {/* Left animated scenario diagram */}
        <div
          style={{
            backgroundColor: PALETTE.card,
            border: `1px solid ${PALETTE.border}`,
            borderRadius: 18,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            opacity: s1,
          }}
        >
          <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.navy, marginBottom: 8 }}>
            OUTDATED BS–UE ASSOCIATION UNDER UE MOBILITY
          </div>
          <svg viewBox="0 0 540 280" style={{ width: '100%', flex: 1 }}>
            <rect x={4} y={4} width={532} height={272} rx={12} fill={PALETTE.cardSoft} stroke={PALETTE.border} />

            <BaseStationIcon x={76} y={138} label="BS_A (37 dBm)" color={PALETTE.navy} />
            <BaseStationIcon x={464} y={138} label="BS_B (37 dBm)" color={PALETTE.navy} />

            {/* Orange mobility trajectories */}
            <path d="M 150 76 Q 230 120 310 76" fill="none" stroke={PALETTE.orange} strokeWidth={2.6} strokeDasharray="6 4" />
            <path d="M 340 178 Q 275 138 210 178" fill="none" stroke={PALETTE.orange} strokeWidth={2.6} strokeDasharray="6 4" />

            {/* Stale overlapping beams */}
            <polygon
              points={`80,114 ${ue1X + 18},${ue1Y - 20} ${ue1X - 10},${ue1Y + 24}`}
              fill={PALETTE.red}
              opacity={0.22}
            />
            <polygon
              points={`460,114 ${ue2X - 18},${ue2Y - 20} ${ue2X + 12},${ue2Y + 24}`}
              fill={PALETTE.red}
              opacity={0.22}
            />

            {/* Overlap highlight */}
            {t > 0.4 && (
              <g>
                <circle cx={268} cy={136} r={34} fill="none" stroke={PALETTE.red} strokeWidth={2.2} strokeDasharray="4 4" />
                <text x={268} y={240} textAnchor="middle" fontFamily={FONT_MONO} fontSize={12} fontWeight={800} fill={PALETTE.red}>
                  Overlapping Beams → Inter-Cell Interference &amp; Wasted Tx Power
                </text>
              </g>
            )}

            <UeDeviceIcon x={ue1X} y={ue1Y} label="UE 1" color={PALETTE.red} />
            <UeDeviceIcon x={ue2X} y={ue2Y} label="UE 2" color={PALETTE.red} />
          </svg>
        </div>

        {/* Right: Problem bullets + RSG specs */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            opacity: s2,
            transform: `translateY(${(1 - s2) * 16}px)`,
          }}
        >
          <div style={{ backgroundColor: PALETTE.card, border: `1px solid ${PALETTE.border}`, borderRadius: 16, padding: 18 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.red }}>KEY CHALLENGES</div>
            <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 14.5, lineHeight: 1.6, color: PALETTE.ink }}>
              <li><strong>Perfect CSI</strong> is hardly achievable under UE mobility.</li>
              <li>Previously optimal <strong>BS–UE associations</strong> rapidly become outdated.</li>
              <li>Uncoordinated beams overlap across cells, degrading SINR and wasting BS power.</li>
            </ul>
          </div>

          <div style={{ backgroundColor: PALETTE.card, border: `1px solid ${PALETTE.border}`, borderRadius: 16, padding: 18, flex: 1 }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.purple }}>
              VIAVI RAN SCENARIO GENERATOR (RSG)
            </div>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { name: 'UE 1', path: 'M 22 10 L 58 10 L 58 44 L 22 44 L 22 66' },
                { name: 'UE 2', path: 'M 42 14 L 42 54 L 66 54' },
                { name: 'UE 3', path: 'M 36 10 L 36 66 M 36 42 L 64 42' },
              ].map((u) => (
                <div
                  key={u.name}
                  style={{
                    backgroundColor: PALETTE.cardSoft,
                    border: `1px solid ${PALETTE.border}`,
                    borderRadius: 10,
                    padding: 8,
                    textAlign: 'center',
                  }}
                >
                  <svg viewBox="0 0 80 76" style={{ width: '100%', height: 64 }}>
                    <path d={u.path} fill="none" stroke={PALETTE.orange} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 700, color: PALETTE.ink }}>{u.name}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontFamily: FONT_MONO, fontSize: 12, color: PALETTE.muted }}>
              FR1 3.6 GHz · 64×64 mMIMO · Tx Power: 37 dBm
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SceneArchitecture: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 435;
  const opacity = fadeWindow(frame, 435, 720, 14);
  const s1 = enterSpring(local, 8, fps);
  const s2 = enterSpring(local, 30, fps);
  const s3 = enterSpring(local, 54, fps);
  const stage = local < 95 ? 1 : local < 185 ? 2 : 3;

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
          ARCHITECTURE · TWO-STEP HIERARCHICAL MOBILITY-AWARE AI-RIC
        </div>
        <h2 style={{ margin: '6px 0 0', fontSize: 31, fontWeight: 780, letterSpacing: '-0.025em' }}>
          Staged Feature Extraction → BS Association → Joint Beam Optimization
        </h2>
      </div>

      {/* Pipeline Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '0.88fr 1fr 1fr 1.05fr', gap: 14, flex: 1 }}>
        {/* Input: RAN Simulation */}
        <div
          style={{
            backgroundColor: PALETTE.card,
            border: `1px solid ${PALETTE.border}`,
            borderRadius: 16,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            opacity: s1,
          }}
        >
          <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 700, color: PALETTE.purple }}>
            VIAVI AI RSG
          </span>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 750 }}>RAN Simulation</h3>
          <div style={{ padding: 11, borderRadius: 10, backgroundColor: PALETTE.cardSoft, border: `1px solid ${PALETTE.border}`, fontSize: 13 }}>
            <strong>UE Report</strong>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted, marginTop: 3 }}>RSRP · UE Location</div>
          </div>
          <div style={{ padding: 11, borderRadius: 10, backgroundColor: PALETTE.cardSoft, border: `1px solid ${PALETTE.border}`, fontSize: 13 }}>
            <strong>Cell Report (Reward)</strong>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted, marginTop: 3 }}>DL Throughput · Avg. Tx Power</div>
          </div>
          <div style={{ marginTop: 'auto', fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted }}>
            Streams telemetry every step
          </div>
        </div>

        {/* Module 0: Feature Extraction */}
        <div
          style={{
            backgroundColor: stage === 1 ? PALETTE.greenSoft : PALETTE.card,
            border: `2px solid ${stage === 1 ? PALETTE.teal : PALETTE.border}`,
            borderRadius: 16,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            opacity: s1,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 700, color: PALETTE.teal }}>MODULE A</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, color: stage === 1 ? PALETTE.orange : PALETTE.blue }}>
              {stage === 1 ? 'TRAINABLE' : 'FROZEN'}
            </span>
          </div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 750 }}>Feature Extraction</h3>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: PALETTE.muted }}>
            Encodes temporal RSRP and location sequences into compact <strong>UE mobility pattern</strong> embeddings.
          </p>
          <div style={{ marginTop: 'auto', padding: 10, borderRadius: 10, backgroundColor: PALETTE.card, border: `1px solid ${PALETTE.border}`, fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.ink }}>
            Output: Mobility Embeddings → Steps 1 &amp; 2
          </div>
        </div>

        {/* Step 1: BS Association */}
        <div
          style={{
            backgroundColor: stage === 2 ? PALETTE.greenSoft : PALETTE.card,
            border: `2px solid ${stage === 2 ? PALETTE.teal : PALETTE.border}`,
            borderRadius: 16,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            opacity: s2,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 700, color: PALETTE.teal }}>STEP 1</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, color: stage === 2 ? PALETTE.orange : PALETTE.blue }}>
              {stage === 2 ? 'TRAINABLE' : stage < 2 ? 'QUEUED' : 'FROZEN'}
            </span>
          </div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 750 }}>BS–UE Association</h3>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: PALETTE.muted }}>
            Selects timely handovers and optimal serving base station per UE using mobility features to prevent outdated links.
          </p>
          <div style={{ marginTop: 'auto', padding: 10, borderRadius: 10, backgroundColor: PALETTE.card, border: `1px solid ${PALETTE.border}`, fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.ink }}>
            UE 1 → BS_A · UE 2,3 → BS_B
          </div>
        </div>

        {/* Step 2: Beam Optimization */}
        <div
          style={{
            backgroundColor: stage === 3 ? PALETTE.blueSoft : PALETTE.card,
            border: `2px solid ${stage === 3 ? PALETTE.navy : PALETTE.border}`,
            borderRadius: 16,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            opacity: s3,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 700, color: PALETTE.navy }}>STEP 2</span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, color: stage === 3 ? PALETTE.orange : PALETTE.muted }}>
              {stage === 3 ? 'TRAINABLE' : 'QUEUED'}
            </span>
          </div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 750 }}>Beam Optimization</h3>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: PALETTE.muted }}>
            Jointly optimizes <strong>BS_A &amp; BS_B beam angles (azimuth, tilt)</strong> from both mobility features and association decisions.
          </p>
          <div style={{ marginTop: 'auto', padding: 10, borderRadius: 10, backgroundColor: PALETTE.card, border: `1px solid ${PALETTE.border}`, fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.navy }}>
            Eliminates overlap &amp; prunes idle beams
          </div>
        </div>
      </div>

      {/* Bottom staged training explanation bar */}
      <div
        style={{
          padding: '12px 18px',
          borderRadius: 12,
          backgroundColor: PALETTE.card,
          border: `1px solid ${PALETTE.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 13.5,
        }}
      >
        <span>
          <strong style={{ color: PALETTE.ink }}>Staged Freezing Training:</strong> Freeze upstream modules once converged for stable, cost-effective DRL training.
        </span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.teal }}>
          Active Stage: {stage === 1 ? 'Feature Extractor' : stage === 2 ? 'BS Association' : 'Joint Beam Angles'}
        </span>
      </div>
    </div>
  );
};

const SceneComparison: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 720;
  const opacity = fadeWindow(frame, 720, 990, 14);
  const s = enterSpring(local, 8, fps);
  const p = interpolate(local, [15, 220], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const ueTopX = interpolate(p, [0, 1], [225, 315]);
  const ueBotX = interpolate(p, [0, 1], [285, 190]);

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
        <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.navy, letterSpacing: '0.07em' }}>
          SIDE-BY-SIDE COMPARISON · BASELINE (AI OFF) VS. MOBILITY-AWARE AI-RIC (AI ON)
        </div>
        <h2 style={{ margin: '6px 0 0', fontSize: 31, fontWeight: 780, letterSpacing: '-0.025em' }}>
          Clean Handover &amp; Beam Pruning Cut Tx Power by 43.49%
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, flex: 1, opacity: s }}>
        {/* AI OFF */}
        <div
          style={{
            backgroundColor: PALETTE.card,
            border: `2px solid light-dark(#F59E0B, #FBC574)`,
            borderRadius: 18,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 13,
                fontWeight: 800,
                padding: '4px 12px',
                borderRadius: 6,
                backgroundColor: 'light-dark(#F59E0B, #FBC574)',
                color: PALETTE.onAccent,
              }}
            >
              AI OFF · BASELINE
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 700, color: PALETTE.red }}>
              Avg. Power: 37.7 kW
            </span>
          </div>

          <svg viewBox="0 0 480 265" style={{ width: '100%', flex: 1 }}>
            <rect x={4} y={4} width={472} height={257} rx={12} fill={PALETTE.cardSoft} stroke={PALETTE.border} />
            <BaseStationIcon x={64} y={134} label="BS_A" color={PALETTE.navy} />
            <BaseStationIcon x={416} y={134} label="BS_B" color={PALETTE.navy} />

            {/* Outdated long crossing beams */}
            <polygon points={`68,110 ${ueTopX + 20},52 ${ueTopX - 10},96`} fill={PALETTE.red} opacity={0.25} />
            <polygon points={`412,110 ${ueBotX - 20},158 ${ueBotX + 16},206`} fill={PALETTE.red} opacity={0.25} />
            <polygon points="68,110 218,162 186,204" fill={PALETTE.amber} opacity={0.24} />

            <UeDeviceIcon x={ueTopX} y={76} label="outdated" color={PALETTE.red} />
            <UeDeviceIcon x={ueBotX} y={182} label="interference" color={PALETTE.red} />

            <text x={240} y={244} textAnchor="middle" fontFamily={FONT_MONO} fontSize={12} fontWeight={700} fill={PALETTE.red}>
              Outdated association + overlapping beams → lower QoS (102)
            </text>
          </svg>
        </div>

        {/* AI ON */}
        <div
          style={{
            backgroundColor: PALETTE.card,
            border: `2px solid ${PALETTE.teal}`,
            borderRadius: 18,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 13,
                fontWeight: 800,
                padding: '4px 12px',
                borderRadius: 6,
                backgroundColor: PALETTE.teal,
                color: PALETTE.onAccent,
              }}
            >
              AI ON · MOBILITY-AWARE AI-RIC
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 14, fontWeight: 700, color: PALETTE.teal }}>
              Avg. Power: 21.3 kW (-43.49%)
            </span>
          </div>

          <svg viewBox="0 0 480 265" style={{ width: '100%', flex: 1 }}>
            <rect x={4} y={4} width={472} height={257} rx={12} fill={PALETTE.cardSoft} stroke={PALETTE.border} />
            <BaseStationIcon x={64} y={134} label="BS_A" color={PALETTE.navy} />
            <BaseStationIcon x={416} y={134} label="BS_B" color={PALETTE.navy} />

            {/* Clean non-overlapping beams after handover */}
            <polygon points={`412,110 ${ueTopX - 14},56 ${ueTopX + 16},96`} fill={PALETTE.teal} opacity={0.28} />
            <polygon points={`68,110 ${ueBotX + 16},160 ${ueBotX - 14},204`} fill={PALETTE.blue} opacity={0.26} />

            {/* Pruned beam marker */}
            <line x1={68} y1={110} x2={160} y2={82} stroke={PALETTE.muted} strokeWidth={1.6} strokeDasharray="4 4" />
            <rect x={78} y={54} width={108} height={20} rx={5} fill={PALETTE.card} fillOpacity={0.92} />
            <text x={132} y={68} textAnchor="middle" fontFamily={FONT_MONO} fontSize={11} fontWeight={800} fill={PALETTE.teal}>
              × beam pruned
            </text>

            <UeDeviceIcon x={ueTopX} y={76} label="BS_B" color={PALETTE.teal} />
            <UeDeviceIcon x={ueBotX} y={182} label="BS_A" color={PALETTE.blue} />

            <text x={240} y={244} textAnchor="middle" fontFamily={FONT_MONO} fontSize={12} fontWeight={700} fill={PALETTE.teal}>
              Interference mitigated + power saved → higher QoS (121)
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
};

const SceneResults: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const local = frame - 990;
  const opacity = fadeWindow(frame, 990, 1260, 14);
  const barScale = interpolate(local, [12, 65], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const kpis = [
    {
      title: 'Average Power Saving',
      delta: '43.49% Saved',
      before: '37.7 kW',
      after: '21.3 kW',
      beforePct: 100,
      afterPct: 56.5,
      color: PALETTE.teal,
      note: 'Unnecessary beams pruned via hierarchical control',
    },
    {
      title: 'DL Throughput',
      delta: '+22.71%',
      before: '0.00290 Gb/s',
      after: '0.00356 Gb/s',
      beforePct: 81.5,
      afterPct: 100,
      color: PALETTE.navy,
      note: 'Inter-cell beam overlap eliminated under UE mobility',
    },
    {
      title: 'Average Energy Efficiency',
      delta: '+50.62%',
      before: '0.161 Kbits/J',
      after: '0.243 Kbits/J',
      beforePct: 66.3,
      afterPct: 100,
      color: PALETTE.orange,
      note: 'Higher throughput per Joule across active cells',
    },
    {
      title: 'Average Cell QoS Score',
      delta: '+19.14%',
      before: '102',
      after: '121',
      beforePct: 84.3,
      afterPct: 100,
      color: PALETTE.purple,
      note: 'Evaluated on VIAVI TeraVM AVE Analytics Console',
    },
  ];

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
          EXPERIMENTAL RESULTS · VIAVI TeraVM AVE CONSOLE KPIs
        </div>
        <h2 style={{ margin: '6px 0 0', fontSize: 31, fontWeight: 780, letterSpacing: '-0.025em' }}>
          Simultaneous Gains in Throughput, Energy Saving &amp; Cell QoS
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1 }}>
        {kpis.map((k, idx) => {
          const s = enterSpring(local, idx * 10, fps);
          return (
            <div
              key={k.title}
              style={{
                backgroundColor: PALETTE.card,
                border: `1px solid ${PALETTE.border}`,
                borderRadius: 16,
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                opacity: s,
                transform: `translateY(${(1 - s) * 14}px)`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 17, fontWeight: 750, color: PALETTE.ink }}>{k.title}</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: 23, fontWeight: 800, color: k.color }}>
                  {k.delta}
                </span>
              </div>

              <div style={{ display: 'grid', gap: 8, margin: '10px 0' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 104px', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, color: PALETTE.muted }}>AI off</span>
                  <div style={{ height: 11, borderRadius: 6, backgroundColor: 'light-dark(#E2E8F0, #3B414B)' }}>
                    <div style={{ width: `${k.beforePct * barScale}%`, height: '100%', borderRadius: 6, backgroundColor: 'light-dark(#94A3B8, #9DA9BB)' }} />
                  </div>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: PALETTE.muted, textAlign: 'right' }}>{k.before}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 104px', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 700, color: PALETTE.ink }}>AI on</span>
                  <div style={{ height: 11, borderRadius: 6, backgroundColor: 'light-dark(#E2E8F0, #3B414B)' }}>
                    <div style={{ width: `${k.afterPct * barScale}%`, height: '100%', borderRadius: 6, backgroundColor: k.color }} />
                  </div>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 750, color: PALETTE.ink, textAlign: 'right' }}>{k.after}</span>
                </div>
              </div>

              <div style={{ fontSize: 12.5, color: PALETTE.muted }}>{k.note}</div>
            </div>
          );
        })}
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
        <span style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 700, color: PALETTE.teal }}>
          MWC&apos;25 Barcelona · AI-RAN Alliance
        </span>
      </div>
    </div>
  );
};

export const Mwc25DrlDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <FrameChrome
      badge="MWC'25"
      title="AI-Based 5G Beamforming · Mobility-Aware Interference Mitigation & Energy Saving"
      chapters={CHAPTERS}
      frame={frame}
      durationInFrames={MWC25_DURATION}
      accentColor={PALETTE.teal}
    >
      {frame < 209 && <SceneOverview frame={frame} fps={fps} />}
      {frame >= 181 && frame < 449 && <SceneMobility frame={frame} fps={fps} />}
      {frame >= 421 && frame < 734 && <SceneArchitecture frame={frame} fps={fps} />}
      {frame >= 706 && frame < 1004 && <SceneComparison frame={frame} fps={fps} />}
      {frame >= 976 && <SceneResults frame={frame} fps={fps} />}
    </FrameChrome>
  );
};
