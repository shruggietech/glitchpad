# Theme Lockup Contract

## Canon authority

- `brand/logos/svg/glitchpad-horizontal-white.svg` is the dark-surface horizontal lockup.
- `brand/logos/svg/glitchpad-horizontal-black.svg` is the light-surface horizontal lockup.
- S010 does not rename, rewrite, regenerate, or amend either canonical file or `brand/manifest.json`.
- `site/public/logos/` contains byte-identical copies of the active white and black variants only.

## README banner

- One `<picture>` appears before the existing `# Glitchpad` heading inside the centered introduction.
- Its one direct `<source>` has `media="(prefers-color-scheme: dark)"` and `srcset="brand/logos/svg/glitchpad-horizontal-white.svg"`.
- Its direct fallback `<img>` has `src="brand/logos/svg/glitchpad-horizontal-black.svg"`, `alt="Glitchpad"`, and `width="480"`.
- A source or asset reference elsewhere in the README does not satisfy this contract.
- Reversed, missing, duplicated, or detached banner elements fail focused validation.

## Public-site header

- The shared navigation title supplies the lockup for landing and documentation layouts.
- Every rendered lockup instance contains a visual `on-dark` white asset, a visual `on-light` black asset, and one persistent visually hidden `Glitchpad` text node.
- Both images are decorative and do not contribute duplicate accessible names.
- The default light presentation shows only the `on-light` asset; `.dark` presentation shows only the `on-dark` asset.
- The enclosing Fumadocs home link retains the accessible name `Glitchpad` and target `/` in every theme and responsive layout.
- Explicit theme changes alter visibility without navigation or reload.

## Browser evidence

- Initial system light and dark preferences are tested with stored theme state cleared before page scripts run.
- Stored explicit light and dark preferences are tested against the opposite system preference and remain authoritative on initial render.
- `/` and `/docs` are tested at 320, 768, and 1280 CSS-pixel widths.
- Each state asserts the exact visible SVG source, one visible lockup image, one visible home link named `Glitchpad`, the opposite variant hidden, and no horizontal page overflow.
- At least one route in each layout family exercises explicit switching in both directions without reload.

## Failure diagnostics

- README failures identify the missing or incorrect banner relationship rather than reporting only generic filename absence.
- Canon-copy failures identify the integrated site path that is missing or differs in bytes.
- Browser failures identify the route, viewport, effective theme, expected asset, visible count, or accessible-name condition through the test title and assertion.
