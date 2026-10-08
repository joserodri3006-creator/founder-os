/**
 * Venture-Branding für öffentliche, kundenseitige Seiten (z. B. Bewertungsformular).
 * Werte stammen aus den jeweiligen Shop-/Website-Designsystemen. Neue Ventures
 * werden hier ergänzt; ohne Eintrag greift das neutrale Founder-OS-Fallback.
 */
export type VentureBranding = {
  venture: string;
  name: string;
  logoUrl: string | null;
  siteUrl: string;
  contactEmail: string | null;
  /** Anrede in kundenseitigen Texten */
  address: "du" | "Sie";
  colors: {
    page: string;
    surface: string;
    border: string;
    ink: string;
    muted: string;
    accent: string;
    accentText: string;
    star: string;
    starOff: string;
    danger: string;
  };
  fonts: { heading: string; body: string; googleFontsUrl: string };
};

const BLAZED: VentureBranding = {
  venture: "blazed_outfitters",
  name: "Blazed Outfitters",
  logoUrl: "https://blazedoutfitters.com/brand/logo-transparent-hires.png",
  siteUrl: "https://www.blazedoutfitters.com",
  contactEmail: "info@blazedoutfitters.com",
  address: "du",
  colors: {
    page: "#EDE8DF",
    surface: "#E4DDD2",
    border: "#D5CCC0",
    ink: "#1C1914",
    muted: "#6B6358",
    accent: "#4A6B52",
    accentText: "#FFFFFF",
    star: "#4A6B52",
    starOff: "#C9BFB1",
    danger: "#9B2C2C",
  },
  fonts: {
    heading: '"Cormorant", Georgia, serif',
    body: '"Jost", system-ui, sans-serif',
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,400;0,500;1,400;1,500&family=Jost:wght@300;400;500&display=swap",
  },
};

const FALLBACK: VentureBranding = {
  venture: "default",
  name: "Founder OS",
  logoUrl: null,
  siteUrl: "https://founder-os-theta.vercel.app",
  contactEmail: null,
  address: "Sie",
  colors: {
    page: "#F7F8FC",
    surface: "#FFFFFF",
    border: "#E5E7EB",
    ink: "#14193A",
    muted: "#6B7280",
    accent: "#14193A",
    accentText: "#FFFFFF",
    star: "#C8A96E",
    starOff: "#D1D5DB",
    danger: "#B91C1C",
  },
  fonts: {
    heading: '"Fraunces", Georgia, serif',
    body: '"Outfit", system-ui, sans-serif',
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;1,9..144,400&family=Outfit:wght@300;400;500;600&display=swap",
  },
};

const BRANDINGS: Record<string, VentureBranding> = {
  blazed_outfitters: BLAZED,
};

export function getBranding(venture: string | null | undefined): VentureBranding {
  return (venture && BRANDINGS[venture]) || FALLBACK;
}
