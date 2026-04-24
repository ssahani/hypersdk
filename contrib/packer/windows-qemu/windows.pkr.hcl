packer {
  required_plugins {
    qemu = {
      source  = "github.com/hashicorp/qemu"
      version = ">= 1.1.4"
    }
  }
}

source "qemu" "windows" {
  qemu_binary = "/usr/libexec/qemu-kvm"
  headless    = true

  iso_url      = "WinServer.iso"
  iso_checksum = "none"

  output_directory = "output-windows"
  vm_name          = "windows.qcow2"
  format           = "qcow2"

  disk_size = "51200"
  memory    = 4096
  cpus      = 2

  accelerator    = "kvm"
  disk_interface = "ide"

  communicator   = "winrm"
  winrm_username = "Administrator"
  winrm_password = "Password123!"
  winrm_timeout  = "3h"

  floppy_files = [
    "Autounattend.xml",
    "scripts/enable-winrm.ps1",
    "scripts/install-virtio.ps1"
  ]

  qemuargs = [
    ["-drive", "file=virtio-win.iso,media=cdrom,index=3"]
  ]

  shutdown_command = "shutdown /s /t 10 /f"
}

build {
  sources = ["source.qemu.windows"]

  provisioner "powershell" {
    scripts = [
      "scripts/install-virtio.ps1"
    ]
  }
}
