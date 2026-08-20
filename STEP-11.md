# Step 11 — Pillar quiz + Cognito (JWT vs public POST)

Until now every lab URL was **public**. Anyone could increment the counter or enqueue a job. That is fine for a demo.

A **score** should belong to a person. **Amazon Cognito** User Pool is a small user directory: email + password. After sign-in, Cognito gives the browser a **JWT** (JSON Web Token) — a signed card that says “this is user X.”

**API Gateway JWT authorizer** checks that card **before** Lambda runs.

| Route | Auth | Why |
|---|---|---|
| `GET /quiz` | none | Anyone may read the questions |
| `POST /quiz` | Cognito JWT | Only a signed-in user may submit. Gateway returns **401** if the header is missing or fake |

Lambda does **not** check the password. Gateway does. That is the interview sentence.

No Hosted UI (no extra domain). No Identity Pool (that would mint **AWS** keys for the browser — the opposite of Step 10). Region **`ap-south-1`**.

---

## Picture

```
GET  /quiz   →  API Gateway  →  Lambda  →  questions (no answers in the JSON)

Sign up / Sign in  →  Cognito  →  IdToken (JWT)

POST /quiz
   Authorization: Bearer <IdToken>
        →  API Gateway authorizer (is this JWT from OUR user pool?)
              │
              ├─ no  →  401, Lambda never runs
              └─ yes →  Lambda  →  DynamoDB score for that user’s `sub`
```

**IdToken, not AccessToken.** API Gateway’s `audience` is the **app client id**. That claim lives on the **IdToken**. If you send the AccessToken you get 401 even after a good login.

**`sub`:** Cognito’s stable user id (a UUID). Email can change; `sub` does not. We store `QUIZ#{sub}` in DynamoDB.

---

## Part A — Auto-confirm (skip the “check your email” maze)

Cognito normally emails a code. For this lab a tiny **pre sign-up** Lambda auto-confirms the user.

Create **`backend/functions/pre_signup/handler.py`**:

```python
def lambda_handler(event, context):
    event["response"]["autoConfirmUser"] = True
    event["response"]["autoVerifyEmail"] = True
    return event
```

It must **return the same event**. Cognito calls this during SignUp. At work you would verify email for real.

---

## Part B — User pool + app client + trigger

Create **`infra/live/cognito.tf`**:

```hcl
data "archive_file" "pre_signup" {
  type        = "zip"
  source_dir  = "${path.root}/../../backend/functions/pre_signup"
  output_path = "${path.root}/.build/pre_signup.zip"
}

resource "aws_iam_role" "pre_signup" {
  name               = "${var.project}-pre-signup"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "pre_signup" {
  statement {
    actions   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:*"]
  }
}

resource "aws_iam_role_policy" "pre_signup" {
  role   = aws_iam_role.pre_signup.id
  policy = data.aws_iam_policy_document.pre_signup.json
}

resource "aws_cloudwatch_log_group" "pre_signup" {
  name              = "/aws/lambda/${var.project}-pre-signup"
  retention_in_days = 7
}

resource "aws_lambda_function" "pre_signup" {
  function_name    = "${var.project}-pre-signup"
  role             = aws_iam_role.pre_signup.arn
  filename         = data.archive_file.pre_signup.output_path
  source_code_hash = data.archive_file.pre_signup.output_base64sha256
  handler          = "handler.lambda_handler"
  runtime          = "python3.12"
  architectures    = ["arm64"]
  timeout          = 5
  memory_size      = 128
  depends_on       = [aws_cloudwatch_log_group.pre_signup]
}

resource "aws_cognito_user_pool" "lab" {
  name = "${var.project}-users"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_uppercase = true
    require_symbols   = false
  }

  lambda_config {
    pre_sign_up = aws_lambda_function.pre_signup.arn
  }
}

resource "aws_lambda_permission" "pre_signup" {
  statement_id  = "AllowCognito"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.pre_signup.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.lab.arn
}

resource "aws_cognito_user_pool_client" "lab" {
  name         = "${var.project}-web"
  user_pool_id = aws_cognito_user_pool.lab.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  prevent_user_existence_errors = "ENABLED"
}
```

**Why `generate_secret = false`:** a secret cannot sit in a public React app. This is a **public** client.

**Why `USER_PASSWORD_AUTH`:** the browser can call Cognito’s HTTPS API with email + password. At work you would use Hosted UI + PKCE (password never touches your JS). This lab chooses the path you can see in one file.

---

## Part C — JWT authorizer on POST /quiz only

In **`infra/live/api.tf`**:

1. CORS must allow the `authorization` header (browser sends it on POST /quiz):

```hcl
    allow_headers = ["content-type", "authorization"]
```

2. Authorizer + two routes (same Lambda integration as visits):

