import Link from "next/link";

const included = [
  "Strategische Startseite mit klarem Angebot",
  "Leistungsseite und persönliche Über-mich-Seite",
  "Vertrauens- und Kontaktseite",
  "Kontakt- oder Termin-Funnel fuer neue Anfragen",
  "Responsive Umsetzung und technischer Launch",
];

const process = [
  { title: "Fit-Check", text: "Sie beantworten wenige Fragen. Passende Projekte können direkt starten." },
  { title: "Anzahlung", text: "Nach Auftragserteilung sichern 50 % Anzahlung Ihren Produktionsslot." },
  { title: "Briefing", text: "Sie liefern Inhalte und Ausrichtung strukturiert über den Projektbogen." },
  { title: "Website", text: "Ihre neue Leadgen-Website wird umgesetzt, abgestimmt und veröffentlicht." },
];

export default function OnlineFirstPage() {
  return (
    <div className="min-h-screen bg-[#F8F7F2] text-[#14193A]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7">
        <p className="font-serif text-xl tracking-[0.16em]">ONLINE FIRST</p>
        <Link href="/online-first/fit" className="rounded-full bg-[#14193A] px-5 py-3 text-sm font-semibold text-white">
          Projekt prüfen
        </Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-6 pb-20 pt-10 lg:grid-cols-[1.08fr_0.92fr] lg:pt-20">
          <div>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.26em] text-[#A07840]">
              Für Berater und Coaches
            </p>
            <h1 className="max-w-3xl font-serif text-5xl font-light leading-[1.08] tracking-tight sm:text-6xl">
              Eine Website, die aus Kompetenz Anfragen macht.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#536079]">
              Ihre standardisierte Leadgen-Website mit klarem Angebot, professioneller
              Positionierung und Kontakt-Funnel. Planbar im Umfang, direkt online startbar.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link href="/online-first/fit" className="rounded-full bg-[#1B2A5E] px-7 py-4 font-semibold text-white">
                Fit-Check starten
              </Link>
              <a href="#umfang" className="rounded-full border border-[#D8D1C2] px-7 py-4 font-semibold">
                Umfang ansehen
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-[#E5DDCE] bg-white p-7 shadow-sm sm:p-9">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A07840]">Kernpaket</p>
            <h2 className="mt-4 font-serif text-3xl font-light">Leadgen-Website</h2>
            <p className="mt-3 text-sm leading-6 text-[#536079]">5 Seiten inklusive Kontakt- oder Termin-Funnel</p>
            <p className="mt-8 font-serif text-5xl font-light">2.490 EUR</p>
            <p className="mt-2 text-sm text-[#536079]">netto, zzgl. USt. / 50 % Anzahlung zum Start</p>
            <ul className="mt-8 space-y-4 border-t border-[#EEE8DC] pt-7 text-sm">
              {included.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="text-[#A07840]">+</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="umfang" className="bg-[#14193A] px-6 py-20 text-white">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#C8A96E]">Der Ablauf</p>
            <h2 className="mt-4 max-w-xl font-serif text-4xl font-light">Vom Fit-Check zum Projektstart</h2>
            <div className="mt-12 grid gap-5 md:grid-cols-4">
              {process.map((item, index) => (
                <article key={item.title} className="rounded-2xl border border-white/10 p-6">
                  <p className="text-xs text-[#C8A96E]">0{index + 1}</p>
                  <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/65">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="font-serif text-4xl font-light">Passt das Paket zu Ihrem Vorhaben?</h2>
          <p className="mx-auto mt-5 max-w-2xl text-[#536079]">
            Der Fit-Check erkennt automatisch, ob Sie direkt starten können oder ein kurzes Gespräch sinnvoller ist.
          </p>
          <Link href="/online-first/fit" className="mt-10 inline-flex rounded-full bg-[#1B2A5E] px-8 py-4 font-semibold text-white">
            Projekt jetzt prüfen
          </Link>
        </section>
      </main>
    </div>
  );
}
