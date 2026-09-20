import type { Metadata } from "next";
import { SITE_URL } from "@/app/lib/site-config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Studify", template: "%s | Studify" },
  description: "Trasforma i tuoi appunti in materiale di studio chiaro, flashcard e quiz personalizzati.",
  robots: { index: false, follow: false },
  openGraph: { siteName: "Studify", locale: "it_IT", type: "website", images: [{ url: "/og.png", width: 1536, height: 1024, alt: "Studify: appunti, flashcard e quiz" }] },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: "try{document.documentElement.dataset.theme=localStorage.getItem('studify-theme')==='light'?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}" }} /></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
