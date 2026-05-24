import { ReactNode } from 'react'
import { usePlatformInfo } from '../contexts/PlatformInfoContext'
import { isOpenStackNavEnabled } from '../utils/routes'
import OpenStackSetupPanel from './OpenStackSetupPanel'

/** Renders children only when OpenStack is enabled + configured; otherwise setup instructions. */
export default function OpenStackGate({
  children,
  title,
}: {
  children: ReactNode
  title?: string
}) {
  const { info, loading } = usePlatformInfo()
  const ready = isOpenStackNavEnabled(info?.openstack)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="space-y-6 animate-fade-in">
        {title && (
          <h1 className="text-2xl font-semibold text-slate-100">{title}</h1>
        )}
        <OpenStackSetupPanel />
      </div>
    )
  }

  return <>{children}</>
}
