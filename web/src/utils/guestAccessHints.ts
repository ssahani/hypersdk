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

/** Short labels for the Cinema Access Note pill (deduped). */
export function aggregateAccessNoteLabels(
  hints: GuestAccessHints | null | undefined,
  opts: { sshUser?: string; guestIp?: string; hypervisorHost?: string },
): string[] {
  if (!hints) return []
  const labels: string[] = []
  if (hints.auth_mode === 'ssh_key') labels.push('SSH key-only')
  if (hints.guest_ip_private) labels.push('NAT guest IP')
  if (hints.auth_mode === 'ssh_key' && !hints.serial_password_login) labels.push('Serial has no password')
  if (hints.guest_ip_private && !hints.ssh_nat_host_port) labels.push('SSH not exposed')
  return [...new Set(labels)]
}

export function aggregateAccessNoteMessages(
  hints: GuestAccessHints | null | undefined,
  opts: { sshUser?: string; guestIp?: string; hypervisorHost?: string; vmNetworkHref?: string },
): string[] {
  const serial = consoleAccessHints(hints, 'serial', opts)
  const shell = consoleAccessHints(hints, 'shell', opts)
  return [...new Set([...serial, ...shell])]
}
