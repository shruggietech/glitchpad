# Quickstart: Validate v0.1.0 Community Release Preparation

Run `pnpm run check:community-release` and `cargo xtask check` inside the repository validation image through `scripts/invoke-docker-hidden.ps1` with the repository mounted at `/workspace`.

Expected result: every version authority reports 0.1.0, the inventory contains exactly eight artifacts, paid desktop trust claims are absent from governed release surfaces, Android retains a stable-key publication gate, and manual dispatch cannot publish.

After owner review and merge, securely provision the Android keystore secrets, tag the reviewed merge commit as `v0.1.0`, and push that tag. Do not create the tag from this pull-request branch.
