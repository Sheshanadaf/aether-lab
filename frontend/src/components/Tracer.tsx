const hops = [
  { service: "Browser", role: "You, on localhost — not AWS yet" },
  { service: "Amazon CloudFront", role: "HTTPS + cache (later)" },
  { service: "Amazon S3", role: "Private bucket via OAC (later)" },
  { service: "Amazon API Gateway", role: "HTTP API (later)" },
  { service: "AWS Lambda", role: "arm64 in ap-south-1 (later)" },
  { service: "Amazon DynamoDB", role: "Visitor counter (later)" },
];

export function Tracer() {
  return (
    <aside className="tracer">
      <p className="kicker">Request tracer</p>
      <h2>What AWS will do</h2>
      <p>
        Demo only. When the API is live, this list will come from the Lambda
        response.
      </p>
      {hops.map((hop, i) => (
        <div className="hop" key={hop.service}>
          <div className="hop-dot" />
          <div>
            <h3>
              {i + 1}. {hop.service}
            </h3>
            <p>{hop.role}</p>
          </div>
        </div>
      ))}
    </aside>
  );
}