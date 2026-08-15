# Sprites

## Purpose

Instant, disposable sandbox VMs — boot on libvirt/QEMU, Cloud Hypervisor, or Firecracker, TTL-reaped automatically, no persistent state.

## When to use it

- Open this page when the job matches the purpose above
- Use Mission Control (`/platform`) for fleet-wide work; use Core routes for this host only
- Confirm PAM/OIDC login and roles if actions are missing

## How to get there

- Route: `/sprites`
- Nav: **Core → Sprites** (or spotlight / Finder search)

## What you can do

1. **New Sprite** — pick a golden image (from the daemon's
   `/var/lib/machina/sprite-images` registry), size it (vCPUs, memory), set
   a TTL, and choose a backend: **Libvirt** (default, instant COW clone),
   **Cloud Hypervisor** (a direct child process of the daemon, no libvirtd
   in the path — boots off a full disk copy instead, so first boot is
   slower), or **Firecracker** (also a direct child process — converts the
   golden image to a raw root filesystem on every boot, so first boot is
   the slowest of the three, but the resulting microVM has the smallest
   footprint).
2. **Network egress** (optional, off by default) — attaches the sprite to
   the host's existing "default" NAT network for outbound internet access.
   Sprites stay vsock-only otherwise. Shares that network's posture with
   any regular VM on the host — there's no per-sprite isolation or domain
   allow-list.
3. The list shows state, backend, vsock CID, network status, and a live
   expiry countdown. **Delete** tears a sprite down immediately instead of
   waiting for its TTL; a background reaper does the same automatically
   once the TTL passes.
4. From the command line: `machinactl sprite <list|get|create|delete|golden-images>`
   gives the same operations (set `MACHINA_API_TOKEN` for create/delete).

If the page stays empty, check daemon health (`/api/v1/health`) and
libvirt connectivity. An empty golden-image picker means no `.qcow2` files
are present under `/var/lib/machina/sprite-images` yet.

## Related pages

- [Getting Started](../../getting-started.md)
- [Dashboard](../core/home.md)
- [Mission Control](../platform/platform.md)
- [Page index](../../PAGE_INDEX.md)
