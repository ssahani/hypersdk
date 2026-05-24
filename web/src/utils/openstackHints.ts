export const WIRE_SCRIPT =
  'sudo /usr/local/share/machina/scripts/openstack-wire-cloud.sh /root/keystonerc_admin packstack\nsudo systemctl restart machina-daemon'

export const VERIFY_COMMANDS =
  'source /root/keystonerc_admin && openstack token issue\nopenstack server list'

export function openStackErrorHints(error: string | undefined): string[] {
  const e = (error || '').toLowerCase()
  const hints: string[] = []
  if (e.includes('connection refused') || e.includes('failed to establish')) {
    hints.push('Keystone/Nova may not be running — install or start Packstack/RDO on this host.')
    hints.push('Verify: curl -s http://127.0.0.1:5000/v3 or openstack token issue as admin.')
  }
  if (e.includes('401') || e.includes('unauthorized') || e.includes('authentication')) {
    hints.push('Check /etc/openstack/clouds.yaml credentials match your keystonerc_admin.')
    hints.push('Re-run the wire script after updating /root/keystonerc_admin.')
  }
  if (e.includes('timeout') || e.includes('timed out')) {
    hints.push('Increase connect_timeout_secs in /etc/machina/config.toml or fix firewall to port 5000.')
  }
  if (hints.length === 0) {
    hints.push('On the host: source /root/keystonerc_admin && openstack token issue')
    hints.push('Then: sudo systemctl restart machina-daemon and Test connection in Settings.')
  }
  return hints
}
