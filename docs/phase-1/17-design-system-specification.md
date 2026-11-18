# 17. Design System Specification — CIVORA Design System v1.1

**Sources of truth:**
- Tokens: [`design/tokens/civora.tokens.json`](../../design/tokens/civora.tokens.json), in W3C Design Tokens Community Group format.
- Contrast verification: [`design/tokens/contrast-report.md`](../../design/tokens/contrast-report.md). **44/44 colour pairs pass WCAG 2.2 AA in light and dark themes.**
- Reference implementation: the [clickable prototype](../../design/prototype/index.html).

## 17.1 Design principles

1. **Calm authority.** Trustworthy without imitating the state. No flags, crests, eagles, crescents or national red as brand colours.
2. **Clarity over density.** One primary action per screen; plain language; progressive disclosure.
3. **Bidirectional by default.** Every component is designed in RTL *and* LTR from the first sketch.
4. **Accessible to everyone.** WCAG 2.2 AA minimum; senior-friendly sizes; works with screen readers in Arabic and French.
5. **Honest states.** Show what is real, simulated, pending or unknown. Never fake progress.
6. **Light on the network.** System fonts as fallback, small assets, no decorative video.

## 17.2 Colour

**Palette (base tokens):**

| Family | Role | Key values |
|---|---|---|
| **Teal** | Brand, primary actions, links | 50 `#E8F4F3` · 300 `#67B5AE` · 500 `#1F7C75` · **700 `#0F5551`** · 900 `#073230` |
| **Amber ("jasmine gold")** | Accent, highlights, synthetic-data banner | 50 `#FFF6E5` · 100 `#FCE7B8` · 300 `#F2C25C` · 500 `#D99A1E` · 900 `#5A3B00` |
| **Neutral (slate)** | Text, surfaces, borders | 0 `#FFFFFF` · 50 `#F6F7F8` · 500 `#6B7580` · 600 `#545E69` · 900 `#1A1F25` · 950 `#0F1317` |
| **Green / Red / Blue** | Success / danger / info | 700 for text on 50 backgrounds; 300 for dark theme |

**Semantic tokens** (`theme.light.*`, `theme.dark.*`): `bg.canvas`, `bg.surface`, `bg.brand`, `text.primary`, `text.secondary`, `text.on-brand`, `text.link`, `border.subtle`, `border.control`, `focus.ring`, `status.{success|warning|danger|info}.{text|bg}`, `banner.synthetic.{bg|text}`.

**Rules:**
- Components consume **semantic** tokens only, never palette values. Dark mode and white-label theming therefore work by swapping one layer.
- `border.subtle` is for decorative dividers only. Input and control boundaries use `border.control` (≥ 3:1, SC 1.4.11).
- Status is **never** communicated by colour alone: icon + text label is always present.
- White-label themes (L3 countries, institutions) must re-run the contrast script before release.

## 17.3 Typography

| Script | Family | Fallbacks | Licence |
|---|---|---|---|
| Arabic | **IBM Plex Sans Arabic** | Noto Sans Arabic, Tahoma, system | SIL OFL 1.1 [A — verify per release] |
| Latin | **IBM Plex Sans** | Noto Sans, Segoe UI, Roboto, system | SIL OFL 1.1 [A] |
| Monospace (references, codes) | IBM Plex Mono | ui-monospace | SIL OFL 1.1 [A] |

The Plex families share proportions and stroke logic, so mixed Arabic–French screens look coherent. **Production deployments self-host fonts** inside the country cell. No third-party font CDN is used for authenticated pages.

**Type scale** (px; base 16; Arabic line-height 1.7, Latin 1.5, headings 1.3):

| Token | Size | Use |
|---|---|---|
| `font.size.4xl` | 36 | Marketing headings only |
| `font.size.3xl` | 30 | Page title (desktop) |
| `font.size.2xl` | 24 | Page title (mobile), section title |
| `font.size.xl` | 20 | Card title |
| `font.size.lg` | 18 | Lead text; **default body for senior mode** |
| `font.size.md` | 16 | Body (minimum for body text) |
| `font.size.sm` | 14 | Secondary text, captions |
| `font.size.xs` | 12 | Legal footnotes only, never for essential information |

**Arabic specifics:**
- No letter-spacing on Arabic. Letter-spacing breaks joining.
- No all-caps equivalent; emphasis uses weight 600.
- Allow ~15–20% more vertical space for Arabic diacritics and ascenders.
- Avoid italic for Arabic. Use weight or colour for emphasis.
- Mixed-script lines (e.g. "مضمون ولادة (extrait de naissance)") use bidi isolation (`<bdi>`) around Latin segments.

## 17.4 Spacing, layout and sizing

