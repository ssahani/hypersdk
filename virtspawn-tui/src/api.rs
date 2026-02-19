use anyhow::Result;
use virtspawn_core::VmInfo;

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

    pub async fn fetch_vms(&self) -> Result<Vec<VmInfo>> {
        let url = format!("{}/api/v1/vms", self.base_url);
        let vms = self.client.get(&url).send().await?.json::<Vec<VmInfo>>().await?;
        Ok(vms)
    }

    pub async fn start_vm(&self, name: &str) -> Result<()> {
        let url = format!("{}/api/v1/vms/{}/start", self.base_url, name);
        let resp = self.client.post(&url).send().await?;
        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Failed to start VM: {body}");
        }
        Ok(())
    }

    pub async fn stop_vm(&self, name: &str) -> Result<()> {
        let url = format!("{}/api/v1/vms/{}/stop", self.base_url, name);
        let resp = self.client.post(&url).send().await?;
        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Failed to stop VM: {body}");
        }
        Ok(())
    }

    pub async fn delete_vm(&self, name: &str) -> Result<()> {
        let url = format!("{}/api/v1/vms/{}", self.base_url, name);
        let resp = self.client.delete(&url).send().await?;
        if !resp.status().is_success() {
            let body = resp.text().await.unwrap_or_default();
            anyhow::bail!("Failed to delete VM: {body}");
        }
        Ok(())
    }
}
