"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function InviteCompletePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function acceptInvite() {
      const supabase = createClient();

      // Warte kurz bis Auth-Session verfügbar ist
      await new Promise(resolve => setTimeout(resolve, 800));

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setErrorMsg("Nicht eingeloggt. Bitte versuche es erneut.");
        setStatus("error");
        return;
      }

      // Einladung annehmen
      const res = await fetch(`/api/invite/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });

      const result = await res.json();

      if (!res.ok) {
        setErrorMsg(result.error ?? "Fehler beim Annehmen der Einladung");
        setStatus("error");
        return;
      }

      router.push("/dashboard");
    }

    acceptInvite();
  }, [token]);

  if (status === "error") {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", fontFamily: "system-ui, sans-serif",
        background: "#F7F8FC",
      }}>
        <div style={{ textAlign: "center", maxWidth: "360px", padding: "0 24px" }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%", background: "#FEE2E2",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <span style={{ fontSize: 24 }}>✕</span>
          </div>
          <h2 style={{ color: "#14193A", fontWeight: 500, marginBottom: 8 }}>Fehler</h2>
          <p style={{ color: "#6B7280", fontSize: 14, marginBottom: 24 }}>{errorMsg}</p>
          <a href={`/invite/${token}`} style={{
            display: "inline-block", padding: "10px 24px",
            background: "#1B2A5E", color: "#fff", borderRadius: "6px",
            textDecoration: "none", fontSize: 14,
          }}>
            Zurück zur Einladung
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: "system-ui, sans-serif",
      background: "#F7F8FC",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 40, height: 40, border: "3px solid #D1D5E8",
          borderTopColor: "#1B2A5E", borderRadius: "50%",
          animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
        }} />
        <p style={{ color: "#6B7280", fontSize: 14 }}>Einladung wird angenommen…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
