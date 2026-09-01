# Feature Specification: Brand and Public Web Foundation

**Feature Branch**: `codex/007-brand-web-foundation`

**Created**: 2026-08-30

**Status**: Ready for review

**Input**: User description: "Integrate the completed Glitchpad brand kit, add light and dark README banners, and establish a landing-page and documentation foundation for glitchpad.com using the proven fragcap approach. Run S007 end-to-end under the Spec Kit autopilot protocol."

**Issue Traceability**: GitHub Issues #61 and #99

## Clarifications

### Session 2026-08-30

- Q: Does the completed kit still need to be redesigned? A: No. Canon 1.0.0 is the approved source. S007 imports, verifies, documents, and integrates it without altering the approved mark, tokens, typography, or positioning.
- Q: Does serving documentation from `docs` mean committing generated site output into the normative documentation tree? A: No. The authored `docs/` tree remains authoritative, the public website exposes documentation at `/docs`, and generated deployment output remains separate from authored sources.
- Q: Does S007 activate production hosting and DNS automatically? A: No. S007 delivers a validated deployment-ready artifact and workflow. Production Pages configuration, DNS changes, and first deployment remain explicit owner-controlled actions.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Recognize the official project immediately (Priority: P1)

A repository visitor sees the approved Glitchpad identity at the top of the README in a form that remains legible in both light and dark viewing environments.

**Why this priority**: The README is the primary public project entry point and currently presents temporary text-only identity.

**Independent Test**: Render the README in light and dark color schemes and verify that the appropriate approved horizontal lockup appears before the project title, remains legible, carries useful alternative text, and links to repository-owned assets.

**Acceptance Scenarios**:

1. **Given** a light README surface, **When** the repository page renders, **Then** the approved light-surface Glitchpad banner appears at the top with correct clear space and legibility.
2. **Given** a dark README surface, **When** the repository page renders, **Then** the approved dark-surface Glitchpad banner appears at the top without requiring a duplicate visible image.
3. **Given** an image cannot be displayed, **When** assistive technology or fallback content is used, **Then** the project name remains understandable and the rest of the README remains usable.

---

### User Story 2 - Reuse one verified brand authority (Priority: P1)

A maintainer can obtain every approved logo, token, font, favicon, platform asset source, rule, and verification receipt from one repository-owned brand authority instead of recreating assets or consulting an external archive.

**Why this priority**: Future application, packaging, documentation, and store work must not diverge from the completed kit or depend on an untracked local archive.

**Independent Test**: Compare the imported brand authority with the delivered canon manifest, verify every recorded checksum and license/provenance requirement, and confirm that temporary concepts cannot be mistaken for distributable assets.

**Acceptance Scenarios**:

1. **Given** the approved canon 1.0.0 delivery, **When** it is integrated, **Then** canonical assets, generation inputs, usage guidance, enforcement rules, font licenses, and verification evidence are present and traceable in the repository.
2. **Given** a maintainer changes a canonical brand file, **When** brand verification runs, **Then** manifest, encoding, contrast, asset geometry, font, and prohibited-treatment drift is detected before merge.
3. **Given** an application or website needs a brand asset, **When** a maintainer follows repository guidance, **Then** they can select an approved variant without using exploratory concepts or independently modifying a lockup.

---

### User Story 3 - Understand Glitchpad and reach its documentation (Priority: P1)

A visitor to glitchpad.com can quickly understand what Glitchpad is, what is currently available, why it is local-first, which capabilities are planned or implemented, and where to read authoritative documentation.

**Why this priority**: A branded site is useful only when its claims are accurate, its next action is clear, and its documentation remains trustworthy.

**Independent Test**: Build and browse the static site at representative desktop and mobile widths with scripts, links, metadata, theme controls, and documentation routes exercised against the current repository state.

**Acceptance Scenarios**:

1. **Given** a first-time visitor, **When** the landing page loads, **Then** the product role, local-first posture, platform direction, current availability, and primary next action are visible without unsupported release claims.
2. **Given** a visitor wants technical detail, **When** they follow the documentation entry point, **Then** they reach a `/docs` experience whose content is traceable to repository-authored documentation.
3. **Given** a visitor uses light mode, dark mode, keyboard navigation, a screen reader, or a narrow viewport, **When** they navigate the landing and documentation surfaces, **Then** content and controls remain understandable, operable, and visually compliant with the approved brand guidance.
4. **Given** a crawler or link preview service, **When** it inspects the site, **Then** it receives accurate title, description, canonical-domain, favicon, manifest, and social-preview metadata.

