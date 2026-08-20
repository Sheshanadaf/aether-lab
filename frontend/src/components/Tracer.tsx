import { useTracer } from "../lib/tracer";

export function Tracer() {
  const { trace } = useTracer();

  return (
    <aside className="tracer">
      <p className="kicker">Request tracer</p>
      <h2>{trace.demo ? "Demo / error" : "What AWS just did"}</h2>
      <p>
        {trace.demo
          ? "Waiting for a successful POST /visits."
          : `Request ${trace.requestId}`}
      </p>
      {trace.path.map((hop, i) => (
        <div className="hop" key={`${hop.service}-${i}`}>
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