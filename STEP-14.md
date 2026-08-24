# Step 14 — Custom domain (`sheshanhebron.com` via Cloudflare)

The site already works on CloudFront. The domain is registered at **Cloudflare**, not Route 53. That is fine.

- DNS: Cloudflare (grey cloud / DNS only)
- TLS: ACM in **us-east-1** (CloudFront requires that)
- CDN: CloudFront → private S3 (OAC)
- API: still the HTTP API in `ap-south-1`

---

## Part 1 — Request the cert (you run this)

In `infra/live/terraform.tfvars` (gitignored):

```hcl
aws_region           = "ap-south-1"
project              = "aether-lab"
alert_email          = "sheshanhebron61@gmail.com"
custom_domain        = "sheshanhebron.com"
enable_custom_domain = true
attach_custom_domain = false
```

GitHub Actions also needs ACM. Apply bootstrap once if you have not since the policy change:

```powershell
cd "D:\Projects\Advanced Architectural Project\infra\bootstrap"
terraform init
terraform apply
```

Then live:

```powershell
cd "D:\Projects\Advanced Architectural Project\infra\live"
terraform init
terraform apply
terraform output -json acm_validation_records
terraform output cloudfront_dns_target
```

Copy those outputs. Do not set `attach_custom_domain = true` yet.

---

## Part 2 — Cloudflare DNS (console)

Zone: **sheshanhebron.com** → **DNS** → **Records**.

Proxy status for **every** record below: **DNS only** (grey cloud). Not proxied.

### A. ACM validation (from `acm_validation_records`)

For each object in the output:

| Field | What to enter |
|---|---|
| Type | `CNAME` |
| Name | The `name` value. If Cloudflare already appends `sheshanhebron.com`, use only the left label (example: `_abc123`) |
| Target | The `value` value |
| Proxy | DNS only |

There will be one or two CNAMEs. Save them.

### B. Site records (from `cloudfront_dns_target`)

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `@` | `dxxxx.cloudfront.net` (your output, no `https://`) | DNS only |
| CNAME | `www` | same CloudFront hostname | DNS only |

Cloudflare flattens the apex CNAME. Do not use an A record to an S3 website endpoint.

Wait 1–5 minutes.

---

## Part 3 — Attach the cert to CloudFront

Edit `terraform.tfvars`:

```hcl
attach_custom_domain = true
```

```powershell
cd "D:\Projects\Advanced Architectural Project\infra\live"
terraform apply
```

This waits until ACM is **Issued**, then adds aliases `sheshanhebron.com` and `www.sheshanhebron.com`. CloudFront can take 15–20 minutes to finish distributing.

Open:

- https://sheshanhebron.com
- https://www.sheshanhebron.com
- https://sheshanhebron.com/labs (refresh — must not 404)

---

## What not to do

- Do not turn the orange cloud on for these records.
- Do not point the domain at S3 website hosting.
- Do not request ACM in `ap-south-1`.
- Do not create a Route 53 hosted zone for this name (two DNS bosses).

---

## Interview line

> Route 53 would not complete domain registration, so I registered sheshanhebron.com at Cloudflare. DNS is DNS-only to CloudFront. The certificate is ACM in us-east-1 because CloudFront requires that. The API still lives in Mumbai.
