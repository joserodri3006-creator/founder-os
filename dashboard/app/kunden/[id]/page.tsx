"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import NotesField from "@/components/NotesField";
import AttachmentsPanel from "@/components/AttachmentsPanel";
import { CustomerTypeBadge, CustomerStatusBadge } from "@/app/kunden/page";

interface Order {
  id: string;
  title: string;
  value: number | null;
  status: string;
  invoice_number: string | null;
  created_at: string;
}

interface CategoryDiscount {
  id: string;
  discount_rate: number;
  category_id: string;
  product_categories: { id: string; name: string; path: string; level: number } | null;
}

interface ProductDiscount {
  id: string;
  discount_rate: number;
  product_id: string;
  products: { id: string; name: string; sku: string | null } | null;
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
  customer_type: "b2c" | "b2b" | null;
  status: "active" | "pending" | "inactive" | null;
  discount_rate: number | null;
  created_at: string;
  orders: Order[];
}

interface Category { id: string; name: string; path: string; level: number; }
interface Product  { id: string; name: string; sku: string | null; }

const ORDER_STATUS_LABELS: Record<string, string> = {
  neu: "Neu", briefing: "Briefing", in_bearbeitung: "In Bearbeitung",
  in_produktion: "In Produktion", review: "Review", abgeschlossen: "Abgeschlossen",
  nachbetreuung: "Nachbetreuung", storniert: "Storniert", pausiert: "Pausiert",
  angebot_gesendet: "Angebot gesendet",
};
const ORDER_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  neu: { bg: '#DBEAFE', color: '#1D4ED8' }, briefing: { bg: '#CFFAFE', color: '#0E7490' },
  in_bearbeitung: { bg: '#FEF9C3', color: '#A16207' }, in_produktion: { bg: '#FFEDD5', color: '#C2410C' },
  review: { bg: '#F3E8FF', color: '#7E22CE' }, abgeschlossen: { bg: '#DCFCE7', color: '#15803D' },
  nachbetreuung: { bg: '#CCFBF1', color: '#0F766E' }, storniert: { bg: '#FEE2E2', color: '#B91C1C' },
  pausiert: { bg: '#F3F4F6', color: '#4B5563' }, angebot_gesendet: { bg: '#E0E7FF', color: '#3730A3' },
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', border: '1px solid #D1D5E8',
  borderRadius: '8px', fontSize: '13px', color: '#14193A',
  outline: 'none', boxSizing: 'border-box', background: '#F7F8FC',
};
const labelStyle: React.CSSProperties = {
  fontSize: '11px', color: '#6B7280', display: 'block', marginBottom: '4px',
  fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em',
};

