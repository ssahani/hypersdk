// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

export type GuestFileTransferPlan = {
  fileName: string
  destPath?: string
  sshUser?: string
  hypervisorHost?: string
  sshNatHostPort?: number | null
  guestIp?: string | null
  guestIpPrivate?: boolean
}

export type GuestFileTransferCommand = {
  command: string
  summary: string
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

/** Build an scp one-liner to copy a laptop file into the guest (via NAT or direct guest IP). */
export function buildGuestScpCommand(plan: GuestFileTransferPlan): GuestFileTransferCommand | null {
  const fileName = plan.fileName.trim()
  if (!fileName) return null
  const user = plan.sshUser?.trim() || 'ubuntu'
  const dest = shellQuote(plan.destPath?.trim() || `/tmp/${fileName}`)
  const local = shellQuote(`./${fileName}`)

  if (plan.guestIpPrivate) {
    const host = plan.hypervisorHost?.trim()
    const port = plan.sshNatHostPort
    if (!host || !port) return null
    return {
      command: `scp -P ${port} ${local} ${user}@${host}:${dest}`,
      summary: 'Copy via hypervisor NAT SSH port into the guest',
    }
  }

  const guest = plan.guestIp?.trim()
  if (guest) {
    return {
      command: `scp ${local} ${user}@${guest}:${dest}`,
      summary: 'Copy directly to the guest IP',
    }
  }

  return null
}
