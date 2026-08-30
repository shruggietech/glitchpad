# Quickstart: Validate the v0.0.0 Technical Specification

## Prerequisites

- PowerShell 7 or a POSIX shell with equivalent commands
- Node.js 24 LTS with `npx`
- `rg`
- Network access for first-run documentation tools and external link checks

Application compilation is not part of v0.0.0. The repository-foundation slice will add Rust, pnpm, Tauri, Android, and platform build authorities together with `cargo xtask`.

## Format the feature documents

```powershell
npx --yes prettier@3.6.2 --write --prose-wrap never docs/glitchpad-technical-specification.md specs/002-v000-technical-specification/*.md specs/002-v000-technical-specification/contracts/*.md
```

Expected result: each file is formatted and prose paragraphs remain on one physical line.

## Check Markdown format

```powershell
npx --yes prettier@3.6.2 --check docs/glitchpad-technical-specification.md specs/002-v000-technical-specification/*.md specs/002-v000-technical-specification/contracts/*.md
```

Expected result: `All matched files use Prettier code style!`

## Check required structure and prohibited language

```powershell
$doc = 'docs/glitchpad-technical-specification.md'
if (@(Select-String -LiteralPath $doc -Pattern '^## \d+\. ').Count -ne 38) { throw 'Expected 38 numbered sections.' }
if (rg -n -i 'annotated outline|will define|to be decided|needs clarification|conversation-only lineage|preservation narrative' $doc) { throw 'Drafting or conversation-only language remains.' }
if (rg -n '\b(flowchart|graph|direction)\s+(LR|RL|BT)\b' $doc) { throw 'Forbidden Mermaid direction found.' }
```

Expected result: no output and exit status 0.

## Check release and license decisions

```powershell
rg -n 'Specification version.*0\.0\.0|Product version.*0\.0\.0|Apache-2\.0|release documentation pass|v0\.1\.0' docs/glitchpad-technical-specification.md
```

Expected result: the document contains synchronized v0.0.0 control fields, Apache-2.0 policy, the documentation gate, and the first binary-release boundary.

## Check feature coverage

```powershell
$spec = 'specs/002-v000-technical-specification/spec.md'
$requirements = @(Select-String -LiteralPath $spec -Pattern '^- \*\*FR-\d{3}\*\*:').Count
$criteria = @(Select-String -LiteralPath $spec -Pattern '^- \*\*SC-\d{3}\*\*:').Count
if ($requirements -ne 28 -or $criteria -ne 9) { throw "Unexpected feature inventory: FR=$requirements SC=$criteria" }
```

Expected result: no output and exit status 0.

## Future CI-parity command

After repository foundation, contributors run:

```powershell
cargo xtask doctor
cargo xtask docs
cargo xtask check
```

`doctor` validates the host environment, `docs` runs every documentation gate, and `check` runs the shared format, lint, type, test, security, and license suite used by pull-request CI.
