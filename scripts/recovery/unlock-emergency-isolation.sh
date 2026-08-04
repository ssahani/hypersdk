#!/usr/bin/env bash
# Emergency recovery after Zeus EmergencyIsolation lockdown blocked SSH/API.
# Run from the host console / IPMI / provider VNC as root (or via sudo).
#
# Ubuntu typically has NO firewalld — prefer UFW, then iptables/nft.
set -euo pipefail

echo "== Zeus lockdown recovery (Ubuntu / no-firewalld) =="

# --- UFW (default on Ubuntu when present) ---
if command -v ufw >/dev/null 2>&1; then
  echo "UFW detected — disabling deny-all Emergency Isolation..."
  # Fastest restore: turn UFW off (Machina ports were often never allow-listed).
  ufw --force disable || true
  ufw default allow incoming || true
  ufw default allow outgoing || true
  ufw allow 22/tcp || true
  ufw allow 5092/tcp || true
  ufw allow 5093/tcp || true
  ufw allow 50051/tcp || true
  ufw status verbose || true
fi

# --- iptables (backend when UFW/firewalld absent) ---
if command -v iptables >/dev/null 2>&1; then
  echo "Resetting iptables INPUT/OUTPUT policies to ACCEPT..."
  iptables -P INPUT ACCEPT || true
  iptables -P FORWARD ACCEPT || true
  iptables -P OUTPUT ACCEPT || true
  # Drop EmergencyIsolation ACCEPT-from-CIDR / DROP residue on INPUT.
  # Keep established so we do not brick a live console session mid-flush.
  iptables -F INPUT 2>/dev/null || true
  iptables -F OUTPUT 2>/dev/null || true
  iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT 2>/dev/null \
    || iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT 2>/dev/null \
    || true
  iptables -A INPUT -i lo -j ACCEPT 2>/dev/null || true
  iptables -A INPUT -p tcp --dport 22 -j ACCEPT 2>/dev/null || true
  iptables -A INPUT -p tcp --dport 5092 -j ACCEPT 2>/dev/null || true
  iptables -A INPUT -p tcp --dport 5093 -j ACCEPT 2>/dev/null || true
  iptables -A INPUT -p tcp --dport 50051 -j ACCEPT 2>/dev/null || true
  echo "iptables -L -n (head):"
  iptables -L INPUT -n | head -20 || true
fi

# --- nftables ---
if command -v nft >/dev/null 2>&1; then
  if nft list ruleset 2>/dev/null | grep -qE 'drop|reject|Emergency|zeus'; then
    echo "nftables has restrictive rules — flushing filter table (emergency)..."
    nft flush table inet filter 2>/dev/null || nft flush ruleset 2>/dev/null || true
  else
    echo "nftables present — inspect with: nft list ruleset"
  fi
fi

# --- firewalld (RHEL/Fedora only; skip on Ubuntu) ---
if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld 2>/dev/null; then
  echo "firewalld active — restoring public zone + Machina ports..."
  firewall-cmd --set-default-zone=public || true
  firewall-cmd --permanent --set-default-zone=public || true
  for p in 22 5092 5093 50051; do
    firewall-cmd --add-port=${p}/tcp --permanent || true
    firewall-cmd --add-port=${p}/tcp || true
  done
  firewall-cmd --reload || true
fi

echo "Restarting Machina services..."
systemctl restart machina-agent machina-controller machina-daemon 2>/dev/null || true
sleep 2
systemctl is-active machina-daemon machina-controller machina-agent 2>/dev/null || true

echo "Listening ports:"
ss -lntp 2>/dev/null | grep -E ':22|:5092|:5093|:50051' \
  || netstat -lntp 2>/dev/null | grep -E ':22|:5092' \
  || true

echo "Done. From your laptop: curl -sk https://HOST:5092/ and ssh USER@HOST"
