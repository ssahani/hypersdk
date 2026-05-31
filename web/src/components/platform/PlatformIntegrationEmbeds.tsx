// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { Link } from 'react-router'
import { Cloud, Container } from 'lucide-react'
import { MacGlassPanel } from './mac/PlatformMacUi'
import { useOpenStackConnection } from '../../hooks/useOpenStackConnection'
import { usePlatformInfo } from '../../contexts/PlatformInfoContext'

export default function PlatformIntegrationEmbeds() {
  const { info } = usePlatformInfo()
  const openstack = useOpenStackConnection()
  const k8sEnabled = Boolean(info?.kubevirt?.exec_enabled)

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <MacGlassPanel title="OpenStack preview">
        <div className="flex items-start gap-3">
          <Cloud className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-300">
              {openstack.phase === 'live'
                ? 'Cloud operator shell is healthy — browse instances, networks, and Heat stacks.'
                : openstack.phase === 'needsWire'
                  ? 'OpenStack is enabled but needs wiring — run the wire script from Integrations.'
                  : openstack.phase === 'unreachable'
                    ? 'Configured but API unreachable — check clouds.yaml and Keystone.'
                    : 'Enable OpenStack in daemon config to unlock the operator shell.'}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Link to="/openstack/overview" className="tahoe-btn-ghost text-xs">Open overview</Link>
              {openstack.phase === 'live' && (
                <Link to="/openstack/instances" className="tahoe-btn-primary text-xs">Instances</Link>
              )}
            </div>
          </div>
        </div>
      </MacGlassPanel>
      <MacGlassPanel title="Kubernetes preview">
        <div className="flex items-start gap-3">
          <Container className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-300">
              {k8sEnabled
                ? 'KubeVirt and cluster workloads live in the K8s shell — inventory, Helm, and VM exec.'
                : 'Enable Kubernetes / KubeVirt in daemon config to unlock cluster operations.'}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Link to="/k8s" className="tahoe-btn-ghost text-xs">Cluster overview</Link>
              {k8sEnabled && <Link to="/k8s/workloads" className="tahoe-btn-primary text-xs">Workloads</Link>}
            </div>
          </div>
        </div>
      </MacGlassPanel>
    </div>
  )
}
