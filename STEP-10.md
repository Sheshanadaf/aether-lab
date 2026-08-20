# Step 10 — Upload pipeline (presigned S3 + EventBridge)

The browser must **never** hold `AKIA` keys. It also should **not** send a 2 MB image through API Gateway and Lambda (payload limits, cost, slow).

Pattern: Lambda gives the browser a **presigned PUT URL** (valid about one minute, one object, one content type). The browser uploads **straight to S3**. S3 then emits an event on **EventBridge**. A **second** Lambda reads object metadata and writes DynamoDB.

That is **Security** (no keys in JS) and **Performance** (bytes do not travel API → Lambda).

Do **not** upload into the **site** bucket (that one is only for CloudFront via OAC). This is a second private bucket: **inbox**.

No Cognito yet. No SNS. Region **`ap-south-1`**.

---

## Picture (learn this)

```
Browser
  │
  ├─ POST /uploads  → API Gateway → Lambda  →  returns { url, uploadId }
  │                      (only signs a URL; file does not pass through)
  │
  └─ PUT url  →  S3 inbox (private)
                    │
                    └─ EventBridge “Object Created”
                              │
                              └─ upload Lambda  →  DynamoDB (size, type, key)
```

**Presigned URL:** your Lambda’s IAM identity is allowed `s3:PutObject`. `generate_presigned_url` bakes that permission into a time-limited HTTPS link. Anyone with the link can PUT **that key** until it expires. After expiry, the link is useless.

**EventBridge:** a bus. S3 can publish “an object was created” onto the bus. A **rule** matches that event and invokes Lambda. You could later add a second target (SQS, another function) without changing the bucket. Direct “S3 notification → Lambda” also works; we use EventBridge because that is the interview story for this lab.

---

## Part A — Inbox bucket (private + CORS + EventBridge)

Create **`infra/live/uploads.tf`**:

```hcl
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
```

**Why CORS on S3:** the browser’s origin is `localhost:5173` or CloudFront. The PUT goes to `*.s3.ap-south-1.amazonaws.com`, a **different** site. Without CORS, the browser blocks it. `*` is fine for this lab; at work you list exact origins.

**Why lifecycle 7 days:** inbox files are demos. Do not store them forever.

**Why `eventbridge = true`:** S3 will publish object events to the default event bus. The rule in Part C listens there.

---

## Part B — Upload worker (EventBridge → DynamoDB)

Create **`backend/functions/upload/handler.py`**:

```python
import json
import os
from urllib.parse import unquote_plus

import boto3

TABLE_NAME = os.environ["TABLE_NAME"]
dynamodb = boto3.resource("dynamodb")
s3 = boto3.client("s3")


def lambda_handler(event, context):
    detail = event["detail"]
    bucket = detail["bucket"]["name"]
    key = unquote_plus(detail["object"]["key"])
    head = s3.head_object(Bucket=bucket, Key=key)
    upload_id = key.split("/")[-1].split(".")[0]
    dynamodb.Table(TABLE_NAME).put_item(
        Item={
            "pk": f"UPLOAD#{upload_id}",
            "sk": "META",
            "status": "stored",
            "key": key,
            "bucket": bucket,
            "bytes": int(head["ContentLength"]),
            "contentType": head.get("ContentType", ""),
        }
    )
    return {"ok": True}
```

EventBridge wraps S3 like:

`event["detail"]["bucket"]["name"]` and `event["detail"]["object"]["key"]`.

`unquote_plus` undoes `%2F` in keys. `head_object` is the real size/type from S3, not a number the browser claimed.

---

## Part C — Worker Terraform + EventBridge rule

Create **`infra/live/upload.tf`**:

```hcl
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
```

If `head_object` is not a valid IAM action in the plan, drop it and keep only `s3:GetObject` (Head is covered by GetObject for this use).

---

## Part D — HTTP Lambda may **sign** PutObject (not receive the file)

In **`infra/live/lambda.tf`**, add to the **counter** policy:

```hcl
  statement {
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.uploads.arn}/*"]
  }
```

Environment — add:

```hcl
      UPLOADS_BUCKET = aws_s3_bucket.uploads.id
```

(keep `TABLE_NAME` and `JOBS_QUEUE_URL`)

---

## Part E — Routes POST /uploads and GET /uploads/{id}

In **`backend/functions/counter/handler.py`**:

Add next to `import boto3`:

```python
from botocore.config import Config
```

At the top, after `JOBS_QUEUE_URL`:

