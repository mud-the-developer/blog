---
title: "Co-SLM"
date: 2026-02-23 12:17
lastmod: 2026-02-23 12:17
draft: true
tags: [blog]
description: ""
---
# Co-SLM

그 흐름(단답형 → aggregation 성능 확인 → 큰 LLM vs 여러 SLM 복잡도 비교 → paggp_{\text{agg}}pagg​를 target으로 두고 긴 생성에서 SD 적용)은 **저널 페이퍼로 스토리라인이 깔끔하게 잡히는 편**이에요.  
다만 “체리피킹”처럼 보이지 않게 하려면, **Claim(무엇을 증명하는지)** 을 2개로 분리해서 쓰는 게 좋습니다:

- **Claim 1 (품질/정확도):** aggregation으로 정의한 paggp_{\text{agg}}pagg​가 단일 SLM보다 _일부 태스크에서_ 성능을 개선(또는 최소 NLL 관점에서 non-worse).
- **Claim 2 (효율/실행가능성):** paggp_{\text{agg}}pagg​는 비싸지만, 이를 **SD(=speculative decoding/sampling)** 로 “target LLM”처럼 **정확히/가깝게** 샘플링하여 긴 생성에서 비용을 크게 줄일 수 있다.

아래는 네가 말한 흐름을 **저널 형식(섹션 구성 + 들어갈 수식/알고리즘/실험 설계)** 으로 정리한 버전이야.

---
### 제목 예시

- _Training-Free Aggregated Target Distributions from Multiple SLMs and Speculative Sampling for Efficient Long-Form Generation_
- _Ensembling Small Language Models as a Target Distribution: Accuracy Gains and Speculative Decoding for Efficient Inference_

### 기여 3줄로 요약(초록/인트로에 그대로)

1. 동일 tokenizer/vocab을 공유하는 다수 SLM으로부터 **aggregated next-token 분포 paggp_{\text{agg}}pagg​** 를 정의(예: log-opinion pool / mixture)하고, 단답형 QA에서 품질(정확도/캘리브레이션)을 정량 비교한다.
2. “큰 LLM 1개” vs “여러 SLM 앙상블”의 **복잡도(연산/메모리/지연) 분석**을 통해, naive ensemble decoding의 병목을 명확히 한다.
3. paggp_{\text{agg}}pagg​를 speculative decoding/sampling의 **target 분포**로 두는 **Nested SD**(draft=sub-ensemble, verify=full aggregation)를 제안/정리하고, 긴 응답 생성(Alpaca 프롬프트)에서 속도–품질 trade-off를 보인다.

### Abstract

- 문제: SLM 여러 개를 조합하면 품질이 오를 수 있으나, 토큰 단위 앙상블은 비용이 커서 긴 생성에서 비현실적.
- 방법: paggp_{\text{agg}}pagg​ 정의 + 단답형 QA에서 성능 확인 + 복잡도 분석 + paggp_{\text{agg}}pagg​를 target으로 하는 speculative sampling(정확 분포 보존)으로 긴 생성 가속.
    
- 결과: (네 실험 결과에 맞춰) accuracy/NLL 개선 + tok/s 가속 + ablation(m, K, weighting) 요약.
    

### 1. Introduction

- SLM은 싸지만 단일 성능 한계. 다수 SLM 조합은 유망.
- 그러나 앙상블은 **토큰당 N배 비용** → 긴 생성에서 병목.
- 핵심 아이디어: “앙상블 분포”를 하나의 target LLM 분포처럼 취급하고, SD로 가속.
- (중요) tokenizer/vocab이 다르면 로짓 결합이 정의되지 않음 → **계열별(vocab별) 그룹**으로 실험 설계.

### 2. Background / Related Work

- **Opinion pool** 기반 확률 결합(특히 logarithmic opinion pool): “로짓 합 = 가중 기하평균”의 정당화.
- Speculative decoding / sampling: draft–target 구조로 분포 보존하며 가속.
- (선택) 모델 fusion 관련 최근 흐름/프레임워크는 related로만 짧게.