- 4 px base grid. Tokens `space.1`–`space.16` (4 → 64 px).
- Layout:
  - **Mobile:** 4-column grid, 16 px side margins.
  - **Tablet:** 8 columns, 24 px margins.
  - **Desktop:** 12 columns, max content width 720 px for reading pages and 1200 px for Workspace.
- **Touch targets ≥ 44 × 44 px.** This exceeds WCAG 2.2 SC 2.5.8, which requires 24 px. Control height is 48 px.
- Radius: `sm` 4 (inputs), `md` 8 (buttons), `lg` 12 (cards), `xl` 16 (sheets), `full` (pills).

## 17.5 RTL / LTR rules

| Topic | Rule |
|---|---|
| Layout | Use CSS logical properties only (`margin-inline-start`, `inset-inline-end`, `text-align: start`). Never `left`/`right` in component CSS |
| Document direction | `<html lang="ar" dir="rtl">` / `lang="fr" dir="ltr"`. Switching language switches direction without reload |
| Icons that mirror | Back/forward arrows, chevrons, "reply", progress direction, list bullets with direction, steppers |
| Icons that never mirror | Checkmarks, clocks, play/pause media, search magnifier, phone, slashes in logos, brand mark |
| Numbers & codes | Reference numbers, phone numbers, IBANs, IDs, dates in numeric form: wrapped in `dir="ltr"` / `<bdi>` |
| Numerals | Western Arabic digits (0–9) for Tunisia/Maghreb. Eastern Arabic digits (٠–٩) available per country pack (e.g. Gulf) |
| Calendars | Gregorian default. Weeks start Monday in TN (country pack). Hijri display optional |
| Forms | Labels above fields (avoids alignment issues). Placeholder is never the label |
| Mixed content | Phone/email inputs are `dir="ltr"` even in RTL UI. Text inputs use `dir="auto"` |
| Animation | Slide transitions follow reading direction |

## 17.6 Core components (v1)

Each component spec covers anatomy, states (default, hover, focus, active, disabled, error, loading), RTL notes and accessibility notes. Summary:

| Component | Purpose | Key accessibility / RTL notes |
|---|---|---|
| **Button** (primary, secondary, tertiary, danger) | Actions | Visible focus ring (`focus.ring`, 3 px, 2 px offset); min 48 px height; loading state announces via `aria-live` |
| **Link** | Navigation | Underlined in body text; external links show icon + "opens official site" text for screen readers |
| **Text field / Textarea** | Input | Label + hint + error text linked via `aria-describedby`; error icon + message (not colour only); `dir="auto"` |
| **Select / Combobox** | Choice | Native select on mobile; searchable combobox with Arabic normalisation on desktop |
| **Date input** | Dates | Three-field (day/month/year) for memorable dates such as birth; calendar picker for appointments |
| **File upload / Camera capture** | Documents | Checklist-linked; shows file type/size limits; progress; accessible remove button |
| **Stepper** | Multi-step forms | Shows "Step 2 of 4" text; direction-aware |
| **Status timeline** | Request progress | Ordered list semantics; each status has icon + label + date + plain explanation; current step announced |
| **Status badge** | Compact status | Text label always; colour secondary |
| **Card** | Grouping | Whole-card click target only if a single action; otherwise explicit buttons |
| **Alert / Inline message** | Feedback | `role="status"` (polite) or `role="alert"` (errors); icon + title + body |
| **Environment banner** | "SYNTHETIC DATA — independent prototype, not an official service" | Always visible in non-production; cannot be dismissed; uses `banner.synthetic.*` tokens |
| **Mandate banner** | "Acting on behalf of Hédi B." | Persistent; includes "Switch back to me" button; high-contrast |
| **Guide message** | AI answer | AI badge; numbered citations; "last verified" chips; feedback buttons; copy button; refusal variant |
| **Citation chip** | Source reference | Publisher + date; opens the source in a new tab with warning text |
| **Consent receipt card** | Consent | Purpose, data categories, recipient, expiry, revoke button |
| **Access log item** | Transparency | Who (role + institution), what (data category), why (purpose), when |
| **Credential card** | Wallet | Issuer, type, validity, status (valid/expired/revoked), "SYNTHETIC" watermark in demo; QR via present action |
| **Queue table** (Workspace) | Officer work | Sortable columns with `aria-sort`; SLA badge; keyboard row navigation; responsive collapse to cards |
| **Checklist** | Document verification | Each item: required/optional, present/missing, officer verified tick |
| **Bottom tab bar** (mobile) | Primary nav | 5 items max; labels always visible; mirrors in RTL |
| **Language switcher** | Language | Shows language names in their own script: العربية · Français · English |

## 17.7 Accessibility specification (WCAG 2.2 AA + additions)

