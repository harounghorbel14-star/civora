# Usability-Testing Kit (E-10)

| | |
|---|---|
| Purpose | Run the two usability rounds that the original Phase 1 roadmap requires (**prototype SUS ≥ 70**) for both prototypes |
| Prototypes | (1) **Workspace RF**, agent console and customer status page: [design/prototype/workspace-rf.html](../../../design/prototype/workspace-rf.html) (new, 18 Nov 2026). (2) **Government track**: [design/prototype/index.html](../../../design/prototype/index.html) |
| Evidence item | E-10. Threshold: 2 rounds; SUS ≥ 70 for each prototype |
| Status | **Prototype and kit ready; automated checks passed. Testing with people needs the founder and participants** |

Both prototypes are design artefacts. They contain synthetic data only, make no network calls and store nothing. Open them in any modern browser from the file, or from a private published copy.

**Private published copy of the Workspace RF prototype:** https://claude.ai/artifact/Kekc7Ac8whrYGxPSyz8pmS. It is private: share it from the page's Share menu before sending it to participants, or run sessions on your own laptop from the file.

## 1. Automated pre-checks completed (18 Nov 2026)

Workspace RF prototype, headless Chromium + axe-core 4.10.2:

| Check | Result |
|---|---|
| Views × languages × viewports × colour schemes | 6 console views (FR, EN) + customer view (FR, AR, EN); 390 px and 1280 px; light and dark |
| WCAG 2.0/2.1/2.2 A and AA automated rules | **0 violations** |
| Horizontal overflow | None |
| Arabic customer view | `dir="rtl"` applied; official terms (شكوى, الموفّق البنكي) |
| Scripted task paths T1–T9 (§4) | **All completed as designed.** For example: rejection without explanation blocked; the 15-working-day ceiling enforced in administration; "information requested" leaves the regulatory deadline unchanged; mediator export excludes internal notes; ROGS760 preview computed |
| JavaScript errors | None |

The Government prototype was checked in v1.0 (0 axe violations; FR/AR/EN). Automated checks do **not** replace testing with users.

## 2. Participants

| Prototype | Profile | Round 1 | Round 2 | Where to recruit |
|---|---|---|---|---|
| Workspace RF (agent console) | Complaint handlers, branch staff who log complaints, complaint-unit heads, compliance staff | 5 | 5 | Interviewed institutions (ask at the end of each interview; [outreach kit](outreach-kit.md)); design partners. *Fallback for round 1 only:* customer-service agents from other sectors, reported separately |
| Workspace RF (customer status page) | Adult bank customers, mixed Arabic/French preference, incl. ≥ 2 aged over 60 | 5 | 5 | Same recruitment as the Government track ([recruitment kit](government-research-recruitment-kit.md)) |
| Government prototype | Citizens (mixed age, region, language); ≥ 2 civil servants for the officer view | 5 | 5 | [Recruitment kit](government-research-recruitment-kit.md) |

Five participants per round per prototype finds most severe problems [A]. The SUS ≥ 70 criterion is judged on the **round-2 mean**, with the 90% confidence interval reported.

## 3. Session protocol (45 minutes)

| Minutes | Step |
|---|---|
| 0–5 | Welcome. Say: "We are testing the prototype, not you." **Written consent** checked (§6). Explain think-aloud |
| 5–8 | Background: role, tools used today (no customer data) |
| 8–33 | Tasks (§4), one card at a time. Moderator does not help unless the participant is stuck for 2 minutes |
| 33–38 | **SUS questionnaire** (§5), on paper or form, in the participant's language |
| 38–45 | Debrief: best, worst, missing; "Would this replace what you use today?" |

**Moderator rules:**
- Read task cards word for word.
- Never name the screen or button.
- Note the time to complete.
- Use the **reset button** in the prototype between participants.

## 4. Task cards

### 4.1 Workspace RF (agent console, French). Fixed synthetic date: 18/11/2026

