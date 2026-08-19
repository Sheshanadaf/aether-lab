# Step 5 — Terraform bootstrap (state + lock, then OIDC slowly)

No website. No Lambda API. No CloudFront.

You will create **two** small AWS resources that Terraform itself needs, then (only if that worked) the GitHub **OIDC** identity pieces.

Region: **`ap-south-1`**. Sign in as your **IAM user**, not root. Step 1 budgets stay on.

---

## Why this step exists

Terraform is a program: you write `.tf` files, it **creates/updates/deletes** AWS for you.

It remembers what it created in a **state file** (`terraform.tfstate`).

- If state lives only on your laptop and the laptop dies, Terraform **forgets** the real AWS resources. Next `apply` may try to create duplicates. Messy and can cost money.
- If two people (or you + GitHub Actions) run Terraform at once, they can corrupt state.

So we **bootstrap**:

1. **S3 bucket** — encrypted, private, versioned — holds state.
2. **DynamoDB table** — a **lock** so only one `apply` runs at a time.

This folder uses **local** state the first time (chicken and egg: the bucket does not exist yet). The **application** (Step 6) will store *its* state **in** that bucket.

**Do not** put `terraform.tfstate` or `terraform.tfvars` in Git. `.gitignore` from Step 2 already lists them.

---

## Part A — Tools

```powershell
terraform -version
aws --version
aws sts get-caller-identity
```

- Terraform: install from https://developer.hashicorp.com/terraform/install if missing. Open a **new** terminal after install.
- AWS CLI: https://aws.amazon.com/cli/ if missing.
- `get-caller-identity` must show **your IAM user**, not an error. If it fails, `aws configure` with that user’s **access key** (never root keys). Region `ap-south-1`.

You should see an **Account** 12-digit id. You will need it for OIDC later.

---

## Part B — Folders and files (state only first)

From the project root create:

```
infra/bootstrap/
  versions.tf
  variables.tf
  main.tf
  outputs.tf
  terraform.tfvars.example
```

Then copy the example to a **local** file Git must ignore:

```powershell
copy infra\bootstrap\terraform.tfvars.example infra\bootstrap\terraform.tfvars
```

Edit `terraform.tfvars` with your email (the same one as budgets).

### `infra/bootstrap/versions.tf`

```hcl
terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.100"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = var.project
      ManagedBy = "terraform"
      Step      = "bootstrap"
    }
  }
}
```

**Why `default_tags`:** Cost Explorer and “who created this?” later.

**Why `random`:** S3 bucket names are **global**. We add a random suffix so `aether-lab-tfstate` is not taken.

### `infra/bootstrap/variables.tf`

```hcl
variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "project" {
  type    = string
  default = "aether-lab"
}

variable "alert_email" {
  type        = string
  description = "Your email — we do not create new budgets here; Step 1 already did."
}
```

### `infra/bootstrap/terraform.tfvars.example`

```hcl
aws_region  = "ap-south-1"
project     = "aether-lab"
alert_email = "you@example.com"
```

`terraform.tfvars` = same, but **your** email.

### `infra/bootstrap/main.tf`

```hcl
resource "random_id" "suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "tfstate" {
  bucket = "${var.project}-tfstate-${random_id.suffix.hex}"
}

resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "tf_lock" {
  name         = "${var.project}-tf-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}
```

**Why versioning:** if state is overwritten by mistake, you can recover an old object version.

**Why public access block:** state can list resource IDs. Never a public website bucket.

**Why `LockID`:** Terraform’s official S3 backend lock protocol uses that key name. Do not rename it.

### `infra/bootstrap/outputs.tf`

```hcl
output "state_bucket" {
  value = aws_s3_bucket.tfstate.id
}

output "lock_table" {
  value = aws_dynamodb_table.tf_lock.name
}
```

You will copy these values into Step 6.

---

## Part C — The three commands

