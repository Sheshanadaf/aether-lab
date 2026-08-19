output "state_bucket" {
  value = aws_s3_bucket.tfstate.id
}

output "lock_table" {
  value = aws_dynamodb_table.tf_lock.name
}

output "github_actions_role_arn" {
  value = aws_iam_role.github_actions.arn
}