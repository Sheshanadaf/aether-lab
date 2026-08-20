const HERO_ICONS = [
  { src: "/skills/aws-badge.svg", name: "AWS", delay: "0s" },
  { src: "/skills/terraform.svg", name: "Terraform", delay: "-1.2s" },
  { src: "/skills/docker.svg", name: "Docker", delay: "-2.4s" },
  { src: "/skills/lambda.svg", name: "Lambda", delay: "-3.1s" },
  { src: "/skills/kubernetes.svg", name: "Kubernetes", delay: "-4.4s" },
  { src: "/skills/githubactions.svg", name: "Actions", delay: "-5.2s" },
  { src: "/skills/cloudfront.svg", name: "CloudFront", delay: "-6.3s" },
  { src: "/skills/s3.svg", name: "S3", delay: "-7.1s" },
];

export function HeroBackdrop() {
  return (
    <aside className="hero-rail" aria-hidden>
      <svg className="hero-arch" viewBox="0 0 64 640" fill="none" preserveAspectRatio="none">
        <path d="M32 20 C 18 90, 48 140, 28 210 S 50 310, 32 390 S 14 500, 32 620" />
        <path d="M20 40 C 44 120, 12 200, 36 280 S 18 400, 40 520" />
      </svg>
      {HERO_ICONS.map((icon) => (
        <span className="hero-float" key={icon.name} style={{ animationDelay: icon.delay }}>
          <img src={icon.src} alt="" />
        </span>
      ))}
    </aside>
  );
}
