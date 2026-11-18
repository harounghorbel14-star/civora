# CIVORA Colour Contrast Report (tokens v1.0)

Generated from `civora.tokens.json` with the WCAG 2.x relative-luminance formula. Thresholds:
- 4.5:1 for text (SC 1.4.3)
- 3:1 for UI component boundaries and focus indicators (SC 1.4.11 / 2.4.13)

**Result: 44 / 44 pairs pass.**

| Theme | Foreground token | Background token | FG | BG | Ratio | Min | Result | Use |
|---|---|---|---|---|---|---|---|---|
| light | `text.primary` | `bg.canvas` | #1A1F25 | #F6F7F8 | 15.46:1 | 4.5:1 | PASS | body text |
| light | `text.primary` | `bg.surface` | #1A1F25 | #FFFFFF | 16.58:1 | 4.5:1 | PASS | body text |
| light | `text.primary` | `bg.surface-sunken` | #1A1F25 | #EDEFF1 | 14.38:1 | 4.5:1 | PASS | body text |
| light | `text.secondary` | `bg.canvas` | #545E69 | #F6F7F8 | 6.15:1 | 4.5:1 | PASS | secondary text |
| light | `text.secondary` | `bg.surface` | #545E69 | #FFFFFF | 6.6:1 | 4.5:1 | PASS | secondary text |
| light | `text.secondary` | `bg.surface-sunken` | #545E69 | #EDEFF1 | 5.73:1 | 4.5:1 | PASS | secondary text |
| light | `text.on-brand` | `bg.brand` | #FFFFFF | #0F5551 | 8.61:1 | 4.5:1 | PASS | button label |
| light | `text.on-brand` | `bg.brand-hover` | #FFFFFF | #0B4341 | 11.09:1 | 4.5:1 | PASS | button label (hover) |
| light | `text.brand` | `bg.surface` | #0F5551 | #FFFFFF | 8.61:1 | 4.5:1 | PASS | brand text |
| light | `text.link` | `bg.surface` | #0F5551 | #FFFFFF | 8.61:1 | 4.5:1 | PASS | link |
| light | `text.link` | `bg.canvas` | #0F5551 | #F6F7F8 | 8.03:1 | 4.5:1 | PASS | link |
| light | `text.brand` | `bg.brand-subtle` | #0F5551 | #E8F4F3 | 7.65:1 | 4.5:1 | PASS | selected item text |
| light | `text.primary` | `bg.accent-subtle` | #1A1F25 | #FFF6E5 | 15.45:1 | 4.5:1 | PASS | callout text |
| light | `border.control` | `bg.surface` | #6B7580 | #FFFFFF | 4.69:1 | 3.0:1 | PASS | input border (1.4.11) |
| light | `focus.ring` | `bg.surface` | #1D5A9E | #FFFFFF | 6.98:1 | 3.0:1 | PASS | focus indicator (2.4.13/1.4.11) |
| light | `focus.ring` | `bg.canvas` | #1D5A9E | #F6F7F8 | 6.51:1 | 3.0:1 | PASS | focus indicator |
| light | `bg.brand` | `bg.surface` | #0F5551 | #FFFFFF | 8.61:1 | 3.0:1 | PASS | button shape vs page (1.4.11) |
| light | `status.success.text` | `status.success.bg` | #1C6B3A | #E8F5EC | 5.82:1 | 4.5:1 | PASS | status text |
| light | `status.danger.text` | `status.danger.bg` | #A4211B | #FDECEA | 6.53:1 | 4.5:1 | PASS | status text |
| light | `status.warning.text` | `status.warning.bg` | #8A5A00 | #FFF6E5 | 5.52:1 | 4.5:1 | PASS | status text |
| light | `status.info.text` | `status.info.bg` | #1D5A9E | #E8F0FA | 6.07:1 | 4.5:1 | PASS | status text |
| light | `banner.synthetic.text` | `banner.synthetic.bg` | #5A3B00 | #FCE7B8 | 8.38:1 | 4.5:1 | PASS | synthetic-data banner |
| dark | `text.primary` | `bg.canvas` | #F6F7F8 | #0F1317 | 17.39:1 | 4.5:1 | PASS | body text |
| dark | `text.primary` | `bg.surface` | #F6F7F8 | #1A1F25 | 15.46:1 | 4.5:1 | PASS | body text |
| dark | `text.primary` | `bg.surface-sunken` | #F6F7F8 | #2A3139 | 12.26:1 | 4.5:1 | PASS | body text |
| dark | `text.secondary` | `bg.canvas` | #C2C8CF | #0F1317 | 11.06:1 | 4.5:1 | PASS | secondary text |
| dark | `text.secondary` | `bg.surface` | #C2C8CF | #1A1F25 | 9.83:1 | 4.5:1 | PASS | secondary text |
| dark | `text.secondary` | `bg.surface-sunken` | #C2C8CF | #2A3139 | 7.8:1 | 4.5:1 | PASS | secondary text |
| dark | `text.on-brand` | `bg.brand` | #073230 | #67B5AE | 5.83:1 | 4.5:1 | PASS | button label |
| dark | `text.on-brand` | `bg.brand-hover` | #073230 | #9CD0CB | 8.16:1 | 4.5:1 | PASS | button label (hover) |
| dark | `text.brand` | `bg.surface` | #67B5AE | #1A1F25 | 6.95:1 | 4.5:1 | PASS | brand text |
| dark | `text.link` | `bg.surface` | #9CD0CB | #1A1F25 | 9.71:1 | 4.5:1 | PASS | link |
| dark | `text.link` | `bg.canvas` | #9CD0CB | #0F1317 | 10.92:1 | 4.5:1 | PASS | link |
| dark | `text.brand` | `bg.brand-subtle` | #67B5AE | #073230 | 5.83:1 | 4.5:1 | PASS | selected item text |
| dark | `text.primary` | `bg.accent-subtle` | #F6F7F8 | #5A3B00 | 9.5:1 | 4.5:1 | PASS | callout text |
| dark | `border.control` | `bg.surface` | #9AA3AD | #1A1F25 | 6.49:1 | 3.0:1 | PASS | input border (1.4.11) |
| dark | `focus.ring` | `bg.surface` | #8DB6E8 | #1A1F25 | 7.89:1 | 3.0:1 | PASS | focus indicator (2.4.13/1.4.11) |
| dark | `focus.ring` | `bg.canvas` | #8DB6E8 | #0F1317 | 8.87:1 | 3.0:1 | PASS | focus indicator |
| dark | `bg.brand` | `bg.surface` | #67B5AE | #1A1F25 | 6.95:1 | 3.0:1 | PASS | button shape vs page (1.4.11) |
| dark | `status.success.text` | `status.success.bg` | #7FCB98 | #1A1F25 | 8.6:1 | 4.5:1 | PASS | status text |
| dark | `status.danger.text` | `status.danger.bg` | #F19A93 | #1A1F25 | 7.72:1 | 4.5:1 | PASS | status text |
| dark | `status.warning.text` | `status.warning.bg` | #F2C25C | #1A1F25 | 9.98:1 | 4.5:1 | PASS | status text |
| dark | `status.info.text` | `status.info.bg` | #8DB6E8 | #1A1F25 | 7.89:1 | 4.5:1 | PASS | status text |
| dark | `banner.synthetic.text` | `banner.synthetic.bg` | #FCE7B8 | #5A3B00 | 8.38:1 | 4.5:1 | PASS | synthetic-data banner |

Out of scope for this automated check, and to be covered in the Phase 11 audit:
- text over images
- charts
- gradient backgrounds
- disabled states, which are exempt but must still be distinguishable
