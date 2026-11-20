# Design-Partner Documentation Package — Controlled Paid Trial (Sandbox)

| | |
|---|---|
| Decisions | P1-D5 (**approved**: paid design-partner trials before Phase 13, synthetic or properly authorised test data only, no unauthorised production deployment); P1-D11 (**approved in principle**, subject to qualified Tunisian counsel) |
| Agreement | [supporting/design-partner-agreement-template.md](../supporting/design-partner-agreement-template.md) (DRAFT v0.2, 18 Nov 2026; counsel questions 1–10) |
| Evidence item | E-12 (counsel review). Supports E-04 (≥ 2 signed agreements) |
| **Status** | **Drafts ready for counsel. Not for signature.** No partner has been approached. Status: **BLOCKED — FOUNDER ACTION REQUIRED** (counsel review; partner selection) |

> **Gate statement (applies to every document below):**
> - The trial is a **sandbox evaluation**. It is **not** a production deployment.
> - Production use of CIVORA by any institution happens only through the original **Phase 13 — Pilot Deployment in Tunisia** gate, after Phases 2–12 are accepted (P1-D4).
> - No real customer data is processed unless it is **properly authorised test data** as defined in the agreement (clause 3).

## 1. Design-partner proposal (to send after a discovery interview)

**Subject:** Proposal — sandbox design-partner programme for complaint management (BCT Circular 2022-08)

1. **Who we are.** [Company name], an independent Tunisian start-up (working name CIVORA, P1-D13). We have no relationship with the BCT or any authority, and nothing in this programme implies their endorsement.
2. **What we propose.** A [8–12]-week sandbox trial of a complaint- and request-management workspace. It is designed around the obligations of BCT Circular 2022-08 (Art. 2, 6–14; Annexes 1–3) and runs on **synthetic data**.
3. **What you get:**
   - early influence on the product
   - an evaluation of fit with your procedures
   - a written report on the findings
   - preferential terms if you later choose to buy (no obligation)
4. **What we ask:**
   - a sponsor and 3–6 participants
   - 6–10 hours of participants' time over the trial
   - your procedure documents (non-confidential versions)
   - feedback sessions
   - a design-partner fee of [amount, experimental: see [19](../19-commercial-and-pricing-strategy.md) §19.7], or a letter of intent if a fee is not possible
5. **What we will not do:**
   - connect to your production systems
   - receive customer data, unless it is authorised test data under clause 3
   - use your name publicly without written consent
   - present the trial as a deployment or a certification
6. **Next step:** a 30-minute scoping call with your complaints lead and IT/security contact.

## 2. Pilot scope

| In scope (sandbox) | Out of scope |
|---|---|
| Intake (agent form, web form, email-to-case) on synthetic cases | Any connection to production core banking, CRM, email or SMS |
| Case types and Art. 2 exclusions; deadline engine with the 15-working-day ceiling; acknowledgements | Real customer communications |
| Reasoned decisions and templates (AR/FR) | Processing of real complaints |
| Status page (AR/FR), with notifications to test devices only | Hosting of partner data outside Tunisia |
| Correspondent workspace and case-file export | Any submission to the BCT or the mediator |
| Dashboard, board report, ROGS760 dataset (on synthetic data) | AI features (Phase 10 only) |
| Administration: categories, deadlines, templates, roles | Payment or e-KYC functions |
| Optional: SSO test against a partner **test** identity provider | Production SSO |

**Environment:**
- A dedicated sandbox tenant on CIVORA's staging infrastructure, hosted in Tunisia.
- Partner users have test accounts.
- Data is wiped at the end.

**Duration:** 8–12 weeks, in three stages:

| Stage | Weeks | Activities |
|---|---|---|
| Configuration | 1–2 | Set up categories, deadlines and templates |
| Usability rounds | 3–8 | Two rounds of usability sessions |
| Evaluation | 9–12 | Reporting exercise and final evaluation |

## 3. Responsibilities (RACI)

R = responsible, A = accountable, C = consulted, I = informed.

