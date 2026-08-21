import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { YouTubeIcon } from "./BrandIcons";
import { LINKS } from "../lib/portfolio";
import "./hero-cloud.css";

export const HERO_STAGES = ["design", "automate", "teach"] as const;
export type HeroStage = (typeof HERO_STAGES)[number];

export const HERO_COPY: Record<HeroStage, { word: string; support: string }> = {
  design: { word: "design", support: "Cloud Architecture • AWS • System Design" },
  automate: { word: "automate", support: "CI/CD • Docker • Kubernetes • Terraform" },
  teach: { word: "teach", support: "AWS on YouTube • CloudNest • Sinhala Education" },
};

const STAGE_MS = 5500;
const HALF = 17;
const ease = [0.22, 1, 0.36, 1] as const;
const fade = { duration: 0.4, ease };

export function useHeroCycle() {
  const [stage, setStage] = useState<HeroStage>("design");
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      setStage((current) => HERO_STAGES[(HERO_STAGES.indexOf(current) + 1) % HERO_STAGES.length]);
    }, STAGE_MS);
    return () => window.clearInterval(id);
  }, [reduced]);

  return { stage, reduced };
}

function t(reduced: boolean | undefined, delay: number) {
  return reduced ? 0 : delay;
}

function DrawLine({ d, delay }: { d: string; delay: number }) {
  return (
    <motion.path
      d={d}
      className="aws-line"
      pathLength={1}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.38, delay, ease }}
    />
  );
}

function AwsNode({
  x,
  y,
  href,
  label,
  delay,
  icon,
  align = "below",
}: {
  x: number;
  y: number;
  href?: string;
  label: string;
  delay: number;
  icon?: ReactNode;
  align?: "below" | "right";
}) {
  const side = align === "right";
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.34, delay, ease }}
    >
      <rect x={x - HALF} y={y - HALF} width="34" height="34" rx="7" className="aws-tile" />
      {href ? (
        <image href={href} x={x - 11} y={y - 11} width="22" height="22" />
      ) : (
        <g transform={`translate(${x - 9},${y - 9}) scale(0.75)`}>{icon}</g>
      )}
      <text
        x={side ? x + 22 : x}
        y={side ? y + 4 : y + 34}
        className={`aws-label ${side ? "is-side" : ""}`}
      >
        {label}
      </text>
    </motion.g>
  );
}

function AwsGroup({
  x,
  y,
  w,
  h,
  label,
  delay,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  delay: number;
}) {
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay, ease }}
    >
      <rect x={x} y={y} width={w} height={h} rx="8" className="aws-group" />
      <text x={x + 10} y={y - 6} className="aws-group-label">
        {label}
      </text>
    </motion.g>
  );
}

function Hop({ d, begin, show }: { d: string; begin: string; show: boolean }) {
  if (!show) return null;
  return (
    <circle r="2.6" className="aws-hop">
      <animateMotion dur="1.4s" begin={begin} fill="freeze" path={d} />
    </circle>
  );
}

function UserGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="8" r="3.2" fill="#8b9bb8" />
      <path fill="#8b9bb8" d="M5.5 19.2c.6-3.4 3.1-5.2 6.5-5.2s5.9 1.8 6.5 5.2" />
    </svg>
  );
}

function DesignScene({ reduced }: { reduced?: boolean }) {
  return (
    <svg className="hv-aws-svg" viewBox="0 0 360 360" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <AwsGroup x={118} y={68} w={150} h={112} label="Edge" delay={t(reduced, 1.4)} />
      <AwsGroup x={36} y={208} w={288} h={56} label="Compute" delay={t(reduced, 2.15)} />
      <AwsGroup x={36} y={290} w={288} h={56} label="Data" delay={t(reduced, 2.85)} />

      <DrawLine d="M168 41 V83" delay={t(reduced, 0.3)} />
      <DrawLine d="M168 121 V137" delay={t(reduced, 0.95)} />
      <DrawLine d="M168 171 V196" delay={t(reduced, 1.55)} />
      <DrawLine d="M168 196 L88 219" delay={t(reduced, 1.65)} />
      <DrawLine d="M168 196 L248 219" delay={t(reduced, 1.7)} />
      <DrawLine d="M88 253 V301" delay={t(reduced, 2.3)} />
      <DrawLine d="M248 253 V301" delay={t(reduced, 2.36)} />

      <AwsNode x={168} y={24} label="User" delay={t(reduced, 0)} icon={<UserGlyph />} align="right" />
      <AwsNode x={168} y={100} href="/skills/cloudfront.svg" label="CloudFront" delay={t(reduced, 0.6)} align="right" />
      <AwsNode x={168} y={154} href="/skills/apigateway.svg" label="ALB" delay={t(reduced, 1.25)} align="right" />
      <AwsNode x={88} y={236} href="/skills/ec2.svg" label="EC2" delay={t(reduced, 1.9)} align="right" />
      <AwsNode x={248} y={236} href="/skills/ec2.svg" label="EC2" delay={t(reduced, 1.98)} align="right" />
      <AwsNode x={88} y={318} href="/skills/s3.svg" label="S3" delay={t(reduced, 2.55)} align="right" />
      <AwsNode x={248} y={318} href="/skills/rds.svg" label="RDS" delay={t(reduced, 2.63)} align="right" />

      <Hop show={!reduced} begin="3.2s" d="M168 41 V83 V121 V137 V171 V196 L248 219 V253 V301" />
    </svg>
  );
}

