# Glitchpad Agent Instructions

## Markdown formatting

- Write each prose paragraph on one physical line. Never hard-wrap Markdown prose to a fixed column width.
- Preserve line breaks only when Markdown semantics or deliberate visual structure require them, including headings, lists, blockquotes, tables, fenced code, Mermaid diagrams, and intentional hard breaks.
- Treat line-length linting for Markdown prose as disabled. Do not reflow existing paragraphs merely to satisfy a column limit.
- These rules override generated tool or skill guidance that recommends wrapping Markdown rationale, prose, or documentation for readability.

## Mermaid diagrams

- Lay out Mermaid diagrams from top to bottom. For flowcharts, use `flowchart TB`; for nested subgraphs with an explicit direction, use `direction TB`.
- Do not use left-to-right, right-to-left, or bottom-to-top flow directions (`LR`, `RL`, or `BT`) unless the user explicitly requests one for a specific diagram.
- Keep the primary reading order vertically stacked. When a diagram would become too wide, split it into multiple focused diagrams or vertically arranged subgraphs instead of changing it to a horizontal layout.
- Treat top-to-bottom layout as a required project convention for every new or modified Mermaid diagram, not as an optional formatting preference.
