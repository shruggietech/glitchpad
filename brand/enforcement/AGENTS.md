<!-- BEGIN SHRUGGIE-BRANDBUILDER: CONSUMER CONTRACT -->

## Governed BrandBuilder contract

BrandBuilder is mandatory for brand-system authoring, consumer implementation, and conformance audit. This kit pins Brand Canon `1.3.0`, Interface Canon `1.0.0`, component recipes `1.1.0`, Web/React adapter `1.1.0`, egui adapter `1.0.2`, compiler `2.0.3`, and brand `1.1.1`.

Read `consumer-contract.json`, then `IMPLEMENTATION.md`. The pinned contract outranks screenshots, legacy stylesheets, and inferred local values. Do not reinterpret identity or create a permanent parallel design system.

Affiliation boundary: this is a ShruggieTech-owned child brand with declared parent `ShruggieTech`.

If BrandBuilder `2.0.3` is absent, verify SHA-256 `f8ae954806e9797cbde8270a0660dc16dd6c4018df03f8003ca95e633efc073f` and extract `enforcement/distributions/shruggie-brandbuilder-2.0.3.skill` into the empty directory `enforcement/brandbuilder`. Never substitute another version. Run `python3 enforcement/brandbuilder/templates/verify.py .` and `python3 enforcement/brandbuilder/templates/validate_glyph.py brand.json`; both must report zero failures.
<!-- END SHRUGGIE-BRANDBUILDER: CONSUMER CONTRACT -->
