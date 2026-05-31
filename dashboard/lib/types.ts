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

export type LeadReviewStatus = "unreviewed" | "reviewed" | "ready_for_outreach" | "blocked";
export type LeadPotential = "a_potential" | "b_potential" | "not_fit";
export type LeadContactChannel = "unchecked" | "email_ok" | "phone_better" | "linkedin_better" | "do_not_contact";
export type LeadNextAction =
  | "website_pruefen"
  | "linkedin_pruefen"
  | "erstansprache_vorbereiten"
  | "fit_check_senden"
  | "nachfassen"
  | "archivieren";

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
  review_status: LeadReviewStatus;
  lead_potential: LeadPotential | null;
  contact_channel: LeadContactChannel;
  next_action: LeadNextAction;
  review_notes: string | null;
  reviewed_at: string | null;
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

export const REVIEW_STATUS_LABELS: Record<LeadReviewStatus, string> = {
  unreviewed: "Ungeprüft",
  reviewed: "Geprüft",
  ready_for_outreach: "Ansprache bereit",
  blocked: "Blockiert",
};

export const LEAD_POTENTIAL_LABELS: Record<LeadPotential, string> = {
  a_potential: "A-Potenzial",
  b_potential: "B-Potenzial",
  not_fit: "Nicht passend",
};

export const CONTACT_CHANNEL_LABELS: Record<LeadContactChannel, string> = {
  unchecked: "Kontaktweg ungeprüft",
  email_ok: "E-Mail freigegeben",
  phone_better: "Telefon besser",
  linkedin_better: "LinkedIn besser",
  do_not_contact: "Nicht kontaktieren",
};

export const NEXT_ACTION_LABELS: Record<LeadNextAction, string> = {
  website_pruefen: "Website prüfen",
  linkedin_pruefen: "LinkedIn ansehen",
  erstansprache_vorbereiten: "Erstansprache vorbereiten",
  fit_check_senden: "Fit-Check senden",
  nachfassen: "Nachfassen",
  archivieren: "Archivieren",
};
