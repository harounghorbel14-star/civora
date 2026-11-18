# 7. UX Writing Guidelines and Terminology

> **Review requirement:** all Arabic and French strings in this document and in the prototype must be reviewed by a native editor with administrative/legal language experience before any external use. Derja forms are indicative and must be validated with users from several regions, since Derja varies (Tunis, Sfax, Sahel, South).

## 7.1 Language strategy

| Surface | Arabic | French | English |
|---|---|---|---|
| Interface (buttons, menus, forms) | **Simple MSA** using Tunisian administrative vocabulary (e.g. *مطلب*, *معاليم*, *المعطيات الشخصية*) | Standard French, *vous* form | Plain English |
| Service pages (catalogue) | MSA, plain-language editing; official term + common term | French administrative terms as used in Tunisia | Plain English with the French term in brackets where users will meet it |
| CIVORA Guide answers | **Mirrors the user**: Derja question → Derja answer (Arabic script), with official terms in MSA/French in brackets. MSA question → MSA answer | French | English |
| Legal texts (terms, charter, consent) | MSA, reviewed by counsel | French, reviewed by counsel | English (reference translation) |

**Why mirror Derja in the Guide only:**
- Most Tunisians speak Derja, and many write it in Arabizi.
- Official procedures, however, are written in MSA or French.
- The Guide bridges the two, while the interface stays stable and predictable.

## 7.2 Voice and tone

| Principle | Do | Don't |
|---|---|---|
| Plain | "Bring your ID card and one photo." | "Applicants are required to furnish the following supporting documentation." |
| Direct | Start with the action | Start with background |
| Respectful | "We need one more document." | "Your file is incomplete." |
| Honest | "We're not sure. Check the official source: …" | Guess or over-promise processing times |
| Calm | No exclamation marks; no emojis in service flows | "Congratulations!!! 🎉" on a death certificate request |
| Inclusive | Gender-inclusive forms where natural; avoid assumptions about family structure | Assume a male head of household |

**Sensitive moments** use extra care: bereavement, health, rejection, debts and fines, minors.
- Bereavement flows open with condolence-neutral language and minimal steps.
- Rejections always state the reason and the next option (appeal, new request, help).

## 7.3 Microcopy patterns

| Pattern | Rule | Example (EN / FR / AR) |
|---|---|---|
| Buttons | Verb + object | Submit request / Envoyer la demande / تقديم المطلب |
| | | Book appointment / Prendre rendez-vous / حجز موعد |
| | | Track request / Suivre la demande / متابعة المطلب |
| Errors | What happened + how to fix, next to the field | "Enter the date as day, month, year." / « Saisissez la date : jour, mois, année. » / «أدخل التاريخ: اليوم، الشهر، السنة.» |
| Empty states | Explain + one action | "No requests yet. Find a service to start." / « Aucune demande pour l'instant. Trouvez un service pour commencer. » / «لا توجد مطالب بعد. ابحث عن خدمة للبدء.» |
| Status explanations | Plain sentence + next step + date | "In review — an officer is checking your file. Expected answer by 25 Nov." |
| Data requests | Why we ask | "We ask for your phone number to send status updates. We don't share it." |
| Leaving CIVORA | Warn before external link | "You are going to the official service website." / « Vous allez sur le site du service officiel. » / «ستنتقل إلى موقع الخدمة الرسمية.» |

## 7.4 Mandatory disclosures (exact strings, v1)

| Context | English | French | Arabic |
|---|---|---|---|
| Non-production environments (banner) | Synthetic data — independent prototype, not an official government service. | Données fictives — prototype indépendant, pas un service officiel de l'État. | بيانات تجريبية — نموذج أوّلي مستقلّ، وليس خدمة حكومية رسمية. |
| Guide (start and footer) | Independent, unofficial AI assistant. It can make mistakes, so always check the official source. | Assistant d'intelligence artificielle indépendant et non officiel. Il peut se tromper : vérifiez toujours la source officielle. | مساعد ذكاء اصطناعي مستقلّ وغير رسمي. قد يخطئ، لذا تثبّت دائماً من المصدر الرسمي. |
| Guide refusal | I'm not sure about this. Please check the official source or contact the office. | Je ne suis pas sûr de cette information. Consultez la source officielle ou contactez le service. | لست متأكّداً من هذه المعلومة. يُرجى الرجوع إلى المصدر الرسمي أو الاتصال بالمصلحة المعنية. |
| Guide eligibility guardrail | I can explain the published rules, but I can't decide whether you are eligible. Only the competent office can. | Je peux expliquer les règles publiées, mais je ne peux pas décider de votre éligibilité. Seul le service compétent le peut. | يمكنني شرح القواعد المنشورة، لكن لا يمكنني تحديد أهليّتك. وحدها المصلحة المختصّة تقرّر ذلك. |
| PII redaction | We removed personal details from your message. You don't need them here. | Nous avons retiré les informations personnelles de votre message : elles ne sont pas nécessaires ici. | حذفنا المعطيات الشخصية من رسالتك، فلا حاجة إليها هنا. |
| Mandate banner | Acting on behalf of {name} | Vous agissez pour le compte de {name} | تتصرّف نيابةً عن {name} |

