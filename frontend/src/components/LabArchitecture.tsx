import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Hop } from "../lib/api";

function isDlq(hop: Hop) {
  return /dlq/i.test(hop.service) || /dlq/i.test(hop.role);
}

function isQueue(hop: Hop) {
  return /sqs/i.test(hop.service) && !isDlq(hop);
}

function statusLabel(value: string) {
  return value.toLowerCase() === "stored" ? "uploaded" : value;
}

function statusTone(value: string, poison = false) {
  const name = statusLabel(value).toLowerCase();
  if (name.includes("error") || name === "401" || name.includes("fail")) return "fail";
  if (poison && (name.includes("pending") || name.includes("try"))) return "fail";
  if (name.includes("done") || name.includes("stored") || name === "uploaded" || name.includes("200") || name.includes("ok")) {
    return "ok";
  }
  if (name.includes("queued")) return "wait";
  if (name.includes("pending")) return "wait";
  if (name.includes("sending") || name === "uploading" || name.includes("process")) return "run";
  return "plain";
}

export function StatusBadge({ value, poison }: { value: string; poison?: boolean }) {
  if (!value) return <span>—</span>;
  const shown = statusLabel(value);
  return (
    <span className={`lab-status is-${statusTone(value, poison)}`} key={`${shown}:${poison ? "p" : "ok"}`}>
      {shown}
    </span>
  );
}

export function iconFor(service: string) {
  const name = service.toLowerCase();
  if (name.includes("browser")) return "/skills/browser.svg";
  if (name.includes("route 53") || name.includes("route53")) return "/skills/route53.svg";
  if (name.includes("cloudfront")) return "/skills/cloudfront.svg";
  if (name.includes("cognito")) return "/skills/cognito.svg";
  if (name.includes("eventbridge")) return "/skills/eventbridge.svg";
  if (name.includes("dlq") || name.includes("sqs")) return "/skills/sqs.svg";
  if (name.includes("gateway") || name.includes("api")) return "/skills/apigateway.svg";
  if (name.includes("lambda")) return "/skills/lambda.svg";
  if (name.includes("dynamo")) return "/skills/dynamodb.svg";
  if (name.includes("s3") || name.includes("bucket")) return "/skills/s3.svg";
  if (name.includes("github")) return "/skills/github.svg";
  return "/skills/aws.svg";
}

/**
 * Request path from the live API trace.
 * CloudFront serves the static site only. Lab calls go to API Gateway.
 * Route 53 is not in this stack. Browser is only a node on the upload PUT.
 */
export function displayHops(path: Hop[], poison = false): Hop[] {
  const api = path.filter((hop) => {
    const name = hop.service.toLowerCase();
    return !name.includes("route 53") && !name.includes("route53") && !name.includes("cloudfront") && !name.includes("browser");
  });
  if (!api.length) return [];
  const hops = orderQuizHops(api);
  if (poison) return poisonHops(hops);
  return uploadHops(hops.filter((hop) => !isDlq(hop)));
}

function hopName(hop: Hop) {
  return hop.service.toLowerCase();
}

/** Presign round-trip, then browser PUT to S3 → EventBridge → Lambda → DynamoDB. */
function uploadHops(path: Hop[]): Hop[] {
  const gw = path.find((hop) => hopName(hop).includes("api gateway") || hopName(hop).includes("gateway"));
  const lambdas = path.filter((hop) => hopName(hop).includes("lambda"));
  const s3 = path.find((hop) => hopName(hop).includes("s3"));
  const bus = path.find((hop) => hopName(hop).includes("eventbridge"));
  const ddb = path.find((hop) => hopName(hop).includes("dynamo"));
  if (!gw || !s3 || !bus || !ddb || !lambdas[0]) return path;
  return [
    gw,
    { ...lambdas[0], role: "presign PutObject — file not here" },
    { service: "Browser", role: "PUT file with the 60s URL" },
    { ...s3, role: "private inbox | browser PUT" },
    { ...bus, role: "Object Created" },
    { ...(lambdas[1] ?? { service: "AWS Lambda", role: "read metadata" }), role: "read metadata" },
    { ...ddb, role: "upload row" },
  ];
}

