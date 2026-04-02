"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Lead, STATUS_LABELS, STATUS_COLORS } from "@/lib/types";
import Link from "next/link";

interface Activity {
  id: string;
  lead_id: string;
  activity_type: string;
  from_status: string | null;
  to_status: string | null;
  description: string | null;
  created_at: string;
}

const ACTIVITY_COLORS: Record<string, string> = {
  status_change: "bg-blue-100 text-blue-700",
  email_sent: "bg-green-100 text-green-700",
  email_draft: "bg-yellow-100 text-yellow-700",
  note: "bg-gray-100 text-gray-600",
  call: "bg-purple-100 text-purple-700",
  created: "bg-teal-100 text-teal-700",
};

function fmt(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString("de-DE") + " " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/leads/${id}`).then((r) => r.json()),
      fetch(`/api/leads/${id}/activities`).then((r) => r.json()),
    ]).then(([l, a]) => {
      setLead(l);
      setActivities(Array.isArray(a) ? a : []);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="p-8 text-sm text-gray-400">Laden...</div>;
  if (!lead) return <div className="p-8 text-sm text-red-500">Lead nicht gefunden.</div>;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/leads" className="text-sm text-gray-400 hover:text-gray-600">← Leads</Link>
        <span className="text-gray-200">/</span>
        <span className="text-sm text-gray-700 font-medium">{lead.first_name} {lead.last_name}</span>
      </div>

      {/* Lead-Daten */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">{lead.first_name} {lead.last_name}</h1>
            {lead.company_name && <p className="text-sm text-gray-500">{lead.company_name}</p>}
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[lead.status]}`}>
            {STATUS_LABELS[lead.status]}
          </span>
        </div>
        <div className="px-5 py-4 grid grid-cols-2 gap-4 text-sm">
          <Field label="E-Mail" value={lead.email} />
          <Field label="Telefon" value={lead.phone} />
          <Field label="Website" value={lead.website} />
          <Field label="Stadt" value={lead.city} />
          <Field label="Branche" value={lead.industry} />
          <Field label="Quelle" value={lead.source} />
          <Field label="Venture" value={lead.venture} />
          <Field label="Follow-up" value={lead.follow_up_date ? new Date(lead.follow_up_date).toLocaleDateString("de-DE") : null} />
          {lead.contact_reason && (
            <div className="col-span-2">
              <p className="text-xs text-gray-500 mb-1">Kontaktgrund</p>
              <p className="text-gray-700">{lead.contact_reason}</p>
            </div>
          )}
          {lead.notes && (
            <div className="col-span-2">
              <p className="text-xs text-gray-500 mb-1">Notizen</p>
              <p className="text-gray-700 whitespace-pre-wrap text-xs">{lead.notes}</p>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
          <button onClick={() => router.push(`/leads?edit=${id}`)}
            className="text-sm px-3 py-1.5 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50">
            Bearbeiten
          </button>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium">Aktivitäten</h2>
        </div>
        {activities.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">Noch keine Aktivitäten</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {activities.map((a) => (
              <div key={a.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${ACTIVITY_COLORS[a.activity_type] ?? "bg-gray-100 text-gray-600"}`}>
                      {a.activity_type}
                    </span>
                    <div>
                      {a.from_status && a.to_status && (
                        <p className="text-sm text-gray-700">
                          <span className="text-gray-400">{STATUS_LABELS[a.from_status as keyof typeof STATUS_LABELS] ?? a.from_status}</span>
                          {" → "}
                          <span className="font-medium">{STATUS_LABELS[a.to_status as keyof typeof STATUS_LABELS] ?? a.to_status}</span>
                        </p>
                      )}
                      {a.description && <p className="text-sm text-gray-600 mt-0.5">{a.description}</p>}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{fmt(a.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-gray-700">{value ?? "—"}</p>
    </div>
  );
}
