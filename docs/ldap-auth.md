# LDAP / Active Directory login

When `[auth.ldap]` is enabled, password login uses LDAP simple bind before PAM.

```toml
[auth.ldap]
enabled = true
url = "ldaps://dc.example.com:636"
base_dn = "dc=example,dc=com"
user_filter = "(sAMAccountName={username})"
bind_dn = "cn=machina,ou=services,dc=example,dc=com"
bind_password = "secret"
# Or direct bind template (no search):
# user_dn_template = "uid={username},ou=people,dc=example,dc=com"
use_tls = false
insecure_tls = false
```

Active Directory: use `user_filter = "(sAMAccountName={username})"` and service `bind_dn` / `bind_password`.

The web login form is unchanged; `/auth/providers` reports `ldap.enabled` and disables PAM when LDAP is the primary backend.
