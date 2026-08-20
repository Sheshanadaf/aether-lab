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

resource "aws_apigatewayv2_route" "jobs_post" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /jobs"
  target    = "integrations/${aws_apigatewayv2_integration.counter.id}"
}

resource "aws_apigatewayv2_route" "jobs_get" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /jobs/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.counter.id}"
}

resource "aws_apigatewayv2_route" "uploads_post" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /uploads"
  target    = "integrations/${aws_apigatewayv2_integration.counter.id}"
}

resource "aws_apigatewayv2_route" "uploads_get" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /uploads/{id}"
  target    = "integrations/${aws_apigatewayv2_integration.counter.id}"
}