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