- **Keyboard:** all functions operable; logical focus order follows the visual order in both directions; no keyboard traps; skip link.
- **Focus:** always visible; not obscured by sticky headers (SC 2.4.11); 3 px ring with ≥ 3:1 contrast.
- **Screen readers:** tested with TalkBack (Arabic, French), VoiceOver iOS (Arabic, French) and NVDA (French/English). Correct `lang` on mixed-language fragments.
- **Forms:** accessible authentication (SC 3.3.8). Passkeys and copy-paste for OTP are allowed; no cognitive tests. Redundant entry is avoided (SC 3.3.7).
- **Dragging:** no drag-only interactions (SC 2.5.7).
- **Motion:** respects `prefers-reduced-motion`; no auto-playing animation > 5 s.
- **Text:** supports 200% zoom and text spacing overrides without loss; content reflows at 320 px.
- **Senior mode (CIVORA addition):** base 18 px, increased spacing, simplified home with 3 primary tasks, larger tap targets (56 px).
- **Plain-language mode (CIVORA addition):** shorter sentences; key terms explained.

## 17.8 Motion

- Durations: 120 ms (micro), 200 ms (standard), 300 ms (sheets/dialogs).
- Easing: `cubic-bezier(0.2, 0, 0, 1)`.
- Under `prefers-reduced-motion: reduce`, transitions become instant or opacity-only.

## 17.9 Iconography and imagery

- Outline icon set at 24 px with a 1.5–2 px stroke, from one open-licence family (e.g. Lucide or Material Symbols) [A — select in Phase 2].
- Illustrations: simple, inclusive, regionally realistic people and settings. **No stock imagery of officials or uniforms; no imagery of state buildings or symbols.**

## 17.10 Content density modes

| Mode | Where | Base size | Row height |
|---|---|---|---|
| Comfortable (default) | Citizen app | 16 px | 56 px |
| Senior | Citizen app (setting) | 18 px | 64 px |
| Compact | Workspace tables | 14 px | 44 px |

## 17.11 Governance

- The design system is versioned with the tokens (semver). Breaking changes need design + engineering approval.
- Every new component ships with RTL screenshots, an accessibility checklist and usage guidance.
- Contrast and RTL visual-regression tests run in CI from Phase 2.

## 17.12 v1.1 additions — enterprise consoles and multi-division use

### One brand, many products

- All divisions use the **same tokens and components**. Division identity comes from product names and content, not colour schemes.
- This keeps one accessible, maintained system (directive: "CIVORA must have its own unique visual identity"; see [supporting/brand-identity.md](supporting/brand-identity.md), still pending D12).
- **White-label** deployments, for institutions and countries, override only the `bg.brand*`, `text.brand` and `text.link` semantic tokens and the logo. The contrast script must pass before release.

### Density modes (extended)

| Mode | Products | Base size | Row height | Notes |
|---|---|---|---|---|
| Comfortable | Citizen app, customer status page | 16 px | 56 px | Default |
| Senior | Citizen app (setting) | 18 px | 64 px | — |
| **Compact** | **Workspace consoles (RF and Government)** | 14 px | 44 px | Keyboard-first; sticky table headers |

### New components for Workspace

| Component | Purpose | Key rules |
|---|---|---|
| **Deadline timer / SLA badge** | Remaining time to deadline | Text + icon + colour ("Overdue by 1 day", "6 h left"); working-day aware; announced to screen readers on change |
| **Queue table with saved views** | Dense work lists | `aria-sort`; keyboard row navigation; filters as chips; collapses to cards < 1024 px |
| **Decision panel** | Outcome, reason code, explanation, template, channel | Blocks issuing a rejection without explanation; inline error with fix instruction |
| **Reason-code picker** | Consistent decisions | Searchable; shows code + label in AR/FR |
| **Template editor (AR/FR)** | Approved response texts | Bidirectional editing (`dir="auto"` per paragraph); variables shown as tokens; approval status chip |
| **Timeline (case)** | Audit-friendly history | Actor + action + timestamp (monospace, LTR-isolated) |
| **Sub-task card** | Internal requests (e.g. to branch) | Own deadline; owner; status |
| **Export dialog** | Case-file export | Checklist of contents; default excludes internal notes |
| **Report wizard** | Annual board report | Stepper; preview; export PDF/DOCX |
| **Metric tile & simple charts** | Dashboards | Tabular numerals; charts follow the dataviz rules (single scale, labelled axes, theme tokens) |
| **Status page card** (customer) | Status, deadline, next step | Mobile-first; mediator information block always available |

### Wireframes and prototype references

- Wireframes: [16-ux-ui-design-strategy.md](16-ux-ui-design-strategy.md) §16.3 ([design/wireframes](../../design/wireframes/)).
- Reference implementation of v1 components: [design/prototype/index.html](../../design/prototype/index.html).
