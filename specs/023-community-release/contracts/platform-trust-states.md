# Platform Trust State Contract

| Platform | Official v0.1.0 state | Forbidden claim |
| --- | --- | --- |
| Windows | `unsigned_community` | Authenticode, publisher, or Microsoft endorsement |
| macOS | `adhoc_non_notarized_community` | Developer ID, notarization, staple, or Apple endorsement |
| Linux | `repository_attested` | Distribution-vendor endorsement |
| Android | `stable_project_key` | Disposable key or exposed private material |

`blocked_candidate` is allowed only for pull-request and branch artifacts and can never be published.
