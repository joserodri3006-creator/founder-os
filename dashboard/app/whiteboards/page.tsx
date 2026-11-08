"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useVenture } from "@/context/VentureContext";
import { Editor, Tldraw, createShapeId, toRichText } from "tldraw";
import "tldraw/tldraw.css";

type BoardTemplate = {
  id: string;
  label: string;
  description: string;
  eyebrow: string;
  accent: string;
  sections: string[];
};

type Board = BoardTemplate & {
  boardId: string;
  createdAt: string;
  venture: string | null;
  content?: unknown;
  links: { task_ids: string[] };
  persisted?: boolean;
};

type Task = {
  id: string;
  title: string;
  status?: string;
  venture?: string;
};

const TEMPLATES: BoardTemplate[] = [
  {
    id: "portfolio",
    label: "Portfolio",
    description: "Alle Ventures, Ziele und strategischen Prioritäten auf einer Fläche.",
    eyebrow: "Überblick",
    accent: "#C8A96E",
    sections: ["Strategische Ziele", "Aktive Ventures", "Blockaden", "Nächste Entscheidungen"],
  },
  {
    id: "venture-strategy",
    label: "Venture-Strategie",
    description: "Ein klares Zielbild für ein einzelnes Venture oder Projekt.",
    eyebrow: "Strategie",
    accent: "#3A5BA0",
    sections: ["Zielbild", "Umsatzhebel", "Initiativen", "Risiken & nächste Schritte"],
  },
  {
    id: "weekly-planning",
    label: "Wochenplanung",
    description: "Die operative Woche sichtbar machen und fokussiert halten.",
    eyebrow: "Operations",
    accent: "#5C8A72",
    sections: ["Diese Woche", "Nächste Woche", "Delegieren", "Blockiert"],
  },
  {
    id: "decision",
    label: "Entscheidung",
    description: "Probleme, Optionen und die nächste verbindliche Entscheidung strukturieren.",
    eyebrow: "Founder-Entscheidung",
    accent: "#9B6A6A",
    sections: ["Problem", "Optionen", "Bewertung", "Entscheidung & Owner"],
  },
  {
    id: "sentinel-ai-agents",
    label: "Sentinel – KI-Agenten",
    description: "Grobe Übersicht der geplanten Agenten und der unabhängigen lokalen KI.",
    eyebrow: "Sentinel-Projekt",
    accent: "#8B5E83",
    sections: [
      "1 · Anlass-Agent\\nGeburtstag · Kundenjubiläum · Hochzeitstag\\nPersönliches Anschreiben über WhatsApp",
      "2 · Digitaler Assistent\\nUnterstützung im Tagesgeschäft\\nOffene Punkte · Termine · nächste Aktionen",
      "3 · Postfach-Agent\\nE-Mails und physische Allianz-Post\\nEingang prüfen · sortieren · Aufgaben vorbereiten",
      "4 · Video-Agent\\nVideos schneiden und transkribieren\\nSpätere Ausarbeitung",
      "5 · Steuer-Agent\\nBelege erkennen · Kostenübersicht\\nDateien und Daten für die Steuererklärung vorbereiten",
      "6 · Lokale KI\\nUnabhängig von den Agenten\\nEigene lokale KI-Infrastruktur prüfen",
      "7 · Vertriebs-Agent\\nPotenzialanalyse · Kundenkonzept\\nUnteragenten für einzelne Versicherungssparten",
    ],
  },
  {
    id: "freeform",
    label: "Freies Whiteboard",
    description: "Eine leere Fläche für Skizzen, Gedanken und spontane Arbeit.",
    eyebrow: "Blank canvas",
    accent: "#7C6BA5",
    sections: [],
  },
];

const STORAGE_KEY = "founder-os:whiteboards:v1";

