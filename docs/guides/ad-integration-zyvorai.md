# Active Directory — zyvorai.local lab

Integrate Machina, Zeus OS, and the HyperSDK suite with the **zyvorai.local** domain controller.

| Field | Value |
|-------|--------|
| Domain | `zyvorai.local` |
| DC host | `45.82.66.172` |
| LDAP URL | `ldap://45.82.66.172:389` |
| Base DN | `DC=zyvorai,DC=local` |
| Test UPN | `sshant@zyvorai.local` |

Do **not** commit domain passwords to git. Use the UI test bind or a secrets manager.

## Machina (hypervisor UI)

1. Open **Settings → Active Directory / LDAP** (admin role).
2. Click **Apply zyvorai.local preset**.
3. Enable LDAP login → **Save AD settings**.
4. **Test LDAP** with `sshant@zyvorai.local` and the lab password.
5. Sign out and log in on `/login` with the same UPN.

Equivalent `config.toml`:

```toml
[auth.ldap]
enabled = true
url = "ldap://45.82.66.172:389"
base_dn = "DC=zyvorai,DC=local"
user_filter = "(|(sAMAccountName={username})(userPrincipalName={username}))"
member_attribute = "memberOf"
username_attribute = "sAMAccountName"
admin_group_substrings = ["Domain Admins", "Machina-Admins"]
operator_group_substrings = ["Machina-Operators"]
readonly_group_substrings = ["Domain Users"]
```

UPN login (`user@domain`) uses direct AD bind when no service account is configured.

See also: [LDAP / Active Directory login](../ldap-auth.md).

## Zeus OS (v9s)

Set on the Zeus OS API deployment:

```bash
export ZEUS_OS_AUTH=ldap
export ZEUS_OS_LDAP_URL=ldap://45.82.66.172:389
export ZEUS_OS_LDAP_BASE_DN=DC=zyvorai,DC=local
export ZEUS_OS_LDAP_BIND_DN_TEMPLATE={}@zyvorai.local
```

Sign in on the Zeus login page with `sshant@zyvorai.local`.

See: [Enterprise auth and tenancy](../../v9s/docs/ENTERPRISE_AUTH_TENANCY.md) (sibling repo).

## HyperSDK web

Marketing and client decks reference suite-wide LDAP/AD under Machina + Zeus OS identity. Run `npm run presentations:sync -- --product=machina` in hypersdk-web after updating machina decks.

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Invalid username characters | Machina ≥ current build allows `@` when LDAP is enabled |
| LDAP bind failed | Firewall 389/tcp to `45.82.66.172`, clock skew, password |
| User not found | Base DN / user filter; try full UPN |
| Readonly role only | `memberOf` / group substring mapping in LDAP settings |
