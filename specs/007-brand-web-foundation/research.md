# Research: Brand and Public Web Foundation

## Decision 1: Import canon 1.0.0 intact as `brand/`

**Decision**: Import the delivered Glitchpad canon 1.0.0 tree intact, including canonical assets, font licenses, tokens, components, Next.js bindings, build inputs, enforcement, concepts, quality-control evidence, and its manifest and verification receipt. Document `concepts/` and `qc/` as non-distributable evidence rather than deleting them.

**Rationale**: Issue #61 requires reproducible source assets, platform/store sources, ownership, export process, checksums, and a release receipt. Selectively copying only current README and website assets would recreate the original untracked-archive problem and make later package generation depend on missing inputs.

**Alternatives considered**: Copy only logos and fonts (rejected because provenance, regeneration, enforcement, and future platform assets would be incomplete); regenerate a smaller kit locally (rejected because canon is already approved and must not be redesigned); commit the ZIP only (rejected because repository consumers and validation cannot address individual canonical paths cleanly).

## Decision 2: Use approved SVG lockups in README picture markup

**Decision**: Place one centered `<picture>` before the existing README heading, select the approved light/white horizontal lockup for dark surfaces and the approved black or full-color horizontal lockup for light surfaces, retain meaningful alternative text, and keep the text heading as fallback and document structure.

**Rationale**: GitHub README rendering supports color-scheme media sources and repository-relative images. Canonical SVGs preserve exact geometry at arbitrary display density while the heading protects accessibility and fallback behavior.

**Alternatives considered**: A raster banner (rejected because it is less crisp and duplicates the canonical vector); one compromise logo for both schemes (rejected because the kit supplies purpose-built contrast variants); CSS or script-based theme switching (rejected because README surfaces do not provide that execution contract).

## Decision 3: Mirror the current fragcap public-site stack

**Decision**: Use the current fragcap site architecture and pinned dependency family: Next.js 16.3.0, React 19.2.8, Fumadocs Core/UI 16.14.3, Fumadocs MDX 15.2.3, Tailwind CSS 4.2.4, Zod 4.1.13, and Playwright 1.62.1, adapted to Glitchpad's Node 24.11.0 and pnpm 10.28.2 workspace authority.

**Rationale**: The user explicitly selected the fragcap approach. That repository already demonstrates landing and documentation routes, static export, local fonts, Mermaid integration, accessibility checks, build-time source adaptation, custom-domain markers, and GitHub Pages deployment.

**Alternatives considered**: A separate documentation framework (rejected because it adds evaluation and design work without value); a hand-written static site (rejected because documentation navigation, MDX, search, and accessibility infrastructure would be recreated); a server-rendered deployment (rejected because the site requires no server-side data or account behavior).

## Decision 4: Preserve `docs/` as authored authority and publish at `/docs`

**Decision**: Keep `docs/glitchpad-technical-specification.md` as the repository authority. Generate a build-only MDX adaptation under `site/content/generated/` and expose it through the public `/docs` hierarchy. Do not commit `site/out/` or generated site content into `docs/`.

**Rationale**: The constitution assigns normative authority to the technical specification under `docs/`. Using that same directory as a generated GitHub Pages root would mix source and derived output, obscure review diffs, and create two competing update paths.

**Alternatives considered**: Configure branch-level Pages to publish committed `/docs` output (rejected because it would overwrite or surround normative source with generated framework files); move the technical specification into site content (rejected because it changes constitutional authority and GitHub readability); maintain a separate public rewrite (rejected because claims would drift).

## Decision 5: Static export with local-only runtime resources

**Decision**: Configure a root-domain static export with unoptimized local images, bundled fonts, no base path, local Mermaid rendering, and generated `.nojekyll` plus `CNAME` markers. All landing and documentation routes must pre-render without a server runtime.

**Rationale**: glitchpad.com has no dynamic account or content requirement. Static output minimizes attack surface, operational complexity, cost, and privacy concerns while remaining deployable through Pages.

**Alternatives considered**: Hosted font services (rejected for privacy, offline build, and reproducibility); dynamic Next.js hosting (rejected because it adds runtime authority without a feature need); a repository subpath deployment (rejected because the target is the custom-domain root).

## Decision 6: Separate artifact validation from production deployment

**Decision**: Build and test the production-equivalent site on pull requests and default-branch changes, but permit Pages deployment only through an explicit workflow dispatch and protected `github-pages` environment. Pull-request jobs receive read-only contents permission and no deployment credentials.

**Rationale**: The user authorized planning and implementation but explicitly retained control over publication and DNS activation. Artifact equivalence provides confidence without silently mutating public infrastructure.

**Alternatives considered**: Automatic deploy on every main push (rejected because it activates publication without an explicit owner action); no deployment workflow (rejected because deploy readiness would remain unproven); a separate hosting provider (rejected because fragcap already validates the Pages pattern).

## Decision 7: Make public claims derived or mechanically checked

**Decision**: Generate version and current status facts from repository manifests where possible, adapt normative documentation at build time, and add claim tests that reject placeholder domains, temporary marks, unsupported release language, or capability promotion not present in the current status authority.

**Rationale**: Constitution P5 prohibits drift between product manifests, technical specification, and release-facing claims. A public landing page increases that risk unless claim sources and checks are explicit from the first slice.

**Alternatives considered**: Hand-maintain all marketing copy independently (rejected because availability and version drift are predictable); omit product status from the site (rejected because visitors would infer availability from the polished surface); delay claim checks (rejected because the first published artifact would already establish public expectations).
