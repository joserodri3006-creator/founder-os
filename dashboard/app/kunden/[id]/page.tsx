"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import NotesField from "@/components/NotesField";
import AttachmentsPanel from "@/components/AttachmentsPanel";

interface Order {
  id: string;
  title: string;
  value: number | null;
  status: string;
  invoice_number: string | null;
  created_at: string;
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  street: string | null;
  postal_code: string | null;
  country: string | null;
  venture: string | null;
  notes: string | null;
  created_at: string;
  orders: Order[];
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  neu: "Neu",
  briefing: "Briefing",
  in_bearbeitung: "In Bearbeitung",
  in_produktion: "In Produktion",
  review: "Review",
  abgeschlossen: "Abgeschlossen",
  nachbetreuung: "Nachbetreuung",
  storniert: "Storniert",
  pausiert: "Pausiert",
  angebot_gesendet: "Angebot gesendet",
};

const ORDER_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  neu: { bg: '#DBEAFE', color: '#1D4ED8' },
  briefing: { bg: '#CFFAFE', color: '#0E7490' },
  in_bearbeitung: { bg: '#FEF9C3', color: '#A16207' },
  in_produktion: { bg: '#FFEDD5', color: '#C2410C' },
  review: { bg: '#F3E8FF', color: '#7E22CE' },
  abgeschlossen: { bg: '#DCFCE7', color: '#15803D' },
  nachbetreuung: { bg: '#CCFBF1', color: '#0F766E' },
  storniert: { bg: '#FEE2E2', color: '#B91C1C' },
  pausiert: { bg: '#F3F4F6', color: '#4B5563' },
  angebot_gesendet: { bg: '#E0E7FF', color: '#3730A3' },
};

