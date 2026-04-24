import type { SnapshotInfo } from '../api/snapshot'

export type SnapshotTreeNode = { snap: SnapshotInfo; children: SnapshotTreeNode[] }

/** Build a forest from libvirt `parent` links (flat list → tree for UI). */
export function snapshotForest(snaps: SnapshotInfo[]): SnapshotTreeNode[] {
  const m = new Map<string, SnapshotTreeNode>()
  for (const s of snaps) {
    m.set(s.name, { snap: s, children: [] })
  }
  const roots: SnapshotTreeNode[] = []
  for (const s of snaps) {
    const n = m.get(s.name)!
    const p = s.parent?.trim()
    if (p && m.has(p)) {
      m.get(p)!.children.push(n)
    } else {
      roots.push(n)
    }
  }
  return roots
}
