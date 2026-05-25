//! LDAP / Active Directory simple-bind authentication for web login.

use machina_core::config::LdapConfig;
use tracing::warn;

pub fn ldap_authenticate(
    cfg: &LdapConfig,
    username: &str,
    password: &str,
) -> Result<String, String> {
    if !cfg.is_enabled() {
        return Err("LDAP is not enabled".into());
    }
    let url = cfg.url.trim();
    if url.is_empty() {
        return Err("LDAP url is not configured".into());
    }

    let mut ldap =
        ldap3::LdapConn::new(url).map_err(|e| format!("LDAP connect failed: {e}"))?;
    if cfg.use_tls {
        let settings = ldap3::TlsSettings {
            verify_cert: !cfg.insecure_tls,
            ..Default::default()
        };
        ldap.start_tls(&settings)
            .map_err(|e| format!("LDAP STARTTLS failed: {e}"))?;
    }

    let user_dn = resolve_user_dn(cfg, &ldap, username)?;
    ldap.simple_bind(&user_dn, password)
        .map_err(|e| format!("LDAP bind failed: {e}"))?
        .success()
        .map_err(|e| format!("LDAP authentication failed: {e}"))?;

    Ok(username.to_string())
}

fn resolve_user_dn(
    cfg: &LdapConfig,
    ldap: &ldap3::LdapConn,
    username: &str,
) -> Result<String, String> {
    let template = cfg.user_dn_template.trim();
    if !template.is_empty() {
        return Ok(template.replace("{username}", username));
    }

    let bind_dn = cfg.bind_dn.trim();
    if !bind_dn.is_empty() {
        ldap.simple_bind(bind_dn, cfg.bind_password.trim())
            .map_err(|e| format!("LDAP service bind failed: {e}"))?
            .success()
            .map_err(|e| format!("LDAP service bind failed: {e}"))?;

        let filter = cfg.user_filter.replace("{username}", username);
        let base = cfg.base_dn.trim();
        if base.is_empty() {
            return Err("LDAP base_dn required when using bind_dn + user_filter".into());
        }
        let (rs, _) = ldap
            .search(base, ldap3::Scope::Subtree, &filter, vec!["dn"])
            .map_err(|e| format!("LDAP search failed: {e}"))?
            .success()
            .map_err(|e| format!("LDAP search failed: {e}"))?;
        let entries: Vec<_> = rs.into_iter().collect();
        if entries.is_empty() {
            return Err("LDAP user not found".into());
        }
        let dn = entries[0].dn.clone();
        if dn.is_empty() {
            return Err("LDAP entry missing DN".into());
        }
        return Ok(dn);
    }

    warn!(
        "LDAP: configure user_dn_template or bind_dn+base_dn+user_filter for user '{}'",
        username
    );
    Err("LDAP user DN resolution is not configured".into())
}
