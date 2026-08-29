"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { VentureId } from "@/lib/ventures";
import { useAuth } from "@/context/AuthContext";

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
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const stored = localStorage.getItem("active_venture") as VentureId | null;
    if (stored) setVentureState(stored);
  }, []);

  // Non-founder Manager/Employee-User duerfen NIE ein Venture sehen, fuer das sie
  // keine Rolle haben. Ohne diesen Sync bleibt ein frisches Geraet (leeres
  // localStorage) beim hartcodierten Default "online_first" haengen, die
  // Server-Middleware blockt den ersten API-Call mit 403, und das Dashboard
  // stuerzt beim Rendern ab ("This page couldn't load"). Sobald die Rolle
  // geladen ist, erzwingen wir das zugewiesene Venture, falls es abweicht.
  useEffect(() => {
    if (authLoading || !user) return;
    if (user.role === "founder") return; // Founder darf frei wechseln
    if (user.venture && user.venture !== venture) {
      setVentureState(user.venture as VentureId);
      localStorage.setItem("active_venture", user.venture);
    }
  }, [authLoading, user, venture]);

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
