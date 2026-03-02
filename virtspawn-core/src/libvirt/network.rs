use virt::connect::Connect;
use virt::network::Network;

use crate::state::NetworkInfo;
use crate::LibvirtError;

fn lookup_network(conn: &Connect, name: &str) -> Result<Network, LibvirtError> {
    Network::lookup_by_name(conn, name)
        .map_err(|e| LibvirtError::NotFound(format!("Network '{name}' not found: {e}")))
}

pub fn list_networks(conn: &Connect) -> Result<Vec<NetworkInfo>, LibvirtError> {
    let networks = conn
        .list_all_networks(0)
        .map_err(|e| LibvirtError::Operation(format!("Failed to list networks: {e}")))?;

    let mut result = Vec::new();
    for net in networks {
        let name = net
            .get_name()
            .map_err(|e| LibvirtError::Operation(format!("Failed to get network name: {e}")))?;

        result.push(NetworkInfo {
            name,
            uuid: net.get_uuid_string().unwrap_or_default(),
            active: net.is_active().unwrap_or(false),
            persistent: net.is_persistent().unwrap_or(false),
            autostart: net.get_autostart().unwrap_or(false),
            bridge: net.get_bridge_name().unwrap_or_default(),
        });
    }

    Ok(result)
}

pub fn start_network(conn: &Connect, name: &str) -> Result<(), LibvirtError> {
    let net = lookup_network(conn, name)?;
    net.create()
        .map_err(|e| LibvirtError::Operation(format!("Failed to start network '{name}': {e}")))?;
    Ok(())
}

pub fn stop_network(conn: &Connect, name: &str) -> Result<(), LibvirtError> {
    let net = lookup_network(conn, name)?;
    net.destroy()
        .map_err(|e| LibvirtError::Operation(format!("Failed to stop network '{name}': {e}")))?;
    Ok(())
}

pub fn create_network(
    conn: &Connect,
    name: &str,
    subnet: &str,
    dhcp_start: &str,
    dhcp_end: &str,
) -> Result<(), LibvirtError> {
    crate::validate::validate_name(name)?;

    let xml = format!(
        r#"<network>
  <name>{name}</name>
  <forward mode='nat'/>
  <bridge stp='on' delay='0'/>
  <ip address='{subnet}.1' netmask='255.255.255.0'>
    <dhcp>
      <range start='{dhcp_start}' end='{dhcp_end}'/>
    </dhcp>
  </ip>
</network>"#,
    );

    Network::define_xml(conn, &xml)
        .map_err(|e| LibvirtError::Operation(format!("Failed to create network '{name}': {e}")))?;

    Ok(())
}

pub fn delete_network(conn: &Connect, name: &str) -> Result<(), LibvirtError> {
    let net = lookup_network(conn, name)?;

    if net.is_active().unwrap_or(false) {
        let _ = net.destroy();
    }

    net.undefine()
        .map_err(|e| LibvirtError::Operation(format!("Failed to delete network '{name}': {e}")))?;
    Ok(())
}

pub fn set_network_autostart(conn: &Connect, name: &str, autostart: bool) -> Result<(), LibvirtError> {
    let net = lookup_network(conn, name)?;
    net.set_autostart(autostart)
        .map_err(|e| LibvirtError::Operation(format!("Failed to set autostart: {e}")))?;
    Ok(())
}

pub fn get_network_xml(conn: &Connect, name: &str) -> Result<String, LibvirtError> {
    let net = lookup_network(conn, name)?;
    net.get_xml_desc(0)
        .map_err(|e| LibvirtError::Operation(format!("Failed to get network XML: {e}")))
}
