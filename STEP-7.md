# Step 7 — Wire the frontend to the live counter

Your API and CloudFront exist:

| Output | Value |
|---|---|
| API | `https://dkoyf7v9v6.execute-api.ap-south-1.amazonaws.com` |
| Site | `https://dvsl7y0ezs478.cloudfront.net` |

This step: the **React app** calls `POST /visits`, shows the **count**, and the **Tracer** uses the `trace` JSON from Lambda (not the fake localhost list).

You already set **CORS** `allow_origins = ["*"]` on the HTTP API, so `http://localhost:5173` may call the API. You do **not** need to put the React app behind CloudFront yet (optional at the end).

Do not put IAM keys in the frontend. The browser only talks to **API Gateway**.

---

## What you will learn

- `VITE_` env vars are baked in at **build/dev** time
- The API URL is **public** (anyone can increment your counter — fine for a lab)
- Tracer state is **shared** (Layout’s Tracer is not inside Home, so we use a small React context)

---

## Part A — Env file

Create **`frontend/.env.example`** (commit this):

```
VITE_API_BASE=https://dkoyf7v9v6.execute-api.ap-south-1.amazonaws.com
```

Copy to **`frontend/.env`** (gitignored):

```powershell
cd frontend
copy .env.example .env
```

Vite only exposes variables that start with `VITE_`. After creating `.env`, **stop** `npm run dev` (Ctrl+C) and start it again or env will be empty.

---

## Part B — API helper

Create **`frontend/src/lib/api.ts`**:

```ts
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
```

**Why a helper:** pages should not copy `fetch` URLs. One place to change the path later (`/jobs`, `/quiz`).

---

## Part C — Share tracer state

The Tracer sits in **Layout**. Home sits in **`children`**. Siblings cannot pass props to each other. **Context** is a box both can read/write.

Create **`frontend/src/lib/tracer.tsx`**:

```tsx
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { FALLBACK_TRACE, type Trace } from "./api";

type Ctx = {
  trace: Trace;
  setTrace: (t: Trace) => void;
};

const TracerCtx = createContext<Ctx | null>(null);

export function TracerProvider({ children }: { children: ReactNode }) {
  const [trace, setTrace] = useState<Trace>(FALLBACK_TRACE);
  const value = useMemo(() => ({ trace, setTrace }), [trace]);
  return <TracerCtx.Provider value={value}>{children}</TracerCtx.Provider>;
}

export function useTracer() {
  const ctx = useContext(TracerCtx);
  if (!ctx) throw new Error("useTracer must be used inside TracerProvider");
  return ctx;
}
```

Wrap the app in **`frontend/src/main.tsx`**:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { TracerProvider } from "./lib/tracer.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <TracerProvider>
        <App />
      </TracerProvider>
    </BrowserRouter>
  </StrictMode>,
);
```

---

## Part D — Tracer reads context

Replace **`frontend/src/components/Tracer.tsx`**:

```tsx
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
```

---

## Part E — Home calls the API

Replace **`frontend/src/pages/Home.tsx`**:

```tsx
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
```

**Why `useEffect`:** we call AWS once when About loads, not on every React re-render. Strict Mode in development may call it **twice** — you might see the count jump by 2. That is React 18, not a broken DynamoDB. Production build calls once.

---

## Part F — Labs: a button

Add a button on **`frontend/src/pages/Labs.tsx`** so you can increment without reloading About:

```tsx
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
```

If the button is unstyled, add to **`index.css`**:

```css
button {
  cursor: pointer;
  border: 0;
  border-radius: 8px;
  background: var(--accent);
  color: #04241c;
  font-weight: 600;
  padding: 0.5rem 1rem;
}
```

---

## Part G — Check on localhost

```powershell
cd frontend
npm run dev
```

1. Open About — count should appear; tracer should list API Gateway, Lambda, DynamoDB (not only “localhost”).
2. Open Labs → Increment — count goes up; tracer `requestId` changes.
3. Browser **DevTools → Network** — you should see `POST .../visits` status 200.

If CORS error: you are calling the wrong origin or the API lost `cors_configuration`. Paste the console error.

If `VITE_API_BASE is missing`: `.env` not loaded — restart dev server; file must be `frontend/.env` not project root.

---

## Part H — Optional: put this build on CloudFront

Localhost is enough to finish Step 7. If you want the CloudFront URL to show React instead of the placeholder:

```powershell
cd frontend
npm run build
aws s3 sync dist s3://aether-lab-site-20260820003332187900000001 --delete --region ap-south-1
aws cloudfront create-invalidation --distribution-id ET3W1OCNKY1UR --paths "/*"
```

Wait 1–2 minutes, open `https://dvsl7y0ezs478.cloudfront.net`.

**Note:** `/labs` on CloudFront may 404 until we add a CloudFront rewrite (later). Home `/` should work because of `index.html`.

---

## Commit

```powershell
git add frontend/src frontend/.env.example STEP-7.md
git status
```

Do not commit `frontend/.env` if `.gitignore` already ignores it (good). The URL is public either way.

```powershell
git commit -m "Wire the visitor counter and tracer to the live API."
```

---

## Done when

- About shows a number from DynamoDB
- Tracer shows the three AWS hops from the Lambda JSON
- You can explain: env var → fetch → context → Tracer

Reply: the count you saw, and whether localhost (and optional CloudFront) worked. Next is **Step 8** — GitHub Actions + attach deploy permissions to the OIDC role.
