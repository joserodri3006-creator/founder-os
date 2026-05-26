import Link from "next/link";

const included = [
  "Strategische Startseite mit klarem Angebot",
  "Leistungsseite mit Nutzenargumentation",
  "Über-mich- oder Über-uns-Seite für Vertrauen und Positionierung",
  "Kontakt- oder Terminseite mit Anfrage- oder Buchungslogik",
  "Struktur für Impressum und Datenschutz",
  "Kontakt- oder Termin-Funnel für neue Anfragen",
  "Responsive Umsetzung für Desktop und Mobile",
  "Technischer Launch inklusive Basis-SEO",
  "Ein klarer Projektablauf mit planbarem Umfang",
];

const problems = [
  "Ihr Angebot wirkt online nicht so hochwertig wie im persönlichen Gespräch",
  "Besucher wissen nicht sofort, ob sie bei Ihnen richtig sind",
  "Kontaktanfragen kommen unregelmäßig oder unqualifiziert",
  "Ihre Website erklärt zu viel, aber verkauft zu wenig",
  "Es fehlt ein klarer nächster Schritt zum Erstgespräch",
];

const solutions = [
  "Klare Positionierung statt austauschbarer Website-Texte",
  "Vertrauensaufbau durch starke Angebots- und Expertenstruktur",
  "Bessere Vorqualifizierung durch gezielte Fragen im Kontaktprozess",
  "Professioneller Auftritt für Empfehlungen, LinkedIn, Instagram und Ads",
  "Eine Website, die Interessenten vorbereitet, bevor sie mit Ihnen sprechen",
];

const process = [
  {
    title: "Fit-Check",
    text: "Sie beantworten wenige Fragen zu Angebot, Zielgruppe und aktuellem Stand. So prüfen wir, ob das Paket zu Ihrem Vorhaben passt.",
  },
  {
    title: "Projektfreigabe",
    text: "Wenn das Projekt passt, erhalten Sie eine klare Empfehlung zum Umfang. Nach Freigabe und Startzahlung wird Ihr Umsetzungsslot reserviert.",
  },
  {
    title: "Strategie-Briefing",
    text: "Angebot, Zielgruppe, Inhalte und gewünschter Anfrageprozess werden strukturiert aufgenommen.",
  },
  {
    title: "Umsetzung",
    text: "Design, Seitenstruktur, Textelemente, Kontakt- oder Termin-Funnel und mobile Optimierung werden umgesetzt.",
  },
  {
    title: "Launch",
    text: "Die Website wird final geprüft, technisch veröffentlicht und ist bereit für neue Anfragen.",
  },
];

const suitableFor = [
  "Coaches und Berater mit einem klaren Angebot",
  "Selbstständige, die professioneller auftreten wollen",
  "Experten, die mehr qualifizierte Erstgespräche gewinnen möchten",
  "Dienstleister, die Empfehlungen, LinkedIn, Instagram oder Ads besser in Anfragen verwandeln wollen",
  "Anbieter, die eine hochwertige Website mit klarem Umfang und planbarem Prozess benötigen",
];

const notSuitableFor = [
  "Personen ohne klares Angebot",
  "Projekte ohne Bereitschaft, Inhalte und Feedback zu liefern",
  "Komplexe Plattformen, Mitgliederbereiche oder große Shops",
  "Unternehmen, die eine vollständig individuelle Markenstrategie von Grund auf benötigen",
  "Kunden, die nur irgendeine günstige Website suchen",
];

const beforeAfter = [
  { before: "Unklare Website", after: "Klares Angebot" },
  { before: "Zu wenig Vertrauen", after: "Professioneller Expertenauftritt" },
  { before: "Keine klare Anfrageführung", after: "Strukturierter Kontakt- oder Termin-Funnel" },
  { before: "Unregelmäßige oder unpassende Leads", after: "Besser vorbereitete Interessenten" },
  { before: "Zu viel Erklärung im Erstgespräch", after: "Stärkerer Auftritt für Empfehlungen und Social Media" },
];

