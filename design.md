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

## Per-Page Allowances

- Home may use preview and task tiles.
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
