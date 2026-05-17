resource "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = ["sts.amazonaws.com"]

  # GitHub's OIDC CA thumbprint — AWS verifies this for non-AWS-managed providers.
  # Obtain via: openssl s_client -connect token.actions.githubusercontent.com:443 2>/dev/null \
  #   | openssl x509 -fingerprint -noout -sha1
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

resource "aws_iam_role" "github_actions_cost_reporter" {
  name = "${var.project}-github-cost-reporter"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github_actions.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:gilbertbrandow/woodpecker:*"
        }
      }
    }]
  })

  tags = {
    Name = "${var.project}-github-cost-reporter"
  }
}

resource "aws_iam_policy" "cost_explorer_read" {
  name = "${var.project}-cost-explorer-read"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ce:GetCostAndUsage"]
      Resource = "*"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "github_actions_cost_reporter" {
  role       = aws_iam_role.github_actions_cost_reporter.name
  policy_arn = aws_iam_policy.cost_explorer_read.arn
}

output "github_actions_cost_reporter_role_arn" {
  description = "IAM role ARN for the GitHub Actions cost reporter — set as AWS_COST_REPORTER_ROLE_ARN in GitHub secrets"
  value       = aws_iam_role.github_actions_cost_reporter.arn
}
