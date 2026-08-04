#!/usr/bin/env bash
# Emergency recovery after Zeus EmergencyIsolation lockdown blocked SSH/API.
# Run from the host console / IPMI / provider VNC as root (or via sudo).
set -euo pipefail

echo "== Zeus lockdown recovery =="

if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active --quiet firewalld; then
  echo "Restoring firewalld default zone to public..."
  firewall-cmd --set-default-zone=public || true
  firewall-cmd --permanent --set-default-zone=public || true
  firewall-cmd --reload || true
  firewall-cmd --get-default-zone || true
fi

if command -v ufw >/dev/null 2>&1; then
  echo "Ensuring UFW allows SSH and Machina ports..."
  ufw allow 22/tcp || true
  ufw allow 5092/tcp || true
  ufw allow 5093/tcp || true
  ufw status || true
fi

if command -v nft >/dev/null 2>&1; then
  echo "nftables present — if still locked, inspect: nft list ruleset"
fi

echo "Opening Machina ports via firewalld (if present)..."
if command -v firewall-cmd >/dev/null 2>&1; then
  for p in 22 5092 5093 50051; do
    firewall-cmd --add-port=${p}/tcp --permanent || true
    firewall-cmd --add-port=${p}/tcp || true
  done
  firewall-cmd --reload || true
fi

echo "Restarting Machina services..."
systemctl restart machina-agent machina-controller machina-daemon || true
sleep 2
systemctl is-active machina-daemon machina-controller machina-agent || true

echo "Listening ports:"
ss -lntp | grep -E ':22|:5092|:5093|:50051' || netstat -lntp 2>/dev/null | grep -E ':22|:5092' || true

echo "Done. From your laptop: curl -sk https://HOST:5092/ and ssh USER@HOST"