```python
UPLOADS_BUCKET = os.environ["UPLOADS_BUCKET"]
ALLOWED_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_UPLOAD_BYTES = 2 * 1024 * 1024
AWS_REGION = os.environ.get("AWS_REGION", "ap-south-1")

s3 = boto3.client(
    "s3",
    region_name=AWS_REGION,
    endpoint_url=f"https://s3.{AWS_REGION}.amazonaws.com",
    config=Config(signature_version="s3v4"),
)
```

In `lambda_handler`, before the `404`:

```python
    if method == "POST" and path == "/uploads":
        return _presign_upload(event, request_id)
    if method == "GET" and path.startswith("/uploads/"):
        upload_id = path.split("/uploads/", 1)[1]
        return _get_upload(upload_id, request_id)
```

Add these functions at the bottom of the file:

```python
def _presign_upload(event, request_id):
    raw = event.get("body") or "{}"
    try:
        body = json.loads(raw)
    except json.JSONDecodeError:
        body = {}
    content_type = body.get("contentType", "")
    size = int(body.get("size") or 0)
    if content_type not in ALLOWED_TYPES:
        return _response(400, {"error": "only jpeg, png, or webp"})
    if size < 1 or size > MAX_UPLOAD_BYTES:
        return _response(400, {"error": "file must be 1 byte to 2 MB"})
    upload_id = str(uuid.uuid4())
    key = f"inbox/{upload_id}.{ALLOWED_TYPES[content_type]}"
    url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": UPLOADS_BUCKET, "Key": key, "ContentType": content_type},
        ExpiresIn=60,
    )
    return _response(
        200,
        {
            "uploadId": upload_id,
            "url": url,
            "key": key,
            "trace": {
                "requestId": request_id,
                "path": [
                    {"service": "Amazon API Gateway", "role": "POST /uploads"},
                    {"service": "AWS Lambda", "role": "presign PutObject — file not here"},
                    {"service": "Amazon S3", "role": "browser PUT to inbox (60s URL)"},
                    {"service": "Amazon EventBridge", "role": "Object Created"},
                    {"service": "AWS Lambda", "role": "read metadata"},
                    {"service": "Amazon DynamoDB", "role": "upload row"},
                ],
            },
        },
    )


def _get_upload(upload_id, request_id):
    table = dynamodb.Table(TABLE_NAME)
    resp = table.get_item(Key={"pk": f"UPLOAD#{upload_id}", "sk": "META"})
    item = resp.get("Item")
    if not item:
        return _response(
            200,
            {
                "uploadId": upload_id,
                "status": "pending",
                "trace": {
                    "requestId": request_id,
                    "path": [
                        {"service": "Amazon API Gateway", "role": "GET /uploads/{id}"},
                        {"service": "Amazon DynamoDB", "role": "EventBridge worker not done yet"},
                    ],
                },
            },
        )
    return _response(
        200,
        {
            "uploadId": upload_id,
            "status": item.get("status", "stored"),
            "bytes": int(item.get("bytes", 0)),
            "contentType": item.get("contentType", ""),
            "trace": {
                "requestId": request_id,
                "path": [
                    {"service": "Amazon API Gateway", "role": "GET /uploads/{id}"},
                    {"service": "Amazon DynamoDB", "role": "metadata stored"},
                ],
            },
        },
    )
```

**Why check size on POST:** the presigned PUT does not enforce 2 MB by itself. We refuse to sign junk. The worker’s `head_object` is the second check.

**Why `ContentType` in Params:** the browser **must** send the same `Content-Type` header on PUT or S3 rejects the signature.

In **`infra/live/api.tf`**:

```hcl
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
```

---

## Part F — GitHub role: EventBridge

Actions must create the rule. In **`infra/bootstrap/gha_policy.tf`**, in the **DeployAetherLive** list (the first `actions = [`), add:

```hcl
      "events:*",
      "sqs:*",
```

(`s3:*` is already there — that covers the inbox bucket. `sqs:*` belongs in this list too, not only StateAndLock.)

Laptop:

```powershell
cd "D:\Projects\Advanced Architectural Project\infra\bootstrap"
terraform apply
```

---

## Part G — Apply live and test

```powershell
cd "D:\Projects\Advanced Architectural Project\infra\live"
terraform plan
terraform apply
```

Expect: new inbox bucket, CORS, EventBridge rule, upload Lambda, two API routes. Site bucket unchanged.

Test with a **small** jpeg/png (under 2 MB). PowerShell:

```powershell
# 1) Ask Lambda for a URL (paste your API base)
curl.exe -X POST https://dkoyf7v9v6.execute-api.ap-south-1.amazonaws.com/uploads -H "content-type: application/json" -d "{\"contentType\":\"image/jpeg\",\"size\":12345}"
```

