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