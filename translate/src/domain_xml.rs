use machina_spec::VirtualMachine;

fn esc(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('\'', "&apos;")
        .replace('"', "&quot;")
}

/// Generate libvirt domain XML from a declarative VM spec (operators never see this).
pub fn domain_xml_from_spec(
    vm: &VirtualMachine,
    disk_path: &str,
    disk_driver: &str,
    cloud_init_iso: Option<&str>,
) -> Result<String, machina_spec::SpecError> {
    vm.validate()?;
    let memory_kib = vm.memory_mib()? * 1024;
    let vcpus = vm.total_vcpus();
    let name = esc(&vm.metadata.name);
    let network = vm
        .spec
        .network
        .first()
        .map(|n| esc(&n.network))
        .unwrap_or_else(|| "default".into());
    let disk_path_esc = esc(disk_path);
    let disk_driver_esc = esc(disk_driver);
    let gl = esc(&vm.spec.graphics.listen);
    let firmware = vm.spec.firmware.to_ascii_lowercase();
    let is_uefi = firmware == "uefi";
    let emulator = esc(&crate::qemu::find_qemu_binary());
    let tpm_enabled = vm
        .metadata
        .labels
        .as_ref()
        .and_then(|m| m.get("tpm"))
        .is_some_and(|v| v == "true" || v == "1");

    let os_xml = if is_uefi {
        format!(
            r#"<os>
    <type arch='x86_64' machine='q35'>hvm</type>
    <loader readonly='yes' type='pflash'>/usr/share/edk2/ovmf/OVMF_CODE.fd</loader>
    <nvram template='/usr/share/edk2/ovmf/OVMF_VARS.fd'>/var/lib/libvirt/qemu/nvram/{name}_VARS.fd</nvram>
  </os>"#
        )
    } else {
        r#"<os>
    <type arch='x86_64' machine='q35'>hvm</type>
    <boot dev='hd'/>
  </os>"#
            .into()
    };

    let disk_boot = if is_uefi {
        "\n      <boot order='1'/>"
    } else {
        ""
    };

    let cloud_iso_xml = cloud_init_iso
        .filter(|p| !p.is_empty())
        .map(|iso| {
            let iso_esc = esc(iso);
            format!(
                r#"    <disk type='file' device='cdrom'>
      <driver name='qemu' type='raw'/>
      <source file='{iso_esc}'/>
      <target dev='sda' bus='sata'/>
      <readonly/>
    </disk>
"#
            )
        })
        .unwrap_or_default();

    let tpm_xml = if tpm_enabled {
        r#"    <tpm model='tpm-crb'>
      <backend type='emulator' version='2.0'/>
    </tpm>
"#
    } else {
        ""
    };

    Ok(format!(
        r#"<domain type='kvm'>
  <name>{name}</name>
  <memory unit='KiB'>{memory_kib}</memory>
  <vcpu placement='static'>{vcpus}</vcpu>
  {os_xml}
  <features>
    <acpi/>
    <apic/>
  </features>
  <clock offset='utc'/>
  <on_poweroff>destroy</on_poweroff>
  <on_reboot>restart</on_reboot>
  <on_crash>destroy</on_crash>
  <devices>
    <emulator>{emulator}</emulator>
    <disk type='file' device='disk'>
      <driver name='qemu' type='{disk_driver_esc}'/>
      <source file='{disk_path_esc}'/>
      <target dev='vda' bus='virtio'/>{disk_boot}
    </disk>
{cloud_iso_xml}    <interface type='network'>
      <source network='{network}'/>
      <model type='virtio'/>
    </interface>
    <channel type='unix'>
      <target type='virtio' name='org.qemu.guest_agent.0'/>
    </channel>
{tpm_xml}    <graphics type='vnc' port='-1' autoport='yes' listen='{gl}'/>
    <video>
      <model type='vga'/>
    </video>
    <console type='pty'/>
  </devices>
</domain>"#
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use machina_spec::VirtualMachine;

    #[test]
    fn generates_domain_xml() {
        let vm = VirtualMachine::new("demo", "1Gi");
        let xml = domain_xml_from_spec(&vm, "/var/lib/libvirt/images/demo.qcow2", "qcow2", None).unwrap();
        assert!(xml.contains("<name>demo</name>"));
        assert!(xml.contains("source network='default'"));
        assert!(xml.contains("type='qcow2'"));
    }
}
