# Machina operator runbook

## Install / upgrade

```bash
tar xzf machina-*-linux-amd64.tar.gz && cd machina-*-linux-amd64
sudo ./install-everything.sh
# or from source tree:
sudo ./install.sh --bind 0.0.0.0 --open-firewall
```

Upgrade: rsync new tarball or `deploy-remote.sh`, then `sudo systemctl restart machina-daemon`.

## Health checks

```bash
curl -sk https://127.0.0.1:5092/api/v1/health
sudo systemctl status machina-daemon libvirtd
sudo journalctl -u machina-daemon -f
```

## Backup

Use **Backups** in the UI or `machinactl` / API `POST /api/v1/backups`. Verify checksums with `POST /backups/{id}/verify`.

## Restore

Follow backup README on the host under `/var/lib/machina/backups/<timestamp>/`.

## Remote access not working

1. `ss -tlnp | grep 5092` — must show `0.0.0.0:5092`
2. `grep '^host' /etc/machina/config.toml` — should be `0.0.0.0` for LAN/WAN
3. Firewall: `sudo iptables -L INPUT -n | grep 5092` or `firewall-cmd --list-ports`
4. Re-run: `sudo ./install.sh --bind 0.0.0.0 --open-firewall`

## Package for customers

```bash
./scripts/package-binary-remote.sh BUILD_HOST USER --from-deploy --fetch
```

Hand off `dist/machina-*-linux-amd64.tar.gz` + `.sha256`.

## LDAP

See [ldap-auth.md](ldap-auth.md). Map AD groups with `admin_group_substrings` / `operator_group_substrings`.

## Fleet

See [fleet-ha.md](fleet-ha.md).

## Compliance

See [compliance-hardening.md](compliance-hardening.md).