## 7.5 Terminology glossary (v1)

AR = Arabic as used in Tunisian administration. Derja = common spoken forms [indicative].

| Concept | AR (administrative) | FR | EN | Derja / common usage |
|---|---|---|---|---|
| National ID card | بطاقة التعريف الوطنية | Carte d'identité nationale (CIN) | National ID card | بطاقة التعريف، «la carte» |
| Passport | جواز السفر | Passeport | Passport | الباسبور |
| Birth certificate extract | مضمون ولادة | Extrait de naissance | Birth certificate (extract) | مضمون الولادة، «l'extrait» |
| Civil status | الحالة المدنية | État civil | Civil status | الحالة المدنية |
| Criminal record certificate | البطاقة عدد 3 | Bulletin n° 3 (B3) | Criminal record certificate (B3) | البطاقة عدد 3، «le B3» |
| Municipality | البلدية | Municipalité | Municipality | البلدية |
| Counter | الشبّاك | Guichet | Counter | الشبّاك |
| Request / application | مطلب | Demande | Request | مطلب |
| File | ملف | Dossier | File | الملف، «le dossier» |
| Documents / papers | الوثائق | Pièces / documents | Documents | الأوراق |
| Fees | المعاليم | Frais / droits | Fees | المعاليم |
| Stamp duty | معلوم الطابع الجبائي | Droit de timbre | Stamp duty | التمبر |
| Appointment | موعد | Rendez-vous | Appointment | رنديفو، موعد |
| Status | وضعية المطلب | État de la demande | Request status | «وين وصل الملف؟» |
| Action needed | إجراء مطلوب | Action requise | Action needed | — |
| Digital identity | الهوية الرقمية | Identité numérique | Digital identity | — |
| Mobile ID (national) | الهوية الرقمية على الهاتف الجوّال (e-Houwiya) | Identité mobile (Mobile ID / e-Houwiya) | Mobile ID (e-Houwiya) | «الموبايل آي دي» |
| Personal data | المعطيات الشخصية | Données personnelles | Personal data | — |
| Consent | الموافقة | Consentement | Consent | الموافقة |
| Access log | سجلّ النفاذ | Journal des accès | Access log | — |
| *Banking (Workspace RF; official terms verified 18 Nov 2026 against BCT Circular 2022-08, Arabic text)* | | | | |
| Complaint | شكوى (pl. شكاوى) | Réclamation | Complaint | «شكاية» (common usage; **not** the regulatory term) |
| Customer | الحريف (pl. الحرفاء) | Client(e) | Customer | الحريف |
| Acknowledgement of receipt | وصل استلام | Accusé de réception | Acknowledgement | — |
| Reference number | الرقم المرجعي | Numéro de référence | Reference number | — |
| Banking mediator | الموفّق البنكي | Médiateur bancaire | Banking mediator | — |
| Outcome of the complaint | مآل الشكوى | Sort de la réclamation | Outcome | — |
| *Data protection (official terms, Law 2004-63)* | | | | |
| Controller / processor | المسؤول عن المعالجة / المناول | Responsable du traitement / sous-traitant | Controller / processor | — |
| Express and written consent | الموافقة الصريحة والكتابية | Consentement exprès et écrit | Express written consent | — |
| Right of access / right to object | حقّ النفاذ / حقّ الاعتراض | Droit d'accès / droit d'opposition | Right of access / to object | — |

Full verified glossary: [../validation/arabic-legal-terminology.md](../validation/arabic-legal-terminology.md).
| Mandate (acting for someone) | تفويض | Mandat | Mandate | توكيل / تفويض |
| Health insurance fund (CNAM) | الصندوق الوطني للتأمين على المرض | Caisse nationale d'assurance maladie | National Health Insurance Fund | الكنام |
| Reimbursement | استرجاع المصاريف | Remboursement | Reimbursement | «le remboursement» |
| Social security (CNSS) | الصندوق الوطني للضمان الاجتماعي | Caisse nationale de sécurité sociale | National Social Security Fund | الضمان الاجتماعي |
| Pension | جراية التقاعد | Pension de retraite | Pension | الجراية |
| Digital wallet | المحفظة الرقمية | Portefeuille numérique | Digital wallet | — |
| Verify | التثبّت | Vérifier | Verify | نثبّت |
| Official source | المصدر الرسمي | Source officielle | Official source | — |

## 7.6 Formatting conventions

| Item | Arabic UI | French UI | English UI |
|---|---|---|---|
| Digits | 0–9 (Western Arabic) for TN | 0–9 | 0–9 |
| Dates | 18 نوفمبر 2026 / 18/11/2026 | 18 novembre 2026 / 18/11/2026 | 18 November 2026 / 18/11/2026 |
| Currency | 12,500 د.ت (amount isolated LTR) | 12,500 DT | TND 12.500 |
| Decimal separator for TND | Comma for display in AR/FR [A — confirm local practice]; millimes shown with 3 decimals (e.g. 2,500 DT) | — | Point in EN |
| Time | 24-hour (14:30) | 14 h 30 | 14:30 |
| Names | Given name + family name; support Arabic and Latin spellings per user | — | — |
| Phone | +216 XX XXX XXX (LTR isolated) | — | — |
