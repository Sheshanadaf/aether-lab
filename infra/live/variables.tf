variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "project" {
  type    = string
  default = "aether-lab"
}

variable "alert_email" {
  type        = string
  description = "SNS alarm email. You must Confirm the subscription in your inbox."
  default     = "sheshanhebron61@gmail.com"
}

variable "custom_domain" {
  type        = string
  description = "Apex domain for CloudFront. DNS lives at Cloudflare; ACM stays in us-east-1."
  default     = "sheshanhebron.com"
}

variable "enable_custom_domain" {
  type        = bool
  description = "Request the ACM cert. Keep true now that sheshanhebron.com is live."
  default     = true
}

variable "attach_custom_domain" {
  type        = bool
  description = "Attach ACM + CloudFront aliases. Keep true so CI does not drop the custom domain."
  default     = true
}