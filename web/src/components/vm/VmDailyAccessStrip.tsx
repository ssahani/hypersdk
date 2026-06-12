// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

import VmConnectHub, { type VmConnectHubProps } from './VmConnectHub'

/** @deprecated Use VmConnectHub — kept for backward-compatible imports. */
export type VmDailyAccessStripProps = VmConnectHubProps

export default function VmDailyAccessStrip(props: VmConnectHubProps) {
  return <VmConnectHub {...props} natExpanded={props.natExpanded ?? false} />
}
