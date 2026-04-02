export type LeadStatus =
  | "neu"
  | "in_bearbeitung"
  | "kontaktiert"
  | "follow_up"
  | "nachgefasst"
  | "erstgespraech"
  | "qualifiziert"
  | "sales_gespraech"
  | "angebot_gesendet"
  | "gewonnen"
  | "verloren"
  | "nachfassen_zukunft";

export type LeadSource =
  | "website"
  | "linkedin"
  | "empfehlung"
  | "kaltakquise"
  | "csv_import"
  | "ki_suche";

export interface Lead {
  id: string;
  venture: string;
  company_name: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  website: string | null;
  city: string | null;
  region: string | null;
  source: LeadSource;
  status: LeadStatus;
  industry: string | null;
  notes: string | null;
  contact_reason: string | null;
  automation_enabled: boolean;
  ai_draft_subject: string | null;
  ai_draft_body: string | null;
  ai_draft_created_at: string | null;
  ai_draft_approved: boolean | null;
  follow_up_date: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export const STATUS_LABELS: Record<LeadStatus, string> = {
  neu: "Neu",
  in_bearbeitung: "In Bearbeitung",
  kontaktiert: "Kontaktiert",
  follow_up: "Follow-up",
  nachgefasst: "Nachgefasst",
  erstgespraech: "Erstgespräch",
  qualifiziert: "Qualifiziert",
  sales_gespraech: "Sales-Gespräch",
  angebot_gesendet: "Angebot gesendet",
  gewonnen: "Gewonnen",
  verloren: "Verloren",
  nachfassen_zukunft: "Nachfassen (Zukunft)",
};

export const STATUS_COLORS: Record<LeadStatus, string> = {
  neu: "bg-blue-100 text-blue-700",
  in_bearbeitung: "bg-yellow-100 text-yellow-700",
  kontaktiert: "bg-purple-100 text-purple-700",
  follow_up: "bg-orange-100 text-orange-700",
  nachgefasst: "bg-orange-100 text-orange-700",
  erstgespraech: "bg-indigo-100 text-indigo-700",
  qualifiziert: "bg-teal-100 text-teal-700",
  sales_gespraech: "bg-cyan-100 text-cyan-700",
  angebot_gesendet: "bg-pink-100 text-pink-700",
  gewonnen: "bg-green-100 text-green-700",
  verloren: "bg-red-100 text-red-700",
  nachfassen_zukunft: "bg-gray-100 text-gray-700",
};
