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

export type UploadSignResponse = {
  uploadId: string;
  url: string;
  key: string;
  trace: Trace;
};

export type UploadStatusResponse = {
  uploadId: string;
  status: string;
  bytes?: number;
  contentType?: string;
  trace: Trace;
};

export async function signUpload(contentType: string, size: number): Promise<UploadSignResponse> {
  if (!BASE) throw new Error("VITE_API_BASE is missing.");
  const res = await fetch(`${BASE}/uploads`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentType, size }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<UploadSignResponse>;
}

export async function getUpload(uploadId: string): Promise<UploadStatusResponse> {
  if (!BASE) throw new Error("VITE_API_BASE is missing.");
  const res = await fetch(`${BASE}/uploads/${uploadId}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<UploadStatusResponse>;
}

export async function putToS3(url: string, file: File): Promise<void> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "content-type": file.type },
    body: file,
  });
  if (!res.ok) throw new Error(`S3 PUT ${res.status}`);
}

export type QuizQuestion = { id: string; prompt: string; choices: string[] };

export type QuizGetResponse = {
  questions: QuizQuestion[];
  trace: Trace;
};

export type QuizPostResponse = {
  score: number;
  outOf: number;
  trace: Trace;
};

export async function getQuiz(): Promise<QuizGetResponse> {
  if (!BASE) throw new Error("VITE_API_BASE is missing.");
  const res = await fetch(`${BASE}/quiz`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<QuizGetResponse>;
}

export async function submitQuiz(
  answers: Record<string, number>,
  idToken: string,
): Promise<QuizPostResponse> {
  if (!BASE) throw new Error("VITE_API_BASE is missing.");
  const res = await fetch(`${BASE}/quiz`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ answers }),
  });
  if (res.status === 401) throw new Error("401 — sign in first (JWT missing or wrong token type)");
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<QuizPostResponse>;
}