```powershell
cd infra\bootstrap
terraform init
terraform plan
terraform apply
```

- **init** — downloads the AWS provider into `.terraform/` (gitignored).
- **plan** — dry run. Read it. You should see **S3 + a few bucket settings + one DynamoDB table**. Not EC2. Not NAT.
- **apply** — type `yes` only if the plan looks right.

Then:

```powershell
terraform output
```

Write down **state_bucket** and **lock_table**. Screenshot is fine.

Confirm in the console (Mumbai): the bucket exists, Block Public Access is on, the table `aether-lab-tf-lock` exists.

**If apply fails:** paste the error here. Do not keep clicking. Common: wrong region, no IAM permission, bucket name clash (random_id should avoid that).

---

## Part D — OIDC (only after Part C succeeded)

**OIDC = OpenID Connect.** GitHub Actions proves “I am repo X.” AWS STS gives **temporary** keys. No `AKIA` in GitHub Secrets.

You need a **GitHub repo name** even if you have not pushed yet. Example: `Sheshanadaf/aether-lab` (change if your repo will differ).

### Extra files

Add to `versions.tf` inside `required_providers`:

```hcl
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
```

Add to `variables.tf`:

```hcl
variable "github_owner" {
  type        = string
  description = "GitHub user, e.g. Sheshanadaf"
}

variable "github_repo" {
  type        = string
  description = "Repo name only, e.g. aether-lab"
}
```

Add to **both** `terraform.tfvars` and the example:

```hcl
github_owner = "Sheshanadaf"
github_repo  = "aether-lab"
```

New file **`infra/bootstrap/oidc.tf`**:

```hcl
data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]
}

data "aws_iam_policy_document" "gha_trust" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_owner}/${var.github_repo}:ref:refs/heads/main",
        "repo:${var.github_owner}/${var.github_repo}:pull_request",
      ]
    }
  }
}

resource "aws_iam_role" "github_actions" {
  name               = "${var.project}-github-actions"
  assume_role_policy = data.aws_iam_policy_document.gha_trust.json
}

# Permissions come in the CI/CD step. Identity first.
```

Add to `outputs.tf`:

```hcl
output "github_actions_role_arn" {
  value = aws_iam_role.github_actions.arn
}
```

Then **from `infra/bootstrap` again**:

```powershell
terraform init
terraform plan
terraform apply
```

Plan should add **OIDC provider + IAM role**, not recreate the bucket (name stays).

**`sub` condition:** only that GitHub user/repo, `main` or pull_request. A random other repo cannot assume this role.

We **do not** attach `AdministratorAccess` to this role yet. An empty-permission role that *can* be assumed is enough to learn OIDC. GitHub Actions attach policy comes in Step 8.

---

## What not to do

- Do not `terraform destroy` bootstrap unless you know you will also lose the recipe for the bucket name (you can destroy later; you must re-apply before Step 6).
- Do not enable the S3 backend **inside bootstrap** in this step (optional later). Local state for bootstrap on **your PC** is OK if you do not delete `infra/bootstrap/terraform.tfstate` (gitignored — **back it up** or do not format the disk). If you lose bootstrap state, do not blindly apply again; ask me.

---

## Commit

```powershell
git add infra/bootstrap STEP-5.md
git status
```

Confirm **no** `terraform.tfstate`, **no** `terraform.tfvars`, **no** `.terraform/`.

```powershell
git commit -m "Add Terraform bootstrap for state, lock, and GitHub OIDC."
```

---

## Done when

- `terraform output` shows `state_bucket`, `lock_table`, and (if you did D) `github_actions_role_arn`
- You can say: state = memory of infra; lock = one apply at a time; OIDC = GitHub identity without long-lived keys

Reply with the **output names** (you can hide the random suffix if you want) and whether OIDC apply succeeded. Next is **Step 6** — Terraform the Cloud Resume core (DynamoDB, Lambda, API, S3, CloudFront OAC).
