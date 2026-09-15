# Original raster corpus

These fixtures are original synthetic artwork created by Glitchpad contributors and distributed under the repository's Apache-2.0 license. No camera photograph, third-party image, location, or personal metadata is included. `manifest.json` records encoded byte lengths and SHA-256 digests.

Regenerate from the repository root with `cargo run -p glitchpad-core --example generate_image_fixtures`. The generator uses the reviewed explicit image 0.25.10 codec feature set. Every source is a 4 by 3 asymmetric RGB color grid; the eight JPEG variants carry each standard EXIF orientation. Tests construct bounded metadata, malformed headers, thumbnails, and hostile blocks in memory so no hostile fixture can acquire external authority.
