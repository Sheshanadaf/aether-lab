# Aether Lab — learning plan

This is the only file in this folder on purpose.

We are **not** writing application code, Terraform, or GitHub Actions yet. First we agree on what we are building, why, and the order we will build it. You type the work. I explain, then wait. That is how you actually learn this.

---

## How we will work

1. You read this document. Ask questions until it is clear.
2. When you say you are ready, we start **Step 1 only**.
3. Each step: I tell you *what* to do and *why*. You do it in VS Code / AWS / terminal. Then we check it together before the next step.
4. I will not dump a finished repo again.

If something in a step is confusing, stop and ask. Do not skip ahead to “looks like a senior’s GitHub.” Interviewers care that you can explain a request path, not that a thousand files appeared overnight.

---

## Why this project exists

You are finishing a BS in Cloud Computing after a DevOps internship. You do not have a large IT network in Sri Lanka. This site is **proof of work**: a public portfolio plus a few real AWS labs.

Hiring managers will ask: *walk me through what happens when I click this.* A small system you can defend beats a fake “all AWS services” diagram you cannot.

**Name:** Aether Lab  
**Tagline:** Use the cloud. See the architecture.

It is the Cloud Resume Challenge taken further: not only a resume on S3, but labs that teach the architecture behind the click, Infrastructure as Code, CI/CD without long-lived keys, and the six Well-Architected pillars.

---

## What we will build (product)

One static website (your resume/portfolio) plus live labs. A **Request Tracer** panel is always visible: CloudFront → API Gateway → Lambda → DynamoDB (or SQS, S3, SNS…). Each hop is tagged with a Well-Architected pillar.

### Pages

| Page | Purpose |
|---|---|
| About / Resume | Who you are, internship, skills, GitHub, Medium |
| Live Labs | Working demos (counter, queue game, upload, quiz, contact) |
| Architecture Atlas | 50+ AWS services: which ones are *in this project* vs *why we did not turn them on* |
| Six pillars | How *this* system maps to the Well-Architected Framework |
| How it ships | Terraform, GitHub Actions, OIDC, tests, how to destroy |

### Live labs (these actually call AWS)

| Lab | Visitor does | AWS path | Pillars you can talk about |
|---|---|---|---|
| Visitor counter | Page load / button increments a number | CloudFront → API → Lambda → DynamoDB | Performance, Cost |
| Request Tracer | Always on | Correlation ID + (later) X-Ray | Operational Excellence |
| Message Relay | Send a job; send a “poison” message | API → SQS → worker Lambda → DynamoDB; fail → DLQ + alarm → SNS | Reliability |
| Upload pipeline | Upload a small image | Presigned S3 PUT → EventBridge → Lambda (metadata) → DynamoDB | Security, Performance |
| Pillar quiz | Answer questions about *this* stack | API → Lambda → DynamoDB; optional Cognito JWT | Security |
| Contact | Send you a message | API → Lambda → SNS | Ops, Security (validation) |

We will **not** run NAT Gateway, ALB, RDS, EKS, WAF WebACL, always-on EC2, Secrets Manager, or customer-managed KMS keys. Those idle-bill a junior lab. The Atlas is where you show you *know* them and when you would use them at work.

---

## Budget (non-negotiable)

Stay near AWS always-free allowances. Target **under ~$5/month**. Aggressive teardown when experimenting.

**Before any `terraform apply`:** root MFA, no root access keys, and **$1 and $5 AWS Budgets** emailed to you.

**Region split (interview talking point):**

- `ap-south-1` (Mumbai): Lambda, API Gateway, DynamoDB, SQS, S3 app buckets — closest to Sri Lanka
- `us-east-1`: only later, if we add a custom domain (CloudFront ACM must live there)
- Global: CloudFront, IAM, GitHub OIDC, Budgets, Shield Standard

---

## Target architecture (learn this picture)

```
Browser
   │
   ▼
CloudFront ── static files ──► S3 (private, Origin Access Control)
   │
   └── /api/* ──► API Gateway HTTP API ──► Lambda (arm64 / Graviton)
                                              │
                        ┌─────────────────────┼─────────────────────┐
                        ▼                     ▼                     ▼
                   DynamoDB                 SQS (+ DLQ)              SNS
                   (counter, jobs,          worker Lambda           (email)
                    quiz, uploads)          EventBridge ← S3 uploads
```

GitHub Actions will later assume an AWS role with **OIDC** (no `AKIA` access keys in GitHub). Terraform will define the infrastructure. Python tests will prove the API works.

You do not need to memorise every box today. You will build one box at a time.

---

## Two ideas you asked about (plain language)

**GitHub Actions OIDC:** GitHub proves “this workflow is *my* repo, *this* branch.” AWS STS gives **temporary** credentials to a role that trusts only that repo. If something leaks, the credentials expire in about an hour. That is a Security-pillar talking point. We set this up when we reach CI/CD — not today.

**Python tests:**  
- *Unit tests* run on your laptop and fake AWS (or mock it). They test Lambda logic.  
- *Integration tests* run **after** deploy, against the real HTTPS API (increment counter, submit a job). They prove the wires are connected.

---

## Six pillars — how this project will use them

We do not paste slogans. Each pillar must map to something in the repo.

