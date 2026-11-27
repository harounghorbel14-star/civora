/** The directory's one stylesheet, served from this site (CSP style-src 'self'). */
export const CSS = `/* CIVORA public directory. Colours from design/tokens/civora.tokens.json, as the citizen web app (contrast checked in
   Phase 1). Logical properties only (inline/block), so Arabic (right to left) needs no separate stylesheet. */
:root {
  --bg-canvas: #F6F7F8; --bg-surface: #FFFFFF; --bg-sunken: #EDEFF1;
  --brand: #0F5551; --brand-hover: #0B4341; --brand-subtle: #E8F4F3;
  --text: #1A1F25; --text-2: #545E69; --on-brand: #FFFFFF; --link: #0F5551;
  --border: #DCE0E4; --control: #6B7580; --focus: #1D5A9E;
  --ok-t: #1C6B3A; --ok-b: #E8F5EC; --bad-t: #A4211B; --bad-b: #FDECEA;
  --warn-t: #8A5A00; --warn-b: #FFF6E5; --info-t: #1D5A9E; --info-b: #E8F0FA;
  --radius: 6px; --space: 1rem;
  font-size: 100%;
}
@media (prefers-contrast: more) {
  :root { --bg-canvas: #FFFFFF; --text: #000000; --text-2: #1A1F25; --brand: #073230; --link: #073230; --border: #000000; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg-canvas); color: var(--text); line-height: 1.55;
  font-family: system-ui, "Segoe UI", "Noto Sans", "Noto Naskh Arabic", "Noto Sans Arabic", Tahoma, sans-serif; }
html[dir="rtl"] body { line-height: 1.75; }
a { color: var(--link); }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
.skip { position: absolute; inset-inline-start: -999px; inset-block-start: 0; background: var(--bg-surface); padding: .5rem 1rem; z-index: 10; }
.skip:focus { inset-inline-start: 0; }
.vh { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.top { display: flex; flex-wrap: wrap; gap: var(--space); align-items: center; justify-content: space-between;
  padding: .75rem 1.25rem; background: var(--bg-surface); border-block-end: 1px solid var(--border); }
.brand a { font-weight: 700; font-size: 1.25rem; color: var(--brand); text-decoration: none; }
.tagline { color: var(--text-2); margin-inline-start: .75rem; font-size: .9rem; }
.top ul, .crumbs ol { display: flex; flex-wrap: wrap; gap: .25rem 1rem; list-style: none; margin: 0; padding: 0; }
.top a[aria-current] { font-weight: 700; color: var(--text); text-decoration: none; }
.search { display: flex; gap: .4rem; align-items: center; }
.search input { font: inherit; padding: .4rem .6rem; border: 1px solid var(--control); border-radius: var(--radius); background: var(--bg-surface); color: var(--text); min-height: 44px; inline-size: 14rem; max-inline-size: 60vw; }
.search button { font: inherit; padding: .45rem 1rem; border-radius: var(--radius); border: 1px solid var(--brand); background: var(--brand); color: var(--on-brand); cursor: pointer; min-height: 44px; }
.search button:hover { background: var(--brand-hover); }
.crumbs { max-width: 52rem; margin: 0 auto; padding: .75rem 1.25rem 0; font-size: .9rem; }
.crumbs li + li::before { content: "›"; margin-inline-end: .5rem; color: var(--text-2); }
html[dir="rtl"] .crumbs li + li::before { content: "‹"; }
main { max-width: 52rem; margin: 0 auto; padding: 1rem 1.25rem 3rem; }
main:focus { outline: none; }
h1 { font-size: 1.75rem; margin-block: .5rem 1rem; }
h2 { font-size: 1.25rem; margin-block: 2rem .75rem; }
h3 { font-size: 1.05rem; margin-block: 1rem .25rem; }
.summary { font-size: 1.1rem; }
.meta { color: var(--text-2); font-size: .9rem; }
.facts { display: grid; grid-template-columns: max-content 1fr; gap: .35rem 1rem; margin: 1rem 0; }
.facts dt { font-weight: 600; }
.facts dd { margin: 0; }
.parts li { margin-block: .4rem; }
.cites { white-space: nowrap; }
.cite, .sep { font-size: .8rem; vertical-align: super; }
.cite { margin-inline-start: .2rem; }
.sep { margin-inline-start: .05rem; }
.amount { font-variant-numeric: tabular-nums; }
.sources li { margin-block: .5rem; }
.kind { font-weight: 600; }
.list { list-style: none; padding: 0; margin: 0; }
.list > li { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius); padding: .75rem 1rem; margin-block-end: .5rem; }
.list p { margin-block: .25rem; }
.title { font-weight: 600; font-size: 1.05rem; }
.badge { display: inline-block; font-size: .8rem; padding: 0 .5rem; border-radius: var(--radius); background: var(--bg-sunken); color: var(--text); }
.office { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius); padding: .5rem 1rem; margin-block-end: .75rem; }
.notice { padding: .75rem 1rem; border-radius: var(--radius); border-inline-start: 4px solid; }
.notice-warning { background: var(--warn-b); color: var(--warn-t); }
.notice-info { background: var(--info-b); color: var(--info-t); }
.integrity { border-block-start: 1px solid var(--border); margin-block-start: 2rem; }
code { font-family: ui-monospace, Menlo, Consolas, monospace; background: var(--bg-sunken); padding: .1rem .35rem; border-radius: 4px; word-break: break-all; }
.foot { max-width: 52rem; margin: 0 auto; padding: 1rem 1.25rem 2rem; color: var(--text-2); font-size: .9rem; border-block-start: 1px solid var(--border); }
@media print { .top nav, .skip, .crumbs { display: none; } a { color: inherit; } }
`;
