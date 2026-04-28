//! Host virtualization readiness (BIOS KVM, `/dev/kvm`, libvirt socket).

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct VirtualizationHostStatus {
    /// CPU exposes VMX/SVM (Intel VT-x / AMD-V) in `/proc/cpuinfo`.
    pub cpu_virt_supported: bool,
    /// `/dev/kvm` exists and is readable by the daemon user (best-effort stat).
    pub kvm_device_present: bool,
    /// `/var/run/libvirt/libvirt-sock` exists (system libvirt).
    pub libvirt_system_socket_present: bool,
    /// Session libvirt socket (path varies; common XDG location checked).
    pub libvirt_session_socket_present: bool,
    /// Hint for UI when KVM device missing.
    pub hint: &'static str,
}

fn proc_cpu_virt() -> bool {
    #[cfg(target_os = "linux")]
    {
        if let Ok(s) = std::fs::read_to_string("/proc/cpuinfo") {
            let lower = s.to_ascii_lowercase();
            return lower.contains("vmx") || lower.contains("svm");
        }
    }
    false
}

pub fn virtualization_status() -> VirtualizationHostStatus {
    let kvm = std::path::Path::new("/dev/kvm");
    let kvm_ok = kvm.exists();

    let sys_sock = std::path::Path::new("/var/run/libvirt/libvirt-sock");
    let sys_sock_ro = std::path::Path::new("/var/run/libvirt/libvirt-sock-ro");

    let session_sock_candidates = [
        format!(
            "{}/libvirt/libvirt-sock",
            std::env::var("XDG_RUNTIME_DIR").unwrap_or_else(|_| "/run/user/0".into())
        ),
        "/run/user/1000/libvirt/libvirt-sock".into(),
    ];

    let mut sess_ok = false;
    for p in &session_sock_candidates {
        if std::path::Path::new(p).exists() {
            sess_ok = true;
            break;
        }
    }

    let hint: &'static str = if !proc_cpu_virt() {
        "Hardware virtualization appears disabled or unavailable (no vmx/svm in /proc/cpuinfo). Enable VT-x/AMD-V in firmware if you need KVM guests."
    } else if !kvm_ok {
        "/dev/kvm missing — load kvm module or check permissions."
    } else if !sys_sock.exists() && !sys_sock_ro.exists() && !sess_ok {
        "Libvirt sockets not found — ensure libvirtd is running or use session URI."
    } else {
        ""
    };

    VirtualizationHostStatus {
        cpu_virt_supported: proc_cpu_virt(),
        kvm_device_present: kvm_ok,
        libvirt_system_socket_present: sys_sock.exists() || sys_sock_ro.exists(),
        libvirt_session_socket_present: sess_ok,
        hint,
    }
}
