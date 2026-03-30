use crate::LibvirtError;

/// Validate a VM/resource name: alphanumeric, dash, underscore, dot. 1-64 chars.
pub fn validate_name(name: &str) -> Result<(), LibvirtError> {
    if name.is_empty() {
        return Err(LibvirtError::Invalid("Name cannot be empty".to_string()));
    }
    if name.len() > 64 {
        return Err(LibvirtError::Invalid(
            "Name too long (max 64 characters)".to_string(),
        ));
    }
    if !name
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return Err(LibvirtError::Invalid(
            "Name contains invalid characters (allowed: alphanumeric, dash, underscore, dot)"
                .to_string(),
        ));
    }
    if name.starts_with('-') || name.starts_with('.') {
        return Err(LibvirtError::Invalid(
            "Name cannot start with dash or dot".to_string(),
        ));
    }
    Ok(())
}

/// Validate vCPU count: 1-256.
pub fn validate_vcpus(vcpus: u32) -> Result<(), LibvirtError> {
    if vcpus == 0 || vcpus > 256 {
        return Err(LibvirtError::Invalid(
            "vCPUs must be between 1 and 256".to_string(),
        ));
    }
    Ok(())
}

/// Validate memory: 64 MB to 1 TB.
pub fn validate_memory_mb(memory_mb: u64) -> Result<(), LibvirtError> {
    if memory_mb < 64 {
        return Err(LibvirtError::Invalid(
            "Memory must be at least 64 MB".to_string(),
        ));
    }
    if memory_mb > 1_048_576 {
        return Err(LibvirtError::Invalid(
            "Memory cannot exceed 1 TB (1048576 MB)".to_string(),
        ));
    }
    Ok(())
}

/// Validate disk size: 1 GB to 10 TB.
pub fn validate_disk_gb(disk_gb: u64) -> Result<(), LibvirtError> {
    if disk_gb == 0 {
        return Err(LibvirtError::Invalid(
            "Disk size must be at least 1 GB".to_string(),
        ));
    }
    if disk_gb > 10_240 {
        return Err(LibvirtError::Invalid(
            "Disk size cannot exceed 10 TB (10240 GB)".to_string(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_name_valid() {
        assert!(validate_name("my-vm").is_ok());
        assert!(validate_name("vm_01").is_ok());
        assert!(validate_name("test.vm").is_ok());
        assert!(validate_name("a").is_ok());
    }

    #[test]
    fn test_validate_name_empty() {
        assert!(validate_name("").is_err());
    }

    #[test]
    fn test_validate_name_too_long() {
        let long = "a".repeat(65);
        assert!(validate_name(&long).is_err());
        assert!(validate_name(&"a".repeat(64)).is_ok());
    }

    #[test]
    fn test_validate_name_invalid_chars() {
        assert!(validate_name("my vm").is_err());
        assert!(validate_name("vm@host").is_err());
        assert!(validate_name("foo/bar").is_err());
        assert!(validate_name("a<b").is_err());
    }

    #[test]
    fn test_validate_name_bad_start() {
        assert!(validate_name("-myvm").is_err());
        assert!(validate_name(".myvm").is_err());
    }

    #[test]
    fn test_validate_vcpus() {
        assert!(validate_vcpus(0).is_err());
        assert!(validate_vcpus(1).is_ok());
        assert!(validate_vcpus(256).is_ok());
        assert!(validate_vcpus(257).is_err());
    }

    #[test]
    fn test_validate_memory_mb() {
        assert!(validate_memory_mb(63).is_err());
        assert!(validate_memory_mb(64).is_ok());
        assert!(validate_memory_mb(1_048_576).is_ok());
        assert!(validate_memory_mb(1_048_577).is_err());
    }

    #[test]
    fn test_validate_disk_gb() {
        assert!(validate_disk_gb(0).is_err());
        assert!(validate_disk_gb(1).is_ok());
        assert!(validate_disk_gb(10_240).is_ok());
        assert!(validate_disk_gb(10_241).is_err());
    }
}
