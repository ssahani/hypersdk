use crate::LibvirtError;

/// Validate a VM/resource name: alphanumeric, dash, underscore, dot. 1-64 chars.
pub fn validate_name(name: &str) -> Result<(), LibvirtError> {
    if name.is_empty() {
        return Err(LibvirtError::Operation("Name cannot be empty".to_string()));
    }
    if name.len() > 64 {
        return Err(LibvirtError::Operation(
            "Name too long (max 64 characters)".to_string(),
        ));
    }
    if !name
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return Err(LibvirtError::Operation(
            "Name contains invalid characters (allowed: alphanumeric, dash, underscore, dot)"
                .to_string(),
        ));
    }
    if name.starts_with('-') || name.starts_with('.') {
        return Err(LibvirtError::Operation(
            "Name cannot start with dash or dot".to_string(),
        ));
    }
    Ok(())
}

/// Validate vCPU count: 1-256.
pub fn validate_vcpus(vcpus: u32) -> Result<(), LibvirtError> {
    if vcpus == 0 || vcpus > 256 {
        return Err(LibvirtError::Operation(
            "vCPUs must be between 1 and 256".to_string(),
        ));
    }
    Ok(())
}

/// Validate memory: 64 MB to 1 TB.
pub fn validate_memory_mb(memory_mb: u64) -> Result<(), LibvirtError> {
    if memory_mb < 64 {
        return Err(LibvirtError::Operation(
            "Memory must be at least 64 MB".to_string(),
        ));
    }
    if memory_mb > 1_048_576 {
        return Err(LibvirtError::Operation(
            "Memory cannot exceed 1 TB (1048576 MB)".to_string(),
        ));
    }
    Ok(())
}

/// Validate disk size: 1 GB to 10 TB.
pub fn validate_disk_gb(disk_gb: u64) -> Result<(), LibvirtError> {
    if disk_gb == 0 {
        return Err(LibvirtError::Operation(
            "Disk size must be at least 1 GB".to_string(),
        ));
    }
    if disk_gb > 10_240 {
        return Err(LibvirtError::Operation(
            "Disk size cannot exceed 10 TB (10240 GB)".to_string(),
        ));
    }
    Ok(())
}
