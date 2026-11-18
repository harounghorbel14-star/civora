# 1. Product Strategy

> **Status (v2.0):** retained as the **Division A (Government) product strategy**. Company-level strategy is now in [02-company-strategy.md](../02-company-strategy.md). The MVP MoSCoW in §1.7 describes the Government product, not the first commercial product (see [10](../10-first-product-recommendation.md)).


## 1.1 Positioning statement

> **For** public institutions and regulated organisations that must serve citizens securely, **CIVORA** is a sovereign service-delivery platform that turns official procedures into clear, trackable, accessible digital journeys, plugging into national identity and data systems instead of replacing them.
> **Unlike** foreign integrators and one-off projects, CIVORA is a modular, Arabic/French-native product, deployable inside each country's own infrastructure, with privacy and transparency built in.

## 1.2 Product line-up (from Phase 0, Section 2.5)

| Product | Primary user | Buyer | MVP? | Job it does |
|---|---|---|---|---|
| **CIVORA Guide** | Citizen, call-centre agent | Institution (B2G) or free public demo | **Yes** | "Tell me exactly what I need to do, in my language, from official sources." |
| **CIVORA Workspace** | Civil servant | Institution | **Yes** | "Let me process requests quickly, completely and accountably." |
| **CIVORA Citizen** (white-label) | Citizen | Institution / country | **Yes** (prototype) | "Let me submit, track and get notified without visiting an office." |
| **CIVORA Trust** | Bank/insurer/university compliance teams | Regulated business (B2B) | Parallel L1 track | "Let me verify identity and sign remotely, compliantly." |
| **Consent & Trust Center** | Citizen, auditor, DPO | Bundled | **Yes** | "Show me who used my data and why; let me control consent." |

## 1.3 Persona hypotheses (to validate)

These remain **hypotheses** until research (Section 8) confirms or replaces them. Each carries the assumption to test.

| Persona | Goals | Frustrations (hypothesised) | Key assumption to test |
|---|---|---|---|
| **Amira** (34, Sfax, salaried, smartphone-first) | Finish procedures without taking leave | Contradictory information; repeat visits for missing documents; no status visibility | She would trust an unofficial assistant if it cites official sources |
| **Hédi** (71, Kairouan, retired, basic phone) | Get reimbursements and pension paperwork done | Travel to offices; complex forms; depends on family | He (and his family) would accept a formal, revocable **mandate** for a relative |
| **Yassine** (29, Lyon, diaspora) | Handle Tunisian paperwork remotely | Consulate queues; time zones; documents in French needed | Remote guidance + consular appointment booking are his top needs |
| **Nour** (38, civil-status officer) | Clear the queue; avoid conflict at the counter | Incomplete files; phone calls asking "where is my file?"; no tools to prioritise | A queue with checklists and automatic status notifications would cut her workload |
| **Leïla** (42, bank compliance lead, B2B) | BCT-compliant remote onboarding with audit evidence | Manual KYC; fraud; audit preparation | She would buy a locally hosted verification orchestration with evidence packs |

## 1.4 Jobs-to-be-done (JTBD)

| # | When… | I want to… | So that… | Product |
|---|---|---|---|---|
| J-1 | I face a procedure I don't know | Get the official steps, documents, fees and offices in my language | I go once, with the right papers | Guide + Catalogue |
| J-2 | I've submitted a request | Know its status and what's next without calling | I can plan and stop worrying | Citizen + Workspace |
| J-3 | An office requires an appointment | Book a slot that fits my day | I don't queue for hours | Citizen + Workspace |
| J-4 | My parent can't manage alone | Act on their behalf, legitimately and visibly | They get served without me impersonating them | Mandates |
| J-5 | Someone accessed my data | See who, when and why | I can trust the system and object if needed | Consent & Trust Center |
| J-6 | I hold a diploma/attestation | Prove it to an employer instantly | I'm not asked for stamped copies | Wallet |
| J-7 | I process requests (officer) | See complete files, prioritised by deadline | I meet SLAs and avoid conflict | Workspace |
| J-8 | I onboard customers remotely (bank) | Verify identity with audit-grade evidence | I comply with BCT rules and reduce fraud | Trust |

## 1.5 Product principles (decision rules for the team)

1. **Official source or silence.** Every procedural fact shown to a citizen links to an official source with a "last verified" date.
2. **Deep-link before intermediating.** Until an integration is authorised, send people to the real official service.
3. **Status is the product.** A visible next step and status beats a new feature.
4. **Assisted by design.** Every citizen journey must be completable by a helper under mandate or at a counter.
5. **Language parity.** Arabic, French and English are equal. No screen ships in one language with "translations later". RTL is tested on every component.
6. **Least data.** Do not ask for what you do not need. Do not keep what you no longer need.
7. **Explain AI.** The Guide says it is an AI, shows its sources, and never decides eligibility.
8. **No dark patterns.** No nudging to share data; consent is as easy to withdraw as to give.
9. **Never pretend to be the government.** Prototype and unofficial channels say so on every screen.

## 1.6 North Star and product metrics

**North Star (B2G):** *Completed requests per month with no repeat visit* across CIVORA deployments. It combines usefulness (completion) and quality (first-time-right).

| Area | Metric | MVP target (pilot) |
|---|---|---|
| Guide | Answer accuracy on golden set; citation precision; refusal correctness | ≥ 95% / ≥ 95% / ≥ 90% |
| Guide | "This answered my question" rate | ≥ 70% |
| Requests | First-time-right submissions (no correction request) | ≥ 80% |
| Requests | Median processing time vs baseline | −30% |
| Requests | "Where is my file?" calls vs baseline | −40% |
| Appointments | No-show rate | ≤ 15% |
| Inclusion | Task completion, users 60+ (assisted or unassisted) | ≥ 85% |
| Trust | Users who opened the access log at least once | Tracked (no target) |
| Quality | Availability (pilot) | ≥ 99.5% |
| B2B | Verification pass rate / fraud catch rate / median verification time | Per client baseline |

## 1.7 MVP scope (MoSCoW)

| Priority | Capability |
|---|---|
| **Must** | Guide v1 (public content, 4 languages, citations, refusal); service catalogue with editorial workflow; citizen account (passkey/TOTP); request submission & tracking; appointments; officer queue & case handling; notifications (simulated channels); consent receipts; access log; mandates (2 scenarios); synthetic-data banner; AR/FR/EN with RTL; WCAG 2.2 AA |
| **Should** | Wallet v1 (2 synthetic credential types, QR verify); simulated national-eID login; officer dashboard; content error reporting |
| **Could** | Voice input for Guide; dark mode in Workspace; offline drafts on mobile |
| **Won't (MVP)** | Real government data; real payments; health records; biometric processing; Derja voice output; native citizen "super-app" branding for Tunisia |

## 1.8 Non-goals

- Replacing Khadamet, e-Bawaba, Mobile ID or Sahetna.
- Becoming a payment institution or an identity provider.
- Personalised AI advice on legal rights or eligibility.
- Monetising citizens or their data.

## 1.9 Competitive UX bar

The bar comes from the reference platforms (Phase 0, Section 4):
- Singpass-level login simplicity.
- Estonia-level transparency on data access.
- Absher-level breadth of status tracking.

It must be delivered with Maghrebi language fluency and assisted channels. The prototype ([design/prototype](../../../design/prototype/index.html)) is the first expression of this bar.
