import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  ...(process.env.NODE_ENV === "development"
    ? { allowedDevOrigins: ["*.trycloudflare.com"] }
    : {}),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  // Pas de `cacheComponents` : les pages admin lisent la session (cookie) et
  // les pages publiques fetchent l'API au rendu — le pré-rendu statique
  // exigerait des frontières Suspense partout. Le modèle classique rend
  // ces pages dynamiques (voir `dynamic = "force-dynamic"` du panneau
  // admin) et garde l'ISR là où `revalider` est demandé.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

