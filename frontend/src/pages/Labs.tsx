import { useState } from "react";
import { FALLBACK_TRACE, incrementVisits } from "../lib/api";
import { useTracer } from "../lib/tracer";

export function LabsPage() {
  const { setTrace } = useTracer();
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function hit() {
    try {
      const data = await incrementVisits();
      setCount(data.count);
      setTrace(data.trace);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
      setTrace(FALLBACK_TRACE);
    }
  }

  return (
    <article>
      <p className="kicker">Live labs</p>
      <h1>Visitor counter</h1>
      <p>POST /visits → API Gateway → Lambda → DynamoDB.</p>
      <p>
        <button type="button" onClick={hit}>
          Increment
        </button>{" "}
        Count: {count ?? "—"}
      </p>
      {error && <p>{error}</p>}
      <p>Later: Message Relay, uploads, quiz, contact.</p>
    </article>
  );
}