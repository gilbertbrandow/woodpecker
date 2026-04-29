output "elastic_ip" {
  description = "Elastic IP — set this as EC2_HOST in GitHub secrets"
  value       = aws_eip.woodpecker.public_ip
}

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.woodpecker.id
}

output "name_servers" {
  description = "Set these as the nameservers at your domain registrar (only shown when domain_name is set)"
  value       = length(aws_route53_zone.woodpecker) > 0 ? aws_route53_zone.woodpecker[0].name_servers : []
}
