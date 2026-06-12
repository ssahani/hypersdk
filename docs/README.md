# Documentation

## Client Presentations

**6 HTML+PDF presentation decks** covering business value, architecture, security, technical deep dives, and quick-start guides — organized for different audiences.

> 📊 **All presentations available as interactive HTML** (viewable in any browser) **and PDF** (printable/shareable). Download or view online: [`client-presentations/`](client-presentations/)

### Presentation Index

| # | Title | Use Case | Audience |
|---|-------|----------|----------|
| 01 | Business Value | Market value, ROI, key differentiation | C-suite, VP Infrastructure |
| 02 | Pricing & Licensing | TCO, cost comparison vs alternatives | Finance, Procurement |
| 03 | Technical Architecture | Full platform stack, Rust daemon, libvirt integration | Architects, DevOps |
| 04 | Quickstart Guide | Installation, initial setup, POC workflow | New users, solutions architects |
| 05 | Security & Compliance | PAM auth, RBAC, session management, audit trails | Security, compliance teams |
| 06 | ROI Calculator | Financial justification tool, cost-benefit analysis | Finance, project managers |

[**→ Full Presentation Library**](client-presentations/) with descriptions and generation instructions

### Feature guide PDFs (client mail)

Branded PDFs for recent platform UX and QA guides — generated from markdown, emailed to stakeholders:

```bash
./scripts/generate-feature-pdfs.sh          # docs/guides/pdf/*.pdf
./scripts/mail-feature-pdfs.sh              # To sibu@zyvor.dev, cc ssahani@zyvor.dev
```

| PDF | Source |
|-----|--------|
| Platform VM Detail UX | [`guides/platform-vm-detail-ux.md`](guides/platform-vm-detail-ux.md) |
| VM Daily Access & Connect hub | [`guides/vm-daily-access.md`](guides/vm-daily-access.md) |
| Platform Feature QA (F01–F13) | [`guides/platform-feature-qa.md`](guides/platform-feature-qa.md) |
| Machina Cinema Mode | [`machina-cinema-mode.md`](machina-cinema-mode.md) |

SMTP: `scripts/deploy-mailer.env` or `../hypersdk-web/contact-mailer.env` (see `deploy-mailer.env.example`).

---

## Platform guides

| Guide | Description |
|-------|-------------|
| [Platform VM Detail UX](guides/platform-vm-detail-ux.md) | Hero, action bar, attention stack, Connect hub, Access tab |
| [VM daily access](guides/vm-daily-access.md) | Connect hub, laptop NAT path, export, ports |
| [Platform feature QA](guides/platform-feature-qa.md) | F01–F13 Playwright matrix (mock + live) |
| [VM lifecycle & SSH](guides/vm-lifecycle-ssh.md) | SSH keys, cloud-init, port forwards |
| [Machina Cinema Mode](machina-cinema-mode.md) | Cinema / Studio / Mission Control wall |

---

## Getting Started

| Document | Description |
|----------|-------------|
| [README](../README.md) | Project overview, architecture, key features |
| [Installation](../install.sh) | Automated installer for Fedora/RHEL/Ubuntu/Debian/openSUSE/Arch |
| [KubeVirt Migration](kubevirt-migration.md) | Optional Kubernetes integration guide |
| [Guacamole Integration](guacamole-integration.md) | HTML5 gateway integration (optional) |
| [OIDC & local Linux user](oidc-effective-linux-user.md) | Session vs NSS mapping, defaults, run-as-user boundary |
| [UX wiring & QA](ux.md) | Cross-shell UX, login variants, manual QA matrix, E2E pointers |
| [Platform VM Detail UX](guides/platform-vm-detail-ux.md) | Connect hub, Access tab, action bar, attention stack |
| [Platform feature QA](guides/platform-feature-qa.md) | F01–F13 feature matrix (`npm run test:e2e:features`) |
| [Machina Cinema Mode](machina-cinema-mode.md) | Cinema / Studio console UX, entry points, tests |
| [Operator runbook](runbook.md) | Health, backup, remote access, web login troubleshooting |
| [Developing on macOS](macos-build.md) | **Remote-only Rust builds** — do not `cargo build` / `make` on Mac |
| [Remote binary packaging](PACKAGE_BINARY_REMOTE.md) | Build tarball on Linux, fetch to laptop |

---

## API & Automation

- **REST API** — 50+ endpoints for VM lifecycle, storage, networking, metrics
- **WebSocket** — Console proxies (VNC, SPICE, serial, SSH) and live metrics
- **CLI** — `machinactl` for remote deployment, health checks, backups, upgrades
- **Webhooks** — Event-driven automations (VM state change, alert triggers)
- **Prometheus** — Native metrics export (`/metrics`)

---

## Support & Contributing

- **Issues** — Report bugs or request features via GitHub Issues
- **Contributing** — See [CONTRIBUTING.md](../CONTRIBUTING.md)
- **Community** — Join discussions and ask questions in GitHub Discussions
