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

## Typography

- Display: `var(--font-display)`, weight 700.
- Body: `var(--font-body)`, weights 500-800.
- Mono: `var(--font-mono)`, for technical values only.
- Display headings use `var(--text-display-s)` or smaller inside app surfaces.

## Spacing

Use the 4-point named scale in `tokens.css`. Page and component CSS must use
named tokens such as `var(--space-md)` instead of raw spacing values when new
CSS is added.

## Motion

- Motion stance: quiet.
- Allowed motion: opacity and transform only.
- Reduced motion: collapse spatial motion to a near-instant transition.

## Microinteractions

- Primary actions use the filled moss button.
- Secondary actions use the quiet paper button.
- Icon actions use square token buttons.
- Focus rings must be visible and instant.
- Loading states stay silent and informative.

## CTA Voice

- Primary CTA: direct verb, filled moss, no two-line labels.
- Secondary CTA: concise noun or verb, quiet paper, no decorative animation.

## Per-Page Allowances

- Home may use preview and task tiles.
- Entry may use the original centered intake surface so the long form stays
  focused.
- Candidate pages may use dense controls.
- Report pages may use wide document layouts.
- Payment pages must stay narrow and transactional.

## What Pages Must Share

- Wordmark, and masthead on post-entry app pages.
- Accent placement below 5 percent of the viewport.
- Display and body font roles.
- Tokenized colors and spacing.
- Button shape, focus, disabled, and loading states.

## What Pages May Differ On

- Page width: narrow, default, or wide.
- Data-card density.
- State panel tone.
- Section composition inside the shared shell.