| Activity | Partner sponsor | Partner complaints lead | Partner IT/security | Partner compliance/DPO | CIVORA founder | CIVORA product/engineering |
|---|---|---|---|---|---|---|
| Sign agreement (after counsel review) | A | C | C | C | R | I |
| Confirm data category (synthetic / authorised test data) | I | C | C | **A** | R | C |
| Provide procedure documents (non-confidential) | I | R | I | C | A | I |
| Configure sandbox | I | C | I | I | A | R |
| Generate synthetic dataset | I | C | I | C | A | R |
| Usability sessions and SUS | I | R | I | I | A | R |
| Security review of the sandbox (questionnaire §8) | I | I | R | C | A | R |
| Evaluation form (§9) | A | R | C | C | R | I |
| Data deletion and certificate | I | I | C | A | A | R |
| Decide on any later purchase (no obligation) | A | C | C | C | I | I |

## 4. Success metrics

| Metric | Target | Measured by |
|---|---|---|
| Workflow fit: share of the partner's complaint categories and steps represented without custom code | ≥ 90% | Configuration review |
| Regulatory fit: partner compliance confirms that Art. 8 deadlines, acknowledgements, reasoned rejections and Annex 1 fields are handled correctly on test cases | Sign-off on ≥ 9 of 11 acceptance criteria A1–A11 ([product validation](product-validation-report.md) §9) | Evaluation form §9 |
| Agent usability | SUS ≥ 70 | Two rounds, ≥ 5 participants each |
| Intake speed | Median ≤ 2 minutes per branch intake | Timed tasks |
| Reporting effort | Board report draft and ROGS760 dataset produced in < 1 hour on synthetic data | Timed task |
| Willingness to continue | Partner states intention to evaluate production (Phase 13) | Evaluation form |
| Commercial | Price feedback collected; tier preference | Evaluation form (feeds E-04/E-06) |

## 5. Data-protection requirements

1. **Default: synthetic data only**, generated by CIVORA under §7. No real names, accounts or complaint texts.
2. **Properly authorised test data** (exception), only if all of the following hold:
   - The partner's DPO confirms in writing that it contains no personal data, or is anonymised to an approved standard.
   - Counsel confirms banking-secrecy compliance (Law 2016-48 Art. 61).
   - Any INPDP formality required is completed (Law 2004-63 Art. 7, 15). Authorisation is needed for data under Art. 14.
3. **Roles.** For any personal data, the partner is the **controller**; CIVORA is a **processor** acting only on written instructions (Law 2004-63 Art. 20). Processor agents must meet the Art. 22 conditions: nationality, residency, record. Counsel must confirm how these apply.
4. **Location.** Sandbox hosted in Tunisia. **No transfer abroad** (Law 2004-63 Art. 50–52). No foreign sub-processors receive trial data.
5. **Security measures** per Law 2004-63 Art. 18–19:
   - access control
   - audit log of access and changes
   - encryption in transit and at rest
   - backups
6. **Retention.** The trial dataset is deleted within 10 working days of the end of the trial, with a deletion certificate. Logs are kept only as long as needed for the security record.
7. **Incidents.** CIVORA notifies the partner without undue delay, and in any case within [24] hours of detection. Decree-law 2023-17 notification duties apply where CIVORA is in scope.

## 6. Confidentiality provisions (to align with agreement clause 7)

- Mutual confidentiality for **[3] years** after the trial; indefinitely for banking-secret information.
- CIVORA staff with sandbox access sign individual confidentiality undertakings that refer to banking professional secrecy (Law 2016-48 Art. 61; Penal Code Art. 254) and to Law 2004-63 Art. 23.
- Partner documents are used only for the trial. They are stored in the sandbox workspace and returned or deleted at the end.
- No publicity, logo use or case study without separate written consent (agreement clause 9).
- Feedback may be used to improve the product without identifying the partner (agreement clause 8, counsel question 6).

## 7. Synthetic-data testing provisions

