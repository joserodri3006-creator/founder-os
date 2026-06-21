"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

type HealthStatus = "checking" | "ok" | "warn" | "error";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [resetSent, setResetSent] = useState(false);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>("checking");
  const [healthIssues, setHealthIssues] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [oauthUrl, setOauthUrl] = useState("");

  const supabase = createClient();

  // Auf mount: URL-Parameter lesen (Fehler vom auth/callback) + Health-Check
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get("error");
    const urlMsg = params.get("msg");

    if (urlError === "auth" && urlMsg) {
      setError(`Anmeldung fehlgeschlagen: ${decodeURIComponent(urlMsg)}`);
    } else if (urlError === "auth") {
      setError("Anmeldung fehlgeschlagen. Bitte erneut versuchen.");
    } else if (urlError === "config") {
      setError("Serverkonfiguration fehlerhaft — bitte den Administrator informieren.");
    }

    // OAuth-URL für spätere Anzeige
    setOauthUrl(`${window.location.origin}/auth/callback`);

    // Health-Check im Hintergrund
    fetch("/api/health")
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setHealthStatus("ok");
        } else {
          setHealthStatus("error");
          setHealthIssues(data.issues ?? []);
        }
      })
      .catch(() => {
        setHealthStatus("warn");
        setHealthIssues(["Health-Check konnte nicht geladen werden"]);
      });
  }, []);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (authError) {
      setLoading(false);
      if (authError.message.includes("Invalid login credentials")) {
        setError("E-Mail oder Passwort falsch. Passwort vergessen? Link unten nutzen.");
      } else if (authError.message.includes("Email not confirmed")) {
        setError("E-Mail noch nicht bestätigt — bitte den Bestätigungslink in deiner E-Mail klicken.");
      } else if (authError.message.includes("Invalid API key") || authError.message.includes("apikey")) {
        setError("Serverkonfigurationsfehler (API-Key). Administrator informieren.");
        setHealthStatus("error");
      } else {
        setError(authError.message);
      }
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
    // Falls kein Fehler: Browser navigiert zu Google → kein weiteres Handling hier
  }

  async function handleReset() {
    if (!email) {
      setError("Bitte zuerst E-Mail-Adresse eingeben.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/login`,
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setResetSent(true);
  }

  const healthColor = {
    checking: "#9CA3AF",
    ok: "#16A34A",
    warn: "#D97706",
    error: "#DC2626",
  }[healthStatus];

  const healthLabel = {
    checking: "Verbindung wird geprüft…",
    ok: "Verbunden",
    warn: "Status unbekannt",
    error: "Verbindungsproblem",
  }[healthStatus];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Founder OS</h1>
          <p className="text-sm text-gray-500 mt-1">Multi-Venture Dashboard</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 px-8 py-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-gray-800">
              {mode === "login" ? "Anmelden" : "Konto erstellen"}
            </h2>
            {/* Health-Status-Indikator */}
            <button
              onClick={() => setShowDebug(d => !d)}
              className="flex items-center gap-1.5 text-xs"
              style={{ color: healthColor }}
              title="Systemstatus anzeigen"
            >
              <span className="w-2 h-2 rounded-full" style={{ background: healthColor }} />
              {healthLabel}
            </button>
          </div>

          {/* Debug-Panel */}
          {showDebug && (
            <div className="mb-5 p-3 rounded-lg text-xs space-y-1 border"
              style={{ background: "#F9FAFB", borderColor: "#E5E7EB", color: "#374151" }}>
              <p className="font-semibold mb-2">Systemdiagnose</p>
              {healthStatus === "ok" && (
                <p style={{ color: "#16A34A" }}>✓ Supabase erreichbar und konfiguriert</p>
              )}
              {healthIssues.map((issue, i) => (
                <p key={i} style={{ color: "#DC2626" }}>✗ {issue}</p>
              ))}
              <p className="mt-2 pt-2 border-t border-gray-200">
                <span className="font-medium">OAuth Redirect URL:</span><br />
                <code className="break-all">{oauthUrl || "wird geladen…"}</code>
              </p>
              <p className="text-gray-500 mt-1">
                Diese URL muss in{" "}
                <strong>Supabase → Authentication → URL Configuration → Redirect URLs</strong>{" "}
                eingetragen sein.
              </p>
              <a
                href={`https://app.supabase.com/project/bshuqljbanmphmjyicdc/auth/url-configuration`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-1 underline"
                style={{ color: "#3B82F6" }}
              >
                → Supabase URL-Config öffnen
              </a>
              <p className="mt-2">
                <a href="/api/health" target="_blank" className="underline" style={{ color: "#3B82F6" }}>
                  → Vollständige Diagnose (/api/health)
                </a>
              </p>
            </div>
          )}

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 mb-5"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Mit Google anmelden
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">oder</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* E-Mail + Passwort */}
          <form onSubmit={handleEmail} className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">E-Mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="deine@email.de"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Passwort</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 px-3 py-2.5 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "…" : mode === "login" ? "Anmelden" : "Konto erstellen"}
            </button>
          </form>

          {resetSent ? (
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg mt-4 text-center">
              ✓ Reset-Link wurde gesendet — bitte E-Mail prüfen.
            </p>
          ) : mode === "login" && (
            <p className="text-xs text-center mt-3">
              <button
                type="button"
                onClick={handleReset}
                disabled={loading}
                className="text-gray-400 hover:text-gray-600 underline underline-offset-2"
              >
                Passwort vergessen?
              </button>
            </p>
          )}

          <p className="text-xs text-center text-gray-400 mt-5">
            {mode === "login" ? (
              <>Noch kein Konto?{" "}
                <button onClick={() => setMode("register")} className="text-blue-600 hover:underline">
                  Registrieren
                </button>
              </>
            ) : (
              <>Bereits registriert?{" "}
                <button onClick={() => setMode("login")} className="text-blue-600 hover:underline">
                  Anmelden
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
