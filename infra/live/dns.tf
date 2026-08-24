resource "aws_acm_certificate" "site" {
  count                     = var.enable_custom_domain ? 1 : 0
  provider                  = aws.use1
  domain_name               = var.custom_domain
  subject_alternative_names = ["www.${var.custom_domain}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# Waits until Cloudflare CNAMEs are in place. Do not set attach_custom_domain
# until you have added the acm_validation_records output in Cloudflare (DNS only).
resource "aws_acm_certificate_validation" "site" {
  count           = var.attach_custom_domain ? 1 : 0
  provider        = aws.use1
  certificate_arn = aws_acm_certificate.site[0].arn
}
