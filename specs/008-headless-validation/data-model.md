# Data Model: Headless Windows Validation

S008 has no persistent application data. These transient entities define the validator contract and its testable lifecycle.

## Validation Run

| Field | Type | Rules |
| --- | --- | --- |
| `kind` | `links` or `mermaid` | Fixed by the invoked entry point |
| `repositoryRoot` | Absolute path | Resolved without shell interpolation |
| `items` | Ordered validation-item collection | Deterministically sorted by repository-relative source and location |
| `resources` | Validation resource collection | Bounded by run kind, never by item count |
| `diagnostics` | Ordered diagnostic collection | Source-specific and stable |
| `outcome` | `passed` or `failed` | Failed when any selected item cannot be validated successfully |

### Lifecycle

1. Resolve repository root and policy.
2. Discover and sort Markdown sources.
3. Derive validation items.
4. Acquire bounded resources once if needed.
5. Validate every item and collect diagnostics.
6. Release resources in `finally`.
7. Report counts and set the outer exit status.

## Validation Item

| Field | Type | Rules |
| --- | --- | --- |
| `sourcePath` | Repository-relative UTF-8 path | Required; preserves spaces and non-ASCII characters |
| `kind` | `markdown-file`, `link`, or `mermaid-block` | Required |
| `ordinal` | Positive integer where applicable | Mermaid block order within one source file |
| `line` | Positive integer where applicable | Opening fence line for a Mermaid block |
| `content` | Markdown, URL, or Mermaid source | Never passed through a command shell |

## Diagnostic

| Field | Type | Rules |
| --- | --- | --- |
| `severity` | `info` or `error` | Validation failure is always `error` |
| `sourcePath` | Repository-relative path | Required for item failures |
| `location` | Link target or Mermaid block/line | Required for item failures |
| `status` | Validator-specific status | Includes dead/error status or renderer error class |
| `message` | Plain text | Must be actionable and deterministic; no secret-bearing environment dump |

## Validation Resource

| Resource | Maximum per run | Ownership and cleanup |
| --- | --- | --- |
| Node validator process | 1 | Invoked directly by the outer orchestrator; exits with the aggregate result |
| Puppeteer browser | 1 for Mermaid, 0 for links | Launched after diagram discovery and closed in `finally` |
| Browser page | Renderer-managed | Opened and closed per diagram inside the reused browser |
| Temporary workspace | 0 in the selected design | No generated diagram files are required |

## Invariants

- Increasing validation-item count does not increase validator-process or browser-instance count.
- Empty input succeeds without launching a browser.
- Every selected item is attempted in deterministic order unless resource acquisition itself fails.
- Any failed item or resource-acquisition failure makes the run fail.
- Resource cleanup is attempted after both success and failure.
- Direct Git, GitHub, build, and test command capability is outside this data model and remains unchanged.