| # | Persona | Task card (read to participant) | Success criterion | Requirement tested |
|---|---|---|---|---|
| T1 | Branch manager | « Un client se présente à l'agence pour contester un paiement par carte. Enregistrez sa réclamation et donnez-lui sa référence et la date limite de réponse. » | Case created as *Réclamation*, subject *Monétique*; participant reads the reference and the date aloud (09/12/2026) | FR-01, FR-04, FR-61; A2 |
| T2 | Complaints handler | « Trouvez le dossier qui a dépassé son échéance et ouvrez-le. » | RC-2026-0412 opened | FR-07, FR-09 |
| T3 | Complaints handler | « Ce client n'a droit qu'à un remboursement partiel. Émettez la décision. » | Participant recovers from the block and issues the decision with a reason code and an explanation | FR-15, FR-16; A3 |
| T4 | Complaints handler | « Pour le dossier RC-2026-0421, demandez au client son relevé. Le délai réglementaire change-t-il ? » | Request sent; participant answers "non" | FR-61; Q-07 |
| T5 | Branch manager | « Une cliente demande seulement le taux d'un crédit. Enregistrez sa demande. » | Recorded as *Demande d'information* (no regulatory deadline) | FR-60 |
| T6 | Correspondent | « Le médiateur demande le dossier RC-2026-0377. Exportez-le sans les notes internes. » | Export generated with notes excluded | FR-26; Art. 13 |
| T7 | Head of customer relations | « Combien de réclamations "Monétique" figurent dans l'état annuel BCT, et quel est leur délai moyen de réponse ? » | Correct numbers read from the ROGS760 preview | FR-65; Art. 14 |
| T8 | Administrator | « Fixez le délai de la catégorie "Tarification" à 20 jours ouvrables. » (then) « Fixez-le à 10. » | Participant understands the refusal (ceiling 15) and sets 10 | FR-61; A1 |
| T9 | Bank customer (mobile, Arabic) | « لديك شكوى مرجعها RC-2026-0418 والرمز 482913. اطّلع على وضعيتها وابحث عمّا يمكنك فعله إن لم يرضك الردّ. » | Status page opened in Arabic; participant finds the mediator information | FR-20, FR-22; Art. 7 |

### 4.2 Government prototype (citizen and officer)

| # | Task card | Success criterion |
|---|---|---|
| G1 | "Find what documents you need for a residence certificate." (Guide or directory) | Documents found and source shown |
| G2 | "Your request REQ-2026-00412 is missing a document. Add it." | Document uploaded; status changes |
| G3 | "Show your diploma to an employer without giving more information than needed." | Credential presented with selective disclosure |
| G4 | "Find out which organisations looked at your data." | Access log opened |
| G5 | Officer: "Approve the request REQ-2026-00412 if it is complete." | Approval only after the document is present |
| G6 | "Ask the Guide a question that includes your ID number." | The participant notices that personal data was removed |

## 5. System Usability Scale (SUS)

**Use the published validated translations when available:**
- French: **F-SUS**, Gronier & Baudet (2021) [S192]. The French item wording is reproduced in a public document from Université de Lille, linked in S192.
- Arabic: **A-SUS**, AlGhannam et al. (2018) [S193].

The working translations below are a **fallback only**. If they are used, the results must be flagged as "non-validated translation" in the report.

