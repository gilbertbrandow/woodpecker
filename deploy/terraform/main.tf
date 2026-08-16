terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

data "aws_caller_identity" "current" {}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_key_pair" "woodpecker" {
  key_name   = "${var.project}-key"
  public_key = var.ssh_public_key
}

resource "aws_security_group" "woodpecker" {
  name        = "${var.project}-sg"
  description = "Woodpecker EC2 security group"

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project}-sg"
  }
}

resource "aws_instance" "woodpecker" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  availability_zone      = var.availability_zone
  key_name               = aws_key_pair.woodpecker.key_name
  vpc_security_group_ids = [aws_security_group.woodpecker.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_backup.name

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 15
    delete_on_termination = false
  }

  lifecycle {
    ignore_changes  = [ami, user_data]
    prevent_destroy = true
  }

  user_data = <<-EOF
    #!/bin/bash
    set -e
    apt-get update
    apt-get install -y ca-certificates curl certbot
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable" > /etc/apt/sources.list.d/docker.list
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    usermod -aG docker ubuntu
    systemctl enable docker
    systemctl start docker
    mkdir -p /opt/woodpecker/deploy/nginx
    mkdir -p /var/www/certbot
    chown -R ubuntu:ubuntu /opt/woodpecker
    mkdir -p /etc/letsencrypt/renewal-hooks/deploy
    cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh << 'HOOK'
    #!/bin/bash
    cd /opt/woodpecker
    docker compose -f docker-compose.yml -f docker-compose-prod.yml restart nginx
    HOOK
    chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
  EOF

  tags = {
    Name = var.project
  }
}

resource "aws_eip" "woodpecker" {
  domain = "vpc"

  tags = {
    Name = "${var.project}-eip"
  }
}

resource "aws_eip_association" "woodpecker" {
  instance_id   = aws_instance.woodpecker.id
  allocation_id = aws_eip.woodpecker.id
}

# ── Dedicated pgdata EBS volume ────────────────────────────────────────────────
# Separate from the root volume so DB data survives instance termination.
# NEVER remove prevent_destroy unless you intend to permanently destroy all data.

resource "aws_ebs_volume" "pgdata" {
  availability_zone = var.availability_zone
  size              = 5
  type              = "gp3"

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name = "${var.project}-pgdata"
  }
}

resource "aws_volume_attachment" "pgdata" {
  device_name = "/dev/sdf"
  volume_id   = aws_ebs_volume.pgdata.id
  instance_id = aws_instance.woodpecker.id
}

resource "aws_s3_bucket" "backups" {
  bucket = "woodpecker-db-backups-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name = "${var.project}-db-backups"
  }
}

resource "aws_s3_bucket_public_access_block" "backups" {
  bucket                  = aws_s3_bucket.backups.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
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
    id     = "expire-old-backups"
    status = "Enabled"

    filter {}

    expiration {
      days = 30
    }
  }
}

resource "aws_iam_role" "ec2_backup" {
  name = "${var.project}-ec2-backup-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Name = "${var.project}-ec2-backup-role"
  }
}

resource "aws_iam_policy" "s3_backup_write" {
  name = "${var.project}-s3-backup-write"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket"
      ]
      Resource = [
        aws_s3_bucket.backups.arn,
        "${aws_s3_bucket.backups.arn}/*"
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ec2_backup" {
  role       = aws_iam_role.ec2_backup.name
  policy_arn = aws_iam_policy.s3_backup_write.arn
}

resource "aws_iam_instance_profile" "ec2_backup" {
  name = "${var.project}-ec2-backup-profile"
  role = aws_iam_role.ec2_backup.name
}

# ── CloudWatch alerting ────────────────────────────────────────────────────────
# Requires alert_email to be set in terraform.tfvars.
# After `terraform apply`, confirm the subscription email AWS sends to that address.

locals {
  enable_alerts       = var.alert_email != ""
  enable_health_check = local.enable_alerts && var.domain_name != ""
}

# ── SNS — eu-west-1 (EC2 / CloudWatch alarms) ─────────────────────────────────

resource "aws_sns_topic" "alerts" {
  count = local.enable_alerts ? 1 : 0
  name  = "${var.project}-alerts"
}

resource "aws_sns_topic_subscription" "email" {
  count     = local.enable_alerts ? 1 : 0
  topic_arn = aws_sns_topic.alerts[0].arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ── SNS — us-east-1 (Route 53 health check metrics only appear here) ──────────

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

resource "aws_sns_topic" "alerts_us_east_1" {
  count    = local.enable_health_check ? 1 : 0
  provider = aws.us_east_1
  name     = "${var.project}-alerts"
}

resource "aws_sns_topic_subscription" "email_us_east_1" {
  count     = local.enable_health_check ? 1 : 0
  provider  = aws.us_east_1
  topic_arn = aws_sns_topic.alerts_us_east_1[0].arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ── Route 53 health check ──────────────────────────────────────────────────────
# Probes https://<domain> every 30 s from multiple AWS regions.
# After 3 consecutive failures the alarm fires — detection time ~90 seconds.

resource "aws_route53_health_check" "site" {
  count             = local.enable_health_check ? 1 : 0
  fqdn              = var.domain_name
  port              = 443
  type              = "HTTPS"
  resource_path     = "/"
  failure_threshold = 3
  request_interval  = 30

  tags = {
    Name = "${var.project}-site-health"
  }
}

resource "aws_cloudwatch_metric_alarm" "site_down" {
  count               = local.enable_health_check ? 1 : 0
  provider            = aws.us_east_1
  alarm_name          = "${var.project}-site-down"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = 60
  statistic           = "Minimum"
  threshold           = 1
  alarm_description   = "${var.domain_name} is not responding to HTTPS — site is down."
  alarm_actions       = [aws_sns_topic.alerts_us_east_1[0].arn]
  ok_actions          = [aws_sns_topic.alerts_us_east_1[0].arn]

  dimensions = {
    HealthCheckId = aws_route53_health_check.site[0].id
  }
}

# ── EC2 status check alarms ────────────────────────────────────────────────────
# instance: OS/network not responding (e.g. DHCP loss, kernel hang).
# system:   AWS hardware failure — open a support case if this fires.

resource "aws_cloudwatch_metric_alarm" "instance_status_failed" {
  count               = local.enable_alerts ? 1 : 0
  alarm_name          = "${var.project}-instance-status-failed"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "StatusCheckFailed_Instance"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "EC2 instance status check failing — OS or network not responding. Stop/start the instance."
  alarm_actions       = [aws_sns_topic.alerts[0].arn]
  ok_actions          = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    InstanceId = aws_instance.woodpecker.id
  }
}

resource "aws_cloudwatch_metric_alarm" "system_status_failed" {
  count               = local.enable_alerts ? 1 : 0
  alarm_name          = "${var.project}-system-status-failed"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "StatusCheckFailed_System"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "EC2 system status check failing — likely an AWS hardware issue. Open an AWS support case."
  alarm_actions       = [aws_sns_topic.alerts[0].arn]
  ok_actions          = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    InstanceId = aws_instance.woodpecker.id
  }
}

# ── CPU credit alarm ───────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "cpu_credit_low" {
  count               = local.enable_alerts ? 1 : 0
  alarm_name          = "${var.project}-cpu-credit-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUCreditBalance"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 20
  alarm_description   = "t3.micro CPU credit balance is low — throttling imminent. Consider resizing to t3.small."
  alarm_actions       = [aws_sns_topic.alerts[0].arn]
  ok_actions          = [aws_sns_topic.alerts[0].arn]

  dimensions = {
    InstanceId = aws_instance.woodpecker.id
  }
}
