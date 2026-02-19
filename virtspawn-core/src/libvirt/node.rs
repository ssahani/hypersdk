use virt::connect::Connect;

use crate::state::NodeInfo;
use crate::LibvirtError;

pub fn get_node_info(conn: &Connect) -> Result<NodeInfo, LibvirtError> {
    let hostname = conn
        .get_hostname()
        .map_err(|e| LibvirtError::Operation(format!("Failed to get hostname: {e}")))?;

    let hv_type = conn
        .get_type()
        .map_err(|e| LibvirtError::Operation(format!("Failed to get hypervisor type: {e}")))?;

    let hv_version = conn
        .get_hyp_version()
        .map(|v| format!("{}.{}.{}", v / 1_000_000, (v / 1_000) % 1_000, v % 1_000))
        .unwrap_or_else(|_| "unknown".to_string());

    let lib_version = conn
        .get_lib_version()
        .map(|v| format!("{}.{}.{}", v / 1_000_000, (v / 1_000) % 1_000, v % 1_000))
        .unwrap_or_else(|_| "unknown".to_string());

    let node = conn
        .get_node_info()
        .map_err(|e| LibvirtError::Operation(format!("Failed to get node info: {e}")))?;

    let active_domains = conn.num_of_domains().unwrap_or(0) as u32;
    let defined_domains = conn.num_of_defined_domains().unwrap_or(0) as u32;

    Ok(NodeInfo {
        hostname,
        hypervisor: hv_type,
        hypervisor_version: hv_version,
        lib_version,
        cpu_model: node.model,
        cpu_cores: node.cores,
        cpu_threads: node.threads,
        cpu_sockets: node.sockets,
        memory_mb: node.memory / 1024,
        numa_nodes: node.nodes,
        active_vms: active_domains,
        defined_vms: defined_domains,
    })
}
