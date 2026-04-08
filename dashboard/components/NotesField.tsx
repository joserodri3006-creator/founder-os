"use client";
import { useState, useEffect, useRef } from "react";

interface Props {
  value: string | null;
  onSave: (notes: string) => Promise<void>;
  placeholder?: string;
}

export default function NotesField({ value, onSave, placeholder = "Notizen hinzufügen…" }: Props) {
  const [text, setText] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { setText(value ?? ''); }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    setSaved(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      setSaving(true);
      await onSave(e.target.value);
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 1000);
  }

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #D1D5E8', borderRadius: '16px', boxShadow: '0 2px 12px rgba(27,42,94,0.08)', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: '16px', color: '#14193A', margin: 0 }}>Notizen</h3>
        {saving && <span style={{ fontSize: '12px', color: '#6B7280' }}>Speichert…</span>}
        {saved && <span style={{ fontSize: '12px', color: '#22C55E' }}>✓ Gespeichert</span>}
      </div>
      <textarea
        value={text}
        onChange={handleChange}
        placeholder={placeholder}
        rows={5}
        style={{
          width: '100%', resize: 'vertical', border: '1px solid #D1D5E8', borderRadius: '8px',
          padding: '10px 12px', fontSize: '14px', color: '#14193A', outline: 'none',
          fontFamily: 'var(--font-sans)', lineHeight: 1.6, background: '#F7F8FC',
          boxSizing: 'border-box', transition: 'border-color 0.15s',
        }}
        onFocus={e => e.target.style.borderColor = '#1B2A5E'}
        onBlur={e => e.target.style.borderColor = '#D1D5E8'}
      />
    </div>
  );
}
