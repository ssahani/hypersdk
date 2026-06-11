// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

export interface GuestAccessHints {
  auth_mode: string
  serial_password_login: boolean
  guest_ip_private: boolean
  ssh_nat_host_port?: number | null
}

export function consoleAccessHints(
  hints: GuestAccessHints | null | undefined,
  lens: 'serial' | 'shell' | 'display' | string,
  opts: { sshUser?: string; guestIp?: string; hypervisorHost?: string; vmNetworkHref?: string },
): string[] {
  if (!hints) return []
  const out: string[] = []
  const user = opts.sshUser?.trim() || 'ubuntu'
  const host = opts.hypervisorHost?.trim() || 'HYPERVISOR_IP'
  const networkLink = opts.vmNetworkHref ? ` Open ${opts.vmNetworkHref} to expose SSH.` : ' Expose SSH in VM → Network → Hypervisor NAT.'

  if (lens === 'serial' && hints.auth_mode === 'ssh_key') {
    out.push(
      `Serial shows a login prompt, but this VM is SSH-key only — no password was configured at create time. Use Shell in ConsoleHub, or expose SSH and connect with your private key.`,
    )
  }

  if ((lens === 'shell' || lens === 'serial') && hints.guest_ip_private) {
    if (hints.ssh_nat_host_port) {
      out.push(
        `Guest IP ${opts.guestIp ?? '192.168.122.x'} is hypervisor NAT only — not reachable from your laptop. Use: ssh -p ${hints.ssh_nat_host_port} ${user}@${host}`,
      )
    } else {
      out.push(
        `Guest IP ${opts.guestIp ?? '192.168.122.x'} is on hypervisor NAT and is not reachable from your laptop.${networkLink} Then: ssh -p 2222 ${user}@${host}`,
      )
    }
  }

  if (lens === 'shell' && hints.auth_mode === 'ssh_key') {
    out.push(
      'In-browser Shell uses the hypervisor’s SSH keys. If login fails, expose SSH and connect from your laptop with the private key that matches the VM’s injected public key.',
    )
  }

  return out
}
