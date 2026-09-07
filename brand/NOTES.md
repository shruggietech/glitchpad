# Glitchpad migration notes

- Geometry provenance is `imported`. The shipped paper-and-G path data predates glyphkit and has no authoritative `build/mk_paths.py`, so its `H` and `V` commands are preserved unchanged and reported as warnings.
- Moving this mark to `glyphkit` later requires explicit owner approval, a parametric reconstruction from the shipped paths, and an identity comparison proving that the rendered geometry did not move.
- Generated `measured` and `color` blocks are intentionally absent from source `brand.json` and are restored in `dist/` by `enrich_brand.py`.
- The registry moved from `https://glitchpad.com/brand` to `https://brand.shruggie.tech/glitchpad/brand`.
- No accessibility identity correction was required during source migration.

