# 06 — Expiry reminders and renewal deep-links (P4-D5, P4-F6)

| | |
|---|---|
| Specification items | P4-D5 expiry reminders, P4-F6 renewal deep-links to the official service (dependency: Phase 5's catalogue) |
| Built | 27 Nov 2026 (week 5) |
| Code | `services/core/src/modules/wallet/reminders.ts`; migration `1765152000000_wallet-reminders.sql`; `PersonContacts` in identity-access's public API (`person-contacts.ts`) |
| Tests | `reminders.test.ts` (messages, languages, links, failures; 3); `wallet.db.test.ts` "expiry reminders" (thresholds on PostgreSQL as the least-privilege role) |

## 1. How it works

- Each wallet entry (P4-DB3) carries its expiry; each credential type carries its reminder days (default **30 and 7**;
  the same default for types of issuers outside the cell).
- Every hour (`WALLET_REMINDER_SECONDS`, default 3600; 0 turns it off), the core asks the database for the entries
  that crossed a threshold not yet sent. The application role cannot list other people's entries (row-level security),
  so a definer function, `wallet.due_reminders`, returns across people only what a reminder needs, and
  `wallet.mark_reminded` records the threshold sent. **Each threshold is sent once**; the 7-day reminder follows the
  30-day one.
- The person's e-mail address and language come from identity-access's public API (`PersonContacts`): read from the
  citizen account in Keycloak at sending time, never copied into the wallet schema (ADR-001).
- The message (ar, fr or en) names the credential type and the expiry date, with the days left. **No claim of the
  credential**: the cell does not hold them.
- **Renewal deep-link (P4-F6)**: when the type names a renewal service, the message links to
  `<WALLET_APP_ORIGIN>/<lang>/services/<slug>`, the service's page in the catalogue (Phase 5). Without one, it tells
  the person to contact the issuer.
- A failed send is not recorded and is tried again at the next pass; a person without a reachable address is recorded
  as handled, so the lookup is not repeated every hour.

## 2. Results (27 Nov 2026)

| Test | Result |
|---|---|
| Messages in ar, fr and en: type name, date, days left, renewal link, purpose `wallet-expiry-reminder`; marked sent | pass |
| No renewal service: "contact the issuer", no link; unknown type: a generic name | pass |
| No contact: nothing sent, marked handled; a failed send: not marked, logged | pass |
| Thresholds on PostgreSQL: an entry 20 days from expiry gets the 30-day reminder; 60 days: none yet; another issuer's type 5 days from expiry: the 7-day default; each threshold once; the 7-day reminder after the 30-day one; nothing changes without a person | pass |

Not yet: the catalogue pages the links open (Phase 5), and a push notification to the mobile app (with the app).
