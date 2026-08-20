import { NavLink, useLocation } from "react-router-dom";
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
  const labs = useLocation().pathname === "/labs";

  return (
    <div className={`shell ${labs ? "shell-labs" : "shell-full"}`}>
      <div>
        <header className="nav">
          <NavLink to="/" className="brand">
            Sheshan Hebron <span>live</span>
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
        <main className={`main ${labs ? "" : "main-wide"}`}>{children}</main>
      </div>
      {labs ? <Tracer /> : null}
    </div>
  );
}
