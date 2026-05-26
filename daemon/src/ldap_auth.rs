// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// Proprietary software — see LICENSE in the repository root.
// https://zyvor.dev · info@zyvor.dev

//! LDAP / Active Directory simple-bind authentication for web login.

use ldap3::{LdapConn, LdapConnSettings, Scope, SearchEntry};
use machina_core::config::LdapConfig;
use machina_core::ldap_role::role_from_ldap_groups;
use machina_core::libvirt::automation::Role;
use tracing::warn;

pub struct LdapAuthResult {
    pub username: String,
    pub role: Role,
}

fn open_ldap(url: &str, cfg: &LdapConfig) -> Result<LdapConn, String> {
    let mut settings = LdapConnSettings::new();
    if cfg.insecure_tls {
        settings = settings.set_no_tls_verify(true);
    }
    if cfg.use_tls && url.starts_with("ldap://") {
        settings = settings.set_starttls(true);
    }
    LdapConn::with_settings(settings, url).map_err(|e| format!("LDAP connect failed: {e}"))
}

pub fn ldap_authenticate(
    cfg: &LdapConfig,
    username: &str,
    password: &str,
) -> Result<LdapAuthResult, String> {
    if !cfg.is_enabled() {
        return Err("LDAP is not enabled".into());
    }
    let url = cfg.url.trim();
    if url.is_empty() {
        return Err("LDAP url is not configured".into());
    }

    let mut ldap = open_ldap(url, cfg)?;
    let (user_dn, groups) = resolve_user_dn_and_groups(cfg, &mut ldap, username)?;
    ldap.simple_bind(&user_dn, password)
        .map_err(|e| format!("LDAP bind failed: {e}"))?
        .success()
        .map_err(|e| format!("LDAP authentication failed: {e}"))?;

    let role = role_from_ldap_groups(cfg, &groups);
    Ok(LdapAuthResult {
        username: username.to_string(),
        role,
    })
}

fn resolve_user_dn_and_groups(
    cfg: &LdapConfig,
    ldap: &mut LdapConn,
    username: &str,
) -> Result<(String, Vec<String>), String> {
    let template = cfg.user_dn_template.trim();
    if !template.is_empty() {
        let dn = template.replace("{username}", username);
        let groups = fetch_groups_for_dn(cfg, ldap, &dn)?;
        return Ok((dn, groups));
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
        let attrs = vec!["dn", cfg.member_attribute.as_str()];
        let (rs, _) = ldap
            .search(base, Scope::Subtree, &filter, attrs)
            .map_err(|e| format!("LDAP search failed: {e}"))?
            .success()
            .map_err(|e| format!("LDAP search failed: {e}"))?;
        let entry = rs
            .into_iter()
            .map(SearchEntry::construct)
            .find(|e| !e.dn.is_empty())
            .ok_or_else(|| "LDAP user not found".to_string())?;
        let groups = entry
            .attrs
            .get(&cfg.member_attribute)
            .cloned()
            .unwrap_or_default();
        return Ok((entry.dn, groups));
    }

    warn!(
        "LDAP: configure user_dn_template or bind_dn+base_dn+user_filter for user '{}'",
        username
    );
    Err("LDAP user DN resolution is not configured".into())
}

fn fetch_groups_for_dn(
    cfg: &LdapConfig,
    ldap: &mut LdapConn,
    dn: &str,
) -> Result<Vec<String>, String> {
    let (rs, _) = ldap
        .search(
            dn,
            Scope::Base,
            "(objectClass=*)",
            vec![cfg.member_attribute.as_str()],
        )
        .map_err(|e| format!("LDAP group lookup failed: {e}"))?
        .success()
        .map_err(|e| format!("LDAP group lookup failed: {e}"))?;
    Ok(rs
        .into_iter()
        .map(SearchEntry::construct)
        .next()
        .and_then(|e| e.attrs.get(&cfg.member_attribute).cloned())
        .unwrap_or_default())
}
