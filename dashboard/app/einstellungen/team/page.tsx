"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { SECTIONS, SECTION_LABELS, EMPLOYEE_DEFAULT_PERMISSIONS, type Permissions, type Section } from "@/lib/permissions";

const VENTURE_IDS = ["online_first", "blazed_outfitters", "brandary", "droplane", "worknest"];
const VENTURE_LABELS: Record<string, string> = {
  online_first: "Online First", blazed_outfitters: "Blazed Outfitters",
  brandary: "Brandary", droplane: "Droplane", worknest: "Worknest",
};
const ROLE_LABELS: Record<string, string> = {
  founder: "Founder", manager: "Manager", employee: "Mitarbeiter",
};
const ROLE_COLORS: Record<string, string> = {
  founder: "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  employee: "bg-gray-100 text-gray-600",
};

interface Member {
  id: string;
  user_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  venture: string | null;
  role: string;
  permissions: Permissions;
  created_at: string;
}

interface Invite {
  id: string;
  email: string;
  venture: string | null;
  role: string;
  permissions: Permissions;
  expires_at: string;
  created_at: string;
}

const PERM_LEVELS = ["edit", "view", "none"] as const;
const PERM_LABELS: Record<string, string> = { edit: "Bearbeiten", view: "Lesen", none: "Kein Zugriff" };

