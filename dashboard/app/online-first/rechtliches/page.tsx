import Link from "next/link";

export default function LegalDocumentsPage() {
  return (
    <div className="min-h-screen bg-[#F8F7F2] px-6 py-10 text-[#14193A]">
      <div className="mx-auto max-w-3xl rounded-3xl border border-[#E5DDCE] bg-white p-8 shadow-sm sm:p-12">
        <Link href="/online-first/fit" className="text-sm text-[#536079]">← Zurück zum Projekt-Fit</Link>
        <p className="mt-9 text-xs font-semibold uppercase tracking-[0.22em] text-[#A07840]">Rechtliche Dokumente</p>
        <h1 className="mt-4 font-serif text-4xl font-light">Vor Produktivstart zu hinterlegen</h1>
        <p className="mt-6 leading-7 text-[#536079]">
          Leistungsbeschreibung, B2B-Vertragsbedingungen, Datenschutzhinweise und
          Tracking-Einwilligung werden vor Aktivierung des Online-Checkouts juristisch
          geprüft und an dieser Stelle veröffentlicht.
        </p>
        <div className="mt-9 rounded-2xl bg-[#F8F7F2] p-6 text-sm leading-7">
          Der Checkout bleibt technisch gesperrt, bis die freigegebenen Fassungen
          hinterlegt und die Produktionskonfiguration aktiviert sind.
        </div>
      </div>
    </div>
  );
}