| # | English (Brooke, 1996) | FR (working) | AR (working) |
|---|---|---|---|
| 1 | I think that I would like to use this system frequently. | Je pense que j'aimerais utiliser ce système fréquemment. | أعتقد أنني سأرغب في استعمال هذا النظام بصفة متكرّرة. |
| 2 | I found the system unnecessarily complex. | J'ai trouvé ce système inutilement complexe. | وجدت هذا النظام معقّدا دون داع. |
| 3 | I thought the system was easy to use. | J'ai trouvé ce système facile à utiliser. | وجدت هذا النظام سهل الاستعمال. |
| 4 | I think that I would need the support of a technical person to be able to use this system. | Je pense que j'aurais besoin de l'aide d'une personne technique pour pouvoir utiliser ce système. | أعتقد أنني سأحتاج إلى مساعدة شخص تقني لأتمكّن من استعمال هذا النظام. |
| 5 | I found the various functions in this system were well integrated. | J'ai trouvé que les différentes fonctions de ce système étaient bien intégrées. | وجدت أنّ مختلف وظائف هذا النظام مندمجة بشكل جيّد. |
| 6 | I thought there was too much inconsistency in this system. | J'ai trouvé qu'il y avait trop d'incohérences dans ce système. | وجدت أنّ في هذا النظام الكثير من عدم الانسجام. |
| 7 | I would imagine that most people would learn to use this system very quickly. | J'imagine que la plupart des gens apprendraient très rapidement à utiliser ce système. | أتصوّر أنّ أغلب الناس سيتعلّمون استعمال هذا النظام بسرعة كبيرة. |
| 8 | I found the system very cumbersome to use. | J'ai trouvé ce système très lourd à utiliser. | وجدت استعمال هذا النظام مرهقا جدّا. |
| 9 | I felt very confident using the system. | Je me suis senti(e) très en confiance en utilisant ce système. | شعرت بثقة كبيرة وأنا أستعمل هذا النظام. |
| 10 | I needed to learn a lot of things before I could get going with this system. | J'ai dû apprendre beaucoup de choses avant de pouvoir utiliser ce système. | احتجت إلى تعلّم أشياء كثيرة قبل أن أتمكّن من استعمال هذا النظام. |

**Scale:**
- 1 = strongly disagree, 5 = strongly agree.
- FR: « Pas du tout d'accord » … « Tout à fait d'accord ».
- AR: «غير موافق إطلاقا» … «موافق تماما».

**Scoring:**
- Odd items: score − 1.
- Even items: 5 − score.
- SUS = sum × 2.5, giving a range of 0–100.

The template [../data/sus-scoring-template.csv](../data/sus-scoring-template.csv) has the columns needed. Compute per participant, then the mean and the 90% confidence interval per round and prototype.

## 6. Consent and information for test participants (Law 2004-63 Art. 27, 31)

Use the **notice** and **consent form** of the [outreach kit](outreach-kit.md) §4–5, with these changes:

| Field | Usability test version (FR / AR) |
|---|---|
| Finalité / الهدف | Tester un prototype fictif pour améliorer sa facilité d'utilisation / اختبار نموذج أوّلي تجريبي لتحسين سهولة استعماله |
| Données / المعطيات | Prénom, tranche d'âge, fonction (agents), observations, réponses au questionnaire SUS, enregistrement de l'écran et de la voix **uniquement si accepté** / الاسم، الفئة العمرية، الصفة (للأعوان)، الملاحظات، إجابات الاستبيان، وتسجيل الشاشة والصوت **فقط في صورة الموافقة** |
| Conservation / مدّة الحفظ | Enregistrements supprimés après analyse (≤ 30 jours) ; scores anonymisés conservés 24 mois / تُحذف التسجيلات بعد التحليل (30 يوما على الأكثر)؛ وتُحفظ النتائج مجهولة الهوية 24 شهرا |
| Case à cocher supplémentaire / خانة إضافية | ☐ J'accepte l'enregistrement de l'écran / ☐ أوافق على تسجيل الشاشة |

**No real customer data may be typed into the prototype.** The moderator checks this at the start.

## 7. Observation sheet (one per participant)

| Task | Completed (Y / with help / N) | Time (s) | Errors / wrong paths | Quotes (verbatim) | Severity of problem (1 cosmetic – 4 blocking) |
|---|---|---|---|---|---|
| T1 … T9 / G1 … G6 | | | | | |

## 8. Analysis and reporting

1. **Per task:** completion rate, median time, the main problems and their severity.
2. **SUS:** mean and 90% CI per prototype and round. E-10 is met only if **both prototypes reach a round-2 mean ≥ 70**.
3. **Fix list:** every severity 3–4 problem gets a design change before round 2. Changes are made in the prototypes and wireframes, not in product code.
4. **Report:** one page per round, filed with the [evidence register](../validation-evidence-register.md) (E-10).
