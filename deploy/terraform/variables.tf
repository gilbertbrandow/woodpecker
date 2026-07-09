variable "region" {
  type    = string
  default = "eu-west-1"
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "ssh_public_key" {
  type        = string
  description = "Contents of the SSH public key to install on the instance (e.g. contents of ~/.ssh/id_ed25519.pub)"
}

variable "project" {
  type    = string
  default = "woodpecker"
}

variable "domain_name" {
  type        = string
  description = "Your domain (e.g. woodpecker.example.com). Leave empty to skip DNS setup."
  default     = ""
}

variable "alert_email" {
  type        = string
  description = "Email address for CloudWatch infrastructure alerts (e.g. CPU credit low). Leave empty to skip alarm setup."
  default     = ""
}

variable "availability_zone" {
  type        = string
  description = "AZ for the EC2 instance and pgdata EBS volume. Must match — EBS volumes cannot be moved between AZs."
  default     = "eu-west-1a"
}
