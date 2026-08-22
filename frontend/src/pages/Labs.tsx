import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
  type Hop,
  type QuizQuestion,
  type Trace,
} from "../lib/api";
import { createAccount, friendlyAuthError, signIn } from "../lib/cognito";
import { LabArchitecture, PlaygroundMascot, StatusBadge, orderQuizHops } from "../components/LabArchitecture";
import { useTracer } from "../lib/tracer";
import "./labs.css";

type LabId = "visits" | "jobs" | "uploads" | "quiz";

type ArchView = {
  hops: Hop[];
  readHops?: Hop[];
  requestId: string;
  status: string;
  poison?: boolean;
  playing: boolean;
};

const QUIZ_GET_HOPS: Hop[] = [
  { service: "Amazon API Gateway", role: "GET /quiz — no JWT" },
  { service: "AWS Lambda", role: "return questions, hide answers" },
];

const LABS: { id: LabId; label: string; scenario: string }[] = [
  {
    id: "visits",
    label: "Visitor Counter",
    scenario:
      "Imagine you are building a website and want to count how many times users click a button. Every click should be recorded, and the website should return the latest click count to the user.",
  },
  {
    id: "jobs",
    label: "Message Relay",
    scenario:
      "A website should accept requests immediately and process them in the background. If a message fails because it contains bad data, the system should retry it a few times and then move it to a Dead-Letter Queue (DLQ). This keeps the bad message isolated and allows other jobs to continue processing normally.",
  },
  {
    id: "uploads",
    label: "Upload Pipeline",
    scenario:
      "A user should be able to upload a photo securely without storing AWS keys in the browser. The file should be uploaded directly to storage, and once the upload is complete, the system should detect it and save a record of the uploaded file.",
  },
  {
    id: "quiz",
    label: "Pillar Quiz",
    scenario:
      "Anyone can read the questions, but only a signed-in person should be allowed to submit answers. If the login token is missing, the API should reject the request before it reaches the quiz logic.",
  },
];

function DocIcon() {
  return (
    <svg className="lab-doc-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M7 3h7l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm7 1.5V9h4.5"
      />
      <path fill="currentColor" d="M8 13h8v1.4H8zm0 3.2h8V18H8z" opacity="0.75" />
    </svg>
  );
}

function CircleBtn({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="lab-circle-wrap">
      <button type="button" className="lab-circle-btn" onClick={onClick} disabled={disabled}>
        <span className="lab-circle-text">{label}</span>
      </button>
    </div>
  );
}

function CircleOut({ title, value }: { title: string; value: ReactNode }) {
  const ready = value !== null && value !== undefined && value !== "";
  return (
    <div className="lab-circle-wrap">
      <div className={`lab-circle-out${ready ? " is-ready" : ""}`}>
        <span className="lab-circle-kicker">{title}</span>
        {ready ? <span className="lab-circle-num">{value}</span> : <span className="lab-circle-empty">—</span>}
      </div>
    </div>
  );
}

