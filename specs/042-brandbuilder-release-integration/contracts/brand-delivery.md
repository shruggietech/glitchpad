# Brand Delivery Contract

## Import input

The importer receives an extracted `glitchpad-brand-1.1.1-bb2.0.3.zip` directory and the exact formal release metadata. The archive digest must match `4cedc498d58fe6a8e7573b4c18ca97b95e27bf96c4e0eeb88712dff6545543f3`. The extracted `enforcement/bundle.json` must declare release `v2.0.3` and source revision `115bd423f0656b6006b0719d1838da8286afb5e4`.

## Source inventory

Each `manifest.json` entry must be a safe relative path with a unique name, expected byte count, and SHA-256. The complete extracted file inventory must equal the manifest inventory plus `manifest.json`, `LICENSE`, `LICENSE-BRAND.md`, and `NOTICE`. The last three are authenticated by the release archive checksum and separately recorded in the receipt. No prior local file may satisfy a missing extracted entry.

## Integrated inventory

The integrated `brand/` inventory equals the source inventory plus `INTEGRATION.json` and `INTEGRATION.md`. The only intended source-byte delta is `README.md`'s repository-layout legal link. `brand/manifest.json` records the corrected README digest, while `INTEGRATION.json` retains the original manifest digest, integrated manifest digest, and legal-file digests. The embedded recovery `.skill` digest must equal the consumer contract recovery checksum.

## Consumer roles

The public web manifest references `android-chrome-192x192.png` and `android-chrome-512x512.png` as `any`, and `maskable-icon-192x192.png` and `maskable-icon-512x512.png` as `maskable`. Each public file is an exact copy of its corresponding `brand/icons/web/` file. Existing desktop and Android source mappings remain exact byte copies, with new Android roles included where the released kit requires them.
