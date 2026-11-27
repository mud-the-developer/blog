---
title: LicheeRV Nano FIDO2 — Experimental USB Authenticator
slug: licheerv-nano-fido2
date: 2026-10-15
period: Oct. 2026
role: Creator · Embedded Systems & Security Experiment
category: project
status: active
featured: false
themes: [systems]
stack: [Go, RISC-V, Linux USB HID Gadget, FIDO2 / CTAP2, Buildroot]
repo: https://github.com/mud-the-developer/licheerv-nano-fido2
tags: [project, oss, go, embedded, security, fido2]
description: Experimental Go USB FIDO2/CTAP2 authenticator running on a RISC-V LicheeRV Nano via Linux HID gadget, with physical USER-button approval and explicit security boundaries.
publish: true
---

## Overview

**LicheeRV Nano FIDO2** turns an SG2002 RISC-V (`C906`) LicheeRV Nano running Buildroot Linux 5.10 into an experimental USB FIDO2/CTAP2 authenticator bridged to Linux's USB HID gadget subsystem.

<figure class="v3-demo-figure">
  <video controls playsinline muted loop preload="metadata" poster="/assets/media/licheerv-nano-fido2-poster.png">
    <source src="/assets/media/licheerv-nano-fido2.mp4" type="video/mp4" />
  </video>
  <figcaption>60-second Remotion summary · RISC-V SG2002 USB HID gadget bridge, physical CTAP2/USER-button verification matrix, encrypted SD vault provisioning, and explicit threat boundaries.</figcaption>
</figure>

> This is a research and engineering experiment, not a FIDO-certified hardware key. The Linux host OS is explicitly documented as outside commercial tamper-resistance boundaries.

## Verified Physical Capabilities
| Protocol Area | Verification Status |
| --- | --- |
| CTAPHID `INIT`, `PING`, canonical `GetInfo` | Passed over physical USB |
| PIN Protocol 1 & incorrect-PIN rejection | Passed |
| Credential registration & authentication | Passed over physical USB |
| Independent RP/UP/UV, packed attestation, signature verification | Passed |
| Process restart & SD vault persistence (signature counter 1 → 2) | Passed |
| On-board physical `USER` button approval | Passed across registration, auth, and restart |

## Interactive Provisioning Console

After deploying the checked `nano/` bundle, operators provision, unlock, or lock the encrypted SD vault over a separate management session without heavyweight TUI dependencies:

```bash
ssh -t root@<NANO_HOST> /opt/nano-fido/configure.sh
```

- Supports plain fallback under `TERM=dumb` or `NO_COLOR=1`.
- Keeps passphrases RAM-only while retaining encrypted credential vaults across lock/stop cycles.
- Documents remaining test scope transparently (CANCEL, concurrent channels, power-loss resilience, and independent security review).

## Links

- [GitHub Repository & Operator Documentation](https://github.com/mud-the-developer/licheerv-nano-fido2)
