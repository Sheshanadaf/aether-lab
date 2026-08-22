import json
import os
import uuid

import boto3
from botocore.config import Config

TABLE_NAME = os.environ["TABLE_NAME"]
JOBS_QUEUE_URL = os.environ["JOBS_QUEUE_URL"]
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
    if method == "POST" and path == "/uploads":
        return _presign_upload(event, request_id)
    if method == "GET" and path.startswith("/uploads/"):
        upload_id = path.split("/uploads/", 1)[1]
        return _get_upload(upload_id, request_id)
    if method == "GET" and path == "/quiz":
        return _quiz_get(request_id)
    if method == "POST" and path == "/quiz":
        return _quiz_post(event, request_id)
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
                    {"service": "AWS Lambda", "role": "enqueue only | does not wait"},
                    {"service": "Amazon SQS", "role": "jobs queue"},
                    {"service": "AWS Lambda", "role": "worker (async)"},
                    {"service": "Amazon DynamoDB", "role": "job row when success"},
                    {"service": "Amazon SQS DLQ", "role": "SQS redrive after 3 failed receives"},
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

QUESTIONS = [
    {
        "id": "q1",
        "prompt": "Why is the CloudFront origin bucket private?",
        "choices": [
            "Because S3 websites must be public",
            "Origin Access Control lets only CloudFront read it",
            "Lambda needs a public bucket",
            "GitHub Actions uploads need a public ACL",
        ],
        "answer": 1,
    },
    {
        "id": "q2",
        "prompt": "How does GitHub Actions get AWS credentials in this project?",
        "choices": [
            "AKIA keys stored in GitHub Secrets",
            "Root user keys on the runner",
            "OIDC: GitHub proves the repo, STS gives a temporary role",
            "The React app’s VITE_API_BASE contains an access key",
        ],
        "answer": 2,
    },
    {
        "id": "q3",
        "prompt": "After a poison SQS message fails three times, where does it go?",
        "choices": ["SNS", "The site bucket", "The DLQ", "CloudFront"],
        "answer": 2,
    },
    {
        "id": "q4",
        "prompt": "Why does the image upload skip API Gateway?",
        "choices": [
            "S3 cannot be private",
            "A presigned PUT URL lets the browser talk to S3 directly",
            "EventBridge cannot invoke Lambda",
            "CloudFront Functions store files",
        ],
        "answer": 1,
    },
]


def _quiz_get(request_id):
    public = [
        {"id": q["id"], "prompt": q["prompt"], "choices": q["choices"]} for q in QUESTIONS
    ]
    return _response(
        200,
        {
            "questions": public,
            "trace": {
                "requestId": request_id,
                "path": [
                    {"service": "Amazon API Gateway", "role": "GET /quiz — no JWT"},
                    {"service": "AWS Lambda", "role": "return questions, hide answers"},
                ],
            },
        },
    )


def _quiz_post(event, request_id):
    claims = (
        ((event.get("requestContext") or {}).get("authorizer") or {})
        .get("jwt", {})
        .get("claims", {})
    )
    sub = claims.get("sub")
    if not sub:
        return _response(401, {"error": "missing jwt"})
    raw = event.get("body") or "{}"
    try:
        body = json.loads(raw)
    except json.JSONDecodeError:
        body = {}
    answers = body.get("answers") or {}
    correct = 0
    for q in QUESTIONS:
        if answers.get(q["id"]) == q["answer"]:
            correct += 1
    dynamodb.Table(TABLE_NAME).put_item(
        Item={
            "pk": f"QUIZ#{sub}",
            "sk": "RESULT",
            "score": correct,
            "outOf": len(QUESTIONS),
        }
    )
    return _response(
        200,
        {
            "score": correct,
            "outOf": len(QUESTIONS),
            "trace": {
                "requestId": request_id,
                "path": [
                    {"service": "Amazon API Gateway", "role": "JWT authorizer checks the IdToken"},
                    {"service": "Amazon Cognito", "role": "user pool / JWKS — before Lambda runs"},
                    {"service": "AWS Lambda", "role": f"score for sub {sub[:8]}…"},
                    {"service": "Amazon DynamoDB", "role": "QUIZ#sub result"},
                ],
            },
        },
    )