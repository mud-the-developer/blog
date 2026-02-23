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
    

# SLM 앙상블 분포를 Target으로 하는 Speculative Decoding/Sampling
*(공유용 저널 형식 초안 · LLM 본체 학습 없이 시작, 가중치/온도 등 저차원 최적화는 선택)*

## 1. 목적과 문제 정의

본 문서는 다음의 아이디어를 **저널/워크숍 논문 형태**로 정리한 공유용 초안이다.

- 동일한 tokenizer/vocab을 공유하는 여러 Small Language Model(SLM)들의 **next-token 분포(또는 logits)** 를 결합하여 **aggregated target 분포** \(p_\mathrm{agg}\)를 정의한다.
- \(p_\mathrm{agg}\)가 **단답형 QA(정답이 존재하는 평가)** 에서 단일 SLM 대비 성능 향상을 보일 수 있음을 확인한다.
- 그러나 토큰 레벨 앙상블 디코딩은 비용이 매우 크므로, \(p_\mathrm{agg}\)를 **speculative decoding/sampling의 target 분포**로 두고, 긴 생성에서 효율적으로 샘플링/디코딩한다.

> 핵심은 “**aggregation이 품질을 올리는가(Claim A)**”와 “**좋다고 정의한 target 분포를 SD로 싸게 실행할 수 있는가(Claim B)**”를 분리해 검증하는 것이다.

---

## 2. Aggregated target 분포 \(p_\mathrm{agg}\) 정의

모델 \(i\in\{1,\dots,N\}\)의 prefix \(s\)에서 next-token logits를 \(z_i(\cdot\mid s)\in\mathbb{R}^V\), 확률을 \(p_i(\cdot\mid s)=\mathrm{softmax}(z_i(\cdot\mid s))\)라 하자.

### 2.1 LogOP / Product-of-Experts (로짓 가중합)
\[
p_\mathrm{agg}(\cdot\mid s)
=\mathrm{softmax}\Big(\sum_{i=1}^N w_i\, z_i(\cdot\mid s)/T_i\Big),
\quad w\in\Delta^{N-1},\; T_i>0
\]
- 해석: **logarithmic opinion pool**(가중 기하평균)과 동치인 결합 방식.
- 성향: 모델 합의(consensus)를 강하게 반영(분포가 sharp해질 수 있음).

### 2.2 Mixture (확률 가중 평균)
\[
p_\mathrm{agg}(\cdot\mid s)
=\sum_{i=1}^N w_i\,p_i(\cdot\mid s),
\quad w\in\Delta^{N-1}
\]
- 성향: 안정적/완충적(분포가 flat해질 수 있음).
- 단답형(정답 존재) 태스크에서는, **가중치 \(w\)** 만 dev에서 최적화하면 NLL 기준으로 “best 단일 모델보다 non-worse” 성질을 만들기 쉽다.

---

## 3. 단답형 QA에서의 평가(Claim A)

### 3.1 ScienceQA 등 객관식/정답 존재 태스크
- 단답형(예: 객관식)에서는 SD가 이득이 거의 없으므로, 여기서는 **aggregation 자체의 성능**을 확인하는 용도로 사용한다.
- 추천: “긴 생성”이 아니라 **옵션 스코어링(선택지 likelihood)** 로 평가하여 디코딩 노이즈를 줄인다.

### 3.2 지표
- Accuracy(정답률)
- Negative Log-Likelihood(NLL) / Calibration(선택)

> 주의: “모든 태스크에서 항상 단일보다 낫다”는 일반적 보장은 불가능하다. 대신 (예: NLL)처럼 보장 가능한 목표를 명확히 두고 검증한다.

---

## 4. 복잡도 분석: 큰 LLM 1개 vs 여러 SLM 앙상블

### 4.1 기본 비용(오토리그레시브 생성)
생성 길이 \(T\)에서,
- 단일 대형 LLM: \(\Theta(T\cdot C_\mathrm{LLM})\)
- N개 SLM 토큰-레벨 앙상블(naive): \(\Theta(T\cdot N\cdot C_\mathrm{SLM})\)

여기서 \(C\)는 1-step forward(또는 토큰당 연산/지연)의 대표 비용.

