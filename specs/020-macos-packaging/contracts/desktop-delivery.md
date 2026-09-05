# Contract: macOS Open-Document Delivery

## Native ingress

macOS `RunEvent::Opened` is the sole S020-specific Finder/open-document ingress. Every incoming resource must have the `file` scheme and convert successfully through the URL library's file-path operation. Non-file URLs, malformed file URLs, directories, links, missing files, unsupported extensions, and unsafe content are rejected through the existing native source error contract.

## Queue behavior

Converted paths enter `DesktopDeliveryQueue` as `Association` deliveries. The queue preserves event order, enforces its existing capacity, acquires content through `DesktopSourceHost`, identifies duplicate active sources, and emits only path-free `DesktopDeliveryResult` values.

Events arriving during startup remain queued until the interface drains them. Events arriving while the application is active emit `desktop-deliveries-ready` and focus the main window. A source already active produces one duplicate-focus result and never a second open.

## Privacy and failure contract

No URL, native path, account name, or raw conversion error crosses the interface or enters receipts. Rejected resources expose only an existing safe error category and summary. One rejected resource does not suppress valid siblings in the same event unless the bounded queue cannot reserve the whole batch, in which case the event is rejected atomically.
