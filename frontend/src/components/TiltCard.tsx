import { useRef, type ReactNode, type MouseEvent } from "react";

export function TiltCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const inner = useRef<HTMLDivElement>(null);

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const el = inner.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.transform = `rotateX(${(0.5 - y) * 9}deg) rotateY(${(x - 0.5) * 12}deg)`;
  }

  function onLeave() {
    if (inner.current) inner.current.style.transform = "rotateX(0) rotateY(0)";
  }

  return (
    <div className={`tilt-scene ${className}`} onMouseMove={onMove} onMouseLeave={onLeave}>
      <div className="tilt-card" ref={inner}>
        {children}
      </div>
    </div>
  );
}
