//! SPICE → VNC via `virt-xml --convert-to-vnc` (same as Cockpit-machines).

use std::process::Command;

use crate::LibvirtError;

pub fn virt_xml_convert_spice_to_vnc(
    libvirt_uri: &str,
    vm_name: &str,
) -> Result<String, LibvirtError> {
    let output = Command::new("virt-xml")
        .args(["-c", libvirt_uri, vm_name, "--edit", "--convert-to-vnc"])
        .output()
        .map_err(|e| LibvirtError::Operation(format!("virt-xml spawn failed: {e}")))?;

    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).trim().to_string());
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    Err(LibvirtError::Operation(format!(
        "virt-xml --convert-to-vnc failed: {stderr}"
    )))
}
