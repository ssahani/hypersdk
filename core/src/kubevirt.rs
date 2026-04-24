//! Generate KubeVirt + CDI manifests to migrate a libvirt qcow2 (or raw) root disk to Kubernetes,
//! following the same layering as [hyper2kvm](https://github.com/ssahani/hyper2kvm) docs: DataVolume
//! for the root image, `VirtualMachine` with virtio disks, and a **virtio-win CDROM** via
//! `containerDisk` (cluster-pullable; analogous to attaching `virtio-win.iso` on libvirt after install).

use crate::config::KubeVirtConfig;
use crate::state::{DiskInfo, VmDetails};
use crate::LibvirtError;

/// API / UI payload: multi-doc YAML plus copy-paste hints.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct KubeVirtBundle {
    pub libvirt_vm: String,
    /// Host path to the root disk image (from libvirt domain XML).
    pub libvirt_root_disk: String,
    pub namespace: String,
    pub virtual_machine_name: String,
    pub datavolume_name: String,
    /// PVC/DataVolume upload size (Gi) used in manifests and virtctl.
    pub upload_size_gi: u32,
    /// When true, daemon may run `kubectl` / `virtctl` for this VM (`[kubevirt] exec_enabled`).
    pub cluster_exec_enabled: bool,
    /// CDI DataVolume + KubeVirt VirtualMachine, `---` separated.
    pub yaml: String,
    /// Example `virtctl image-upload` after you copy the qcow2 off the hypervisor (or from this path).
    pub virtctl_image_upload_example: String,
}

fn is_file_disk(d: &DiskInfo) -> bool {
    d.device != "cdrom"
        && d.device != "floppy"
        && !d.source.is_empty()
        && d.source != crate::UNKNOWN
}

fn pick_root_disk(details: &VmDetails) -> Result<&DiskInfo, LibvirtError> {
    let pathish = |s: &str| {
        s.ends_with(".qcow2")
            || s.ends_with(".QCOW2")
            || s.ends_with(".raw")
            || s.ends_with(".img")
    };
    for d in &details.disks {
        if is_file_disk(d) && pathish(&d.source) {
            return Ok(d);
        }
    }
    for d in &details.disks {
        if is_file_disk(d) {
            return Ok(d);
        }
    }
    Err(LibvirtError::Invalid(
        "No file-backed root disk found for KubeVirt export (need a disk volume with a file path)."
            .into(),
    ))
}

/// RFC 1123-ish label: lowercase, alphanumeric + hyphen, max 63, non-empty.
pub fn sanitize_k8s_label(s: &str) -> String {
    let lower = s.to_lowercase();
    let mut out = String::new();
    for c in lower.chars() {
        let c = if c.is_ascii_alphanumeric() { c } else { '-' };
        if c == '-' && out.ends_with('-') {
            continue;
        }
        out.push(c);
    }
    let out = out.trim_matches('-').to_string();
    if out.is_empty() {
        return "vm".to_string();
    }
    if out.len() <= 63 {
        return out;
    }
    out.chars().take(63).collect::<String>().trim_matches('-').to_string()
}

fn storage_gi_for_disk(path: &str, memory_mb: u64, padding_gi: u32) -> u32 {
    let from_file = std::fs::metadata(path).ok().map(|m| {
        let b = m.len();
        ((b + (1 << 30) - 1) / (1 << 30)) as u32
    });
    let fallback = ((memory_mb + 1023) / 1024).max(1) as u32;
    from_file.unwrap_or(fallback).saturating_add(padding_gi).max(1)
}

