output "autoscaling_group_id" {
  description = "ID of the Auto Scaling Group"
  value       = aws_autoscaling_group.hypersdk.id
}

output "autoscaling_group_name" {
  description = "Name of the Auto Scaling Group"
  value       = aws_autoscaling_group.hypersdk.name
}

output "autoscaling_group_arn" {
  description = "ARN of the Auto Scaling Group"
  value       = aws_autoscaling_group.hypersdk.arn
}

output "security_group_id" {
  description = "ID of the security group"
  value       = aws_security_group.hypersdk.id
}

output "iam_role_arn" {
  description = "ARN of the IAM role"
  value       = aws_iam_role.hypersdk.arn
}

output "iam_role_name" {
  description = "Name of the IAM role"
  value       = aws_iam_role.hypersdk.name
}

output "launch_template_id" {
  description = "ID of the launch template"
  value       = aws_launch_template.hypersdk.id
}

output "launch_template_latest_version" {
  description = "Latest version of the launch template"
  value       = aws_launch_template.hypersdk.latest_version
}
