import Link from "next/link";

export default function CheckoutSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F7F2] px-6 text-[#14193A]">
      <div className="max-w-xl rounded-3xl border border-[#E5DDCE] bg-white p-10 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-green-700">Anzahlung eingegangen</p>
        <h1 className="mt-5 font-serif text-4xl font-light">Willkommen bei Online First.</h1>
        <p className="mt-5 leading-7 text-[#536079]">
          Ihre Zahlung wird verarbeitet. Sie erhalten die nächsten Schritte und den Briefing-Link per E-Mail.
        </p>
        <Link href="/online-first" className="mt-9 inline-flex rounded-full bg-[#1B2A5E] px-7 py-4 font-semibold text-white">
          Zur Übersicht
        </Link>
      </div>
    </div>
  );
}
