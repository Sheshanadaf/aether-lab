# Step 4 — One Lambda (console), then Python on your machine

Still **no Terraform**. Still **no GitHub OIDC**. You will click a few things in AWS so you *feel* what a function is. Then you will run the same kind of function locally.

Region: **Asia Pacific (Mumbai) `ap-south-1`** (top-right of the console).

These resources are **throwaways**. When this step is done we will **delete** them so Step 6 Terraform starts from a clean account.

---

## What Lambda is (one minute)

**AWS Lambda** = you upload a function. AWS runs it when something calls it (a test button, later API Gateway). You do not rent a virtual machine 24/7.

- No EC2 to patch
- Scale to zero → **$0 when nobody visits** (fits the budget)
- You pay per request + duration (free tier is large enough for this lab)

**Handler** = the function AWS calls. In Python it looks like:

```python
def lambda_handler(event, context):
    ...
    return something
```

- **`event`** — the input (JSON). A test event, or later the HTTP request from API Gateway.
- **`context`** — metadata (request id, remaining time). We can ignore it for now.
- **Return value** — for a web API we return `statusCode`, `headers`, and a JSON `body` **as a string**.

---

## Part A — Hello in the console

### A1. Create the function

1. AWS Console → search **Lambda** → **Create function**.
2. **Author from scratch**.
3. Name: `aether-hello` (only this learning function).
4. Runtime: **Python 3.12**.
5. Architecture: **arm64** if you see it (Graviton — cheaper / greener; same idea we will use later). If you only see x86_64, that is OK for this lesson.
6. Permissions: **Create a new role with basic Lambda permissions** (this role may write **CloudWatch Logs**).
7. Create function.

**Why a new role:** Lambda is not “you.” It needs an IAM role to run. Basic role = logs only. It cannot (yet) read DynamoDB or S3. That is **least privilege**.

### A2. Paste the code

In the **Code** tab, open `lambda_function.py` and replace it with:

```python
import json

def lambda_handler(event, context):
    name = "friend"
    if isinstance(event, dict):
        name = event.get("name") or name

    return {
        "statusCode": 200,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(
            {
                "message": f"hello, {name}",
                "hint": "This is console-only. We will delete this function after Step 4.",
            }
        ),
    }
```

Click **Deploy**. If you forget Deploy, Test still runs **old** code.

### A3. Test it

1. **Test** tab → **Create new event**.
2. Event JSON:

```json
{
  "name": "Sheshan"
}
```

3. Save → **Test**.

You should see `statusCode` 200 and `"hello, Sheshan"`.

Change `name` to something else, test again. **That is `event`.**

Open **Monitor** → **View CloudWatch logs** if you want to see the run. Logs are why the role exists.

---

## Part B — Same idea on your PC (no AWS)

Lambda is just Python. The console is only one way to run it.

### B1. Python

```powershell
python --version
```

3.11 or 3.12 is fine. If missing, install Python from python.org and tick **Add to PATH**.

### B2. Create two files (you type them)

From the **project root**, folders:

```
backend/hello/handler.py
backend/hello/local_run.py
```

**`backend/hello/handler.py`** — copy the **same** `lambda_handler` as in the console (so console and laptop match).

**`backend/hello/local_run.py`:**

```python
import json
from handler import lambda_handler

fake_event = {"name": "Sheshan"}
result = lambda_handler(fake_event, None)
print(json.dumps(result, indent=2))
```

Run:

```powershell
cd backend\hello
python local_run.py
```

You should see the same JSON as the console test, **without calling AWS**.

**Why this matters:** unit tests later are this idea — call `handler` with a fake `event`. No bill.

---

## Part C — (Only after A and B work) DynamoDB increment

Do this **once** so you see a database. Then we delete it.

### C1. Table

1. Console → **DynamoDB** → **Tables** → **Create table**.
2. Name: `aether-learn`
3. Partition key: `pk` (String). No sort key.
4. Table settings: **On-demand** (pay per request, not a reserved box).
5. Create.

### C2. Allow Lambda to write the table

1. Lambda → `aether-hello` → **Configuration** → **Permissions** → click the **role name**.
2. IAM → **Add permissions** → **Attach policies** → `AmazonDynamoDBFullAccess` is **too wide** for production. For this 20-minute lesson, attach **`AmazonDynamoDBFullAccess`** then we **delete** role+function anyway.

    Better (if you want to practise least privilege): **Create inline policy** → JSON:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:UpdateItem", "dynamodb:GetItem"],
      "Resource": "arn:aws:dynamodb:ap-south-1:YOUR_ACCOUNT_ID:table/aether-learn"
    }
  ]
}
```

Replace `YOUR_ACCOUNT_ID` (12 digits, top-right of console under your name).

### C3. Replace Lambda code with a counter

```python
import json
import os

import boto3

TABLE = os.environ.get("TABLE_NAME", "aether-learn")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE)


def lambda_handler(event, context):
    result = table.update_item(
        Key={"pk": "SITE#learn"},
        UpdateExpression="SET #c = if_not_exists(#c, :zero) + :one",
        ExpressionAttributeNames={"#c": "count"},
        ExpressionAttributeValues={":zero": 0, ":one": 1},
        ReturnValues="UPDATED_NEW",
    )
    count = int(result["Attributes"]["count"])
    return {
        "statusCode": 200,
        "headers": {"content-type": "application/json"},
        "body": json.dumps({"count": count}),
    }
```

**Deploy.** Test with `{}`. Run Test **twice**. Count should go 1, then 2.

DynamoDB → table → **Explore items** → you should see `pk = SITE#learn` and a `count`.

**Why `update_item` + 1:** two visitors at once should not both read `5` and write `6`. The database adds atomically.

`boto3` is already on Lambda. You do **not** pip-install it in the console.

You do **not** need to run this counter locally unless you install `boto3` and set AWS keys. Skip local DynamoDB for now.

---

## Part D — Delete the throwaways (required)

When you understand it:

1. Lambda → `aether-hello` → **Delete**.
2. DynamoDB → `aether-learn` → **Delete table**.
3. IAM → Roles → the role Lambda created (`aether-hello-role-...`) → **Delete** if it remains.

**Why delete:** Step 6 will create `aether-lab-*` with Terraform. Two counters and leftover tables are confusing and can add log noise.

Leave **Budgets** from Step 1. Never delete those.

---

## What you should be able to say

- Lambda is a function AWS runs; `event` is the input.
- The execution **role** is why Lambda can write logs (and DynamoDB if we allow it).
- arm64 / Graviton is the same Python, cheaper hardware.
- Console ClickOps taught me the pieces; Terraform will describe them as code later so I do not click them again.

---

## Commit (optional)

If you created `backend/hello/`:

```powershell
git add backend STEP-4.md
git commit -m "Add local Lambda hello handler for Step 4."
```

Do not commit AWS keys. There should be none in these files.

---

## Done when

- Console test returned hello (and count 1, 2 if you did Part C)
- `python local_run.py` worked
- Throwaway function and table are **deleted** (or you tell me you kept them on purpose)

Reply with what you saw (`hello` JSON and/or `count`) and whether delete is done. Next is **Step 5** — Terraform bootstrap (state bucket, lock, then we talk OIDC slowly).
