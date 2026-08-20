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