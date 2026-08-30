# Changelog Fragments

Every pull request with a user-visible, contributor-visible, security, compatibility, or release-process effect adds one Markdown fragment to this directory. Documentation-only typo fixes and internal refactors with no observable effect may omit a fragment when the pull request explains why.

Name fragments as `<issue-or-pr>.<category>.md`, where category is `added`, `changed`, `deprecated`, `removed`, `fixed`, or `security`. Use a descriptive slug when no issue number exists.

Each fragment contains one concise list item written for users. During the release documentation pass, maintainers move fragments into `CHANGELOG.md`, verify links and version authorities, and remove the consumed fragment files.
