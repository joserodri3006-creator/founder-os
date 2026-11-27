import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

type AuthorizationDetails = {
  authorization_id?: string;
  redirect_url?: string;
  redirect_uri?: string;
  scope?: string;
  client?: { name?: string };
};

export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>;
}) {
  const { authorization_id: authorizationId } = await searchParams;
  if (!authorizationId) {
    return <ConsentError message="Die Autorisierungs-ID fehlt." />;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const next = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data) {
    return <ConsentError message={error?.message ?? "Die Autorisierungsanfrage ist ungültig."} />;
  }

  const details = data as AuthorizationDetails;
  if (!details.authorization_id && details.redirect_url) {
    redirect(details.redirect_url);
  }

  const scopes = details.scope?.split(" ").filter(Boolean) ?? [];

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <section className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Founder OS</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">KI-Zugriff freigeben</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          <strong>{details.client?.name ?? "Eine KI-Anwendung"}</strong> möchte im Namen deines
          Founder-OS-Benutzers auf die für dich freigegebenen Venture-Daten zugreifen.
        </p>

        <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p><strong>Angemeldet als:</strong> {user.email}</p>
          <p className="mt-1"><strong>Datenbereich:</strong> ausschließlich Blazed Outfitters</p>
          {details.redirect_uri && (
            <p className="mt-1 break-all text-xs text-gray-500"><strong>Rücksprung:</strong> {details.redirect_uri}</p>
          )}
          {scopes.length > 0 && (
            <div className="mt-3">
              <strong>Angeforderte Berechtigungen:</strong>
              <ul className="mt-1 list-disc pl-5">
                {scopes.map((scope) => <li key={scope}>{scope}</li>)}
              </ul>
            </div>
          )}
        </div>

        <form action="/api/oauth/decision" method="post" className="mt-6 flex gap-3">
          <input type="hidden" name="authorization_id" value={authorizationId} />
          <button
            type="submit"
            name="decision"
            value="approve"
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Zugriff erlauben
          </button>
          <button
            type="submit"
            name="decision"
            value="deny"
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Ablehnen
          </button>
        </form>
      </section>
    </main>
  );
}

function ConsentError({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">Freigabe nicht möglich</h1>
        <p className="mt-3 text-sm text-red-700">{message}</p>
      </div>
    </main>
  );
}
