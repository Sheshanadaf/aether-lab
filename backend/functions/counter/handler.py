import json
import os

import boto3

TABLE_NAME = os.environ["TABLE_NAME"]
dynamodb = boto3.resource("dynamodb")


def lambda_handler(event, context):
    table = dynamodb.Table(TABLE_NAME)
    result = table.update_item(
        Key={"pk": "SITE#aether", "sk": "COUNTER"},
        UpdateExpression="SET #c = if_not_exists(#c, :zero) + :one",
        ExpressionAttributeNames={"#c": "count"},
        ExpressionAttributeValues={":zero": 0, ":one": 1},
        ReturnValues="UPDATED_NEW",
    )
    count = int(result["Attributes"]["count"])
    request_id = (event.get("requestContext") or {}).get("requestId", "local")

    body = {
        "count": count,
        "trace": {
            "requestId": request_id,
            "path": [
                {"service": "Amazon API Gateway", "role": "HTTP API"},
                {"service": "AWS Lambda", "role": "arm64 increment"},
                {"service": "Amazon DynamoDB", "role": "atomic counter"},
            ],
        },
    }
    return {
        "statusCode": 200,
        "headers": {
            "content-type": "application/json",
            "access-control-allow-origin": "*",
        },
        "body": json.dumps(body),
    }