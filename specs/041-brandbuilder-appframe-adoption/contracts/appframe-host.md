# AppFrame Host Contract

## Consumer obligations

1. Import the exact generated token, component, server, and environment entries from the pinned kit.
2. Mount exactly one generated AppFrame with `layout="full-bleed"` above the existing application shell.
3. Include `viewport-fit=cover` in the viewport declaration.
4. Do not reproduce `env(safe-area-inset-*)`, visual viewport listeners, or IME root padding in product CSS.
5. Keep native Tauri titlebar ownership outside the web safe-area contract.
6. Preserve one document-root geometry owner and product-local inner scrollers only where the application needs them.

## Generated obligations

1. AppFrame exposes a bounded contained/full-bleed layout choice without arbitrary style escape hatches.
2. The environment bridge is dependency-free and keeps stable CSS custom properties current.
3. The kit declares exact versions, provenance, file hashes, recovery bytes, verification commands, and capability-gap workflow.

## Evidence obligations

- Unit/static checks reject missing AppFrame, duplicate ownership, missing viewport cover, and competing root scrolling.
- Android WebView instrumentation covers portrait, landscape, IME, and cutout profiles.
- Windows Tauri build/package evidence covers native-host integration.
- Results distinguish observed success, failure, limitation, and unobserved historical data.
