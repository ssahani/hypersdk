// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import { useState } from 'react'
import { Link } from 'react-router'
import PageLayout from '../../components/PageLayout'
import PlatformPageChrome from '../../components/platform/PlatformPageChrome'
import { validateCloudInit } from '../../api/platformCloudInit'
import { formatUserError } from '../../utils/apiError'
import { hubLinkClasses, statusToneClass } from '../../utils/semanticColors'

const DEFAULT_YAML = `#cloud-config
hostname: my-vm
users:
  - name: ubuntu
    sudo: ALL=(ALL) NOPASSWD:ALL
    ssh_authorized_keys:
      - ssh-ed25519 AAAA... user@host
packages:
  - qemu-guest-agent
`

export default function CloudInitStudio() {
  const [yaml, setYaml] = useState(DEFAULT_YAML)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ valid: boolean; issues: string[]; preview_hostname?: string | null } | null>(null)

  const validate = async () => {
    setBusy(true)
    try {
      setResult(await validateCloudInit(yaml))
    } catch (e: unknown) {
      setResult({ valid: false, issues: [formatUserError(e)] })
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageLayout compact title="Cloud-Init Studio" subtitle="Edit and validate #cloud-config before deploy">
      <PlatformPageChrome>
        <p className="text-sm text-slate-400 mb-4">
          Maps to Machina <code className="text-xs">CloudInitSpec</code> on VM create. Use{' '}
          <Link to="/platform/templates" className={hubLinkClasses()}>Templates</Link> to deploy with this payload.
        </p>
        <textarea
          className="input w-full font-mono text-xs min-h-[320px]"
          value={yaml}
          onChange={(e) => setYaml(e.target.value)}
          spellCheck={false}
        />
        <div className="flex flex-wrap gap-2 mt-3">
          <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void validate()}>
            {busy ? 'Validating…' : 'Validate'}
          </button>
          <button type="button" className="btn-secondary text-sm" onClick={() => void navigator.clipboard.writeText(yaml)}>
            Copy YAML
          </button>
        </div>
        {result && (
          <div className={`mt-4 rounded-xl border p-4 text-sm ${result.valid ? 'border-emerald-500/30' : 'border-amber-500/30'}`}>
            <p className={result.valid ? statusToneClass('ok') : statusToneClass('warn')}>
              {result.valid ? 'Valid cloud-config' : 'Validation issues'}
            </p>
            {result.preview_hostname && <p className="text-xs text-slate-400 mt-1">Hostname: {result.preview_hostname}</p>}
            {result.issues.length > 0 && (
              <ul className="mt-2 text-xs text-slate-300 list-disc pl-4">
                {result.issues.map((i) => <li key={i}>{i}</li>)}
              </ul>
            )}
          </div>
        )}
      </PlatformPageChrome>
    </PageLayout>
  )
}