function AutomateScene({ reduced }: { reduced?: boolean }) {
  return (
    <svg className="hv-aws-svg" viewBox="0 0 360 360" preserveAspectRatio="xMidYMid meet" aria-hidden>
      <AwsGroup x={16} y={62} w={96} h={92} label="Source" delay={t(reduced, 0.7)} />
      <AwsGroup x={130} y={62} w={214} h={92} label="Build" delay={t(reduced, 1.5)} />
      <AwsGroup x={16} y={204} w={328} h={92} label="Deploy" delay={t(reduced, 2.75)} />

      <DrawLine d="M81 96 H155" delay={t(reduced, 0.42)} />
      <DrawLine d="M197 96 H287" delay={t(reduced, 1.1)} />
      <DrawLine d="M308 113 V229" delay={t(reduced, 1.68)} />
      <DrawLine d="M81 246 H155" delay={t(reduced, 2.18)} />
      <DrawLine d="M197 246 H287" delay={t(reduced, 2.45)} />

      <AwsNode x={64} y={96} href="/skills/github.svg" label="GitHub" delay={t(reduced, 0)} />
      <AwsNode x={180} y={96} href="/skills/githubactions.svg" label="CI/CD" delay={t(reduced, 0.7)} />
      <AwsNode x={308} y={96} href="/skills/docker.svg" label="Docker" delay={t(reduced, 1.32)} />
      <AwsNode x={64} y={246} href="/skills/terraform.svg" label="Terraform" delay={t(reduced, 1.92)} />
      <AwsNode x={180} y={246} href="/skills/kubernetes.svg" label="Kubernetes" delay={t(reduced, 2.22)} />
      <AwsNode x={308} y={246} href="/skills/aws-badge.svg" label="AWS" delay={t(reduced, 2.5)} />

      <Hop show={!reduced} begin="3.2s" d="M64 96 H180 H308 V246" />
    </svg>
  );
}

function TeachScene({ reduced }: { reduced?: boolean }) {
  return (
    <div className="hv-teach">
      <motion.img
        className="hv-teacher"
        src="/explain-instructor.png"
        alt=""
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45, delay: t(reduced, 0.05) }}
      />
      <div className="hv-teach-board">
        <motion.a
          className="hv-yt"
          href={LINKS.youtube}
          target="_blank"
          rel="noreferrer"
          title="I teach AWS on YouTube — CloudNest"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: t(reduced, 0.35) }}
        >
          <YouTubeIcon className="hv-yt-icon" />
          <span>AWS on YouTube</span>
        </motion.a>
        <svg className="hv-teach-svg" viewBox="0 0 180 300" aria-hidden>
          <AwsGroup x={8} y={18} w={164} h={268} label="AWS" delay={t(reduced, 0.45)} />
          <AwsNode x={42} y={62} href="/skills/cloudfront.svg" label="CloudFront" delay={t(reduced, 0.75)} align="right" />
          <AwsNode x={42} y={122} href="/skills/lambda.svg" label="Lambda" delay={t(reduced, 1.1)} align="right" />
          <AwsNode x={42} y={182} href="/skills/s3.svg" label="S3" delay={t(reduced, 1.45)} align="right" />
          <AwsNode x={42} y={242} href="/skills/ec2.svg" label="EC2" delay={t(reduced, 1.8)} align="right" />
        </svg>
      </div>
    </div>
  );
}

function Scene({ stage, reduced }: { stage: HeroStage; reduced: boolean }) {
  if (stage === "automate") return <AutomateScene reduced={reduced} />;
  if (stage === "teach") return <TeachScene reduced={reduced} />;
  return <DesignScene reduced={reduced} />;
}

export function HeroCloudAnimation({ stage, reduced }: { stage: HeroStage; reduced: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const shown = reduced ? "design" : stage;

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const el = wrap.current;
    if (!el || reduced) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  return (
    <aside className={`hero-viz ${reduced ? "is-static" : ""}`} ref={wrap} onMouseMove={onMove}>
      <div className="hv-cursor" />
      <AnimatePresence mode="wait">
        <motion.div
          key={shown}
          className="hv-scene"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fade}
        >
          <Scene stage={shown} reduced={reduced} />
        </motion.div>
      </AnimatePresence>
    </aside>
  );
}

export function HeroKeyword({ stage, reduced }: { stage: HeroStage; reduced: boolean }) {
  const copy = HERO_COPY[stage];
  return (
    <div className="hero-keyword-block">
      <p className="hero-keyword">
        <span className="hero-keyword-lead">I</span>
        {HERO_STAGES.map((word, index) => {
          const active = stage === word;
          return (
            <span key={word}>
              {index > 0 && <span className="hero-keyword-sep">, </span>}
              <motion.span
                key={`${word}-${active ? "on" : "off"}`}
                className={active ? "hero-keyword-on" : "hero-keyword-off"}
                initial={reduced || !active ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: active ? 1 : 0.42, y: 0 }}
                transition={fade}
              >
                {HERO_COPY[word].word}
              </motion.span>
            </span>
          );
        })}
      </p>
      <AnimatePresence mode="wait">
        <motion.p
          key={copy.support}
          className="hero-support"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          {copy.support}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
