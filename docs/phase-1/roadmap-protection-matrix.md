# Roadmap Protection Matrix (clarification for P1-D4)

**Founder instruction (P1-D4, conditional):**
> Preserve all original 15 phases, names, objectives, dependencies and acceptance criteria. Documentation-only work and synthetic prototypes may be used where appropriate, but every original phase must retain its complete intended scope.

**Consequence:** the "light pass" proposal from Phase 1 v2.0 (reduced scope for Phases 7–10) is **withdrawn**. Every phase keeps the full scope defined in [Phase 0 §19](../phase-0/19-development-roadmap.md) (per-phase objectives, deliverables, acceptance criteria, dependencies, budgets).

The Enterprise first product (Workspace — Regulated Finance) is handled as follows:
- **Validated** in Phase 1, and afterwards through sandbox design-partner trials (P1-D5).
- **Developed as additive scope** inside the phases where its capabilities naturally belong. Nothing is removed from any phase, and no phase is renamed, reordered or merged.

## 1. Rules

1. **Names and order are fixed:** Phase 0 → 15, as listed in the master prompt and the Phase 1 directive.
2. **Original scope is a floor, not a ceiling.** Each phase's acceptance criteria in Phase 0 §19 must be met in full. Enterprise items are *added* acceptance criteria.
3. **Synthetic/documentation work only where the original intent already says so:**
   - Phase 7 is a *synthetic-data* healthcare prototype by definition.
   - Phases 4 and 9 use synthetic credentials until issuers are authorised.
   - Phase 12 integrations remain class 3/5 until agreements exist.

   Synthetic work never substitutes for a deliverable that the original scope defines as built and tested.
4. **No production use before Phase 13.** Design-partner trials use synthetic data or properly authorised test data only (P1-D5).
5. **Future-phase requirements are documented, not built early.** Example: AI features for Workspace are designed now and built only in Phase 10.

## 2. Phase-by-phase matrix

| Phase (original name) | Original objectives (Phase 0 §19, summarised) | Original acceptance criteria (summary) | Original dependencies | Enterprise-track additions (additive) | Full scope retained? |
|---|---|---|---|---|---|
| **0 Research and Feasibility** | Feasibility, positioning, legal map, architecture direction, financial scenarios | Decisions recorded; counsel commissioned | — | — | ✅ (complete) |
| **1 Product Strategy and UX/UI** | Validated personas and journeys; design system; prototypes; proposal documents | Prototype SUS ≥ 70; top-10 pain points evidenced; design system passes WCAG contrast | Phase 0 approval | Workspace RF discovery (≥ 15 institutions), PRD, wireframes, pricing hypotheses, design-partner agreement | ✅ (original criteria still open: see [validation-evidence-register.md](validation-evidence-register.md)) |
| **2 Technical Architecture** | ADRs, threat model, skeleton, CI/CD, IaC, synthetic data generator | Staging reproducible from IaC < 2 h; ADRs approved; threat model externally reviewed | Phase 1 IA | ADRs cover financial-institution tenants, on-premises deployability, financial data domain | ✅ |
| **3 Authentication and Citizen Profiles** | Citizen & officer authentication, profiles, mandates, simulated national eID, recovery | Auth flows E2E in AR/FR/EN; no high findings; mandate actions logged and visible | Phase 2 | Institution staff SSO (SAML/OIDC), customer OTP access to status page, branch/team-scoped roles | ✅ |
| **4 Digital Documents** | Verifiable-credential issuance, holding, presentation, verification (synthetic); expiry reminders | Issue → hold → present → verify → revoke works; verifier rejects tampered, expired and revoked credentials 100% | Phase 3; renewal deep-links depend on the Phase 5 catalogue* | Case attachments with malware scanning, decision-letter generation, immutable issued copies, retention and legal hold | ✅ |
| **5 Government Services Directory** | Catalogue model, editorial workflow, public pages, ≥ 60 curated procedures | 60 procedures with 100% citations; median "last verified" < 90 days | Phase 2; content sources | Versioned taxonomy engine reused for complaint categories (AR/FR) | ✅ |
| **6 Civil Registry Workflows** | Case management, appointments, notifications, officer dashboards (Workspace v1) | ≥ 3 case types configurable without code; SLA escalations fire; status visible to citizen < 1 min | Phases 3, 5 | Regulated-finance case types: reason codes with mandatory written reasons, mediator/regulator liaison, case-file export, annual board report, customer status page | ✅ |
| **7 Healthcare Prototype** | Health-bridge, FHIR store, consent and break-glass flows, patient access log (**synthetic data**) | Consent journey works E2E on synthetic data; 100% of accesses visible to patient; no clinical data in core | Phases 3, 11 controls; health legal opinion | None | ✅ (synthetic by original definition) |
| **8 Payments and Financial Services** | Payment orchestration, PSP sandbox adapters, receipts, reconciliation | Zero double charges in chaos tests; 100% reconciliation on test data | Phase 6; PSP sandboxes | None. Workspace RF does not process payments; CIVORA's own subscription billing stays outside the product | ✅ |
| **9 Social Security and Education** | Status-tracking adapters (simulated), reimbursement tracking with mandates, diploma issuance and verification | 1,000 synthetic diplomas issued < 10 min; verification works | Phases 4, 6; private-university partner | None | ✅ |
| **10 AI Government Assistant** | Guide 10a (public content) and 10b (opt-in personalisation); evaluation harness; guardrails | Golden-set accuracy ≥ 95%, citation precision ≥ 95%, refusal correctness ≥ 90%; zero eligibility determinations | Phase 5 corpus; model policy (D10) | *Optional, founder decision:* Workspace AI classification and extraction built under the same Phase 10 guardrails | ✅ |
| **11 Security, Testing and Auditing** | MVP gate and pre-pilot gate: pen test, WCAG audit, ANCS-compliant audit, DPIA, DR test; ISO 27001 programme | No open critical/high findings; gate reports signed off | All feature phases | Tenant-isolation pen tests for financial customers; vendor-audit evidence pack | ✅ |
| **12 Official Institutional Integrations** | Agreements, DPIAs, technical onboarding; move adapters from SIMULATED to AUTHORIZED (class 3/5 → 2 → 1) | Each integration accepted by partner with evidence; no undocumented flows | Agreements; legal; Phase 11 pre-pilot gate | Customer-side integrations for financial institutions (SSO, email, SMS, optional core-banking read) and e-KYC partner integrations (P1-D8) | ✅ |
| **13 Pilot Deployment in Tunisia** | Authorised, bounded pilot(s) | Per-pilot targets (e.g. −30% processing time; ≥ 99.5% availability; zero data incidents) | Phase 11 pre-pilot gate; INPDP formalities; hosting | 2–3 Workspace RF production pilots **in addition to** the Government pilot | ✅ |
| **14 National Scaling** | Multi-institution deployments; certifications; partner network | ≥ 3 institutions live; ≥ 99.9% availability; SLAs met 6 months | Successful pilot | Workspace editions (insurance, telecom, utilities); scale across financial sector | ✅ |
| **15 International Expansion** | First international country cell with a reference deployment | Pilot live in first international market | Tunisian references; ISO 27001; funding | Workspace RF country packs for other banking supervisors | ✅ |

