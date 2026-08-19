# Design - NameSpring

A locked design system for the NameSpring app. Every page redesign should read
this file before changing visual structure. Extend this file when the system
needs to grow.

## Genre

Editorial app UI.

## Macrostructure Family

- Marketing pages: Workbench, with one preview panel and direct task tiles.
- App pages: Workbench, with a persistent masthead, page heading, dense controls,
  and document-like cards.
- Content pages: Long document, with quiet section rhythm and token-driven data
  cards.

## Typography Delivery

Pretendard Variable (body) and Noto Serif KR 600/700 (display) are
self-hosted: the npm packages `pretendard` and `@fontsource/noto-serif-kr`
are imported at the top of `namespring/src/main.jsx`, and `tokens.css` only
names the families. Never add a CDN font link; new display weights are added
by importing another subset CSS file in `main.jsx`.

## Theme

The app uses the natural report system already defined in
`namespring/src/styles/tokens.css`.

- Paper: warm near-white in light mode, deep green-black in dark mode.
- Ink: soft botanical black.
- Accent: moss green.
- Supporting tones: wood, fire, earth, metal, water, success, warning, info,
  danger, indigo, cyan, and neutral.
- Surface extensions: `--color-card` (raised card face, brighter than paper in
  light mode, paper-2 depth in dark mode), `--color-bezel` (bezel wash behind
  double-bezel cards), `--color-glass` and `--color-glass-line` (translucent
  capsule surfaces), `--color-veil` (modal backdrop). New surfaces must use
  these tokens; pure white or black literals are not allowed.

## Typography

- Display: `var(--font-display)`, weight 700.
- Body: `var(--font-body)`, weights 500-800.
- Mono: `var(--font-mono)`, for technical values only.
- Display headings use `var(--text-display-s)` or smaller inside app surfaces.
- Text sizes snap to the named scale. `--text-2xs` (11px) serves kickers and
  tracked labels; `--text-smd` (15px) serves report body copy. Arbitrary pixel
  sizes are not allowed in new markup.

## Spacing

Use the 4-point named scale in `tokens.css`. Page and component CSS must use
named tokens such as `var(--space-md)` instead of raw spacing values when new
CSS is added.

## Motion

- Motion stance: quiet.
- Allowed motion: opacity and transform only.
- Reduced motion: collapse spatial motion to a near-instant transition.
- Bands: micro state changes stay at `--dur-base` or faster; structural
  expand/collapse uses `--dur-slow`; entrance (scroll reveal, load rise) may
  use `--dur-entrance` at most, fires once per element, and must collapse
  under reduced motion and in print.

## Microinteractions

- Primary actions use the filled moss button.
- Secondary actions use the quiet paper button.
- Icon actions use square token buttons.
- Focus rings must be visible and instant.
- Loading states stay silent and informative.

## CTA Voice

- Primary CTA: direct verb, filled moss, no two-line labels.
- Secondary CTA: concise noun or verb, quiet paper, no decorative animation.

## Card and Chip Genres

- Double-bezel card (`--color-bezel` frame around a `--color-card` face with
  `--shadow-float` and `--shadow-inset-card`): sanctioned for report hero and
  primary sections, and for the entry form card.
- Inverted ink panel (ink face, paper text): at most one per page.
- Interactive chips (filters, anchor rails, pickers, toggles) use
  `--radius-pill`; static data chips in dense tables keep `--radius-chip`.
- Entry-funnel fields use `--radius-field`.
- The primary CTA may carry `--shadow-cta`, once per page, counted inside the
  5 percent accent budget.

## Shared Primitives

- Anchor rail: `AnchorRail` in `src/components/report/AnchorRail.jsx` is the
  one in-page section navigation. Long report pages (combined, naming, saju)
  place it directly under the masthead; pages pass their own placement class
  (`ns-anchor-rail--page` by default, `cr-v3-rail` in the combined report).
- Loading ring: `.ns-report-spinner` (accent head on an accent-quiet track)
  is the only spinner. No ad-hoc `animate-spin` divs.
- Tone cards: `.ns-tone-card--{wood,fire,earth,metal,water,neutral}` are the
  replacement idiom for any per-card tinted surface. Raw hex card themes are
  not allowed (the old `card-color-theme.js` was deleted for this reason).
- Bezel promotion: a page's single hero or primary summary surface may be
  promoted into `BezelCard`; nested cards inside a bezel face use
  `.ns-card--in-bezel` so the bezel supplies surface and elevation.
- Scene illustration exemption: `NamingResultRenderer.jsx` draws a pictorial
  scene (sky, meadow, campfire); its inner colors are artwork like the SVG
  assets, not UI surfaces, and stay hardcoded on purpose. Its frame and the
  page around it must still be tokenized.

## Cross-Device Standards

- Full-height layout uses `100dvh` (`min-h-dvh`), never `min-h-screen`.
- The page shell, masthead, bottom sheet, and FABs pad with
  `env(safe-area-inset-*)`; the viewport meta keeps `viewport-fit=cover` and
  must not lock pinch zoom.
- Interactive controls give at least a 44px hit area; visually compact chips
  (anchor rail, segmented control) extend their hit area with a pseudo
  element instead of growing.
- Hover transforms live behind `@media (hover: hover)`; press feedback uses
  `scale(0.98)`; every new animation joins the existing reduced-motion and
  print collapse blocks.

## Per-Page Allowances

- Home may use preview and task tiles. The primary task renders as one
  full-width featured band carrying the page's filled-accent CTA; secondary
  tasks as tiles; disabled or informational entries as a quiet strip.
- Entry may use the original centered intake surface so the long form stays
  focused.
- Candidate pages may use dense controls.
- Report pages may use wide document layouts, or the reader width (48rem) for
  narrative report surfaces.
- Long report pages may place one sticky glass anchor rail directly under the
  masthead for in-page section navigation.
- Payment pages must stay narrow and transactional.

## What Pages Must Share

- Wordmark, and masthead on post-entry app pages.
- Accent placement below 5 percent of the viewport.
- Display and body font roles.
- Tokenized colors and spacing.
- Button shape, focus, disabled, and loading states.

## What Pages May Differ On

- Page width: narrow, default, reader, or wide.
- Data-card density.
- State panel tone.
- Section composition inside the shared shell.

## Rejected

Recorded so they are not relitigated:

- Grain or noise overlays and floating ambient orbs.
- Replacing the masthead with a floating pill navigation.
- Durations above `--dur-entrance`; infinite decorative loops.
- Pure white or pure black surfaces.
- Prototype QA widgets (case switchers) in shipped pages.
