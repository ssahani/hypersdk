variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
  default     = "prod"
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
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

variable "min_instances" {
  description = "Minimum number of instances"
  type        = number
  default     = 2
}

variable "max_instances" {
  description = "Maximum number of instances"
  type        = number
  default     = 10
}

variable "desired_instances" {
  description = "Desired number of instances"
  type        = number
  default     = 3
}

variable "enable_redis" {
  description = "Enable ElastiCache Redis"
  type        = bool
  default     = true
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_nodes" {
  description = "Number of Redis nodes"
  type        = number
  default     = 2
}

variable "enable_autoscaling" {
  description = "Enable auto scaling"
  type        = bool
  default     = true
}

variable "enable_monitoring" {
  description = "Enable monitoring"
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

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access dashboard and API"
  type        = list(string)
  default     = ["10.0.0.0/8"]
}

variable "ssh_cidr_blocks" {
  description = "CIDR blocks allowed for SSH access"
  type        = list(string)
  default     = ["10.0.0.0/8"]
}

variable "monitoring_cidr_blocks" {
  description = "CIDR blocks allowed to access monitoring endpoints"
  type        = list(string)
  default     = ["10.0.0.0/8"]
}
