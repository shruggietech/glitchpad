# Research: BrandBuilder Release Integration

## Release source

**Decision**: Pin `shruggietech/shruggie-brand` release `v2.0.3`, archive `glitchpad-brand-1.1.1-bb2.0.3.zip`, and SHA-256 `4cedc498d58fe6a8e7573b4c18ca97b95e27bf96c4e0eeb88712dff6545543f3`.

**Rationale**: The release page explicitly identifies assets as authoritative downloads and `enforcement/bundle.json` identifies the source revision `115bd423f0656b6006b0719d1838da8286afb5e4`. The archive hash was compared with the release `SHA256SUMS` on 2026-09-24.

**Alternatives considered**: Sibling `main` includes later S051 source changes; the hosted download page may move independently. Neither is the v2.0.3 release package.

## Migration scope

**Decision**: Import the full kit and refresh direct Glitchpad consumers. The released kit advances Canon 1.2.1 to 1.3.0, BrandBuilder 1.3.0 to 2.0.3, brand 1.1.0 to 1.1.1, and egui 1.0.0 to 1.0.2. Interface Canon and Web/React adapter versions are unchanged.

**Rationale**: The kit's `enforcement/release-impact.json` and `MIGRATION.md` identify required platform, documentation, recovery, and egui repins for consumers of those surfaces. Its approved source geometry is unchanged. Glitchpad has no production egui imports outside the vendored kit.

**Alternatives considered**: Copying only changed icons leaves contract and recovery metadata stale. Reimplementing AppFrame repeats completed S041 work.

**Archive inventory finding**: The v2.0.3 archive has 321 manifest-governed files, plus `manifest.json` and three legal files (`LICENSE`, `LICENSE-BRAND.md`, `NOTICE`) outside that manifest. The archive checksum authenticates all entries; the integration receipt must additionally bind the three legal files individually so later local drift is detected.

## Web and Android roles

**Decision**: Deliver ordinary and maskable web icons as distinct files. Refresh the existing Android legacy and adaptive resource copies from the archive.

**Rationale**: The current public web manifest labels ordinary icons `any maskable`; the release declares two `any` files and two new `maskable` files. Android mipmap and color resources differ in the release.

**Alternatives considered**: Keeping the existing manifest would misstate icon roles; regenerating icons locally would violate source authority.

## Validation environment

**Decision**: Use `scripts/docker/validation.Dockerfile` as the interactive Windows validation environment when Docker is available, and rely on repository CI for host-specific checks. Never claim a check passed until its real exit result is observed.

**Rationale**: The Docker daemon was unavailable on 2026-09-24; hidden WSL has networking and basic read tools but lacks Node and Rust, so it cannot provide local CI parity. The approved process boundary forbids running Windows development binaries directly.

**Alternatives considered**: Windows Node/Cargo execution violates repository instructions. Ad-hoc WSL toolchain installation would not follow the pinned validation image.
