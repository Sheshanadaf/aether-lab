data "archive_file" "upload" {
  type        = "zip"
  source_dir  = "${path.root}/../../backend/functions/upload"
  output_path = "${path.root}/.build/upload.zip"
}

resource "aws_iam_role" "upload" {
  name               = "${var.project}-upload"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "upload" {
  statement {
    actions   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"]
  }
  statement {
    actions   = ["dynamodb:PutItem"]
    resources = [aws_dynamodb_table.app.arn]
  }
  statement {
    actions   = ["s3:GetObject", "s3:HeadObject"]
    resources = ["${aws_s3_bucket.uploads.arn}/*"]
  }
  statement {
    actions = [
      "xray:PutTraceSegments",
      "xray:PutTelemetryRecords",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "upload" {
  role   = aws_iam_role.upload.id
  policy = data.aws_iam_policy_document.upload.json
}

resource "aws_cloudwatch_log_group" "upload" {
  name              = "/aws/lambda/${var.project}-upload"
  retention_in_days = 7
}

resource "aws_lambda_function" "upload" {
  function_name    = "${var.project}-upload"
  role             = aws_iam_role.upload.arn
  filename         = data.archive_file.upload.output_path
  source_code_hash = data.archive_file.upload.output_base64sha256
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

  depends_on = [aws_cloudwatch_log_group.upload]

  tracing_config {
    mode = "Active"
  }
}

resource "aws_cloudwatch_event_rule" "upload_created" {
  name = "${var.project}-upload-created"
  event_pattern = jsonencode({
    source      = ["aws.s3"]
    detail-type = ["Object Created"]
    detail = {
      bucket = {
        name = [aws_s3_bucket.uploads.id]
      }
    }
  })
}

resource "aws_cloudwatch_event_target" "upload_created" {
  rule = aws_cloudwatch_event_rule.upload_created.name
  arn  = aws_lambda_function.upload.arn
}

resource "aws_lambda_permission" "upload_events" {
  statement_id  = "AllowEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.upload.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.upload_created.arn
}