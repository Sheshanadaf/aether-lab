# Step 2 — Git repo and a README you write

Still no AWS resources, no Terraform, no `npm`. You are only putting this folder under version control and writing **your** introduction to the project.

Keep `PLAN.md` and `STEP-1.md`. They are your notes.

---

## 1. Confirm Git is installed

In a terminal (PowerShell) at this folder:

```powershell
cd "D:\Projects\Advanced Architectural Project"
git --version
```

You should see a version number. If Git is missing, install it from https://git-scm.com then come back.

**Why:** Git is the history of the project. GitHub will be the public proof. Interviewers click the repo.

---

## 2. Initialize the repository

```powershell
git init
git status
```

You should see `PLAN.md`, `STEP-1.md`, `STEP-2.md` as untracked.

**Why:** `git init` creates a hidden `.git` folder. That is the database of commits. Without it there is no history.

Optional, if Git asks for a default branch name:

```powershell
git branch -M main
```

We will use **main** (not master) to match GitHub and later OIDC.

---

## 3. Create `.gitignore`

Create a new file in the project root named `.gitignore` (the dot is required).

Paste this and save. Read the comments; do not skip them.

```
# OS
Thumbs.db
.DS_Store

# Secrets — never commit these
.env
.env.*
!.env.example
*.pem
credentials
terraform.tfvars

# Terraform (later)
.terraform/
*.tfstate
*.tfstate.*
*.tfplan
crash.log
infra/live/backend.hcl

# Node (later)
node_modules/
frontend/dist/

# Python (later)
.venv/
venv/
__pycache__/
.pytest_cache/
.ruff_cache/
.coverage
```

**Why:** Git tracks source, not junk and **not secrets**. `terraform.tfvars` will hold your email and account details. `.tfstate` can contain resource IDs. `node_modules` is huge and regenerable.

Check:

```powershell
git status
```

`.gitignore` should appear as a new file. The ignored patterns will not list themselves as “to be committed” later.

---

## 4. Write `README.md` yourself

Create `README.md` in the project root. **You type the sentences.** I will not write your bio for you.

Use this skeleton. Replace every `TODO` with real text. Keep it honest: the site is not live yet.

```markdown
# Aether Lab

TODO: one sentence — what this project is (your words, not copied from PLAN.md).

## Who I am

TODO: your name, degree, internship (DevOps), where you are.
TODO: mention AWS Certified Cloud Practitioner and Solutions Architect – Associate.
TODO: mention your YouTube channel teaching AWS to Sri Lankan students (name + link when you have it).
TODO: GitHub and Medium links (can be placeholders `https://github.com/YOUR_USER`).

## What I am building

TODO: 4–8 lines. Portfolio + live AWS labs + Request Tracer.
TODO: say we stay near free tier / under ~$5 and will not run NAT, RDS, EKS, etc.

## Status

Learning build. Step 2 complete. Not deployed to AWS yet.

## How I work on this

I am building this step by step (account guardrails → git → frontend → Terraform → labs → CI/CD).
```

**Why:** A README that sounds like ChatGPT is a red flag. A short, specific README that sounds like you is a green flag.

Do **not** paste the whole architecture syllabus into the README. That lives in `PLAN.md`.

---

## 5. First commit (only when you are happy with the README)

```powershell
git add .gitignore README.md PLAN.md STEP-1.md STEP-2.md
git status
git commit -m "Start Aether Lab: plan, step notes, and README."
```

If Git says **user.name / user.email not set**, configure them (this is local Git identity, not AWS):

```powershell
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

Then run `git commit` again.

Look at:

```powershell
git log -1
```

You should see your commit. That is Step 2 done.

**Do not** `git push` yet unless you already created an empty GitHub repo and want to. Pushing can wait until we choose the GitHub name (we need that later for OIDC). If you already know the GitHub username/repo, you can create an empty repo on GitHub and push — tell me if you do.

---

## Done when

- `git log` shows one commit
- `.gitignore` exists
- `README.md` is in **your** voice, with certs and YouTube at least mentioned
- You did **not** commit `.env` or `terraform.tfvars` (they should not exist yet)

Reply with: a paste of your README (or a screenshot), and whether `git commit` worked. Then we start **Step 3** (frontend skeleton on localhost, still no AWS).
