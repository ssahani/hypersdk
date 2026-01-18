variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where resources will be created"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for the Auto Scaling Group"
  type        = list(string)
}

variable "ami_id" {
  description = "AMI ID for HyperSDK instances"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.medium"
}

variable "key_name" {
  description = "SSH key pair name"
  type        = string
}

variable "min_size" {
  description = "Minimum number of instances"
  type        = number
  default     = 1
}

variable "max_size" {
  description = "Maximum number of instances"
  type        = number
  default     = 10
}

variable "desired_capacity" {
  description = "Desired number of instances"
  type        = number
  default     = 2
}

variable "root_volume_size" {
  description = "Size of root EBS volume in GB"
  type        = number
  default     = 50
}

variable "volume_type" {
  description = "EBS volume type"
  type        = string
  default     = "gp3"
}

variable "daemon_version" {
  description = "HyperSDK daemon version to install"
  type        = string
  default     = "latest"
}

variable "redis_endpoint" {
  description = "Redis endpoint for caching"
  type        = string
  default     = ""
}

variable "backup_bucket" {
  description = "S3 bucket for backups"
  type        = string
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access dashboard and API"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "ssh_cidr_blocks" {
  description = "CIDR blocks allowed for SSH access"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "monitoring_cidr_blocks" {
  description = "CIDR blocks allowed to access monitoring endpoints"
  type        = list(string)
  default     = ["10.0.0.0/8"]
}

variable "enable_autoscaling" {
  description = "Enable auto scaling based on CPU"
  type        = bool
  default     = true
}

variable "enable_monitoring" {
  description = "Enable monitoring with Prometheus"
  type        = bool
  default     = true
}

variable "enable_detailed_monitoring" {
  description = "Enable detailed CloudWatch monitoring"
  type        = bool
  default     = false
}

variable "cpu_high_threshold" {
  description = "CPU threshold for scaling up"
  type        = number
  default     = 75
}

variable "cpu_low_threshold" {
  description = "CPU threshold for scaling down"
  type        = number
  default     = 25
}

variable "target_group_arns" {
  description = "List of target group ARNs for load balancer"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
