export function ShipPage() {
  return (
    <article>
      <p className="kicker">CI/CD</p>
      <h1>How it ships</h1>
      <p>
        GitHub Actions on <code>main</code> assumes IAM role <code>aether-lab-github-actions</code> with
        OIDC. There are no <code>AKIA</code> keys in GitHub. Terraform applies <code>infra/live</code> only.
        Bootstrap (state bucket, lock, OIDC) was applied once from a laptop.
      </p>
      <p>
        Origin Access Control: CloudFront may read the site bucket; the bucket stays private.
      </p>
      <p>
        Observability: Lambda logs keep 7 days. HTTP API access logs go to CloudWatch. X-Ray Active
        tracing is on the lab functions. A dashboard named aether-lab shows invocations, errors, and
        DLQ depth. An SNS email alarm fires if the jobs DLQ is not empty.
      </p>
    </article>
  );
}