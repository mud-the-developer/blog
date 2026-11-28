---
title: AI-Based 5G Beamforming for Mobility-Aware Interference Mitigation
slug: mwc25-drl-beamforming
date: 2025-03-03
period: Nov. 2024 – Mar. 2025
role: MWC'25 Barcelona Demo · Yonsei–VIAVI–SUTD
category: demo
status: exhibited
logo: /assets/cv/mwc25_logo.jpg
featured: true
themes: [ai-ran]
stack: [Deep RL, Massive MIMO, VIAVI TeraVM AI RSG, AI-RAN]
tags: [project, demo, ai-ran, drl, mwc]
description: Two-step hierarchical DRL mobility-aware AI-RIC beam control for 5G FR1 64x64 massive MIMO interference mitigation and energy saving, demonstrated at MWC'25 Barcelona.
publish: true
---

## Overview

Joint **Yonsei University (RAMO Lab) – SUTD – VIAVI Solutions** AI-for-RAN demonstration sponsored by the **AI-RAN Alliance** and exhibited at **MWC'25 Barcelona**. Evaluates a two-step hierarchical **mobility-aware AI-RIC** on the **VIAVI TeraVM AI RAN Scenario Generator (FR1 3.6 GHz, 64×64 massive MIMO, 37 dBm Tx power)** to eliminate overlapping beams and prune unnecessary base-station transmissions under UE mobility.

<figure class="v3-demo-figure">
  <noscript data-project-demo="mwc25-drl-beamforming">
    <video controls playsinline muted loop preload="metadata" src="/assets/media/mwc25-drl-beamforming.mp4" poster="/assets/media/mwc25-drl-beamforming-poster.png"></video>
  </noscript>
  <figcaption>42-second Remotion summary · MWC'25 mobility-aware two-step AI-RIC architecture, AI off vs. AI on beam comparison, and VIAVI AVE Console KPIs.</figcaption>
</figure>

## Technical Scope

- **Urban multi-BS mobility scenario**: Simulated 2 massive MIMO base stations (`BS_A`, `BS_B`) serving 3 moving UEs with distinct trajectories in VIAVI TeraVM AI RSG, where imperfect CSI and rapid mobility quickly render static BS–UE associations outdated.
- **Two-step hierarchical AI-RIC**:
  1. **Feature Extraction**: Extracts UE mobility patterns from UE Reports (`RSRP`, `UE Location`).
  2. **Step 1 — BS–UE Association**: Performs mobility-aware handover and association to avoid stale cross-cell links.
  3. **Step 2 — Beam Optimization**: Jointly determines `BS_A` and `BS_B` beam angles (azimuth and tilt) conditioned on both mobility embeddings and association decisions.
- **Staged freezing training**: Uses sequential module freezing (`Frozen` vs. `Trainable`) with Cell Report feedback (`DL Throughput`, `Avg. Tx Power`) for stable, cost-effective DRL convergence.

## Experimental Highlights (VIAVI AVE Console)

| Metric | Baseline (AI Off) | AI-RIC (AI On) | Improvement |
| --- | --- | --- | --- |
| **Average Power Usage** | `37.7 kW` | `21.3 kW` | **43.49% saved** |
| **Downlink Throughput** | `0.00290 Gb/s` | `0.00356 Gb/s` | **+22.71%** |
| **Average Energy Efficiency** | `0.161 Kbits/Joule` | `0.243 Kbits/Joule` | **+50.62%** |
| **Average Cell QoS Score** | `102` | `121` | **+19.14%** |

## Collaboration

- **Institutions**: Yonsei University (RAMO Lab), SUTD, VIAVI Solutions
- **Sponsor**: AI-RAN Alliance
- **Venue**: MWC'25 Barcelona

## References

- [Full MWC'25 Demo Video (720p MP4, 4:58)](https://video.wixstatic.com/video/7fa153_c143b357e0ef4d30a2953d894b385c2c/720p/mp4/file.mp4)
- [AI-RAN Alliance MWC Barcelona 2025 Demonstrations](https://ai-ran.org/demonstrations?tab=mwc-2025)
- [VIAVI Solutions MWC 2025 Press Release](https://investor.viavisolutions.com/news-events/news-releases/news-details/2025/MWC-Barcelona-2025-VIAVI-Collaborations-Showcase-Importance-of-Ecosystem-in-Advancement-of-AI-RAN-6G-NTN-and-Open-Networks/default.aspx)
- [SUTD Future Communications R&D Programme — MWC 2025 Showcase](https://fcp.sutd.edu.sg/2025/03/05/sutd-showcases-seven-cutting-edge-5g-and-artificial-intelligence-innovations-at-mwc-barcelona-2025)
