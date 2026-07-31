import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import ChatWidget from "@/components/ChatWidget";

export const metadata = {
  title: "LuxeStay Resort & Villas | Premium Hotel Experience",
  description: "Experience luxury living with AI-powered concierge service, oceanfront suites, and world-class amenities at LuxeStay.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-800 font-sans antialiased min-h-screen flex flex-col selection:bg-[#0071c2] selection:text-white">
        <AuthProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <ChatWidget />

          <footer className="bg-white border-t border-slate-200 py-8 text-center text-xs text-slate-500">
            <div className="max-w-7xl mx-auto px-4">
              <p className="font-semibold text-slate-700 text-sm mb-2">LuxeStay Resort & Villas</p>
              <p>© {new Date().getFullYear()} LuxeStay Inc. All rights reserved. Made in India with Next.js & FastAPI.</p>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
