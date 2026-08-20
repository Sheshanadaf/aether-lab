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