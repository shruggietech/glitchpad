import { useEffect, useId, useRef, useState } from 'react';

import { MermaidRendererClient } from '../domain/mermaid-adapter';
import type { EmbeddedMermaidBlock, MermaidRenderResult } from '../domain/mermaid-contract';
import { DiagramViewport } from './DiagramViewport';
import { useMermaidTheme } from './useMermaidTheme';
import { rendererResourceLedger } from '../domain/resource-ledger';

interface EmbeddedMermaidSurfaceProps {
  block: EmbeddedMermaidBlock;
  documentName: string;
  onViewSource: () => void;
  rendererClient?: MermaidRendererClient;
}

export function EmbeddedMermaidSurface({ block, documentName, onViewSource, rendererClient }: EmbeddedMermaidSurfaceProps) {
  const performanceInstanceId = useId();
  const ownedClient = useRef<MermaidRendererClient | null>(null);
  const ownsClient = useRef(rendererClient === undefined);
  const lifecycleGeneration = useRef(0);
  if (!ownedClient.current) ownedClient.current = rendererClient ?? new MermaidRendererClient(
    undefined,
    undefined,
    undefined,
    undefined,
    rendererResourceLedger.register(`embedded-mermaid:${block.owner_id}:${performanceInstanceId}`, new TextEncoder().encode(block.source).byteLength),
  );
  const client = ownedClient.current;
  const [result, setResult] = useState<MermaidRenderResult | null>(null);
  const theme = useMermaidTheme();

  useEffect(() => {
    if (block.limit) {
      client.cancel();
      setResult(null);
      return;
    }
    void client.render({
      owner_id: block.owner_id,
      source_revision: block.parent_revision,
      source_text: block.source,
      fallback_label: `${documentName} diagram ${block.ordinal}`,
      theme,
    }).then(setResult);
    return () => client.cancel();
  }, [block, client, documentName, theme]);

  useEffect(
    () => {
      const generation = ++lifecycleGeneration.current;
      return () => queueMicrotask(() => {
        if (ownsClient.current && lifecycleGeneration.current === generation) {
          ownedClient.current?.dispose();
          ownedClient.current = null;
        }
      });
    },
    [],
  );

  const failure = block.limit
    ? `Diagram ${block.ordinal} exceeds the ${block.limit.replaceAll('_', ' ')} limit.`
    : result?.diagnostic?.message;
  return (
    <figure className="embedded-mermaid" data-mermaid-block={block.ordinal}>
      {!block.limit && result?.status === 'ready' && result.svg ? (
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