const futureExtensions = [
  "Copywriting für alle Seiten",
  "KI-gestützter Lead-Fragebogen",
  "Automatische Lead-Qualifizierung",
  "CRM-Anbindung und E-Mail-Sequenzen",
  "Conversion-Tracking",
  "FAQ- oder Angebotsassistent mit KI",
  "LinkedIn- oder Instagram-Landingpage-Erweiterung",
];

const faqs = [
  {
    question: "Wie lange dauert die Umsetzung?",
    answer: "In der Regel dauert die Umsetzung je nach Rückmeldung und Inhaltslage wenige Wochen. Der konkrete Zeitplan wird nach dem Fit-Check abgestimmt.",
  },
  {
    question: "Muss ich fertige Texte liefern?",
    answer: "Nein. Inhalte können gemeinsam strukturiert werden. Wichtig ist, dass Angebot, Zielgruppe und Leistungen klar besprochen werden.",
  },
  {
    question: "Ist der Preis fix?",
    answer: "Das Kernpaket startet bei 2.490 EUR netto. Wenn zusätzliche Seiten, Texte, Automationen oder Sonderfunktionen benötigt werden, wird der Umfang separat abgestimmt.",
  },
  {
    question: "Ist ein Terminbuchungssystem enthalten?",
    answer: "Ja, auf Wunsch wird ein Kontakt- oder Termin-Funnel integriert, zum Beispiel über ein Buchungstool oder ein strukturiertes Anfrageformular.",
  },
  {
    question: "Ist die Website mobil optimiert?",
    answer: "Ja, die Website wird responsive für Desktop und Mobile umgesetzt.",
  },
  {
    question: "Für wen ist das Paket nicht geeignet?",
    answer: "Nicht geeignet ist das Paket für sehr komplexe Plattformen, große Shops, Mitgliederbereiche oder Projekte ohne klares Angebot.",
  },
];

