"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  CONTACT_CHANNEL_LABELS,
  LEAD_POTENTIAL_LABELS,
  Lead,
  LeadContactChannel,
  LeadNextAction,
  LeadPotential,
  LeadReviewStatus,
  LeadSource,
  LeadStatus,
  NEXT_ACTION_LABELS,
  REVIEW_STATUS_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/types";
import SendMailModal from "@/components/SendMailModal";
import TasksPanel from "@/components/TasksPanel";
import NotesField from "@/components/NotesField";

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

const SOURCES: LeadSource[] = ["website", "linkedin", "empfehlung", "kaltakquise", "csv_import", "ki_suche"];
const ALL_STATUSES = Object.keys(STATUS_LABELS) as LeadStatus[];
const REVIEW_STATUSES = Object.keys(REVIEW_STATUS_LABELS) as LeadReviewStatus[];
const LEAD_POTENTIALS = Object.keys(LEAD_POTENTIAL_LABELS) as LeadPotential[];
const CONTACT_CHANNELS = Object.keys(CONTACT_CHANNEL_LABELS) as LeadContactChannel[];
const NEXT_ACTIONS = Object.keys(NEXT_ACTION_LABELS) as LeadNextAction[];

function fmt(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString("de-DE") + " " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', border: '1px solid #D1D5E8',
  borderRadius: '8px', fontSize: '13px', color: '#14193A',
  outline: 'none', boxSizing: 'border-box', background: '#F7F8FC',
};
const labelStyle: React.CSSProperties = {
  fontSize: '11px', color: '#6B7280', display: 'block', marginBottom: '4px',
  fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em',
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTags, setSelectedTags] = useState<{ id: string; name: string }[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showMailModal, setShowMailModal] = useState(false);

  // Kontaktdaten
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editIndustry, setEditIndustry] = useState("");
  const [editContactReason, setEditContactReason] = useState("");

  // Review
  const [editReviewNotes, setEditReviewNotes] = useState("");

  function load() {
    return Promise.all([
      fetch(`/api/leads/${id}`).then((r) => r.json()),
      fetch(`/api/leads/${id}/activities`).then((r) => r.json()),
    ]).then(([l, a]) => {
      setLead(l);
      setSelectedTags(l.tags ?? []);
      setActivities(Array.isArray(a) ? a : []);
      setEditFirst(l.first_name ?? "");
      setEditLast(l.last_name ?? "");
      setEditEmail(l.email ?? "");
      setEditPhone(l.phone ?? "");
      setEditCompany(l.company_name ?? "");
      setEditWebsite(l.website ?? "");
      setEditCity(l.city ?? "");
      setEditIndustry(l.industry ?? "");
      setEditContactReason(l.contact_reason ?? "");
      setEditReviewNotes(l.review_notes ?? "");
      setLoading(false);
    });
  }

  useEffect(() => { load(); }, [id]);

  async function patch(fields: Record<string, unknown>) {
    await fetch(`/api/leads/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
  }

  async function saveContactInfo() {
    setSaving(true);
    await patch({
      first_name: editFirst, last_name: editLast, email: editEmail,
      phone: editPhone || null, company_name: editCompany || null,
      website: editWebsite || null, city: editCity || null,
      industry: editIndustry || null, contact_reason: editContactReason || null,
    });
    setLead(prev => prev ? {
      ...prev, first_name: editFirst, last_name: editLast, email: editEmail,
      phone: editPhone || null, company_name: editCompany || null,
      website: editWebsite || null, city: editCity || null,
      industry: editIndustry || null, contact_reason: editContactReason || null,
    } : prev);
    setSaving(false);
  }

  async function saveField(field: string, value: unknown) {
    await patch({ [field]: value });
    setLead(prev => prev ? { ...prev, [field]: value } as Lead : prev);
  }

  async function saveReviewStatus(value: LeadReviewStatus) {
    await patch({ review_status: value, reviewed_at: value !== "unreviewed" ? new Date().toISOString() : null });
    setLead(prev => prev ? { ...prev, review_status: value } : prev);
  }

  async function saveTagIds(tagIds: string[]) {
    await patch({ tag_ids: tagIds });
  }

  async function saveNotes(notes: string) {
    await patch({ notes });
    setLead(prev => prev ? { ...prev, notes } : prev);
  }

  if (loading) return <div className="p-8 text-sm" style={{ color: '#6B7280' }}>Laden...</div>;
  if (!lead) return <div className="p-8 text-sm" style={{ color: '#EF4444' }}>Lead nicht gefunden.</div>;

  return (
    <div className="px-4 py-5 sm:p-8 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <Link href="/leads" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none' }}>← Leads</Link>
        <span style={{ color: '#D1D5E8' }}>/</span>
        <span style={{ fontSize: '13px', color: '#14193A', fontWeight: 500 }}>{lead.first_name} {lead.last_name}</span>
      </div>

      {/* Title */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: '28px', color: '#14193A', letterSpacing: '-0.02em', lineHeight: 1.2, margin: 0 }}>
            {lead.first_name} {lead.last_name}
          </h1>
          {lead.company_name && <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>{lead.company_name}</p>}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[lead.status]}`}>
            {STATUS_LABELS[lead.status]}
          </span>
          <button onClick={() => setShowMailModal(true)}
            style={{ fontSize: '13px', padding: '7px 14px', border: '1px solid #D1D5E8', borderRadius: '8px', color: '#14193A', background: '#FFFFFF', cursor: 'pointer' }}>
            E-Mail schreiben
          </button>
        </div>
      </div>

      {showMailModal && (
        <SendMailModal
          entityType="lead"
          entityId={id}
          venture={lead.venture}
          recipientEmail={lead.email}
          recipientName={`${lead.first_name} ${lead.last_name}`.trim()}
          vars={{
            vorname: lead.first_name ?? "",
            nachname: lead.last_name ?? "",
            firma: lead.company_name ?? "",
            email: lead.email ?? "",
          }}
          onClose={() => setShowMailModal(false)}
          onSent={load}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="lg:col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Kontaktdaten */}
          <Card title="Kontaktdaten" badge={lead.venture}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              {[
                { label: 'Vorname', value: editFirst, set: setEditFirst },
                { label: 'Nachname', value: editLast, set: setEditLast },
                { label: 'E-Mail', value: editEmail, set: setEditEmail, type: 'email' },
                { label: 'Telefon', value: editPhone, set: setEditPhone },
                { label: 'Firma', value: editCompany, set: setEditCompany },
                { label: 'Website', value: editWebsite, set: setEditWebsite },
                { label: 'Stadt', value: editCity, set: setEditCity },
                { label: 'Branche', value: editIndustry, set: setEditIndustry },
              ].map(({ label, value, set, type }) => (
                <div key={label}>
                  <label style={labelStyle}>{label}</label>
                  <input type={type ?? 'text'} value={value} onChange={e => set(e.target.value)} style={inputStyle}
                    onFocus={e => e.target.style.borderColor = '#1B2A5E'}
                    onBlur={e => e.target.style.borderColor = '#D1D5E8'} />
                </div>
              ))}
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Kontaktgrund</label>
              <input type="text" value={editContactReason} onChange={e => setEditContactReason(e.target.value)} style={inputStyle} />
            </div>
            <button onClick={saveContactInfo} disabled={saving}
              style={{ background: '#1B2A5E', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '13px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Speichert…' : 'Änderungen speichern'}
            </button>
          </Card>

          {/* Lead-Review */}
          <Card title="Lead-Review">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={labelStyle}>Review-Status</label>
                <select value={lead.review_status ?? "unreviewed"} onChange={e => saveReviewStatus(e.target.value as LeadReviewStatus)}
                  style={{ ...inputStyle, background: '#fff', cursor: 'pointer' }}>
                  {REVIEW_STATUSES.map(s => <option key={s} value={s}>{REVIEW_STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Potenzial</label>
                <select value={lead.lead_potential ?? ""} onChange={e => saveField("lead_potential", e.target.value || null)}
                  style={{ ...inputStyle, background: '#fff', cursor: 'pointer' }}>
                  <option value="">Noch nicht bewertet</option>
                  {LEAD_POTENTIALS.map(p => <option key={p} value={p}>{LEAD_POTENTIAL_LABELS[p]}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Kontaktweg</label>
                <select value={lead.contact_channel ?? "unchecked"} onChange={e => saveField("contact_channel", e.target.value)}
                  style={{ ...inputStyle, background: '#fff', cursor: 'pointer' }}>
                  {CONTACT_CHANNELS.map(c => <option key={c} value={c}>{CONTACT_CHANNEL_LABELS[c]}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Nächste Aktion</label>
                <select value={lead.next_action ?? "website_pruefen"} onChange={e => saveField("next_action", e.target.value)}
                  style={{ ...inputStyle, background: '#fff', cursor: 'pointer' }}>
                  {NEXT_ACTIONS.map(a => <option key={a} value={a}>{NEXT_ACTION_LABELS[a]}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Review-Notiz</label>
              <textarea value={editReviewNotes} onChange={e => setEditReviewNotes(e.target.value)}
                onBlur={() => saveField("review_notes", editReviewNotes || null)}
                rows={3} placeholder="Warum passt der Lead? Welcher Kontaktweg ist sauber? Was ist der nächste Schritt?"
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-sans)' }} />
            </div>
          </Card>

          {/* Tags */}
          <Card title="Stichwörter">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
              {selectedTags.map(tag => (
                <span key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', background: '#F3F4F6', borderRadius: '999px', padding: '2px 10px', color: '#374151' }}>
                  {tag.name}
                  <button onClick={async () => {
                    const updated = selectedTags.filter(t => t.id !== tag.id);
                    setSelectedTags(updated);
                    await saveTagIds(updated.map(t => t.id));
                  }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '13px', lineHeight: 1, padding: 0 }}>×</button>
                </span>
              ))}
            </div>
            <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
              placeholder="Tag + Enter" style={inputStyle}
              onKeyDown={async e => {
                if (e.key === "Enter" && tagInput.trim()) {
                  e.preventDefault();
                  const res = await fetch("/api/lead-tags", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ venture: lead.venture, name: tagInput.trim() }),
                  });
                  const tag = await res.json();
                  if (tag.id && !selectedTags.find(t => t.id === tag.id)) {
                    const updated = [...selectedTags, tag];
                    setSelectedTags(updated);
                    await saveTagIds(updated.map(t => t.id));
                  }
                  setTagInput("");
                }
              }} />
          </Card>

          {/* Activity Feed */}
          <Card title="Aktivitäten">
            {activities.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#6B7280', textAlign: 'center', padding: '16px 0', margin: 0 }}>Noch keine Aktivitäten</p>
            ) : (
              <div className="divide-y divide-gray-50" style={{ margin: '-20px', marginTop: '4px' }}>
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
          </Card>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Pipeline */}
          <Card title="Pipeline">
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Status</label>
              <select value={lead.status} onChange={e => saveField("status", e.target.value)}
                style={{ ...inputStyle, background: '#fff', cursor: 'pointer' }}>
                {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Quelle</label>
              <select value={lead.source} onChange={e => saveField("source", e.target.value)}
                style={{ ...inputStyle, background: '#fff', cursor: 'pointer' }}>
                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Follow-up-Datum</label>
              <input type="date" defaultValue={lead.follow_up_date ?? ""}
                onBlur={e => saveField("follow_up_date", e.target.value || null)}
                style={inputStyle} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', color: '#14193A' }}>KI-Automation</span>
              <button onClick={() => saveField("automation_enabled", !lead.automation_enabled)}
                style={{
                  position: 'relative', display: 'inline-flex', height: '20px', width: '36px', borderRadius: '999px',
                  border: 'none', cursor: 'pointer', background: lead.automation_enabled ? '#1B2A5E' : '#D1D5E8',
                }}>
                <span style={{
                  display: 'inline-block', height: '16px', width: '16px', marginTop: '2px', borderRadius: '999px',
                  background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'transform 0.15s',
                  transform: lead.automation_enabled ? 'translateX(18px)' : 'translateX(2px)',
                }} />
              </button>
            </div>
          </Card>

          {/* Meta */}
          <Card title="Details">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <MetaRow label="Erstellt" value={new Date(lead.created_at).toLocaleDateString('de-DE')} />
              {lead.email && <MetaRow label="E-Mail"><a href={`mailto:${lead.email}`} style={{ fontSize: '13px', color: '#3A5BA0', textDecoration: 'none' }}>{lead.email}</a></MetaRow>}
              {lead.phone && <MetaRow label="Telefon" value={lead.phone} />}
            </div>
          </Card>

          <TasksPanel entityType="lead" entityId={id} venture={lead.venture} />

          <NotesField value={lead.notes} onSave={saveNotes} />
        </div>
      </div>
    </div>
  );
}

/* ── Hilfs-Komponenten ────────────────────────────────────────────────── */
function Card({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #D1D5E8', borderRadius: '16px', boxShadow: '0 2px 12px rgba(27,42,94,0.08)', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: '16px', color: '#14193A', margin: 0 }}>{title}</h3>
        {badge && <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '999px', background: '#EEF0F7', color: '#1B2A5E', textTransform: 'capitalize' }}>{badge}</span>}
      </div>
      {children}
    </div>
  );
}

function MetaRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: '11px', color: '#6B7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      {children ?? <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#14193A' }}>{value}</p>}
    </div>
  );
}