| Rule | Detail |
|---|---|
| Generation | Synthetic cases are produced by CIVORA from **templates and random generators**, never derived from or "masked" from real records |
| Content | Fictitious names from generic lists; fake reference numbers with a test prefix (e.g. `TEST-`); amounts and dates randomised; no real RNE identifiers, account numbers or phone numbers. Test phones and emails belong to the participants' test devices |
| Coverage | Every Annex 3 subject; every channel; complaint/request/out-of-scope cases (Art. 2); deadline edge cases (holidays, day 15, overdue); rejections and partial rejections; mediator escalation; payment-institution and mobile-payment rule packs if relevant |
| Labelling | Every screen and export carries "SYNTHETIC — TEST DATA" |
| Partner-supplied scenarios | The partner may describe scenarios in words. CIVORA recreates them synthetically. The partner must not paste real complaint text |
| Verification | Before go-live of the sandbox, the partner DPO checks a sample of 20 synthetic cases and confirms that no real data is present (attestation in the evaluation file) |
| Deletion | Dataset and accounts deleted at the end, with a certificate |

## 8. Security questionnaire

### 8.1 Questions CIVORA will answer (vendor pack for the partner's IT/security)

| # | Question | CIVORA answer at trial time |
|---|---|---|
| S1 | Legal entity, ownership, insurance | [Company details: to complete] |
| S2 | Hosting provider, location, certifications or labels (G-cloud/N-cloud) | [Tunisian host, to contract] |
| S3 | Tenant isolation model | Separate sandbox tenant; database-level isolation [design] |
| S4 | Encryption in transit and at rest; key management | TLS 1.2+; encrypted storage [design] |
| S5 | Authentication: MFA, SSO support | MFA for all accounts; SAML/OIDC available |
| S6 | Access by CIVORA staff: who, how, logged? | Named staff only, with MFA; every access logged; Art. 22 conditions |
| S7 | Audit log: content, integrity, export | Tamper-evident (hash chain); exportable |
| S8 | Vulnerability management; last penetration test | [Pen test before trial: date and summary] |
| S9 | Security audit under Decree-law 2023-17 (if applicable); CERT membership | [Status] |
| S10 | Incident response and notification time | Plan; ≤ [24] h notice to partner |
| S11 | Backups, restore tests, RPO/RTO (sandbox) | Daily backups; RPO 24 h for the sandbox |
| S12 | Sub-processors | List (all in Tunisia); none receive trial data beyond hosting |
| S13 | Data deletion at end of trial | Within 10 working days, with certificate |
| S14 | Secure development: code review, dependency scanning, secrets management | [Process description] |
| S15 | Right of audit for the partner and, on request, the BCT | Accepted, subject to counsel review (template question 10) |

### 8.2 Questions CIVORA asks the partner

1. Vendor-risk procedure and the documents required.
2. Whether a sandbox trial triggers BCT outsourcing information (Law 2016-48 Art. 81).
3. The test identity provider, if SSO testing is wanted.
4. Network restrictions for participants' access.
5. The partner's own data-classification rules.

## 9. Pilot evaluation form (completed by the partner at the end of the trial)

| Section | Questions | Scale / answer |
|---|---|---|
| A. Participation | Number of participants and roles; sessions attended | — |
| B. Regulatory fit | For each acceptance criterion A1–A11: confirmed / partly / not confirmed / not tested | Per criterion + comment |
| C. Workflow fit | Share of your categories and steps represented; missing steps | % + list |
| D. Usability | SUS results (attached); top three usability problems | — |
| E. Reporting | Could the board report and ROGS760 dataset replace your current preparation? | Yes / partly / no + hours saved estimate |
| F. Customer status page (AR/FR) | Clarity, tone, legal wording | 1–5 per language + comments (feeds E-13) |
| G. Security and data | Any blocking requirement not met? | List |
| H. Commercial | Preferred pricing model; reaction to the experimental tiers; budget timing | Free text (feeds E-04/E-06) |
| I. Next step | No further interest / interested in Phase 13 production pilot / interested in purchase evaluation | Choice (**not a commitment unless separately signed**) |
| J. Data attestation | Synthetic data confirmed; deletion certificate received | Yes/no, signed by DPO |

## 10. Counsel review checklist (E-12)

All drafts in this package and the agreement template must be reviewed by qualified Tunisian counsel before use. The review must cover:

- Agreement template questions 1–10 (incl. Law 2016-48 Art. 81 and 61; Law 2004-63 Art. 22 and 52; audit rights)
- Fee structure versus the partner's procurement rules
- Language versions (French; Arabic where required)
- Liability, insurance and dispute forum
- Confidentiality duration and banking secrecy
- Data attestation wording (§7, §9-J)