### 4.2 SD 적용 시의 기대 비용(개략)
lookahead \(K\), draft 크기 \(m\) (예: 1 또는 4), 블록당 평균 전진 길이 \(\mathbb{E}[L]\)을 두자.  
또한 teacher forcing의 벡터화 이득을 \(f(K)\)로 요약하면, 블록당 비용/토큰당 비용을 대략 다음처럼 근사할 수 있다.

- 블록당 비용(근사):
\[
\text{BlockCost} \approx mK\,C_\mathrm{SLM} + (N-m)\,f(K)\,C_\mathrm{SLM}
\]
- 토큰당 비용(근사):
\[
\text{Cost/token} \approx \frac{(mK+(N-m)f(K))\,C_\mathrm{SLM}}{\mathbb{E}[L]}
\]

따라서 \(m\)을 늘리는 것은 (i) draft 비용 증가와 (ii) acceptance 증가로 인한 \(\mathbb{E}[L]\) 증가의 trade-off이며, \(\mathbb{E}[L]\)이 충분히 늘 때만 이득이 난다.

---

## 5. \(p_\mathrm{agg}\)를 target으로 하는 Speculative Sampling (Claim B)

### 5.1 Draft 분포 \(q\) 정의 (sub-ensemble, m=4)
draft subset \(S\subset\{1..N\}\), \(|S|=m=4\)에 대해
\[
q(\cdot\mid s)
=\mathrm{softmax}\Big(\sum_{i\in S} v_i\, z_i(\cdot\mid s)/T_i\Big),
\quad v\in\Delta^{m-1}
\]
- 목적: draft \(q\)가 target \(p_\mathrm{agg}\)에 가까울수록 수락률(acceptance)이 올라가 SD 이득이 커진다.

### 5.2 수락률과 분포 거리(직관)
prefix \(s\)에서 평균 수락률은 다음과 같이 \(p\)와 \(q\)의 거리와 연결된다:
\[
\mathbb{E}_{y\sim q}[\min(1, p(y)/q(y))]
= \sum_t \min(p(t), q(t))
= 1-\mathrm{TV}(p,q)
\]
따라서 sub-ensemble draft는 \(q\approx p_\mathrm{agg}\)를 만들기 위한 무학습 레버로 해석된다.

### 5.3 알고리즘(요약)
- draft \(q\)로 lookahead \(K\) 토큰 제안
- target \(p_\mathrm{agg}\)로 검증 및 accept/reject (modified rejection sampling)
- reject 시 residual 분포 \([p-q]_+\)에서 샘플하여 분포를 보존(정확 모드)

---

## 6. 긴 생성 실험(Alpaca 등) 설계

### 6.1 왜 긴 생성인가?
Speculative decoding/sampling의 속도 이득은 **생성해야 하는 토큰 수가 충분히 길 때** 크게 관측된다.

### 6.2 권장 비교군
- Single SLM (baseline)
- Full aggregation, no SD (gold target 실행)
- SD with m=1 draft (단일 draft)
- SD with m=4 sub-ensemble draft (제안 방식)

### 6.3 측정 지표
- 속도: tok/s, latency, acceptance, 블록당 평균 전진 길이
- 품질: (가능하면) pairwise LLM-judge/휴먼 평가 + 반복/자기모순 등 보조 지표

---

## 7. tokenizer/vocab 그룹(계열)별 실험군 구성

로짓/토큰 확률 결합은 동일 vocab 정렬이 필요하므로,
- Qwen 계열, LLaMA 계열 등 **tokenizer/vocab가 동일한 그룹 단위**로 \(p_\mathrm{agg}\)를 구성하고,
- 그룹별로 Claim A/B를 각각 평가한다.

---

## 8. 참고문헌(링크)

- ScienceQA Dataset: https://scienceqa.github.io/
- Stanford Alpaca (instruction prompts): https://crfm.stanford.edu/2023/03/13/alpaca.html
- Speculative Decoding (Leviathan et al., 2022): https://arxiv.org/abs/2211.17192
- Speculative Sampling (Chen et al., 2023): https://arxiv.org/abs/2302.01318
- Logarithmic Opinion Pool 가중치 관련(NeurIPS): https://papers.neurips.cc/paper/1413-selecting-weighting-factors-in-logarithmic-opinion-pools