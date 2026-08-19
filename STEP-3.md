# Step 3 — Frontend skeleton (localhost only)

No AWS. No Terraform. The site must run in the browser with **hardcoded** tracer hops so you learn the product before the cloud.

When this step is done you will have five pages and a side panel. Labs will not call Lambda yet. That is correct.

---

## 0. Node.js

In PowerShell:

```powershell
node -v
npm -v
```

You want Node **18+** (20 or 22 is fine). If the command is not found, install LTS from https://nodejs.org then open a **new** terminal.

---

## 1. Create the Vite + React app

From the project root (`D:\Projects\Advanced Architectural Project`):

```powershell
npm create vite@latest frontend -- --template react-ts
```

If it asks to install `create-vite`, yes.

Then:

```powershell
cd frontend
npm install
npm install react-router-dom
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`). You should see the default Vite + React page.

**Why Vite + React:** the finished site is a **static** app (HTML/JS/CSS) we later upload to S3. React gives us pages and a tracer panel without a server. You are not learning Kubernetes here; you are learning the **shape** of the portfolio.

Stop the server with `Ctrl+C` when you need the terminal. You can start it again with `npm run dev` anytime.

**Why `frontend/`:** later Terraform and Python live next to this folder, not inside `node_modules`.

---

## 2. What we are building (picture)

```
┌─────────────────────────────────┬──────────────────┐
│  Nav: About Labs Atlas Pillars  │  Request Tracer  │
│  Ship                           │  (fake hops)     │
│                                 │                  │
│  Page content                   │  CloudFront →    │
│                                 │  API Gateway →   │
│                                 │  Lambda → …      │
└─────────────────────────────────┴──────────────────┘
```

Five routes:

| Path | Page |
|---|---|
| `/` | About you (real links, photo later) |
| `/labs` | Placeholder labs |
| `/atlas` | Placeholder atlas |
| `/pillars` | Six pillar names |
| `/ship` | How it will ship (OIDC, Terraform — words only) |

The tracer does **not** call AWS. It always shows the same example path. When we wire the API (later step), we will replace that fake list with the JSON from Lambda.

---

## 3. Add routing — `src/main.tsx`

Replace the contents of `frontend/src/main.tsx` with:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

**Why BrowserRouter:** the address bar can be `/labs` instead of one endless page. On S3 we will teach CloudFront to serve `index.html` for those paths later.

---

## 4. Create `src/components/Layout.tsx`

Create the folder `src/components` if needed. New file:

```tsx
import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { Tracer } from "./Tracer";

const links = [
  { to: "/", label: "About" },
  { to: "/labs", label: "Labs" },
  { to: "/atlas", label: "Atlas" },
  { to: "/pillars", label: "Six pillars" },
  { to: "/ship", label: "How it ships" },
];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <div>
        <header className="nav">
          <NavLink to="/" className="brand">
            Aether Lab <span>localhost</span>
          </NavLink>
          <nav className="nav-links">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="main">{children}</main>
      </div>
      <Tracer />
    </div>
  );
}
```

**Why Layout:** every page shares the same chrome. You do not copy-paste the nav five times.

---

## 5. Create `src/components/Tracer.tsx`

This is the **fake** architecture walk. Same hops on every page for now.

```tsx
const hops = [
  { service: "Browser", role: "You, on localhost — not AWS yet" },
  { service: "Amazon CloudFront", role: "HTTPS + cache (later)" },
  { service: "Amazon S3", role: "Private bucket via OAC (later)" },
  { service: "Amazon API Gateway", role: "HTTP API (later)" },
  { service: "AWS Lambda", role: "arm64 in ap-south-1 (later)" },
  { service: "Amazon DynamoDB", role: "Visitor counter (later)" },
];

export function Tracer() {
  return (
    <aside className="tracer">
      <p className="kicker">Request tracer</p>
      <h2>What AWS will do</h2>
      <p>
        Demo only. When the API is live, this list will come from the Lambda
        response.
      </p>
      {hops.map((hop, i) => (
        <div className="hop" key={hop.service}>
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

**Why hardcoded:** if you cannot explain this panel, the live API will not help you in an interview.

---

## 6. Pages — create `src/pages/`

### `src/pages/Home.tsx`

Use your real story. Photo comes later (you will add an image file). For now a text About page is enough.

```tsx
export function HomePage() {
  return (
    <article>
      <p className="kicker">Portfolio · Cloud · DevOps</p>
      <h1>Sheshan Hebron</h1>
      <p className="lede">
        BSc (Hons) Cloud Computing, Colombo. DevOps internship at 10QBIT
        (remote, UK). I teach AWS on YouTube as CloudNest.
      </p>
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
      <p>
        This site is Aether Lab — labs will call real AWS in later steps. Right
        now you are looking at the skeleton.
      </p>
    </article>
  );
}
```

### `src/pages/Labs.tsx`

```tsx
export function LabsPage() {
  return (
    <article>
      <p className="kicker">Live labs</p>
      <h1>Labs (not wired yet)</h1>
      <p>Later: visitor counter, Message Relay (SQS/DLQ), uploads, quiz, contact.</p>
      <p>Each one will update the tracer with a real request path.</p>
    </article>
  );
}
```

### `src/pages/Atlas.tsx`

```tsx
export function AtlasPage() {
  return (
    <article>
      <p className="kicker">Architecture atlas</p>
      <h1>Atlas (placeholder)</h1>
      <p>
        Later: services that run in this project vs services I did not turn on
        (NAT, RDS, EKS…) and when I would use them at work.
      </p>
    </article>
  );
}
```

### `src/pages/Pillars.tsx`

```tsx
const pillars = [
  "Operational Excellence",
  "Security",
  "Reliability",
  "Performance Efficiency",
  "Cost Optimization",
  "Sustainability",
];

