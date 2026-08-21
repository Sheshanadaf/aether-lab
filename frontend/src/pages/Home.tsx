import { Link } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SkillsOrbit } from "../components/SkillsOrbit";
import { ShareRail } from "../components/ShareRail";
import {
  HeroCloudAnimation,
  HeroKeyword,
  useHeroCycle,
} from "../components/HeroCloudAnimation";
import {
  GitHubIcon,
  LabsIcon,
  LinkedInIcon,
  MailIcon,
  MediumIcon,
  PdfIcon,
  YouTubeIcon,
} from "../components/BrandIcons";
import { FALLBACK_TRACE, incrementVisits } from "../lib/api";
import { LINKS, PROJECTS, SHARE_YOUTUBE, type ProjectLink } from "../lib/portfolio";
import { useTracer } from "../lib/tracer";
import "./home.css";

function ProjectAction({ link }: { link: ProjectLink }) {
  const inner: Record<ProjectLink["kind"], ReactNode> = {
    github: <GitHubIcon />,
    youtube: <YouTubeIcon />,
    labs: <LabsIcon />,
    web: <LabsIcon />,
  };

  const className = "project-icon-btn";
  if (link.href.startsWith("/")) {
    return (
      <Link className={className} to={link.href} aria-label={link.label} title={link.label}>
        {inner[link.kind]}
      </Link>
    );
  }

  return (
    <a className={className} href={link.href} aria-label={link.label} title={link.label}>
      {inner[link.kind]}
    </a>
  );
}

function DoCloudIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7.5 18h9.2a3.8 3.8 0 0 0 .4-7.58 5.2 5.2 0 0 0-10.04-1.16A3.7 3.7 0 0 0 7.5 18Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M9 13.5h6M10.5 16h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function DoAutomateIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M19.2 8.2a7.5 7.5 0 0 0-12.7-2.4M4.8 15.8a7.5 7.5 0 0 0 12.7 2.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M6.2 5.4V8.6H3M17.8 18.6V15.4H21" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DoServerlessIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.2 20 8v8l-8 4.8L4 16V8l8-4.8Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M12 12V21.2M12 12 20 8M12 12 4 8" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function DoTeachIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4.5 7.5h15v9.5H4.5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 17v2.5h8V17" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 11.2h4.2M8 13.6h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

const WHAT_I_DO = [
  { num: "01", title: "Design and Deploy Cloud Infrastructure", Icon: DoCloudIcon },
  { num: "02", title: "Automate Everything", Icon: DoAutomateIcon },
  { num: "03", title: "Build Serverless Cloud-Native Backends", Icon: DoServerlessIcon },
  { num: "04", title: "Teaching AWS", Icon: DoTeachIcon },
] as const;

