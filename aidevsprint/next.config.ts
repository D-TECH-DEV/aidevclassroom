import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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