export default function KundeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer]   = useState<Customer | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);

  // Kontaktfelder
  const [editFirst, setEditFirst]     = useState("");
  const [editLast, setEditLast]       = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editEmail, setEditEmail]     = useState("");
  const [editPhone, setEditPhone]     = useState("");
  const [editCity, setEditCity]       = useState("");
  const [editStreet, setEditStreet]   = useState("");
  const [editPostal, setEditPostal]   = useState("");
  const [editCountry, setEditCountry] = useState("");

  // B2B-Felder
  const [editType, setEditType]         = useState<"b2c" | "b2b">("b2c");
  const [editStatus, setEditStatus]     = useState<"active" | "pending" | "inactive">("active");
  const [editDiscount, setEditDiscount] = useState<string>("0");

  // B2B-Rabatte
  const [catDiscounts, setCatDiscounts]   = useState<CategoryDiscount[]>([]);
  const [prodDiscounts, setProdDiscounts] = useState<ProductDiscount[]>([]);
  const [categories, setCategories]       = useState<Category[]>([]);
  const [products, setProducts]           = useState<Product[]>([]);
  const [newCatId, setNewCatId]           = useState("");
  const [newCatRate, setNewCatRate]       = useState("10");
  const [newProdId, setNewProdId]         = useState("");
  const [newProdRate, setNewProdRate]     = useState("10");
  const [discountSaving, setDiscountSaving] = useState(false);

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
    setEditType((data.customer_type as "b2c" | "b2b") ?? "b2c");
    setEditStatus((data.status as "active" | "pending" | "inactive") ?? "active");
    setEditDiscount(String(data.discount_rate ?? 0));
    setLoading(false);
  }

  async function loadDiscounts() {
    const res = await fetch(`/api/kunden/${id}/b2b-rabatte`);
    if (!res.ok) return;
    const data = await res.json();
    setCatDiscounts(data.category_discounts ?? []);
    setProdDiscounts(data.product_discounts ?? []);
  }

  async function loadCategoriesAndProducts(venture: string) {
    const [catRes, prodRes] = await Promise.all([
      fetch(`/api/produkt-kategorien?venture=${venture}`),
      fetch(`/api/produkte?venture=${venture}&limit=200`),
    ]);
    if (catRes.ok)  setCategories(await catRes.json());
    if (prodRes.ok) {
      const d = await prodRes.json();
      setProducts(Array.isArray(d) ? d : (d.data ?? []));
    }
  }

  useEffect(() => {
    load().then(() => loadDiscounts());
  }, [id]);

  useEffect(() => {
    if (customer?.venture && editType === "b2b") {
      loadCategoriesAndProducts(customer.venture);
    }
  }, [customer?.venture, editType]);

  async function saveInfo() {
    setSaving(true);
    const res = await fetch(`/api/kunden/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: editFirst, last_name: editLast,
        company_name: editCompany || null, email: editEmail || null,
        phone: editPhone || null, city: editCity || null,
        street: editStreet || null, postal_code: editPostal || null,
        country: editCountry || null,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setCustomer(prev => prev ? { ...prev, ...updated } : null);
    }
    setSaving(false);
  }

  async function saveB2BField(field: string, value: unknown) {
    const res = await fetch(`/api/kunden/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) setCustomer(prev => prev ? { ...prev, [field]: value } : null);
  }

  async function addCategoryDiscount() {
    if (!newCatId || !newCatRate) return;
    setDiscountSaving(true);
    await fetch(`/api/kunden/${id}/b2b-rabatte`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'category', ref_id: newCatId, discount_rate: parseFloat(newCatRate), venture: customer?.venture }),
    });
    await loadDiscounts();
    setNewCatId(""); setNewCatRate("10");
    setDiscountSaving(false);
  }

  async function addProductDiscount() {
    if (!newProdId || !newProdRate) return;
    setDiscountSaving(true);
    await fetch(`/api/kunden/${id}/b2b-rabatte`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'product', ref_id: newProdId, discount_rate: parseFloat(newProdRate), venture: customer?.venture }),
    });
    await loadDiscounts();
    setNewProdId(""); setNewProdRate("10");
    setDiscountSaving(false);
  }

  async function removeDiscount(type: 'category' | 'product', discount_id: string) {
    await fetch(`/api/kunden/${id}/b2b-rabatte`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, discount_id }),
    });
    await loadDiscounts();
  }

  async function saveNotes(notes: string) {
    await fetch(`/api/kunden/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes }) });
    setCustomer(prev => prev ? { ...prev, notes } : null);
  }

  if (loading) return <div className="p-8 text-sm" style={{ color: '#6B7280' }}>Laden...</div>;
  if (!customer) return <div className="p-8 text-sm" style={{ color: '#EF4444' }}>Kunde nicht gefunden.</div>;

  const isB2B = editType === "b2b";

  return (
    <div className="px-4 py-5 sm:p-8 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <Link href="/kunden" style={{ fontSize: '13px', color: '#6B7280', textDecoration: 'none' }}>← Kunden</Link>
        <span style={{ color: '#D1D5E8' }}>/</span>
        <span style={{ fontSize: '13px', color: '#14193A', fontWeight: 500 }}>{customer.first_name} {customer.last_name}</span>
      </div>

      {/* Title */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: '28px', color: '#14193A', letterSpacing: '-0.02em', lineHeight: 1.2, margin: 0 }}>
            {customer.first_name} {customer.last_name}
          </h1>
          {customer.company_name && <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px' }}>{customer.company_name}</p>}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <CustomerTypeBadge type={editType} />
          <CustomerStatusBadge status={editStatus} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="lg:col-span-2" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Kontaktdaten */}
          <Card title="Kundendaten" badge={customer.venture ?? undefined}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              {[
                { label: 'Vorname',   value: editFirst,   set: setEditFirst },
                { label: 'Nachname',  value: editLast,    set: setEditLast },
                { label: 'Unternehmen', value: editCompany, set: setEditCompany },
                { label: 'E-Mail',    value: editEmail,   set: setEditEmail,   type: 'email' },
                { label: 'Telefon',   value: editPhone,   set: setEditPhone },
                { label: 'Stadt',     value: editCity,    set: setEditCity },
                { label: 'Straße',    value: editStreet,  set: setEditStreet },
                { label: 'PLZ',       value: editPostal,  set: setEditPostal },
                { label: 'Land',      value: editCountry, set: setEditCountry },
              ].map(({ label, value, set, type }) => (
                <div key={label}>
                  <label style={labelStyle}>{label}</label>
                  <input type={type ?? 'text'} value={value} onChange={e => set(e.target.value)} style={inputStyle}
                    onFocus={e => e.target.style.borderColor = '#1B2A5E'}
                    onBlur={e => e.target.style.borderColor = '#D1D5E8'} />
                </div>
              ))}
            </div>
            <button onClick={saveInfo} disabled={saving} style={{ background: '#1B2A5E', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '13px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Speichert…' : 'Änderungen speichern'}
            </button>
          </Card>

          {/* B2B-Rabatte — nur wenn b2b */}
          {isB2B && (
            <Card title="Rabatte">
              {/* Kategorie-Rabatte */}
              <div style={{ marginBottom: '20px' }}>
                <SectionLabel>Kategorierabatte</SectionLabel>
                {catDiscounts.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '0 0 8px' }}>Keine Kategorierabatte hinterlegt</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                    {catDiscounts.map(d => (
                      <DiscountRow
                        key={d.id}
                        label={d.product_categories?.name ?? d.category_id}
                        sub={d.product_categories?.path}
                        rate={d.discount_rate}
                        onDelete={() => removeDiscount('category', d.id)}
                      />
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '140px' }}>
                    <label style={labelStyle}>Kategorie</label>
                    <select value={newCatId} onChange={e => setNewCatId(e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
                      <option value="">Wählen…</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{"  ".repeat(c.level - 1)}{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ width: '90px' }}>
                    <label style={labelStyle}>Rabatt %</label>
                    <input type="number" min="0" max="100" step="0.5" value={newCatRate} onChange={e => setNewCatRate(e.target.value)} style={inputStyle} />
                  </div>
                  <button onClick={addCategoryDiscount} disabled={discountSaving || !newCatId} style={{ padding: '7px 14px', background: '#1B2A5E', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', opacity: !newCatId ? 0.4 : 1 }}>
                    + Hinzufügen
                  </button>
                </div>
              </div>

              <div style={{ height: '1px', background: '#EEF0F7', margin: '4px 0 20px' }} />

              {/* Produkt-Rabatte */}
              <div>
                <SectionLabel>Produktrabatte</SectionLabel>
                {prodDiscounts.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '0 0 8px' }}>Keine Produktrabatte hinterlegt</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                    {prodDiscounts.map(d => (
                      <DiscountRow
                        key={d.id}
                        label={d.products?.name ?? d.product_id}
                        sub={d.products?.sku ? `SKU: ${d.products.sku}` : undefined}
                        rate={d.discount_rate}
                        onDelete={() => removeDiscount('product', d.id)}
                      />
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '140px' }}>
                    <label style={labelStyle}>Produkt</label>
                    <select value={newProdId} onChange={e => setNewProdId(e.target.value)} style={{ ...inputStyle, background: '#fff' }}>
                      <option value="">Wählen…</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ width: '90px' }}>
                    <label style={labelStyle}>Rabatt %</label>
                    <input type="number" min="0" max="100" step="0.5" value={newProdRate} onChange={e => setNewProdRate(e.target.value)} style={inputStyle} />
                  </div>
                  <button onClick={addProductDiscount} disabled={discountSaving || !newProdId} style={{ padding: '7px 14px', background: '#1B2A5E', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', opacity: !newProdId ? 0.4 : 1 }}>
                    + Hinzufügen
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* Aufträge */}
          <Card title={`Aufträge${customer.orders?.length > 0 ? ` (${customer.orders.length})` : ''}`}>
            {!customer.orders || customer.orders.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#6B7280', textAlign: 'center', padding: '16px 0', margin: 0 }}>Keine Aufträge</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {customer.orders.map(order => {
                  const s = ORDER_STATUS_COLORS[order.status] ?? { bg: '#F3F4F6', color: '#4B5563' };
                  return (
                    <Link key={order.id} href={`/auftraege/${order.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F7F8FC', borderRadius: '10px', border: '1px solid #EEF0F7', textDecoration: 'none' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#14193A' }}>{order.title}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#6B7280' }}>
                          {new Date(order.created_at).toLocaleDateString('de-DE')}
                          {order.invoice_number && ` · ${order.invoice_number}`}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {order.value != null && <span style={{ fontSize: '13px', fontWeight: 600, color: '#C8A96E' }}>{order.value.toLocaleString('de-DE')} €</span>}
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: s.bg, color: s.color }}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* B2B-Status Card */}
          <Card title="Kundenprofil">
            {/* Kundentyp */}
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Kundentyp</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(["b2c", "b2b"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => { setEditType(t); saveB2BField("customer_type", t); }}
                    style={{
                      flex: 1, padding: '7px 0', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                      border: editType === t ? '2px solid #1B2A5E' : '1.5px solid #D1D5E8',
                      background: editType === t ? '#EEF0F7' : 'transparent',
                      color: editType === t ? '#1B2A5E' : '#6B7280',
                      cursor: 'pointer', textTransform: 'uppercase',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Status</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {([
                  { value: 'active',   label: 'Aktiv',       color: '#15803D', bg: 'rgba(22,163,74,0.08)' },
                  { value: 'pending',  label: 'Ausstehend',  color: '#C2410C', bg: 'rgba(234,88,12,0.08)' },
                  { value: 'inactive', label: 'Inaktiv',     color: '#4B5563', bg: 'rgba(107,114,128,0.08)' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setEditStatus(opt.value); saveB2BField("status", opt.value); }}
                    style={{
                      padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
                      textAlign: 'left',
                      border: editStatus === opt.value ? `2px solid ${opt.color}` : '1.5px solid #D1D5E8',
                      background: editStatus === opt.value ? opt.bg : 'transparent',
                      color: editStatus === opt.value ? opt.color : '#6B7280',
                      cursor: 'pointer',
                    }}
                  >
                    {editStatus === opt.value && '✓ '}{opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Globaler Rabatt */}
            <div>
              <label style={labelStyle}>Globaler Rabatt (%)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number" min="0" max="100" step="0.5"
                  value={editDiscount}
                  onChange={e => setEditDiscount(e.target.value)}
                  style={{ ...inputStyle, width: '100px' }}
                  onFocus={e => e.target.style.borderColor = '#1B2A5E'}
                  onBlur={e => { e.target.style.borderColor = '#D1D5E8'; saveB2BField("discount_rate", parseFloat(editDiscount) || 0); }}
                />
                <span style={{ fontSize: '13px', color: '#6B7280', alignSelf: 'center' }}>% auf alle Produkte</span>
              </div>
              {parseFloat(editDiscount) > 0 && (
                <p style={{ fontSize: '11px', color: '#C8A96E', marginTop: '4px', fontWeight: 500 }}>
                  ✓ {editDiscount}% Rabatt aktiv
                </p>
              )}
            </div>
          </Card>

          {/* Meta */}
          <Card title="Details">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <MetaRow label="Erstellt" value={new Date(customer.created_at).toLocaleDateString('de-DE')} />
              {customer.email && <MetaRow label="E-Mail"><a href={`mailto:${customer.email}`} style={{ fontSize: '13px', color: '#3A5BA0', textDecoration: 'none' }}>{customer.email}</a></MetaRow>}
              {customer.phone && <MetaRow label="Telefon" value={customer.phone} />}
            </div>
          </Card>

          <NotesField value={customer.notes} onSave={saveNotes} />
          <AttachmentsPanel entityType="customer" entityId={id} venture={customer.venture ?? undefined} />
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#6B7280', margin: '0 0 8px' }}>{children}</p>;
}

function MetaRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: '11px', color: '#6B7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
      {children ?? <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#14193A' }}>{value}</p>}
    </div>
  );
}

function DiscountRow({ label, sub, rate, onDelete }: { label: string; sub?: string; rate: number; onDelete: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#F7F8FC', borderRadius: '8px', border: '1px solid #EEF0F7' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#14193A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</p>
        {sub && <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF' }}>{sub}</p>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', shrink: 0 } as React.CSSProperties}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#C8A96E', whiteSpace: 'nowrap' }}>{rate}%</span>
        <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '14px', padding: '0 2px', lineHeight: 1 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#DC2626')}
          onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}>×</button>
      </div>
    </div>
  );
}
