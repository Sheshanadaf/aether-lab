data "aws_iam_policy_document" "github_actions_deploy" {
  statement {
    sid = "DeployAetherLive"
    actions = [
      "s3:*",
      "cloudfront:*",
      "lambda:*",
      "apigateway:*",
      "dynamodb:*",
      "logs:*",
      "iam:GetRole",
      "iam:GetRolePolicy",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:PassRole",
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:PutRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
      "iam:UpdateAssumeRolePolicy",
      "events:*",
      "sqs:*",
    ]
    resources = ["*"]
  }

  statement {
    sid = "StateAndLock"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket",
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
      "dynamodb:DescribeTable",
      "sqs:*",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  name   = "aether-lab-live-deploy"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.github_actions_deploy.json
}