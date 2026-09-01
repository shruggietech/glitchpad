'use client';

import mermaid from 'mermaid';
import { useEffect, useId, useState } from 'react';

export function Mermaid({ chart }: { chart: string }) {
  const id = `mermaid-${useId().replaceAll(':', '')}`;
  const [svg, setSvg] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const render = async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'neutral',
        });
        const result = await mermaid.render(id, chart);
        if (active) setSvg(result.svg);
      } catch {
        if (active) setFailed(true);
      }
    };
    void render();
    return () => {
      active = false;
    };
  }, [chart, id]);

  if (failed)
    return (
      <pre aria-label="Mermaid diagram source">
        <code>{chart}</code>
      </pre>
    );
  if (!svg)
    return (
      <pre aria-label="Loading Mermaid diagram">
        <code>{chart}</code>
      </pre>
    );
  return (
    <figure className="mermaid-figure">
      <div
        className="mermaid-diagram"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <figcaption className="sr-only">
        Mermaid diagram source:
        <pre>
          <code>{chart}</code>
        </pre>
      </figcaption>
    </figure>
  );
}
