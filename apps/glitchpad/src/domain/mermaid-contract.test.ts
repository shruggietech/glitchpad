import { describe, expect, it } from 'vitest';

import {
  MERMAID_MAX_ZOOM,
  MERMAID_MIN_ZOOM,
  clampMermaidPan,
  clampMermaidZoom,
  countMermaidEdges,
  detectMermaidType,
  mermaidSourceBytes,
} from './mermaid-contract';

describe('Mermaid contract', () => {
  it('detects supported declarations without rewriting authored direction', () => {
    expect(detectMermaidType('flowchart LR\n  A --> B')).toBe('flowchart');
    expect(detectMermaidType('%% comment\nsequenceDiagram\nA->>B: Hi')).toBe('sequenceDiagram');
    expect(detectMermaidType('not-a-diagram')).toBeNull();
  });

  it('counts bounded edge syntax and measures UTF-8 bytes', () => {
    expect(countMermaidEdges('A --> B\nB -.-> C\nC ==> D')).toBe(3);
    expect(countMermaidEdges('A --- B\nB ~~> C\nC --x D\nD --o E\nE <-- F\nF <== G')).toBe(6);
    expect(mermaidSourceBytes('é')).toBe(2);
  });

  it('clamps zoom and pan to reachable content', () => {
    expect(clampMermaidZoom(0)).toBe(MERMAID_MIN_ZOOM);
    expect(clampMermaidZoom(20)).toBe(MERMAID_MAX_ZOOM);
    expect(clampMermaidPan(900, 1_000, 400)).toBe(300);
    expect(clampMermaidPan(-900, 1_000, 400)).toBe(-300);
    expect(clampMermaidPan(20, 200, 400)).toBe(0);
  });
});
