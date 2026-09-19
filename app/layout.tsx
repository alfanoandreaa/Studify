import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Studify",
  description: "Trasforma i tuoi appunti in materiale di studio chiaro, flashcard e quiz personalizzati.",
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
