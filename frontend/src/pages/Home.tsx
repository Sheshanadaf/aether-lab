import { useEffect, useState } from "react";
import { FALLBACK_TRACE, incrementVisits } from "../lib/api";
import { useTracer } from "../lib/tracer";

export function HomePage() {
  const { setTrace } = useTracer();
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    incrementVisits()
      .then((data) => {
        setCount(data.count);
        setTrace(data.trace);
        setError(null);
      })
      .catch((e: Error) => {
        setError(e.message);
        setTrace(FALLBACK_TRACE);
      });
  }, [setTrace]);

  return (
    <article>
      <p className="kicker">Portfolio · Cloud · DevOps</p>
      <h1>Sheshan Hebron</h1>
      <p className="lede">
        BSc (Hons) Cloud Computing, Colombo. DevOps internship at 10QBIT
        (remote, UK). I teach AWS on YouTube as CloudNest.
      </p>
      <p>
        <strong>Live visitor count:</strong>{" "}
        {count === null && !error ? "calling Lambda…" : count}
      </p>
      {error && (
        <p>
          API error: {error}. Check <code>frontend/.env</code> and that you
          restarted <code>npm run dev</code>.
        </p>
      )}
      <ul>
        <li>AWS Certified Cloud Practitioner</li>
        <li>AWS Certified Solutions Architect – Associate</li>
      </ul>
      <p>
        <a href="https://www.youtube.com/@CloudNest1">YouTube</a>
        {" · "}
        <a href="https://www.linkedin.com/in/sheshan-hebron-04a557213/">LinkedIn</a>
        {" · "}
        <a href="https://github.com/Sheshanadaf">GitHub</a>
        {" · "}
        <a href="https://medium.com/@sheshanhebron61">Medium</a>
      </p>
    </article>
  );
}