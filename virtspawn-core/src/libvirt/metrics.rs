use virt::connect::Connect;
use virt::domain::Domain;

use crate::state::VmMetrics;
use crate::LibvirtError;

pub fn get_vm_metrics(conn: &Connect, name: &str) -> Result<VmMetrics, LibvirtError> {
    let domain = Domain::lookup_by_name(conn, name)
        .map_err(|e| LibvirtError::NotFound(format!("VM '{name}' not found: {e}")))?;

    let info = domain
        .get_info()
        .map_err(|e| LibvirtError::Operation(format!("Failed to get domain info: {e}")))?;

    // CPU time is in nanoseconds
    let cpu_time_ns = info.cpu_time;

    // Memory stats
    let mem_stats = domain.memory_stats(16).unwrap_or_default();
    let mut actual_kb: u64 = 0;
    let mut available_kb: u64 = 0;
    let mut unused_kb: u64 = 0;
    let mut rss_kb: u64 = 0;

    for stat in &mem_stats {
        match stat.tag {
            6 => actual_kb = stat.val,    // VIR_DOMAIN_MEMORY_STAT_ACTUAL_BALLOON
            8 => available_kb = stat.val, // VIR_DOMAIN_MEMORY_STAT_AVAILABLE
            4 => unused_kb = stat.val,    // VIR_DOMAIN_MEMORY_STAT_UNUSED
            9 => rss_kb = stat.val,       // VIR_DOMAIN_MEMORY_STAT_RSS
            _ => {}
        }
    }

    let memory_total_mb = if actual_kb > 0 {
        actual_kb / 1024
    } else {
        info.memory / 1024
    };

    let memory_used_mb = if available_kb > 0 && unused_kb > 0 {
        (available_kb.saturating_sub(unused_kb)) / 1024
    } else if rss_kb > 0 {
        rss_kb / 1024
    } else {
        0
    };

    let memory_pct = if memory_total_mb > 0 {
        (memory_used_mb as f64 / memory_total_mb as f64 * 100.0).min(100.0)
    } else {
        0.0
    };

    Ok(VmMetrics {
        name: name.to_string(),
        cpu_time_ns,
        vcpus: info.nr_virt_cpu,
        memory_total_mb,
        memory_used_mb,
        memory_pct,
    })
}

pub fn get_all_vm_metrics(conn: &Connect) -> Result<Vec<VmMetrics>, LibvirtError> {
    let domains = conn
        .list_all_domains(0)
        .map_err(|e| LibvirtError::Operation(format!("Failed to list domains: {e}")))?;

    let mut metrics = Vec::new();
    for domain in domains {
        let name = domain.get_name().unwrap_or_default();
        let info = match domain.get_info() {
            Ok(i) => i,
            Err(_) => continue,
        };

        // Only collect metrics for running VMs
        if info.state as u32 != 1 {
            continue;
        }

        let cpu_time_ns = info.cpu_time;

        let mem_stats = domain.memory_stats(16).unwrap_or_default();
        let mut actual_kb: u64 = 0;
        let mut available_kb: u64 = 0;
        let mut unused_kb: u64 = 0;
        let mut rss_kb: u64 = 0;

        for stat in &mem_stats {
            match stat.tag {
                6 => actual_kb = stat.val,
                8 => available_kb = stat.val,
                4 => unused_kb = stat.val,
                9 => rss_kb = stat.val,
                _ => {}
            }
        }

        let memory_total_mb = if actual_kb > 0 {
            actual_kb / 1024
        } else {
            info.memory / 1024
        };

        let memory_used_mb = if available_kb > 0 && unused_kb > 0 {
            (available_kb.saturating_sub(unused_kb)) / 1024
        } else if rss_kb > 0 {
            rss_kb / 1024
        } else {
            0
        };

        let memory_pct = if memory_total_mb > 0 {
            (memory_used_mb as f64 / memory_total_mb as f64 * 100.0).min(100.0)
        } else {
            0.0
        };

        metrics.push(VmMetrics {
            name,
            cpu_time_ns,
            vcpus: info.nr_virt_cpu,
            memory_total_mb,
            memory_used_mb,
            memory_pct,
        });
    }

    Ok(metrics)
}
