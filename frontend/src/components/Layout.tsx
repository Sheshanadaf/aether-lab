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