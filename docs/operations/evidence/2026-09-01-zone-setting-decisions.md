# Cloudflare zone-setting decisions

This S009 evidence appendix assigns an individual disposition and rationale to every zone setting returned in the pre-cutover snapshot. All 56 settings are retained exactly. The final website records are DNS-only, so Cloudflare edge transport, TLS, cache, content, performance, security, privacy, logging, and request controls are dormant for Glitchpad website traffic. Changing any of those controls would be an independent policy change outside S009. The one DNS behavior setting, `cname_flattening`, also remains unchanged because the final apex uses explicit A and AAAA records and `www` uses a direct CNAME.

| Setting | Captured value | Editable | Decision | Rationale |
| --- | --- | --- | --- | --- |
| `0rtt` | `"off"` | Yes | Retain | DNS-only website records bypass this Cloudflare edge transport or TLS control; changing it is outside S009. |
| `advanced_ddos` | `"on"` | No | Retain | No S009 requirement justifies altering this existing security, privacy, logging, or request policy; DNS-only website records bypass it. |
| `always_online` | `"off"` | Yes | Retain | DNS-only website records bypass this Cloudflare cache, content, or performance control; changing it is outside S009. |
| `always_use_https` | `"on"` | Yes | Retain | DNS-only website records bypass this Cloudflare edge transport or TLS control; changing it is outside S009. |
| `automatic_https_rewrites` | `"on"` | Yes | Retain | DNS-only website records bypass this Cloudflare edge transport or TLS control; changing it is outside S009. |
| `brotli` | `"on"` | Yes | Retain | DNS-only website records bypass this Cloudflare cache, content, or performance control; changing it is outside S009. |
| `browser_cache_ttl` | `14400` | Yes | Retain | DNS-only website records bypass this Cloudflare cache, content, or performance control; changing it is outside S009. |
| `browser_check` | `"on"` | Yes | Retain | No S009 requirement justifies altering this existing security, privacy, logging, or request policy; DNS-only website records bypass it. |
| `cache_level` | `"aggressive"` | Yes | Retain | DNS-only website records bypass this Cloudflare cache, content, or performance control; changing it is outside S009. |
| `challenge_ttl` | `1800` | Yes | Retain | No S009 requirement justifies altering this existing security, privacy, logging, or request policy; DNS-only website records bypass it. |
| `ciphers` | `[]` | Yes | Retain | DNS-only website records bypass this Cloudflare edge transport or TLS control; changing it is outside S009. |
| `cname_flattening` | `"flatten_at_root"` | Yes | Retain | Explicit A and AAAA apex records plus the direct `www` CNAME need no flattening change; retain the captured DNS behavior. |
| `development_mode` | `"off"` | Yes | Retain | DNS-only website records bypass this Cloudflare cache, content, or performance control; changing it is outside S009. |
| `early_hints` | `"off"` | Yes | Retain | DNS-only website records bypass this Cloudflare cache, content, or performance control; changing it is outside S009. |
| `ech` | `"on"` | Yes | Retain | DNS-only website records bypass this Cloudflare edge transport or TLS control; changing it is outside S009. |
| `edge_cache_ttl` | `7200` | Yes | Retain | DNS-only website records bypass this Cloudflare cache, content, or performance control; changing it is outside S009. |
| `email_obfuscation` | `"on"` | Yes | Retain | No S009 requirement justifies altering this existing security, privacy, logging, or request policy; DNS-only website records bypass it. |
| `filter_logs_to_cloudflare` | `"off"` | Yes | Retain | No S009 requirement justifies altering this existing security, privacy, logging, or request policy; DNS-only website records bypass it. |
| `hotlink_protection` | `"off"` | Yes | Retain | No S009 requirement justifies altering this existing security, privacy, logging, or request policy; DNS-only website records bypass it. |
| `http2` | `"on"` | No | Retain | DNS-only website records bypass this Cloudflare edge transport or TLS control; changing it is outside S009. |
| `http3` | `"on"` | Yes | Retain | DNS-only website records bypass this Cloudflare edge transport or TLS control; changing it is outside S009. |
| `ip_geolocation` | `"on"` | Yes | Retain | No S009 requirement justifies altering this existing security, privacy, logging, or request policy; DNS-only website records bypass it. |
| `ipv6` | `"on"` | Yes | Retain | DNS-only website records bypass this Cloudflare edge transport or TLS control; changing it is outside S009. |
| `log_to_cloudflare` | `"on"` | Yes | Retain | No S009 requirement justifies altering this existing security, privacy, logging, or request policy; DNS-only website records bypass it. |
| `long_lived_grpc` | `"off"` | No | Retain | DNS-only website records bypass this Cloudflare edge transport or TLS control; changing it is outside S009. |
| `max_upload` | `100` | Yes | Retain | DNS-only website records bypass this Cloudflare cache, content, or performance control; changing it is outside S009. |
| `min_tls_version` | `"1.0"` | Yes | Retain | DNS-only website records bypass this Cloudflare edge transport or TLS control; changing it is outside S009. |
| `minify` | `{"css":"off","html":"off","js":"off"}` | Yes | Retain | DNS-only website records bypass this Cloudflare cache, content, or performance control; changing it is outside S009. |
| `mirage` | `"off"` | No | Retain | DNS-only website records bypass this Cloudflare cache, content, or performance control; changing it is outside S009. |
| `mobile_redirect` | `{"status":"off","mobile_subdomain":null,"strip_uri":false}` | Yes | Retain | DNS-only website records bypass this Cloudflare cache, content, or performance control; changing it is outside S009. |
| `opportunistic_encryption` | `"on"` | Yes | Retain | DNS-only website records bypass this Cloudflare edge transport or TLS control; changing it is outside S009. |
| `opportunistic_onion` | `"on"` | Yes | Retain | No S009 requirement justifies altering this existing security, privacy, logging, or request policy; DNS-only website records bypass it. |
| `orange_to_orange` | `"off"` | Yes | Retain | No S009 requirement justifies altering this existing security, privacy, logging, or request policy; DNS-only website records bypass it. |
| `origin_error_page_pass_thru` | `"off"` | No | Retain | DNS-only website records bypass this Cloudflare cache, content, or performance control; changing it is outside S009. |
| `polish` | `"off"` | No | Retain | DNS-only website records bypass this Cloudflare cache, content, or performance control; changing it is outside S009. |
| `pq_keyex` | `"on"` | Yes | Retain | DNS-only website records bypass this Cloudflare edge transport or TLS control; changing it is outside S009. |
| `prefetch_preload` | `"off"` | No | Retain | DNS-only website records bypass this Cloudflare cache, content, or performance control; changing it is outside S009. |
| `privacy_pass` | `"on"` | Yes | Retain | No S009 requirement justifies altering this existing security, privacy, logging, or request policy; DNS-only website records bypass it. |
| `proxy_read_timeout` | `"125"` | No | Retain | DNS-only website records bypass this Cloudflare edge transport or TLS control; changing it is outside S009. |
| `pseudo_ipv4` | `"off"` | Yes | Retain | No S009 requirement justifies altering this existing security, privacy, logging, or request policy; DNS-only website records bypass it. |
| `replace_insecure_js` | `"on"` | Yes | Retain | DNS-only website records bypass this Cloudflare cache, content, or performance control; changing it is outside S009. |
| `response_buffering` | `"off"` | No | Retain | DNS-only website records bypass this Cloudflare cache, content, or performance control; changing it is outside S009. |
| `rocket_loader` | `"off"` | Yes | Retain | DNS-only website records bypass this Cloudflare cache, content, or performance control; changing it is outside S009. |
| `security_header` | `{"strict_transport_security":{"enabled":false,"max_age":0,"include_subdomains":false,"preload":false,"nosniff":false}}` | Yes | Retain | No S009 requirement justifies altering this existing security, privacy, logging, or request policy; DNS-only website records bypass it. |
| `security_level` | `"medium"` | Yes | Retain | No S009 requirement justifies altering this existing security, privacy, logging, or request policy; DNS-only website records bypass it. |
| `server_side_exclude` | `"on"` | Yes | Retain | No S009 requirement justifies altering this existing security, privacy, logging, or request policy; DNS-only website records bypass it. |
| `sort_query_string_for_cache` | `"off"` | No | Retain | DNS-only website records bypass this Cloudflare cache, content, or performance control; changing it is outside S009. |
| `ssl` | `"full"` | Yes | Retain | DNS-only website records bypass this Cloudflare edge transport or TLS control; changing it is outside S009. |
| `tls_1_2_only` | `"off"` | Yes | Retain | DNS-only website records bypass this Cloudflare edge transport or TLS control; changing it is outside S009. |
| `tls_1_3` | `"on"` | Yes | Retain | DNS-only website records bypass this Cloudflare edge transport or TLS control; changing it is outside S009. |
| `tls_client_auth` | `"off"` | Yes | Retain | DNS-only website records bypass this Cloudflare edge transport or TLS control; changing it is outside S009. |
| `true_client_ip_header` | `"off"` | No | Retain | DNS-only website records bypass this Cloudflare edge transport or TLS control; changing it is outside S009. |
| `visitor_ip` | `"on"` | Yes | Retain | No S009 requirement justifies altering this existing security, privacy, logging, or request policy; DNS-only website records bypass it. |
| `waf` | `"off"` | Yes | Retain | No S009 requirement justifies altering this existing security, privacy, logging, or request policy; DNS-only website records bypass it. |
| `webp` | `"off"` | No | Retain | DNS-only website records bypass this Cloudflare cache, content, or performance control; changing it is outside S009. |
| `websockets` | `"on"` | Yes | Retain | DNS-only website records bypass this Cloudflare edge transport or TLS control; changing it is outside S009. |

The appendix contains 56 setting rows, matching the snapshot count. The final comparison reports all 56 values equal to baseline.
