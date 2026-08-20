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
  description = "sheshanhebron61@gmail.com"
}

variable "github_owner" {
  type        = string
  description = "GitHub user or org. Must match the URL: github.com/OWNER/repo"
  default     = "Sheshanadaf"
}

variable "github_repo" {
  type        = string
  description = "Repository name only, e.g. aether-lab"
  default     = "aether-lab"
}

# GitHub numeric IDs. Repos created after 15 Jul 2026 put these in the OIDC sub
# claim: repo:OWNER@OWNER_ID/REPO@REPO_ID:ref:refs/heads/main
variable "github_owner_id" {
  type        = string
  description = "Numeric GitHub user/org id (API: owner.id)"
  default     = "115085953"
}

variable "github_repo_id" {
  type        = string
  description = "Numeric GitHub repository id (API: repo.id)"
  default     = "1339776175"
}