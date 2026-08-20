# Step 6 — Terraform the Cloud Resume core

Bootstrap is done. You already have:

| Output | Value (yours) |
|---|---|
| State bucket | `aether-lab-tfstate-4bb51456` |
| Lock table | `aether-lab-tf-lock` |
| GitHub role | `aether-lab-github-actions` |

**Do not** put the full role ARN or account id in `README.md`. Account id is not a password, but it does not belong on the marketing page.

This step creates the **real app** (still no SQS/quiz/Cognito):

- DynamoDB visitor counter
- Lambda (Python, arm64) + HTTP API
- S3 (private) + CloudFront + **OAC**

You apply from **your laptop** (IAM user). The GitHub role still has **no deploy policy**. That is Step 8.

Region: **`ap-south-1`**.

---

## What you will have at the end

- `terraform output` with `api_endpoint` and `cloudfront_url`
- `curl` (or browser) on the API returns `{"count": 1}` then `2` on the next call
- Opening the CloudFront URL shows a **temporary** HTML page (React wiring is Step 7)

---

## Part A — Point live Terraform at the state bucket

Create folder `infra/live/`.

**`infra/live/backend.hcl.example`** (safe to commit):

```hcl
bucket         = "aether-lab-tfstate-4bb51456"
key            = "live/terraform.tfstate"
region         = "ap-south-1"
dynamodb_table = "aether-lab-tf-lock"
encrypt        = true
```

Copy to `backend.hcl` (gitignored):

```powershell
copy infra\live\backend.hcl.example infra\live\backend.hcl
```

**`infra/live/versions.tf`**

```hcl
terraform {
  required_version = ">= 1.7.0"

  backend "s3" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.100"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.7"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project
      ManagedBy   = "terraform"
      Environment = "prod"
    }
  }
}
```

Empty `backend "s3" {}` is filled by `-backend-config=backend.hcl` at init time.

**`infra/live/variables.tf`**

```hcl
variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "project" {
  type    = string
  default = "aether-lab"
}
```

---

## Part B — Counter Lambda code

Create `backend/functions/counter/handler.py`:

```python
import json
import os

import boto3

TABLE_NAME = os.environ["TABLE_NAME"]
dynamodb = boto3.resource("dynamodb")


def lambda_handler(event, context):
    table = dynamodb.Table(TABLE_NAME)
    result = table.update_item(
        Key={"pk": "SITE#aether", "sk": "COUNTER"},
        UpdateExpression="SET #c = if_not_exists(#c, :zero) + :one",
        ExpressionAttributeNames={"#c": "count"},
        ExpressionAttributeValues={":zero": 0, ":one": 1},
        ReturnValues="UPDATED_NEW",
    )
    count = int(result["Attributes"]["count"])
    request_id = (event.get("requestContext") or {}).get("requestId", "local")

    body = {
        "count": count,
        "trace": {
            "requestId": request_id,
            "path": [
                {"service": "Amazon API Gateway", "role": "HTTP API"},
                {"service": "AWS Lambda", "role": "arm64 increment"},
                {"service": "Amazon DynamoDB", "role": "atomic counter"},
            ],
        },
    }
    return {
        "statusCode": 200,
        "headers": {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
        },
        "body": json.dumps(body),
    }
```

Same idea as Step 4 Part C, plus a `trace` object for Step 7.

---

## Part C — DynamoDB + IAM + Lambda + HTTP API

**`infra/live/data.tf`**

```hcl
resource "aws_dynamodb_table" "app" {
  name         = "${var.project}-app"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }
}
```

**Why pk + sk:** later labs (jobs, quiz) share one table. Counter uses `SITE#aether` / `COUNTER`.

**`infra/live/lambda.tf`** — read this; it is the heart of the step.

