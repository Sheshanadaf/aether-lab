import { useState } from "react";
import { FALLBACK_TRACE, getJob, incrementVisits, submitJob } from "../lib/api";
import { useTracer } from "../lib/tracer";

export function LabsPage() {
  const { setTrace } = useTracer();
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);

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

  async function send(poison: boolean) {
    try {
      const queued = await submitJob(poison ? { poison: true } : { message: "hello from the lab" });
      setJobId(queued.jobId);
      setJobStatus(queued.status);
      setTrace(queued.trace);
      setError(null);
      for (let i = 0; i < 8; i += 1) {
        await new Promise((r) => setTimeout(r, 1000));
        const latest = await getJob(queued.jobId);
        setJobStatus(latest.status);
        setTrace(latest.trace);
        if (latest.status === "done") return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
      setTrace(FALLBACK_TRACE);
    }
  }

  return (
    <article>
      <p className="kicker">Live labs</p>
      <h1>Visitor counter</h1>
      <p>POST /visits → API Gateway → Lambda → DynamoDB. Synchronous.</p>
      <p>
        <button type="button" onClick={hit}>
          Increment
        </button>{" "}
        Count: {count ?? "—"}
      </p>

      <h1>Message Relay</h1>
      <p>
        POST /jobs drops a letter on SQS and returns. A worker Lambda writes DynamoDB. A poison
        message fails three times, then the DLQ. Reliability pillar.
      </p>
      <p>
        <button type="button" onClick={() => send(false)}>
          Send job
        </button>{" "}
        <button type="button" onClick={() => send(true)}>
          Send poison
        </button>
      </p>
      <p>
        Job: {jobId ?? "—"} — {jobStatus ?? "—"}
      </p>
      {jobStatus === "pending" && (
        <p>If this was poison, it will stay pending. Check SQS queue aether-lab-jobs-dlq.</p>
      )}
      {error && <p>{error}</p>}
    </article>
  );
}