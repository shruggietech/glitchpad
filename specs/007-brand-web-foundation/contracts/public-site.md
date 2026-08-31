# Public Site Contract

## Route inventory

| Route | Purpose | Authority |
| --- | --- | --- |
| `/` | Product pitch, current availability, local-first posture, and primary next action | README status, product manifests, technical specification, brand positioning |
| `/docs` | Public documentation entry and navigation | Repository `docs/` and contributor authorities |
| `/docs/technical-specification` | Public adaptation of the normative technical specification | `docs/glitchpad-technical-specification.md` |
| `/license` | Project license and notices | `LICENSE` and `NOTICE` |
| `/support` | Usage and discussion routes | `SUPPORT.md` |
| `/security` | Safe vulnerability-reporting direction without disclosing private channels unnecessarily | `SECURITY.md` |
| `/_not-found` | Recovery path for unknown routes | Route inventory and primary navigation |

## Claim rules

- Version, availability, and product status must be derived from or checked against repository authorities.
- Planned capabilities must remain visibly planned until release activation gates promote them.
- The landing page may explain direction and value but must not imply that binaries, hosted document processing, accounts, or production viewers exist.
- Local-first and privacy statements must remain consistent with Constitution P2 and the technical specification.

## Presentation rules

- Dark is the default surface; light mode is a complete reading surface.
- Theme choice honors the user preference and operating-system preference without flashing unreadable content.
- Canonical fonts and tokens are local and no public page depends on a remote font or analytics request.
- Every route supplies semantic headings, landmarks, skip navigation, visible focus, meaningful image alternatives, reduced-motion behavior, and responsive layout from 320 CSS pixels upward.
- Mermaid diagrams render locally and retain an accessible textual description or source fallback.

## Documentation authority

- `docs/` remains authored and reviewable on GitHub.
- Build preparation may adapt authored Markdown to MDX, rewrite route links, add frontmatter, and protect Markdown constructs from MDX parsing.
- Generated adaptations live only in ignored build directories and carry a generated-file warning and source path.
- A build fails when an expected authored source is missing or cannot be adapted deterministically.

## Static artifact

- The site exports without a server runtime, base path, remote font, account, telemetry, or content-upload endpoint.
- The artifact contains `.nojekyll` and `CNAME` with exactly `glitchpad.com`.
- Internal routes and required external links resolve under the custom-domain root.
- Pull requests build and test but cannot deploy or access Pages write permissions.
- Deployment requires explicit workflow dispatch and the protected `github-pages` environment.
