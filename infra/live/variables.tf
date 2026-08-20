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
}