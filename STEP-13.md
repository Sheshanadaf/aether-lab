# Step 13 — Atlas, six pillars, Well-Architected Tool

The labs are real. Interviewers still ask two other things:

1. **What did you not turn on, and why?** (honesty + cost)
2. **How does this map to the Well-Architected Framework?** (not slogans)

This step is **words on the site** plus a **free AWS console tool**. No new queues. No new Lambdas.

**Live** = provisioned in your account (Terraform or Step 1 Budgets).  
**Atlas-only** = you can explain it; you did **not** pay to run it here.

Do not list a service as live if we never applied it (no CloudFront Function, no contact-form SNS, no SSM, no WAF).

---

## Part A — Atlas data

Create **`frontend/src/lib/atlas.ts`**:

```ts
export type AtlasRow = {
  name: string;
  family: string;
  live: boolean;
  usedFor: string;
  whenAtWork: string;
};

export const ATLAS: AtlasRow[] = [
  {
    name: "Amazon S3",
    family: "Storage",
    live: true,
    usedFor: "Private site origin (OAC), inbox uploads (7-day expiry), Terraform state.",
    whenAtWork: "Default object store for assets, backups, data lakes.",
  },
  {
    name: "Amazon CloudFront",
    family: "Networking",
    live: true,
    usedFor: "HTTPS, cache, default cert. Shield Standard is on automatically.",
    whenAtWork: "Put a CDN in front of any internet-facing content.",
  },
  {
    name: "AWS Lambda (arm64)",
    family: "Compute",
    live: true,
    usedFor: "HTTP API, SQS worker, upload metadata, Cognito pre sign-up. Scale to zero.",
    whenAtWork: "Event-driven work; not a 24/7 app server.",
  },
  {
    name: "Amazon API Gateway HTTP API",
    family: "Networking",
    live: true,
    usedFor: "Routes, CORS, JWT authorizer on POST /quiz, access logs, throttle 10 rps.",
    whenAtWork: "Public HTTPS front door for Lambdas. REST API if you need API keys/WAF-style extras.",
  },
  {
    name: "Amazon DynamoDB",
    family: "Database",
    live: true,
    usedFor: "Single table: counter, jobs, uploads, quiz scores. On-demand billing.",
    whenAtWork: "Low-latency key-value at any scale; not SQL joins.",
  },
  {
    name: "Amazon SQS + DLQ",
    family: "Integration",
    live: true,
    usedFor: "Message Relay. maxReceiveCount 3 then dead-letter queue.",
    whenAtWork: "Decouple producers from workers; absorb spikes.",
  },
  {
    name: "Amazon EventBridge",
    family: "Integration",
    live: true,
    usedFor: "S3 Object Created → upload Lambda.",
    whenAtWork: "Bus between many AWS services without hard-wiring each pair.",
  },
  {
    name: "Amazon Cognito User Pool",
    family: "Security",
    live: true,
    usedFor: "Email/password. IdToken for POST /quiz. Not an Identity Pool (no AWS keys in the browser).",
    whenAtWork: "Customer identity. Use Hosted UI + PKCE in production apps.",
  },
  {
    name: "Amazon SNS",
    family: "Integration",
    live: true,
    usedFor: "Alarm email when the jobs DLQ is not empty. Confirm the subscription.",
    whenAtWork: "Fan-out: email, SMS, Lambda, HTTPS. We did not build a public contact form.",
  },
  {
    name: "IAM + STS + GitHub OIDC",
    family: "Security",
    live: true,
    usedFor: "GitHub assumes aether-lab-github-actions with a 2026 immutable sub claim. No AKIA in GitHub.",
    whenAtWork: "Default for CI into AWS. Least-privilege roles, short credentials.",
  },
  {
    name: "Amazon CloudWatch",
    family: "Ops",
    live: true,
    usedFor: "7-day logs, dashboard aether-lab, DLQ and worker-error alarms.",
    whenAtWork: "Metrics, logs, alarms for every production account.",
  },
  {
    name: "AWS X-Ray",
    family: "Ops",
    live: true,
    usedFor: "Active tracing on counter, worker, upload Lambdas.",
    whenAtWork: "Follow one request across services when logs are not enough.",
  },
  {
    name: "AWS Budgets",
    family: "Cost",
    live: true,
    usedFor: "$1 and $5 email alerts from Step 1 (console, not live Terraform).",
    whenAtWork: "Every account needs a budget before the first experimental cluster.",
  },
  {
    name: "Amazon EC2",
    family: "Compute",
    live: false,
    usedFor: "Not in this lab.",
    whenAtWork: "Always-on VMs, Windows, special software. Idle EC2 would blow a $5/month budget.",
  },
  {
    name: "NAT Gateway",
    family: "Networking",
    live: false,
    usedFor: "Not in this lab.",
    whenAtWork: "Private subnets that must reach the internet. Roughly tens of dollars/month idle — refused here.",
  },
  {
    name: "Application Load Balancer",
    family: "Networking",
    live: false,
    usedFor: "Not in this lab. HTTP API is the front door.",
    whenAtWork: "HTTP(S) to ECS/EC2/EKS. Hourly charge even with no traffic.",
  },
  {
    name: "Amazon RDS / Aurora",
    family: "Database",
    live: false,
    usedFor: "Not in this lab. DynamoDB covers key-value.",
    whenAtWork: "Relational data, transactions, SQL. Needs a subnet, backups, patching.",
  },
  {
    name: "Amazon EKS",
    family: "Compute",
    live: false,
    usedFor: "Not in this lab.",
    whenAtWork: "Many microservices, Kubernetes skills on the team. Control plane cost before a single pod.",
  },
  {
    name: "Amazon ECS / Fargate",
    family: "Compute",
    live: false,
    usedFor: "Not in this lab.",
    whenAtWork: "Containers without managing EC2. Still more moving parts than Lambda for this size.",
  },
  {
    name: "AWS WAF",
    family: "Security",
    live: false,
    usedFor: "Not in this lab. API throttle is the cheap guardrail.",
    whenAtWork: "OWASP rules, rate limits, bot control in front of CloudFront or ALB. WebACL has a monthly floor.",
  },
  {
    name: "Customer-managed KMS keys",
    family: "Security",
    live: false,
    usedFor: "Not in this lab. S3 uses SSE-S3 (AES256).",
    whenAtWork: "When compliance needs key rotation and CloudTrail on every decrypt. CMKs have a monthly fee.",
  },
  {
    name: "AWS Secrets Manager",
    family: "Security",
    live: false,
    usedFor: "Not in this lab. No long-lived DB passwords.",
    whenAtWork: "Rotate RDS/API secrets. Per-secret monthly cost — SSM Parameter Store is cheaper for simple values.",
  },
  {
    name: "Amazon ElastiCache / OpenSearch",
    family: "Database",
    live: false,
    usedFor: "Not in this lab. CloudFront caches static files.",
    whenAtWork: "Sub-millisecond session cache, or full-text search. Nodes idle-bill.",
  },
  {
    name: "Amazon GuardDuty / Bedrock",
    family: "Security / AI",
    live: false,
    usedFor: "Not in this lab.",
    whenAtWork: "GuardDuty: threat findings on CloudTrail/VPC/S3. Bedrock: managed FMs when the product needs AI, not for a resume counter.",
  },
  {
    name: "AWS CodePipeline",
    family: "DevOps",
    live: false,
    usedFor: "Not in this lab. GitHub Actions + OIDC instead.",
    whenAtWork: "All-in on AWS-native CI. Either is valid; we already live on GitHub.",
  },
];
```

