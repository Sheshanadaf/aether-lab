data "archive_file" "pre_signup" {
  type        = "zip"
  source_dir  = "${path.root}/../../backend/functions/pre_signup"
  output_path = "${path.root}/.build/pre_signup.zip"
}

resource "aws_iam_role" "pre_signup" {
  name               = "${var.project}-pre-signup"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "pre_signup" {
  statement {
    actions   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"]
  }
}

resource "aws_iam_role_policy" "pre_signup" {
  role   = aws_iam_role.pre_signup.id
  policy = data.aws_iam_policy_document.pre_signup.json
}

resource "aws_cloudwatch_log_group" "pre_signup" {
  name              = "/aws/lambda/${var.project}-pre-signup"
  retention_in_days = 7
}

resource "aws_lambda_function" "pre_signup" {
  function_name    = "${var.project}-pre-signup"
  role             = aws_iam_role.pre_signup.arn
  filename         = data.archive_file.pre_signup.output_path
  source_code_hash = data.archive_file.pre_signup.output_base64sha256
  handler          = "handler.lambda_handler"
  runtime          = "python3.12"
  architectures    = ["arm64"]
  timeout          = 5
  memory_size      = 128
  depends_on       = [aws_cloudwatch_log_group.pre_signup]
}

resource "aws_cognito_user_pool" "lab" {
  name = "${var.project}-users"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_uppercase = true
    require_symbols   = false
  }

  lambda_config {
    pre_sign_up = aws_lambda_function.pre_signup.arn
  }
}

resource "aws_lambda_permission" "pre_signup" {
  statement_id  = "AllowCognito"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pre_signup.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.lab.arn
}

resource "aws_cognito_user_pool_client" "lab" {
  name         = "${var.project}-web"
  user_pool_id = aws_cognito_user_pool.lab.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  prevent_user_existence_errors = "ENABLED"
}