function createBoard(template: BoardTemplate, venture: string | null): Board {
  return {
    ...template,
    boardId: `${template.id}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    venture,
    links: { task_ids: [] },
    persisted: false,
  };
}

function hasSnapshot(content: unknown): content is Record<string, unknown> {
  return Boolean(content && typeof content === "object" && "document" in content);
}

function WhiteboardCanvas({ board, onSnapshot }: { board: Board; onSnapshot: (content: unknown) => void }) {
  function handleMount(editor: Editor) {
    if (hasSnapshot(board.content)) {
      editor.loadSnapshot(board.content as never);
    } else if (editor.getCurrentPageShapes().length === 0) {
      const shapes = board.sections.length > 0
        ? board.sections.map((section, index) => ({
            id: createShapeId(`${board.boardId}-${index}`),
            type: "geo" as const,
            x: 80 + (index % 2) * 440,
            y: 80 + Math.floor(index / 2) * 240,
            props: {
              geo: "rectangle" as const,
              w: 380,
              h: 180,
              color: "blue" as const,
              fill: "solid" as const,
              dash: "draw" as const,
              size: "m" as const,
              font: "draw" as const,
              align: "start" as const,
              verticalAlign: "start" as const,
              richText: toRichText(`${section}\\n\\nNotiz hinzufügen`),
              url: "",
              growY: 0,
              labelColor: "black" as const,
              scale: 1,
            },
          }))
        : [{
            id: createShapeId(`${board.boardId}-start`),
            type: "text" as const,
            x: 160,
            y: 160,
            props: {
              color: "black" as const,
              size: "l" as const,
              font: "draw" as const,
              align: "middle" as const,
              w: 500,
              richText: toRichText("Freies Whiteboard\\n\\nHier kannst du starten."),
              autoSize: false,
              scale: 1,
            },
          }];

      editor.createShapes(shapes);
      editor.zoomToFit({ animation: { duration: 180 } });
    }

    let saveTimer: number | undefined;
    const dispose = editor.store.listen(() => {
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => onSnapshot(editor.getSnapshot()), 800);
    }, { scope: "document" });
    return () => {
      window.clearTimeout(saveTimer);
      dispose();
    };
  }

  return (
    <div className="h-[min(68dvh,620px)] min-h-[420px] w-full overflow-hidden rounded-xl border border-[#D1D5E8] bg-white sm:h-[620px]">
      <Tldraw
        key={board.boardId}
        persistenceKey={`founder-os-whiteboard-${board.boardId}`}
        onMount={handleMount}
      />
    </div>
  );
}

export default function WhiteboardsPage() {
  const { venture } = useVenture();
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [importInputKey, setImportInputKey] = useState(0);
  const [fullscreenBoard, setFullscreenBoard] = useState(false);
  const [linksOpen, setLinksOpen] = useState(false);
  const activeBoardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setBoards(JSON.parse(raw) as Board[]);
    } catch {
      setStorageNotice("Lokaler Entwurf konnte nicht geladen werden.");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    fetch(`/api/tasks?venture=${encodeURIComponent(venture)}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<Task[]> : [])
      .then((data) => setTasks(Array.isArray(data) ? data : []))
      .catch(() => setTasks([]));
  }, [hydrated, venture]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    fetch(`/api/whiteboards?venture=${encodeURIComponent(venture)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Supabase-Speicherung ist noch nicht aktiviert.");
        return response.json() as Promise<{ data: Array<Record<string, unknown>> }>;
      })
      .then((payload) => {
        if (cancelled) return;
        const remoteBoards = payload.data.map((row) => {
          const template = TEMPLATES.find((item) => item.id === row.template_id) ?? TEMPLATES[TEMPLATES.length - 1];
          return {
            ...template,
            boardId: String(row.id),
            createdAt: String(row.created_at),
            venture: typeof row.venture === "string" ? row.venture : null,
            content: row.content,
            links: row.links && typeof row.links === "object" ? row.links as { task_ids: string[] } : { task_ids: [] },
            persisted: true,
          } satisfies Board;
        });
        setBoards((current) => {
          const localOnly = current.filter((board) => !board.persisted);
          return [...remoteBoards, ...localOnly];
        });
        setStorageNotice(null);
      })
      .catch(() => {
        if (!cancelled) setStorageNotice("Supabase ist noch nicht migriert — lokale Entwürfe bleiben aktiv.");
      });
    return () => { cancelled = true; };
  }, [hydrated, venture]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(boards.filter((board) => !board.persisted)));
  }, [boards, hydrated]);

  const activeBoard = useMemo(
    () => boards.find((board) => board.boardId === activeBoardId) ?? null,
    [activeBoardId, boards],
  );

  useEffect(() => {
    if (!activeBoardId || !activeBoardRef.current) return;
    window.requestAnimationFrame(() => activeBoardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [activeBoardId]);

  async function addBoard() {
    const template = TEMPLATES.find((item) => item.id === selectedTemplate) ?? TEMPLATES[0];
    try {
      const response = await fetch("/api/whiteboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: template.label, template_id: template.id, venture, content: {} }),
      });
      if (response.ok) {
        const payload = await response.json() as { data: Record<string, unknown> };
        const board: Board = {
          ...template,
          boardId: String(payload.data.id),
          createdAt: String(payload.data.created_at),
          venture,
          content: payload.data.content,
          links: payload.data.links && typeof payload.data.links === "object" ? payload.data.links as { task_ids: string[] } : { task_ids: [] },
          persisted: true,
        };
        setBoards((current) => [board, ...current]);
        setActiveBoardId(board.boardId);
        setStorageNotice(null);
        return;
      }
    } catch {
      // Fallback auf lokalen Entwurf.
    }
    const board = createBoard(template, venture);
    setBoards((current) => [board, ...current]);
    setActiveBoardId(board.boardId);
    setStorageNotice("Board lokal erstellt. Nach der Supabase-Migration wird es dauerhaft gespeichert.");
  }

  async function deleteBoard(boardId: string) {
    const board = boards.find((item) => item.boardId === boardId);
    if (board?.persisted) {
      await fetch(`/api/whiteboards/${boardId}`, { method: "DELETE" });
    }
    setBoards((current) => current.filter((item) => item.boardId !== boardId));
    if (activeBoardId === boardId) setActiveBoardId(null);
  }

  async function saveSnapshot(board: Board, content: unknown) {
    setBoards((current) => current.map((item) => item.boardId === board.boardId ? { ...item, content } : item));
    if (!board.persisted) return;
    await fetch(`/api/whiteboards/${board.boardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  }

  async function saveLinks(board: Board, taskIds: string[]) {
    const links = { task_ids: Array.from(new Set(taskIds)).slice(0, 100) };
    setBoards((current) => current.map((item) => item.boardId === board.boardId ? { ...item, links } : item));
    if (board.persisted) {
      await fetch(`/api/whiteboards/${board.boardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links }),
      });
    }
  }

  function exportBoard(board: Board) {
    const blob = new Blob([JSON.stringify({ format: "founder-os-whiteboard", version: 1, board }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${board.label.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}-${board.boardId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importBoard(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    void file.text().then((text) => {
      const parsed = JSON.parse(text) as { format?: string; board?: Partial<Board> };
      if (parsed.format !== "founder-os-whiteboard" || !parsed.board?.content) throw new Error("Ungültiges Founder-OS-Whiteboard.");
      const template = TEMPLATES.find((item) => item.id === parsed.board?.id) ?? TEMPLATES[TEMPLATES.length - 1];
      const imported: Board = {
        ...template,
        ...parsed.board,
        boardId: `import-${Date.now()}`,
        createdAt: new Date().toISOString(),
        venture: typeof parsed.board?.venture === "string" ? parsed.board.venture : venture,
        links: parsed.board?.links ?? { task_ids: [] },
        persisted: false,
      };
      setBoards((current) => [imported, ...current]);
      setActiveBoardId(imported.boardId);
      setStorageNotice("Board importiert. Es ist zunächst ein lokaler Entwurf.");
    }).catch(() => setStorageNotice("Die Datei konnte nicht als Founder-OS-Whiteboard gelesen werden."));
    setImportInputKey((key) => key + 1);
  }

  return (
    <main className="min-h-full px-4 py-6 sm:px-8 sm:py-8" style={{ background: "#F7F8FC" }}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "#C8A96E" }}>
              Founder OS · Visuelles Denken
            </p>
            <h1 className="text-3xl font-light tracking-tight" style={{ color: "#14193A", fontFamily: "var(--font-serif)" }}>
              Whiteboards
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: "#6B7280" }}>
              Strategie, Entscheidungen und operative Arbeit auf einer gemeinsamen Fläche — vorbereitet für die spätere Verbindung mit Ventures, Aufgaben und Zielen.
            </p>
          </div>
          <Link href="/dashboard" className="rounded-lg border border-[#D1D5E8] bg-white px-4 py-2 text-sm font-medium text-[#1B2A5E] hover:bg-[#F0F2F8]">
            Zurück zum Dashboard
          </Link>
        </div>

        <section className="mb-8 rounded-2xl border border-[#D1D5E8] bg-white p-5 shadow-[0_2px_12px_rgba(27,42,94,0.06)] sm:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#C8A96E]">Neues Board</p>
              <h2 className="mt-1 text-lg font-semibold text-[#14193A]">Mit einer Vorlage starten</h2>
            </div>
            <button onClick={addBoard} className="rounded-lg bg-[#1B2A5E] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#14193A]">
              + Whiteboard erstellen
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            {TEMPLATES.map((template) => {
              const selected = selectedTemplate === template.id;
              return (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  className="min-h-[148px] rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                  style={{
                    borderColor: selected ? template.accent : "#E3E6F0",
                    background: selected ? `${template.accent}10` : "#FFFFFF",
                    boxShadow: selected ? `0 0 0 1px ${template.accent}` : undefined,
                  }}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.13em]" style={{ color: template.accent }}>{template.eyebrow}</span>
                  <span className="mt-2 block text-sm font-semibold text-[#14193A]">{template.label}</span>
                  <span className="mt-2 block text-xs leading-5 text-[#6B7280]">{template.description}</span>
                </button>
              );
            })}
          </div>
        </section>

        {storageNotice && (
          <div className="mb-4 rounded-lg border border-[#E7D6AA] bg-[#FFF9EA] px-4 py-3 text-sm text-[#806A2C]">{storageNotice}</div>
        )}

        {activeBoard ? (
          <section ref={activeBoardRef} className={`${fullscreenBoard ? "fixed inset-0 z-[60] m-0 flex min-h-0 flex-col rounded-none" : "mb-8"} scroll-mt-3 overflow-hidden border border-[#D1D5E8] bg-white shadow-[0_2px_12px_rgba(27,42,94,0.08)]`}>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E6E8F0] px-4 py-3 sm:px-6 sm:py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: activeBoard.accent }}>{activeBoard.eyebrow}</p>
                <h2 className="mt-1 text-lg font-semibold text-[#14193A]">{activeBoard.label}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#8A90A3]">
                <span className="rounded-full bg-[#F0F2F8] px-3 py-1.5">{activeBoard.persisted ? "In Supabase gespeichert" : "Lokaler Entwurf"}</span>
                {fullscreenBoard && <button onClick={() => setFullscreenBoard(false)} className="rounded-lg border border-[#D1D5E8] px-3 py-2 font-medium text-[#1B2A5E] hover:bg-[#F0F2F8]">Schließen</button>}
                {!fullscreenBoard && <button onClick={() => setFullscreenBoard(true)} className="rounded-lg border border-[#D1D5E8] px-3 py-2 font-medium text-[#1B2A5E] hover:bg-[#F0F2F8]">Vollbild</button>}
                <button onClick={() => exportBoard(activeBoard)} className="rounded-lg border border-[#D1D5E8] px-3 py-2 font-medium text-[#1B2A5E] hover:bg-[#F0F2F8]">Export</button>
                <label className="cursor-pointer rounded-lg border border-[#D1D5E8] px-3 py-1.5 font-medium text-[#1B2A5E] hover:bg-[#F0F2F8]">
                  Import
                  <input key={importInputKey} type="file" accept="application/json" onChange={importBoard} className="hidden" />
                </label>
                <button onClick={() => void deleteBoard(activeBoard.boardId)} className="rounded-lg border border-red-200 px-3 py-1.5 font-medium text-red-600 hover:bg-red-50">Board löschen</button>
              </div>
            </div>
            <div className={`${fullscreenBoard ? "min-h-0 flex-1 p-2 sm:p-4" : "p-3 sm:p-5"} overflow-hidden bg-[#F8F9FC]`}>
              <WhiteboardCanvas board={activeBoard} onSnapshot={(content) => { void saveSnapshot(activeBoard, content); }} />
            </div>
            <div className="border-t border-[#E6E8F0] bg-white px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#C8A96E]">Founder-OS-Verknüpfungen</p>
                  <p className="mt-1 text-sm text-[#6B7280]">Venture: <span className="font-medium text-[#1B2A5E]">{activeBoard.venture ?? "übergreifend"}</span> · {activeBoard.links.task_ids.length} verknüpfte Aufgabe{activeBoard.links.task_ids.length === 1 ? "" : "n"}</p>
                </div>
                <button onClick={() => setLinksOpen((open) => !open)} className="rounded-lg border border-[#D1D5E8] px-3 py-2 text-xs font-medium text-[#1B2A5E] hover:bg-[#F8F9FC] sm:hidden">
                  {linksOpen ? "Aufgaben ausblenden" : "Aufgaben anzeigen"}
                </button>
              </div>
              {tasks.length > 0 ? (
                <div className={`${linksOpen ? "grid" : "hidden"} mt-4 max-h-48 gap-2 overflow-y-auto sm:grid sm:grid-cols-2`}>
                  {tasks.slice(0, 40).map((task) => {
                    const checked = activeBoard.links.task_ids.includes(task.id);
                    return (
                      <label key={task.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#E6E8F0] px-3 py-2 text-sm hover:bg-[#F8F9FC]">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => void saveLinks(activeBoard, event.target.checked ? [...activeBoard.links.task_ids, task.id] : activeBoard.links.task_ids.filter((id) => id !== task.id))}
                          className="mt-0.5 accent-[#1B2A5E]"
                        />
                        <span className="min-w-0 flex-1 truncate text-[#39415F]">{task.title}</span>
                        {task.status && <span className="shrink-0 text-xs text-[#9AA0B2]">{task.status}</span>}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className={`${linksOpen ? "block" : "hidden"} mt-4 rounded-lg border border-dashed border-[#D8DBE7] px-3 py-3 text-xs text-[#8A90A3] sm:block`}>Für dieses Venture wurden keine Aufgaben geladen.</p>
              )}
            </div>
          </section>
        ) : (
          <section className="mb-8 rounded-2xl border border-dashed border-[#C9CEDD] bg-white/70 px-6 py-14 text-center">
            <p className="text-lg font-semibold text-[#14193A]">Noch kein Whiteboard geöffnet</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6B7280]">Wähle oben eine Vorlage und erstelle dein erstes Board. Die Boards werden in diesem ersten Block lokal im Browser gespeichert.</p>
          </section>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#C8A96E]">Deine Boards</p>
              <h2 className="mt-1 text-lg font-semibold text-[#14193A]">Zuletzt angelegt</h2>
            </div>
            <span className="text-xs text-[#8A90A3]">{boards.length} {boards.length === 1 ? "Board" : "Boards"}</span>
          </div>
          {boards.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {boards.map((board) => (
                <button key={board.boardId} onClick={() => setActiveBoardId(board.boardId)} className="rounded-xl border border-[#D1D5E8] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.13em]" style={{ color: board.accent }}>{board.eyebrow}</span>
                  <span className="mt-2 block font-semibold text-[#14193A]">{board.label}</span>
                  <span className="mt-1 block text-xs text-[#8A90A3]">{new Date(board.createdAt).toLocaleDateString("de-DE")}</span>
                  <span className="mt-3 inline-flex rounded-lg bg-[#F0F2F8] px-3 py-2 text-xs font-semibold text-[#1B2A5E]">Öffnen</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-[#E3E6F0] bg-white px-4 py-5 text-sm text-[#8A90A3]">Deine angelegten Boards erscheinen hier.</p>
          )}
        </section>
      </div>
    </main>
  );
}
