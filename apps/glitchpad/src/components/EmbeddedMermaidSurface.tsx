import { useEffect, useRef, useState } from 'react';

import { MermaidRendererClient } from '../domain/mermaid-adapter';
import type { EmbeddedMermaidBlock, MermaidRenderResult } from '../domain/mermaid-contract';
import { DiagramViewport } from './DiagramViewport';

interface EmbeddedMermaidSurfaceProps {
  block: EmbeddedMermaidBlock;
  documentName: string;
  onViewSource: () => void;
  rendererClient?: MermaidRendererClient;
}

export function EmbeddedMermaidSurface({ block, documentName, onViewSource, rendererClient }: EmbeddedMermaidSurfaceProps) {
  const ownedClient = useRef<MermaidRendererClient | null>(null);
  if (!ownedClient.current) ownedClient.current = rendererClient ?? new MermaidRendererClient();
  const client = ownedClient.current;
  const [result, setResult] = useState<MermaidRenderResult | null>(null);

  useEffect(() => {
    if (block.limit) return;
    void client.render({
      owner_id: block.owner_id,
      source_revision: block.parent_revision,
      source_text: block.source,
      fallback_label: `${documentName} diagram ${block.ordinal}`,
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    }).then(setResult);
    return () => client.cancel();
  }, [block, client, documentName]);

  useEffect(() => () => client.dispose(), [client]);

  const failure = block.limit
    ? `Diagram ${block.ordinal} exceeds the ${block.limit.replaceAll('_', ' ')} limit.`
    : result?.diagnostic?.message;
  return (
    <figure className="embedded-mermaid" data-mermaid-block={block.ordinal}>
      {result?.status === 'ready' && result.svg ? (
        <DiagramViewport svg={result.svg} label={result.accessibility.label} description={result.accessibility.description} />
      ) : (
        <div className="embedded-mermaid-fallback" role={failure ? 'alert' : 'status'}>
          {failure ?? `Rendering diagram ${block.ordinal}`}
        </div>
      )}
      <figcaption>
        <span>Diagram {block.ordinal}</span>
        <button type="button" onClick={onViewSource}>View source</button>
      </figcaption>
    </figure>
  );
}