fn yaml_escape(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

/// Build CDI DataVolume (upload) + KubeVirt VM with virtio root + virtio-win CDROM (`containerDisk`).
pub fn kubevirt_bundle_from_libvirt_vm(
    details: &VmDetails,
    libvirt_name: &str,
    cfg: &KubeVirtConfig,
    namespace_override: Option<&str>,
    k8s_name_override: Option<&str>,
    datavolume_name_override: Option<&str>,
    storage_gi_override: Option<u32>,
    storage_class_override: Option<&str>,
    include_virtio_cdrom: bool,
) -> Result<KubeVirtBundle, LibvirtError> {
    let disk = pick_root_disk(details)?;
    let root_path = disk.source.trim();
    if !root_path.starts_with('/') {
        return Err(LibvirtError::Invalid(format!(
            "KubeVirt export needs an absolute disk path on the hypervisor, got: {root_path}"
        )));
    }

    let ns = namespace_override
        .filter(|s| !s.is_empty())
        .unwrap_or(cfg.default_namespace.as_str());
    let vm_k8s = sanitize_k8s_label(
        k8s_name_override
            .filter(|s| !s.is_empty())
            .unwrap_or(libvirt_name),
    );
    let dv_name = sanitize_k8s_label(
        datavolume_name_override
            .filter(|s| !s.is_empty())
            .unwrap_or(&format!("{vm_k8s}-root")),
    );

    let storage_gi = storage_gi_override.unwrap_or_else(|| {
        storage_gi_for_disk(root_path, details.memory_mb, cfg.datavolume_padding_gi)
    });

    let storage_class_effective = storage_class_override
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .or_else(|| {
            let d = cfg.default_storage_class.trim();
            if d.is_empty() {
                None
            } else {
                Some(d.to_string())
            }
        });
    let storage_class_line = storage_class_effective
        .map(|sc| format!("    storageClassName: \"{}\"\n", yaml_escape(&sc)))
        .unwrap_or_default();

    let cores = details.vcpus.max(1);
    let mem_gi = ((details.memory_mb + 1023) / 1024).max(1);

    let virtio_img = cfg.virtio_container_disk_image.trim();
    if virtio_img.is_empty() {
        return Err(LibvirtError::Internal(
            "kubevirt.virtio_container_disk_image is empty".into(),
        ));
    }

    let machine = cfg.machine_type.trim();
    let machine_line = if machine.is_empty() {
        "q35".to_string()
    } else {
        machine.to_string()
    };

    let mut dv = String::new();
    dv.push_str("# CDI upload DataVolume — import your libvirt qcow2/raw into the cluster PVC.\n");
    dv.push_str("# 1) virtctl image-upload (see virtctl_image_upload_example in API JSON)\n");
    dv.push_str("# 2) kubectl apply -f this file (or paste both documents)\n");
    dv.push_str("# 3) virtctl start <vm> -n namespace\n");
    dv.push_str("apiVersion: cdi.kubevirt.io/v1beta1\nkind: DataVolume\nmetadata:\n");
    dv.push_str(&format!("  name: {dv_name}\n  namespace: {ns}\n"));
    dv.push_str("  labels:\n    machina.io/source-libvirt-vm: \"");
    dv.push_str(&yaml_escape(libvirt_name));
    dv.push_str("\"\nspec:\n  source:\n    upload: {}\n  pvc:\n    accessModes:\n      - ReadWriteOnce\n    resources:\n      requests:\n");
    dv.push_str(&format!("        storage: {storage_gi}Gi\n"));
    dv.push_str(&storage_class_line);

    let mut vm = String::new();
    vm.push_str("# KubeVirt VM — virtio root disk + optional virtio-win CD (containerDisk).\n");
    vm.push_str("# virtio-win CD: same role as hyper2kvm / libvirt attaching virtio-win.iso for drivers after migration.\n");
    vm.push_str("apiVersion: kubevirt.io/v1\nkind: VirtualMachine\nmetadata:\n");
    vm.push_str(&format!("  name: {vm_k8s}\n  namespace: {ns}\n"));
    vm.push_str("  labels:\n    machina.io/source-libvirt-vm: \"");
    vm.push_str(&yaml_escape(libvirt_name));
    vm.push_str("\"\nspec:\n  runStrategy: Halted\n  template:\n    metadata:\n      labels:\n");
    vm.push_str(&format!("        kubevirt.io/vm: {vm_k8s}\n"));
    vm.push_str("    spec:\n      domain:\n        machine:\n");
    vm.push_str(&format!("          type: {machine_line}\n"));
    vm.push_str("        cpu:\n");
    vm.push_str(&format!("          cores: {cores}\n"));
    vm.push_str("        devices:\n          disks:\n            - name: rootdisk\n              disk:\n                bus: virtio\n");
    if include_virtio_cdrom {
        vm.push_str("            - name: virtiocd\n              cdrom:\n                bus: sata\n");
    }
    vm.push_str("          interfaces:\n            - name: default\n              masquerade: {}\n              model: virtio\n");
    vm.push_str("        resources:\n          requests:\n");
    vm.push_str(&format!("            memory: {mem_gi}Gi\n"));
    vm.push_str("      networks:\n        - name: default\n          pod: {}\n      volumes:\n        - name: rootdisk\n          dataVolume:\n");
    vm.push_str(&format!("            name: {dv_name}\n"));
    if include_virtio_cdrom {
        vm.push_str("        - name: virtiocd\n          containerDisk:\n            image: \"");
        vm.push_str(&yaml_escape(virtio_img));
        vm.push_str("\"\n            imagePullPolicy: IfNotPresent\n");
    }

    let yaml = format!("{}\n---\n{}", dv.trim_end(), vm.trim_end());

    let timeout_m = cfg.upload_timeout_minutes.max(1);
    let virtctl_image_upload_example = format!(
        "virtctl image-upload dv {dv_name} --size={storage_gi}Gi --image-path='{root_path}' -n {ns} --insecure --upload-image-timeout={timeout_m}m",
        dv_name = dv_name,
        storage_gi = storage_gi,
        root_path = root_path,
        ns = ns,
        timeout_m = timeout_m
    );

    Ok(KubeVirtBundle {
        libvirt_vm: libvirt_name.to_string(),
        libvirt_root_disk: root_path.to_string(),
        namespace: ns.to_string(),
        virtual_machine_name: vm_k8s,
        datavolume_name: dv_name,
        upload_size_gi: storage_gi,
        cluster_exec_enabled: cfg.exec_enabled,
        yaml,
        virtctl_image_upload_example,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_k8s_label_truncates() {
        let long = "a".repeat(80);
        let s = sanitize_k8s_label(&long);
        assert!(s.len() <= 63);
    }

    #[test]
    fn pick_disk_prefers_qcow2() {
        let d = VmDetails {
            name: "t".into(),
            uuid: "u".into(),
            state: "shutoff".into(),
            vcpus: 1,
            memory_mb: 1024,
            os_type: "hvm".into(),
            arch: "x86_64".into(),
            autostart: false,
            persistent: true,
            interfaces: vec![],
            disks: vec![
                DiskInfo {
                    device: "cdrom".into(),
                    source: "/var/lib/libvirt/images/seed.iso".into(),
                    driver: "raw".into(),
                    target: "sda".into(),
                    bus: String::new(),
                    cache: String::new(),
                    readonly: false,
                    shareable: false,
                },
                DiskInfo {
                    device: "disk".into(),
                    source: "/var/lib/libvirt/images/guest.qcow2".into(),
                    driver: "qcow2".into(),
                    target: "vda".into(),
                    bus: String::new(),
                    cache: String::new(),
                    readonly: false,
                    shareable: false,
                },
            ],
        };
        let disk = pick_root_disk(&d).unwrap();
        assert!(disk.source.ends_with(".qcow2"));
    }
}