```hcl
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.http.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${var.project}-jwt"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.lab.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.lab.id}"
  }
}

resource "aws_apigatewayv2_route" "quiz_get" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /quiz"
  target    = "integrations/${aws_apigatewayv2_integration.counter.id}"
}

resource "aws_apigatewayv2_route" "quiz_post" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "POST /quiz"
  target             = "integrations/${aws_apigatewayv2_integration.counter.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}
```

`GET /quiz` has **no** `authorization_type`. Default is public.

---

## Part D — HTTP Lambda: questions public, score private

In **`infra/live/lambda.tf`**, the counter DynamoDB statement must include **PutItem** (quiz row):

```hcl
    actions   = ["dynamodb:UpdateItem", "dynamodb:GetItem", "dynamodb:PutItem"]
```

In **`backend/functions/counter/handler.py`**, add routes before the `404`:

```python
    if method == "GET" and path == "/quiz":
        return _quiz_get(request_id)
    if method == "POST" and path == "/quiz":
        return _quiz_post(event, request_id)
```

Add this block at the bottom of the same file (answers stay on the server):

```python
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
                    {"service": "Amazon API Gateway", "role": "JWT authorizer — already passed"},
                    {"service": "AWS Lambda", "role": f"score for sub {sub[:8]}…"},
                    {"service": "Amazon DynamoDB", "role": "QUIZ#sub result"},
                    {"service": "Amazon Cognito", "role": "user pool issued the IdToken"},
                ],
            },
        },
    )
```

If the JWT is bad, **this code never runs**. Gateway answers 401.

---

## Part E — Outputs + GitHub role

**`infra/live/outputs.tf`** — add:

```hcl
output "cognito_client_id" {
  value = aws_cognito_user_pool_client.lab.id
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.lab.id
}
```

**`infra/bootstrap/gha_policy.tf`** — in DeployAetherLive `actions`, add `"cognito-idp:*",`.

```powershell
cd "D:\Projects\Advanced Architectural Project\infra\bootstrap"
terraform apply
```

---

## Part F — Apply live

```powershell
cd "D:\Projects\Advanced Architectural Project\infra\live"
terraform apply
terraform output cognito_client_id
```

Copy that client id.

Prove the authorizer **before** the UI:

```powershell
curl.exe https://dkoyf7v9v6.execute-api.ap-south-1.amazonaws.com/quiz
curl.exe -X POST https://dkoyf7v9v6.execute-api.ap-south-1.amazonaws.com/quiz -H "content-type: application/json" -d "{\"answers\":{}}"
```

GET should be JSON questions. POST without a token should be **401**. That is the whole lesson.

---

## Part G — Frontend env + Cognito helper

**`frontend/.env.example`** and **`frontend/.env`** (restart `npm run dev` after):

```
VITE_API_BASE=https://dkoyf7v9v6.execute-api.ap-south-1.amazonaws.com
VITE_COGNITO_CLIENT_ID=paste-terraform-output-here
```

Create **`frontend/src/lib/cognito.ts`**:

```ts
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID as string | undefined;
const ENDPOINT = "https://cognito-idp.ap-south-1.amazonaws.com/";

async function cognito(target: string, body: Record<string, unknown>) {
  if (!CLIENT_ID) {
    throw new Error("VITE_COGNITO_CLIENT_ID is missing. Add it to frontend/.env and restart npm run dev.");
  }
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "X-Amz-Target": target,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { message?: string; AuthenticationResult?: { IdToken: string } };
  if (!res.ok) {
    throw new Error(data.message || `Cognito ${res.status}`);
  }
  return data;
}

export async function signUp(email: string, password: string) {
  await cognito("AWSCognitoIdentityProviderService.SignUp", {
    ClientId: CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [{ Name: "email", Value: email }],
  });
}

export async function signIn(email: string, password: string): Promise<string> {
  const data = await cognito("AWSCognitoIdentityProviderService.InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: CLIENT_ID,
    AuthParameters: { USERNAME: email, PASSWORD: password },
  });
  const token = data.AuthenticationResult?.IdToken;
  if (!token) throw new Error("No IdToken");
  return token;
}
```

**`frontend/src/lib/api.ts`** — add:

```ts
export type QuizQuestion = { id: string; prompt: string; choices: string[] };

export type QuizGetResponse = {
  questions: QuizQuestion[];
  trace: Trace;
};

export type QuizPostResponse = {
  score: number;
  outOf: number;
  trace: Trace;
};

export async function getQuiz(): Promise<QuizGetResponse> {
  if (!BASE) throw new Error("VITE_API_BASE is missing.");
  const res = await fetch(`${BASE}/quiz`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<QuizGetResponse>;
}

export async function submitQuiz(
  answers: Record<string, number>,
  idToken: string,
): Promise<QuizPostResponse> {
  if (!BASE) throw new Error("VITE_API_BASE is missing.");
  const res = await fetch(`${BASE}/quiz`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ answers }),
  });
  if (res.status === 401) throw new Error("401 — sign in first (JWT missing or wrong token type)");
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<QuizPostResponse>;
}
```

