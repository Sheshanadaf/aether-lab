output "api_endpoint" {
  value = aws_apigatewayv2_api.http.api_endpoint
}

output "cloudfront_url" {
  value = "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "site_bucket" {
  value = aws_s3_bucket.site.id
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.site.id
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.lab.id
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.lab.id
}