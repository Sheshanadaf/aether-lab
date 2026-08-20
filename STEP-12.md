# Step 12 — Observability (logs, X-Ray, dashboard, SNS alarms)

The labs work. An interviewer will still ask: **how do you know it broke at 2am?**

**Observability** is not a new user-facing lab. It is how you **watch** the system you already built.

| Piece | Job |
|---|---|
| CloudWatch **Logs** (7-day retention) | What did Lambda print? We already set 7 days — **Cost** (logs are not free forever) |
| HTTP API **access logs** | Which URL, which status, how slow |
| **X-Ray** | A picture of one request: API → Lambda → DynamoDB / SQS / S3 |
| **Dashboard** | One screen: errors, invocations, DLQ depth |
| **Alarm → SNS → email** | DLQ has a message, or Lambda is erroring — you get mail |

No new pages except a short **How it ships** update. Region **`ap-south-1`**. Stay cheap: 7-day logs, no Lambda Insights, no extra log products.

You will **confirm an SNS subscription email**. Until you click Confirm, alarms are silent.

---

## Words

| Word | Meaning |
|---|---|
| Metric | A number over time (errors, queue depth). Not the log text. |
| Alarm | “If this metric stays bad, tell someone.” |
| SNS | Simple Notification Service — a doorbell. Here the doorbell emails you. |
| X-Ray trace | One request’s timeline. **Active** tracing = Lambda starts a trace each invoke. |
| Sampling | X-Ray does not record 100% of traffic at huge scale. Your lab volume is tiny. |
| Retention | After 7 days CloudWatch **deletes** log events. That is a choice, not a bug. |

**Logs vs traces vs metrics:** logs = sentences. traces = one request’s path. metrics = numbers for graphs and alarms. You want all three.

---

## Part A — Email variable (live)

You already used an email for **Budgets** in Step 1. Same address for alarms.

**`infra/live/variables.tf`** — add:

```hcl
variable "alert_email" {
  type        = string
  description = "SNS alarm email. You must Confirm the subscription in your inbox."
}
```

**`infra/live/terraform.tfvars`** (gitignored — create if missing):

```hcl
aws_region  = "ap-south-1"
project     = "aether-lab"
alert_email = "sheshanhebron61@gmail.com"
```

Use **your** real inbox. Create **`infra/live/terraform.tfvars.example`** with a fake email so git has a template:

```hcl
aws_region  = "ap-south-1"
project     = "aether-lab"
alert_email = "you@example.com"
```

---

## Part B — API access logs (7 days)

Create **`infra/live/observe.tf`** and put the log group + resource policy at the top (SNS/alarms come in later parts of this same file):

```hcl
resource "aws_cloudwatch_log_group" "http_api" {
  name              = "/aws/apigateway/${var.project}-http"
  retention_in_days = 7
}

data "aws_iam_policy_document" "http_api_logs" {
  statement {
    principals {
      type        = "Service"
      identifiers = ["apigateway.amazonaws.com"]
    }
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["${aws_cloudwatch_log_group.http_api.arn}:*"]
  }
}

resource "aws_cloudwatch_log_resource_policy" "http_api" {
  policy_name     = "${var.project}-http-api-logs"
  policy_document = data.aws_iam_policy_document.http_api_logs.json
}
```

In **`infra/live/api.tf`**, change the **stage** so it writes access logs. Keep `auto_deploy = true`. Replace the stage resource with:

```hcl
resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit     = 20
    throttling_rate_limit      = 10
    detailed_metrics_enabled   = true
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.http_api.arn
    format = jsonencode({
      requestId        = "$context.requestId"
      httpMethod       = "$context.httpMethod"
      path             = "$context.path"
      status           = "$context.status"
      responseLatency  = "$context.responseLatency"
      error            = "$context.error.message"
    })
  }

  depends_on = [aws_cloudwatch_log_resource_policy.http_api]
}
```

**Throttle (10 req/s):** a public quiz/counter can be scraped. Cheap **Reliability** guardrail. You can still click Labs normally.

---

## Part C — X-Ray on the three lab Lambdas

Add this statement to **counter**, **worker**, and **upload** IAM policy documents (`lambda.tf`, `worker.tf`, `upload.tf`):

```hcl
  statement {
    actions = [
      "xray:PutTraceSegments",
      "xray:PutTelemetryRecords",
    ]
    resources = ["*"]
  }
```

Inside each of those three `aws_lambda_function` resources, add:

```hcl
  tracing_config {
    mode = "Active"
  }
```

Skip `pre_signup` (it runs only at Cognito sign-up).

**What you get without extra Python libraries:** each invoke shows up in **X-Ray traces** as a Lambda node. Downstream DynamoDB/SQS subsegments are richer if you later add the X-Ray SDK. **Active** alone is enough to talk about traces vs logs in an interview.

---

## Part D — SNS topic + email (then Confirm)

Append to **`infra/live/observe.tf`**:

```hcl
resource "aws_sns_topic" "alerts" {
  name = "${var.project}-alerts"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}
```

Terraform will show the subscription as **PendingConfirmation**. That is normal.

---

## Part E — Alarms (DLQ + worker errors)

Still in **`observe.tf`**:

```hcl
resource "aws_cloudwatch_metric_alarm" "dlq" {
  alarm_name          = "${var.project}-jobs-dlq-not-empty"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 1
  alarm_description   = "Poison or failed jobs sitting in the DLQ"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    QueueName = aws_sqs_queue.jobs_dlq.name
  }
}

resource "aws_cloudwatch_metric_alarm" "worker_errors" {
  alarm_name          = "${var.project}-worker-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Worker Lambda failed (poison retries look like errors)"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    FunctionName = aws_lambda_function.worker.function_name
  }
}
```

