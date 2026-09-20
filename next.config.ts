import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Strict-Transport-Security", value: "max-age=31536000" },
      // Vinext embeds bootstrap and theme scripts; a strict script nonce CSP
      // requires a separate runtime change. Restrict frames and external data.
      { key: "Content-Security-Policy", value: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://rdxfhjjhvdztchwbqgea.supabase.co wss://rdxfhjjhvdztchwbqgea.supabase.co" },
    ] }];
  },
};

export default nextConfig;
