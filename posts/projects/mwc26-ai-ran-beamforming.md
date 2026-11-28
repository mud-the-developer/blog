---
title: LLM-Based 5G Beamforming for AI-RAN
slug: mwc26-ai-ran-beamforming
date: 2026-03-02
period: Nov. 2025 – Mar. 2026
role: MWC'26 Barcelona Demo · Yonsei–VIAVI–SUTD
category: demo
status: exhibited
logo: /assets/cv/mwc26_logo.jpg
featured: true
themes: [ai-ran, hybrid-llm]
stack: [LLM, In-Context Learning, 5G NR, VIAVI TeraVM AI RSG, AI-RAN]
tags: [project, demo, ai-ran, llm, mwc]
description: Joint Yonsei–VIAVI–SUTD AI-RAN demonstration at MWC'26 Barcelona using LLM in-context learning and predictive beamforming for anomaly-resilient 5G interference mitigation and energy efficiency.
publish: true
---

## Overview

Developed as part of the joint **Yonsei University (RAMO Lab) – VIAVI Solutions – SUTD** AI-RAN demonstration exhibited at **MWC'26 Barcelona** inside the AI-RAN Alliance booth. Building on our MWC'25 DRL beamforming demo, this system uses an **LLM-based AI-RIC** with **in-context learning** and **one-step-ahead predictive beamforming** to sustain throughput and energy efficiency under real-world network anomalies without retraining.

<figure class="v3-demo-figure">
  <noscript data-project-demo="mwc26-ai-ran-beamforming">
    <video controls playsinline muted loop preload="metadata" src="/assets/media/mwc26-ai-ran-beamforming.mp4?cut=2" poster="/assets/media/mwc26-ai-ran-beamforming-poster.png?cut=2"></video>
  </noscript>
  <figcaption>When position reports stop, the beam steers toward the predicted position. The path is schematic; the throughput figures are VIAVI measurements.</figcaption>
</figure>

## Technical Scope

- **Real-world anomaly scenarios (VIAVI TeraVM AI RSG)**: Evaluated conventional AI beamforming against (1) **irregular UE report timing** caused by handovers, Wi-Fi offloading, or short disconnections, and (2) **regional RF anomalies / external interferers** (e.g., 20 dB RF degradation not captured in CSI).
- **In-context learning without retraining**: Combined offline pre-labeled guidance with online UE/cell reports (`RSRP`, `UE Location`, `DL Throughput`, `Avg. Tx Power`) inside a structured JSON controller prompt to adapt immediately to missing reports and interference zones.
- **One-step-ahead predictive beamforming**: Leveraged the LLM's time-series prediction capability to forecast UE trajectories and emit proactive `BS_A`/`BS_B` beam actions ahead of time, compensating for LLM inference latency (`1475 ms` vs. `34 ms` conventional).

## Experimental Highlights

| Anomaly Scenario | Downlink Throughput Gain | Robustness Gain (Norm. TP) | Energy Efficiency Gain (TP/J) |
| --- | --- | --- | --- |
| **Irregular UE Report Timing** | **+133.99%** (`7.03 → 16.45 Mbps`) | **+310.34%** (`0.25 → 0.90`) | **+95.7%** (`75.38 → 147.53`) |
| **Regional Anomaly (External Interferers)** | **+25.87%** (`8.04 → 10.12 Mbps`) | **+23.40%** (`0.530 → 0.654`) | **+3.15%** (`85.39 → 88.08`) |

## Collaboration

- **Institutions**: Yonsei University (RAMO Lab), VIAVI Solutions, Singapore University of Technology and Design (SUTD)
- **Venue**: MWC'26 Barcelona · AI-RAN Alliance Booth

## References

- [Full MWC'26 Demo Video — AI-RAN Alliance (YouTube, 5:08)](https://youtu.be/IlL3bR87Vkg)
- [AI-RAN Alliance MWC Barcelona 2026 Demonstrations](https://ai-ran.org/demonstrations)
- [AI-RAN Alliance Blog — AI-Native RAN: From White Papers to Validation (Apr 2026)](https://ai-ran.org/blog/ai-native-ran-from-white-papers-to-validation)
- [VIAVI Perspectives — The State of 6G and AI-RAN (Feb 2026)](https://blog.viavisolutions.com/2026/02/17/the-state-of-6g-and-ai-ran)
