import { deleteVM, type VmDeleteUndefineOpts } from '../api/vm'

/**
 * Deletes a VM via the API. If libvirt rejects undefine without NVRAM (same as
 * `virsh undefine --nvram`), retries once with `undefine_nvram: true`.
 * Other undefine flags are preserved on retry.
 *
 * @param onBeforeNvramRetry — Optional hook (e.g. UI state + toast) before the retry request.
 */
export async function deleteVmWithNvramRetry(
  name: string,
  opts?: VmDeleteUndefineOpts,
  onBeforeNvramRetry?: (merged: VmDeleteUndefineOpts) => void,
): Promise<void> {
  try {
    await deleteVM(name, opts)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    const m = msg.toLowerCase()
    // Libvirt: "cannot undefine domain with nvram" — require both tokens to avoid unrelated "nvram" text.
    const looksLikeNvramUndefineConflict =
      m.includes('nvram') && (m.includes('undefine') || m.includes('cannot remove domain'))
    if (looksLikeNvramUndefineConflict && !opts?.undefine_nvram) {
      const merged: VmDeleteUndefineOpts = { ...opts, undefine_nvram: true }
      onBeforeNvramRetry?.(merged)
      await deleteVM(name, merged)
      return
    }
    throw e
  }
}
