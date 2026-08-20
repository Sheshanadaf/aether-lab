import { useMemo, useState } from "react";
import { ATLAS } from "../lib/atlas";

export function AtlasPage() {
  const [filter, setFilter] = useState<"all" | "live" | "not">("all");
  const rows = useMemo(() => {
    if (filter === "live") return ATLAS.filter((r) => r.live);
    if (filter === "not") return ATLAS.filter((r) => !r.live);
    return ATLAS;
  }, [filter]);

  return (
    <article>
      <p className="kicker">Architecture atlas</p>
      <h1>What runs vs what I refused</h1>
      <p className="lede">
        Live means it exists in this AWS account. Atlas-only means I can explain when I would use it
        at work — and why it would break a ~$5/month lab (NAT, RDS, EKS, idle EC2).
      </p>
      <p>
        <button type="button" onClick={() => setFilter("all")}>
          All
        </button>{" "}
        <button type="button" onClick={() => setFilter("live")}>
          Live
        </button>{" "}
        <button type="button" onClick={() => setFilter("not")}>
          Not in this lab
        </button>
      </p>
      {rows.map((r) => (
        <section key={r.name}>
          <h2>
            {r.name}{" "}
            <small>{r.live ? "live" : "atlas only"} · {r.family}</small>
          </h2>
          <p>
            <strong>Here:</strong> {r.usedFor}
          </p>
          <p>
            <strong>At work:</strong> {r.whenAtWork}
          </p>
        </section>
      ))}
    </article>
  );
}