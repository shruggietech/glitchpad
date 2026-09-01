# Research: Theme-Aware Lockup Accessibility

## Decision 1: Select variants by target surface

**Decision**: Treat `glitchpad-horizontal-white.svg` as the approved dark-surface lockup and `glitchpad-horizontal-black.svg` as the approved light-surface lockup. Name website integration classes by their target surface (`on-dark` and `on-light`) rather than by an ambiguous variant adjective.

**Rationale**: The existing `horizontal-light` filename describes a light-surface asset whose primary artwork is dark. Both regressions arose because consumers interpreted `light` as light-colored artwork. Surface-oriented consumer names make the association explicit while preserving canonical filenames and canon authority.

**Alternatives considered**: Continue using `horizontal-light` with comments; use the full-color lockup on light surfaces; edit canonical names or artwork. Comments do not eliminate the semantic trap, the existing black variant already satisfies the approved light-surface contract, and governed canon files are outside S010 scope.

## Decision 2: Keep one semantic README image

**Decision**: Retain one GitHub-supported `<picture>` containing one dark-preference `<source>` for the canonical white lockup and one black `<img>` fallback with `alt="Glitchpad"`.

**Rationale**: GitHub documents `<picture>` plus `prefers-color-scheme` for theme-aware README images. HTML defines the child `<img>` as the semantic image and fallback while `<source>` selects alternate resources, so one alternative text remains correct for both equivalent visual variants. Sources: [GitHub README quickstart](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/quickstart-for-writing-on-github#adding-an-image-to-suit-your-visitors), [GitHub picture support](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#the-picture-element), and [HTML picture model](https://html.spec.whatwg.org/multipage/embedded-content.html#the-picture-element).

**Alternatives considered**: Duplicate theme-specific `<img>` elements or use a theme-neutral mark. Duplicate semantic images risk duplicate announcements and visible artifacts, while a single neutral variant would need broader evidence across GitHub theme families and is unnecessary for this correction.

## Decision 3: Decouple website naming from visual variants

**Decision**: Keep two class-selected visual images for explicit site-theme switching, mark both images decorative, and place one persistent visually hidden `Glitchpad` text node in the shared lockup wrapper.

**Rationale**: Fumadocs wraps the shared navigation title in the home link. A stable text node gives that link the same name regardless of which responsive copy or visual asset CSS exposes, while empty alternative text prevents duplicate image announcements. WAI guidance permits empty alternatives when adjacent text supplies equivalent information: [WAI image decision tree](https://www.w3.org/WAI/tutorials/images/decision-tree/).

**Alternatives considered**: Put `alt="Glitchpad"` on both images; keep meaningful alternative text only on the expected visible image; use `aria-label` on a generic wrapper. Both-image text can duplicate announcements, visibility-dependent text recreated the shipped defect, and persistent text uses native naming without relying on generic-element ARIA behavior.

## Decision 4: Validate structure, association, and bytes separately

**Decision**: Add a pure README banner validator that inspects the one banner `<picture>` and its direct tags, and extend the existing public-copy table so the canonical white SVG must equal its site copy byte-for-byte.

**Rationale**: The current unordered regex checks can pass when correct filenames appear in the wrong locations. A scoped structural validator rejects reversed, missing, and detached mappings with deterministic diagnostics, while the existing buffer equality contract already provides the correct integrity primitive for integration copies.

**Alternatives considered**: One broad multiline regex; add an HTML parser dependency; rely only on browser tests. A broad regex can accept detached markup, a new parser is disproportionate for one static contract, and browser tests cannot prove that public copies remain identical to canon.

## Decision 5: Test visible behavior across routes and theme transitions

**Decision**: Add a dedicated Playwright matrix for `/` and `/docs`, initial light and dark system preferences, stored explicit preferences that disagree with the system, explicit theme changes, and representative 320, 768, and 1280 CSS-pixel widths. Assert the exact visible image source, one visible lockup image, one visible home link named `Glitchpad`, and no horizontal overflow.

**Rationale**: Fumadocs renders responsive title copies, so raw DOM counts are not behavioral evidence. Visible counts plus exact sources catch duplicate presentation and reversed mappings, while clearing stored theme state ensures initial preference coverage is genuine.

**Alternatives considered**: Extend the existing total-image-count assertion; test only the root theme class; use screenshots alone. Those approaches respectively ignore responsive duplication, fail to prove asset selection, or provide nondeterministic evidence without precise failure diagnostics.

## Decision 6: Remove the unused misleading site copy

**Decision**: Replace `site/public/logos/glitchpad-horizontal-light.svg` with the canonical white copy instead of retaining both.

**Rationale**: No remaining site consumer needs the light-surface `horizontal-light` variant. Removing the unused copy reduces integration surface and eliminates the exact ambiguous asset that caused the live regression.

**Alternatives considered**: Retain and continue governing the unused copy. That adds maintenance cost and leaves an attractive wrong choice available without delivering user value.

## Contrast interpretation

WCAG 2.2 exempts text that is part of a logo or brand name from minimum text contrast and exempts essential logo presentation from the non-text contrast rule, but WAI still recommends a sufficient-contrast variant when possible. S010 therefore preserves the specification's stricter 4.5:1 project target as a product-quality requirement rather than claiming it is universally mandated for logos. Sources: [WCAG 2.2 contrast minimum](https://www.w3.org/TR/WCAG22/#contrast-minimum), [WCAG 2.2 non-text contrast](https://www.w3.org/TR/WCAG22/#non-text-contrast), and [WAI non-text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
