# Contract: Renderer

**Contract version**: 1

## Registration

Each renderer registers one immutable descriptor containing a stable ID, supported format families and variants, maturity, platform set, capabilities, resource limits, worker policy, and lazy module loader. Registration order is not detection priority; the format detector selects a descriptor from evidence and policy.

## Interface

```typescript
interface Renderer {
  readonly descriptor: RendererDescriptor;
  open(context: RendererOpenContext): Promise<RendererDocument>;
}

interface RendererDocument {
  firstContent: Promise<void>;
  metadata(): AsyncIterable<MetadataFact>;
  commands(): readonly RendererCommand[];
  search?(query: SearchQuery): AsyncIterable<SearchResult>;
  navigate?(target: NavigationTarget): Promise<void>;
  prepareSave?(request: SavePreparation): Promise<SavePayload>;
  suspend(): Promise<RendererSnapshot>;
  resume(snapshot: RendererSnapshot): Promise<void>;
  dispose(): Promise<void>;
}
```

The TypeScript declaration is normative at the semantic level. Generated concrete types may split operations while preserving the same inputs, outputs, and ownership.

## `RendererOpenContext`

The context contains document and format summaries, an opaque bounded-byte provider, a cancellation signal, a metadata sink, a renderer-scoped asset URL factory, theme and accessibility preferences, and a progress sink. It contains no Tauri invocation object, filesystem API, Android URI, network client, or shell API.

## Capability rules

- The shell displays commands only from the active renderer's current capability set.
- A renderer may withdraw a capability after inspecting a document, such as disabling save after a lossy decode or disabling search for an image.
- `edit` and `save` are independent. A recovered document may be editable while its original source is read-only, making only `save_as` available.
- `inspect` means the renderer contributes metadata facts; it does not grant access to raw native metadata APIs.
- Every command has a stable ID, localized label key, optional shortcut, enabled state, and accessible description.

## Resource and lifecycle rules

- `open`, `search`, `navigate`, metadata extraction, and save preparation accept cancellation and must stop producing new work within 250 ms of cancellation on the reference fixtures.
- CPU-intensive parsing and rendering runs in a Web Worker or Rust worker thread when the descriptor marks the worker policy `required`.
- A suspended background tab releases decoded images, PDF canvases, office trees, and other regenerable caches until it fits its suspended budget.
- `dispose` is idempotent and releases workers, object URLs, native byte leases, timers, observers, and event subscriptions.
- Renderer errors use stable categories: unsupported feature, malformed input, encrypted input, resource limit, cancelled, dependency failure, and internal defect.

## Conformance suite

Every renderer must pass registration, first-content, cancellation, metadata provenance, disposal, repeated open/close, background suspension, malformed input, oversized input, unsupported feature, and platform parity tests. Editable renderers additionally pass dirty-state, undo/redo, encoding/newline preservation, conflict, save, save-as, recovery, and lossy-save denial tests.
