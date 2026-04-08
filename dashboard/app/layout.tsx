import type { Metadata } from "next";
import "./globals.css";
import { VentureProvider } from "@/context/VentureContext";
import { AuthProvider } from "@/context/AuthContext";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Founder OS",
  description: "Multi-Venture Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;1,9..144,300&family=Outfit:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ background: '#F7F8FC', color: '#14193A' }} suppressHydrationWarning>
        <AuthProvider>
          <VentureProvider>
            <AppShell>{children}</AppShell>
          </VentureProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