/** One jobs queue. Worker throws; SQS redrives to the DLQ after 3 receives. */
function poisonHops(path: Hop[]): Hop[] {
  const hops = path.filter((hop) => !/dynamo/i.test(hop.service));
  const gw = hops.find((hop) => /api gateway|gateway/i.test(hop.service));
  const lambdas = hops.filter((hop) => /lambda/i.test(hop.service));
  const enqueue = lambdas[0];
  const worker = lambdas[1];
  const queue = hops.find(isQueue);
  const dlq = hops.find(isDlq) ?? { service: "Amazon SQS DLQ", role: "SQS redrive after 3 failed receives" };
  if (!gw || !enqueue || !queue || !worker) {
    return hops.filter((hop) => !isDlq(hop) || hop === dlq);
  }
  return [
    gw,
    enqueue,
    { ...queue, role: "jobs queue" },
    { ...worker, role: "worker throws | message stays in SQS" },
    { ...dlq, role: "SQS redrive after 3 failed receives" },
  ];
}

/** POST /quiz: Cognito JWT is checked at API Gateway, before Lambda and DynamoDB. */
export function orderQuizHops(path: Hop[]): Hop[] {
  const name = (hop: Hop) => hop.service.toLowerCase();
  const cognito = path.filter((hop) => name(hop).includes("cognito"));
  if (!cognito.length) return path;
  const rest = path.filter((hop) => !name(hop).includes("cognito"));
  const gw = rest.findIndex((hop) => name(hop).includes("api gateway"));
  const placed = cognito.map((hop) => ({
    ...hop,
    role: "JWT issuer — checked before Lambda runs",
  }));
  if (gw < 0) return [...placed, ...rest];
  return [...rest.slice(0, gw + 1), ...placed, ...rest.slice(gw + 1)];
}

function asyncLabel(from: Hop, to: Hop) {
  if (isDlq(to)) return "SQS redrive";
  if (isQueue(from)) return "Async";
  if (/s3/i.test(from.service) && /eventbridge/i.test(to.service)) return "Event";
  if (/eventbridge/i.test(from.service)) return "Async";
  return "";
}

const SLOT = 176;
const STEP_MS = 160;

