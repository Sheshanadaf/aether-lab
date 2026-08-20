import { useEffect, useState, type ChangeEvent } from "react";
import {
  FALLBACK_TRACE,
  getJob,
  getQuiz,
  getUpload,
  incrementVisits,
  putToS3,
  signUpload,
  submitJob,
  submitQuiz,
  type QuizQuestion,
} from "../lib/api";
import { signIn, signUp } from "../lib/cognito";
import { useTracer } from "../lib/tracer";

export function LabsPage() {
  const { setTrace } = useTracer();
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [idToken, setIdToken] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [score, setScore] = useState<string | null>(null);

  useEffect(() => {
    getQuiz()
      .then((data) => {
        setQuestions(data.questions);
        setTrace(data.trace);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "quiz load failed"));
  }, [setTrace]);

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

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const signed = await signUpload(file.type, file.size);
      setUploadId(signed.uploadId);
      setUploadStatus("uploading");
      setTrace(signed.trace);
      setError(null);
      await putToS3(signed.url, file);
      for (let i = 0; i < 10; i += 1) {
        await new Promise((r) => setTimeout(r, 1000));
        const latest = await getUpload(signed.uploadId);
        setUploadStatus(latest.status);
        setTrace(latest.trace);
        if (latest.status === "stored") return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
      setTrace(FALLBACK_TRACE);
    }
  }

  async function register() {
    try {
      await signUp(email, password);
      const token = await signIn(email, password);
      setIdToken(token);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "sign up failed");
    }
  }

  async function login() {
    try {
      const token = await signIn(email, password);
      setIdToken(token);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "sign in failed");
    }
  }

  async function sendQuiz() {
    if (!idToken) {
      setError("Sign in first, then submit.");
      return;
    }
    try {
      const data = await submitQuiz(picks, idToken);
      setScore(`${data.score} / ${data.outOf}`);
      setTrace(data.trace);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "submit failed");
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

      <h1>Upload pipeline</h1>
      <p>
        POST /uploads returns a 60-second S3 URL. The file goes to S3, not through Lambda. EventBridge
        then records metadata. No AWS keys in the browser.
      </p>
      <p>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} />
      </p>
      <p>
        Upload: {uploadId ?? "—"} — {uploadStatus ?? "—"}
      </p>

      <h1>Pillar quiz</h1>
      <p>
        GET /quiz is public. POST /quiz needs a Cognito IdToken. API Gateway rejects the call before
        Lambda if the JWT is missing. Password: 8+ chars, upper, lower, number.
      </p>
      <p>
        <input
          type="email"
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />{" "}
        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </p>
      <p>
        <button type="button" onClick={register}>
          Sign up
        </button>{" "}
        <button type="button" onClick={login}>
          Sign in
        </button>{" "}
        {idToken ? "signed in" : "not signed in"}
      </p>
      {questions.map((q) => (
        <p key={q.id}>
          {q.prompt}
          <br />
          {q.choices.map((choice, idx) => (
            <label key={choice} style={{ display: "block" }}>
              <input
                type="radio"
                name={q.id}
                checked={picks[q.id] === idx}
                onChange={() => setPicks({ ...picks, [q.id]: idx })}
              />{" "}
              {choice}
            </label>
          ))}
        </p>
      ))}
      <p>
        <button type="button" onClick={sendQuiz}>
          Submit quiz
        </button>{" "}
        Score: {score ?? "—"}
      </p>

      {error && <p>{error}</p>}
    </article>
  );
}