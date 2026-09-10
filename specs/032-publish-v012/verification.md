# Verification: Publish v0.1.2

## Active and historical version inventory

The active product, package, workflow, technical-specification, public-site, and release-policy authorities move to 0.1.2. Immutable `docs/releases/v0.1.0*`, `docs/releases/v0.1.1*`, and completed Spec Kit records remain historical. Test fixtures may retain older versions only when intentionally exercising parsing, migration, rejection, or immutable history and when they do not act as current release authorities.

## Validation results

### Test-first transition

- `pnpm run check:community-release` failed before production changes with four expected stale-authority failures against v0.1.1.
- The v0.1.2 implementation then moved every active authority while retaining explicit stale-v0.1.1 rejection cases.

### Focused gates

- Community release policy: passed, 17 tests plus live contract validation.
- Product version authority: passed at 0.1.2 with Android version code 1002.
- Windows package policy: passed, 11 tests plus 21-extension and two-artifact validation.
- macOS package policy: passed, 18 tests plus 21-extension and one-artifact validation.
- Linux package policy: passed, 21 tests plus two-artifact, 21-extension, and 12-media-type validation.
- Android package policy: passed, 14 tests plus source-manifest validation.
- Public release authority: passed, seven tests plus live source validation.
- Public site: passed production build, seven unit tests, and 66 Chromium tests.
- Frontend: passed lint, typecheck, 46 test files with 262 tests, and production build.
- Documentation formatting, lint, links, and Mermaid rendering: passed after formatting the new Spec Kit artifacts; 316 Markdown files linted, 340 Markdown files link-checked, and 46 Mermaid diagrams rendered.

### Complete repository gate

`cargo xtask check` passed on the exact source snapshot inside the pinned validation image using a native Linux volume. The aggregate covered Rust formatting, Clippy, 167 native tests plus 3 documentation-test targets, dependency policy, frontend lint/typecheck/262 tests/build, brand and public-release policy, site build/unit/66 browser tests, validation launchers, Mermaid runtime, metadata, persistence, performance, Android/Linux/macOS/Windows packaging, configuration, documentation formatting/lint/links/46 Mermaid renders, version authority, encoding, and public-surface policy.

## Integrity checks

- v0.1.0 and v0.1.1 release notes, receipts, and operator runbooks remain unchanged.
- S032 creates no tag or GitHub release; the exact `v0.1.2` tag remains a documented post-merge owner action.
- No local or remote `v0.1.2` tag exists, and the GitHub release endpoint returned `404 Not Found` before push.
- `git diff --check` passed.
- 896 tracked text files passed UTF-8 without BOM and common mojibake validation.
