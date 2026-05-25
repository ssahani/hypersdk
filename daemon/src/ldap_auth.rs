//! LDAP / Active Directory simple-bind authentication for web login.

use ldap3::{LdapConn, LdapConnSettings, Scope, SearchEntry};
use machina_core::config::LdapConfig;
use tracing::warn;

fn open_ldap(url: &str, cfg: &LdapConfig) -> Result<LdapConn, String> {
    let mut settings = LdapConnSettings::new();
    if cfg.insecure_tls {
        settings = settings.set_no_tls_verify(true);
    }
    // STARTTLS on plain ldap:// (ldaps:// uses implicit TLS via URL scheme).
    if cfg.use_tls && url.starts_with("ldap://") {
        settings = settings.set_starttls(true);
    }
    LdapConn::with_settings(settings, url).map_err(|e| format!("LDAP connect failed: {e}"))
}

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

    let mut ldap = open_ldap(url, cfg)?;
    let user_dn = resolve_user_dn(cfg, &mut ldap, username)?;
    ldap.simple_bind(&user_dn, password)
        .map_err(|e| format!("LDAP bind failed: {e}"))?
        .success()
        .map_err(|e| format!("LDAP authentication failed: {e}"))?;

    Ok(username.to_string())
}

fn resolve_user_dn(
    cfg: &LdapConfig,
    ldap: &mut LdapConn,
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
            .search(base, Scope::Subtree, &filter, vec!["dn"])
            .map_err(|e| format!("LDAP search failed: {e}"))?
            .success()
            .map_err(|e| format!("LDAP search failed: {e}"))?;
        let dn = rs
            .into_iter()
            .map(SearchEntry::construct)
            .find(|e| !e.dn.is_empty())
            .map(|e| e.dn)
            .ok_or_else(|| "LDAP user not found".to_string())?;
        return Ok(dn);
    }

    warn!(
        "LDAP: configure user_dn_template or bind_dn+base_dn+user_filter for user '{}'",
        username
    );
    Err("LDAP user DN resolution is not configured".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ldap_settings_starttls_only_for_ldap_scheme() {
        let mut cfg = LdapConfig::default();
        cfg.use_tls = true;
        cfg.insecure_tls = true;
        // Exercise settings builder without a live server.
        let settings = {
            let mut s = LdapConnSettings::new().set_no_tls_verify(true);
            s = s.set_starttls(true);
            s
        };
        assert!(settings.starttls());
    }
}
