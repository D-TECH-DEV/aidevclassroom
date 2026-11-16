import { BoutonReserver } from "@/components/inscription/BoutonReserver";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Section — la dernière relance.
 *
 * Transcription du design `Landing — ai-dev-sprint.com@2x.png`.
 * Une question, un bouton, rien d'autre. C'est le dernier endroit où le
 * visiteur peut décider : tout ce qui n'est pas la décision y est bruit.
 *
 * Le bouton était en vert plein, repris du design. Malik a tranché le
 * 2026-10-20 : « Réserver ma place » est le même bouton partout, animation
 * comprise. C'est donc `CtaButton`, comme dans la navbar, le hero et la
 * section Session.
 *
 * La lueur verte → bleue du bas reprend celle de l'affiche.
 */
export function CtaFinal() {
  return (
    <section
      id="reserver"
      className="relative isolate overflow-hidden py-[clamp(5rem,16svh,11rem)]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: [
            "radial-gradient(55% 70% at 25% 115%, color-mix(in oklab, var(--color-glow-green) 45%, transparent) 0%, transparent 65%)",
            "radial-gradient(55% 70% at 80% 110%, color-mix(in oklab, var(--color-glow-blue) 70%, transparent) 0%, transparent 65%)",
          ].join(", "),
        }}
      />

      <Reveal className="shell flex flex-col items-center text-center">
        <h2 className="max-w-[22ch] text-h1 font-bold leading-[1.05] tracking-tighter">
          Prêt à coder <em>proprement</em> avec l&apos;IA ?
        </h2>

        <BoutonReserver className="mt-[clamp(2rem,6svh,3.5rem)]" />
      </Reveal>
    </section>
  );
}