**Why DLQ alarm, not only Lambda errors:** poison **should** error three times. The **DLQ depth** is the signal “something is stuck,” which is what you care about after retries.

If Step 9 left a message in `aether-lab-jobs-dlq`, this alarm may go **ALARM** as soon as you apply. That is useful: you will see mail (after Confirm). You can purge the DLQ later to return to OK.

---

## Part F — Dashboard

Append to **`observe.tf`**:

```hcl
resource "aws_cloudwatch_dashboard" "lab" {
  dashboard_name = var.project

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Lambda invocations"
          region = var.aws_region
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.counter.function_name],
            [".", "Invocations", ".", aws_lambda_function.worker.function_name],
            [".", "Invocations", ".", aws_lambda_function.upload.function_name],
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Lambda errors"
          region = var.aws_region
          metrics = [
            ["AWS/Lambda", "Errors", "FunctionName", aws_lambda_function.counter.function_name],
            [".", "Errors", ".", aws_lambda_function.worker.function_name],
            [".", "Errors", ".", aws_lambda_function.upload.function_name],
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "SQS jobs vs DLQ"
          region = var.aws_region
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.jobs.name],
            [".", "ApproximateNumberOfMessagesVisible", ".", aws_sqs_queue.jobs_dlq.name],
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          title  = "HTTP API 4xx / 5xx"
          region = var.aws_region
          metrics = [
            ["AWS/ApiGateway", "4xx", "ApiId", aws_apigatewayv2_api.http.id],
            [".", "5xx", ".", aws_apigatewayv2_api.http.id],
          ]
        }
      },
    ]
  })
}
```

---

## Part G — GitHub role

**`infra/bootstrap/gha_policy.tf`** — in DeployAetherLive actions add:

```hcl
      "sns:*",
      "cloudwatch:*",
      "xray:*",
```

(`logs:*` is already there.)

```powershell
cd "D:\Projects\Advanced Architectural Project\infra\bootstrap"
terraform apply
```

---

## Part H — Apply live and click Confirm

```powershell
cd "D:\Projects\Advanced Architectural Project\infra\live"
terraform plan
terraform apply
```

Then **immediately** open the inbox for `alert_email`. Subject like **AWS Notification - Subscription Confirmation**. Click **Confirm subscription**. Until that click, you will not get alarm mail.

Console checks (Mumbai):

1. **CloudWatch → Log groups** → `/aws/lambda/aether-lab-counter` → Retention **7 days**. Click Increment on Labs, refresh logs, see a request.
2. **Log groups** → `/aws/apigateway/aether-lab-http` → after a click, a JSON line with `path` and `status`.
3. **CloudWatch → Dashboards → aether-lab** → widgets populate after a few minutes of traffic (click Increment, Send job).
4. **X-Ray → Traces** (or CloudWatch → X-Ray traces) → one trace after Increment. Open it. You should see Lambda.
5. **CloudWatch → Alarms** → `aether-lab-jobs-dlq-not-empty`.

To **see an alarm on purpose:** Labs → Send poison. Worker errors tick up. After three receives, DLQ ≥ 1 → alarm → email (if you confirmed SNS).

Do **not** send poison in a loop.

---

## Part I — How it ships page (honest now)

Replace **`frontend/src/pages/Ship.tsx`**:

```tsx
export function ShipPage() {
  return (
    <article>
      <p className="kicker">CI/CD</p>
      <h1>How it ships</h1>
      <p>
        GitHub Actions on <code>main</code> assumes IAM role <code>aether-lab-github-actions</code> with
        OIDC. There are no <code>AKIA</code> keys in GitHub. Terraform applies <code>infra/live</code> only.
        Bootstrap (state bucket, lock, OIDC) was applied once from a laptop.
      </p>
      <p>
        Origin Access Control: CloudFront may read the site bucket; the bucket stays private.
      </p>
      <p>
        Observability: Lambda logs keep 7 days. HTTP API access logs go to CloudWatch. X-Ray Active
        tracing is on the lab functions. A dashboard named aether-lab shows invocations, errors, and
        DLQ depth. An SNS email alarm fires if the jobs DLQ is not empty.
      </p>
    </article>
  );
}
```

`npm run dev` — open **How it ships** and read it once. Then push with the Terraform.

```powershell
cd "D:\Projects\Advanced Architectural Project"
git add infra/live infra/bootstrap/gha_policy.tf frontend/src/pages/Ship.tsx STEP-12.md
git status
git commit -m "Add CloudWatch dashboard, SNS alarms, API logs, and Lambda X-Ray."
git push
```

---

## What you should be able to say

> Logs tell me what a function printed; they expire in seven days so the bill stays small. Metrics power a dashboard and alarms. If a poison job lands in the DLQ, CloudWatch alarms and SNS emails me — after I confirmed the subscription. X-Ray Active tracing shows a request hitting Lambda. API Gateway throttles the HTTP API so a scrape cannot run unbounded. GitHub still has no long-lived AWS keys.

---

## Done when

- SNS subscription is **Confirmed** (not Pending)
- Dashboard `aether-lab` exists
- You opened one X-Ray trace after Increment
- Access log group has a line after a click
- You did **not** turn on NAT, WAF, or infinite log retention

Reply with: whether the SNS email arrived, and whether you saw an X-Ray trace. Next is **Step 13** — Atlas + pillars pages with real content, then the Well-Architected Tool.
