import { useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { SKILL_ORBIT } from "../lib/portfolio";

const LINKED = new Set([
  "AWS",
  "CloudFront",
  "RDS",
  "Terraform",
  "Kubernetes",
  "JavaScript",
  "Flutter",
  "MongoDB",
  "DocumentDB",
]);

function pointIn(stage: HTMLElement, el: HTMLElement) {
  const s = stage.getBoundingClientRect();
  const e = el.getBoundingClientRect();
  const sx = stage.clientWidth / s.width;
  const sy = stage.clientHeight / s.height;
  return {
    x: (e.left + e.width / 2 - s.left) * sx,
    y: (e.top + e.height / 2 - s.top) * sy,
  };
}

function fanPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  startR: number,
  endR: number,
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const x1 = from.x + ux * startR;
  const y1 = from.y + uy * startR;
  const x2 = to.x - ux * endR;
  const y2 = to.y - uy * endR;
  const bend = 0.16;
  const cx = (x1 + x2) / 2 - uy * len * bend;
  const cy = (y1 + y2) / 2 + ux * len * bend;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

export function SkillsOrbit() {
  const stage = useRef<HTMLDivElement>(null);
  const hub = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [box, setBox] = useState({ w: 720, h: 480 });

  useLayoutEffect(() => {
    const stageEl = stage.current;
    if (!stageEl) return;

    function draw() {
      const root = stage.current;
      const hubEl = hub.current;
      if (!root || !hubEl) return;

      const saved = {
        rx: root.style.getPropertyValue("--rx"),
        ry: root.style.getPropertyValue("--ry"),
      };
      root.style.setProperty("--rx", "0deg");
      root.style.setProperty("--ry", "0deg");

      const from = pointIn(root, hubEl);
      const next = [...root.querySelectorAll<HTMLElement>("[data-link]")].map((el) =>
        fanPath(from, pointIn(root, el), hubEl.offsetWidth / 2 + 2, 24),
      );

      root.style.setProperty("--rx", saved.rx || "0deg");
      root.style.setProperty("--ry", saved.ry || "0deg");
      setBox({ w: root.clientWidth, h: root.clientHeight });
      setPaths(next);
    }

    draw();
    const frame = requestAnimationFrame(() => requestAnimationFrame(draw));
    const ro = new ResizeObserver(draw);
    ro.observe(stageEl);
    window.addEventListener("resize", draw);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", draw);
    };
  }, []);

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const el = stage.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--ox", `${x * 10}px`);
    el.style.setProperty("--oy", `${y * 8}px`);
    el.style.setProperty("--rx", `${(-y * 7).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(x * 9).toFixed(2)}deg`);
  }

  function onLeave() {
    const el = stage.current;
    if (!el) return;
    el.style.setProperty("--ox", "0px");
    el.style.setProperty("--oy", "0px");
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  return (
    <div className="skills-scene" onMouseMove={onMove} onMouseLeave={onLeave}>
      <div className="skills-orbit" ref={stage}>
        <svg
          className="skills-lines"
          viewBox={`0 0 ${box.w} ${box.h}`}
          fill="none"
          aria-hidden
        >
          {paths.map((d) => (
            <path className="orbit-curve" d={d} key={d} />
          ))}
        </svg>

        <div className="skill-hub" ref={hub}>
          <b>Skills</b>
          <span />
        </div>

        {SKILL_ORBIT.map((group) => (
          <div className={`skill-arm skill-arm-${group.id}`} key={group.id}>
            <p className="skill-group-title">{group.title}</p>
            <div className="skill-set">
              {group.logos.map((logo) => (
                <span className="skill-chip" key={logo.name}>
                  <span className="skill-logo" data-link={LINKED.has(logo.name) ? logo.name : undefined}>
                    <img src={logo.src} alt="" />
                  </span>
                  <em>{logo.name}</em>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
