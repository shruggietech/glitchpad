# Glitchpad Support

Glitchpad is currently a v0.0.0 development project with no supported binary distribution. The project can help with repository setup, specifications, reproducible build failures, and confirmed behavior in the foundation shell.

## Where to ask

- Use [GitHub Discussions](https://github.com/ShruggieTech/glitchpad/discussions) for usage questions, design conversations, and contributor setup help after the public repository opens.
- Use the issue templates for reproducible defects and scoped feature proposals.
- Use the private process in [SECURITY.md](SECURITY.md) for anything that could expose users, files, systems, credentials, or the build pipeline.

Before asking for build help, run `cargo xtask doctor` and `cargo xtask check`, then include the failing command, complete error output, operating system, architecture, tool versions, and whether the failure reproduces from a clean checkout. Do not post documents or logs containing private data.

Feature proposals must describe the file interaction or user outcome, affected platforms, security considerations, and why the capability belongs in a minimal file viewer. A proposal does not become a commitment until its Spec Kit work and milestone are approved.
