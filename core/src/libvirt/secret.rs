use virt::connect::Connect;
use virt::secret::Secret;

use crate::LibvirtError;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecretInfo {
    pub uuid: String,
    pub usage_type: String,
    pub usage_id: String,
    pub xml: String,
}

pub fn list_secrets(conn: &Connect) -> Result<Vec<SecretInfo>, LibvirtError> {
    let secrets = conn
        .list_all_secrets(0)
        .map_err(LibvirtError::map_op("Failed to list secrets"))?;

    let mut result = Vec::new();
    for secret in secrets {
        let uuid = secret.get_uuid_string().unwrap_or_default();
        let xml = secret.get_xml_desc(0).unwrap_or_default();
        let usage_type = crate::xml::extract_attr(&xml, "usage", "type").unwrap_or_default();
        let usage_id = crate::xml::extract_text(&xml, "name")
            .or_else(|| crate::xml::extract_text(&xml, "volume"))
            .or_else(|| crate::xml::extract_text(&xml, "target"))
            .unwrap_or_default();

        result.push(SecretInfo { uuid, usage_type, usage_id, xml });
    }
    Ok(result)
}

pub fn get_secret_xml(conn: &Connect, uuid: &str) -> Result<String, LibvirtError> {
    let secret = Secret::lookup_by_uuid_string(conn, uuid)
        .map_err(|e| LibvirtError::NotFound(format!("Secret '{}' not found: {}", uuid, e)))?;
    secret
        .get_xml_desc(0)
        .map_err(LibvirtError::map_op("Failed to get secret XML"))
}

pub fn delete_secret(conn: &Connect, uuid: &str) -> Result<(), LibvirtError> {
    let secret = Secret::lookup_by_uuid_string(conn, uuid)
        .map_err(|e| LibvirtError::NotFound(format!("Secret '{}' not found: {}", uuid, e)))?;
    secret
        .undefine()
        .map_err(LibvirtError::map_op("Failed to delete secret"))
}
