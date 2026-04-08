import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { VentureProvider } from "@/context/VentureContext";
import { AuthProvider } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Founder OS",
  description: "Multi-Venture Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className={`${geist.className} bg-gray-50 text-gray-900`} suppressHydrationWarning>
        <AuthProvider>
          <VentureProvider>
            <AppShell>{children}</AppShell>
          </VentureProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
