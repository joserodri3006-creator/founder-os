"use client";

import { useState } from "react";

const VENTURES = [
  { value: "online_first", label: "Online First" },
  { value: "blazed_outfitters", label: "Blazed Outfitters" },
  { value: "droplane", label: "Droplane" },
  { value: "brandary", label: "Brandary" },
];

interface Props {
  leadId: string;
  leadName: string;
  currentVenture: string;
  onClose: () => void;
  onCopied: () => void;
}

export default function CopyLeadModal({ leadId, leadName, currentVenture, onClose, onCopied }: Props) {
  const [venture, setVenture] = useState(
    VENTURES.find((v) => v.value !== currentVenture)?.value ?? "online_first"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCopy() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/leads/${leadId}/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venture }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.error === "duplicate") {
      setError(data.message);
    } else if (res.ok) {
      onCopied();
      onClose();
    } else {
      setError(data.error ?? "Fehler beim Kopieren.");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Lead kopieren</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">
            <span className="font-medium">{leadName}</span> in folgendes Venture kopieren:
          </p>
          <div className="space-y-2">
            {VENTURES.filter((v) => v.value !== currentVenture).map((v) => (
              <label key={v.value} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                <input type="radio" name="venture" value={v.value} checked={venture === v.value}
                  onChange={() => setVenture(v.value)} className="accent-blue-600" />
                <span className="text-sm font-medium text-gray-700">{v.label}</span>
              </label>
            ))}
            <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
              <input type="radio" name="venture" value={currentVenture} checked={venture === currentVenture}
                onChange={() => setVenture(currentVenture)} className="accent-blue-600" />
              <span className="text-sm font-medium text-gray-700">
                {VENTURES.find((v) => v.value === currentVenture)?.label} <span className="text-gray-400 font-normal">(aktuell)</span>
              </span>
            </label>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button onClick={handleCopy} disabled={loading}
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {loading ? "Kopieren…" : "Kopieren"}
            </button>
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50">
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
