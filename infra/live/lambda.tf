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
  statement {
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.jobs.arn]
  }
  statement {
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.uploads.arn}/*"]
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
      JOBS_QUEUE_URL = aws_sqs_queue.jobs.url
      UPLOADS_BUCKET = aws_s3_bucket.uploads.id
    }
  }

  depends_on = [aws_cloudwatch_log_group.counter]
}