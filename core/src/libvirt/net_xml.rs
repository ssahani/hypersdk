//! Extract networking hints from libvirt XML snippets (domain / network definitions).

use std::collections::HashSet;

/// First `<ip address='v4' …>` on an IPv4-looking address (typical libvirt NAT bridge IP on the host).
pub fn ipv4_gateway_from_network_xml(xml: &str) -> Option<String> {
    let mut start = 0usize;
    while let Some(rel) = xml.get(start..).and_then(|s| s.find("address='")) {
        let i = start + rel + "address='".len();
        let rest = xml.get(i..)?;
        let end = rest.find('\'')?;
        let addr = &rest[..end];
        if addr.contains('.') && addr.parse::<std::net::Ipv4Addr>().is_ok() {
            return Some(addr.to_string());
        }
        start = i + end;
    }
    None
}

/// `<source network='foo'/>` names referenced by a domain XML.
pub fn network_names_from_domain_xml(xml: &str) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    let mut start = 0usize;
    while let Some(rel) = xml.get(start..).and_then(|s| s.find("network='")) {
        let i = start + rel + "network='".len();
        let Some(rest) = xml.get(i..) else { break };
        let Some(end) = rest.find('\'') else { break };
        let name = rest[..end].to_string();
        if seen.insert(name.clone()) {
            out.push(name);
        }
        start = i + end;
    }
    out
}
