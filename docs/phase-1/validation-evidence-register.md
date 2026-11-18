# Validation Evidence Register (conditions for P1-D3, P1-D7, P1-D9, P1-D12)

**Founder instructions:**
- The opportunity score is **not proof of demand**.
- Phase 1 approval stays pending until the required evidence is documented here.
- **Never fabricate** interviews, commitments, legal approvals, integrations, quotations, market data or validation evidence.

**Updated 18 Nov 2026** (Phase 1 completion and validation mission). Earlier status: see the [change record](change-record.md) §6.

**Status values:**
- **Not started**
- **In progress**
- **Desk evidence only:** useful but not sufficient.
- **Met:** threshold reached, evidence filed.
- **BLOCKED — FOUNDER ACTION REQUIRED:** the remaining evidence needs real-world participation by the founder (interviews, counsel, attorney, quotes, decisions). The materials needed are prepared and linked.

**Confidence:**
- **High:** primary or official source.
- **Medium:** secondary sources that agree, or a desk analysis with a verified basis.
- **Low:** assumption or single secondary source.

## Register

| ID | Evidence required | Threshold for "Met" | Status (18 Nov 2026) | Evidence obtained (source, date) | Verified facts vs assumptions | Confidence | Remaining action → owner | Materials ready |
|---|---|---|---|---|---|---|---|---|
| **E-01** | Customer discovery interviews (P1-D3) | **15 institutions: ≥ 7 banks, ≥ 3 leasing/factoring, ≥ 3 payment institutions** (revised 18 Nov 2026: Circular 2022-08 excludes payment institutions). Consent, reviewed notes and an evidence-log row for each | **BLOCKED — FOUNDER ACTION REQUIRED** (0 of 15 held) | Official population and names: BCT supervision report 2025, published Oct 2026 [V][S165] | **No interview has taken place.** Population counts verified | High (population); none (demand) | Approve target list; native review of emails; send; conduct → **Founder** | [fi-validation-package.md](validation/fi-validation-package.md) §1–5, 11; [target CSV](data/fi-target-institutions.csv); [evidence log](data/interview-evidence-log-template.csv) |
| **E-02** | Regulatory validation (P1-D3) | Official BCT 2022-08 text archived and analysed; counsel memo on the interpretation | **In progress.** Text part complete; counsel part **BLOCKED — FOUNDER ACTION REQUIRED** | Official text from bct.gov.tn, SHA-256 identical to the copy used before [V][S159][S141]. BCT press release [V][S160]. Payment-institution Circular 2026-10 [V][S161]; mobile payment 2020-11 [V][S162]; 2006-19 Art. 52 [V][S164]; Law 2016-48 [V][S167]; Law 2004-63 [V][S168]; Decree-law 2023-17 [V][S169]; Circular 2025-06 [V][S170] | **Verified:** obligations, articles, deadlines (15 working days), reporting (ROGS760 annual, XML, DR + 45 days), payment-institution exclusion. **Assumption:** how they apply to a SaaS vendor (Art. 81 outsourcing, retention, deadline suspension) | High (text); Low (application) | Counsel memo on Q-06–Q-11 and the legal matrix → **Founder + counsel** | [bct-regulatory-verification.md](validation/bct-regulatory-verification.md); [legal matrix](validation/legal-regulatory-verification-matrix.md) |
| **E-03** | Buyer and purchasing process (P1-D3) | For ≥ 8 institutions: economic buyer by role, budget owner, procurement steps, vendor-risk requirements, timeline — from the institution | **BLOCKED — FOUNDER ACTION REQUIRED** | Verified constraints: BCT information before outsourcing contracts (Law 2016-48 Art. 81) [V]; 5 state-owned banks [V][S165] | Buyer roles are hypotheses [A]. Public-procurement status of state-owned banks unverified [U] | Low | Interviews (§6–7 of the package) → **Founder** | [fi-validation-package.md](validation/fi-validation-package.md) §6–7 |
| **E-04** | Willingness to pay (P1-D3, P1-D9) | ≥ 5 budget ranges or tier choices; ≥ 2 **signed** design-partner agreements (L4+) | **BLOCKED — FOUNDER ACTION REQUIRED** | None | Prices are experimental hypotheses | None | WTP questionnaire; design-partner proposals after counsel review → **Founder** | [package](validation/fi-validation-package.md) §8, §11.2; [design-partner package](validation/design-partner-package.md) |
| **E-05** | Competitor validation (P1-D3) | Incumbents at ≥ 10 institutions with satisfaction; ≥ 3 offers or prices | **Desk evidence only**; field part **BLOCKED — FOUNDER ACTION REQUIRED** | Global help-desk list prices [P][S147][S148]. Comparison grid against verified obligations built 18 Nov 2026 | **New finding:** the compliance deadline passed in 2023, so incumbents probably exist at most banks [A]. Local incumbent names unknown [U] | Low | Record incumbents in interviews → **Founder** | [package](validation/fi-validation-package.md) §9 |
| **E-06** | Pricing validation (P1-D9) | ≥ 8 respondents to the pricing experiment; tier acceptance measured | **BLOCKED — FOUNDER ACTION REQUIRED** | None | Experimental | None | Run §8 of the package with interviews → **Founder** | [package](validation/fi-validation-package.md) §8; [19](19-commercial-and-pricing-strategy.md) §19.7 |
| **E-07** | Realistic MVP cost (P1-D3) | Bottom-up estimate **and** ≥ 2 external quotes (hosting; pen test/audit) **and** CTO review | **Desk evidence only**; quotes and review **BLOCKED — FOUNDER ACTION REQUIRED** | Bottom-up estimate revised to **0.60–1.05M TND** (+8–14 person-weeks for FR-60–FR-66), arithmetic re-checked [A] | **No quotation received.** All cost lines are estimates | Medium (method); Low (values) | Request quotes from ≥ 2 labelled Tunisian hosts and ≥ 2 audit/pen-test firms; CTO review → **Founder** | [13](13-mvp-scope-and-specification.md) §13.8 |
| **E-08** | Financial sensitivity analysis (P1-D7) | Sensitivities on the approved timing, refreshed with discovery evidence | **Desk evidence only (complete for v4)** | v4 run: approved execution baseline; cash view with receivable delays; 6 required stresses + combined, for Lean, Moderate and Enterprise; 648 monthly rows verified | **Verified:** formulas and reproducibility. **Assumptions:** every input | Medium (method); Low (inputs) | Refresh after E-01/E-03/E-04/E-07 → **Founder** | [20](20-updated-financial-assumptions.md) §20.7; [sensitivities CSV](data/financial-sensitivities-v4.csv) |
| **E-09** | Original Phase 1 criterion: top-10 pain points evidenced (Government track) | ≥ 30 citizens, ≥ 10 civil servants interviewed; insight report | **BLOCKED — FOUNDER ACTION REQUIRED** | Research kit ready | No field evidence | None | Recruit and interview → **Founder/team** | [supporting/user-research-kit.md](supporting/user-research-kit.md) |
| **E-10** | Original Phase 1 criterion: prototype SUS ≥ 70 | 2 usability rounds; SUS ≥ 70 (Government prototype; Workspace RF agent console) | **BLOCKED — FOUNDER ACTION REQUIRED** | Automated accessibility only (0 axe violations, Government prototype). Six Workspace RF wireframes reviewed and corrected 18 Nov 2026 | No user test held | Low | Run usability rounds → **Founder/team** | Prototype; [product validation](validation/product-validation-report.md) §9–10 |
| **E-11** | Brand / name clearance | Attorney search (INNORPI, WIPO/Madrid, EUIPO, USPTO, GCC) + Arabic phonetic check + domain checks; decision P1-D13 | **Desk evidence only**; clearance **BLOCKED — FOUNDER ACTION REQUIRED** | Weighted evaluation of KELORA / TELORA / NASAQ. Registry RDAP data for .com/.net, 18 Nov 2026 [V][S173]. US aggregators [P][S175]–[S178]. **INNORPI unreachable (TLS failure); WIPO requires human verification (not bypassed)** | KELORA scored highest (75/100) on desk evidence. No register search by an attorney | Medium (domains); Low (trademarks) | Attorney clearance; INNORPI/WIPO manual search; kelora.com quote; native check → **Founder + attorney** | [company-name-evaluation.md](validation/company-name-evaluation.md) |
| **E-12** | Design-partner agreement reviewed by counsel (P1-D11) | Counsel-approved template | **In progress.** Drafts complete; review **BLOCKED — FOUNDER ACTION REQUIRED** | Template v0.1 + 4 new counsel questions from the verified laws; full supporting package (proposal, scope, RACI, metrics, data rules, confidentiality, synthetic data, security questionnaire, evaluation form) | No counsel review yet | — | Send to counsel → **Founder + counsel** | [template](supporting/design-partner-agreement-template.md); [package](validation/design-partner-package.md) |
| **E-13** | Native AR/FR legal-language review | Glossary, disclosures, consent forms, Charter, status texts, invitation emails reviewed | **BLOCKED — FOUNDER ACTION REQUIRED** | Items to review listed: invitation emails (package §4), status-page terms ("شكايتك", "الموفّق المصرفي"), Charter, consent texts | — | — | Engage a native legal-language reviewer → **Founder** | [package](validation/fi-validation-package.md) §4; [product validation](validation/product-validation-report.md) §10 |
| **E-14** | Citizen Data Charter review | Counsel + ≥ 2 civil-society organisations | **BLOCKED — FOUNDER ACTION REQUIRED** | Draft v1 | — | — | Send for review → **Founder** | [supporting/citizen-data-charter.md](supporting/citizen-data-charter.md) |
| **E-15** | Execution-mode decision (P1-D4a) | Founder chooses | **Met (18 Nov 2026)** | Founder approved **P1-D4: overlapping independent activities**, with all original phase dependencies, order, full scope, deliverables and approval gates preserved | Decision recorded | High | None | [23](23-founder-approval-decisions.md); [roadmap-protection-matrix.md](roadmap-protection-matrix.md) §3 |

