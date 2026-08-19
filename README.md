# Aether Lab

Aether Lab is my public proof-of-work: a portfolio site plus a few **live AWS labs**. Visitors can use real cloud features (counter, queues, uploads, a quiz) and see the architecture behind each click — CloudFront, API Gateway, Lambda, DynamoDB, and the rest — instead of only reading a diagram.

I am building it step by step (account safety → git → frontend → Terraform → labs → CI/CD). It is **not deployed to AWS yet**. The stack will stay near the free tier (target under ~$5/month): serverless, no NAT Gateway, no idle RDS/EKS.

## Who I am

I am **Sheshan Hebron**. I am doing a **BSc (Hons) in Cloud Computing** and I am based in **Colombo, Sri Lanka**.

I completed a **DevOps Engineer** internship at **10QBIT**, working **remotely** for a **UK** team.

**Certifications**

- AWS Certified Cloud Practitioner
- AWS Certified Solutions Architect – Associate

**Find me**

- YouTube (I teach AWS to Sri Lankan students): [CloudNest](https://www.youtube.com/@CloudNest1)
- LinkedIn: [sheshan-hebron](https://www.linkedin.com/in/sheshan-hebron-04a557213/)
- GitHub: [Sheshanadaf](https://github.com/Sheshanadaf)
- Medium: [@sheshanhebron61](https://medium.com/@sheshanhebron61)

## What I am building

- A resume/portfolio that looks like a real site (photo, internship, certs, YouTube, projects) — we will design that when we reach the frontend.
- **Live labs** wired to AWS so I can walk an interviewer through a request path.
- A **Request Tracer** panel: every action shows the hop list and which Well-Architected pillar it demonstrates.
- An **Architecture Atlas**: services that run in this project vs services I know but did not turn on (because of cost).
- **Terraform** for infrastructure, **GitHub Actions with OIDC** so there are no long-lived AWS keys in GitHub.

## Status

Learning build. Step 2 (git + README). Next: frontend skeleton on localhost.

## How I work on this

I follow `PLAN.md`. Each step has its own notes (`STEP-1.md`, `STEP-2.md`, …). I type the work; I do not paste a finished repo I cannot explain.
