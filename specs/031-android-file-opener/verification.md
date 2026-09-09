# Verification: Android File Opener Correction

**Slice**: S031

**Issue**: #159

**Date**: 2026-09-09

## Local evidence

| Gate | Result | Evidence |
| --- | --- | --- |
| Android source package policy | Pass | `pnpm check:android-package` completed with 14 of 14 tests passing and the source manifest accepted. |
| Android app build | Pass | `pnpm tauri android build --debug --apk --target x86_64 --ci` produced `app-universal-debug.apk`. |
| Instrumentation compilation | Pass | `:app:compileUniversalDebugAndroidTestKotlin` completed against the generated Tauri Android projects after the delivery proof was isolated from the provider suite. |
| Android delivery frontend | Pass | TypeScript, ESLint, and 30 focused App, delivery-gateway, and restoration-gateway tests passed, including initial delivery, warm delivery, and native-source release. |
| Repository native, frontend, package, format, lint, and security gates | Pass | `pnpm check` completed every stage through documentation-link validation; the only failure was a transient socket hang-up while checking an unchanged Android documentation URL. |
| Documentation links and remaining aggregate stages | Pass | The single targeted retry validated 327 Markdown files, rendered 46 Mermaid diagrams, confirmed version authority, validated 877 UTF-8 files without BOM or common mojibake, and passed the public-surface policy. |
| Changed-file formatting | Pass | Prettier accepted the workflows, policy files, release note, and S031 artifacts. |

## Hosted Android evidence

The first hosted API 24 run proved resolver eligibility but exposed that the native plugin queue had no frontend consumer. S031 now registers a permission-scoped mobile plugin listener, drains the startup queue after listener registration, uses a bounded 500 ms fallback drain only when legacy WebView cannot register that listener, materializes accepted content through the bounded Android reader, and releases native sources when sessions close. Hosted evidence also showed that AndroidX finishes MainActivity after each test, which terminates the Tauri process, so the cold and warm delivery proof now runs in its own instrumentation invocation instead of destabilizing provider tests. The pull-request CI matrix reruns that complete path on API 24 and API 36. It queries the installed package for every governed exact media type, records Android's caller-wildcard matching, rejects unsupported and generic types, launches opaque provider documents on cold and warm delivery, and retains redacted test reports. The final Android package workflow parses the universal and ARM64 manifests and requires equivalent normalized resolver groups with no wildcard declarations or unmodeled data constraints.

Physical-device validation is intentionally deferred to post-release issue #66 under the maintainer's standing release policy. It is not a completion prerequisite for S031 or v0.1.2.

## Result

S031 is ready for renewed pull-request CI. The ineffective authority-free `pathSuffix` matchers were removed because Android ignores path constraints without a host and `pathSuffix` is unavailable on the API 24 floor. Exact supported media types now resolve opaque `content://` documents, and queued cold or warm intents now reach the document viewport without broad storage access, wildcard media types, unconditional polling, or unsupported-format claims.
