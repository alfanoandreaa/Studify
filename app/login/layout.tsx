import type { Metadata } from "next";
export const metadata: Metadata = { title: "Accedi", description: "Accedi a Studify con email e password.", robots: { index: false, follow: false } };
export default function LoginLayout({ children }: { children: React.ReactNode }) { return children; }