export function HomePage() {
  const { setTrace } = useTracer();
  const { stage, reduced } = useHeroCycle();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    incrementVisits()
      .then((data) => setTrace(data.trace))
      .catch(() => setTrace(FALLBACK_TRACE));
  }, [setTrace]);

  return (
    <article className="home">
      <div className="home-orb a" />
      <div className="home-orb c" />

      <section className="home-section hero-bleed" id="top">
        <div className="hero-aurora" aria-hidden>
          <span className="hero-grid-tex" />
          <span className="hero-particle a" />
          <span className="hero-particle b" />
          <span className="hero-particle c" />
          <span className="hero-particle d" />
        </div>
        <div className="hero-grid">
          <HeroCloudAnimation stage={stage} reduced={reduced} />
          <div className="hero-copy">
            <p className="kicker">Colombo, Sri Lanka • Cloud • DevOps</p>
            <h1 className="display">Sheshan Hebron</h1>
            <p className="title">Cloud &amp; DevOps Engineer</p>
            <HeroKeyword stage={stage} reduced={reduced} />
            <div className="hero-actions">
              <Link className="btn-primary" to="/labs">
                Cloud Playground
              </Link>
              <a className="btn-ghost" href="#projects">
                View Projects
              </a>
              <a className="btn-ghost" href={LINKS.resume} download>
                Download Resume
              </a>
            </div>
          </div>
          <div className="hero-portrait">
            <img src="/sheshan.png?v=5" alt="Sheshan Hebron" />
          </div>
        </div>
      </section>

      <section className="home-section" id="about">
        <div className="about-split">
          <div className="about-intro">
            <p className="kicker section-kicker">About</p>
            <h2>I design cloud systems that stay reliable after they go live.</h2>
            <p>
              I work on AWS architecture, serverless backends, and the automation that keeps those
              systems deployable. The parts that matter most to me are the ones that are easy to
              skip: IAM, monitoring, and the path a change takes from commit to production.
            </p>
            <p>
              I also teach AWS in Sinhala through CloudNest, turning architecture into explanations
              people can actually use. I take ownership of the work, keep improving how it is built,
              and treat teaching as part of the same craft.
            </p>
            <p className="about-now-label">Currently</p>
            <ul className="about-now">
              <li>Teaching AWS on CloudNest</li>
            </ul>
            <a className="btn-ghost about-cta" href="#contact">
              Let’s connect
            </a>
          </div>
          <aside className="about-do">
            <p className="kicker section-kicker">What I Do</p>
            {WHAT_I_DO.map((item, index) => (
              <motion.article
                className="do-card"
                key={item.num}
                initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.45 }}
                transition={{
                  duration: 0.45,
                  delay: index * 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <span className="do-card-mark" aria-hidden>
                  <item.Icon />
                </span>
                <h3>{item.title}</h3>
                <span className="do-card-num">{item.num}</span>
              </motion.article>
            ))}
          </aside>
        </div>
      </section>

      <section className="home-section" id="skills">
        <div className="skills-layout">
          <p className="kicker section-kicker skills-kicker">Skills</p>
          <p className="kicker section-kicker skills-certs-label">Certifications</p>
          <div className="skills-main">
            <h2>Always Learning. Always Sharping new Skills...</h2>
            <SkillsOrbit />
          </div>
          <div className="skills-certs">
            <div className="cert-saa-wrap">
              <a className="cert-btn" href={LINKS.saa}>
                <img src="/badge-saa.png" alt="AWS Certified Solutions Architect – Associate" />
                <span>Verify on Credly</span>
              </a>
            </div>
            <a className="cert-btn" href={LINKS.ccp}>
              <img src="/badge-ccp.png" alt="AWS Certified Cloud Practitioner" />
              <span>Verify on Credly</span>
            </a>
          </div>
        </div>
      </section>

      <section className="home-section projects-band" id="projects">
        <div className="projects-band-inner">
          {PROJECTS.map((project, index) => (
            <article className={`featured${index % 2 === 1 ? " is-flip" : ""}`} key={project.name}>
              <div className="featured-copy">
                <p className="kicker">{project.kicker}</p>
                <h2>{project.title}</h2>
                <p className="featured-blurb">{project.blurb}</p>
                <div className="featured-actions">
                  {project.links.map((link) => (
                    <ProjectAction key={link.href} link={link} />
                  ))}
                </div>
              </div>
              <div className="featured-shot">
                <div className="device-frame">
                  <img src={project.image} alt={project.alt} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section" id="experience">
        <p className="kicker section-kicker">Experience</p>
        <div className="exp-brand">
          <img className="exp-logo" src="/10qbit_logo.png" alt="" />
        </div>
        <p className="timeline">
          <strong>DevOps Engineer Intern</strong>
          <br />
          Remote · United Kingdom · Jan 2026 – 12 Jul 2026
        </p>
        <p className="exp-copy">
          I designed AWS serverless solution architectures for delivery work, kept an eye on cloud
          cost and operational monitoring, and audited the security of those designs — IAM, network
          paths, and the controls that keep a system honest once it is live.
        </p>
      </section>

      <section className="home-section writing-band" id="writing">
        <div className="writing-band-inner">
          <p className="kicker section-kicker">Knowledge sharing</p>
          <div className="share-accounts">
            <a className="share-account-btn" href={LINKS.youtube} target="_blank" rel="noreferrer">
              <YouTubeIcon />
              YouTube
              <span>@CloudNest</span>
            </a>
            <a className="share-account-btn" href={LINKS.medium} target="_blank" rel="noreferrer">
              <MediumIcon />
              Medium
              <span>@sheshanhebron61</span>
            </a>
          </div>
          <ShareRail items={SHARE_YOUTUBE} />
        </div>
      </section>

      <section className="home-section" id="contact">
        <p className="kicker section-kicker">Contact</p>
        <h2>Let’s connect</h2>
        <div className="contact-row">
          <a className="contact-icon" href={LINKS.email} aria-label="Email" title="Email">
            <MailIcon />
          </a>
          <a className="contact-icon" href={LINKS.linkedin} aria-label="LinkedIn" title="LinkedIn">
            <LinkedInIcon />
          </a>
          <a className="contact-icon" href={LINKS.github} aria-label="GitHub" title="GitHub">
            <GitHubIcon />
          </a>
          <a className="contact-icon" href={LINKS.medium} aria-label="Medium" title="Medium">
            <MediumIcon />
          </a>
          <a
            className="contact-icon"
            href={LINKS.resume}
            download
            aria-label="Download resume PDF"
            title="Download resume PDF"
          >
            <PdfIcon />
          </a>
        </div>
        <a className="contact-email" href={LINKS.email}>
          Email: sheshanhebron61@gmail.com
        </a>
      </section>
    </article>
  );
}
