<!-- BEGIN SHRUGGIE-BRANDBUILDER: CONSUMER CONTRACT -->

## Governed BrandBuilder contract

BrandBuilder is mandatory for brand-system authoring, consumer implementation, and conformance audit. This kit pins Brand Canon `1.2.1`, Interface Canon `1.0.0`, component recipes `1.1.0`, Web/React adapter `1.1.0`, egui adapter `1.0.0`, compiler `1.3.0`, and brand `1.1.0`.

Read `consumer-contract.json`, then `IMPLEMENTATION.md`. The pinned contract outranks screenshots, legacy stylesheets, and inferred local values. Do not reinterpret identity or create a permanent parallel design system.

Affiliation boundary: this is a ShruggieTech-owned child brand with declared parent `ShruggieTech`.

If BrandBuilder `1.3.0` is absent, verify SHA-256 `5e2a6a3f3ddbcf24436c8fbe38ee8d27a43ad710643b7631662c5d115c6e37ec` and extract `enforcement/distributions/shruggie-brandbuilder-1.3.0.skill` into the empty directory `enforcement/brandbuilder`. Never substitute another version. Run `python3 enforcement/brandbuilder/templates/verify.py .` and `python3 enforcement/brandbuilder/templates/validate_glyph.py brand.json`; both must report zero failures.
<!-- END SHRUGGIE-BRANDBUILDER: CONSUMER CONTRACT -->
