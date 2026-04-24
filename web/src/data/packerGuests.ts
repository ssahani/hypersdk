/**
 * Packer / golden-image metadata: machina's `contrib/packer/build-linux-image.sh`
 * plus cross-reference to kubernetes-sigs/image-builder platform names.
 *
 * @see https://github.com/kubernetes-sigs/image-builder
 * @see https://github.com/kubernetes-sigs/image-builder/blob/main/images/capi/Makefile
 */

export type PackerGuestFamily = 'rpm' | 'debian' | 'ubuntu'

export interface MachinaPackerScriptGuest {
  /** First argument to `build-linux-image.sh` */
  id: string
  label: string
  family: PackerGuestFamily
  /** Closest `PLATFORMS_AND_VERSIONS` / provider build name matches from image-builder Makefile */
  imageBuilderTargets: readonly string[]
  /** Suggested `virt-install --os-variant` when cloning this golden on Create VM */
  osVariantHint: string
  defaultLoginUser: 'root' | 'packer'
  notes?: string
}

/**
 * Linux-only ids from image-builder `PLATFORMS_AND_VERSIONS` (Makefile excludes provider prefix).
 * Windows targets are listed separately in the UI.
 */
export const IMAGE_BUILDER_PLATFORMS_AND_VERSIONS_LINUX = [
  'photon-4',
  'photon-5',
  'rhel-9',
  'rockylinux-9',
  'almalinux-9',
  'ubuntu-2204',
  'ubuntu-2204-efi',
  'ubuntu-2404',
  'ubuntu-2404-efi',
  'flatcar',
] as const

/** Sample Linux entries from `QEMU_BUILD_NAMES` / `RAW_BUILD_NAMES` in the same Makefile. */
export const IMAGE_BUILDER_QEMU_RAW_LINUX_EXAMPLES =
  'qemu-ubuntu-2204, qemu-ubuntu-2204-cloudimg, qemu-ubuntu-2204-efi, qemu-ubuntu-2404, qemu-ubuntu-2404-efi, qemu-centos-9, qemu-rhel-9, qemu-rockylinux-9, qemu-rockylinux-9-cloudimg, qemu-flatcar, kubevirt-qemu-*, raw-ubuntu-2204, raw-ubuntu-2404, raw-flatcar, raw-rhel-9, raw-rhel-9-efi'

/** Other Linux-related build name groups (abbreviated; see Makefile for full lists). */
export const IMAGE_BUILDER_OTHER_LINUX_BUILD_GROUPS =
  'AMI: ami-amazon-2, ami-amazon-2023, ami-ubuntu-2204, ami-ubuntu-2404, ami-flatcar, ami-flatcar-arm64 — OCI: oci-ubuntu-2204, oci-oracle-linux-9 — OpenStack/Hcloud/Nutanix/Proxmox/… variants of Ubuntu, Rocky, Flatcar, RHEL.'

export const IMAGE_BUILDER_REPO_URL = 'https://github.com/kubernetes-sigs/image-builder'

