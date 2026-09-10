# Quickstart: Validate S033

Run all non-Git commands through the approved hidden validation container.

## 1. Inspect dependency authorities

Confirm the site declares the patched Next.js version, the root manifest contains the narrow smol-toml override, and the lockfile resolves both safe versions.

## 2. Verify installation and advisory status

```sh
pnpm install --frozen-lockfile
pnpm audit --audit-level high
pnpm why -r next smol-toml
```

## 3. Run focused checks

```sh
pnpm run check:site
pnpm run check:community-release
pnpm run check:public-release
pnpm run check:config
```

## 4. Run the complete local gate

```sh
cargo xtask check
```

## 5. Confirm release invariants and diff hygiene

Verify the product remains v0.1.2, Android version code remains 1002, the release manifest still lists exactly eight packages, no v0.1.2 tag or release was created, and the Git diff contains only the planned security maintenance and S033 artifacts.
