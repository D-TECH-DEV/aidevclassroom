import { ImageResponse } from "next/og";

import { A_DETERMINER, recupereEdition } from "@/lib/edition";

export const alt =
  "AIDevClassroom — Formation intensive Développement Web & IA en Côte d'Ivoire";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  const edition = await recupereEdition();
  const titre = edition?.nom ?? "Sprint Développement Web & IA";
  const description =
    edition?.description ??
    "Apprends à guider l'IA avec une méthode d'ingénierie logicielle et déploie ton application web en ligne.";
  const ville =
    edition && edition.ville !== A_DETERMINER ? edition.ville : "Yamoussoukro";
  const format =
    edition && edition.format !== A_DETERMINER
      ? edition.format
      : "Formation présentielle";
  const prix = edition
    ? `À partir de ${edition.prixFCFA.toLocaleString("fr-FR")} FCFA`
    : "Inscriptions par sprint";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#010101",
          color: "#f2f5f3",
          padding: "64px 72px",
          fontFamily: "sans-serif",
          backgroundImage:
            "radial-gradient(circle at 12% 18%, rgba(46, 230, 107, 0.25) 0%, transparent 45%), radial-gradient(circle at 88% 85%, rgba(11, 99, 246, 0.28) 0%, transparent 50%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: "-0.03em",
            }}
          >
            <span style={{ color: "#2ee66b" }}>AI</span>
            <span style={{ color: "#f2f5f3" }}>DevClassroom</span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              border: "1px solid rgba(46, 230, 107, 0.5)",
              borderRadius: 9999,
              padding: "10px 24px",
              fontSize: 20,
              color: "#2ee66b",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {`${format} · ${ville}`}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 22,
            maxWidth: 980,
          }}
        >
          <div
            style={{
              fontSize: 68,
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: "-0.04em",
              color: "#f2f5f3",
            }}
          >
            {titre}
          </div>
          <div
            style={{
              fontSize: 28,
              lineHeight: 1.38,
              color: "rgba(242, 245, 243, 0.78)",
              maxWidth: 880,
            }}
          >
            {description.length > 165
              ? `${description.slice(0, 162)}...`
              : description}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            borderTop: "1px solid rgba(242, 245, 243, 0.16)",
            paddingTop: 28,
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "#2ee66b",
            }}
          >
            {prix}
          </div>
          <div
            style={{
              fontSize: 22,
              color: "rgba(242, 245, 243, 0.65)",
            }}
          >
            Toi aux commandes. L&apos;IA à l&apos;exécution.
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
