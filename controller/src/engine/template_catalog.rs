// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

use sqlx::PgPool;
use uuid::Uuid;

struct CatalogTemplate {
    name: &'static str,
    version: &'static str,
    source_disk: &'static str,
    cloud_init: bool,
    os_family: &'static str,
    category: &'static str,
    description: &'static str,
    featured: bool,
    icon: &'static str,
}

fn catalog_firewall_profile(t: &CatalogTemplate) -> &'static str {
    match t.category {
        "Database" => "DatabaseServer",
        "Windows" => "ManagementNode",
        "Appliance" if t.name.contains("nginx") => "WebServer",
        "Appliance" => "LockedDown",
        _ if t.name.contains("rocky") || t.name.contains("alma") || t.name.contains("centos") => {
            "ProductionServer"
        }
        _ => "WebServer",
    }
}

const CATALOG: &[CatalogTemplate] = &[
    CatalogTemplate {
        name: "ubuntu-24.04",
        version: "1.0.0",
        source_disk: "/var/lib/libvirt/images/ubuntu-24.04.qcow2",
        cloud_init: true,
        os_family: "linux",
        category: "Linux",
        description: "Ubuntu 24.04 LTS — cloud-init, DHCP, ideal default for new VMs.",
        featured: true,
        icon: "🐧",
    },
    CatalogTemplate {
        name: "ubuntu-22.04",
        version: "1.0.0",
        source_disk: "/var/lib/libvirt/images/ubuntu-22.04.qcow2",
        cloud_init: true,
        os_family: "linux",
        category: "Linux",
        description: "Ubuntu 22.04 LTS — long-term support, cloud-init ready.",
        featured: true,
        icon: "🐧",
    },
    CatalogTemplate {
        name: "debian-12",
        version: "1.0.0",
        source_disk: "/var/lib/libvirt/images/debian-12.qcow2",
        cloud_init: true,
        os_family: "linux",
        category: "Linux",
        description: "Debian 12 Bookworm — minimal, stable server image.",
        featured: false,
        icon: "🐧",
    },
    CatalogTemplate {
        name: "centos-stream-9",
        version: "1.0.0",
        source_disk: "/var/lib/libvirt/images/centos-stream-9.qcow2",
        cloud_init: true,
        os_family: "linux",
        category: "Linux",
        description: "CentOS Stream 9 — matches RHEL-compatible hypervisor hosts.",
        featured: true,
        icon: "🐧",
    },
    CatalogTemplate {
        name: "rocky-9",
        version: "1.0.0",
        source_disk: "/var/lib/libvirt/images/rocky-9.qcow2",
        cloud_init: true,
        os_family: "linux",
        category: "Linux",
        description: "Rocky Linux 9 — enterprise Linux for production workloads.",
        featured: false,
        icon: "🐧",
    },
    CatalogTemplate {
        name: "alma-9",
        version: "1.0.0",
        source_disk: "/var/lib/libvirt/images/alma-9.qcow2",
        cloud_init: true,
        os_family: "linux",
        category: "Linux",
        description: "AlmaLinux 9 — RHEL-compatible with cloud-init.",
        featured: false,
        icon: "🐧",
    },
    CatalogTemplate {
        name: "fedora-40",
        version: "1.0.0",
        source_disk: "/var/lib/libvirt/images/fedora-40.qcow2",
        cloud_init: true,
        os_family: "linux",
        category: "Linux",
        description: "Fedora 40 — latest packages for dev and CI runners.",
        featured: false,
        icon: "🐧",
    },
    CatalogTemplate {
        name: "windows-server-2022",
        version: "1.0.0",
        source_disk: "/var/lib/libvirt/images/windows-server-2022.qcow2",
        cloud_init: false,
        os_family: "windows",
        category: "Windows",
        description: "Windows Server 2022 — UEFI + VirtIO drivers (upload ISO to Images first).",
        featured: true,
        icon: "🪟",
    },
    CatalogTemplate {
        name: "windows-11",
        version: "1.0.0",
        source_disk: "/var/lib/libvirt/images/windows-11.qcow2",
        cloud_init: false,
        os_family: "windows",
        category: "Windows",
        description: "Windows 11 desktop — TPM/UEFI wizard available from VM create.",
        featured: true,
        icon: "🪟",
    },
    CatalogTemplate {
        name: "postgresql-16",
        version: "1.0.0",
        source_disk: "/var/lib/libvirt/images/postgresql-16.qcow2",
        cloud_init: true,
        os_family: "linux",
        category: "Database",
        description: "PostgreSQL 16 on Ubuntu — pre-tuned database appliance.",
        featured: true,
        icon: "🗄️",
    },
    CatalogTemplate {
        name: "mysql-8",
        version: "1.0.0",
        source_disk: "/var/lib/libvirt/images/mysql-8.qcow2",
        cloud_init: true,
        os_family: "linux",
        category: "Database",
        description: "MySQL 8.0 — InnoDB, replication-ready base image.",
        featured: false,
        icon: "🗄️",
    },
    CatalogTemplate {
        name: "mariadb-11",
        version: "1.0.0",
        source_disk: "/var/lib/libvirt/images/mariadb-11.qcow2",
        cloud_init: true,
        os_family: "linux",
        category: "Database",
        description: "MariaDB 11 — drop-in MySQL-compatible database VM.",
        featured: false,
        icon: "🗄️",
    },
    CatalogTemplate {
        name: "redis-7",
        version: "1.0.0",
        source_disk: "/var/lib/libvirt/images/redis-7.qcow2",
        cloud_init: true,
        os_family: "linux",
        category: "Database",
        description: "Redis 7 cache node — small footprint, cloud-init.",
        featured: false,
        icon: "🗄️",
    },
    CatalogTemplate {
        name: "photon-os",
        version: "1.0.0",
        source_disk: "/var/lib/libvirt/images/photon-os.qcow2",
        cloud_init: true,
        os_family: "linux",
        category: "Appliance",
        description: "VMware Photon OS — minimal container host appliance.",
        featured: true,
        icon: "📦",
    },
    CatalogTemplate {
        name: "nginx-proxy",
        version: "1.0.0",
        source_disk: "/var/lib/libvirt/images/nginx-proxy.qcow2",
        cloud_init: true,
        os_family: "linux",
        category: "Appliance",
        description: "Nginx reverse proxy — TLS termination and load balancing.",
        featured: false,
        icon: "📦",
    },
    CatalogTemplate {
        name: "wireguard-vpn",
        version: "1.0.0",
        source_disk: "/var/lib/libvirt/images/wireguard-vpn.qcow2",
        cloud_init: true,
        os_family: "linux",
        category: "Appliance",
        description: "WireGuard VPN gateway — secure remote access to the datacenter.",
        featured: false,
        icon: "📦",
    },
];