Use a **real** file size in `size`. Copy `url` and `uploadId`. Then PUT a real file (Content-Type must match):

```powershell
curl.exe -X PUT "PASTE_THE_URL" -H "content-type: image/jpeg" --data-binary "@C:\path\to\small.jpg"
```

Wait a few seconds:

```powershell
curl.exe https://dkoyf7v9v6.execute-api.ap-south-1.amazonaws.com/uploads/PASTE_UPLOAD_ID
```

`status` should become `stored` with `bytes`. If it stays `pending`, CloudWatch log group `/aws/lambda/aether-lab-upload`.

**If PUT returns `TemporaryRedirect`:** the signed URL used `s3.amazonaws.com` (global). Mumbai buckets live at `s3.ap-south-1.amazonaws.com`. A signature is locked to the host, so you cannot follow the redirect. Use the regional `boto3.client` in Part E, apply live, then POST for a **new** URL (old ones expire in 60 seconds). The new `url` must contain `s3.ap-south-1.amazonaws.com`.

---

## Part H — Labs page

**`frontend/src/lib/api.ts`** — add:

```ts
export type UploadSignResponse = {
  uploadId: string;
  url: string;
  key: string;
  trace: Trace;
};

export type UploadStatusResponse = {
  uploadId: string;
  status: string;
  bytes?: number;
  contentType?: string;
  trace: Trace;
};

export async function signUpload(contentType: string, size: number): Promise<UploadSignResponse> {
  if (!BASE) throw new Error("VITE_API_BASE is missing.");
  const res = await fetch(`${BASE}/uploads`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentType, size }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<UploadSignResponse>;
}

export async function getUpload(uploadId: string): Promise<UploadStatusResponse> {
  if (!BASE) throw new Error("VITE_API_BASE is missing.");
  const res = await fetch(`${BASE}/uploads/${uploadId}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<UploadStatusResponse>;
}

export async function putToS3(url: string, file: File): Promise<void> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "content-type": file.type },
    body: file,
  });
  if (!res.ok) throw new Error(`S3 PUT ${res.status}`);
}
```

In **`frontend/src/pages/Labs.tsx`**, import `getUpload`, `putToS3`, `signUpload`. Add state and a section **after** Message Relay (keep counter and jobs as they are):

```tsx
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const signed = await signUpload(file.type, file.size);
      setUploadId(signed.uploadId);
      setUploadStatus("uploading");
      setTrace(signed.trace);
      setError(null);
      await putToS3(signed.url, file);
      for (let i = 0; i < 10; i += 1) {
        await new Promise((r) => setTimeout(r, 1000));
        const latest = await getUpload(signed.uploadId);
        setUploadStatus(latest.status);
        setTrace(latest.trace);
        if (latest.status === "stored") return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
      setTrace(FALLBACK_TRACE);
    }
  }
```

JSX:

```tsx
      <h1>Upload pipeline</h1>
      <p>
        POST /uploads returns a 60-second S3 URL. The file goes to S3, not through Lambda. EventBridge
        then records metadata. No AWS keys in the browser.
      </p>
      <p>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} />
      </p>
      <p>
        Upload: {uploadId ?? "—"} — {uploadStatus ?? "—"}
      </p>
```

`npm run dev` — pick a small jpeg. Tracer after sign should list S3 + EventBridge. After a few seconds status `stored`.

If the PUT fails with CORS, wait a minute after apply (CORS is on the bucket) and confirm `content-type` on PUT equals `file.type`.

---

## Part I — Push

```powershell
cd "D:\Projects\Advanced Architectural Project"
git add infra/live backend/functions frontend/src infra/bootstrap/gha_policy.tf STEP-10.md
git status
git commit -m "Add presigned S3 upload lab with EventBridge metadata worker."
git push
```

---

## What you should be able to say

> The browser never has AWS keys. It asks Lambda for a presigned PutObject URL, then PUTs the bytes to a private inbox bucket. API Gateway never sees the file. S3 publishes Object Created to EventBridge; a worker Lambda heads the object and writes DynamoDB. Inbox objects expire in seven days. The site bucket stays OAC-only.

---

## Done when

- Small jpeg/png/webp → status `stored` and a `bytes` number
- Network tab: PUT goes to **S3**, not to execute-api, for the file body
- No `AWS_ACCESS_KEY_ID` in frontend code
- Site CloudFront still serves the React app

Reply with: `uploadId` that became `stored`, and the byte size. Next is **Step 11** — quiz + Cognito (JWT vs public POST).
