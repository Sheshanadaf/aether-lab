export type Hop = { service: string; role: string };

export type Trace = {
  requestId: string;
  path: Hop[];
  demo?: boolean;
};

export type VisitResponse = {
  count: number;
  trace: Trace;
};

const BASE = import.meta.env.VITE_API_BASE as string | undefined;

export const FALLBACK_TRACE: Trace = {
  requestId: "demo-local",
  demo: true,
  path: [
    { service: "Browser", role: "API not reached — check .env and npm run dev restart" },
    { service: "Amazon API Gateway", role: "POST /visits (when live)" },
    { service: "AWS Lambda", role: "arm64 increment" },
    { service: "Amazon DynamoDB", role: "atomic counter" },
  ],
};

export async function incrementVisits(): Promise<VisitResponse> {
  if (!BASE) {
    throw new Error("VITE_API_BASE is missing. Create frontend/.env and restart the dev server.");
  }

  const res = await fetch(`${BASE}/visits`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`API ${res.status}`);
  }
  return res.json() as Promise<VisitResponse>;
}

export type JobResponse = {
  jobId: string;
  status: string;
  message?: string;
  trace: Trace;
};

export async function submitJob(body: { message?: string; poison?: boolean }): Promise<JobResponse> {
  if (!BASE) {
    throw new Error("VITE_API_BASE is missing.");
  }
  const res = await fetch(`${BASE}/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}`);
  }
  return res.json() as Promise<JobResponse>;
}

export async function getJob(jobId: string): Promise<JobResponse> {
  if (!BASE) {
    throw new Error("VITE_API_BASE is missing.");
  }
  const res = await fetch(`${BASE}/jobs/${jobId}`);
  if (!res.ok) {
    throw new Error(`API ${res.status}`);
  }
  return res.json() as Promise<JobResponse>;
}