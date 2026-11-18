# 14. User Journeys

Two sets of journeys:
- **Part A:** the first product, Workspace for Regulated Finance. New in v2.0.
- **Part B:** the Government-track service blueprints, retained from v1.0 and still valid for Division A.

All journeys are **hypotheses until validated** in the 90-day discovery.

**Layers in each blueprint:**
- **Evidence:** what the user sees or holds.
- **User:** actions.
- **Frontstage:** CIVORA UI or staff interaction.
- **Backstage:** staff or system work not visible to the user.
- **Support:** systems and partners.
- **⚠ Fail points.**
- **📏 Metrics.**

---

# Part A — Workspace, Regulated Finance edition

## R1 — Customer complains at a branch and tracks the case (Youssef, Mehdi)

| Layer | Complain | Acknowledge | Wait | Decision | After |
|---|---|---|---|---|---|
| Evidence | Branch notice explaining procedure, deadlines, mediation | SMS with reference + deadline | Status page (AR/FR) | Decision letter with reasons + mediator information | Satisfaction survey |
| User (customer) | Explains a failed transfer at the counter | Keeps reference | Checks status on phone; answers an information request | Reads decision | Accepts, or escalates to mediator |
| Frontstage | Mehdi uses the 2-minute intake form | Printed/SMS acknowledgement | Status page; SMS on change | Letter by SMS link/email/post | Survey link |
| Backstage | Case created; category; deadline computed; routed to HQ team | Notification service | Sana handles; sub-task to branch for receipt copy | Reason code + explanation required for rejection | Closure; audit |
| Support | Workspace intake, taxonomy, SLA rules | SMS gateway | Workflow engine | Template library, PDF generation | Reporting |
| ⚠ | Wrong category; missing contact number | SMS not delivered | Branch ignores sub-task | Template misused; unclear reasons | Mediator escalation without complete file |
| 📏 | Intake time | Delivery rate | Status-page visits vs calls | % within deadline; rejection-with-reason rate = 100% | CSAT; escalation rate |

## R2 — Handler resolves a case on time (Sana)

| Layer | Pick up | Investigate | Decide | Communicate | Close |
|---|---|---|---|---|---|
| Evidence | Queue sorted by remaining time | Case timeline, documents | Decision panel | Letter preview | Closed status |
| User | Opens most urgent case | Requests document from branch; checks core system (read-only lookup, later) | Chooses outcome + reason code; writes explanation | Sends via customer's channel | Confirms closure |
| Frontstage | Queue & case page | Sub-task panel | Template picker (AR/FR) | Preview & send | — |
| Backstage | SLA timers; at-risk alerts | Sub-task deadline; optional SLA pause per policy | Validation blocks rejection without reasons | Immutable issued copy stored | Audit, metrics |
| ⚠ | Overload; unclear priority | Branch delay | Inconsistent decisions across handlers | Wrong language | Premature closure |
| 📏 | Time to first action | Sub-task turnaround | Decision consistency (sample audit) | Delivery | Handling time; reopen rate |

## R3 — Escalation to the banking mediator (Karim)

| Layer | Trigger | Assemble | Liaise | Outcome | Learn |
|---|---|---|---|---|---|
| Evidence | Customer escalation notice | Exported case file (PDF + JSON) | Correspondence log | Mediator outcome recorded | Root-cause report |
| User | Receives mediator request | Exports complete file in one click | Responds within the mediator's deadline | Links outcome to case | Reviews patterns with Rim |
| ⚠ | Missed mediator deadline | Missing documents | Duplicate correspondence | Outcome not applied | Same issue repeats |
| 📏 | Time to compile file (< 30 s) | Completeness | Response time | Mediator decisions upheld/overturned | Repeat-complaint rate |

## R4 — Annual board report (Rim)

1. Rim selects the period.
2. The wizard pre-fills volumes, deadlines met, categories, root causes, mediator cases and actions taken.
3. Rim adds commentary.
4. She exports to PDF/DOCX.
5. The board presentation is ready in under 1 hour.

- **⚠ Fail points:** inconsistent categories across years. Mitigation: taxonomy versioning.
- **📏 Metric:** preparation time.

## R5 — Tenant setup (Walid, Ines)

1. Configure SSO.
2. Import users and teams.
3. Set up branches.
4. Define categories with their SLA rules.
5. Load the holiday calendar.
6. Get templates approved by Compliance.
7. Set retention policies.
8. Run a test case.
9. Go live.

- **📏 Metric:** time to configure a new institution, targeting ≤ 5 working days with CIVORA support [A].

---

# Part B — Government-track service blueprints (retained from v1.0)

## GB1 — "First time right": finding a procedure and preparing (J1, Amira)

| Layer | Discover | Understand | Prepare | Act | Follow-up |
|---|---|---|---|---|---|
| Evidence | Search result / shared link | Guide answer with citations and date | Personal checklist | Official service page or booking confirmation | Reminder notification |
| User | Searches "تجديد الباسبور" or asks in Derja | Reads steps, fees, offices | Ticks documents she has; saves checklist | Follows deep-link to official service | Receives expiry reminder years later |
| Frontstage | Service page (SSR, fast) | Guide chat; "unofficial" notice | Checklist UI; office locator | Deep-link with explanation "you are leaving CIVORA" | Push/email |
| Backstage | Search with Arabic normalisation | RAG retrieval, citation check, refusal logic | Checklist stored locally or in account | Click-through logged (no personal data) | Reminder scheduler |
| Support | Catalogue (pg-public) | Model gateway, corpus | — | Official portals | Notification service |
| ⚠ | Wrong service matched | Outdated source; dialect misunderstanding | Conditional documents missed ("if born abroad") | Official service down | Reminder to wrong contact |
| 📏 | Search success rate | Accuracy, "answered my question" % | Checklist completion | Click-through rate | Reminder open rate |