function usePerRow(count: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [perRow, setPerRow] = useState(4);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      setPerRow(Math.max(1, Math.floor(width / SLOT)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [count]);

  return { ref, perRow };
}

const POISON_STEPS = 9;
const POISON_MS = 140;

function poisonStatus(step: number) {
  if (step < 2) return "queued";
  if (step < 4) return "1st try";
  if (step < 6) return "2nd try";
  if (step < 8) return "3rd try";
  return "pending";
}

function poisonSqsRole(step: number) {
  if (step < 2) return "jobs queue";
  if (step < 4) return "1st time trying…";
  if (step < 6) return "2nd time trying…";
  return "3rd time trying…";
}

function usePoisonTravel(
  playKey: string,
  enabled: boolean,
  onStatus?: (status: string) => void,
  onTravelEnd?: () => void,
) {
  const [step, setStep] = useState(-1);
  const end = useRef(onTravelEnd);
  const status = useRef(onStatus);
  end.current = onTravelEnd;
  status.current = onStatus;

  useEffect(() => {
    if (!enabled || !playKey) {
      setStep(-1);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setStep(POISON_STEPS - 1);
      status.current?.("pending");
      end.current?.();
      return;
    }
    setStep(0);
    status.current?.("queued");
    const timers = Array.from({ length: POISON_STEPS }, (_, i) =>
      window.setTimeout(() => {
        setStep(i);
        status.current?.(poisonStatus(i));
        if (i === POISON_STEPS - 1) end.current?.();
      }, i * POISON_MS),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [playKey, enabled]);

  return step;
}

const UPLOAD_STEPS = 6;
const UPLOAD_MS = 170;

function useUploadTravel(playKey: string, enabled: boolean, onTravelEnd?: () => void) {
  const [step, setStep] = useState(-1);
  const end = useRef(onTravelEnd);
  end.current = onTravelEnd;

  useEffect(() => {
    if (!enabled || !playKey) {
      setStep(-1);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setStep(UPLOAD_STEPS - 1);
      end.current?.();
      return;
    }
    setStep(0);
    const timers = Array.from({ length: UPLOAD_STEPS }, (_, i) =>
      window.setTimeout(() => {
        setStep(i);
        if (i === UPLOAD_STEPS - 1) end.current?.();
      }, i * UPLOAD_MS),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [playKey, enabled]);

  return step;
}

function useTravel(playKey: string, edges: number, onTravelEnd?: () => void) {
  const [at, setAt] = useState(-1);
  const end = useRef(onTravelEnd);
  end.current = onTravelEnd;

  useEffect(() => {
    if (!playKey || edges < 1) {
      setAt(-1);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setAt(edges - 1);
      end.current?.();
      return;
    }
    setAt(0);
    const timers = Array.from({ length: edges }, (_, i) =>
      window.setTimeout(() => {
        setAt(i);
        if (i === edges - 1) end.current?.();
      }, i * STEP_MS),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [playKey, edges]);

  return at;
}

function Svc({ hop, fail }: { hop: Hop; fail?: boolean }) {
  return (
    <div className={`lab-svc${fail ? " is-fail" : ""}`}>
      <img src={iconFor(hop.service)} alt="" />
      <strong>{hop.service}</strong>
      <span>{hop.role}</span>
    </div>
  );
}

function FlowArrow({
  down,
  back,
  live,
  fail,
  label,
}: {
  down?: boolean;
  back?: boolean;
  live: boolean;
  fail?: boolean;
  label?: string;
}) {
  return (
    <span
      className={`lab-arrow${down ? " is-down" : ""}${back ? " is-back" : ""}${live ? " is-now" : ""}${fail ? " is-fail" : ""}`}
      aria-hidden
    >
      {label ? <em className="lab-async">{label}</em> : null}
      {down ? (
        <svg viewBox="0 0 16 52" fill="none">
          <path d="M8 4 V40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M3 36 L8 46 L13 36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : back ? (
        <svg viewBox="0 0 60 16" fill="none">
          <path d="M58 8 H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M18 3 L8 8 L18 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 60 16" fill="none">
          <path d="M2 8 H48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M42 3 L52 8 L42 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {live ? <i className="lab-packet" /> : null}
    </span>
  );
}

function isGetQuizPath(path: Hop[]) {
  return (
    path.length >= 2 &&
    /gateway/i.test(path[0].service) &&
    /lambda/i.test(path[1].service) &&
    !path.some((hop) => /cognito|dynamo|s3|sqs|eventbridge/i.test(hop.service))
  );
}

function PathRow({
  hops,
  travel,
}: {
  hops: Hop[];
  travel: number;
}) {
  return (
    <div className="lab-flow-row">
      {hops.map((hop, index) => (
        <Fragment key={`q-${hop.service}-${index}`}>
          {index > 0 ? (
            <FlowArrow live={travel === index - 1} label={asyncLabel(hops[index - 1], hop)} />
          ) : null}
          <Svc hop={hop} />
        </Fragment>
      ))}
    </div>
  );
}

export function LabArchitecture({
  hops,
  readHops,
  requestId,
  status,
  poison = false,
  onTravelEnd,
  onStatus,
}: {
  hops: Hop[];
  readHops?: Hop[];
  requestId: string;
  status: string;
  playing?: boolean;
  poison?: boolean;
  onTravelEnd?: () => void;
  onStatus?: (status: string) => void;
}) {
  const shown = displayHops(hops, poison);
  const getShown = displayHops(readHops ?? [], poison);
  const queueAt = shown.findIndex(isQueue);
  const workerAt = shown.findIndex((hop, i) => i > queueAt && /lambda/i.test(hop.service));
  const dlqAt = shown.findIndex(isDlq);
  const poisonLayout = Boolean(poison && queueAt > 0 && workerAt === queueAt + 1 && dlqAt === workerAt + 1);
  const quizGet = getShown.length ? getShown : isGetQuizPath(shown) ? shown : [];
  const quizPost = shown.some((hop) => /cognito/i.test(hop.service)) ? shown : [];
  const quizLayout = Boolean(!poison && (quizGet.length >= 2 || quizPost.length >= 3));
  const quizGetOnly = quizLayout && !quizPost.length;
  const uploadLayout = Boolean(
    !poison &&
      !quizLayout &&
      shown.some((hop) => /browser/i.test(hop.service)) &&
      shown.some((hop) => /s3/i.test(hop.service)) &&
      shown.some((hop) => /eventbridge/i.test(hop.service)),
  );
  const special = poisonLayout || quizLayout || uploadLayout;
  const main = poisonLayout ? shown.slice(0, dlqAt) : shown;
  const { ref, perRow } = usePerRow(special ? main.length : shown.length);
  const first = (special ? main : shown).slice(0, perRow);
  const rest = special ? [] : shown.slice(perRow);
  const edges = Math.max(0, shown.length - 1);
  const playKey = `${requestId}:${poison ? "p" : "ok"}:${shown.map((h) => h.service).join(">")}`;
  const travel = useTravel(special ? "" : playKey, special ? 0 : edges, onTravelEnd);
  const poisonStep = usePoisonTravel(playKey, poisonLayout, onStatus, onTravelEnd);
  const uploadStep = useUploadTravel(playKey, uploadLayout, onTravelEnd);
  const getTravel = useTravel(
    quizGetOnly ? playKey : "",
    quizGetOnly ? Math.max(0, quizGet.length - 1) : 0,
    onTravelEnd,
  );
  const postTravel = useTravel(
    !quizGetOnly && quizPost.length ? playKey : "",
    !quizGetOnly && quizPost.length ? Math.max(0, quizPost.length - 1) : 0,
    onTravelEnd,
  );

  function edgeLive(index: number) {
    return travel === index;
  }

  function edgeFail(index: number) {
    if (!poison) return false;
    return queueAt >= 0 && index >= queueAt;
  }

  function edgeLabel(index: number) {
    const from = shown[index];
    const to = shown[index + 1];
    return from && to ? asyncLabel(from, to) : "";
  }

  const toWorker = poisonStep === 2 || poisonStep === 4 || poisonStep === 6;
  const backToSqs = poisonStep === 3 || poisonStep === 5 || poisonStep === 7;
  const toDlq = poisonStep === 8;
  const tryN = poisonStep < 2 ? 0 : poisonStep < 4 ? 1 : poisonStep < 6 ? 2 : 3;

  return (
    <div className="lab-arch">
      <header className="lab-arch-head">
        <h3>AWS Architecture</h3>
        <dl className="lab-arch-meta">
          <div>
            <dt>Request</dt>
            <dd title={requestId}>{requestId || "—"}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <StatusBadge value={status} poison={poison} />
            </dd>
          </div>
        </dl>
      </header>
      <div className="lab-arch-body" ref={ref}>
        {!shown.length ? (
          <p className="lab-empty">Run the activity to see the request come alive.</p>
        ) : quizLayout ? (
          <div className="lab-flow is-quiz">
            {quizGet.length >= 2 ? (
              <div className="lab-quiz-path">
                <p className="lab-path-label">GET /quiz · public — read questions</p>
                <PathRow hops={quizGet} travel={quizGetOnly ? getTravel : -1} />
              </div>
            ) : null}
            {quizPost.length >= 3 ? (
              <div className="lab-quiz-path">
                <p className="lab-path-label">POST /quiz · Cognito JWT — submit answers</p>
                <PathRow hops={quizPost} travel={postTravel} />
              </div>
            ) : null}
          </div>
        ) : uploadLayout ? (
          <div className="lab-flow is-upload">
            <div className="lab-upload-presign">
              <Svc hop={shown[0]} />
              <div className="lab-upload-io">
                <FlowArrow live={uploadStep === 0} label="POST /uploads" />
                <FlowArrow back live={uploadStep === 1} label="presigned URL" />
              </div>
              <Svc hop={shown[1]} />
            </div>
            <div className="lab-upload-put">
              <Svc hop={shown[2]} />
              <div className={`lab-upload-late${uploadStep >= 2 ? "" : " is-off"}`}>
                <FlowArrow live={uploadStep === 2} label="PUT" />
                <Svc hop={shown[3]} />
                <FlowArrow live={uploadStep === 3} label="Event" />
                <Svc hop={shown[4]} />
                <FlowArrow live={uploadStep === 4} label="Async" />
                <Svc hop={shown[5]} />
                <FlowArrow live={uploadStep === 5} />
                <Svc hop={shown[6]} />
              </div>
            </div>
          </div>
        ) : poisonLayout ? (
          <div className="lab-flow is-poison">
            <div className="lab-flow-row">
              <Svc hop={shown[0]} />
              <FlowArrow live={poisonStep === 0} label={asyncLabel(shown[0], shown[1])} />
              <Svc hop={shown[1]} />
              <FlowArrow live={poisonStep === 1} label={asyncLabel(shown[1], shown[2])} />
              <div className="lab-poison-pair">
                <svg className="lab-poison-loop" viewBox="0 0 304 52" aria-hidden>
                  <path d="M228 44 V10 H64 V34" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M59 27 L64 36 L69 27" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {backToSqs ? <i className="lab-poison-packet" key={poisonStep} /> : null}
                <Svc hop={{ ...shown[2], role: poisonSqsRole(poisonStep) }} fail={tryN > 0} />
                <FlowArrow live={toWorker} fail label="Async" />
                <Svc hop={shown[3]} fail={tryN > 0} />
              </div>
            </div>
            <div className="lab-poison-dlq">
              <FlowArrow down live={toDlq} fail label="SQS redrive" />
              <Svc hop={shown[4]} fail />
            </div>
          </div>
        ) : (
          <div className="lab-flow">
            <div className="lab-flow-row">
              {first.map((hop, index) => (
                <Fragment key={`r-${hop.service}-${index}`}>
                  {index > 0 ? (
                    <FlowArrow
                      live={edgeLive(index - 1)}
                      fail={edgeFail(index - 1)}
                      label={edgeLabel(index - 1)}
                    />
                  ) : null}
                  <Svc hop={hop} fail={poison && isDlq(hop)} />
                </Fragment>
              ))}
            </div>
            {rest.length ? (
              <div className="lab-flow-tail" style={{ ["--lab-lead" as string]: String(Math.max(0, first.length - 1)) }}>
                {rest.map((hop, j) => {
                  const edgeIndex = first.length - 1 + j;
                  return (
                    <Fragment key={`t-${hop.service}-${j}`}>
                      <FlowArrow
                        down
                        live={edgeLive(edgeIndex)}
                        fail={edgeFail(edgeIndex)}
                        label={edgeLabel(edgeIndex)}
                      />
                      <Svc hop={hop} fail={poison && isDlq(hop)} />
                    </Fragment>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export function hopExtras(hop: Hop) {
  return Object.entries(hop).filter(([key]) => key !== "service" && key !== "role");
}

export function PlaygroundMascot() {
  return (
    <svg className="lab-mascot" viewBox="0 0 160 180" aria-hidden>
      <ellipse cx="80" cy="170" rx="36" ry="7" fill="rgba(0,0,0,0.22)" />
      <path d="M58 118 L50 158" stroke="#c07d26" strokeWidth="11" strokeLinecap="round" />
      <path d="M102 118 L110 158" stroke="#c07d26" strokeWidth="11" strokeLinecap="round" />
      <g className="lab-mascot-arm lab-mascot-arm-l">
        <path d="M36 88 C18 96, 14 118, 28 124" fill="none" stroke="#c07d26" strokeWidth="10" strokeLinecap="round" />
      </g>
      <g className="lab-mascot-arm lab-mascot-arm-r">
        <path d="M124 84 C146 70, 142 42, 126 36" fill="none" stroke="#c07d26" strokeWidth="10" strokeLinecap="round" />
      </g>
      <circle cx="80" cy="78" r="48" fill="#c07d26" />
      <circle cx="80" cy="78" r="48" fill="url(#lab-mascot-shine)" />
      <circle cx="64" cy="72" r="7.5" fill="#1c2434" />
      <circle cx="96" cy="72" r="7.5" fill="#1c2434" />
      <circle cx="66.5" cy="70" r="2.4" fill="#fff" />
      <circle cx="98.5" cy="70" r="2.4" fill="#fff" />
      <path d="M64 96 Q80 110 96 96" fill="none" stroke="#1c2434" strokeWidth="3.4" strokeLinecap="round" />
      <defs>
        <radialGradient id="lab-mascot-shine" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff4a8" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffd200" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