**Why a data file:** the page is a table. Interviewers can read `atlas.ts` in GitHub. Adding a service later is one object, not a new layout.

---

## Part B — Atlas page

Replace **`frontend/src/pages/Atlas.tsx`**:

```tsx
import { useMemo, useState } from "react";
import { ATLAS } from "../lib/atlas";

export function AtlasPage() {
  const [filter, setFilter] = useState<"all" | "live" | "not">("all");
  const rows = useMemo(() => {
    if (filter === "live") return ATLAS.filter((r) => r.live);
    if (filter === "not") return ATLAS.filter((r) => !r.live);
    return ATLAS;
  }, [filter]);

  return (
    <article>
      <p className="kicker">Architecture atlas</p>
      <h1>What runs vs what I refused</h1>
      <p className="lede">
        Live means it exists in this AWS account. Atlas-only means I can explain when I would use it
        at work — and why it would break a ~$5/month lab (NAT, RDS, EKS, idle EC2).
      </p>
      <p>
        <button type="button" onClick={() => setFilter("all")}>
          All
        </button>{" "}
        <button type="button" onClick={() => setFilter("live")}>
          Live
        </button>{" "}
        <button type="button" onClick={() => setFilter("not")}>
          Not in this lab
        </button>
      </p>
      {rows.map((r) => (
        <section key={r.name}>
          <h2>
            {r.name}{" "}
            <small>{r.live ? "live" : "atlas only"} · {r.family}</small>
          </h2>
          <p>
            <strong>Here:</strong> {r.usedFor}
          </p>
          <p>
            <strong>At work:</strong> {r.whenAtWork}
          </p>
        </section>
      ))}
    </article>
  );
}
```

`npm run dev` → Atlas → **Live** should include S3, Lambda, Cognito. **Not in this lab** should include NAT and EKS.

---

## Part C — Six pillars (map to this repo)

Replace **`frontend/src/pages/Pillars.tsx`**:

```tsx
const PILLARS = [
  {
    name: "Operational Excellence",
    meaning: "Run it with code and visibility, not mystery clicks.",
    here: [
      "Terraform in infra/live; GitHub Actions apply on main.",
      "CloudWatch dashboard aether-lab, API access logs, X-Ray Active on lab Lambdas.",
      "Request Tracer shows the hop list the API returned.",
    ],
  },
  {
    name: "Security",
    meaning: "Least privilege, no secrets in the browser or in GitHub.",
    here: [
      "Site bucket private; only CloudFront reads it (OAC).",
      "GitHub OIDC — no AKIA in Secrets. Quiz POST needs a Cognito IdToken.",
      "Presigned S3 PUT so uploads never carry IAM keys in JavaScript.",
    ],
  },
  {
    name: "Reliability",
    meaning: "Fail in a box you can see, then alert.",
    here: [
      "SQS retries three times; then the DLQ.",
      "CloudWatch alarm + SNS email when the DLQ is not empty.",
      "HTTP API throttle (10 rps) so a scrape cannot run unbounded.",
    ],
  },
  {
    name: "Performance Efficiency",
    meaning: "Use the right service and the close region.",
    here: [
      "Lambda and API in ap-south-1 (Mumbai), near Sri Lanka.",
      "CloudFront caches the static site. HTTP API, not a fleet of EC2.",
      "Images go to S3 directly; they do not travel through Lambda.",
    ],
  },
  {
    name: "Cost Optimization",
    meaning: "Pay for requests, not idle machines.",
    here: [
      "$1 / $5 Budgets. Scale-to-zero Lambda. DynamoDB on-demand.",
      "Logs and inbox uploads expire in 7 days.",
      "Atlas lists NAT, RDS, EKS, ALB as refused because they idle-bill.",
    ],
  },
  {
    name: "Sustainability",
    meaning: "Less always-on hardware, fewer wasted origin hits.",
    here: [
      "arm64 / Graviton Lambdas.",
      "No idle RDS or EC2.",
      "CloudFront reduces repeat reads of S3.",
    ],
  },
];

export function PillarsPage() {
  return (
    <article>
      <p className="kicker">Well-Architected</p>
      <h1>Six pillars on this stack</h1>
      <p className="lede">
        Each pillar is a sentence plus controls that exist in Aether Lab — not a poster of AWS logos.
      </p>
      {PILLARS.map((p) => (
        <section key={p.name}>
          <h2>{p.name}</h2>
          <p>{p.meaning}</p>
          <ul>
            {p.here.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  );
}
```

Read **Six pillars** once out loud. If you cannot point at a file or console screen for a bullet, the bullet is too vague — tell me and we tighten it.

---

## Part D — Well-Architected Tool (console, free)

This is **not** Terraform. It is a questionnaire AWS uses in real reviews. Juniors almost never have a workload in the tool. You will.

1. Console search: **AWS Well-Architected Tool** (if the region picker complains, switch to **us-east-1** for the tool — the workload can still be described as Mumbai).
2. **Define workload**
   - Name: `Aether Lab`
   - Description: Serverless portfolio: CloudFront, HTTP API, Lambda, DynamoDB, SQS/DLQ, Cognito, OIDC CI.
   - Environment: **Pre-production** (it is a lab).
   - Regions: **ap-south-1** (and global CloudFront if asked).
   - Industry: skip or Education / Software.
3. Start a review with the **AWS Well-Architected Framework** lens (not a partner lens).
4. You do **not** need every question today. For each pillar, answer from this repo:
   - Ops: IaC + CI + 7-day logs + dashboard + alarms  
   - Security: OAC, OIDC, JWT on quiz, no keys in JS  
   - Reliability: SQS + DLQ + alarm  
   - Performance: CloudFront, Mumbai, presigned PUT  
   - Cost: Budgets, no NAT/RDS, log expiry  
   - Sustainability: Graviton, no idle VMs  
5. Save a **milestone** named `step-13` so you can reopen it later.
6. Optional: screenshot the workload summary (do **not** put account id in the public README).

If a question is about VPC, multi-AZ RDS, or EKS: choose the honest option — **not applicable / we do not run that** — and write in notes “serverless lab; see Atlas.”

---

## Part E — Push

```powershell
cd "D:\Projects\Advanced Architectural Project"
git add frontend/src/lib/atlas.ts frontend/src/pages/Atlas.tsx frontend/src/pages/Pillars.tsx STEP-13.md
git status
git commit -m "Document live vs refused AWS services and map six pillars to this repo."
git push
```

CloudFront will show Atlas/Pillars after Actions. Deep link `/atlas` may 404 on refresh (no CloudFront Function). Use the nav from `/`.

---

## What you should be able to say

> The Atlas is two lists: what this account actually runs, and what I refused because it idle-bills. NAT, RDS, and EKS are in the second list on purpose. Each Well-Architected pillar maps to a control in this repo — OIDC, OAC, DLQ plus SNS, 7-day logs, Graviton. I also started a workload in the Well-Architected Tool so the review is not only a webpage.

---

## Done when

- Atlas filter **Live** / **Not in this lab** both look honest
- Six pillars page names **this** stack (OIDC, DLQ, Mumbai, Budgets)
- You created (or started) a Well-Architected Tool workload named Aether Lab

Reply with: how many Atlas rows show as live, and whether the WA Tool workload saved. Next is **Step 14** — Medium articles (you write; I help outline).
