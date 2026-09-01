# Build and verification

Run the complete deterministic pipeline from the kit root with `python build/build_kit.py .`. The pipeline enriches measured values, regenerates browser bindings and enforcement, exports logos and favicons, builds the HTML and PDF guides, writes the checksum manifest, and runs every verification gate.

Python dependencies are `coloraide`, `fontTools`, `Pillow`, `pikepdf`, `playwright`, and `svgelements`. Install Playwright Chromium before PDF or browser QC generation. Raster export uses native `rsvg-convert` when available. The included Node renderer is a fallback and requires `@resvg/resvg-js`. Set `GP_NODE` and `GP_RESVG_RENDERER` if those executables live outside `PATH`.

ImageMagick builds the multi-entry ICO. Poppler provides PDF raster inspection. The pipeline reports missing tools as failures or explicit skips, and `VERIFY.md` records the resulting evidence.

`build_specimen.py` regenerates the outlined type specimen from bundled TTF files. Run it before the main pipeline when type content changes.
