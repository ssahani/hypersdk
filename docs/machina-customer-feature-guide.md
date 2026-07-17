# Machina — Feature Guide

> **Enterprise Linux hypervisor management platform.**

Machina is a unified control plane for virtual machines running on libvirt / QEMU / KVM. It folds scattered virsh scripting, separate console gateways, and missing fleet observability into a single Rust daemon with a web dashboard, terminal UI, REST API, and the machinactl CLI. It is built for infrastructure teams and NOC operators who run VMs on their own metal and want cloud-grade lifecycle, consoles, security, and automation without vendor hypervisor lock-in.

**70+** web console screens · **4** ways to drive it: Web, TUI, REST, CLI · **12** workspace components, one shared core

This is the customer-facing feature reference. A print-ready PDF of the same content sits alongside this file. Generated from the product's actual capabilities.

## Contents

1. [VM Lifecycle & Compute](#1-vm-lifecycle-compute)
2. [Storage & Disk Management](#2-storage-disk-management)
3. [Networking](#3-networking)
4. [Consoles & Remote Access](#4-consoles-remote-access)
5. [Snapshots, Backup & Recovery](#5-snapshots,-backup-recovery)
6. [Fleet, HA & Multi-Host Control Plane](#6-fleet,-ha-multi-host-control-plane)
7. [Observability & Operations](#7-observability-operations)
8. [Security, Compliance & SOC](#8-security,-compliance-soc)
9. [AI & Automation (Zeus AI)](#9-ai-automation-(zeus-ai))
10. [Applications, Templates & Provisioning](#10-applications,-templates-provisioning)
11. [Integrations & Migration](#11-integrations-migration)
12. [Interfaces & Administration](#12-interfaces-administration)

## 1. VM Lifecycle & Compute

_Full create-to-delete control over every virtual machine, with live resource changes and zero-downtime moves._

- **Full VM lifecycle** — Create, start, stop, shutdown, reboot, pause, resume, clone, rename, and delete virtual machines from any surface. — _Every day-to-day VM operation in one place instead of ad-hoc virsh commands._
- **Dual creation backends** — Build VMs either through virt-install or from native libvirt domain XML, chosen globally or per request. — _Convenience for quick provisioning and full control when you need exact XML._
- **Golden image builder** — Build reusable base images asynchronously as background jobs using virt-builder or mkosi. — _Standardized, ready-to-clone images without hand-crafting each VM._
- **Disk & NIC hot-plug** — Attach, detach, and resize disks and network cards on a running VM without a reboot. — _Adjust capacity live, avoiding downtime for storage and network changes._
- **Live CPU & memory resize** — Change vCPU count and RAM allocation on running guests, with CPU pinning and scheduler tuning. — _Right-size workloads on the fly as demand shifts._
- **CPU & memory tuning** — Fine-grained cputune, memtune, per-vCPU pinning, and scheduler policy controls. — _Squeeze predictable performance out of shared hosts._
- **Live migration** — Move running VMs between hosts with tunable max bandwidth and max downtime. — _Evacuate hosts for maintenance with no service interruption._
- **Online block jobs** — Run block commit and pull operations, and abort jobs, on live disks. — _Consolidate or reshape disk chains without stopping the guest._
- **Guest agent by default** — Optionally inject the GuestKit QEMU guest agent into every new VM for cloud-init seeding and offline changes. — _In-guest coordination and reliable graceful shutdowns out of the box._
- **Autostart & domain XML access** — Toggle per-VM autostart and read the raw libvirt domain XML for any machine. — _Bring VMs back after reboots and inspect exactly what libvirt runs._

## 2. Storage & Disk Management

_Manage libvirt pools, volumes, and VM disks, with an optional dedicated storage control plane._

- **Storage pools** — List, start, stop, refresh, and toggle autostart on libvirt storage pools. — _Keep backing storage online and current from the dashboard._
- **Volume management** — Create and delete storage volumes within any pool. — _Provision and reclaim VM disk space without touching the CLI._
- **Disk images view** — Browse disk images with per-VM disk resize and IO tuning. — _See and reshape what each VM actually consumes._
- **Atlas storage integration** — Connect Atlas as a storage control plane spanning Ceph, NFS, and ZFS for VM disks, snapshots, and backups. — _Enterprise-grade shared storage under your fleet._
- **Storage tiers** — Define and assign storage tiers so workloads land on the right class of disk. — _Match performance and cost to each workload automatically._
- **Disk utility & ISO tools** — Platform disk utility plus ISO creation for boot and install media. — _Handle installer media and disk chores in the console._

## 3. Networking

_Virtual networks, host interfaces, filters, and a visual canvas for wiring the fleet together._

- **Virtual networks** — Create, delete, start, stop, autostart, and edit the XML of libvirt virtual networks. — _Full software-defined networking for guests without virsh._
- **Host networking** — Manage host interfaces, bridges, routing tables, LLDP neighbors, and sysctl tuning. — _See and shape the physical network the VMs sit on._
- **Port forwarding & firewall** — Configure host port-forwarding rules and firewall entries. — _Expose guest services safely without external tooling._
- **Network filters (nwfilter)** — Manage libvirt nwfilter rules that police guest traffic at the interface. — _Enforce per-VM traffic policy at the hypervisor edge._
- **Network canvas & segments** — Visually design network segments and overlays across the fleet on an interactive canvas. — _Plan and understand multi-host networking at a glance._
- **Network overlay & sync** — Build overlay networks spanning hosts and keep network state synchronized across the fleet. — _Consistent connectivity for VMs wherever they run._

## 4. Consoles & Remote Access

_Built-in VNC, SPICE, serial, SSH, and RDP proxies mean no separate console gateway._

- **noVNC graphical console** — Browser-based VNC console served directly by the daemon over WebSocket. — _Reach any VM's screen from a browser, no client install._
- **SPICE HTML5 console** — SPICE remote desktop rendered in the browser via a built-in HTML5 client. — _Rich desktop access with clipboard and multi-monitor support._
- **Serial & terminal streams** — Serial console and PTY terminal sessions streamed over authenticated WebSockets. — _Debug boot issues and drop into a shell from the UI._
- **SSH terminal proxy** — In-browser SSH terminal to VMs and ad-hoc hosts, with session TTLs. — _One authenticated path to shells across the fleet._
- **Built-in RDP** — Native RDP stream and rdp-info endpoint for Windows guests. — _Windows desktops without a bolted-on gateway._
- **ConsoleHub session broker** — Brokers console sessions with time-to-live limits, a cinema/wall multi-console view, and optional OIDC gating. — _Governed, auditable console access with a NOC-style live wall._
- **Apache Guacamole bridge** — Optional integration issuing encrypted JSON auth tokens for RDP, VNC, and SSH via Guacamole. — _Plug into an existing Guacamole gateway when you have one._
- **Virt-viewer handoff** — Download a .vv connection file to open a VM in a native virt-viewer client. — _Fall back to a desktop console client when preferred._

## 5. Snapshots, Backup & Recovery

_Point-in-time snapshots plus scheduled, retention-managed backups and disaster-recovery workflows._

- **Per-VM snapshots** — Create, list, revert, and delete libvirt snapshots for any VM. — _Instant rollback points before risky changes._
- **Scheduled backups** — Daily backup timer exporting VMs into a backup directory or NFS target with configurable retention and optional disk inclusion. — _Automated, off-box protection with no manual steps._
- **Backup lifecycle controls** — Enable, disable, run-now, and inspect backup status and logs from machinactl. — _Operate the whole backup pipeline from one command._
- **Fleet snapshots & schedulers** — Controller-driven fleet-wide snapshot and backup scheduling across many hosts. — _Consistent protection policy for the entire estate._
- **Disaster recovery** — Dedicated DR workflows and backup targets for coordinated recovery. — _A rehearsed path back when a host or site is lost._

## 6. Fleet, HA & Multi-Host Control Plane

_An optional enterprise controller adds HA failover, resource scheduling, and desired-state reconciliation across many hosts._

- **Fleet view** — Lightweight peer-based fleet status, metrics, alerts, and VM inventory in the daemon. — _See more than one host without the full controller._
- **Multi-host controller** — Optional control plane persisting state (SQLite or Postgres) and driving hosts through per-host gRPC agents. — _Scale from one box to a managed estate._
- **High availability & fencing** — HA engine with health watchdog and fencing that restarts VMs elsewhere when a host fails. — _Workloads survive host failures automatically._
- **DRS & rebalancing** — Distributed resource scheduling with placement, heatmaps, and fleet rebalancing. — _Keeps load spread evenly without manual juggling._
- **Smart placement** — Placement engine picks the best host for new or migrating VMs from live capacity. — _New VMs land where they fit, not where you guessed._
- **Desired-state reconciliation** — A reconcile engine continuously drives real state toward the declared intent. — _Drift self-heals instead of piling up._
- **Task bus** — In-memory or NATS-backed task fan-out distributing work across the fleet. — _Reliable, scalable execution of fleet operations._
- **Fleet power & maintenance** — Coordinated power control, maintenance missions, and host maintenance mode. — _Drain and service hosts safely on a schedule._
- **Bare-metal enrollment** — Enroll and validate new hosts, with bare-metal automation hooks. — _Grow the fleet without hand-provisioning each node._

## 7. Observability & Operations

_Prometheus metrics, history, OTLP export, alerts, events, and scheduled operations keep the fleet visible and automated._

- **Live & historical metrics** — Per-VM and host metrics with a metrics-history ring buffer persisted to disk. — _Trend performance over time, not just this instant._
- **Prometheus scrape** — A native /prometheus endpoint plus remote-write ingest for existing monitoring stacks. — _Drop Machina into your Grafana dashboards immediately._
- **OTLP export** — Export metrics, logs, and traces over OTLP/HTTP to Grafana Alloy or an OpenTelemetry Collector. — _Feed one open pipeline instead of a bespoke agent._
- **Alerts & webhooks** — Alert rules with an evaluator, notification channels, and outbound webhooks. — _Get told about problems where your team already looks._
- **Event streaming** — Server-sent event and WebSocket streams of state changes and activity. — _Live dashboards and integrations react in real time._
- **Health & doctor checks** — Deep health checks and host-readiness doctor with clear exit codes, plus a problems endpoint. — _Know a deploy is healthy before users hit it._
- **PSI & cgroup pressure** — Surfaces Linux pressure-stall and cgroup signals for hosts. — _Spot resource contention before it becomes an outage._
- **3D topology & datacenter view** — Interactive topology, datacenter, and infrastructure-graph views of hosts, VMs, and networks. — _Grasp the whole estate visually in seconds._
- **Scheduled jobs & operations** — Schedule recurring operations and VM schedules with a jobs runner. — _Automate routine ops on a calendar, hands-off._
- **Reports & recommendations** — Generated reports plus rightsizing and optimization recommendations. — _Turn telemetry into concrete actions to take._

## 8. Security, Compliance & SOC

_A firewall control plane, network intelligence, SIEM/SOC tooling, and compliance frameworks harden the fleet._

- **Zeus firewall control plane** — Fleet-wide firewall with profiles, drift detection, lockdown, GitOps sync, approvals, and change checkpoints. — _Consistent, reviewable network policy across every host._
- **PacketWolf network intelligence** — Kernel-native traffic discovery, ingest, and enforcement integrated as a bridge into the controller. — _See and contain real traffic at the packet level._
- **SOC & SIEM** — Security operations center with detection, event ingest, playbooks, and a SIEM pipeline. — _Detect and respond to threats without a separate SOC stack._
- **Threat hunting & attack surface** — Threat-hunting workspace and attack-surface-management (ASM) discovery. — _Proactively find exposure before attackers do._
- **Compliance frameworks** — Compliance evaluation against frameworks with remediation guidance and exportable PDF reports. — _Audit-ready evidence generated from live state._
- **Runtime enforcement & policy** — Policy engine plus runtime enforcement of security guardrails on running workloads. — _Rules that actually stop bad behavior, not just flag it._
- **Signed audit log** — Tamper-evident audit log with optional line signing, syslog, and webhook shipping, verifiable via CLI. — _Prove who did what, and that the record wasn't altered._
- **Linux audit integration** — Ingests Linux audit and SELinux AVC events with a health threshold. — _Host-level security signals folded into fleet health._
- **Encrypted secrets & keys** — Secrets management plus AES-256-GCM encryption of stored provider keys with a master key. — _Credentials stay protected at rest, not in plaintext._

## 9. AI & Automation (Zeus AI)

_A controller-side AI engine adds natural-language ops, autonomous remediation, cost intelligence, and predictive SRE._

- **Natural-language ops** — Drive infrastructure with natural language through an intent router and NL-ops layer. — _Ask for what you want instead of memorizing APIs._
- **Autopilot & autonomous mode** — Autopilot and autonomous engines that plan and execute multi-step operations, gated by approvals. — _Routine remediation runs itself, with a human veto._
- **Incident commander & root cause** — Coordinates incident response with automated root-cause analysis and service-impact mapping. — _Faster diagnosis and a clear blast radius during outages._
- **Predictive SRE** — Predicts capacity and reliability issues and proposes SRE remediations before they bite. — _Fix tomorrow's problem today._
- **Cost & FinOps intelligence** — Cost attribution, budgets, exposure FinOps, and rightsizing recommendations. — _Understand and cut infrastructure spend with data._
- **Migration readiness** — AI assessment of how ready a VM or workload is to migrate, with prechecks. — _Migrate with confidence, not surprises._
- **Digital twin & infra memory** — Maintains a digital twin and long-term infrastructure memory of the estate. — _Decisions grounded in the real, remembered environment._
- **Knowledge & runbooks** — Searchable knowledge base, diagnosis, and generated runbooks for operations. — _Institutional know-how available on demand._
- **Agent marketplace** — Catalog of AI agents and pluggable LLM providers with configurable settings. — _Extend automation and choose your own model backend._
- **AI VM builder** — Generate VM and blueprint definitions from high-level intent. — _Describe a machine and let the platform draft it._

## 10. Applications, Templates & Provisioning

_A launchpad, marketplace, blueprints, and cloud-init studio turn raw VMs into repeatable, ready-to-run workloads._

- **Launchpad & spaces** — App launchpad organizing workloads into spaces with per-app detail views. — _Deploy and find applications like an app store, not a VM list._
- **Marketplace** — Built-in marketplace of deployable content and applications. — _One-click access to curated, ready workloads._
- **Templates & catalog** — Template catalog with git-backed sources, image fetch, and readiness checks. — _Standardized starting points kept fresh automatically._
- **Blueprints** — Declarative blueprints describing multi-resource stacks to stamp out. — _Reproduce whole environments consistently._
- **Cloud-init studio** — Author and manage cloud-init configuration to seed guests at first boot. — _Zero-touch first-boot customization for every VM._
- **Content library** — Central content store for images, ISOs, and provisioning artifacts. — _One shared source of truth for boot media._
- **GPU command center** — Discover, assign, and manage GPUs across the fleet. — _Put accelerators where AI and graphics workloads need them._
- **USB & PCI passthrough** — Pass USB and PCI devices through to guests, gated by RBAC. — _Give VMs direct access to real hardware when required._

## 11. Integrations & Migration

_Move VMs to and from KubeVirt, OpenStack, and other clouds, and connect Machina to the wider Zyvor stack._

- **KubeVirt migration** — Export a VM as a KubeVirt YAML bundle and apply, upload, and start it on a Kubernetes cluster. — _A documented, repeatable path from libvirt to KubeVirt._
- **OpenStack** — Manage OpenStack instances, flavors, networks, images, and load balancers, and push local VMs to OpenStack. — _Bridge on-metal VMs into your OpenStack cloud._
- **HyperSDK / hyper2kvm** — Multi-cloud and cross-hypervisor VM migration into KVM. — _Bring VMs home from other platforms._
- **GuestKit offline assurance** — Offline VM migration assurance and guest inspection tooling. — _Validate guests before and after a move._
- **Kubernetes & Kata** — View Kubernetes workloads and Kata containers alongside VMs, with KubeVirt VNC/console proxying. — _One console for both VMs and cluster workloads._
- **VMware & Proxmox awareness** — Controller APIs to interoperate with VMware and Proxmox sources. — _Onboard estates from other hypervisors._
- **Zyvor platform stack** — Fits with hypercluster, Zeus OS, forge, Atlas, PacketWolf, and more across the Zyvor ecosystem. — _Machina is the metal layer of a full private-cloud stack._

## 12. Interfaces & Administration

_Four ways to operate the platform, backed by PAM/LDAP/OIDC auth, RBAC, multi-tenancy, and one-command deploys._

- **Web dashboard** — React 19 Liquid Glass UI with classic single-host and platform multi-host shells covering 70+ screens. — _A polished, complete console for the whole platform._
- **Terminal UI** — A ratatui-based terminal client to list VMs, drive lifecycle, and watch metrics. — _Full control from an SSH session, no browser needed._
- **REST + WebSocket API** — Complete /api/v1 REST surface and /ws/v1 streams with a published OpenAPI contract at /api-docs. — _Automate anything and generate typed clients._
- **machinactl CLI** — One CLI for deps, build, install, deploy, upgrade, backup, verify, health, doctor, audit, and integrations status. — _Stand up and operate a host with single commands._
- **PAM / LDAP / OIDC auth** — Log in with Linux host accounts via PAM, with optional LDAP and OIDC SSO and Active Directory integration. — _Use the identity system you already run._
- **RBAC roles** — Admin, Operator, and ReadOnly roles mapped from a roles file, OIDC groups, or scoped API tokens. — _Least-privilege access for every operator._
- **Scoped API tokens & sessions** — Issue prefixed, scope-limited API tokens and manage HttpOnly session cookies with admin revocation. — _Grant machines and people exactly the access they need._
- **Projects & multi-tenancy** — Organize resources into projects with users, groups, and per-project scoping. — _Cleanly separate teams and tenants on shared infrastructure._
- **Flexible deployment** — Single-host machinactl, remote rsync deploy, multi-host controller/agent, or a daemon-only Helm chart. — _Install the way that fits your environment._
- **Support & upgrade tooling** — In-console support bundle, upgrade flows, and self-updating deploys with health verification. — _Maintain and troubleshoot the platform from inside it._

## Getting started

1. **Prepare a Linux KVM host** — Run ./machinactl doctor to confirm /dev/kvm, systemd, libvirtd, and required tools are present. Build only on Linux.
2. **Deploy in one command** — Run ./machinactl deploy to install dependencies, build a release, install, start the daemon, and smoke-test the API.
3. **Open the console** — Browse to https://<host>:5092 (self-signed TLS by default) and sign in with a Linux host account via PAM, or launch the TUI with machina.
4. **Lock down access** — Populate /var/lib/machina/roles.json (an empty file makes everyone admin), set a strong MACHINA_JWT_SECRET, and choose PAM, LDAP, or OIDC.
5. **Turn on protection & telemetry** — Enable scheduled backups with ./machinactl backup enable, point them off-box, and wire Prometheus scrape or OTLP export.
6. **Scale to a fleet (optional)** — Install the controller and agents with INSTALL_PLATFORM=1 or deploy-remote --platform to unlock HA, DRS, and the platform UI.

> **Good to know:** Machina builds and runs on Linux only (it depends on libvirt/QEMU/KVM headers and /dev/kvm) — the workspace does not compile on macOS, though the web UI alone does. HTTPS ships with a self-signed certificate that should be replaced with a CA-signed one for production. Security defaults matter: an empty roles.json grants every user admin, and the dev-only auth-bypass flags must never be set in production. The multi-host controller and agent tier is systemd-only (the Helm chart deploys just the daemon), and SAML is config-only today. Integrations such as OpenStack, KubeVirt, Guacamole, PacketWolf, and Atlas are disabled by default and require their own endpoints or credentials.

---
_Machina is developed by ZyvorAI Labs. Contact **info@zyvor.dev** · Proprietary & Confidential._
