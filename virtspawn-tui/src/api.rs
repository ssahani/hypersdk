use anyhow::Result;
use virtspawn_core::{
    CloneVmRequest, CreateNetworkRequest, CreateSnapshotRequest, CreateVmRequest, NetworkInfo,
    NodeInfo, RenameVmRequest, SnapshotInfo, StoragePoolInfo, VmDetails, VmInfo, VmMetrics,
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

    // ── VMs ─────────────────────────────────────────────────────────────

    pub async fn fetch_vms(&self) -> Result<Vec<VmInfo>> {
        let url = format!("{}/api/v1/vms", self.base_url);
        let vms = self.client.get(&url).send().await?.json().await?;
        Ok(vms)
    }

    pub async fn get_vm_details(&self, name: &str) -> Result<VmDetails> {
        let url = format!("{}/api/v1/vms/{}", self.base_url, name);
        let details = self.client.get(&url).send().await?.json().await?;
        Ok(details)
    }

    pub async fn start_vm(&self, name: &str) -> Result<()> {
        let url = format!("{}/api/v1/vms/{}/start", self.base_url, name);
        let resp = self.client.post(&url).send().await?;
        if !resp.status().is_success() {
            anyhow::bail!("{}", resp.text().await.unwrap_or_default());
        }
        Ok(())
    }

    pub async fn stop_vm(&self, name: &str) -> Result<()> {
        let url = format!("{}/api/v1/vms/{}/stop", self.base_url, name);
        let resp = self.client.post(&url).send().await?;
        if !resp.status().is_success() {
            anyhow::bail!("{}", resp.text().await.unwrap_or_default());
        }
        Ok(())
    }

    pub async fn shutdown_vm(&self, name: &str) -> Result<()> {
        let url = format!("{}/api/v1/vms/{}/shutdown", self.base_url, name);
        let resp = self.client.post(&url).send().await?;
        if !resp.status().is_success() {
            anyhow::bail!("{}", resp.text().await.unwrap_or_default());
        }
        Ok(())
    }

    pub async fn reboot_vm(&self, name: &str) -> Result<()> {
        let url = format!("{}/api/v1/vms/{}/reboot", self.base_url, name);
        let resp = self.client.post(&url).send().await?;
        if !resp.status().is_success() {
            anyhow::bail!("{}", resp.text().await.unwrap_or_default());
        }
        Ok(())
    }

    pub async fn pause_vm(&self, name: &str) -> Result<()> {
        let url = format!("{}/api/v1/vms/{}/pause", self.base_url, name);
        let resp = self.client.post(&url).send().await?;
        if !resp.status().is_success() {
            anyhow::bail!("{}", resp.text().await.unwrap_or_default());
        }
        Ok(())
    }

    pub async fn resume_vm(&self, name: &str) -> Result<()> {
        let url = format!("{}/api/v1/vms/{}/resume", self.base_url, name);
        let resp = self.client.post(&url).send().await?;
        if !resp.status().is_success() {
            anyhow::bail!("{}", resp.text().await.unwrap_or_default());
        }
        Ok(())
    }

    pub async fn delete_vm(&self, name: &str) -> Result<()> {
        let url = format!("{}/api/v1/vms/{}", self.base_url, name);
        let resp = self.client.delete(&url).send().await?;
        if !resp.status().is_success() {
            anyhow::bail!("{}", resp.text().await.unwrap_or_default());
        }
        Ok(())
    }

    // ── Networks ────────────────────────────────────────────────────────

    pub async fn fetch_networks(&self) -> Result<Vec<NetworkInfo>> {
        let url = format!("{}/api/v1/networks", self.base_url);
        let nets = self.client.get(&url).send().await?.json().await?;
        Ok(nets)
    }

    pub async fn start_network(&self, name: &str) -> Result<()> {
        let url = format!("{}/api/v1/networks/{}/start", self.base_url, name);
        let resp = self.client.post(&url).send().await?;
        if !resp.status().is_success() {
            anyhow::bail!("{}", resp.text().await.unwrap_or_default());
        }
        Ok(())
    }

    pub async fn stop_network(&self, name: &str) -> Result<()> {
        let url = format!("{}/api/v1/networks/{}/stop", self.base_url, name);
        let resp = self.client.post(&url).send().await?;
        if !resp.status().is_success() {
            anyhow::bail!("{}", resp.text().await.unwrap_or_default());
        }
        Ok(())
    }

    // ── Storage ─────────────────────────────────────────────────────────

    pub async fn fetch_storage_pools(&self) -> Result<Vec<StoragePoolInfo>> {
        let url = format!("{}/api/v1/storage/pools", self.base_url);
        let pools = self.client.get(&url).send().await?.json().await?;
        Ok(pools)
    }

    // ── Snapshots ───────────────────────────────────────────────────────

    pub async fn fetch_all_snapshots(&self) -> Result<Vec<SnapshotInfo>> {
        let url = format!("{}/api/v1/snapshots", self.base_url);
        let snaps = self.client.get(&url).send().await?.json().await?;
        Ok(snaps)
    }

    pub async fn create_snapshot(&self, vm_name: &str, snap_name: &str, desc: &str) -> Result<()> {
        let url = format!("{}/api/v1/vms/{}/snapshots", self.base_url, vm_name);
        let req = CreateSnapshotRequest {
            name: snap_name.to_string(),
            description: desc.to_string(),
        };
        let resp = self.client.post(&url).json(&req).send().await?;
        if !resp.status().is_success() {
            anyhow::bail!("{}", resp.text().await.unwrap_or_default());
        }
        Ok(())
    }

    pub async fn delete_snapshot(&self, vm_name: &str, snap_name: &str) -> Result<()> {
        let url = format!(
            "{}/api/v1/vms/{}/snapshots/{}",
            self.base_url, vm_name, snap_name
        );
        let resp = self.client.delete(&url).send().await?;
        if !resp.status().is_success() {
            anyhow::bail!("{}", resp.text().await.unwrap_or_default());
        }
        Ok(())
    }

    pub async fn revert_snapshot(&self, vm_name: &str, snap_name: &str) -> Result<()> {
        let url = format!(
            "{}/api/v1/vms/{}/snapshots/{}/revert",
            self.base_url, vm_name, snap_name
        );
        let resp = self.client.post(&url).send().await?;
        if !resp.status().is_success() {
            anyhow::bail!("{}", resp.text().await.unwrap_or_default());
        }
        Ok(())
    }

    // ── Node ────────────────────────────────────────────────────────────

    pub async fn fetch_node_info(&self) -> Result<NodeInfo> {
        let url = format!("{}/api/v1/node", self.base_url);
        let info = self.client.get(&url).send().await?.json().await?;
        Ok(info)
    }

    // ── Metrics ─────────────────────────────────────────────────────────

    pub async fn fetch_metrics(&self) -> Result<Vec<VmMetrics>> {
        let url = format!("{}/api/v1/metrics", self.base_url);
        let m = self.client.get(&url).send().await?.json().await?;
        Ok(m)
    }

    // ── Clone ───────────────────────────────────────────────────────────

    pub async fn clone_vm(&self, source: &str, new_name: &str) -> Result<()> {
        let url = format!("{}/api/v1/vms/{}/clone", self.base_url, source);
        let req = CloneVmRequest {
            new_name: new_name.to_string(),
        };
        let resp = self.client.post(&url).json(&req).send().await?;
        if !resp.status().is_success() {
            anyhow::bail!("{}", resp.text().await.unwrap_or_default());
        }
        Ok(())
    }

    // ── Create VM ───────────────────────────────────────────────────────

    pub async fn create_vm(&self, req: &CreateVmRequest) -> Result<()> {
        let url = format!("{}/api/v1/vms", self.base_url);
        let resp = self.client.post(&url).json(req).send().await?;
        if !resp.status().is_success() {
            anyhow::bail!("{}", resp.text().await.unwrap_or_default());
        }
        Ok(())
    }

    // ── VM XML ──────────────────────────────────────────────────────────

    pub async fn get_vm_xml(&self, name: &str) -> Result<String> {
        let url = format!("{}/api/v1/vms/{}/xml", self.base_url, name);
        let xml = self.client.get(&url).send().await?.text().await?;
        Ok(xml)
    }

    // ── Autostart ───────────────────────────────────────────────────────

    pub async fn set_autostart(&self, name: &str, enabled: bool) -> Result<()> {
        let url = format!("{}/api/v1/vms/{}/autostart/{}", self.base_url, name, enabled);
        let resp = self.client.post(&url).send().await?;
        if !resp.status().is_success() {
            anyhow::bail!("{}", resp.text().await.unwrap_or_default());
        }
        Ok(())
    }

    // ── Storage pool actions ────────────────────────────────────────────

    pub async fn start_pool(&self, name: &str) -> Result<()> {
        let url = format!("{}/api/v1/storage/pools/{}/start", self.base_url, name);
        let resp = self.client.post(&url).send().await?;
        if !resp.status().is_success() {
            anyhow::bail!("{}", resp.text().await.unwrap_or_default());
        }
        Ok(())
    }

    pub async fn stop_pool(&self, name: &str) -> Result<()> {
        let url = format!("{}/api/v1/storage/pools/{}/stop", self.base_url, name);
        let resp = self.client.post(&url).send().await?;
        if !resp.status().is_success() {
            anyhow::bail!("{}", resp.text().await.unwrap_or_default());
        }
        Ok(())
    }

    // ── Resize ──────────────────────────────────────────────────────────

    pub async fn set_vcpus(&self, name: &str, count: u32) -> Result<()> {
        let url = format!("{}/api/v1/vms/{}/vcpus/{}", self.base_url, name, count);
        let resp = self.client.post(&url).send().await?;
        if !resp.status().is_success() {
            anyhow::bail!("{}", resp.text().await.unwrap_or_default());
        }
        Ok(())
    }

    pub async fn set_memory(&self, name: &str, mb: u64) -> Result<()> {
        let url = format!("{}/api/v1/vms/{}/memory/{}", self.base_url, name, mb);
        let resp = self.client.post(&url).send().await?;
        if !resp.status().is_success() {
            anyhow::bail!("{}", resp.text().await.unwrap_or_default());
        }
        Ok(())
    }

    // ── Rename ──────────────────────────────────────────────────────────

    pub async fn rename_vm(&self, name: &str, new_name: &str) -> Result<()> {
        let url = format!("{}/api/v1/vms/{}/rename", self.base_url, name);
        let req = RenameVmRequest {
            new_name: new_name.to_string(),
        };
        let resp = self.client.post(&url).json(&req).send().await?;
        if !resp.status().is_success() {
            anyhow::bail!("{}", resp.text().await.unwrap_or_default());
        }
        Ok(())
    }

    // ── Network create/delete ───────────────────────────────────────────

    pub async fn create_network(&self, req: &CreateNetworkRequest) -> Result<()> {
        let url = format!("{}/api/v1/networks", self.base_url);
        let resp = self.client.post(&url).json(req).send().await?;
        if !resp.status().is_success() {
            anyhow::bail!("{}", resp.text().await.unwrap_or_default());
        }
        Ok(())
    }

    pub async fn delete_network(&self, name: &str) -> Result<()> {
        let url = format!("{}/api/v1/networks/{}", self.base_url, name);
        let resp = self.client.delete(&url).send().await?;
        if !resp.status().is_success() {
            anyhow::bail!("{}", resp.text().await.unwrap_or_default());
        }
        Ok(())
    }

    // ── Volumes ─────────────────────────────────────────────────────────

    pub async fn fetch_volumes(&self, pool: &str) -> Result<Vec<virtspawn_core::StorageVolumeInfo>> {
        let url = format!("{}/api/v1/storage/pools/{}/volumes", self.base_url, pool);
        let vols = self.client.get(&url).send().await?.json().await?;
        Ok(vols)
    }

    // ── Console info ────────────────────────────────────────────────────

    pub async fn get_console_info(&self, name: &str) -> Result<serde_json::Value> {
        let url = format!("{}/api/v1/vms/console-info/{}", self.base_url, name);
        let info = self.client.get(&url).send().await?.json().await?;
        Ok(info)
    }
}