export default function TeamPage() {
  const { user, canEdit } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const [inviteForm, setInviteForm] = useState({
    email: "",
    venture: "",
    role: "employee",
    permissions: { ...EMPLOYEE_DEFAULT_PERMISSIONS },
  });

  async function load() {
    const data = await fetch("/api/team").then(r => r.json());
    setMembers(data.members ?? []);
    setInvites(data.invites ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function sendInvite() {
    if (!inviteForm.email) return;
    setSaving("invite");
    await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inviteForm.email,
        venture: inviteForm.venture || null,
        role: inviteForm.role,
        permissions: inviteForm.permissions,
      }),
    });
    setShowInvite(false);
    setInviteForm({ email: "", venture: "", role: "employee", permissions: { ...EMPLOYEE_DEFAULT_PERMISSIONS } });
    await load();
    setSaving(null);
  }

  async function updateMember() {
    if (!editMember) return;
    setSaving(editMember.id);
    await fetch(`/api/team/${editMember.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: editMember.role, permissions: editMember.permissions }),
    });
    setEditMember(null);
    await load();
    setSaving(null);
  }

  async function removeMember(id: string, name: string) {
    if (!confirm(`${name} wirklich entfernen?`)) return;
    await fetch(`/api/team/${id}`, { method: "DELETE" });
    await load();
  }

  function PermissionRow({ section, permissions, onChange }: {
    section: Section;
    permissions: Permissions;
    onChange: (s: Section, v: string) => void;
  }) {
    return (
      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-gray-700">{SECTION_LABELS[section]}</span>
        <div className="flex gap-1">
          {PERM_LEVELS.map(level => (
            <button key={level}
              onClick={() => onChange(section, level)}
              className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                permissions[section] === level
                  ? level === "edit" ? "bg-blue-600 text-white border-blue-600"
                  : level === "view" ? "bg-gray-200 text-gray-700 border-gray-300"
                  : "bg-red-100 text-red-600 border-red-200"
                  : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
              }`}>
              {PERM_LABELS[level]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Laden...</div>;
  if (!canEdit("settings")) return <div className="p-8 text-sm text-red-500">Kein Zugriff.</div>;

  return (
    <div className="px-4 py-5 sm:p-8 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Team</h1>
          <p className="text-sm text-gray-500 mt-1">Mitarbeiter einladen und Berechtigungen verwalten.</p>
        </div>
        <button onClick={() => setShowInvite(true)}
          className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors">
          + Einladen
        </button>
      </div>

      {/* Einladungsformular */}
      {showInvite && (
        <div className="bg-white rounded-xl border border-blue-200 px-6 py-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Neuer Mitarbeiter</h2>
            <button onClick={() => setShowInvite(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-3 sm:col-span-1">
              <label className="text-xs text-gray-500 block mb-1">E-Mail *</label>
              <input type="email" value={inviteForm.email}
                onChange={e => setInviteForm(p => ({ ...p, email: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Venture</label>
              <select value={inviteForm.venture}
                onChange={e => setInviteForm(p => ({ ...p, venture: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 bg-white focus:outline-none">
                <option value="">— alle —</option>
                {VENTURE_IDS.map(v => <option key={v} value={v}>{VENTURE_LABELS[v]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Rolle</label>
              <select value={inviteForm.role}
                onChange={e => {
                  const role = e.target.value;
                  setInviteForm(p => ({
                    ...p, role,
                    permissions: role === "manager"
                      ? Object.fromEntries(SECTIONS.map(s => [s, s === "settings" ? "none" : "edit"])) as Permissions
                      : { ...EMPLOYEE_DEFAULT_PERMISSIONS },
                  }));
                }}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 bg-white focus:outline-none">
                <option value="manager">Manager</option>
                <option value="employee">Mitarbeiter</option>
              </select>
            </div>
          </div>

          {/* Bereichs-Berechtigungen */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Bereichszugriff</p>
            <div className="border border-gray-100 rounded-lg px-4 divide-y divide-gray-50">
              {SECTIONS.map(s => (
                <PermissionRow key={s} section={s} permissions={inviteForm.permissions}
                  onChange={(section, val) => setInviteForm(p => ({
                    ...p, permissions: { ...p.permissions, [section]: val as any }
                  }))} />
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={sendInvite} disabled={!inviteForm.email || saving === "invite"}
              className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors">
              {saving === "invite" ? "Wird gesendet..." : "Einladung senden"}
            </button>
            <button onClick={() => setShowInvite(false)}
              className="text-sm px-4 py-2 text-gray-500 hover:text-gray-700">Abbrechen</button>
          </div>
        </div>
      )}

      {/* Bestehende Mitglieder */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Aktive Mitglieder</h2>
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
          {members.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-gray-400">Noch keine Mitglieder</div>
          )}
          {members.map(m => (
            <div key={m.id}>
              <div className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt={m.name} className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-500">
                      {(m.name || m.email).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-800">{m.name || m.email}</p>
                    <p className="text-xs text-gray-400">{m.email}</p>
                    {m.venture && <p className="text-xs text-gray-400">{VENTURE_LABELS[m.venture] ?? m.venture}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[m.role] ?? "bg-gray-100 text-gray-600"}`}>
                    {ROLE_LABELS[m.role] ?? m.role}
                  </span>
                  {m.role !== "founder" && (
                    <>
                      <button onClick={() => setEditMember(editMember?.id === m.id ? null : m)}
                        className="text-xs text-gray-400 hover:text-gray-600">
                        {editMember?.id === m.id ? "Schließen" : "Bearbeiten"}
                      </button>
                      <button onClick={() => removeMember(m.id, m.name || m.email)}
                        className="text-xs text-red-400 hover:text-red-600">Entfernen</button>
                    </>
                  )}
                </div>
              </div>

              {/* Inline-Editor */}
              {editMember?.id === m.id && (
                <div className="px-5 pb-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Rolle</label>
                      <select value={editMember.role}
                        onChange={e => setEditMember(p => p ? { ...p, role: e.target.value } : null)}
                        className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white">
                        <option value="manager">Manager</option>
                        <option value="employee">Mitarbeiter</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Bereichszugriff</p>
                    <div className="border border-gray-100 rounded-lg px-4 divide-y divide-gray-50">
                      {SECTIONS.map(s => (
                        <div key={s} className="flex items-center justify-between py-2">
                          <span className="text-sm text-gray-700">{SECTION_LABELS[s]}</span>
                          <div className="flex gap-1">
                            {PERM_LEVELS.map(level => (
                              <button key={level}
                                onClick={() => setEditMember(p => p ? {
                                  ...p, permissions: { ...p.permissions, [s]: level }
                                } : null)}
                                className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                                  editMember.permissions[s] === level
                                    ? level === "edit" ? "bg-blue-600 text-white border-blue-600"
                                    : level === "view" ? "bg-gray-200 text-gray-700 border-gray-300"
                                    : "bg-red-100 text-red-600 border-red-200"
                                    : "bg-white text-gray-400 border-gray-200 hover:border-gray-300"
                                }`}>
                                {PERM_LABELS[level]}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={updateMember} disabled={saving === editMember.id}
                      className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                      {saving === editMember.id ? "..." : "Speichern"}
                    </button>
                    <button onClick={() => setEditMember(null)} className="text-sm text-gray-400 hover:text-gray-600">Abbrechen</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Offene Einladungen */}
      {invites.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Offene Einladungen</h2>
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
            {invites.map(inv => (
              <div key={inv.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-gray-800">{inv.email}</p>
                  <p className="text-xs text-gray-400">
                    {inv.venture ? VENTURE_LABELS[inv.venture] : "Alle Ventures"} ·{" "}
                    {ROLE_LABELS[inv.role] ?? inv.role} ·{" "}
                    Läuft ab: {new Date(inv.expires_at).toLocaleDateString("de-DE")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      setSaving(`resend_${inv.id}`);
                      const res = await fetch("/api/team/resend-invite", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ invite_id: inv.id }),
                      });
                      const data = await res.json();
                      if (res.ok) {
                        alert(`✓ Einladung erneut gesendet an ${inv.email}`);
                        await load();
                      } else {
                        alert(`Fehler: ${data.error}`);
                      }
                      setSaving(null);
                    }}
                    disabled={saving === `resend_${inv.id}`}
                    className="text-xs px-2.5 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {saving === `resend_${inv.id}` ? "Sendet..." : "Erneut senden"}
                  </button>
                  <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium">Ausstehend</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