| Pillar | In Aether Lab |
|---|---|
| Operational Excellence | Terraform, GitHub Actions, CloudWatch, tracer, runbooks |
| Security | Private S3 + OAC, OIDC, least-privilege IAM, Cognito on verified quiz writes, presigned uploads, security headers |
| Reliability | SQS retries + DLQ, poison-message lab, S3 versioning, API throttling |
| Performance Efficiency | CloudFront cache, Lambda in Mumbai, HTTP API, DynamoDB single table |
| Cost Optimization | Budgets, scale-to-zero, no idle VMs, 7-day logs, Atlas of refused paid services |
| Sustainability | Graviton Lambdas, no idle RDS/EC2, CloudFront reducing origin hits |

After the stack is live, you will run the **AWS Well-Architected Tool** (console, free) and write notes. That is rare on junior portfolios.

---

## Services: live vs Atlas

**We will actually provision (over several steps, not all at once):**  
S3, CloudFront, CloudFront Functions, Lambda, API Gateway, DynamoDB, SQS, SQS DLQ, SNS, EventBridge, Cognito, IAM, STS, GitHub OIDC, SSM Parameter Store, CloudWatch, X-Ray, AWS Budgets, Shield Standard (automatic).

**We document only (Atlas — “when I would use this at work”):**  
EC2, ECS/Fargate, EKS, ALB, NAT Gateway, RDS/Aurora, ElastiCache, OpenSearch, WAF, GuardDuty, Bedrock, CodePipeline vs GitHub Actions, multi-region DR, and others. Honest cost notes beat fake resources.

---

## Folder layout we will grow into (do not create this yet)

When we start coding, we will add folders **one step at a time**:

```
frontend/                 static site
backend/functions/       Python Lambdas
infra/bootstrap/          state bucket, OIDC, budgets (once)
infra/live/               the application
infra/modules/            reusable Terraform
tests/                    unit then integration
docs/                     notes you write as you learn
.github/workflows/        CI/CD last, not first
```

Today this folder should contain **only this file**.

---

## Build order (this is the syllabus)

Each numbered step is a future session. We stop at the end of a step until you are ready.

### Step 1 — AWS account guardrails (no app yet)

- Confirm MFA on root, no root access keys
- IAM user (or SSO) for you, with MFA
- Create **$1 and $5 Budgets** in the console (email you)
- Know the regions: `ap-south-1` vs `us-east-1`

**You will learn:** billing safety, IAM vs root, why NAT/ALB would ruin the budget.

### Step 2 — Empty git repo and a README you write

- `git init`, `.gitignore`
- A short README in your own words: what Aether Lab will be

**You will learn:** this is a public proof-of-work repo, not a tutorial dump.

### Step 3 — Frontend skeleton only (localhost)

- Vite + React (or HTML first if you prefer — we will choose together)
- Pages: Home, Labs, Atlas, Pillars, Ship — can be mostly placeholder text
- Tracer panel with **hardcoded** hops (no AWS)

**You will learn:** the product UX before cloud complexity.

### Step 4 — One Lambda in the console, then Python on your machine

- Hello handler, understand event/response
- Then visitor counter logic with DynamoDB **after** you understand the handler

**You will learn:** serverless compute, IAM role of a function.

### Step 5 — Terraform bootstrap

- S3 bucket for Terraform state
- Lock table
- (Later in this step) GitHub OIDC provider + role — we will go slowly

**You will learn:** why local state is dangerous, what “backend” means.

### Step 6 — Terraform the CRC core

- DynamoDB table
- Lambda + API Gateway
- S3 + CloudFront with **OAC** (bucket stays private)

**You will learn:** the classic Cloud Resume path, done properly (no public website bucket).

### Step 7 — Wire the frontend to the live counter

- Tracer shows the real path from the API response

**You will learn:** CORS / same-origin via CloudFront, env vs relative `/api`.

### Step 8 — GitHub Actions + OIDC

- Lint, unit tests, terraform plan/apply, upload site, invalidate CloudFront

**You will learn:** no long-lived keys in GitHub.

### Step 9 — Message Relay (SQS + DLQ)

**You will learn:** retries, dead-letter queues, Reliability pillar.

### Step 10 — Upload pipeline (presigned S3 + EventBridge)

**You will learn:** never put AWS keys in the browser.

### Step 11 — Quiz + Cognito (optional login)

**You will learn:** JWT authorizer vs public POST.

### Step 12 — Observability

- CloudWatch dashboard, alarms to SNS, X-Ray, 7-day log retention

### Step 13 — Atlas + pillars pages with real content + Well-Architected Tool

### Step 14 — Medium articles (you write; I help outline)

1. CRC in Terraform, private S3  
2. OIDC + tests  
3. Six pillars on a $5 budget  

Then polish, optional custom domain, interview script: *explain this request.*

---

## What you need on your machine (for later steps, not tonight)

- VS Code
- AWS account + CLI (Step 1–2)
- Git + GitHub account
- Node.js (frontend)
- Python 3.12 (Lambdas and tests)
- Terraform CLI (from Step 5)

Do not install everything in a panic. We install when the step needs it.

---

## Success looks like

In an interview you can say, without reading a script:

> A browser hits CloudFront. Static routes stay on a private S3 origin via OAC. `/api/*` goes to an HTTP API in Mumbai. Lambda writes to DynamoDB or SQS. Failures retry, then a DLQ and an alarm. GitHub never stored my AWS keys.

If you cannot say that yet, that is expected. That sentence is the *goal* of the syllabus above.

---

## Your next action

1. Read this file once more.
2. Write down anything that is unclear (OIDC, OAC, DLQ, Terraform state — all fair).
3. When you are ready for **Step 1 (AWS account guardrails only)**, reply and we start there.

No folders. No Terraform. No `npm`. Not until you say go.
