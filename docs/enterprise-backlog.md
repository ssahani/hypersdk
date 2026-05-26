# Enterprise backlog (explicit non-goals today)

Machina targets single-host and small fleet KVM operations. The items below are **not implemented** on `main`; track here for product planning — not as missing bugs.

| Area | Status | Notes |
|------|--------|-------|
| HashiCorp Vault (or similar) for secrets | Not planned on `main` | libvirt secrets API + config file today; see [compliance-hardening.md](compliance-hardening.md) |
| WebAuthn / MFA / SAML / SCIM | Not planned on `main` | PAM, LDAP, OIDC browser SSO, API token scopes |
| FIPS-validated crypto modules | Not planned on `main` | TLS via system/OpenSSL; no FIPS module selection |
| Fleet automatic leader election / VIP | Not planned on `main` | Manual DNS or load balancer failover — [fleet-ha.md](fleet-ha.md) |
| Built-in license / entitlement server | Not planned on `main` | Open-source deployment model |
| In-browser RDP decoder (WASM) | Not planned on `main` | WebSocket tunnel + `.rdp` download — [builtin-rdp.md](builtin-rdp.md) |
| Multi-tenant isolation beyond RBAC | Not planned on `main` | Single hypervisor trust boundary |
| `extra_uris` write lifecycle | Not planned on `main` | Federated VM list is read-only — [ux.md](ux.md) |

When prioritizing new work, prefer gaps in [ROADMAP.md](ROADMAP.md) follow-ups and partial rollouts (session libvirt coverage, operator UX) over this list unless your organization requires compliance features above.
