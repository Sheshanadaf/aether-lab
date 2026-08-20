# Step 8 — GitHub Actions + OIDC

Until now **you** ran Terraform with IAM user keys on your laptop. That is fine for learning. For the **portfolio**, deploys should come from GitHub **without** putting `AKIA…` in GitHub Secrets.

**OIDC (OpenID Connect):** GitHub proves “this workflow is repo X, branch main.” AWS STS gives the role **temporary** credentials (~1 hour).

You already created the role:

`arn:aws:iam::583966366465:role/aether-lab-github-actions`

It **cannot deploy yet** (identity only). This step attaches a **policy**, then a **workflow**.

Repo on GitHub must match bootstrap `github_owner` / `github_repo` (e.g. `Sheshanadaf/aether-lab`). Repos created **after 15 Jul 2026** also send numeric IDs in the OIDC `sub` (`repo:Sheshanadaf@115085953/aether-lab@1339776175:...`). The trust policy must allow that shape, not only the old `repo:owner/repo:*` string.

---

## Part A — Attach deploy permissions (bootstrap)

On your laptop, add **`infra/bootstrap/gha_policy.tf`**:

```hcl
data "aws_iam_policy_document" "github_actions_deploy" {
  statement {
    sid = "DeployAetherLive"
    actions = [
      "s3:*",
      "cloudfront:*",
      "lambda:*",
      "apigateway:*",
      "dynamodb:*",
      "logs:*",
      "iam:GetRole",
      "iam:GetRolePolicy",
      "iam:ListRolePolicies",
      "iam:ListAttachedRolePolicies",
      "iam:PassRole",
      "iam:CreateRole",
      "iam:DeleteRole",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:PutRolePolicy",
      "iam:DeleteRolePolicy",
      "iam:AttachRolePolicy",
      "iam:DetachRolePolicy",
      "iam:UpdateAssumeRolePolicy",
    ]
    resources = ["*"]
  }

  statement {
    sid = "StateAndLock"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket",
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
      "dynamodb:DescribeTable",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  name   = "aether-lab-live-deploy"
  role   = aws_iam_role.github_actions.id
  policy = data.aws_iam_policy_document.github_actions_deploy.json
}
```

This is **wider than production least privilege**. For a **personal lab account** it is acceptable. In an interview say: *I would scope ARNs to `aether-lab-*` next.*

```powershell
cd infra\bootstrap
terraform plan
terraform apply
```

You should see **one IAM role policy** added, not a new bucket.

---

## Part B — GitHub repository

If the project is not on GitHub yet:

1. GitHub → **New repository** → name must match `github_repo` (e.g. `aether-lab`).
2. **Public** is good for a portfolio (and free Actions minutes).
3. Do **not** add a README on GitHub if you already have commits locally.

```powershell
cd "D:\Projects\Advanced Architectural Project"
git remote add origin https://github.com/Sheshanadaf/YOUR_REPO.git
git branch -M main
git push -u origin main
```

If `origin` already exists, use your real URL. Push **after** you add the workflow file (Part D) so the first Actions run has the YAML.

---

## Part C — GitHub Secrets (not access keys)

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret | Value |
|---|---|
| `AWS_ROLE_ARN` | `arn:aws:iam::583966366465:role/aether-lab-github-actions` |
| `TF_STATE_BUCKET` | `aether-lab-tfstate-4bb51456` |
| `TF_LOCK_TABLE` | `aether-lab-tf-lock` |
| `VITE_API_BASE` | `https://dkoyf7v9v6.execute-api.ap-south-1.amazonaws.com` |

There is **no** `AWS_ACCESS_KEY_ID`. If you add one, you missed the point of OIDC.

---

## Part D — Workflow file

Create **`.github/workflows/deploy.yml`**:

