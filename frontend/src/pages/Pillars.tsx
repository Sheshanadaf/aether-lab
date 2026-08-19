const pillars = [
  "Operational Excellence",
  "Security",
  "Reliability",
  "Performance Efficiency",
  "Cost Optimization",
  "Sustainability",
];

export function PillarsPage() {
  return (
    <article>
      <p className="kicker">Well-Architected</p>
      <h1>Six pillars</h1>
      <p>Later each pillar maps to a concrete control in this repo.</p>
      <ul>
        {pillars.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </article>
  );
}