export default function KundeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editStreet, setEditStreet] = useState("");
  const [editPostal, setEditPostal] = useState("");
  const [editCountry, setEditCountry] = useState("");

  async function load() {
    const res = await fetch(`/api/kunden/${id}`);
    if (!res.ok) { setLoading(false); return; }
    const data: Customer = await res.json();
    setCustomer(data);
    setEditFirst(data.first_name ?? "");
    setEditLast(data.last_name ?? "");
    setEditCompany(data.company_name ?? "");
    setEditEmail(data.email ?? "");
    setEditPhone(data.phone ?? "");
    setEditCity(data.city ?? "");
    setEditStreet(data.street ?? "");
    setEditPostal(data.postal_code ?? "");
    setEditCountry(data.country ?? "");
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function saveInfo() {
    setSaving(true);
    const res = await fetch(`/api/kunden/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: editFirst,
        last_name: editLast,
        company_name: editCompany || null,
        email: editEmail || null,
        phone: editPhone || null,
        city: editCity || null,
        street: editStreet || null,
        postal_code: editPostal || null,
        country: editCountry || null,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setCustomer(prev => prev ? { ...prev, ...updated } : null);
    }
    setSaving(false);
  }

  async function saveNotes(notes: string) {
    await fetch(`/api/kunden/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    setCustomer(prev => prev ? { ...prev, notes } : null);
  }

  if (loading) return <div className="p-8 text-sm" style={{ color: '#6B7280' }}>Laden...</div>;
  if (!customer) return <div className="p-8 text-sm" style={{ color: '#EF4444' }}>Kunde nicht gefunden.</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <Link href="/kunden" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none' }}>← Kunden</Link>
        <span style={{ color: '#D1D5E8' }}>/</span>
        <span style={{ fontSize: '13px', color: '#14193A', fontWeight: 500 }}>{customer.first_name} {customer.last_name}</span>
      </div>

      {/* Page Title */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: '28px', color: '#14193A', letterSpacing: '-0.02em', lineHeight: 1.2, margin: 0 }}>
          {customer.first_name} {customer.last_name}
        </h1>
        {customer.company_name && (
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>{customer.company_name}</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left column */}
        <div className="col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Customer Info Card */}
          <div style={{ background: '#FFFFFF', border: '1px solid #D1D5E8', borderRadius: '16px', boxShadow: '0 2px 12px rgba(27,42,94,0.08)', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: '16px', color: '#14193A', margin: 0 }}>Kundendaten</h3>
              {customer.venture && (
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '999px', background: '#EEF0F7', color: '#1B2A5E', textTransform: 'capitalize' }}>
                  {customer.venture}
                </span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              {[
                { label: 'Vorname', value: editFirst, set: setEditFirst },
                { label: 'Nachname', value: editLast, set: setEditLast },
                { label: 'Unternehmen', value: editCompany, set: setEditCompany },
                { label: 'E-Mail', value: editEmail, set: setEditEmail, type: 'email' },
                { label: 'Telefon', value: editPhone, set: setEditPhone },
                { label: 'Stadt', value: editCity, set: setEditCity },
                { label: 'Straße', value: editStreet, set: setEditStreet },
                { label: 'PLZ', value: editPostal, set: setEditPostal },
                { label: 'Land', value: editCountry, set: setEditCountry },
              ].map(({ label, value, set, type }) => (
                <div key={label}>
                  <label style={{ fontSize: '11px', color: '#6B7280', display: 'block', marginBottom: '4px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
                  <input
                    type={type ?? 'text'}
                    value={value}
                    onChange={e => set(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5E8', borderRadius: '8px', fontSize: '13px', color: '#14193A', outline: 'none', boxSizing: 'border-box', background: '#F7F8FC' }}
                    onFocus={e => e.target.style.borderColor = '#1B2A5E'}
                    onBlur={e => e.target.style.borderColor = '#D1D5E8'}
                  />
                </div>
              ))}
            </div>
            <button
              onClick={saveInfo}
              disabled={saving}
              style={{ background: '#1B2A5E', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '13px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Speichert…' : 'Änderungen speichern'}
            </button>
          </div>

          {/* Orders */}
          <div style={{ background: '#FFFFFF', border: '1px solid #D1D5E8', borderRadius: '16px', boxShadow: '0 2px 12px rgba(27,42,94,0.08)', padding: '20px' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: '16px', color: '#14193A', margin: '0 0 16px' }}>
              Aufträge {customer.orders?.length > 0 && <span style={{ fontSize: '13px', color: '#6B7280', fontFamily: 'var(--font-sans)' }}>({customer.orders.length})</span>}
            </h3>
            {!customer.orders || customer.orders.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#6B7280', textAlign: 'center', padding: '16px 0', margin: 0 }}>Keine Aufträge</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {customer.orders.map(order => {
                  const statusStyle = ORDER_STATUS_COLORS[order.status] ?? { bg: '#F3F4F6', color: '#4B5563' };
                  return (
                    <Link
                      key={order.id}
                      href={`/auftraege/${order.id}`}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F7F8FC', borderRadius: '10px', border: '1px solid #EEF0F7', textDecoration: 'none', transition: 'border-color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = '#D1D5E8'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = '#EEF0F7'}
                    >
                      <div>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#14193A' }}>{order.title}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#6B7280' }}>
                          {new Date(order.created_at).toLocaleDateString('de-DE')}
                          {order.invoice_number && ` · ${order.invoice_number}`}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {order.value != null && (
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#C8A96E' }}>{order.value.toLocaleString('de-DE')} €</span>
                        )}
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: statusStyle.bg, color: statusStyle.color }}>
                          {ORDER_STATUS_LABELS[order.status] ?? order.status}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Meta info */}
          <div style={{ background: '#FFFFFF', border: '1px solid #D1D5E8', borderRadius: '16px', boxShadow: '0 2px 12px rgba(27,42,94,0.08)', padding: '20px' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: '16px', color: '#14193A', margin: '0 0 12px' }}>Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <p style={{ margin: 0, fontSize: '11px', color: '#6B7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Erstellt</p>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#14193A' }}>{new Date(customer.created_at).toLocaleDateString('de-DE')}</p>
              </div>
              {customer.email && (
                <div>
                  <p style={{ margin: 0, fontSize: '11px', color: '#6B7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>E-Mail</p>
                  <a href={`mailto:${customer.email}`} style={{ fontSize: '13px', color: '#3A5BA0', textDecoration: 'none' }}>{customer.email}</a>
                </div>
              )}
              {customer.phone && (
                <div>
                  <p style={{ margin: 0, fontSize: '11px', color: '#6B7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Telefon</p>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#14193A' }}>{customer.phone}</p>
                </div>
              )}
            </div>
          </div>

          <NotesField value={customer.notes} onSave={saveNotes} />
          <AttachmentsPanel entityType="customer" entityId={id} venture={customer.venture ?? undefined} />
        </div>
      </div>
    </div>
  );
}
