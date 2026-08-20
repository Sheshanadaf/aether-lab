# Step 9 — Message Relay (SQS + DLQ)

The counter is **synchronous**: the browser waits until DynamoDB has finished. That is fine for a number.

A **job** is different. “Process this” can fail, retry, or take time. If you did that inside the HTTP Lambda, the visitor would wait, and a crash would lose the work. **Amazon SQS** (Simple Queue Service) is a mailbox: the API **drops a letter and returns**. A **worker Lambda** picks letters up later.

**DLQ = dead-letter queue.** After a few failed tries, SQS moves the letter to a second mailbox instead of retrying forever. That is the **Reliability** pillar: fail in a box you can inspect, not in silence.

No SNS alarm yet (Step 12). No uploads, no Cognito. Region still **`ap-south-1`**.

You will apply **`infra/live`** (the app). Bootstrap stays as plumbing. You **do** add `sqs:*` to the GitHub role so the next Actions run can create queues.

---

## Picture (learn this)

```
Browser  --POST /jobs-->  API Gateway  -->  counter Lambda  -->  SQS (jobs)
                                                      |
                                                      +--> 200 { jobId }  (does not wait)

SQS  -->  worker Lambda  -->  DynamoDB   (happy path)

SQS  --retries-->  worker throws  --after 3 receives-->  DLQ  (poison path)
```

The visitor counter path **does not change**. We only add routes and a second function.

---

## Words

| Word | Meaning |
|---|---|
| Queue | A list of messages. Producers write, consumers read. |
| Visibility timeout | After a worker **takes** a message, other workers cannot see it for N seconds. If the worker dies without deleting it, it **reappears**. |
| Receive count | How many times SQS has handed this message to a worker. |
| DLQ | Queue for messages that exceeded `maxReceiveCount`. |
| Event source mapping | Terraform glue: “when SQS has messages, invoke this Lambda.” You do not poll SQS yourself. |
| Batch size 1 | One message per invoke. A poison letter will not sit in the same batch as a good one. |

**Why not DynamoDB only?** DynamoDB is a database. SQS is a **buffer**. Databases do not retry poison work for you.

---

## Part A — Dead-letter queue, then the jobs queue

Create **`infra/live/queue.tf`**:

```hcl
resource "aws_sqs_queue" "jobs_dlq" {
  name                      = "${var.project}-jobs-dlq"
  message_retention_seconds = 345600
}

resource "aws_sqs_queue" "jobs" {
  name                       = "${var.project}-jobs"
  visibility_timeout_seconds = 30
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.jobs_dlq.arn
    maxReceiveCount     = 3
  })
}
```

**Why 30 seconds:** the worker timeout is 10 seconds. Visibility must be **longer** than the Lambda timeout, or SQS will hand the same message to a second invoke while the first is still running.

**Why `maxReceiveCount = 3`:** fail, wait, fail, wait, fail, then DLQ. Enough to *see* retries. Not enough to burn money.

**Why 4-day DLQ retention:** you can open the console tomorrow and still see a poison message. Default SQS retention is 4 days; we set it so it is obvious.

---

## Part B — Worker Python

Create folder `backend/functions/worker/` and **`backend/functions/worker/handler.py`**:

```python
import json
import os

import boto3

TABLE_NAME = os.environ["TABLE_NAME"]
dynamodb = boto3.resource("dynamodb")


def lambda_handler(event, context):
    table = dynamodb.Table(TABLE_NAME)
    for record in event["Records"]:
        payload = json.loads(record["body"])
        if payload.get("poison"):
            raise RuntimeError("poison message — retry then DLQ")
        job_id = payload["jobId"]
        table.put_item(
            Item={
                "pk": f"JOB#{job_id}",
                "sk": "META",
                "status": "done",
                "message": payload.get("message", ""),
            }
        )
    return {"ok": True}
```

**Why raise (not catch):** if you catch and return 200, Lambda **succeeds**, SQS **deletes** the message, and you never get a DLQ. A crash is the signal “try again.”

SQS event shape: `event["Records"]` is a list of `{ "body": "<json string>", ... }`.

---

## Part C — Worker Lambda + mapping

Create **`infra/live/worker.tf`**:

```hcl
data "archive_file" "worker" {
  type        = "zip"
  source_dir  = "${path.root}/../../backend/functions/worker"
  output_path = "${path.root}/.build/worker.zip"
}

resource "aws_iam_role" "worker" {
  name               = "${var.project}-worker"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "worker" {
  statement {
    actions   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"]
  }
  statement {
    actions   = ["dynamodb:PutItem"]
    resources = [aws_dynamodb_table.app.arn]
  }
  statement {
    actions = [
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
    ]
    resources = [aws_sqs_queue.jobs.arn]
  }
}

resource "aws_iam_role_policy" "worker" {
  role   = aws_iam_role.worker.id
  policy = data.aws_iam_policy_document.worker.json
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/aws/lambda/${var.project}-worker"
  retention_in_days = 7
}

resource "aws_lambda_function" "worker" {
  function_name    = "${var.project}-worker"
  role             = aws_iam_role.worker.arn
  filename         = data.archive_file.worker.output_path
  source_code_hash = data.archive_file.worker.output_base64sha256
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

  depends_on = [aws_cloudwatch_log_group.worker]
}

resource "aws_lambda_event_source_mapping" "jobs" {
  event_source_arn = aws_sqs_queue.jobs.arn
  function_name    = aws_lambda_function.worker.arn
  batch_size       = 1
  enabled          = true
}
```

**Two IAM roles:** the counter role must **not** be allowed to consume the queue, and the worker must **not** be the public HTTP entry. Least privilege. Interview sentence: *the API can send; only the worker can receive.*

---

## Part D — Let the HTTP Lambda send to SQS

In **`infra/live/lambda.tf`**, add `sqs:SendMessage` to the **counter** policy (keep the DynamoDB lines). Add `JOBS_QUEUE_URL` to the function environment.

Counter policy statements should be:

```hcl
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
```

Environment:

```hcl
  environment {
    variables = {
      TABLE_NAME     = aws_dynamodb_table.app.name
      JOBS_QUEUE_URL = aws_sqs_queue.jobs.url
    }
  }
```

---

## Part E — HTTP routes: POST /jobs and GET /jobs/{id}

Replace **`backend/functions/counter/handler.py`** with a small **router**. Same `/visits` behaviour, plus jobs.

