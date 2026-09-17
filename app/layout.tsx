import type { Metadata } from "next";
import "./globals.css";
import { InteractionFixes } from "@/components/interaction-fixes";

export const metadata: Metadata = {
  title: "Quaderno AI",
  description: "Trasforma i tuoi appunti in riassunti, flashcard e quiz personalizzati.",
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
      <body className="antialiased"><InteractionFixes />{children}</body>
    </html>
  );
}
