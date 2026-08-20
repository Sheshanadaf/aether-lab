resource "aws_s3_bucket" "uploads" {
  bucket_prefix = "${var.project}-uploads-"
}

resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule {
    id     = "expire-inbox"
    status = "Enabled"
    filter {}
    expiration {
      days = 7
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  cors_rule {
    allowed_headers = ["content-type", "content-length"]
    allowed_methods = ["PUT", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["etag"]
    max_age_seconds = 300
  }
}

resource "aws_s3_bucket_notification" "uploads" {
  bucket      = aws_s3_bucket.uploads.id
  eventbridge = true
}