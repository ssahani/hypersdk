# Example HyperSDK deployment on AWS

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend configuration for state storage
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "hypersdk/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "HyperSDK"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# Data sources for existing resources
data "aws_vpc" "main" {
  id = var.vpc_id
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }

  tags = {
    Tier = "private"
  }
}

# S3 bucket for backups
resource "aws_s3_bucket" "backups" {
  bucket_prefix = "${var.name_prefix}-hypersdk-backups-"

  tags = {
    Name = "${var.name_prefix}-hypersdk-backups"
  }
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "delete-old-backups"
    status = "Enabled"

    expiration {
      days = 30
    }
  }
}

# ElastiCache Redis cluster (optional)
resource "aws_elasticache_subnet_group" "redis" {
  count      = var.enable_redis ? 1 : 0
  name       = "${var.name_prefix}-redis"
  subnet_ids = data.aws_subnets.private.ids
}

resource "aws_elasticache_replication_group" "redis" {
  count = var.enable_redis ? 1 : 0

  replication_group_id       = "${var.name_prefix}-redis"
  replication_group_description = "Redis cache for HyperSDK"
  engine                     = "redis"
  engine_version             = "7.0"
  node_type                  = var.redis_node_type
  number_cache_clusters      = var.redis_num_nodes
  port                       = 6379
  parameter_group_name       = "default.redis7"
  subnet_group_name          = aws_elasticache_subnet_group.redis[0].name
  security_group_ids         = [aws_security_group.redis[0].id]
  automatic_failover_enabled = var.redis_num_nodes > 1
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  tags = {
    Name = "${var.name_prefix}-redis"
  }
}

resource "aws_security_group" "redis" {
  count       = var.enable_redis ? 1 : 0
  name_prefix = "${var.name_prefix}-redis-"
  description = "Security group for Redis"
  vpc_id      = data.aws_vpc.main.id

  tags = {
    Name = "${var.name_prefix}-redis"
  }
}

# HyperSDK Compute Module
module "hypersdk_compute" {
  source = "../../modules/compute"

  name_prefix = var.name_prefix
  vpc_id      = data.aws_vpc.main.id
  subnet_ids  = data.aws_subnets.private.ids

  ami_id           = var.ami_id
  instance_type    = var.instance_type
  key_name         = var.key_name
  backup_bucket    = aws_s3_bucket.backups.id
  redis_endpoint   = var.enable_redis ? aws_elasticache_replication_group.redis[0].primary_endpoint_address : ""

  min_size         = var.min_instances
  max_size         = var.max_instances
  desired_capacity = var.desired_instances

  enable_autoscaling        = var.enable_autoscaling
  enable_monitoring         = var.enable_monitoring
  enable_detailed_monitoring = var.enable_detailed_monitoring

  cpu_high_threshold = var.cpu_high_threshold
  cpu_low_threshold  = var.cpu_low_threshold

  allowed_cidr_blocks     = var.allowed_cidr_blocks
  ssh_cidr_blocks         = var.ssh_cidr_blocks
  monitoring_cidr_blocks  = var.monitoring_cidr_blocks

  tags = {
    Environment = var.environment
  }
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "hypersdk" {
  count          = var.enable_monitoring ? 1 : 0
  dashboard_name = "${var.name_prefix}-hypersdk"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/EC2", "CPUUtilization", { stat = "Average", label = "CPU Avg" }],
            ["...", { stat = "Maximum", label = "CPU Max" }]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "CPU Utilization"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/AutoScaling", "GroupDesiredCapacity", "AutoScalingGroupName", module.hypersdk_compute.autoscaling_group_name],
            [".", "GroupInServiceInstances", ".", "."],
            [".", "GroupTotalInstances", ".", "."]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "Auto Scaling Group"
        }
      }
    ]
  })
}
