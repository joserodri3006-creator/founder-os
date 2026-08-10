"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";

interface ToolCall {
  id: string;
  name: string;
  input: unknown;
  result?: string;
  done: boolean;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  tools: ToolCall[];
}

interface ConversationSummary {
  id: string;
  title: string | null;
  updated_at: string;
}

const TOOL_LABELS: Record<string, string> = {
  search_leads: "Leads durchsuchen",
  search_customers: "Kunden durchsuchen",
  search_orders: "Aufträge durchsuchen",
  get_kpis: "Kennzahlen abrufen",
  add_note: "Notiz hinzufügen",
  update_lead_status: "Lead-Status ändern",
  search_new_leads: "Google-Lead-Suche",
  import_lead: "Lead importieren",
  create_order: "Auftrag anlegen",
  update_order_status: "Auftragsstatus ändern",
  create_email_draft: "E-Mail-Entwurf erstellen",
};

interface PendingConfirmation {
  name: string;
  summary: string;
}

function newId() {
  return Math.random().toString(36).slice(2);
}

export default function JarvisPage() {
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [confirming, setConfirming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (user?.role === "founder") loadConversations();
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadConversations() {
    const res = await fetch("/api/jarvis/conversations");
    if (res.ok) setConversations(await res.json());
  }

  async function openConversation(id: string) {
    const res = await fetch(`/api/jarvis/conversations?id=${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setConversationId(id);
    const loaded: ChatMessage[] = (data.messages as { id: string; role: "user" | "assistant"; content: Array<{ type: string; text?: string }> }[]).map((m) => ({
      id: m.id,
      role: m.role,
      text: (m.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join(""),
      tools: [],
    }));
    setMessages(loaded);
    const pending = data.pending_action as { summary: string; name: string } | null;
    setPendingConfirmation(pending ? { name: pending.name, summary: pending.summary } : null);
  }

  function startNewConversation() {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setPendingConfirmation(null);
  }

  async function deleteConversation(id: string) {
    await fetch(`/api/jarvis/conversations?id=${id}`, { method: "DELETE" });
    if (conversationId === id) startNewConversation();
    loadConversations();
  }

  async function consumeStream(res: Response, assistantMsgId: string) {
    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => "Fehler");
      setError(errText || "Anfrage fehlgeschlagen");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;
        let evt: Record<string, unknown>;
        try { evt = JSON.parse(jsonStr); } catch { continue; }

        if (evt.type === "conversation" && !conversationId) {
          setConversationId(evt.conversation_id as string);
        } else if (evt.type === "text") {
          setMessages((prev) => prev.map((m) => m.id === assistantMsgId ? { ...m, text: m.text + (evt.delta as string) } : m));
        } else if (evt.type === "tool_start") {
          setMessages((prev) => prev.map((m) => m.id === assistantMsgId
            ? { ...m, tools: [...m.tools, { id: evt.id as string, name: evt.name as string, input: evt.input, done: false }] }
            : m));
        } else if (evt.type === "tool_result") {
          setMessages((prev) => prev.map((m) => m.id === assistantMsgId
            ? { ...m, tools: m.tools.map((t) => t.id === evt.id ? { ...t, result: evt.result as string, done: true } : t) }
            : m));
        } else if (evt.type === "awaiting_confirmation") {
          setPendingConfirmation({ name: evt.name as string, summary: evt.summary as string });
        } else if (evt.type === "error") {
          setError(evt.message as string);
        } else if (evt.type === "done") {
          loadConversations();
        }
      }
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending || pendingConfirmation) return;
    setError(null);
    setInput("");

    const userMsg: ChatMessage = { id: newId(), role: "user", text: trimmed, tools: [] };
    const assistantMsg: ChatMessage = { id: newId(), role: "assistant", text: "", tools: [] };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setSending(true);

    try {
      const res = await fetch("/api/jarvis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, conversation_id: conversationId }),
      });
      await consumeStream(res, assistantMsg.id);
    } catch {
      setError("Verbindung unterbrochen — bitte erneut versuchen.");
    } finally {
      setSending(false);
    }
  }

  async function handleConfirm(approved: boolean) {
    if (!conversationId || confirming) return;
    setConfirming(true);
    setError(null);
    setPendingConfirmation(null);

    const assistantMsg: ChatMessage = { id: newId(), role: "assistant", text: "", tools: [] };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch("/api/jarvis/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId, approved }),
      });
      await consumeStream(res, assistantMsg.id);
    } catch {
      setError("Verbindung unterbrochen — bitte erneut versuchen.");
    } finally {
      setConfirming(false);
    }
  }

  function toggleVoiceInput() {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setError("Spracheingabe wird von diesem Browser nicht unterstützt.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "de-DE";
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  if (authLoading) return <div className="p-8 text-sm text-gray-400">Laden...</div>;

  if (user && user.role !== "founder") {
    return (
      <div className="px-4 py-5 sm:p-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-6 text-sm text-gray-600">
          Jarvis steht aktuell nur dem Founder zur Verfügung.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-0px)]">
      <aside className="hidden md:flex w-64 flex-col border-r border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-100">
          <button
            onClick={startNewConversation}
            className="w-full text-sm px-3 py-2 rounded-md text-white font-medium"
            style={{ background: "#1B2A5E" }}
          >
            + Neuer Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center justify-between px-3 py-2 rounded-md text-sm cursor-pointer ${
                c.id === conversationId ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50"
              }`}
              onClick={() => openConversation(c.id)}
            >
              <span className="truncate">{c.title || "Neuer Chat"}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 ml-2 shrink-0"
                title="Löschen"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <div className="px-4 sm:px-8 py-4 border-b border-gray-100">
          <h1 className="text-lg font-semibold text-gray-900">Jarvis</h1>
          <p className="text-xs text-gray-500 mt-0.5">KI-Assistent für alle Ventures — Leads, Kunden, Aufträge</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-5">
          {messages.length === 0 && (
            <div className="text-sm text-gray-400 mt-8 text-center">
              Frag mich z.B. „Welche Leads bei Online First sind diese Woche neu reingekommen?"
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-2xl ${m.role === "user" ? "" : "w-full"}`}>
                {m.tools.length > 0 && (
                  <div className="space-y-1.5 mb-2">
                    {m.tools.map((t) => (
                      <ToolCallCard key={t.id} tool={t} />
                    ))}
                  </div>
                )}
                {m.text && (
                  <div
                    className={`text-sm rounded-lg px-4 py-2.5 whitespace-pre-wrap ${
                      m.role === "user" ? "text-white" : "bg-white border border-gray-200 text-gray-800"
                    }`}
                    style={m.role === "user" ? { background: "#1B2A5E" } : undefined}
                  >
                    {m.text}
                  </div>
                )}
                {m.role === "assistant" && !m.text && m.tools.length === 0 && sending && (
                  <div className="text-sm text-gray-400 px-1">Denkt nach…</div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {pendingConfirmation && (
          <div className="mx-4 sm:mx-8 mb-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <div className="text-xs font-medium text-amber-800 uppercase tracking-wide mb-1">
              Bestätigung erforderlich — {TOOL_LABELS[pendingConfirmation.name] ?? pendingConfirmation.name}
            </div>
            <div className="text-sm text-amber-900 mb-3">{pendingConfirmation.summary}</div>
            <div className="flex gap-2">
              <button
                onClick={() => handleConfirm(true)}
                disabled={confirming}
                className="text-sm px-3 py-1.5 rounded-md text-white font-medium disabled:opacity-40"
                style={{ background: "#1B2A5E" }}
              >
                Bestätigen
              </button>
              <button
                onClick={() => handleConfirm(false)}
                disabled={confirming}
                className="text-sm px-3 py-1.5 rounded-md border border-amber-300 text-amber-800 hover:bg-amber-100 disabled:opacity-40"
              >
                Ablehnen
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-4 sm:mx-8 mb-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
            {error}
          </div>
        )}

        <div className="px-4 sm:px-8 py-4 border-t border-gray-100">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder={pendingConfirmation ? "Bitte erst Bestätigung oben klären…" : "Frag Jarvis…"}
              rows={1}
              disabled={Boolean(pendingConfirmation)}
              className="flex-1 text-sm border border-gray-200 rounded-md px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none disabled:bg-gray-50 disabled:text-gray-400"
            />
            <button
              onClick={toggleVoiceInput}
              className={`text-sm px-3 py-2.5 rounded-md border ${listening ? "border-red-300 text-red-600 bg-red-50" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
              title="Spracheingabe"
            >
              🎤
            </button>
            <button
              onClick={() => sendMessage(input)}
              disabled={sending || !input.trim() || Boolean(pendingConfirmation)}
              className="text-sm px-4 py-2.5 rounded-md text-white font-medium disabled:opacity-40"
              style={{ background: "#1B2A5E" }}
            >
              Senden
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolCallCard({ tool }: { tool: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-gray-200 rounded-md bg-gray-50 text-xs overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-gray-600 hover:bg-gray-100"
      >
        <span className="flex items-center gap-1.5">
          <span className={tool.done ? "text-green-600" : "text-amber-500"}>{tool.done ? "✓" : "…"}</span>
          {TOOL_LABELS[tool.name] ?? tool.name}
        </span>
        <span className="text-gray-400">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="px-3 py-2 border-t border-gray-200 space-y-1.5">
          <div>
            <div className="text-gray-400 uppercase tracking-wide text-[10px] mb-0.5">Parameter</div>
            <pre className="whitespace-pre-wrap break-words text-gray-600">{JSON.stringify(tool.input, null, 2)}</pre>
          </div>
          {tool.result && (
            <div>
              <div className="text-gray-400 uppercase tracking-wide text-[10px] mb-0.5">Ergebnis</div>
              <pre className="whitespace-pre-wrap break-words text-gray-600 max-h-48 overflow-y-auto">{tool.result}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
