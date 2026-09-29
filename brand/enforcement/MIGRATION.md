## Migration impact

No approved identity redesign is included. Brand version `1.1.1` remains distinct from package `glitchpad-brand-1.1.1-bb2.0.3`.

| Surface | Classification | Guidance |
| --- | --- | --- |
| Identity | unaffected | Approved logo geometry, source bytes, ownership, and affiliation are unchanged. Glitchpad 1.1.1 and ESO Weave 1.0.2 advance package versions for native role presentation without identity redesign. |
| Palette | required | Consumers using generated semantic color roles must repin the rebuilt kit and retain its measured surface-specific values. |
| Typography | required | Consumers using generated typography bindings must repin the rebuilt kit and its local font declarations. |
| Platform Assets | required | Web, Android, and Windows consumers of affected icon roles must regenerate and repin assets; other platform assets remain optional. |
| Web React | optional | Web and React consumers may adopt the AppFrame and environment contracts when they use those generated surfaces. |
| Egui | required | Native Rust consumers using status or disabled controls should regenerate and repin egui adapter 1.0.2 for explicit readable text roles; ESO Weave must fix its local strong-label call separately. |
| Documentation | required | Readers and consumers using generated guidance should repin the rebuilt kit for native icon role, egui status, and exact-version bundle instructions. |
| Recovery | required | Consumers retaining a kit must preserve the delivered checksummed BrandBuilder recovery bytes and canonical immutable package identity. |

`required` applies to existing use of that surface, `optional` is an available capability, and `unaffected` requires no migration.