/** Guests implemented by `contrib/packer/build-linux-image.sh` today. */
export const MACHINA_PACKER_SCRIPT_GUESTS: readonly MachinaPackerScriptGuest[] = [
  {
    id: 'fedora43',
    label: 'Fedora 43',
    family: 'rpm',
    imageBuilderTargets: [],
    osVariantHint: 'fedora43',
    defaultLoginUser: 'packer',
    notes: 'Server netinst: GRUB “e” boot line + kickstart; Packer uses SSH user packer (not root).',
  },
  {
    id: 'ubuntu2204',
    label: 'Ubuntu 22.04 LTS',
    family: 'ubuntu',
    imageBuilderTargets: [
      'ubuntu-2204',
      'ubuntu-2204-efi',
      'qemu-ubuntu-2204',
      'qemu-ubuntu-2204-efi',
      'qemu-ubuntu-2204-cloudimg',
      'raw-ubuntu-2204',
      'raw-ubuntu-2204-efi',
    ],
    osVariantHint: 'ubuntu22.04',
    defaultLoginUser: 'packer',
  },
  {
    id: 'ubuntu2404',
    label: 'Ubuntu 24.04 LTS',
    family: 'ubuntu',
    imageBuilderTargets: [
      'ubuntu-2404',
      'ubuntu-2404-efi',
      'qemu-ubuntu-2404',
      'qemu-ubuntu-2404-efi',
      'raw-ubuntu-2404',
      'raw-ubuntu-2404-efi',
    ],
    osVariantHint: 'ubuntu24.04',
    defaultLoginUser: 'packer',
  },
  {
    id: 'ubuntu2504',
    label: 'Ubuntu 25.04',
    family: 'ubuntu',
    imageBuilderTargets: [],
    osVariantHint: 'ubuntu25.04',
    defaultLoginUser: 'packer',
    notes: 'Interim release; add matching image-builder ids when upstream publishes them.',
  },
  {
    id: 'ubuntu2510',
    label: 'Ubuntu 25.10',
    family: 'ubuntu',
    imageBuilderTargets: [],
    osVariantHint: 'ubuntu25.10',
    defaultLoginUser: 'packer',
    notes: 'Interim release; same autoinstall path as other live-server builds.',
  },
  {
    id: 'ubuntu2604',
    label: 'Ubuntu 26.04 LTS',
    family: 'ubuntu',
    imageBuilderTargets: [],
    osVariantHint: 'ubuntu26.04',
    defaultLoginUser: 'packer',
    notes: 'LTS when available on releases.ubuntu.com; verify `virt-install --os-variant` on your libvirt/osinfo-db.',
  },
  {
    id: 'debian12',
    label: 'Debian 12 (minimal)',
    family: 'debian',
    imageBuilderTargets: [],
    osVariantHint: 'debian12',
    defaultLoginUser: 'packer',
    notes: 'Small preseed image; Debian is not in image-builder `PLATFORMS_AND_VERSIONS` but is a typical KVM guest.',
  },
  {
    id: 'debian13',
    label: 'Debian 13 (minimal)',
    family: 'debian',
    imageBuilderTargets: [],
    osVariantHint: 'debian13',
    defaultLoginUser: 'packer',
    notes: 'Netinst pin (e.g. 13.4.0); bump ISO filename in the script when `current` moves to a new point release.',
  },
  {
    id: 'almalinux9',
    label: 'AlmaLinux 9',
    family: 'rpm',
    imageBuilderTargets: ['almalinux-9', 'node-ova-local-almalinux-9'],
    osVariantHint: 'almalinux9',
    defaultLoginUser: 'root',
  },
  {
    id: 'rocky9',
    label: 'Rocky Linux 9',
    family: 'rpm',
    imageBuilderTargets: [
      'rockylinux-9',
      'node-ova-local-rockylinux-9',
      'qemu-rockylinux-9',
      'qemu-rockylinux-9-cloudimg',
      'openstack-rockylinux-9',
      'nutanix-rockylinux-9',
      'hcloud-rockylinux-9',
      'proxmox-rockylinux-9',
      'scaleway-rockylinux-9',
    ],
    osVariantHint: 'rocky9',
    defaultLoginUser: 'root',
  },
  {
    id: 'centos9stream',
    label: 'CentOS Stream 9',
    family: 'rpm',
    imageBuilderTargets: ['qemu-centos-9', 'powervs-centos-9'],
    osVariantHint: 'centos-stream9',
    defaultLoginUser: 'root',
  },
  {
    id: 'oraclelinux9',
    label: 'Oracle Linux 9',
    family: 'rpm',
    imageBuilderTargets: ['oci-oracle-linux-9'],
    osVariantHint: 'oraclelinux9',
    defaultLoginUser: 'root',
  },
] as const
