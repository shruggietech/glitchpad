# Glitchpad components

These framework-light React components express the Glitchpad interface grammar. Import `../styles.css` and `components.css`, then compose the JSX modules as needed. Every visual value resolves through the `--gp-*` token namespace.

Core components cover buttons, badges, cards, dividers, section headings, and the product-specific `FileRow`. Form components expose visible labels, required state, and accessible error messaging. Status uses both color and a dot or text label.

The product-specific file row is intentionally denser than a marketing card. It uses Geist Mono, restrained hover feedback, and a sulfur selection state without competing with file content.
