# Feature Specification: Theme-Aware Lockup Accessibility

**Feature Branch**: `codex/010-theme-lockup-accessibility`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "Bundle Issues #104 and #106 into S010, repair the README and public-site theme lockups, preserve accessibility, run the slice end-to-end under autopilot, and publish it for third-party review."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Recognize Glitchpad in every GitHub theme (Priority: P1)

A repository visitor sees a legible approved Glitchpad banner on both light and dark GitHub surfaces while retaining useful fallback text when images are unavailable.

**Why this priority**: The repository banner is the first project identity most contributors encounter, and the current dark-theme mapping makes that identity nearly unreadable.

**Independent Test**: Inspect the README banner contract under light and dark color preferences and with images unavailable; each mode selects the intended surface-appropriate canonical asset, presents one banner, and preserves the project name.

**Acceptance Scenarios**:

1. **Given** a light GitHub surface, **When** the README renders, **Then** one approved dark-foreground horizontal lockup is clearly legible above the project heading.
2. **Given** a dark GitHub surface, **When** the README renders, **Then** one approved light-foreground horizontal lockup is clearly legible above the project heading.
3. **Given** the banner image cannot be displayed, **When** fallback content or assistive technology is used, **Then** the project remains identifiable as Glitchpad through meaningful alternative text and the existing heading.

---

### User Story 2 - Navigate the public site with a stable brand identity (Priority: P1)

A visitor can recognize and use the Glitchpad home link across the landing and documentation layouts in either theme, including after changing the explicit site theme.

**Why this priority**: The current dark header is nearly invisible, and the light-theme home link loses its accessible name, creating simultaneous brand and navigation failures on the live site.

**Independent Test**: Browse the landing and documentation headers at representative narrow and desktop widths with initial light and dark preferences, switch themes using the site control, and verify the lockup remains legible and the home link is named `Glitchpad` throughout.

**Acceptance Scenarios**:

1. **Given** an initial dark color preference, **When** a landing or documentation page loads, **Then** the header displays the approved light-foreground lockup and exposes one home link named `Glitchpad`.
2. **Given** an initial light color preference, **When** a landing or documentation page loads, **Then** the header displays the approved dark-foreground lockup and exposes one home link named `Glitchpad`.
3. **Given** either rendered theme, **When** the visitor changes the explicit site theme, **Then** the visible lockup changes to the appropriate variant without a reload, duplicate visible artwork, or loss of the home-link name.
4. **Given** a supported narrow or desktop viewport, **When** either lockup variant is visible, **Then** the existing header geometry and navigation remain operable without clipping or horizontal page overflow.

---

### User Story 3 - Reject future theme-mapping regressions (Priority: P2)

A maintainer receives a deterministic validation failure when a theme is mapped to the wrong lockup, an integrated copy drifts from canon, both website variants become visible, or the home link loses its accessible name.

**Why this priority**: Existing checks accepted unordered asset presence and image counts, allowing the same mapping and accessibility defects to ship despite green validation.

**Independent Test**: Exercise focused contract and browser tests against correct and deliberately reversed mappings; correct mappings pass, while each prohibited regression fails with an actionable assertion.

**Acceptance Scenarios**:

1. **Given** a reversed or detached README source mapping, **When** brand validation runs, **Then** validation fails and identifies the incorrect theme-to-asset relationship.
2. **Given** a missing or modified website integration copy, **When** brand validation runs, **Then** byte-for-byte canon validation fails.
3. **Given** an incorrect website theme mapping, duplicate visible lockups, or an unnamed home link, **When** browser validation runs, **Then** the affected theme and route fail before merge.

### Edge Cases

- The system preference and an explicit stored site preference disagree before initial rendering.
- The visitor switches themes repeatedly without reloading the page.
- One visual variant is hidden while assistive technology examines the home link.
- Images fail to load or styles are unavailable, leaving text and document structure as the fallback identity.
- The header is rendered at the minimum supported width and on both landing and documentation layouts.
- A maintainer substitutes a filename whose informal variant name does not match its intended surface.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The README MUST map the dark color scheme to the approved white horizontal lockup and MUST map the light color scheme and fallback to the approved black horizontal lockup.
- **FR-002**: The README MUST retain one visible banner, meaningful `Glitchpad` alternative text, the existing `# Glitchpad` heading, repository-relative canonical asset references, and the existing lockup width and composition.
- **FR-003**: README brand validation MUST associate each media condition and fallback with its exact intended canonical asset and MUST fail when mappings are reversed, missing, or detached.
- **FR-004**: The public site MUST integrate a byte-for-byte copy of the approved white horizontal lockup through the existing governed brand-copy contract without modifying canonical files under `brand/`.
- **FR-005**: The public-site header MUST map dark presentation to the approved white horizontal lockup and light presentation to the approved black horizontal lockup on landing and documentation layouts.
- **FR-006**: The public-site header MUST expose exactly one home link with the accessible name `Glitchpad` in every theme while preventing decorative duplicate artwork from being announced.
- **FR-007**: Initial system preference and explicit theme changes MUST select the correct visible lockup without a reload or duplicate visible variants.
- **FR-008**: Existing lockup geometry, home navigation, responsive behavior, explicit theme control, and supported 320 CSS-pixel through desktop layouts MUST remain intact.
- **FR-009**: Automated browser validation MUST cover initial light and dark preferences plus explicit theme switching on both landing and documentation header surfaces.
- **FR-010**: Automated validation MUST fail when the website mapping is reversed, the required integrated asset drifts from canon, both variants are visible, or the home link loses its accessible name.
- **FR-011**: S010 MUST keep the focused brand and site checks, full repository validation, static-site production contract, UTF-8 encoding, documentation links, and hosted security checks green.
- **FR-012**: S010 MUST record both Issues #104 and #106 in one coherent implementation slice and MUST NOT alter canonical governed logo assets, unrelated application runtime behavior, hosting configuration, DNS, or release claims.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All tested light and dark README presentations select the intended approved surface-appropriate banner, with zero reversed mappings and one preserved textual project identity.
- **SC-002**: All tested landing and documentation headers select the intended lockup on initial preference and after explicit theme changes, with exactly one visible lockup and one home link named `Glitchpad`.
- **SC-003**: The visible primary lockup artwork has at least a 4.5:1 contrast ratio against the rendered header or README surface in every tested theme.
- **SC-004**: At representative 320, 768, and 1280 CSS-pixel widths, theme changes produce zero clipped required navigation content and zero horizontal page overflow.
- **SC-005**: Focused regression fixtures reject 100 percent of tested reversed, missing, detached, drifted, duplicate-visible, and unnamed-link cases.
- **SC-006**: Brand, site, browser, formatting, lint, link, encoding, dependency, security, and full repository checks complete with zero failures before the pull request is described as review-ready.

## Assumptions

- Canonical `glitchpad-horizontal-white.svg` is the approved dark-surface asset, and canonical `glitchpad-horizontal-black.svg` is the approved light-surface asset.
- Existing canonical artwork, brand tokens, header dimensions, and site theme controls are authoritative and do not need redesign.
- GitHub's supported `<picture>` and `prefers-color-scheme` behavior remains the README selection mechanism.
- The existing two-variant website structure may be retained if it provides one stable accessible name and prevents duplicate announcements; structural simplification is acceptable only when it preserves the same contract.
- The shipped website background colors remain the surfaces against which lockup legibility is evaluated.
