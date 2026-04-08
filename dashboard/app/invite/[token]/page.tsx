"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

const VENTURE_LABELS: Record<string, string> = {
  online_first: "Online First", blazed_outfitters: "Blazed Outfitters",
  brandary: "Brandary", droplane: "Droplane", worknest: "Worknest",
};
const ROLE_LABELS: Record<string, string> = {
  founder: "Founder", manager: "Manager", employee: "Mitarbeiter",
};
const SECTION_LABELS: Record<string, string> = {
  leads: "Leads", customers: "Kunden", orders: "Aufträge",
  products: "Produkte", drafts: "KI-Drafts", invoices: "Rechnungen", settings: "Einstellungen",
};
const PERM_LABELS: Record<string, string> = { edit: "Bearbeiten", view: "Lesen", none: "Kein Zugriff" };
const PERM_COLORS: Record<string, string> = {
  edit: "text-green-600", view: "text-blue-600", none: "text-gray-400",
};

interface InviteData {
  email: string;
  venture: string | null;
  role: string;
  permissions: Record<string, string>;
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("register");

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); }
        else { setInvite(data); setEmail(data.email); }
        setLoading(false);
      });
  }, [token]);

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    setAccepting(true);
    setError(null);

    // Login or register
    const { data, error: authError } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (authError || !data.user) {
      setError(authError?.message ?? "Fehler beim Anmelden");
      setAccepting(false);
      return;
    }

    // Accept invite
    const res = await fetch(`/api/invite/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: data.user.id }),
    });
    const result = await res.json();

    if (!res.ok) { setError(result.error); setAccepting(false); return; }
    router.push("/dashboard");
  }

  async function handleGoogleAccept() {
    setAccepting(true);
    // Store token in session storage so callback can use it
    sessionStorage.setItem("pending_invite_token", token);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/invite/${token}/complete` },
    });
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-sm text-gray-400">Laden...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-red-500 font-medium mb-2">{error}</p>
        <a href="/login" className="text-sm text-blue-600 hover:underline">Zum Login</a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Founder OS</h1>
          <p className="text-sm text-gray-500 mt-1">Du wurdest eingeladen</p>
        </div>

        {/* Einladungsdetails */}
        {invite && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-6 py-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-blue-800">
                {invite.venture ? VENTURE_LABELS[invite.venture] ?? invite.venture : "Alle Ventures"}
              </span>
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                {ROLE_LABELS[invite.role] ?? invite.role}
              </span>
            </div>
            <div className="space-y-1">
              {Object.entries(invite.permissions).map(([section, level]) => (
                level !== "none" && (
                  <div key={section} className="flex items-center justify-between text-xs">
                    <span className="text-blue-700">{SECTION_LABELS[section] ?? section}</span>
                    <span className={`font-medium ${PERM_COLORS[level] ?? ""}`}>{PERM_LABELS[level] ?? level}</span>
                  </div>
                )
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 px-8 py-7 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-5">Konto erstellen oder anmelden</h2>

          {/* Google */}
          <button onClick={handleGoogleAccept} disabled={accepting}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 mb-5">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Mit Google fortfahren
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">oder</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleAccept} className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">E-Mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Passwort</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <button type="submit" disabled={accepting}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {accepting ? "..." : mode === "register" ? "Konto erstellen & beitreten" : "Anmelden & beitreten"}
            </button>
          </form>

          <p className="text-xs text-center text-gray-400 mt-4">
            {mode === "register" ? (
              <>Bereits Konto?{" "}
                <button onClick={() => setMode("login")} className="text-blue-600 hover:underline">Anmelden</button>
              </>
            ) : (
              <>Noch kein Konto?{" "}
                <button onClick={() => setMode("register")} className="text-blue-600 hover:underline">Registrieren</button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
