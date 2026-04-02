"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { VentureId } from "@/lib/ventures";

interface VentureContextValue {
  venture: VentureId;
  setVenture: (v: VentureId) => void;
}

const VentureContext = createContext<VentureContextValue>({
  venture: "online_first",
  setVenture: () => {},
});

export function VentureProvider({ children }: { children: ReactNode }) {
  const [venture, setVentureState] = useState<VentureId>("online_first");

  useEffect(() => {
    const stored = localStorage.getItem("active_venture") as VentureId | null;
    if (stored) setVentureState(stored);
  }, []);

  function setVenture(v: VentureId) {
    setVentureState(v);
    localStorage.setItem("active_venture", v);
  }

  return (
    <VentureContext.Provider value={{ venture, setVenture }}>
      {children}
    </VentureContext.Provider>
  );
}

export function useVenture() {
  return useContext(VentureContext);
}