```python
import json
import os
import uuid

import boto3

TABLE_NAME = os.environ["TABLE_NAME"]
JOBS_QUEUE_URL = os.environ["JOBS_QUEUE_URL"]

dynamodb = boto3.resource("dynamodb")
sqs = boto3.client("sqs")


def _response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
        },
        "body": json.dumps(body),
    }


def lambda_handler(event, context):
    method = (event.get("requestContext") or {}).get("http", {}).get("method", "")
    path = event.get("rawPath") or ""
    request_id = (event.get("requestContext") or {}).get("requestId", "local")

    if method == "POST" and path == "/visits":
        return _visits(request_id)
    if method == "POST" and path == "/jobs":
        return _submit_job(event, request_id)
    if method == "GET" and path.startswith("/jobs/"):
        job_id = path.split("/jobs/", 1)[1]
        return _get_job(job_id, request_id)
    return _response(404, {"error": "not found"})


def _visits(request_id):
    table = dynamodb.Table(TABLE_NAME)
    result = table.update_item(
        Key={"pk": "SITE#aether", "sk": "COUNTER"},
        UpdateExpression="SET #c = if_not_exists(#c, :zero) + :one",
        ExpressionAttributeNames={"#c": "count"},
        ExpressionAttributeValues={":zero": 0, ":one": 1},
        ReturnValues="UPDATED_NEW",
    )
    count = int(result["Attributes"]["count"])
    return _response(
        200,
        {
            "count": count,
            "trace": {
                "requestId": request_id,
                "path": [
                    {"service": "Amazon API Gateway", "role": "HTTP API"},
                    {"service": "AWS Lambda", "role": "arm64 increment"},
                    {"service": "Amazon DynamoDB", "role": "atomic counter"},
                ],
            },
        },
    )


def _submit_job(event, request_id):
    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        raw = "{}"
    try:
        body = json.loads(raw)
    except json.JSONDecodeError:
        body = {}
    job_id = str(uuid.uuid4())
    payload = {
        "jobId": job_id,
        "message": body.get("message", "hello"),
        "poison": bool(body.get("poison")),
    }
    sqs.send_message(QueueUrl=JOBS_QUEUE_URL, MessageBody=json.dumps(payload))
    return _response(
        200,
        {
            "jobId": job_id,
            "status": "queued",
            "trace": {
                "requestId": request_id,
                "path": [
                    {"service": "Amazon API Gateway", "role": "POST /jobs"},
                    {"service": "AWS Lambda", "role": "enqueue only — does not wait"},
                    {"service": "Amazon SQS", "role": "jobs queue"},
                    {"service": "AWS Lambda", "role": "worker (async)"},
                    {"service": "Amazon DynamoDB", "role": "job row when success"},
                    {"service": "Amazon SQS DLQ", "role": "after 3 failures (poison)"},
                ],
            },
        },
    )


def _get_job(job_id, request_id):
    table = dynamodb.Table(TABLE_NAME)
    resp = table.get_item(Key={"pk": f"JOB#{job_id}", "sk": "META"})
    item = resp.get("Item")
    if not item:
        return _response(
            200,
            {
                "jobId": job_id,
                "status": "pending",
                "trace": {
                    "requestId": request_id,
                    "path": [
                        {"service": "Amazon API Gateway", "role": "GET /jobs/{id}"},
                        {"service": "AWS Lambda", "role": "read job"},
                        {"service": "Amazon DynamoDB", "role": "no row yet (still in SQS or DLQ)"},
                    ],
                },
            },
        )
    return _response(
        200,
        {
            "jobId": job_id,
            "status": item.get("status", "done"),
            "message": item.get("message", ""),
            "trace": {
                "requestId": request_id,
                "path": [
                    {"service": "Amazon API Gateway", "role": "GET /jobs/{id}"},
                    {"service": "AWS Lambda", "role": "read job"},
                    {"service": "Amazon DynamoDB", "role": "job finished"},
                ],
            },
        },
    )
```

In **`infra/live/api.tf`**, add two routes next to `POST /visits` (same integration — one Lambda, many routes):

```hcl
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
```

CORS already allows GET and POST.

---

## Part F — GitHub role must be allowed to create SQS

Actions applies **live**. Without `sqs:*` it will hit `AccessDenied` on the new queues.

In **`infra/bootstrap/gha_policy.tf`**, add `"sqs:*",` next to `"dynamodb:*",`.

Apply **bootstrap** on your laptop (this updates the role policy, not the website):

```powershell
cd "D:\Projects\Advanced Architectural Project\infra\bootstrap"
terraform apply
```

Plan should change **one IAM policy**, not the state bucket.

---

## Part G — Apply live

Laptop first so you can watch the console while you learn:

```powershell
cd "D:\Projects\Advanced Architectural Project\infra\live"
terraform plan
terraform apply
```

Expect **new**: two queues, worker Lambda, event source mapping, two API routes. Counter Lambda **update** (env + IAM). DynamoDB table **unchanged**.

Then test (use your real API base from Step 7):

```powershell
curl -X POST https://dkoyf7v9v6.execute-api.ap-south-1.amazonaws.com/jobs -H "content-type: application/json" -d "{\"message\":\"hello from step 9\"}"
```

Copy `jobId`, then:

```powershell
curl.exe https://dkoyf7v9v6.execute-api.ap-south-1.amazonaws.com/jobs/PASTE_JOB_ID
```

First GET may be `pending`. Wait 2 seconds, GET again → `done`.

Poison:

```powershell
curl.exe -X POST https://dkoyf7v9v6.execute-api.ap-south-1.amazonaws.com/jobs -H "content-type: application/json" -d "{\"poison\":true}"
```

GET that id stays `pending`. Console: **SQS** → `aether-lab-jobs-dlq` → after about a minute, **Approximate number of messages** is 1. Worker logs in CloudWatch will show the `RuntimeError`.

**Do not** leave dozens of poison messages. One is enough.

---

## Part H — Labs page

**`frontend/src/lib/api.ts`** — add types and two functions (keep `incrementVisits`):

