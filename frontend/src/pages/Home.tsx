import { Link } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import { TiltCard } from "../components/TiltCard";
import { SkillsOrbit } from "../components/SkillsOrbit";
import { HeroBackdrop } from "../components/HeroBackdrop";
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
import { LINKS, PROJECTS, type ProjectLink } from "../lib/portfolio";
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

export function HomePage() {
  const { setTrace } = useTracer();

  useEffect(() => {
    incrementVisits()
      .then((data) => setTrace(data.trace))
      .catch(() => setTrace(FALLBACK_TRACE));
  }, [setTrace]);

  return (
    <article className="home">
      <HeroBackdrop />
      <div className="home-orb a" />
      <div className="home-orb c" />

      <section className="home-section hero-grid" id="top">
        <div className="hero-copy">
          <p className="kicker">Colombo, Sri Lanka · Cloud · DevOps</p>
          <h1 className="display">Sheshan Hebron</h1>
          <p className="title">Cloud &amp; DevOps Engineer</p>
          <p className="hero-line">
            I design, automate, and explain AWS systems — Terraform, CI/CD, and serverless you can
            walk through hop by hop.
          </p>
          <div className="hero-actions">
            <a className="btn-ghost" href="#projects">
              View projects
            </a>
            <Link className="btn-primary" to="/labs">
              Explore live labs
            </Link>
            <a className="btn-ghost" href={LINKS.resume} download>
              Download resume
            </a>
          </div>
        </div>
        <TiltCard className="hero-photo">
          <div className="photo-orb">
            <img src="/sheshan.jpg" alt="Sheshan Hebron" />
          </div>
        </TiltCard>
      </section>

      <section className="home-section" id="about">
        <p className="kicker">About</p>
        <h2>I&apos;m a Cloud &amp; DevOps engineer</h2>
        <div className="about-3d">
          <p>
            I&apos;m finishing a <strong>BSc (Hons) in Cloud Computing</strong> at Sri Lanka
            Technology Campus (GPA 3.779). I interned as a <strong>DevOps Engineer at 10QBIT</strong>{" "}
            (remote, UK) and hold <strong>AWS Solutions Architect – Associate</strong> and{" "}
            <strong>Cloud Practitioner</strong>.
          </p>
        </div>
      </section>

      <section className="home-section" id="skills">
        <p className="kicker">Skills</p>
        <h2>These are the skills I work with</h2>
        <SkillsOrbit />
      </section>

      <section className="home-section" id="projects">
        {PROJECTS.map((project) => (
          <article className="featured" key={project.name}>
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
            <TiltCard className="featured-shot">
              <div className="device-frame">
                <img src={project.image} alt={project.alt} />
              </div>
            </TiltCard>
          </article>
        ))}
      </section>

      <section className="home-section" id="experience">
        <p className="kicker">Experience</p>
        <h2>10QBIT</h2>
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
        <p className="timeline exp-write">
          <strong>YouTube and Medium content writer</strong>
          <br />
          I teach AWS as CloudNest and write architecture walkthroughs on Medium.
        </p>
        <p className="exp-links">
          <a href={LINKS.youtube} title="CloudNest on YouTube">
            <YouTubeIcon />
            <span>YouTube</span>
          </a>
          <a href={LINKS.medium} title="Medium">
            <MediumIcon />
            <span>Medium</span>
          </a>
        </p>
      </section>

      <section className="home-section" id="certs">
        <p className="kicker">Certifications</p>
        <h2>Amazon Web Services</h2>
        <div className="cert-row">
          <a className="cert-btn" href={LINKS.saa}>
            <img src="/badge-saa.png" alt="AWS Certified Solutions Architect – Associate" />
            <span>Verify on Credly</span>
          </a>
          <a className="cert-btn" href={LINKS.ccp}>
            <img src="/badge-ccp.png" alt="AWS Certified Cloud Practitioner" />
            <span>Verify on Credly</span>
          </a>
        </div>
      </section>

      <section className="home-section" id="education">
        <p className="kicker">Education</p>
        <p className="edu-degree">BSc (Hons) Cloud Computing</p>
        <h2 className="edu-3d">Sri Lanka Technology Campus</h2>
        <p className="edu-dates">October 2022 – present</p>
        <p className="edu-class">GPA 3.779</p>
      </section>

      <section className="home-section" id="writing">
        <p className="kicker">Knowledge sharing</p>
        <h2>CloudNest</h2>
        <div className="teach-row">
          <a className="teach-card nest-yt" href={LINKS.youtube} title="CloudNest on YouTube">
            <span className="nest-stack">
              <YouTubeIcon className="yt-back" />
              <img src="/cloudnest.png" alt="" />
            </span>
            <span>CloudNest</span>
          </a>
          <a className="teach-card" href={LINKS.linkedin} title="LinkedIn">
            <LinkedInIcon className="teach-logo" />
            <span>LinkedIn</span>
          </a>
          <a className="teach-card" href={LINKS.medium} title="Medium">
            <MediumIcon className="teach-logo" />
            <span>Medium</span>
          </a>
        </div>
      </section>

      <section className="home-section" id="contact">
        <p className="kicker">Contact</p>
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
          sheshanhebron61@gmail.com
        </a>
      </section>
    </article>
  );
}
