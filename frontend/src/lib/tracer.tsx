import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { FALLBACK_TRACE, type Trace } from "./api";

type Ctx = {
  trace: Trace;
  setTrace: (t: Trace) => void;
};

const TracerCtx = createContext<Ctx | null>(null);

export function TracerProvider({ children }: { children: ReactNode }) {
  const [trace, setTrace] = useState<Trace>(FALLBACK_TRACE);
  const value = useMemo(() => ({ trace, setTrace }), [trace]);
  return <TracerCtx.Provider value={value}>{children}</TracerCtx.Provider>;
}

export function useTracer() {
  const ctx = useContext(TracerCtx);
  if (!ctx) throw new Error("useTracer must be used inside TracerProvider");
  return ctx;
}