export function PillarsPage() {
  return (
    <article>
      <p className="kicker">Well-Architected</p>
      <h1>Six pillars</h1>
      <p>Later each pillar maps to a concrete control in this repo.</p>
      <ul>
        {pillars.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </article>
  );
}
```

### `src/pages/Ship.tsx`

```tsx
export function ShipPage() {
  return (
    <article>
      <p className="kicker">CI/CD</p>
      <h1>How it will ship</h1>
      <p>
        Later: Terraform modules, GitHub Actions, OIDC (OpenID Connect — GitHub
        proves who it is; AWS gives temporary keys). No AKIA keys in GitHub.
      </p>
      <p>
        OAC (Origin Access Control): CloudFront may read S3; the bucket stays
        private.
      </p>
    </article>
  );
}
```

---

## 7. `src/App.tsx`

Replace the Vite demo with:

```tsx
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { AtlasPage } from "./pages/Atlas";
import { HomePage } from "./pages/Home";
import { LabsPage } from "./pages/Labs";
import { PillarsPage } from "./pages/Pillars";
import { ShipPage } from "./pages/Ship";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/labs" element={<LabsPage />} />
        <Route path="/atlas" element={<AtlasPage />} />
        <Route path="/pillars" element={<PillarsPage />} />
        <Route path="/ship" element={<ShipPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
```

You can delete `src/App.css` and remove any `App.css` import. Delete `src/assets/react.svg` if you want; not required.

---

## 8. Replace `src/index.css`

Remove the default Vite CSS. Paste this so the layout matches the picture (nav + tracer column):

```css
:root {
  --bg: #070b12;
  --card: #121b2c;
  --line: #243049;
  --text: #e8eefc;
  --muted: #8b9bb8;
  --accent: #3ee0b4;
  --font: "Segoe UI", system-ui, sans-serif;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  line-height: 1.55;
}
a { color: var(--accent); }
.shell {
  display: grid;
  grid-template-columns: 1fr 300px;
  min-height: 100vh;
}
.nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--line);
  flex-wrap: wrap;
}
.brand {
  color: var(--text);
  text-decoration: none;
  font-weight: 700;
}
.brand span { color: var(--accent); font-size: 0.75rem; margin-left: 0.5rem; }
.nav-links { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.nav-links a {
  color: var(--muted);
  text-decoration: none;
  padding: 0.3rem 0.65rem;
  border-radius: 999px;
}
.nav-links a.active,
.nav-links a:hover { color: var(--text); background: var(--card); }
.main { padding: 1.5rem; max-width: 720px; }
.kicker {
  color: var(--accent);
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.lede { color: var(--muted); font-size: 1.1rem; }
.tracer {
  border-left: 1px solid var(--line);
  padding: 1rem;
  background: #0e1522;
}
.tracer h2 { font-size: 1rem; }
.tracer p { color: var(--muted); font-size: 0.9rem; }
.hop { display: grid; grid-template-columns: 12px 1fr; gap: 0.6rem; margin: 0.8rem 0; }
.hop-dot {
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--accent);
}
.hop h3 { margin: 0; font-size: 0.9rem; }
.hop p { margin: 0.2rem 0 0; }

@media (max-width: 900px) {
  .shell { grid-template-columns: 1fr; }
  .tracer { border-left: 0; border-top: 1px solid var(--line); }
}
```

**Why this look:** dark, readable, tracer always visible. We will make About “handsome” (photo, richer layout) in a later polish step — you already flagged that.

---

## 9. `index.html` title

In `frontend/index.html`, set:

```html
<title>Aether Lab — Sheshan Hebron</title>
```

---

## 10. Check

```powershell
cd frontend
npm run dev
```

Click every nav link. Tracer should stay on the right (or under the page on a phone-width window).

If TypeScript errors: read the red text in the terminal. Common issue: old Vite `main.tsx` still imports `index.css` twice — keep one import.

---

## 11. Commit (you do this)

From the **project root**:

```powershell
git add frontend STEP-3.md
git status
git commit -m "Add localhost frontend skeleton with tracer and five pages."
```

`node_modules` must **not** appear in `git status` as files to commit. If it does, your `.gitignore` is missing `node_modules/` — add it, then `git status` again.

---

## Done when

- `http://localhost:5173` shows your name and links
- Five routes work
- Tracer shows the six fake hops
- You can explain Layout vs page vs Tracer in one sentence each

Reply: “Step 3 done” plus any error you could not fix. Next is **Step 4** — one Lambda in the console, then Python on your machine. Still no full Terraform.
