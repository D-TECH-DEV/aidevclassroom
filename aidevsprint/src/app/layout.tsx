import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { ScrollFluide } from "@/components/motion/ScrollFluide";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Chasse fixe : les chiffres du compte à rebours ne sautillent pas.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AIdevsprint #1 — Repars avec ton portfolio en ligne",
  description:
    "Formation d'une journée à Yamoussoukro : guider l'IA avec de vraies " +
    "compétences de dev. Le vibe coding, bien fait.",
  openGraph: {
    title: "AIdevsprint #1 — Repars avec ton portfolio en ligne",
    description: "Le vibe coding, bien fait. Formation d'une journée à Yamoussoukro.",
    locale: "fr_CI",
    type: "website",
  },
};

/**
 * `viewportFit: "cover"` laisse la page passer sous l'encoche — sans lui,
 * les `env(safe-area-inset-*)` valent tous 0.
 * `interactiveWidget` fait rétrécir la zone visible quand le clavier Android
 * s'ouvre, comme le fait iOS.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  // Le site est sombre en permanence : une seule valeur, celle du haut de page.
  themeColor: "#010101",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      {/*
        `min-h-svh`, et surtout pas `min-h-full`. Lenis pose sa propre
        feuille de style dès qu'il démarre :

            html.lenis, html.lenis body { height: auto }

        Un `height: 100%` sur `html` n'a donc plus aucun effet, et un
        `min-height: 100%` sur `body` se mesure contre une hauteur
        « auto » — c'est-à-dire contre le contenu lui-même. Le colonnage
        tenait debout tant que la page était plus haute que l'écran ; sur
        une page courte, le pied de page remontait et laissait une bande
        vide en dessous. Mesuré le 2026-10-28 sur `/paiement/retour`.

        Les unités de fenêtre ne passent pas par `html`, donc Lenis ne
        peut pas les contredire. `svh` plutôt que `vh` : sur mobile, la
        petite hauteur est stable, elle ne saute pas quand la barre
        d'adresse se rétracte.
      */}
      <body className="flex min-h-svh flex-col">
        {/* Branche Lenis sur GSAP, une seule fois pour tout le site. */}
        <ScrollFluide />
        {children}
      </body>
    </html>
  );
}