function IoArrow({ down }: { down?: boolean }) {
  return (
    <span className={`lab-io-arrow${down ? " is-down" : ""}`} aria-hidden>
      {down ? (
        <svg viewBox="0 0 24 56" fill="none">
          <path d="M12 4 V42" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M5 36 L12 48 L19 36" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 72 24" fill="none">
          <path d="M4 12 H58" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M50 4 L64 12 L50 20" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

function ArchIcon() {
  return (
    <svg className="lab-doc-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M11 17h2v-6h-2zm1-8.2a1.1 1.1 0 1 1 0-2.2 1.1 1.1 0 0 1 0 2.2zM12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"
      />
    </svg>
  );
}

const ARCH_COPY: Record<LabId, { ok: string[]; poison?: string[] }> = {
  visits: {
    ok: [
      "When a visitor clicks the button on the website, the browser sends a POST /visits request to API Gateway. API Gateway acts as the public HTTPS entry point for the application, so the browser does not directly communicate with Lambda. API Gateway receives the request and securely forwards it to the Lambda function.",
      "The Lambda function runs on the ARM64 architecture and performs one simple task: increasing the visit count by one. The count is not stored inside Lambda because Lambda functions are temporary and can run in multiple instances. Instead, the count is stored permanently in DynamoDB, which makes the counter reliable even when many users click at the same time.",
      "DynamoDB stores the counter using a key such as SITE#aether / COUNTER. Lambda uses DynamoDB's ADD operation to increase the counter value. DynamoDB is a good choice for this use case because it can handle many requests to the same counter without requiring us to manage a database server. On-demand billing also means we pay based on actual usage instead of maintaining database capacity when there are no requests.",
      "This architecture supports Performance Efficiency because it uses managed, serverless services in ap-south-1 without maintaining an EC2 server fleet. It supports Cost Optimization because API Gateway, Lambda, and DynamoDB can operate based on actual usage. It also supports Sustainability by using the ARM64/Graviton architecture for Lambda, providing efficient compute for this lightweight workload.",
      "This architecture does not demonstrate the Reliability DLQ pattern because there is no asynchronous message-processing workflow here. The DLQ pattern is used in the Message Relay architecture (See the Message Relay tab), where failed messages need to be stored and processed again later."
    ],
  },
  jobs: {
    ok: [
      "When a user sends POST /jobs, the request goes to API Gateway and then to a Lambda function. This Lambda only sends the job to SQS and immediately returns a Job ID. It does not wait for the job to finish.",
      "A second Lambda function processes the messages from SQS. When the job is completed successfully, it saves JOB#{id} in DynamoDB with the status Done. When the user calls GET /jobs/{id}, the API checks DynamoDB and returns Pending until the job has been successfully processed.",
      "SQS decouples receiving a job from processing it. This means the application can accept requests immediately, while the worker processes them in the background. DynamoDB acts as the record of the completed job, while SQS handles the work waiting to be processed.",
      "This design improves Reliability because SQS can absorb traffic spikes and provides retries and a Dead-Letter Queue (DLQ) for failed messages. It also improves Performance Efficiency because users do not have to wait for the worker to finish before receiving a response.",
      "It also supports Cost Optimization because the Lambda functions run only when needed and can scale down when there is no work. SNS can send an email alert when the DLQ contains messages, helping the team quickly identify failed jobs."
    ],
    poison: [
      "The job starts with API Gateway → Lambda → SQS, where the request is placed into the queue with a Queued status. A worker then picks up the message and processes the job.",
      "If the worker receives a bad or invalid message (poison payload), it fails without writing anything to DynamoDB. This prevents incorrect or incomplete job records from being created.",
      "SQS automatically retries the failed message. With a 30-second visibility timeout and a maximum of 3 receive attempts, the message is moved to the Dead-Letter Queue (DLQ) after three failures. This keeps bad jobs isolated without blocking other valid jobs.",
      "When GET /jobs/{id} is called, the job remains Pending if no record was successfully written to DynamoDB. This accurately shows that the job was never completed rather than creating a fake Failed status.",
      "This provides a strong Reliability control: failed jobs are isolated, visible, and can be monitored using CloudWatch and SNS alerts when messages reach the DLQ.",
    ],
  },
  uploads: {
    ok: [
      "When a user sends POST /uploads, the request goes to Lambda, which generates a 60-second presigned S3 URL. The actual image file does not pass through API Gateway or Lambda. Instead, the browser uploads the file directly to the private S3 bucket.",
      "Once the file is uploaded, S3 sends an Object Created event to EventBridge. EventBridge then triggers a metadata Lambda, which creates the upload record in DynamoDB.",
      "The presigned URL improves Security because the browser never needs AWS access keys. The S3 bucket can also remain private while still allowing the user to upload the file.",
      "This design also improves Performance Efficiency because large files do not travel through API Gateway or Lambda. The browser communicates directly with S3, reducing unnecessary processing.",
      "For Cost Optimization, uploaded objects are automatically deleted after 7 days, preventing unnecessary storage costs.",
      "Unlike the job-processing flow, this upload path does not use SQS or a DLQ. It focuses mainly on Security, Performance Efficiency, and Cost Optimization.",
    ],
  },
  quiz: {
    ok: [
      "GET /quiz is intentionally public. API Gateway invokes Lambda, which returns the quiz questions without exposing the correct answers.",
      "POST /quiz is protected using Amazon Cognito. The browser sends a Cognito ID token, and API Gateway's JWT authorizer validates the token before allowing the request to reach Lambda. If the token is missing or invalid, the request is rejected before the scoring logic runs.",
      "After successful authentication, Lambda scores the answers and stores the user's result in DynamoDB using QUIZ#{sub}. Cognito acts as the identity store, so the browser does not need to contain AWS IAM credentials.",
      "This design mainly demonstrates Security through Cognito authentication and JWT authorization. The GET /quiz endpoint remains public intentionally because users need to access the questions before submitting their answers.",
      "This path does not use SQS or a Dead-Letter Queue (DLQ) because it is designed for authentication and quiz processing, not asynchronous job reliability."
    ],
  },
};

const PILLARS = [
  "Performance Efficiency",
  "Cost Optimization",
  "Sustainability",
  "Operational Excellence",
  "Reliability",
  "Security",
] as const;

function alignedPillars(paragraphs: string[]) {
  return PILLARS.filter((name) =>
    paragraphs.some((line) => {
      const at = line.indexOf(name);
      if (at < 0) return false;
      const around = line.slice(Math.max(0, at - 72), at + name.length + 28).toLowerCase();
      return !/does not|do not|is not|not demonstrate|not use the|not the sqs/.test(around);
    }),
  );
}

function pillarKey(name: string) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

function PillarGlyph({ name }: { name: string }) {
  if (name === "Performance Efficiency") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M5.2 16.2a8 8 0 1 1 13.6 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 14.2 L16.4 9.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="14.2" r="1.5" fill="currentColor" />
      </svg>
    );
  }
  if (name === "Cost Optimization") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M12 3.2 L19.4 7.4 V16.6 L12 20.8 L4.6 16.6 V7.4 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M12 8 V16 M9.4 10.1c0-1 1.1-1.6 2.6-1.6s2.6.6 2.6 1.7c0 1.4-1.8 1.7-2.6 2s-2.6.7-2.6 2.1c0 1.1 1.2 1.7 2.6 1.7s2.6-.6 2.6-1.7" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "Sustainability") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M6 18.4 C6.2 10.6 11 5 19.6 5.2 C19.2 13.8 13.8 19 6 18.4 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M8.2 16.2 C11.6 12.8 15.4 9 19.6 5.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "Reliability") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M4.8 13.2 H8.2 L10 8.4 L13.2 16.4 L15 11.8 H19.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "Security") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M12 3.4 L19 6.2 V11.6 C19 16 16.1 19.4 12 20.6 C7.9 19.4 5 16 5 11.6 V6.2 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8.2 V12.6 L14.6 14.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PillarCheck() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy="8" r="7" fill="#22c55e" />
      <path d="M4.85 8.15 L7.05 10.25 L11.2 5.75" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function highlightPillars(text: string, allowed: readonly string[]) {
  if (!allowed.length) return text;
  const mark = new RegExp(`(${allowed.join("|")})`, "g");
  return text.split(mark).map((part, i) =>
    allowed.includes(part) ? (
      <strong key={`${part}-${i}`} className={`lab-pillar is-${pillarKey(part)}`}>
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

function ArchExplain({ lab, poison }: { lab: LabId; poison?: boolean }) {
  const [open, setOpen] = useState(false);
  const copy = poison && ARCH_COPY[lab].poison ? ARCH_COPY[lab].poison : ARCH_COPY[lab].ok;
  const pillars = alignedPillars(copy);
  return (
    <div className="lab-explain">
      <div className="lab-explain-top">
        <button
          type="button"
          className="lab-explain-btn"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <ArchIcon />
          Explain the Architecture
        </button>
        {open && pillars.length ? (
          <aside className="lab-align" aria-label="AWS Well-Architected Alignment">
            <ul>
              {pillars.map((name) => (
                <li key={name} className={`is-${pillarKey(name)}`}>
                  <span className="lab-align-icon">
                    <PillarGlyph name={name} />
                  </span>
                  <span className="lab-align-name">{name}</span>
                  <span className="lab-align-check">
                    <PillarCheck />
                  </span>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
      <div className={`lab-explain-body${open ? " is-open" : ""}`}>
        <div className="lab-explain-copy">
          {copy.map((line) => (
            <p key={line}>{highlightPillars(line, pillars)}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LabsPage() {
  const { setTrace } = useTracer();
  const [active, setActive] = useState<LabId | null>(null);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [arch, setArch] = useState<Partial<Record<LabId, ArchView>>>({});
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobMessage, setJobMessage] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const jobGen = useRef(0);
  const uploadGen = useRef(0);
  const travelDone = useRef(false);
  const pendingTerminal = useRef<string | null>(null);
  const travelLab = useRef<LabId | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [idToken, setIdToken] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"in" | "up">("in");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const emailField = useRef<HTMLInputElement>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [score, setScore] = useState<string | null>(null);

  const lab = LABS.find((item) => item.id === active);
  const view = active ? arch[active] : undefined;

  useEffect(() => {
    if (active !== "quiz" || questions.length) return;
    getQuiz()
      .then((data) => {
        setQuestions(data.questions);
        const read = data.trace?.path?.length ? data.trace.path : QUIZ_GET_HOPS;
        beginTravel("quiz");
        keepTrace(data.trace ?? { requestId: "quiz-get", path: read });
        writeArch("quiz", {
          hops: read,
          readHops: read,
          requestId: data.trace?.requestId ?? "quiz-get",
          status: "sending",
          playing: true,
        });
        settleStatus("quiz", "200 OK");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "quiz load failed"));
  }, [active, questions.length]);

  useEffect(() => {
    if (!authOpen) return;
    const id = window.setTimeout(() => emailField.current?.focus(), 20);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAuthOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [authOpen]);

  function keepTrace(trace: Trace) {
    setTrace(trace);
  }

  function writeArch(id: LabId, next: Partial<ArchView>, lockPath = false) {
    setArch((current) => {
      const prev = current[id];
      const hops = lockPath && prev?.hops.length ? prev.hops : next.hops ?? prev?.hops ?? [];
      return {
        ...current,
        [id]: {
          hops,
          readHops: next.readHops ?? prev?.readHops,
          requestId: next.requestId ?? prev?.requestId ?? "",
          status: next.status ?? prev?.status ?? "",
          poison: next.poison ?? prev?.poison,
          playing: next.playing ?? prev?.playing ?? false,
        },
      };
    });
  }

  function settleStatus(id: LabId, status: string) {
    if (travelDone.current) {
      writeArch(id, { status, playing: false }, true);
      pendingTerminal.current = null;
      return;
    }
    pendingTerminal.current = status;
  }

  function onTravelEnd() {
    travelDone.current = true;
    if (!pendingTerminal.current || !travelLab.current) return;
    writeArch(travelLab.current, { status: pendingTerminal.current, playing: false }, true);
    pendingTerminal.current = null;
  }

  function beginTravel(id: LabId) {
    travelDone.current = false;
    pendingTerminal.current = null;
    travelLab.current = id;
  }

  function switchLab(id: LabId) {
    setActive(id);
    setScenarioOpen(false);
    setError(null);
    setAuthOpen(false);
    setAuthError(null);
  }

  async function hit() {
    setBusy(true);
    beginTravel("visits");
    try {
      const data = await incrementVisits();
      setCount(data.count);
      keepTrace(data.trace);
      writeArch("visits", {
        hops: data.trace.path,
        requestId: data.trace.requestId,
        status: "sending",
        playing: true,
      });
      settleStatus("visits", "200 OK");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
      keepTrace(FALLBACK_TRACE);
      writeArch("visits", {
        hops: FALLBACK_TRACE.path,
        requestId: FALLBACK_TRACE.requestId,
        status: "error",
        playing: false,
      });
    } finally {
      setBusy(false);
    }
  }

  async function send(poison: boolean) {
    const gen = ++jobGen.current;
    setBusy(true);
    beginTravel("jobs");
    try {
      const queued = await submitJob(poison ? { poison: true } : { message: "hello from the lab" });
      if (gen !== jobGen.current) return;
      setJobId(queued.jobId);
      setJobStatus(queued.status);
      setJobMessage(null);
      keepTrace(queued.trace);
      writeArch("jobs", {
        hops: queued.trace.path,
        requestId: queued.trace.requestId,
        status: queued.status,
        poison,
        playing: true,
      });
      if (poison) pendingTerminal.current = "pending";
      setError(null);
      setBusy(false);
      const rounds = poison ? 3 : 10;
      for (let i = 0; i < rounds; i += 1) {
        await new Promise((r) => setTimeout(r, 1000));
        if (gen !== jobGen.current) return;
        const latest = await getJob(queued.jobId);
        if (gen !== jobGen.current) return;
        setJobStatus(latest.status);
        if (latest.message) setJobMessage(latest.message);
        keepTrace(latest.trace);
        if (latest.status === "done") {
          settleStatus("jobs", "done");
          return;
        }
        if (!poison) writeArch("jobs", { status: latest.status, poison }, true);
      }
    } catch (e) {
      if (gen !== jobGen.current) return;
      setError(e instanceof Error ? e.message : "failed");
      keepTrace(FALLBACK_TRACE);
      writeArch("jobs", {
        hops: FALLBACK_TRACE.path,
        requestId: FALLBACK_TRACE.requestId,
        status: "error",
        poison,
        playing: false,
      });
    } finally {
      if (gen === jobGen.current) setBusy(false);
    }
  }

  async function startUpload(file: File) {
    const gen = ++uploadGen.current;
    if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    setUploadPreview(URL.createObjectURL(file));
    setBusy(true);
    beginTravel("uploads");
    try {
      const signed = await signUpload(file.type, file.size);
      if (gen !== uploadGen.current) return;
      setUploadId(signed.uploadId);
      setUploadStatus("uploading");
      keepTrace(signed.trace);
      writeArch("uploads", {
        hops: signed.trace.path,
        requestId: signed.trace.requestId,
        status: "uploading",
        playing: true,
      });
      setError(null);
      await putToS3(signed.url, file);
      for (let i = 0; i < 10; i += 1) {
        await new Promise((r) => setTimeout(r, 1000));
        if (gen !== uploadGen.current) return;
        const latest = await getUpload(signed.uploadId);
        setUploadStatus(latest.status);
        keepTrace(latest.trace);
        if (latest.status === "stored") {
          settleStatus("uploads", "stored");
          return;
        }
        writeArch("uploads", { status: latest.status }, true);
      }
    } catch (err) {
      if (gen !== uploadGen.current) return;
      setError(err instanceof Error ? err.message : "failed");
      keepTrace(FALLBACK_TRACE);
      writeArch("uploads", {
        hops: FALLBACK_TRACE.path,
        requestId: FALLBACK_TRACE.requestId,
        status: "error",
        playing: false,
      });
    } finally {
      if (gen === uploadGen.current) setBusy(false);
    }
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void startUpload(file);
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void startUpload(file);
  }

  function openAuth() {
    setAuthMode("in");
    setAuthError(null);
    setAuthBusy(false);
    setError("Please sign in first.");
    window.setTimeout(() => setAuthOpen(true), 0);
  }

  function authFieldsOk() {
    const mail = email.trim();
    if (!mail || !mail.includes("@")) {
      setAuthError("Enter a valid email address.");
      return false;
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setAuthError("Password needs 8+ characters, with uppercase, lowercase, and a number.");
      return false;
    }
    return true;
  }

  async function submitAuth() {
    if (authBusy) return;
    if (!authFieldsOk()) return;
    setAuthBusy(true);
    setAuthError(null);
    try {
      const token = authMode === "up" ? await createAccount(email, password) : await signIn(email, password);
      setIdToken(token);
      setError(null);
      setAuthOpen(false);
    } catch (e) {
      setAuthError(friendlyAuthError(e, authMode === "up" ? "Could not create the account." : "Could not sign in."));
    } finally {
      setAuthBusy(false);
    }
  }

  async function sendQuiz() {
    if (!idToken) {
      openAuth();
      return;
    }
    setBusy(true);
    beginTravel("quiz");
    try {
      const data = await submitQuiz(picks, idToken);
      const hops = orderQuizHops(data.trace.path);
      setScore(`${data.score} / ${data.outOf}`);
      keepTrace({ ...data.trace, path: hops });
      writeArch("quiz", {
        hops,
        readHops: arch.quiz?.readHops ?? QUIZ_GET_HOPS,
        requestId: data.trace.requestId,
        status: "sending",
        playing: true,
      });
      settleStatus("quiz", "200 OK");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "submit failed");
      keepTrace(FALLBACK_TRACE);
      writeArch("quiz", {
        hops: FALLBACK_TRACE.path,
        requestId: FALLBACK_TRACE.requestId,
        status: e instanceof Error && e.message.startsWith("401") ? "401" : "error",
        playing: false,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="labs">
      <header className="labs-hero">
        <h1>
          Press a Button. Wake Up <span className="lab-aws">AWS</span>
        </h1>
        <p>Perform simple cloud actions, watch your request travel through your layered services in real time.</p>
      </header>

      <div className="lab-switch" role="tablist" aria-label="Cloud Playground labs">
        {LABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active === item.id}
            className={active === item.id ? "is-on" : ""}
            onClick={() => switchLab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {!lab ? <PlaygroundMascot /> : null}

      {lab ? (
        <section className="lab-stage" key={lab.id}>
          <div className="lab-head">
            <button
              type="button"
              className="lab-scenario-btn"
              aria-expanded={scenarioOpen}
              onClick={() => setScenarioOpen((open) => !open)}
            >
              <DocIcon />
              {scenarioOpen ? "Hide Scenario" : "Read Scenario"}
            </button>
            <div className={`lab-scenario${scenarioOpen ? " is-open" : ""}`}>
              <div className="lab-scenario-inner">
                <p className="kicker">Scenario</p>
                <p>{lab.scenario}</p>
              </div>
            </div>
          </div>

          {active === "visits" ? (
            <div className="lab-io lab-io-circles">
              <div className="lab-io-col">
                <CircleBtn label="Increment Visitor Count" onClick={hit} disabled={busy} />
                <p className="lab-io-tag">Input</p>
              </div>
              <IoArrow />
              <div className="lab-io-col">
                <CircleOut title="Visitor Count" value={count} />
                <p className="lab-io-tag">Output</p>
              </div>
            </div>
          ) : null}

          {active === "jobs" ? (
            <div className="lab-io">
              <div className="lab-io-inputs">
                <div className="lab-io-col">
                  <CircleBtn label="Send Job" onClick={() => send(false)} disabled={busy} />
                  <p className="lab-io-tag">Input</p>
                </div>
                <div className="lab-io-col">
                  <CircleBtn label="Send Poison Message" onClick={() => send(true)} disabled={busy} />
                  <p className="lab-io-tag">Input</p>
                </div>
              </div>
              <IoArrow />
              <div className="lab-out-box">
                <p className="lab-io-tag">Output</p>
                {jobId ? (
                  <dl className="lab-out-meta">
                    <div>
                      <dt>Job ID</dt>
                      <dd>{jobId}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{jobStatus ? <StatusBadge value={jobStatus} poison={view?.poison} /> : "—"}</dd>
                    </div>
                    {view?.requestId ? (
                      <div>
                        <dt>Request ID</dt>
                        <dd>{view.requestId}</dd>
                      </div>
                    ) : null}
                    {jobMessage ? (
                      <div>
                        <dt>Message</dt>
                        <dd>{jobMessage}</dd>
                      </div>
                    ) : null}
                  </dl>
                ) : (
                  <p className="lab-out-wait">Waiting for a response</p>
                )}
                {view?.poison && jobStatus && jobStatus !== "done" ? (
                  <p className="lab-note">
                    Poison never writes a DynamoDB job row, so GET /jobs stays pending. The worker only throws.
                    SQS retries three times (30s visibility timeout), then SQS — not Lambda — redrives the
                    message to aether-lab-jobs-dlq.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {active === "uploads" ? (
            <div className="lab-io">
              <div className="lab-io-col">
                <label
                  className={`lab-drop${dragOver ? " is-over" : ""}${busy ? " is-busy" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                >
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} disabled={busy} />
                  {uploadPreview ? (
                    <img className="lab-drop-preview" src={uploadPreview} alt="Selected upload" />
                  ) : (
                    <>
                      <span className="lab-drop-plus" aria-hidden>
                        +
                      </span>
                      <strong>Select Image</strong>
                      <span>Drop an image here · PNG, JPG, WebP</span>
                    </>
                  )}
                </label>
                <p className="lab-io-tag">Input</p>
              </div>
              <IoArrow />
              <div className="lab-out-box">
                <p className="lab-io-tag">Output</p>
                {uploadId ? (
                  <dl className="lab-out-meta">
                    <div>
                      <dt>Upload ID</dt>
                      <dd>{uploadId}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{uploadStatus ? <StatusBadge value={uploadStatus} /> : "—"}</dd>
                    </div>
                    {view?.requestId ? (
                      <div>
                        <dt>Request ID</dt>
                        <dd>{view.requestId}</dd>
                      </div>
                    ) : null}
                  </dl>
                ) : (
                  <p className="lab-out-wait">Waiting for a response</p>
                )}
              </div>
            </div>
          ) : null}

          {active === "quiz" ? (
            <div className="lab-quiz">
              {questions.map((q) => (
                <fieldset className="lab-q" key={q.id}>
                  <legend>{q.prompt}</legend>
                  {q.choices.map((choice, idx) => (
                    <label key={choice}>
                      <input
                        type="radio"
                        name={q.id}
                        checked={picks[q.id] === idx}
                        onChange={() => setPicks({ ...picks, [q.id]: idx })}
                      />
                      {choice}
                    </label>
                  ))}
                </fieldset>
              ))}
              {idToken ? (
                <p className="lab-auth-ready">You are signed in. Press Submit Quiz to send your answers.</p>
              ) : null}
              <div className="lab-quiz-submit">
                <div className="lab-io-col">
                  <button type="button" className="lab-action" onClick={sendQuiz} disabled={busy}>
                    Submit Quiz
                  </button>
                  <p className="lab-io-tag">Input</p>
                </div>
                <IoArrow />
                <div className="lab-io-col">
                  <CircleOut title="Score" value={score} />
                  <p className="lab-io-tag">Output</p>
                </div>
              </div>
              {authOpen
                ? createPortal(
                    <div className="lab-modal" role="dialog" aria-modal="true" aria-labelledby="lab-auth-title">
                      <div
                        className="lab-modal-backdrop"
                        onPointerDown={(e) => {
                          if (e.target === e.currentTarget) setAuthOpen(false);
                        }}
                      />
                      <form
                        className="lab-auth-card lab-auth-popup"
                        noValidate
                        onSubmit={(e) => {
                          e.preventDefault();
                          void submitAuth();
                        }}
                      >
                        <button type="button" className="lab-modal-close" onClick={() => setAuthOpen(false)} aria-label="Close">
                          ×
                        </button>
                        <h3 id="lab-auth-title">{authMode === "up" ? "Create an account" : "Sign in"}</h3>
                        <p className="lab-auth-lead">
                          {authMode === "up"
                            ? "Create an account to submit your score. You will stay signed in on this page."
                            : "Sign in to submit your score. New here? Switch to Create account."}
                        </p>
                        <div className="lab-auth-tabs" role="tablist" aria-label="Authentication">
                          <button
                            type="button"
                            role="tab"
                            aria-selected={authMode === "in"}
                            className={authMode === "in" ? "is-on" : ""}
                            onClick={() => {
                              setAuthMode("in");
                              setAuthError(null);
                            }}
                          >
                            Sign in
                          </button>
                          <button
                            type="button"
                            role="tab"
                            aria-selected={authMode === "up"}
                            className={authMode === "up" ? "is-on" : ""}
                            onClick={() => {
                              setAuthMode("up");
                              setAuthError(null);
                            }}
                          >
                            Create account
                          </button>
                        </div>
                        <label className="lab-auth-field">
                          Email
                          <input
                            ref={emailField}
                            type="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              setAuthError(null);
                            }}
                          />
                        </label>
                        <label className="lab-auth-field">
                          Password
                          <input
                            type="password"
                            autoComplete={authMode === "up" ? "new-password" : "current-password"}
                            placeholder="At least 8 characters"
                            value={password}
                            onChange={(e) => {
                              setPassword(e.target.value);
                              setAuthError(null);
                            }}
                          />
                        </label>
                        {authMode === "up" ? (
                          <p className="lab-auth-hint">Use 8+ characters, with uppercase, lowercase, and a number.</p>
                        ) : null}
                        {authError ? <p className="lab-error">{authError}</p> : null}
                        <button type="submit" className="lab-auth-primary" disabled={authBusy}>
                          {authBusy
                            ? authMode === "up"
                              ? "Creating account…"
                              : "Signing in…"
                            : authMode === "up"
                              ? "Create account"
                              : "Sign in"}
                        </button>
                      </form>
                    </div>,
                    document.body,
                  )
                : null}
            </div>
          ) : null}

            {error ? <p className="lab-error">{error}</p> : null}

          <div className="lab-panel">
            {view?.hops.length ? (
              <div className="lab-reveal">
                <LabArchitecture
                  hops={view.hops}
                  readHops={view.readHops}
                  requestId={view.requestId}
                  status={view.status}
                  playing={view.playing}
                  poison={view.poison}
                  onTravelEnd={onTravelEnd}
                  onStatus={(next) => writeArch(lab.id, { status: next }, true)}
                />
                <ArchExplain lab={lab.id} poison={view.poison} />
              </div>
            ) : (
              <>
                <h3>AWS Architecture</h3>
                <p className="lab-empty">Run the activity to see the request come alive.</p>
              </>
            )}
          </div>
        </section>
      ) : null}
    </article>
  );
}