```ts
export type JobResponse = {
  jobId: string;
  status: string;
  message?: string;
  trace: Trace;
};

export async function submitJob(body: { message?: string; poison?: boolean }): Promise<JobResponse> {
  if (!BASE) {
    throw new Error("VITE_API_BASE is missing.");
  }
  const res = await fetch(`${BASE}/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}`);
  }
  return res.json() as Promise<JobResponse>;
}

export async function getJob(jobId: string): Promise<JobResponse> {
  if (!BASE) {
    throw new Error("VITE_API_BASE is missing.");
  }
  const res = await fetch(`${BASE}/jobs/${jobId}`);
  if (!res.ok) {
    throw new Error(`API ${res.status}`);
  }
  return res.json() as Promise<JobResponse>;
}
```

**`frontend/src/pages/Labs.tsx`** — keep the counter; add a second section:

```tsx
import { useState } from "react";
import { FALLBACK_TRACE, getJob, incrementVisits, submitJob } from "../lib/api";
import { useTracer } from "../lib/tracer";

export function LabsPage() {
  const { setTrace } = useTracer();
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);

  async function hit() {
    try {
      const data = await incrementVisits();
      setCount(data.count);
      setTrace(data.trace);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
      setTrace(FALLBACK_TRACE);
    }
  }

  async function send(poison: boolean) {
    try {
      const queued = await submitJob(poison ? { poison: true } : { message: "hello from the lab" });
      setJobId(queued.jobId);
      setJobStatus(queued.status);
      setTrace(queued.trace);
      setError(null);
      for (let i = 0; i < 8; i += 1) {
        await new Promise((r) => setTimeout(r, 1000));
        const latest = await getJob(queued.jobId);
        setJobStatus(latest.status);
        setTrace(latest.trace);
        if (latest.status === "done") return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
      setTrace(FALLBACK_TRACE);
    }
  }

  return (
    <article>
      <p className="kicker">Live labs</p>
      <h1>Visitor counter</h1>
      <p>POST /visits → API Gateway → Lambda → DynamoDB. Synchronous.</p>
      <p>
        <button type="button" onClick={hit}>
          Increment
        </button>{" "}
        Count: {count ?? "—"}
      </p>

      <h1>Message Relay</h1>
      <p>
        POST /jobs drops a letter on SQS and returns. A worker Lambda writes DynamoDB. A poison
        message fails three times, then the DLQ. Reliability pillar.
      </p>
      <p>
        <button type="button" onClick={() => send(false)}>
          Send job
        </button>{" "}
        <button type="button" onClick={() => send(true)}>
          Send poison
        </button>
      </p>
      <p>
        Job: {jobId ?? "—"} — {jobStatus ?? "—"}
      </p>
      {jobStatus === "pending" && (
        <p>If this was poison, it will stay pending. Check SQS queue aether-lab-jobs-dlq.</p>
      )}
      {error && <p>{error}</p>}
    </article>
  );
}
```

`npm run dev` — Send job → status `done`. Send poison → stays `pending`. Tracer should list SQS.

---

## Part I — Git push

When laptop apply and localhost look right:

```powershell
cd "D:\Projects\Advanced Architectural Project"
git add infra/live backend/functions frontend/src infra/bootstrap/gha_policy.tf STEP-9.md
git status
git commit -m "Add Message Relay lab: SQS, worker Lambda, and DLQ."
git push
```

Actions should apply live (including SQS) and upload the new Labs page. If Terraform is already applied from the laptop, the Actions apply is a no-op plus a new S3 sync.

---

## What you should be able to say

> The counter is request-response. The relay is async: API Gateway invokes Lambda, Lambda only `SendMessage`s to SQS and returns a job id. A second Lambda is bound to the queue. Success writes DynamoDB. A poison payload raises; SQS retries three times, then the DLQ. The HTTP function cannot consume the queue.

---

## Done when

- Happy job → DynamoDB `done`
- Poison job → DLQ has a message; GET stays `pending`
- Tracer shows SQS on submit
- You did **not** add AWS keys to the browser

Reply with: job id that became `done`, and whether the DLQ showed 1 message. Next is **Step 10** — upload pipeline (presigned S3, no keys in JS).
