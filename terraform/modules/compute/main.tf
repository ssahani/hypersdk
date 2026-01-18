# HyperSDK Compute Module
# Manages VM instances for running HyperSDK daemon

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Security group for HyperSDK instances
resource "aws_security_group" "hypersdk" {
  name_prefix = "${var.name_prefix}-hypersdk-"
  description = "Security group for HyperSDK instances"
  vpc_id      = var.vpc_id

  # Dashboard access
  ingress {
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
    description = "HyperSDK Dashboard"
  }

  # API access
  ingress {
    from_port   = 8081
    to_port     = 8081
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidr_blocks
    description = "HyperSDK API"
  }

  # Prometheus metrics
  ingress {
    from_port   = 9090
    to_port     = 9090
    protocol    = "tcp"
    cidr_blocks = var.monitoring_cidr_blocks
    description = "Prometheus Metrics"
  }

  # SSH access
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_cidr_blocks
    description = "SSH Access"
  }

  # Allow all outbound
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.name_prefix}-hypersdk-sg"
    }
  )
}

# Launch template for HyperSDK instances
resource "aws_launch_template" "hypersdk" {
  name_prefix   = "${var.name_prefix}-hypersdk-"
  image_id      = var.ami_id
  instance_type = var.instance_type

  iam_instance_profile {
    name = aws_iam_instance_profile.hypersdk.name
  }

  key_name = var.key_name

  vpc_security_group_ids = [aws_security_group.hypersdk.id]

  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    daemon_version    = var.daemon_version
    redis_endpoint    = var.redis_endpoint
    backup_bucket     = var.backup_bucket
    monitoring_enable = var.enable_monitoring
  }))

  block_device_mappings {
    device_name = "/dev/sda1"

    ebs {
      volume_size           = var.root_volume_size
      volume_type           = var.volume_type
      delete_on_termination = true
      encrypted             = true
    }
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  monitoring {
    enabled = var.enable_detailed_monitoring
  }

  tag_specifications {
    resource_type = "instance"
    tags = merge(
      var.tags,
      {
        Name = "${var.name_prefix}-hypersdk"
      }
    )
  }

  tag_specifications {
    resource_type = "volume"
    tags = merge(
      var.tags,
      {
        Name = "${var.name_prefix}-hypersdk-volume"
      }
    )
  }

  tags = var.tags
}

# Auto Scaling Group
resource "aws_autoscaling_group" "hypersdk" {
  name_prefix         = "${var.name_prefix}-hypersdk-"
  vpc_zone_identifier = var.subnet_ids
  target_group_arns   = var.target_group_arns

  min_size         = var.min_size
  max_size         = var.max_size
  desired_capacity = var.desired_capacity

  health_check_type         = "ELB"
  health_check_grace_period = 300

  launch_template {
    id      = aws_launch_template.hypersdk.id
    version = "$Latest"
  }

  enabled_metrics = [
    "GroupDesiredCapacity",
    "GroupInServiceInstances",
    "GroupMaxSize",
    "GroupMinSize",
    "GroupPendingInstances",
    "GroupStandbyInstances",
    "GroupTerminatingInstances",
    "GroupTotalInstances"
  ]

  dynamic "tag" {
    for_each = var.tags
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }

  tag {
    key                 = "Name"
    value               = "${var.name_prefix}-hypersdk"
    propagate_at_launch = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Auto Scaling Policies
resource "aws_autoscaling_policy" "scale_up" {
  count                  = var.enable_autoscaling ? 1 : 0
  name                   = "${var.name_prefix}-hypersdk-scale-up"
  scaling_adjustment     = 1
  adjustment_type        = "ChangeInCapacity"
  cooldown               = 300
  autoscaling_group_name = aws_autoscaling_group.hypersdk.name
}

resource "aws_autoscaling_policy" "scale_down" {
  count                  = var.enable_autoscaling ? 1 : 0
  name                   = "${var.name_prefix}-hypersdk-scale-down"
  scaling_adjustment     = -1
  adjustment_type        = "ChangeInCapacity"
  cooldown               = 300
  autoscaling_group_name = aws_autoscaling_group.hypersdk.name
}

# CloudWatch Alarms for Auto Scaling
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  count               = var.enable_autoscaling ? 1 : 0
  alarm_name          = "${var.name_prefix}-hypersdk-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = var.cpu_high_threshold

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.hypersdk.name
  }

  alarm_actions = [aws_autoscaling_policy.scale_up[0].arn]
  alarm_description = "Triggers scale up when CPU exceeds ${var.cpu_high_threshold}%"
}

resource "aws_cloudwatch_metric_alarm" "low_cpu" {
  count               = var.enable_autoscaling ? 1 : 0
  alarm_name          = "${var.name_prefix}-hypersdk-low-cpu"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = var.cpu_low_threshold

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.hypersdk.name
  }

  alarm_actions     = [aws_autoscaling_policy.scale_down[0].arn]
  alarm_description = "Triggers scale down when CPU below ${var.cpu_low_threshold}%"
}

# IAM Role for EC2 instances
resource "aws_iam_role" "hypersdk" {
  name_prefix = "${var.name_prefix}-hypersdk-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# IAM Policy for S3 backup access
resource "aws_iam_role_policy" "s3_backup" {
  name_prefix = "${var.name_prefix}-s3-backup-"
  role        = aws_iam_role.hypersdk.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.backup_bucket}",
          "arn:aws:s3:::${var.backup_bucket}/*"
        ]
      }
    ]
  })
}

# IAM Policy for CloudWatch Logs
resource "aws_iam_role_policy" "cloudwatch_logs" {
  name_prefix = "${var.name_prefix}-cloudwatch-logs-"
  role        = aws_iam_role.hypersdk.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# IAM Instance Profile
resource "aws_iam_instance_profile" "hypersdk" {
  name_prefix = "${var.name_prefix}-hypersdk-"
  role        = aws_iam_role.hypersdk.name

  tags = var.tags
}
