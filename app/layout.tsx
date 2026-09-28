import type { Metadata, Viewport } from "next";
import { Fredoka, Inter } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka", weight: ["400", "500", "600", "700"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Zunaid Hasan · AI Twin",
  description:
    "Chat with Zunaid Hasan's AI Twin — AI Engineer, Voice AI Architect & Full-Stack Builder from Dhaka, Bangladesh. Real projects, real answers, production mindset.",
  keywords: ["Zunaid Hasan", "AI Engineer", "AI Twin", "DeshVox", "Bangla NLP", "Voice AI", "Bangladesh", "portfolio"],
  authors: [{ name: "Zunaid Hasan", url: "https://github.com/zunaidhasan" }],
  openGraph: {
    title: "Zunaid Hasan · AI Twin",
    description: "Chat with Zunaid Hasan's AI Twin — production AI from Dhaka 🇧🇩",
    url: "https://zunaidhasan.github.io",
    siteName: "Zunaid Hasan AI Twin",
    images: [{ url: "/me.png", width: 512, height: 512 }],
    locale: "en_US",
    type: "website",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#07070e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Applies the saved theme before first paint (no flash).
// Must read ztwin.settings.v1 — the same key page.tsx persists.
const themeBoot = `(function(){try{var t="studio";var raw=localStorage.getItem("ztwin.settings.v1");if(raw){var s=JSON.parse(raw);if(s&&typeof s.theme==="string")t=s.theme;}document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="studio" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className={`${fredoka.variable} ${inter.variable} min-h-dvh antialiased`}>
        <a
          href="#chat-log"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-[var(--surface)] focus:px-3 focus:py-2"
        >
          Skip to chat
        </a>
        {children}
        {/* PWA service worker */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if ("serviceWorker" in navigator) { window.addEventListener("load", function () { navigator.serviceWorker.register("/sw.js").catch(function(){}); }); }`,
          }}
        />
      </body>
    </html>
  );
}
