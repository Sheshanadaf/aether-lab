output "api_endpoint" {
  value = aws_apigatewayv2_api.http.api_endpoint
}

output "cloudfront_url" {
  value = "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "site_url" {
  value = var.attach_custom_domain ? "https://${var.custom_domain}" : "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "cloudfront_dns_target" {
  description = "Paste this as the CNAME target for @ and www in Cloudflare (DNS only / grey cloud)."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "acm_validation_records" {
  description = "Add these CNAMEs in Cloudflare first. Proxy must be off (DNS only)."
  value = var.enable_custom_domain ? [
    for dvo in aws_acm_certificate.site[0].domain_validation_options : {
      type  = dvo.resource_record_type
      name  = trimsuffix(dvo.resource_record_name, ".")
      value = trimsuffix(dvo.resource_record_value, ".")
    }
  ] : []
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