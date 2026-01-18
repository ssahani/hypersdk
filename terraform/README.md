# HyperSDK Terraform Modules

Terraform modules for deploying HyperSDK infrastructure on AWS.

## Features

- **Auto Scaling**: Automatic scaling based on CPU utilization
- **High Availability**: Multi-AZ deployment with health checks
- **Security**: Encrypted volumes, security groups, IAM roles
- **Monitoring**: CloudWatch metrics and alarms, Prometheus integration
- **Backup**: Automated backups to S3 with retention policies
- **Logging**: CloudWatch Logs integration

## Modules

### Compute Module

Manages EC2 instances, Auto Scaling Groups, and related resources.

**Features**:
- Launch template with user data for daemon installation
- Auto Scaling Group with health checks
- Security groups for dashboard, API, and monitoring access
- IAM roles and policies for S3 backup and CloudWatch Logs
- CloudWatch alarms for CPU-based scaling
- Encrypted EBS volumes

### Network Module (Planned)

Manages VPC, subnets, route tables, and NAT gateways.

### Storage Module (Planned)

Manages S3 buckets for backups and ElastiCache Redis for caching.

### Monitoring Module (Planned)

Manages Prometheus, Grafana, and Alertmanager deployment.

## Quick Start

### Prerequisites

- Terraform >= 1.0
- AWS CLI configured with appropriate credentials
- SSH key pair for EC2 access

### Basic Example

```hcl
module "hypersdk_compute" {
  source = "./modules/compute"

  name_prefix = "prod"
  vpc_id      = "vpc-12345678"
  subnet_ids  = [
    "subnet-12345678",
    "subnet-87654321",
    "subnet-11111111"
  ]

  ami_id           = "ami-0c55b159cbfafe1f0"  # Ubuntu 22.04 LTS
  instance_type    = "t3.medium"
  key_name         = "my-ssh-key"
  backup_bucket    = "my-hypersdk-backups"
  redis_endpoint   = "redis.example.com:6379"

  min_size         = 2
  max_size         = 10
  desired_capacity = 3

  enable_autoscaling = true
  enable_monitoring  = true

  allowed_cidr_blocks = ["10.0.0.0/8"]
  ssh_cidr_blocks     = ["203.0.113.0/24"]

  tags = {
    Environment = "production"
    Project     = "HyperSDK"
    ManagedBy   = "Terraform"
  }
}
```

### Deployment Steps

1. **Initialize Terraform**:
   ```bash
   terraform init
   ```

2. **Review planned changes**:
   ```bash
   terraform plan
   ```

3. **Apply configuration**:
   ```bash
   terraform apply
   ```

4. **Access outputs**:
   ```bash
   terraform output
   ```

## Configuration

### Compute Module Variables

| Variable | Description | Type | Default | Required |
|----------|-------------|------|---------|----------|
| name_prefix | Prefix for resource names | string | - | yes |
| vpc_id | VPC ID | string | - | yes |
| subnet_ids | Subnet IDs for ASG | list(string) | - | yes |
| ami_id | AMI ID | string | - | yes |
| instance_type | EC2 instance type | string | t3.medium | no |
| key_name | SSH key pair name | string | - | yes |
| backup_bucket | S3 bucket for backups | string | - | yes |
| min_size | Minimum instances | number | 1 | no |
| max_size | Maximum instances | number | 10 | no |
| desired_capacity | Desired instances | number | 2 | no |
| enable_autoscaling | Enable auto scaling | bool | true | no |
| enable_monitoring | Enable monitoring | bool | true | no |
| cpu_high_threshold | CPU threshold for scale up | number | 75 | no |
| cpu_low_threshold | CPU threshold for scale down | number | 25 | no |
| tags | Resource tags | map(string) | {} | no |

### Compute Module Outputs

| Output | Description |
|--------|-------------|
| autoscaling_group_id | Auto Scaling Group ID |
| autoscaling_group_name | Auto Scaling Group name |
| security_group_id | Security group ID |
| iam_role_arn | IAM role ARN |
| launch_template_id | Launch template ID |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    VPC (10.0.0.0/16)                │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │  Public AZ-A │  │  Public AZ-B │  │ Public...│ │
│  │              │  │              │  │          │ │
│  │    ALB       │  │              │  │          │ │
│  └──────┬───────┘  └──────────────┘  └──────────┘ │
│         │                                          │
│  ┌──────┴───────┐  ┌──────────────┐  ┌──────────┐ │
│  │ Private AZ-A │  │ Private AZ-B │  │ Private..│ │
│  │              │  │              │  │          │ │
│  │  HyperSDK    │  │  HyperSDK    │  │ HyperSDK │ │
│  │  Instance    │  │  Instance    │  │ Instance │ │
│  │              │  │              │  │          │ │
│  └──────┬───────┘  └──────┬───────┘  └────┬─────┘ │
│         │                  │               │       │
│         └──────────────────┴───────────────┘       │
│                            │                        │
│                    ┌───────┴────────┐              │
│                    │  ElastiCache   │              │
│                    │     Redis      │              │
│                    └────────────────┘              │
└─────────────────────────────────────────────────────┘
                            │
                    ┌───────┴────────┐
                    │   S3 Backup    │
                    │     Bucket     │
                    └────────────────┘