```yaml
name: Deploy Aether Lab

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  id-token: write
  contents: read

env:
  AWS_REGION: ap-south-1

jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - name: Build
        working-directory: frontend
        run: |
          echo "VITE_API_BASE=${{ secrets.VITE_API_BASE }}" > .env.production
          npm ci
          npm run build

  terraform:
    needs: [frontend]
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: infra/live
    steps:
      - uses: actions/checkout@v4
      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "1.11.4"
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}
      - name: Write backend.hcl
        run: |
          cat > backend.hcl <<EOF
          bucket         = "${{ secrets.TF_STATE_BUCKET }}"
          key            = "live/terraform.tfstate"
          region         = "ap-south-1"
          dynamodb_table = "${{ secrets.TF_LOCK_TABLE }}"
          encrypt        = true
          EOF
      - name: Terraform init and apply
        run: |
          terraform init -backend-config=backend.hcl -input=false
          terraform apply -auto-approve -input=false
      - name: Outputs
        id: out
        run: |
          echo "bucket=$(terraform output -raw site_bucket)" >> "$GITHUB_OUTPUT"
          echo "dist=$(terraform output -raw cloudfront_distribution_id)" >> "$GITHUB_OUTPUT"
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - name: Build frontend for S3
        working-directory: frontend
        run: |
          echo "VITE_API_BASE=${{ secrets.VITE_API_BASE }}" > .env.production
          npm ci
          npm run build
      - name: Sync S3 and invalidate CloudFront
        working-directory: .
        run: |
          aws s3 sync frontend/dist "s3://${{ steps.out.outputs.bucket }}" --delete
          aws s3 cp frontend/dist/index.html "s3://${{ steps.out.outputs.bucket }}/index.html" --cache-control "no-cache"
          aws cloudfront create-invalidation --distribution-id "${{ steps.out.outputs.dist }}" --paths "/*"
```

**Why `id-token: write`:** GitHub will mint the OIDC token. Without it, `configure-aws-credentials` cannot assume the role.

**Why two frontend builds:** the first job proves the site compiles even if AWS is down. The second uses the same secrets after Terraform so `site_bucket` is always current.

Ubuntu runners are Linux: `terraform init -backend-config=backend.hcl` (space form) is OK there. You still use quotes on **Windows**.

---

## Part E — Push and watch

```powershell
git add .github/workflows/deploy.yml infra/bootstrap/gha_policy.tf STEP-8.md
git status
git commit -m "Add GitHub Actions OIDC deploy and IAM policy for the GHA role."
git push
```

GitHub → **Actions** tab → open the run.

**Success:** green jobs; CloudFront still serves the site; a new invalidation exists.

**Typical failures**

| Error | Meaning |
|---|---|
| `Not authorized to perform sts:AssumeRoleWithWebIdentity` | IAM trust `sub` ≠ the GitHub token. New GitHub repos use `repo:OWNER@OWNER_ID/REPO@REPO_ID:ref:...` (CloudTrail username). Trust must include that pattern, not only `repo:OWNER/REPO:*`. Re-apply bootstrap after changing `oidc.tf`. Do **not** add access keys. |
| `AccessDenied` on S3/Lambda | Part A policy not applied |
| `npm ci` fails | No `frontend/package-lock.json` — run `npm install` in `frontend` and commit the lockfile |
| Backend init error | Secrets `TF_STATE_BUCKET` / `TF_LOCK_TABLE` typos |

---

## What you should be able to say

> GitHub Actions does not store my AWS access keys. It presents an OIDC token; IAM lets only `Sheshanadaf/<repo>` on `main` assume `aether-lab-github-actions`. Those credentials expire quickly. The workflow runs Terraform and syncs S3, then invalidates CloudFront.

---

## Done when

- Actions run is green (or you pasted the error)
- You did **not** add `AWS_ACCESS_KEY_ID` to GitHub

Reply with pass/fail and any error text. Next is **Step 9** — Message Relay (SQS + DLQ) in Terraform and a Labs button.