```hcl
data "archive_file" "counter" {
  type        = "zip"
  source_dir  = "${path.root}/../../backend/functions/counter"
  output_path = "${path.root}/.build/counter.zip"
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "counter" {
  name               = "${var.project}-counter"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "counter" {
  statement {
    actions   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"]
  }
  statement {
    actions   = ["dynamodb:UpdateItem", "dynamodb:GetItem"]
    resources = [aws_dynamodb_table.app.arn]
  }
}

resource "aws_iam_role_policy" "counter" {
  role   = aws_iam_role.counter.id
  policy = data.aws_iam_policy_document.counter.json
}

resource "aws_cloudwatch_log_group" "counter" {
  name              = "/aws/lambda/${var.project}-counter"
  retention_in_days = 7
}

resource "aws_lambda_function" "counter" {
  function_name    = "${var.project}-counter"
  role             = aws_iam_role.counter.arn
  filename         = data.archive_file.counter.output_path
  source_code_hash = data.archive_file.counter.output_base64sha256
  handler          = "handler.lambda_handler"
  runtime          = "python3.12"
  architectures    = ["arm64"]
  timeout          = 10
  memory_size      = 256

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.app.name
    }
  }

  depends_on = [aws_cloudwatch_log_group.counter]
}
```

**`infra/live/api.tf`**

```hcl
resource "aws_apigatewayv2_api" "http" {
  name          = "${var.project}-http"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["content-type"]
    max_age       = 3600
  }
}

resource "aws_apigatewayv2_integration" "counter" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.counter.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "visits" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /visits"
  target    = "integrations/${aws_apigatewayv2_integration.counter.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.counter.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}
```

HTTP API **v2** event is what `requestContext.requestId` comes from.

---

## Part D — S3 + CloudFront + OAC

**OAC = Origin Access Control:** CloudFront may `s3:GetObject`. The bucket stays **not public**.

**`infra/live/cdn.tf`**

```hcl
resource "aws_s3_bucket" "site" {
  bucket_prefix = "${var.project}-site-"
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  bucket = aws_s3_bucket.site.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "${var.project}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = var.project
  default_root_object = "index.html"
  price_class         = "PriceClass_200"
  wait_for_deployment = false

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "s3-site"
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-site"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1.2_2021"
  }
}

data "aws_iam_policy_document" "site" {
  statement {
    sid     = "AllowCloudFrontOAC"
    actions = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.site.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.site.json
}
```

**PriceClass_200** includes Asian edge locations (better from Colombo than PriceClass_100, which is mostly US/EU).

**`infra/live/outputs.tf`**

```hcl
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
```

Create empty dir for the zip: `infra/live/.build/` (add a `.gitkeep` if you want).

---

## Part E — Apply

```powershell
cd infra\live
mkdir .build -ErrorAction SilentlyContinue
terraform init -backend-config=backend.hcl
terraform plan
```

Read the plan. Expect DynamoDB, IAM role, Lambda, HTTP API, S3, CloudFront, OAC. **No** NAT, EC2, RDS, ALB.

```powershell
terraform apply
```

CloudFront can take several minutes.

```powershell
terraform output
```

---

## Part F — Prove it

**API** (replace with your `api_endpoint`):

```powershell
curl -X POST https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com/visits
```

Run twice. `count` should increase. You should see `trace.path`.

**Temporary HTML** — create `infra/live/placeholder.html`:

```html
<!DOCTYPE html>
<html>
  <body>
    <h1>Aether Lab</h1>
    <p>S3 + CloudFront + OAC. React comes in Step 7.</p>
  </body>
</html>
```

```powershell
aws s3 cp placeholder.html s3://YOUR_SITE_BUCKET/index.html --region ap-south-1
```

Open `cloudfront_url`. If you get Access Denied, wait 1–2 minutes or check OAC + bucket policy. **Do not** make the bucket public to “fix” it.

---

## Commit

```powershell
git add backend/functions/counter infra/live STEP-6.md
git status
```

Must **not** include: `backend.hcl`, `.terraform/`, `*.tfstate`, `.build/*.zip`.

```powershell
git commit -m "Add Terraform live stack: counter API and CloudFront OAC."
```

---

## Done when

- POST `/visits` increments
- CloudFront URL loads the placeholder (HTTPS)
- You can say: bucket is private; only CloudFront with OAC can read it

Reply with `api_endpoint` and `cloudfront_url` (the `dxxxx.cloudfront.net` name is fine). Next is **Step 7** — wire the React app to `/visits` and show `trace` in the Tracer panel.
