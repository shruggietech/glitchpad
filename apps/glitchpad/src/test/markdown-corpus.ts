export interface MarkdownCorpusFixture {
  id: string;
  name: string;
  content: string;
  marker: string;
}

export const markdownCorpus: MarkdownCorpusFixture[] = [
  {
    id: 'structured',
    name: 'structured.md',
    marker: 'Structured finish',
    content: '# Structured start\n\n- [x] Complete\n- [ ] Pending\n\n| Left | Right |\n| --- | --- |\n| Alpha | Beta |\n\nFootnote[^1].\n\n[^1]: Structured finish',
  },
  {
    id: 'hostile',
    name: 'hostile.md',
    marker: 'Visible safe ending',
    content: '# Sanitized\n\n<script>globalThis.compromised = true</script>\n\n[blocked](javascript:alert(1))\n\n<!-- RAW_ONLY_SENTINEL -->\n\nVisible safe ending',
  },
  {
    id: 'unicode',
    name: 'unicode.md',
    marker: 'Unicode finish',
    content: '# Unicode café 漢字 🦄\n\n`inline` and a long token: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n\nUnicode finish',
  },
  {
    id: 'embedded-mermaid',
    name: 'diagram.md',
    marker: 'Diagram finish',
    content: '# Diagram\n\n```mermaid\nflowchart TB\n  Start --> Finish\n```\n\nDiagram finish',
  },
];
