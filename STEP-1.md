# Step 1 — AWS account guardrails

Do this in the **AWS Console** in a browser. No Terraform, no GitHub Actions, no project folders.

Goal: you cannot accidentally wake up to a bill, and you never use the **root** user for daily work.

Tick each box as you finish it. If you get stuck, tell me which number and what you see on screen.

---

## 1. Sign in as root (this once)

- Use the email/password of the AWS account (root).
- If you already have MFA on root and an IAM user, say so — we skip what is already done.

**Why:** Root is the owner of the account. If it is stolen, the attacker owns everything, including billing.

---

## 2. Turn on MFA for root

1. Click your account name (top right) → **Security credentials**.
2. Find **Multi-factor authentication (MFA)** → **Assign MFA**.
3. Choose an **authenticator app** (Google Authenticator, Authy, Microsoft Authenticator). Prefer app over SMS.
4. Scan the QR code, enter two consecutive codes, finish.

You should see MFA as **assigned**.

**Why:** Password alone is not enough. MFA is the single most important click in this whole project.

---

## 3. Confirm root has NO access keys

On the same **Security credentials** page, find **Access keys**.

- There should be **none**.
- If you see an `AKIA...` key, **deactivate and delete** it. We will never use root keys.

**Why:** Access keys are a password for the API. Root keys + leaked laptop = full account takeover.

---

## 4. Create a human IAM user for you (daily work)

1. Open **IAM** → **Users** → **Create user**.
2. Username: something like `sheshan` (your name, not `admin`).
3. Enable **Provide user access to the AWS Management Console**.
4. Create a password you will remember (or autogenerate and save in a password manager).
5. For permissions: **Attach policies directly** → `AdministratorAccess` is OK for a **personal lab account** while you learn. (At work you would never do this; we will tighten later.)
6. Create the user.

Then:

7. Open that user → **Security credentials** → **Assign MFA** (same authenticator app).
8. Optional but good: **Access keys** for CLI — create **one** key for *this IAM user*, not root. Store it only on your PC (`aws configure`). We will stop using that key for deploys once OIDC exists.

**Why:** Daily work as IAM user means a leak of your laptop keys is still bad, but it is not “root plus billing plus delete the org.” MFA on this user too.

Sign **out** of root. Sign **in** as this IAM user for everything after this.

Console sign-in URL looks like:  
`https://YOUR_ACCOUNT_ID.signin.aws.amazon.com/console`

---

## 5. Turn on billing alerts (account setting)

Still as IAM user (you may need to log in as root once if billing is hidden):

1. Search **Billing** → **Billing preferences** (or **Account**).
2. Enable **Receive Billing Alerts** if you see that checkbox.
3. Confirm a valid email on the account.

IAM users cannot see bills until root (or an admin) enables **IAM access to billing**. If the Billing console is blocked:

1. Sign in as **root** briefly.
2. **Account** → **IAM user and role access to Billing information** → activate.
3. Sign back in as your IAM user.

---

## 6. Create two AWS Budgets ($1 and $5)

Search **Budgets** (under Billing and Cost Management).

Create **budget 1:**

- Type: **Cost budget**
- Period: **Monthly**
- Amount: **1 USD**
- Scope: entire account is fine
- Alert: when **actual** cost **> 80%** ($0.80) → email **your** address
- Second alert: **100%** actual (optional but good)

Create **budget 2:** same, amount **5 USD**, alerts at 80% and 100%.

Check the inbox (and spam). **Confirm** any subscription email from AWS.

**Why:** Terraform can create budgets later. Doing it **by hand first** means you have a safety net before any `apply`. This is Step 1’s whole point.

---

## 7. Look at regions (do not create resources)

Top right of the console is the region selector.

- Find **Asia Pacific (Mumbai) `ap-south-1`**. Our Lambda and DynamoDB will live here later (close to Sri Lanka).
- Find **US East (N. Virginia) `us-east-1`**. We only need this later for a CloudFront certificate if we buy a domain. **Do not create anything there now.**

Switch the console to **Mumbai (`ap-south-1`)** and leave it there for this project.

**Why:** Creating an RDS or NAT “just to look” in the wrong region is how surprise bills start. We are only looking.

---

## 8. What you must NOT click in this step

Do not create: EC2, RDS, VPC “with NAT”, Elastic IP, Load Balancer, EKS, Lightsail.

Do not start the Aether Lab Terraform. That is a later step.

---

## Done when you can say all of this

- Root has MFA, and root has **zero** access keys.
- I log in as an IAM user who also has MFA.
- I received (or will confirm) budget emails for **$1** and **$5**.
- I know Mumbai vs N. Virginia and why we pick Mumbai for compute.

Reply in chat with: what you completed, and anything that looked different in the console. Then we go to **Step 2** (git + a README in your own words).
