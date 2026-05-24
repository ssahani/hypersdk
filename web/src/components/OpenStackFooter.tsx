import { ExternalLink } from 'lucide-react'
import { Link } from 'react-router'
import { usePlatformInfo } from '../contexts/PlatformInfoContext'
import { isOpenStackNavEnabled } from '../utils/routes'

/** Shared footer for OpenStack pages: disk migration + optional HyperSDK dashboard. */
export default function OpenStackFooter() {
  const { info } = usePlatformInfo()
  if (!isOpenStackNavEnabled(info?.openstack)) return null

  return (
    <footer className="rounded-xl border border-slate-700/50 bg-slate-900/30 px-4 py-3 text-xs text-slate-500 space-y-2">
      <p>
        Push qcow2 from{' '}
        <Link to="/disk-images" className="text-sky-400 hover:underline">Disk images</Link>
        . Import exported disks via{' '}
        <Link to="/import" className="text-sky-400 hover:underline">Import VM</Link>.
      </p>
      {(info?.openstack?.upload_enabled || info?.hypersdk?.enabled) && (
        <p>
          <a
            href={
              info?.openstack?.hypersdk_base_url
                ? `${info.openstack.hypersdk_base_url.replace(/\/$/, '')}/web/dashboard/`
                : info?.hypersdk?.base_url
                  ? `${info.hypersdk.base_url.replace(/\/$/, '')}/web/dashboard/`
                  : `https://${window.location.hostname}:5080/web/dashboard/`
            }
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sky-400 hover:underline"
          >
            HyperSDK dashboard — bulk export and migrations
            <ExternalLink className="w-3 h-3" />
          </a>
        </p>
      )}
    </footer>
  )
}