## GB2 — Reimbursement tracking with a mandate (J3, Hédi and his daughter)

| Layer | Set up mandate | Submit / link claim | Track | Resolve | Review |
|---|---|---|---|---|---|
| Evidence | Mandate confirmation (SMS to Hédi, app for daughter) | Claim reference | Timeline with statuses | "Payment issued" notice | Access log entries |
| User | Hédi agrees at counter or by call-back; daughter accepts in app | Daughter enters claim reference (or claim appears via integration) | Daughter checks status; Hédi gets SMS in Arabic | Daughter responds to "action needed" | Hédi can ask the counter to show the log / revoke |
| Frontstage | Counter agent using Workspace "assisted mode"; app acceptance screen | Request screen with "acting on behalf of Hédi" banner | Status timeline, plain-language explanations | Upload correction | Access log (app or printed at counter) |
| Backstage | Mandate record (scopes, expiry); anti-abuse check (70+ principal) | Status subscription | Status feed from fund (authorised) or officer updates | Officer processes correction in Workspace | Audit chain |
| Support | IAM + policy engine | Integration adapter (`SIMULATED` → `AUTHORIZED`) | Notification service | Workspace | Consent & audit service |
| ⚠ | Coercion / abuse of elderly principal | No fund integration → manual status | Notification fatigue / wrong language | Correction not understood | Principal can't read the log |
| 📏 | Mandates created / revoked | % claims with status visibility | "Where is my file?" calls | Correction turnaround | Log views; revocations |

## GB3 — Diaspora: consular appointment and document guidance (J4, Yassine)

| Layer | Learn | Enrol eID (if needed) | Book | Visit / remote | Receive |
|---|---|---|---|---|---|
| Evidence | Guide answer in French | e-Houwiya enrolment guidance (official) | Booking confirmation with document list | Check-in QR at consulate | Document / notification |
| User | Asks "comment obtenir un extrait de naissance depuis Lyon ?" | Follows official enrolment steps | Picks consulate and slot (time zone aware) | Attends with documents | Collects or receives |
| Frontstage | Guide (FR) + catalogue | Deep-link to official e-Houwiya page | Appointment UI (Workspace-backed) | Consular counter using Workspace | Status updates |
| Backstage | Corpus with consular procedures | — | Capacity per consulate/service | Case created at check-in | Case closure |
| Support | Catalogue, Guide | Official portals | Workspace appointments | Workspace | Notifications |
| ⚠ | Procedure differs by consulate | Enrolment friction abroad | Slots full; no-shows | Missing documents | Courier delays |
| 📏 | Answer usefulness (FR) | Enrolment completion (self-reported) | Booking lead time; no-show % | First-time-right % | Time to document |

*Requires a consular deployment contract (Phase 0, D13 option (a)).*

## GB4 — Officer case processing (J7, Nour)

| Layer | Intake | Verify | Decide | Communicate | Learn |
|---|---|---|---|---|---|
| Evidence | Queue sorted by SLA | Checklist with pre-check flags | Decision with reason code | Citizen notification sent | Dashboard |
| User (officer) | Picks next case | Opens documents; ticks checklist | Approves / requests correction / rejects | Adds message from approved templates | Supervisor reviews backlog and reasons |
| Frontstage | Workspace queue | Case detail; document viewer | Action panel with mandatory reason | Template picker (AR/FR) | Dashboard |
| Backstage | SLA timers; assignment rules | Malware scan; format checks; duplicate detection | State machine; audit event | Notification service | Aggregated metrics (no personal data) |
| Support | Workspace, policy engine | Object storage | Audit chain | Messaging providers | Analytics store |
| ⚠ | Wrong office routing | Poor scans; forged documents | Inconsistent decisions between officers | Messages misunderstood | Metrics gamed |
| 📏 | Time in queue | Verification time | Decision consistency (sample audit) | Correction response rate | Median processing time; SLA breaches |

## GB5 — Bank remote onboarding (J8, B2B — CIVORA Trust)

| Layer | Start | Capture | Verify | Sign | Evidence & audit |
|---|---|---|---|---|---|
| Evidence | Bank app screen ("Verified by CIVORA Trust on behalf of Bank X") | CIN photo capture guidance | Result screen | Signed contract (TunTrust certificate) | Consent receipt to customer |
| User (customer) | Starts account opening | Photographs CIN front/back; selfie liveness | Waits seconds | Signs contract | Receives receipt; can see access log |
| Frontstage | Bank UI (SDK/hosted page) | Capture SDK with quality hints in AR/FR | Status messaging | Signature flow | Receipt |
| Backstage | Session created via API (mTLS) | OCR, document authenticity checks (vendor) | Liveness + face match (vendor, no template retention); screening; consistency rules | Signature via TunTrust | KYC sheet + evidence pack stored in bank tenant (Tunisia) |
| Support | CIVORA Trust API | Vendor adapter | Vendor, screening provider | TunTrust adapter | Object lock storage; audit |
| ⚠ | Abandonment at capture | Glare/blur; damaged CIN | False rejects (skin tone, lighting); presentation attacks | Certificate issuance delays | Missing evidence for BCT audit |
| 📏 | Start → capture conversion | Capture success % | Pass rate; false reject rate; fraud catch | Time to signature | Audit findings |
