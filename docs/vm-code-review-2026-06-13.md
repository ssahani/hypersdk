# VM stack code review — 2026-06-13

## Summary

- **P0:** 2 found, 2 fixed
- **P1:** 3 found, 3 fixed
- **P2:** 5 found, 5 fixed
- **P3:** 4 documented (deferred)

---

## P0 — Correctness / security (fixed)

| Finding | Fix | Test |
|---------|-----|------|
| `virt-xml` add/remove graphics passed `--edit` with `--add-device` / `--remove-device` (SPICE add failed) | [`core/src/libvirt/graphics_convert.rs`](../core/src/libvirt/graphics_convert.rs) — explicit `VirtXmlAction` enum; edit mode only for `--convert-to-vnc` | 4 unit tests in `graphics_convert::tests` |
| `PlatformVmDetail` called `useVmHardware` / `useKubevirtHardware` after `if (!id) return null` (Rules of Hooks violation) | Moved hooks above early return in [`web/src/pages/platform/PlatformVmDetail.tsx`](../web/src/pages/platform/PlatformVmDetail.tsx) | `npm run build` |

---

## P1 — User-visible / API (fixed)

| Finding | Fix | Test |
|---------|-----|------|
| Duplicate hardware API burst when opening Cinema from VM detail (detail + cockpit each fetch 6 endpoints) | 10s module cache in [`useVmHardware.ts`](../web/src/hooks/useVmHardware.ts) / [`useKubevirtHardware.ts`](../web/src/hooks/useKubevirtHardware.ts); `refresh(true)` busts cache after edits | Manual / e2e consolehub |
| `parity.summary` used fragile string `contains("type='spice'")` on raw XML | [`domain_has_spice_graphics()`](../core/src/libvirt/graphics_convert.rs) + agent invoke uses structured parser | Unit test `domain_has_spice_graphics_detects_spice` |
| Hooks surfaced raw errors via `String(e)` | `formatUserError()` in hardware hooks | Build |

---

## P2 — Duplication / maintainability (fixed)

| Finding | Fix |
|---------|-----|
| `vm_agent_row_libvirt` duplicated in `vms.rs` and `vm_libvirt.rs` | Shared [`controller/src/api/vm_row.rs`](../controller/src/api/vm_row.rs) with `require_libvirt_inventory()` |
| Port-forward expose logic copied in 8+ components | [`exposeGuestPortOnVm()`](../web/src/utils/vmPortForwardServices.ts) + `takenHostPorts()` |
| Post-mutation hardware stale in drawers | `refresh(true)` after edit/attach/graphics changes |
| Kubevirt guard logic scattered | Centralized in `vm_row::require_libvirt_inventory()` for libvirt agent paths |
| No regression guard for virt-xml CLI modes | `virt_xml_argv()` helper + unit tests |

---

## P3 — Deferred (documented, not in this pass)

| Item | Rationale |
|------|-----------|
| Split `vms.rs` (~2.8k LOC), `extras.rs` (~2.6k LOC), `VMDetails.tsx` (~3.4k LOC) | Large refactor; high merge conflict risk |
| Remove daemon legacy REST duplicate of controller/agent paths | Needs migration plan and customer audit |
| Classic `VMDetails.tsx` hardware drawer parity | Platform path is primary; classic uses inline panels |
| KubeVirt hardware edit (patch VM spec) | Explicitly deferred in hardware roadmap |

---

## Verified OK

- **PCI/USB hostdev attach/detach** — libvirt `attach_device_flags` / `detach_device_flags` with correct `AFFECT_CONFIG` / live flags ([`hostdev_pci.rs`](../core/src/libvirt/hostdev_pci.rs), [`extras.rs`](../core/src/libvirt/extras.rs))
- **`virt-install` create path** — single coherent argv per invocation; secondary graphics uses fixed `virt_xml_add_graphics`
- **`virsh` subprocesses** — read-only or single-purpose; no conflicting action flags found
- **Disk attach path validation** — canonicalize + absolute path checks in [`device.rs`](../core/src/libvirt/device.rs)
- **Controller libvirt invoke gateway** — kubevirt rejection at `vm_row` before agent RPC
- **ConsoleHub plan/session** — separate from hardware mutations; no virt-xml in console path
- **E2e coverage** — `platform-consolehub.spec.ts` 26/26 after changes

---

## Files changed (this review)

**Backend:** `core/src/libvirt/graphics_convert.rs`, `agent/src/libvirt_invoke.rs`, `controller/src/api/vm_row.rs`, `controller/src/api/vm_libvirt.rs`, `controller/src/api/vms.rs`, `controller/src/api/mod.rs`

**Frontend:** `web/src/hooks/useVmHardware.ts`, `web/src/hooks/useKubevirtHardware.ts`, `web/src/pages/platform/PlatformVmDetail.tsx`, `web/src/utils/vmPortForwardServices.ts`, `web/src/components/vm/VmHardwareDrawer.tsx`, `web/src/components/vm/VmEditHardwareDrawer.tsx`, `web/src/components/consolehub/MachineCockpit.tsx`, `web/src/components/consolehub/GuestAccessBanner.tsx`, `web/src/components/consolehub/AccessNotePill.tsx`, `web/src/components/vm/VmSshConnectDialog.tsx`, `web/src/components/vm/VmLaptopAccessChecklist.tsx`, `web/src/components/vm/VmConnectHub.tsx`

---

## Verification run

```bash
cargo test -p machina-core graphics_convert   # 4/4
cargo check -p machina-core -p machina-controller -p machina-agent
cd web && npm run build
cd web && npx playwright test e2e/platform-consolehub.spec.ts   # 26/26
```