\* **Cross-phase dependency carried over from Phase 0:** Phase 4's renewal deep-links depend on the Phase 5 catalogue. Under the original order, this one item is completed when Phase 5 delivers. Phase 4's own acceptance criteria do not depend on it, so no scope is removed.

## 3. Execution mode — founder decision P1-D4a

The original order fixes the **sequence** of phases. It does not say whether a phase may *start* before the previous phase is accepted. Two compliant modes:

| Mode | Rule | Phase 13 start (Moderate / Lean) [A] | Peak cash need to M36 (Moderate) [A] |
|---|---|---|---|
| **A — Strictly sequential** | Each phase starts only after the previous phase is accepted | ~M22–M23 / ~M33–M34 | 8.67M TND |
| **B — Ordered, dependency-respecting overlap** (recommended) | Phases **start** in numerical order. A phase may start while the previous one finishes only if all of its own Phase 0 dependencies are met. Phases are **accepted** in numerical order. Phase 13 starts only after Phases 2–12 are accepted against their full criteria | ~M17–M18 / ~M26–M27 | 7.77M TND |

Mode B is how Phase 0 §19 originally sized the phases: overlapping bars, with a budget per phase. Neither mode removes or weakens any deliverable. Mode B needs a team large enough to run two phase streams at once, which matches the Moderate staffing.

Financial effects are in [20-updated-financial-assumptions.md](20-updated-financial-assumptions.md) §20.6.

## 4. What this means for the first product

- **Validation (now → Phase 13):**
  - discovery (≥ 15 institutions)
  - regulatory validation
  - buyer and purchasing confirmation
  - willingness-to-pay and pricing experiments
  - sandbox design-partner trials on synthetic or authorised test data

  See the [validation evidence register](validation-evidence-register.md).
- **Development:** Workspace RF capabilities are built inside Phases 2–6 and 11–12 as additive acceptance criteria.
- **Production:** only in Phase 13, alongside the Government pilot.
- **Cost of protecting the roadmap:** first production revenue arrives later than in v2.0. Under Moderate, ~M18 in mode B and ~M23 in mode A, versus M14 in v2.0.
