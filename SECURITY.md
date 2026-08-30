# Security Policy

Glitchpad treats every opened file as untrusted input. Security reports are handled privately so maintainers can investigate, coordinate a fix, and publish accurate release guidance before exploit details become public.

## Supported versions

Glitchpad has no supported public release at version 0.0.0. This policy still applies to vulnerabilities in the repository, build pipeline, dependency graph, and foundation shell.

| Version          | Supported                                            |
| ---------------- | ---------------------------------------------------- |
| 0.0.0 foundation | Security reports accepted; no distribution guarantee |

## Reporting a vulnerability

Use the repository's [private vulnerability reporting form](https://github.com/ShruggieTech/glitchpad/security/advisories/new) when it is available. If the organization repository has not opened yet, contact a ShruggieTech maintainer privately and do not create a public issue.

Include the affected revision, platform, file type or input, reproduction steps, impact, and any proof-of-concept material needed to validate the report. Remove personal or unrelated confidential data before submitting files.

Maintainers will acknowledge a complete report, assess severity and affected versions, coordinate remediation, and credit reporters who request attribution when disclosure is safe. Response timing depends on severity, reproducibility, and release readiness; maintainers will communicate concrete status rather than promise a fixed deadline before triage.

## Scope

Reports involving parser confusion, path traversal, script execution, unsafe URI handling, archive expansion, memory safety, sandbox escape, permission overreach, update integrity, signing, secrets, or malicious document behavior are in scope. Findings that require unsupported local modifications, social engineering without a product flaw, or denial of service through obviously impractical resource volumes may be closed after review.
