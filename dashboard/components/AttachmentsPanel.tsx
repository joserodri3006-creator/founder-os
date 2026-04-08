"use client";
import { useEffect, useState, useRef } from "react";

interface Attachment {
  id: string;
  filename: string;
  description: string | null;
  size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
}

interface Props {
  entityType: 'order' | 'customer' | 'product';
  entityId: string;
  venture?: string;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function fileIcon(mime: string | null) {
  if (!mime) return '📎';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.includes('pdf')) return '📄';
  if (mime.includes('sheet') || mime.includes('excel')) return '📊';
  if (mime.includes('word') || mime.includes('document')) return '📝';
  if (mime.includes('zip') || mime.includes('rar')) return '🗜️';
  return '📎';
}

export default function AttachmentsPanel({ entityType, entityId, venture }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadAttachments() {
    setLoading(true);
    const res = await fetch(`/api/attachments?entity_type=${entityType}&entity_id=${entityId}`);
    const data = await res.json();
    setAttachments(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { if (entityId) loadAttachments(); }, [entityId]);

  async function upload() {
    if (!selectedFile) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', selectedFile);
    fd.append('entity_type', entityType);
    fd.append('entity_id', entityId);
    if (description) fd.append('description', description);
    if (venture) fd.append('venture', venture);
    await fetch('/api/attachments', { method: 'POST', body: fd });
    setSelectedFile(null);
    setDescription('');
    await loadAttachments();
    setUploading(false);
  }

  async function download(id: string) {
    const res = await fetch(`/api/attachments/${id}`);
    const { url, filename } = await res.json();
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.click();
  }

  async function remove(id: string) {
    if (!confirm('Anhang löschen?')) return;
    await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
    setAttachments(prev => prev.filter(a => a.id !== id));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  }

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #D1D5E8', borderRadius: '16px', boxShadow: '0 2px 12px rgba(27,42,94,0.08)', padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: '16px', color: '#14193A', margin: 0 }}>
          Anhänge {attachments.length > 0 && <span style={{ fontSize: '13px', color: '#6B7280', fontFamily: 'var(--font-sans)' }}>({attachments.length})</span>}
        </h3>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{ background: '#1B2A5E', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}
        >
          + Datei hochladen
        </button>
        <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && setSelectedFile(e.target.files[0])} />
      </div>

      {/* Selected file preview + description */}
      {selectedFile && (
        <div style={{ background: '#F7F8FC', border: '1px solid #D1D5E8', borderRadius: '10px', padding: '12px 14px', marginBottom: '12px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#14193A', fontWeight: 500 }}>{selectedFile.name} <span style={{ color: '#6B7280', fontWeight: 400 }}>({formatBytes(selectedFile.size)})</span></p>
          <input
            type="text"
            placeholder="Kurzbeschreibung (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={{ width: '100%', padding: '7px 10px', border: '1px solid #D1D5E8', borderRadius: '6px', fontSize: '13px', outline: 'none', marginBottom: '10px', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={upload} disabled={uploading}
              style={{ background: '#1B2A5E', color: '#fff', border: 'none', borderRadius: '6px', padding: '7px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: 500, opacity: uploading ? 0.6 : 1 }}>
              {uploading ? 'Wird hochgeladen…' : 'Hochladen'}
            </button>
            <button onClick={() => setSelectedFile(null)}
              style={{ background: 'transparent', color: '#6B7280', border: '1px solid #D1D5E8', borderRadius: '6px', padding: '7px 12px', fontSize: '13px', cursor: 'pointer' }}>
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Drop zone when no file selected */}
      {!selectedFile && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? '#1B2A5E' : '#D1D5E8'}`,
            borderRadius: '10px',
            padding: '20px',
            textAlign: 'center',
            cursor: 'pointer',
            marginBottom: '12px',
            background: dragging ? 'rgba(27,42,94,0.04)' : 'transparent',
            transition: 'all 0.15s',
          }}
        >
          <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>Datei hierher ziehen oder klicken zum Auswählen</p>
        </div>
      )}

      {/* Attachment list */}
      {loading ? (
        <p style={{ fontSize: '13px', color: '#6B7280', textAlign: 'center', padding: '16px 0', margin: 0 }}>Laden…</p>
      ) : attachments.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#6B7280', textAlign: 'center', padding: '8px 0', margin: 0 }}>Keine Anhänge</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {attachments.map(att => (
            <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: '#F7F8FC', borderRadius: '8px', border: '1px solid #EEF0F7' }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>{fileIcon(att.mime_type)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#14193A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.filename}</p>
                {att.description && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6B7280' }}>{att.description}</p>}
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#D1D5E8' }}>
                  {formatBytes(att.size_bytes)} · {new Date(att.created_at).toLocaleDateString('de-DE')}
                </p>
              </div>
              <button onClick={() => download(att.id)} title="Herunterladen"
                style={{ background: 'transparent', border: '1px solid #D1D5E8', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '13px', color: '#1B2A5E' }}>
                ↓
              </button>
              <button onClick={() => remove(att.id)} title="Löschen"
                style={{ background: 'transparent', border: '1px solid #FECACA', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontSize: '13px', color: '#EF4444' }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