function CheckList({ items, tone = "gold" }: { items: string[]; tone?: "gold" | "green" | "muted" | "light" }) {
  const marker = tone === "green" ? "#17734E" : tone === "muted" ? "#6B7280" : tone === "light" ? "#C8A96E" : "#A07840";
  return (
    <ul className="space-y-4 text-sm leading-6 sm:text-[15px]">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-0.5 font-semibold" style={{ color: marker }}>+</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function OnlineFirstPage() {
  return (
    <div className="min-h-screen bg-[#F8F7F2] text-[#14193A]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-7">
        <p className="font-serif text-xl tracking-[0.16em]">ONLINE FIRST</p>
        <Link href="/online-first/fit" className="rounded-full bg-[#14193A] px-5 py-3 text-sm font-semibold text-white">
          Fit-Check starten
        </Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-6 pb-16 pt-10 lg:grid-cols-[1.07fr_0.93fr] lg:pb-24 lg:pt-16">
          <div>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.26em] text-[#A07840]">
              Für Coaches, Berater und Experten
            </p>
            <h1 className="max-w-3xl font-serif text-5xl font-light leading-[1.08] tracking-tight sm:text-6xl">
              Ihre Beratungswebsite als Anfrage-System.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#536079]">
              Für Coaches und Berater, die klar positioniert auftreten, Vertrauen aufbauen und
              qualifizierte Erstgespräche gewinnen wollen: mit einer professionellen Website
              inklusive Kontakt- oder Termin-Funnel.
            </p>
            <p className="mt-6 max-w-xl text-sm leading-7 text-[#536079]">
              Ihre Website erklärt klar, wofür Sie stehen, wem Sie helfen und warum ein Gespräch sinnvoll ist.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link href="/online-first/fit" className="rounded-full bg-[#1B2A5E] px-7 py-4 font-semibold text-white">
                Fit-Check starten
              </Link>
              <a href="#umfang" className="rounded-full border border-[#D8D1C2] px-7 py-4 font-semibold">
                Paketumfang ansehen
              </a>
            </div>
          </div>

          <div id="umfang" className="rounded-3xl border border-[#E5DDCE] bg-white p-7 shadow-sm sm:p-9">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A07840]">Kernpaket</p>
            <h2 className="mt-4 font-serif text-3xl font-light">Coach &amp; Berater Website Sprint</h2>
            <p className="mt-3 text-sm leading-6 text-[#536079]">
              4 verkaufsrelevante Seiten, rechtliche Pflichtseiten-Struktur und Kontakt- oder Termin-Funnel.
            </p>
            <p className="mt-8 font-serif text-5xl font-light">2.490 EUR</p>
            <p className="mt-2 text-sm text-[#536079]">netto, zzgl. USt.</p>
            <p className="mt-4 rounded-xl bg-[#F8F7F2] px-4 py-3 text-sm text-[#536079]">
              50 % Startzahlung zur Sicherung des Umsetzungsslots.
            </p>
            <div className="mt-8 border-t border-[#EEE8DC] pt-7">
              <CheckList items={included} />
            </div>
          </div>
        </section>

        <section className="border-y border-[#E8E1D4] bg-white px-6 py-20">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#A07840]">Das Problem</p>
              <h2 className="mt-4 font-serif text-4xl font-light leading-tight">
                Wenn Ihre Website nicht verkauft, verliert Ihre Expertise an Wirkung.
              </h2>
              <p className="mt-6 text-[15px] leading-7 text-[#536079]">
                Viele Coaches und Berater haben ein starkes Angebot, aber ihre Website erklärt es
                nicht klar genug. Besucher verstehen nicht sofort, für wen das Angebot ist, welches
                Problem gelöst wird und warum ein Erstgespräch sinnvoll ist.
              </p>
              <p className="mt-4 text-[15px] leading-7 text-[#536079]">
                Empfehlungen verpuffen, Social-Media-Besucher springen ab und potenzielle Kunden
                melden sich nicht, obwohl grundsätzlich Interesse vorhanden wäre.
              </p>
            </div>
            <div className="rounded-3xl bg-[#F8F7F2] p-7 sm:p-9">
              <CheckList items={problems} tone="muted" />
            </div>
          </div>
        </section>

        <section className="px-6 py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-3xl bg-[#14193A] p-7 text-white sm:p-9">
              <CheckList items={solutions} tone="light" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#A07840]">Die Lösung</p>
              <h2 className="mt-4 font-serif text-4xl font-light leading-tight">
                Aus Ihrer Website wird ein klarer Anfrage-Prozess.
              </h2>
              <p className="mt-6 text-[15px] leading-7 text-[#536079]">
                Der Website Sprint verbindet Positionierung, Struktur, Design und Anfrageführung.
                So entsteht keine beliebige Website, sondern ein digitales System, das Ihre
                Expertise verständlich macht, Vertrauen aufbaut und Interessenten gezielt zum
                nächsten Schritt führt.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-[#14193A] px-6 py-20 text-white">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#C8A96E]">Der Ablauf</p>
            <h2 className="mt-4 max-w-xl font-serif text-4xl font-light">Ein planbarer Weg zu Ihrer Anfrage-Website</h2>
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
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

        <section className="px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#A07840]">Passung</p>
            <h2 className="mt-4 font-serif text-4xl font-light">Für wen dieses Paket geeignet ist</h2>
            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-[#DCE7DF] bg-white p-7 sm:p-9">
                <h3 className="mb-7 text-lg font-semibold text-[#17734E]">Geeignet für</h3>
                <CheckList items={suitableFor} tone="green" />
              </div>
              <div className="rounded-3xl border border-[#E5DDCE] bg-white p-7 sm:p-9">
                <h3 className="mb-7 text-lg font-semibold text-[#536079]">Nicht geeignet für</h3>
                <CheckList items={notSuitableFor} tone="muted" />
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-[#E8E1D4] bg-white px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#A07840]">Transformation</p>
              <h2 className="mt-4 font-serif text-4xl font-light">Was sich nach dem Website Sprint verändert</h2>
            </div>
            <div className="mt-12 overflow-hidden rounded-3xl border border-[#E5DDCE]">
              <div className="grid grid-cols-2 bg-[#F8F7F2] px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#A07840] sm:px-8">
                <p>Vorher</p>
                <p>Nachher</p>
              </div>
              {beforeAfter.map(({ before, after }) => (
                <div key={before} className="grid grid-cols-2 border-t border-[#EEE8DC] px-5 py-5 text-sm sm:px-8 sm:text-base">
                  <p className="pr-5 text-[#536079]">{before}</p>
                  <p className="font-medium">{after}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-20">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_0.92fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#A07840]">Vertrauen</p>
              <h2 className="mt-4 font-serif text-4xl font-light">Warum Online First?</h2>
              <p className="mt-6 max-w-2xl text-[15px] leading-7 text-[#536079]">
                Online First entwickelt Websites nicht als digitale Visitenkarten, sondern als
                klare Verkaufs- und Anfrage-Systeme. Der Fokus liegt auf Positionierung, Struktur,
                Nutzerführung und einem sauberen Projektprozess, damit aus Besuchern bessere
                Anfragen werden.
              </p>
              <p className="mt-7 inline-flex rounded-full border border-[#E5DDCE] bg-white px-5 py-3 text-sm font-medium">
                Entwickelt für Coaches, Berater und Experten
              </p>
            </div>
            <div className="rounded-3xl border border-[#E5DDCE] bg-white p-7 sm:p-9">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#A07840]">
                Beispielprojekte folgen
              </p>
              <p className="mt-5 text-sm leading-7 text-[#536079]">
                Ausgewählte Arbeiten und Kundenstimmen werden hier veröffentlicht, sobald die
                jeweilige Freigabe vorliegt. Ihr Projekt startet mit einem nachvollziehbaren
                Prozess und klar definiertem Umfang.
              </p>
              <div className="mt-7 grid grid-cols-3 gap-3">
                {["Struktur", "Positionierung", "Anfragen"].map((item) => (
                  <div key={item} className="rounded-xl bg-[#F8F7F2] px-3 py-5 text-center text-xs font-semibold text-[#536079]">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-[#F2EFE8] px-6 py-20">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#A07840]">Ausbaubar</p>
              <h2 className="mt-4 font-serif text-4xl font-light">Bereit für spätere Automationen</h2>
              <p className="mt-6 text-[15px] leading-7 text-[#536079]">
                Der Website Sprint ist der klare Einstieg. Wenn Ihre Anfragen wachsen, kann der
                Prozess um Qualifizierung, CRM, E-Mail und Conversion-Messung erweitert werden.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {futureExtensions.map((extension) => (
                <p key={extension} className="rounded-xl border border-[#E5DDCE] bg-white px-5 py-4 text-sm">
                  {extension}
                </p>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-20">
          <div className="mx-auto max-w-4xl">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#A07840]">FAQ</p>
              <h2 className="mt-4 font-serif text-4xl font-light">Häufige Fragen</h2>
            </div>
            <div className="mt-12 space-y-3">
              {faqs.map(({ question, answer }) => (
                <details key={question} className="group rounded-2xl border border-[#E5DDCE] bg-white p-6">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-5 font-semibold">
                    {question}
                    <span className="text-[#A07840] group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-[#536079]">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 pb-24">
          <div className="mx-auto max-w-5xl rounded-3xl bg-[#14193A] px-7 py-14 text-center text-white sm:px-14">
            <h2 className="font-serif text-4xl font-light">Wird Ihre Expertise online klar genug sichtbar?</h2>
            <p className="mx-auto mt-5 max-w-2xl leading-7 text-white/70">
              Prüfen Sie, ob der Coach &amp; Berater Website Sprint zu Ihrem Angebot und Ihrem Anfrageprozess passt.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-4">
              <Link href="/online-first/fit" className="rounded-full bg-white px-8 py-4 font-semibold text-[#14193A]">
                Fit-Check starten
              </Link>
              <a href="#umfang" className="rounded-full border border-white/30 px-8 py-4 font-semibold text-white">
                Paketumfang ansehen
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
