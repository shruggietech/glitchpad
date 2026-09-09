# Public Presentation Contract

## Repository README

- One centered `<picture>` precedes the `# Glitchpad` heading.
- Dark-mode and fallback sources use governed PNG lockups that GitHub renders completely.
- Alternative text is exactly `Glitchpad`; width remains bounded and responsive.
- Validation inspects raster dimensions and visible pixel bounds in addition to paths and hashes.

## Public navigation and landing page

- Every public route exposes one link named `Glitchpad` that returns to `/`.
- System theme, stored theme, and interactive switching select the correct contextual lockup.
- The landing page contains exact canonical brand idea, descriptor, and ShruggieTech endorsement.
- Primary actions are `Download` and `Docs`; Download resolves to the current official GitHub release.
- Support and Security are absent from primary navigation. License, security reporting, source, and other policy links may remain in the footer.

## Release and specification authority

- Public content identifies v0.1.1 as the current installable release until v0.1.2 exists.
- `installableReleaseAvailable` is true.
- The technical specification exposes `Issued` and `Updated` with documented semantics and matches its generated site copy.
- Static validation rejects stale `0.0.0`, `Early development`, and `no installable release` claims on active public surfaces.

## Deployment workflow

- Pull requests: build and test only; no Pages artifact upload or deployment.
- `main` push: build, test, upload the exact artifact, deploy it, then verify production.
- Manual dispatch: may deploy only when `deploy=true`.
- `/deployment.json` contains the expected product version, source revision, build timestamp, and release URL.
- Production verification fails if the live provenance, canonical copy, release link, critical routes, or lockup assets disagree with the expected deployment.
