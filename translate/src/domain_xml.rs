use machina_spec::VirtualMachine;

fn esc(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('\'', "&apos;")
        .replace('"', "&quot;")
}

fn graphics_block(listen: &str, graphics_type: &str) -> String {
    let gt = graphics_type.to_ascii_lowercase();
    let want_vnc = gt == "vnc" || gt == "both";
    let want_spice = gt == "spice" || gt == "both";
    let mut lines = Vec::new();
    if want_vnc {
        lines.push(format!(
            "<graphics type='vnc' port='-1' autoport='yes' listen='{listen}'/>"
        ));
    }
    if want_spice {
        lines.push(format!(
            "<graphics type='spice' port='-1' autoport='yes' listen='{listen}'/>"
        ));
    }
    if lines.is_empty() {
        lines.push(format!(
            "<graphics type='vnc' port='-1' autoport='yes' listen='{listen}'/>"
        ));
    }
    lines.join("\n    ")
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
    let gt = vm.spec.graphics.r#type.trim();
    let graphics_xml = graphics_block(&gl, gt);
    let firmware = vm.spec.firmware.to_ascii_lowercase();
    let is_uefi = firmware == "uefi";
    let emulator = esc(&crate::qemu::find_qemu_binary());
    let tpm_enabled = vm
        .metadata
        .labels
        .as_ref()
        .and_then(|m| m.get("tpm"))
        .is_some_and(|v| v == "true" || v == "1");

    let install_iso = vm
        .metadata
        .labels
        .as_ref()
        .and_then(|m| m.get("install_iso"))
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());

    let os_xml = if is_uefi {
        // UEFI expresses boot order with per-device <boot order> (below), never
        // with <os><boot dev>. libvirt rejects a domain that mixes the two, so the
        // UEFI <os> must NOT carry <boot dev> even when an install ISO is present.
        format!(
            r#"<os>
    <type arch='x86_64' machine='q35'>hvm</type>
    <loader readonly='yes' type='pflash'>/usr/share/edk2/ovmf/OVMF_CODE.fd</loader>
    <nvram template='/usr/share/edk2/ovmf/OVMF_VARS.fd'>/var/lib/libvirt/qemu/nvram/{name}_VARS.fd</nvram>
  </os>"#
        )
    } else if install_iso.is_some() {
        r#"<os>
    <type arch='x86_64' machine='q35'>hvm</type>
    <boot dev='cdrom'/>
    <boot dev='hd'/>
  </os>"#
            .into()
    } else {
        r#"<os>
    <type arch='x86_64' machine='q35'>hvm</type>
    <boot dev='hd'/>
  </os>"#
            .into()
    };

    // UEFI boot order is per-device. When an install ISO is present the cdrom
    // takes order 1 and the root disk order 2 (install-then-boot-installed-OS);
    // otherwise the disk is the sole bootable device at order 1.
    let disk_boot = if is_uefi {
        if install_iso.is_some() {
            "\n      <boot order='2'/>"
        } else {
            "\n      <boot order='1'/>"
        }
    } else {
        ""
    };

    let install_iso_xml = install_iso
        .map(|iso| {
            let iso_esc = esc(iso);
            let cdrom_boot = if is_uefi { "\n      <boot order='1'/>" } else { "" };
            format!(
                r#"    <disk type='file' device='cdrom'>
      <driver name='qemu' type='raw'/>
      <source file='{iso_esc}'/>
      <target dev='hdc' bus='ide'/>
      <readonly/>{cdrom_boot}
    </disk>
"#
            )
        })
        .unwrap_or_default();

    let cloud_iso_xml = cloud_init_iso
        .filter(|p| !p.is_empty())
        .map(|iso| {
            let iso_esc = esc(iso);
            let target = if install_iso.is_some() { "sdb" } else { "sda" };
            format!(
                r#"    <disk type='file' device='cdrom'>
      <driver name='qemu' type='raw'/>
      <source file='{iso_esc}'/>
      <target dev='{target}' bus='sata'/>
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
{install_iso_xml}{cloud_iso_xml}    <interface type='network'>
      <source network='{network}'/>
      <model type='virtio'/>
    </interface>
    <channel type='unix'>
      <target type='virtio' name='org.qemu.guest_agent.0'/>
    </channel>
{tpm_xml}    {graphics_xml}
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
        let xml =
            domain_xml_from_spec(&vm, "/var/lib/libvirt/images/demo.qcow2", "qcow2", None).unwrap();
        assert!(xml.contains("<name>demo</name>"));
        assert!(xml.contains("source network='default'"));
        assert!(xml.contains("type='qcow2'"));
        assert!(xml.contains("type='vnc'"));
        assert!(xml.contains("type='spice'"));
    }

    #[test]
    fn install_iso_adds_cdrom_boot() {
        let mut vm = VirtualMachine::new("installer", "4Gi");
        vm.metadata.labels = Some(std::collections::HashMap::from([(
            "install_iso".into(),
            "/var/lib/libvirt/images/ubuntu.iso".into(),
        )]));
        let xml = domain_xml_from_spec(
            &vm,
            "/var/lib/libvirt/images/installer.qcow2",
            "qcow2",
            None,
        )
        .unwrap();
        assert!(xml.contains("boot dev='cdrom'"));
        assert!(xml.contains("ubuntu.iso"));
    }

    #[test]
    fn uefi_install_iso_uses_per_device_boot_not_os_boot() {
        // libvirt rejects a domain mixing <os><boot dev> with per-device
        // <boot order>. For UEFI + install ISO we must use per-device boot only.
        let mut vm = VirtualMachine::new("winst", "4Gi");
        vm.spec.firmware = "uefi".into();
        vm.metadata.labels = Some(std::collections::HashMap::from([(
            "install_iso".into(),
            "/var/lib/libvirt/images/win.iso".into(),
        )]));
        let xml =
            domain_xml_from_spec(&vm, "/var/lib/libvirt/images/winst.qcow2", "qcow2", None).unwrap();
        // No os/boot elements at all in the UEFI path.
        assert!(!xml.contains("<boot dev="), "UEFI must not emit <os><boot dev>");
        // cdrom boots first (order 1), installed disk second (order 2).
        assert!(xml.contains("<boot order='1'/>"));
        assert!(xml.contains("<boot order='2'/>"));
        assert!(xml.contains("pflash")); // still UEFI
    }
}
