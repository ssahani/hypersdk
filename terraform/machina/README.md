# Machina Platform Terraform Provider (skeleton)

This directory holds a **stub** Terraform provider for machina-controller resources. Full provider implementation is tracked for batch 16 after API stabilization.

## Planned resources

- `machina_host`
- `machina_vm`
- `machina_storage_pool`
- `machina_network`
- `machina_project_quota`

## Local development

```bash
export MACHINA_CONTROLLER_URL=http://127.0.0.1:5093
export MACHINA_CONTROLLER_USER=admin
export MACHINA_CONTROLLER_PASS=...

# Use platformctl or curl until provider is published
./scripts/platformctl vms
```

## Example (future)

```hcl
terraform {
  required_providers {
    machina = {
      source = "zyvor/machina"
    }
  }
}

provider "machina" {
  url      = "http://212.8.252.194:5093"
  username = var.controller_user
  password = var.controller_pass
}

resource "machina_vm" "web" {
  name          = "web-01"
  desired_state = "running"
  vcpus         = 2
  memory_mib    = 4096
}
```

See [`docs/platform-roadmap.md`](../../docs/platform-roadmap.md) for batch tracker.