---

## Part H — Replace `Labs.tsx` (full file)

Same counter / jobs / upload as now, plus quiz at the bottom. Replace the whole file so you do not miss JSX again.

**`frontend/src/pages/Labs.tsx`:**

```tsx
import { useEffect, useState, type ChangeEvent } from "react";
import {
  FALLBACK_TRACE,
  getJob,
  getQuiz,
  getUpload,
  incrementVisits,
  putToS3,
  signUpload,
  submitJob,
  submitQuiz,
  type QuizQuestion,
} from "../lib/api";
import { signIn, signUp } from "../lib/cognito";
import { useTracer } from "../lib/tracer";

export function LabsPage() {
  const { setTrace } = useTracer();
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [idToken, setIdToken] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [score, setScore] = useState<string | null>(null);

  useEffect(() => {
    getQuiz()
      .then((data) => {
        setQuestions(data.questions);
        setTrace(data.trace);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "quiz load failed"));
  }, [setTrace]);

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

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
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

  async function register() {
    try {
      await signUp(email, password);
      const token = await signIn(email, password);
      setIdToken(token);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "sign up failed");
    }
  }

  async function login() {
    try {
      const token = await signIn(email, password);
      setIdToken(token);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "sign in failed");
    }
  }

  async function sendQuiz() {
    if (!idToken) {
      setError("Sign in first, then submit.");
      return;
    }
    try {
      const data = await submitQuiz(picks, idToken);
      setScore(`${data.score} / ${data.outOf}`);
      setTrace(data.trace);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "submit failed");
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

      <h1>Pillar quiz</h1>
      <p>
        GET /quiz is public. POST /quiz needs a Cognito IdToken. API Gateway rejects the call before
        Lambda if the JWT is missing. Password: 8+ chars, upper, lower, number.
      </p>
      <p>
        <input
          type="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />{" "}
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </p>
      <p>
        <button type="button" onClick={register}>
          Sign up
        </button>{" "}
        <button type="button" onClick={login}>
          Sign in
        </button>{" "}
        {idToken ? "signed in" : "not signed in"}
      </p>
      {questions.map((q) => (
        <p key={q.id}>
          {q.prompt}
          <br />
          {q.choices.map((choice, idx) => (
            <label key={choice} style={{ display: "block" }}>
              <input
                type="radio"
                name={q.id}
                checked={picks[q.id] === idx}
                onChange={() => setPicks({ ...picks, [q.id]: idx })}
              />{" "}
              {choice}
            </label>
          ))}
        </p>
      ))}
      <p>
        <button type="button" onClick={sendQuiz}>
          Submit quiz
        </button>{" "}
        Score: {score ?? "—"}
      </p>

      {error && <p>{error}</p>}
    </article>
  );
}
```

`npm run dev` — GET questions appear while logged out. Submit without sign-in → error. Sign up (use an email you own; we auto-confirm), sign in, submit → score. Tracer on submit should mention Cognito + JWT.

Without JWT, DevTools Network: POST /quiz **401**. With JWT: **200**.

---

## Part I — GitHub Actions: bake the client id

The CloudFront build must know `VITE_COGNITO_CLIENT_ID`. After terraform apply you already print outputs. In **`.github/workflows/deploy.yml`**, extend the Outputs step:

```yaml
          echo "bucket=$(terraform output -raw site_bucket)" >> "$GITHUB_OUTPUT"
          echo "dist=$(terraform output -raw cloudfront_distribution_id)" >> "$GITHUB_OUTPUT"
          echo "cognito=$(terraform output -raw cognito_client_id)" >> "$GITHUB_OUTPUT"
```

And the **Build frontend for S3** env:

```yaml
          VITE_API_BASE: ${{ secrets.VITE_API_BASE }}
          VITE_COGNITO_CLIENT_ID: ${{ steps.out.outputs.cognito }}
```

(`id: out` is already on that step.)

Then push:

```powershell
cd "D:\Projects\Advanced Architectural Project"
git add infra/live backend/functions frontend infra/bootstrap/gha_policy.tf .github/workflows/deploy.yml STEP-11.md
git status
git commit -m "Add Cognito quiz: public GET, JWT-protected POST."
git push
```

---

## What you should be able to say

> GET /quiz is public. POST /quiz uses an HTTP API JWT authorizer against our Cognito user pool. The browser sends `Authorization: Bearer` plus the **IdToken**. If the token is missing, API Gateway returns 401 and Lambda never runs. The score is stored as `QUIZ#{sub}`. We did not put IAM keys in the SPA; Cognito is identity, not AWS credentials.

---

## Done when

- `curl GET /quiz` works without a token
- `curl POST /quiz` without a token is 401
- Sign up + sign in + submit shows a score
- You used **IdToken**, not AccessToken

Reply with: the 401 without a token (yes/no), and your quiz score. Next is **Step 12** — CloudWatch, alarms, X-Ray (observability).