**Summary:**
- 1 of 15 met (E-15).
- 3 have desk evidence only (E-05, E-07, E-08), and E-11 has desk evidence pending clearance.
- 2 are in progress (E-02, E-12).
- The rest are **blocked on founder action**.

**No item was marked "Met" because a document describing it exists.**

## Decision rules at the Day-90 gate (unchanged except E-01 composition)

| Evidence outcome | Consequence |
|---|---|
| E-01, E-02, E-03, E-04 **Met** and no blocking finding in E-05/E-07 | P1-D3 confirmed. Funding target can be committed (P1-D7). Phase 1 eligible for approval (P1-D12) once E-09/E-10/E-11 are met or explicitly waived by the founder |
| E-01 Met but E-04 weak (no willingness to pay) | Re-score ([09](09-opportunity-scoring-matrix.md)); consider document processing (Phase 10 timing) or a Government-first donor route; **no funding commitment** |
| E-02 counsel memo reveals blocking constraints (e.g. outsourcing approval that customers won't seek) | Shift to an on-premises licence model or revise the first product |
| **E-05 shows banks satisfied with tools installed for the 2023 deadline (H-R6 refuted)** | Narrow to leasing/factoring and the payment-institution rule pack, or revisit P1-D3 |
| E-11 confirms trademark conflict for the preferred name | Choose another candidate before any brand expenditure (P1-D13) |