/// Insert bundled marketplace templates (idempotent).
pub async fn seed_default_templates(pool: &PgPool) -> anyhow::Result<usize> {
    let mut inserted = 0usize;
    for t in CATALOG {
        let fw = catalog_firewall_profile(t);
        let result = sqlx::query(
            "INSERT INTO templates (id, name, version, source_disk, cloud_init, os_family, category, description, featured, marketplace, icon, firewall_profile)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10, $11)
             ON CONFLICT (name, version) DO UPDATE SET firewall_profile = EXCLUDED.firewall_profile",
        )
        .bind(Uuid::new_v4())
        .bind(t.name)
        .bind(t.version)
        .bind(t.source_disk)
        .bind(t.cloud_init)
        .bind(t.os_family)
        .bind(t.category)
        .bind(t.description)
        .bind(t.featured)
        .bind(t.icon)
        .bind(fw)
        .execute(pool)
        .await?;
        if result.rows_affected() > 0 {
            inserted += 1;
        }
    }
    Ok(inserted)
}

pub async fn ensure_default_templates(pool: &PgPool) -> anyhow::Result<()> {
    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM templates WHERE marketplace = TRUE")
            .fetch_one(pool)
            .await?;
    if count == 0 {
        seed_default_templates(pool).await?;
    }
    Ok(())
}