```

## Security

### Best Practices

1. **Network Security**:
   - Use private subnets for HyperSDK instances
   - Restrict security group ingress rules
   - Use VPC endpoints for AWS services

2. **IAM**:
   - Follow least privilege principle
   - Use instance profiles instead of access keys
   - Enable IAM Access Analyzer

3. **Encryption**:
   - Enable EBS encryption
   - Use S3 bucket encryption
   - Enable Redis encryption in transit

4. **Monitoring**:
   - Enable detailed CloudWatch monitoring
   - Set up CloudWatch alarms
   - Use AWS Config for compliance

### Security Group Rules

- **Port 8080**: Dashboard (restrict to internal network)
- **Port 8081**: API (restrict to internal network)
- **Port 9090**: Prometheus metrics (restrict to monitoring network)
- **Port 22**: SSH (restrict to bastion/admin network)

## Monitoring

### CloudWatch Metrics

The module creates the following CloudWatch alarms:

- **High CPU**: Triggers when CPU > 75% for 10 minutes
- **Low CPU**: Triggers when CPU < 25% for 10 minutes

### Prometheus Integration

When `enable_monitoring = true`:
- Node Exporter installed on port 9100
- Custom HyperSDK metrics on port 9090
- Metrics auto-discovered via ASG tags

## Backup and Restore

### Automated Backups

Backups are automatically created every 24 hours and stored in S3:

```
s3://<backup_bucket>/
  ├── backups/
  │   ├── backup-1234567890.tar.gz
  │   ├── backup-1234567891.tar.gz
  │   └── backup-1234567892.tar.gz
  └── metadata/
      ├── backup-1234567890.json
      ├── backup-1234567891.json
      └── backup-1234567892.json
```

### Retention Policy

- Default retention: 30 days
- Maximum backups: 10
- Configurable via `config.yaml`

## Auto Scaling

### Scaling Policies

- **Scale Up**: Add 1 instance when CPU > 75% for 10 min
- **Scale Down**: Remove 1 instance when CPU < 25% for 10 min
- **Cooldown**: 5 minutes between scaling actions

### Health Checks

- **Type**: ELB health check
- **Grace Period**: 5 minutes
- **Unhealthy Threshold**: 2 consecutive failures

## Logging

### CloudWatch Logs

Logs are sent to CloudWatch Logs groups:

- `/hypersdk/daemon`: Daemon application logs
- `/aws/ec2/instance`: System logs

### Log Retention

- Default: 7 days
- Configurable via CloudWatch Logs settings

## Customization

### User Data Script

The module includes a user data script that:
1. Installs Docker and Docker Compose
2. Configures CloudWatch Logs agent
3. Downloads and configures HyperSDK daemon
4. Creates systemd service
5. Installs monitoring tools (if enabled)

To customize, modify `user_data.sh` in the module directory.

### AMI Selection

Use the latest Ubuntu 22.04 LTS AMI:

```bash
aws ec2 describe-images \
  --owners 099720109477 \
  --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
  --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
  --output text
```

## Cost Optimization

### Recommendations

1. **Instance Types**:
   - Development: t3.small ($0.0208/hour)
   - Production: t3.medium ($0.0416/hour)
   - High performance: c6i.xlarge ($0.17/hour)

2. **Auto Scaling**:
   - Set appropriate min/max/desired capacity
   - Use scheduled scaling for predictable workloads
   - Monitor CPU utilization thresholds

3. **Storage**:
   - Use gp3 instead of gp2 (up to 20% savings)
   - Right-size EBS volumes
   - Clean up old backups

4. **Reserved Instances**:
   - Consider 1-year or 3-year commitments for stable workloads
   - Potential savings: 30-70%

## Troubleshooting

### Common Issues

**Issue**: Instances fail health checks

**Solution**:
- Check security group rules
- Verify daemon is running: `systemctl status hypersdk`
- Check logs: `/var/log/hypersdk/daemon.log`

**Issue**: Auto scaling not working

**Solution**:
- Verify CloudWatch alarms exist
- Check alarm state: `aws cloudwatch describe-alarms`
- Ensure `enable_autoscaling = true`

**Issue**: Can't access dashboard

**Solution**:
- Verify security group allows port 8080
- Check instance is in target group
- Verify ALB health checks passing

## Examples

Complete examples are available in the `examples/` directory:

- `examples/aws/basic`: Basic single-region deployment
- `examples/aws/multi-region`: Multi-region deployment with failover
- `examples/aws/production`: Production-ready configuration

## Contributing

When adding new features to the Terraform modules:

1. Update module documentation
2. Add examples
3. Test in development environment
4. Run `terraform fmt` and `terraform validate`
5. Update CHANGELOG

## License

SPDX-License-Identifier: LGPL-3.0-or-later