---

### User Story 4 - Validate a deployable static site without accidental publication (Priority: P2)

A maintainer can produce and validate the complete glitchpad.com artifact in pull requests while retaining explicit control over production publication and DNS activation.

**Why this priority**: Hosting must be reproducible and reviewable, but the initial public cutover is an external-state change that should not occur implicitly.

**Independent Test**: Build the site in hosted validation, inspect the export markers and domain declaration, run the production checks, and confirm that pull-request execution cannot deploy.

**Acceptance Scenarios**:

1. **Given** a pull request, **When** website validation runs, **Then** it builds and tests the complete static artifact without publishing it.
2. **Given** a validated default-branch build after deployment is authorized, **When** the hosting workflow runs, **Then** it can publish one immutable artifact for glitchpad.com with the required custom-domain and static-hosting markers.
3. **Given** a missing marker, broken route, accessibility regression, invalid metadata value, or documentation drift, **When** validation runs, **Then** the build fails before deployment.

### Edge Cases

- A README renderer supports color-scheme media sources differently or does not load SVG content.
- A canonical brand asset is renamed, regenerated, corrupted, or saved with a byte-order mark.
- A bundled font or generated artifact loses its license or provenance record.
- Landing-page copy accidentally promotes a planned capability to implemented or available status.
- An authored documentation link works in the repository but fails under the public `/docs` route, or the reverse.
- Static export produces root-relative resources that fail at the custom domain or nested documentation routes.
- JavaScript is unavailable, theme preference is missing, or a stored preference conflicts with the operating-system setting.
- A page has no meaningful heading, skip path, focus indication, alternative text, canonical URL, or social-preview metadata.
- Pull-request validation receives deployment credentials or attempts to mutate the production Pages environment.
- The public domain is not yet configured when the first deployable artifact is built.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The repository README MUST begin with the approved horizontal Glitchpad identity and MUST select legible approved variants for light and dark color schemes without embedding unapproved modifications.
- **FR-002**: README identity markup MUST preserve useful alternative text, project-name fallback, repository-relative asset ownership, and existing status and support accuracy.
- **FR-003**: S007 MUST import the approved Glitchpad brand canon 1.0.0 as the repository authority for logos, marks, wordmarks, social previews, favicons, fonts, tokens, reusable components, integration bindings, usage guidance, enforcement rules, build inputs, and verification evidence.
- **FR-004**: Imported brand content MUST preserve the delivered manifest and checksums, use UTF-8 without a byte-order mark for text, document every bundled license and provenance obligation, and distinguish canonical distributable assets from exploratory concepts and quality-control evidence.
- **FR-005**: Automated validation MUST detect checksum drift, encoding corruption, inaccessible color pairings, unsupported font weights, invalid vector geometry, malformed favicon entries, missing notices, and prohibited raw or off-brand values within governed surfaces.
- **FR-006**: Public website presentation MUST use the approved brand positioning, colors, typography, logo rules, density guidance, focus treatment, and dark-first behavior while keeping light mode available as a reading surface.
- **FR-007**: The landing page MUST explain Glitchpad's role, intended audience, local-first privacy posture, supported platform direction, current pre-release availability, and primary next action without claiming planned capabilities are shipped.
- **FR-008**: The public site MUST expose documentation under `/docs` and MUST preserve traceability to repository-authored documentation rather than creating an independently maintained duplicate authority.
- **FR-009**: Public navigation MUST provide coherent paths among the landing page, documentation, repository, security reporting, support, license, and parent-project attribution.
- **FR-010**: Every public page MUST provide accurate title, description, canonical-domain, icon, manifest, social-preview, and theme metadata appropriate to its content.
- **FR-011**: Landing and documentation surfaces MUST support keyboard-only operation, visible focus, semantic headings and landmarks, a skip path, meaningful alternatives for informative images, reduced-motion preference, and text/control contrast meeting WCAG 2.2 AA.
- **FR-012**: The public site MUST remain usable at viewport widths from 320 CSS pixels through wide desktop layouts without clipped required content or horizontal page scrolling.
- **FR-013**: The website MUST build as a fully static artifact with no account, server runtime, telemetry, remote font, or remote document-content dependency.
- **FR-014**: The static artifact MUST include the custom-domain declaration and static-hosting marker required for glitchpad.com and MUST preserve framework asset directories on the selected host.
- **FR-015**: Pull-request validation MUST build and test the production-equivalent artifact but MUST NOT deploy, receive production credentials, or modify DNS or Pages configuration.
- **FR-016**: Hosted validation MUST cover brand verification, static build, internal and external link integrity, metadata, responsive rendering, light and dark presentation, keyboard navigation, and automated accessibility checks.
- **FR-017**: Website dependencies and bundled resources MUST use pinned, Apache-2.0-compatible terms with recorded notices and MUST pass the repository's dependency, license, secret, encoding, documentation, and security gates.
- **FR-018**: S007 MUST NOT activate production DNS, publish a release, claim an installable application exists, change application runtime behavior, or absorb Android source lifecycle issue #47.

