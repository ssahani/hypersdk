use anyhow::Result;
use virtspawn_core::{
    BackupInfo, BackupRequest, CloneVmRequest, CreateNetworkRequest, CreateSnapshotRequest,
    CreateVmRequest, NetworkInfo, NodeInfo, RenameVmRequest, RestoreRequest, SnapshotInfo,
    StoragePoolInfo, VmDetails, VmInfo, VmMetrics,
};

pub struct DaemonClient {
    base_url: String,
    client: reqwest::Client,
}

impl DaemonClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
            client: reqwest::Client::new(),
        }
    }

    // ── Unified HTTP helpers ────────────────────────────────────────────

    async fn get_json<T: serde::de::DeserializeOwned>(&self, path: &str) -> Result<T> {
        let url = format!("{}{}", self.base_url, path);
        let data = self.client.get(&url).send().await?.json().await?;
        Ok(data)
    }

    async fn get_text(&self, path: &str) -> Result<String> {
        let url = format!("{}{}", self.base_url, path);
        let text = self.client.get(&url).send().await?.text().await?;
        Ok(text)
    }

    async fn post_action(&self, path: &str) -> Result<()> {
        let url = format!("{}{}", self.base_url, path);
        let resp = self.client.post(&url).send().await?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("[{status}] {body}");
        }
        Ok(())
    }

    async fn post_json<T: serde::Serialize>(&self, path: &str, body: &T) -> Result<()> {
        let url = format!("{}{}", self.base_url, path);
        let resp = self.client.post(&url).json(body).send().await?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("[{status}] {body}");
        }
        Ok(())
    }

    async fn delete_action(&self, path: &str) -> Result<()> {
        let url = format!("{}{}", self.base_url, path);
        let resp = self.client.delete(&url).send().await?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("[{status}] {body}");
        }
        Ok(())
    }

    // ── VMs ─────────────────────────────────────────────────────────────

    pub async fn fetch_vms(&self) -> Result<Vec<VmInfo>> {
        self.get_json("/api/v1/vms").await
    }

    pub async fn get_vm_details(&self, name: &str) -> Result<VmDetails> {
        self.get_json(&format!("/api/v1/vms/{name}")).await
    }

    pub async fn get_vm_xml(&self, name: &str) -> Result<String> {
        self.get_text(&format!("/api/v1/vms/{name}/xml")).await
    }

    pub async fn start_vm(&self, name: &str) -> Result<()> {
        self.post_action(&format!("/api/v1/vms/{name}/start")).await
    }

    pub async fn stop_vm(&self, name: &str) -> Result<()> {
        self.post_action(&format!("/api/v1/vms/{name}/stop")).await
    }

    pub async fn shutdown_vm(&self, name: &str) -> Result<()> {
        self.post_action(&format!("/api/v1/vms/{name}/shutdown")).await
    }

    pub async fn reboot_vm(&self, name: &str) -> Result<()> {
        self.post_action(&format!("/api/v1/vms/{name}/reboot")).await
    }

    pub async fn pause_vm(&self, name: &str) -> Result<()> {
        self.post_action(&format!("/api/v1/vms/{name}/pause")).await
    }

    pub async fn resume_vm(&self, name: &str) -> Result<()> {
        self.post_action(&format!("/api/v1/vms/{name}/resume")).await
    }

    pub async fn delete_vm(&self, name: &str) -> Result<()> {
        self.delete_action(&format!("/api/v1/vms/{name}")).await
    }

    pub async fn create_vm(&self, req: &CreateVmRequest) -> Result<()> {
        self.post_json("/api/v1/vms", req).await
    }

    pub async fn clone_vm(&self, source: &str, new_name: &str) -> Result<()> {
        let req = CloneVmRequest {
            new_name: new_name.to_string(),
        };
        self.post_json(&format!("/api/v1/vms/{source}/clone"), &req)
            .await
    }

    pub async fn rename_vm(&self, name: &str, new_name: &str) -> Result<()> {
        let req = RenameVmRequest {
            new_name: new_name.to_string(),
        };
        self.post_json(&format!("/api/v1/vms/{name}/rename"), &req)
            .await
    }

    pub async fn set_autostart(&self, name: &str, enabled: bool) -> Result<()> {
        self.post_action(&format!("/api/v1/vms/{name}/autostart/{enabled}"))
            .await
    }

    pub async fn set_vcpus(&self, name: &str, count: u32) -> Result<()> {
        self.post_action(&format!("/api/v1/vms/{name}/vcpus/{count}"))
            .await
    }

    pub async fn set_memory(&self, name: &str, mb: u64) -> Result<()> {
        self.post_action(&format!("/api/v1/vms/{name}/memory/{mb}"))
            .await
    }

    // ── Networks ────────────────────────────────────────────────────────

    pub async fn fetch_networks(&self) -> Result<Vec<NetworkInfo>> {
        self.get_json("/api/v1/networks").await
    }

    pub async fn start_network(&self, name: &str) -> Result<()> {
        self.post_action(&format!("/api/v1/networks/{name}/start"))
            .await
    }

    pub async fn stop_network(&self, name: &str) -> Result<()> {
        self.post_action(&format!("/api/v1/networks/{name}/stop"))
            .await
    }

    pub async fn create_network(&self, req: &CreateNetworkRequest) -> Result<()> {
        self.post_json("/api/v1/networks", req).await
    }

    pub async fn delete_network(&self, name: &str) -> Result<()> {
        self.delete_action(&format!("/api/v1/networks/{name}")).await
    }

    pub async fn set_network_autostart(&self, name: &str, enabled: bool) -> Result<()> {
        self.post_action(&format!("/api/v1/networks/{name}/autostart/{enabled}"))
            .await
    }

    pub async fn get_network_xml(&self, name: &str) -> Result<String> {
        self.get_text(&format!("/api/v1/networks/{name}/xml")).await
    }

    // ── Storage ─────────────────────────────────────────────────────────

    pub async fn fetch_storage_pools(&self) -> Result<Vec<StoragePoolInfo>> {
        self.get_json("/api/v1/storage/pools").await
    }

    pub async fn start_pool(&self, name: &str) -> Result<()> {
        self.post_action(&format!("/api/v1/storage/pools/{name}/start"))
            .await
    }

    pub async fn stop_pool(&self, name: &str) -> Result<()> {
        self.post_action(&format!("/api/v1/storage/pools/{name}/stop"))
            .await
    }

    pub async fn fetch_volumes(&self, pool: &str) -> Result<Vec<virtspawn_core::StorageVolumeInfo>> {
        self.get_json(&format!("/api/v1/storage/pools/{pool}/volumes"))
            .await
    }

    pub async fn set_pool_autostart(&self, name: &str, enabled: bool) -> Result<()> {
        self.post_action(&format!("/api/v1/storage/pools/{name}/autostart/{enabled}"))
            .await
    }

    pub async fn refresh_pool(&self, name: &str) -> Result<()> {
        self.post_action(&format!("/api/v1/storage/pools/{name}/refresh"))
            .await
    }

    pub async fn delete_volume(&self, pool: &str, vol: &str) -> Result<()> {
        self.delete_action(&format!("/api/v1/storage/pools/{pool}/volumes/{vol}"))
            .await
    }

    // ── Snapshots ───────────────────────────────────────────────────────

    pub async fn fetch_all_snapshots(&self) -> Result<Vec<SnapshotInfo>> {
        self.get_json("/api/v1/snapshots").await
    }

    pub async fn create_snapshot(&self, vm_name: &str, snap_name: &str, desc: &str) -> Result<()> {
        let req = CreateSnapshotRequest {
            name: snap_name.to_string(),
            description: desc.to_string(),
            disk_only: false,
        };
        self.post_json(&format!("/api/v1/vms/{vm_name}/snapshots"), &req)
            .await
    }

    pub async fn delete_snapshot(&self, vm_name: &str, snap_name: &str) -> Result<()> {
        self.delete_action(&format!(
            "/api/v1/vms/{vm_name}/snapshots/{snap_name}"
        ))
        .await
    }

    pub async fn revert_snapshot(&self, vm_name: &str, snap_name: &str) -> Result<()> {
        self.post_action(&format!(
            "/api/v1/vms/{vm_name}/snapshots/{snap_name}/revert"
        ))
        .await
    }

    // ── Node / Metrics ──────────────────────────────────────────────────

    pub async fn fetch_node_info(&self) -> Result<NodeInfo> {
        self.get_json("/api/v1/node").await
    }

    pub async fn fetch_metrics(&self) -> Result<Vec<VmMetrics>> {
        self.get_json("/api/v1/metrics").await
    }

    // ── Console ─────────────────────────────────────────────────────────

    pub async fn get_console_info(&self, name: &str) -> Result<serde_json::Value> {
        self.get_json(&format!("/api/v1/vms/console-info/{name}"))
            .await
    }

    // ── Backups ─────────────────────────────────────────────────────────

    pub async fn fetch_backups(&self) -> Result<Vec<BackupInfo>> {
        self.get_json("/api/v1/backups").await
    }

    pub async fn trigger_backup(&self, req: &BackupRequest) -> Result<()> {
        self.post_json("/api/v1/backups", req).await
    }

    pub async fn restore_backup(&self, backup_id: &str) -> Result<()> {
        let req = RestoreRequest {
            backup_id: backup_id.to_string(),
        };
        self.post_json("/api/v1/backups/restore", &req).await
    }

    pub async fn delete_backup(&self, id: &str) -> Result<()> {
        self.delete_action(&format!("/api/v1/backups/{id}")).await
    }
}
