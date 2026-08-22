import { FALLBACK_TRACE, type Trace } from "../lib/api";
import { useTracer } from "../lib/tracer";
import { hopExtras } from "./LabArchitecture";

type Props = {
  trace?: Trace;
  revealed?: boolean;
  emptyHint?: string;
};

function extraTraceFields(trace: Trace) {
  return Object.entries(trace).filter(
    ([key]) => key !== "requestId" && key !== "path" && key !== "demo",
  );
}

function ExtraValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span>—</span>;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <span>{String(value)}</span>;
  }
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}

export function Tracer({ trace: passed, revealed = true, emptyHint }: Props) {
  const { trace: ctxTrace } = useTracer();
  const trace = passed ?? ctxTrace ?? FALLBACK_TRACE;

  if (!revealed) {
    return <p className="lab-empty">{emptyHint ?? "Perform an activity to see the real request trace."}</p>;
  }

  const extras = extraTraceFields(trace);

  return (
    <aside className="tracer lab-tracer">
      <p className="kicker">Request tracer</p>
      <h2>{trace.demo ? "Demo / error" : "What AWS just did"}</h2>
      <p>
        {trace.demo
          ? "Waiting for a successful live request."
          : `Request ${trace.requestId}`}
      </p>
      <dl className="lab-trace-meta">
        <div>
          <dt>Request number</dt>
          <dd>{trace.requestId || "—"}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{trace.demo ? "Demo / fallback" : "Live AWS response"}</dd>
        </div>
        <div>
          <dt>Hops</dt>
          <dd>{trace.path.length}</dd>
        </div>
      </dl>
      {extras.map(([key, value]) => (
        <div className="lab-trace-extra" key={key}>
          <h3>{key}</h3>
          <ExtraValue value={value} />
        </div>
      ))}
      {trace.path.map((hop, i) => {
        const more = hopExtras(hop);
        return (
          <div className="hop" key={`${hop.service}-${i}`}>
            <div className="hop-dot" />
            <div>
              <h3>
                {i + 1}. {hop.service}
              </h3>
              <p>{hop.role}</p>
              {more.map(([key, value]) => (
                <p key={key}>
                  <strong>{key}:</strong>{" "}
                  {typeof value === "string" || typeof value === "number" || typeof value === "boolean"
                    ? String(value)
                    : JSON.stringify(value)}
                </p>
              ))}
            </div>
          </div>
        );
      })}
    </aside>
  );
}