### Key Entities

- **Brand canon**: Approved versioned identity system containing source facts, immutable decisions, generated assets, usage rules, provenance, and verification receipts.
- **Brand asset**: Canonical logo, mark, wordmark, banner, social preview, favicon, font, token, component binding, or platform source selected for a governed surface.
- **Public claim**: User-visible statement about Glitchpad's purpose, availability, capability status, platform support, privacy, or release state that must remain consistent with repository authorities.
- **Authored documentation**: Repository-owned normative or contributor material that remains the source of truth even when adapted for public presentation.
- **Public page**: Static landing, documentation, legal, support, security, or attribution surface with content, navigation, and metadata obligations.
- **Deployment artifact**: Immutable static output plus domain and host markers that can be tested independently from publication.
- **Deployment gate**: Owner-controlled authorization boundary separating validated artifact production from public Pages and DNS mutation.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Light and dark README render checks select the intended approved banner in 100 percent of tested supported renderers, and fallback inspection always exposes the project name.
- **SC-002**: Brand verification accounts for 100 percent of imported canon files and reports zero checksum, encoding, contrast, geometry, font, favicon, license, or prohibited-treatment problems.
- **SC-003**: A first-time visitor can identify the product role, current availability, local-first posture, and primary next action from the landing page in under 30 seconds during structured review.
- **SC-004**: Every public documentation page is reachable from `/docs`, and 100 percent of adapted content records or mechanically preserves its repository source authority.
- **SC-005**: Automated link validation reports zero broken internal routes, repository references, or required public links in the production artifact.
- **SC-006**: Automated accessibility checks report zero serious or critical violations across landing, documentation, legal, support, and not-found routes in both light and dark presentation.
- **SC-007**: At 320, 768, 1280, and 1920 CSS-pixel viewport widths, all required content remains readable and operable with zero horizontal page overflow.
- **SC-008**: Every generated public page supplies valid title, description, canonical URL, icon, manifest, and social-preview metadata, with zero production references to placeholder domains or temporary marks.
- **SC-009**: Pull-request validation produces the same static artifact shape as an authorized default-branch build while performing zero deployments and receiving zero production credentials.
- **SC-010**: Full repository formatting, lint, tests, documentation, dependency-license, secret, encoding, brand, website, and CodeQL gates complete successfully before S007 is described as ready to merge.

## Assumptions

- The supplied `glitchpad-brand.zip` delivery is the approved Glitchpad canon 1.0.0 and its immutable brand decisions are not reopened in S007.
- GitHub renders a standards-based color-scheme-aware picture element sufficiently for the README, with alternative text and the existing heading retained as fallbacks.
- The established fragcap public-site architecture is a validated reference for dependency choices, static export, documentation adaptation, accessibility testing, and Pages deployment, but Glitchpad copy and brand rules remain independent.
- The root `docs/` directory remains authored source. The phrase "served from docs" means the public `/docs` route; generated website output is never committed over normative documentation.
- The first production publication and domain cutover require owner authorization and external configuration that are not implied by autopilot implementation authority.
- S007 may add public-site and brand validation to existing hosted workflows but does not change Glitchpad application behavior or release status.
