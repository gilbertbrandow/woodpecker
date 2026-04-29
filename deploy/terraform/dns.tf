locals {
  has_domain = var.domain_name != ""
}

resource "aws_route53_zone" "woodpecker" {
  count = local.has_domain ? 1 : 0
  name  = var.domain_name
}

resource "aws_route53_record" "root" {
  count   = local.has_domain ? 1 : 0
  zone_id = aws_route53_zone.woodpecker[0].zone_id
  name    = var.domain_name
  type    = "A"
  ttl     = 300
  records = [aws_eip.woodpecker.public_ip]
}

resource "aws_route53_record" "www" {
  count   = local.has_domain ? 1 : 0
  zone_id = aws_route53_zone.woodpecker[0].zone_id
  name    = "www.${var.domain_name}"
  type    = "CNAME"
  ttl     = 300
  records = [var.domain_name]
}
