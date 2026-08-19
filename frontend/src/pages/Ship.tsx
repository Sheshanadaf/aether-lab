export function ShipPage() {
  return (
    <article>
      <p className="kicker">CI/CD</p>
      <h1>How it will ship</h1>
      <p>
        Later: Terraform modules, GitHub Actions, OIDC (OpenID Connect — GitHub
        proves who it is; AWS gives temporary keys). No AKIA keys in GitHub.
      </p>
      <p>
        OAC (Origin Access Control): CloudFront may read S3; the bucket stays
        private.
      </p>
    </article>
  );
}