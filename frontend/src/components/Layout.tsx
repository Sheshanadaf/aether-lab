import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, type ReactNode } from "react";

const links = [
  { to: "/", hash: "", label: "Home" },
  { to: "/", hash: "about", label: "About" },
  { to: "/labs", hash: "", label: "Cloud Playground" },
  { to: "/", hash: "projects", label: "Projects" },
  { to: "/", hash: "experience", label: "Experience" },
  { to: "/", hash: "contact", label: "Contact me" },
];

function isCurrent(pathname: string, hash: string, item: (typeof links)[number]) {
  if (item.to === "/labs") return pathname === "/labs";
  if (pathname !== "/") return false;
  const section = hash.replace("#", "");
  if (!item.hash) return section === "" || section === "top";
  return section === item.hash;
}

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const labs = location.pathname === "/labs";

  useEffect(() => {
    if (location.pathname !== "/") return;
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      el?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname, location.hash]);

  return (
    <div className="shell shell-full">
      <div>
        <header className="nav">
          <NavLink to="/" className="brand">
            Sheshan Hebron <span>live</span>
          </NavLink>
          <nav className="nav-links">
            {links.map((l) => (
              <Link
                key={l.label}
                to={{ pathname: l.to, hash: l.hash }}
                className={isCurrent(location.pathname, location.hash, l) ? "active" : ""}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className={`main ${labs ? "main-labs" : "main-wide"} ${location.pathname === "/" ? "main-home" : ""}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
