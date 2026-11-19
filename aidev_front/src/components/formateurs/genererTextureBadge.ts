import type { FormateurPublic } from "@/lib/contenu";

function chargeImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function genererTextureBadge(
  formateur: FormateurPublic,
): Promise<string> {
  const W = 480;
  const H = 694;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#061009";
  ctx.fillRect(0, 0, W, H);

  const halo = ctx.createRadialGradient(W * 0.45, 195, 20, W * 0.48, 215, 280);
  halo.addColorStop(0, "rgba(255, 255, 255, 0.14)");
  halo.addColorStop(0.55, "rgba(46, 230, 107, 0.05)");
  halo.addColorStop(1, "rgba(6, 16, 9, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  const portrait = formateur.photoPath
    ? await chargeImage(formateur.photoPath)
    : null;

  const zoneY = 16;
  const zoneH = 438;

  if (portrait && portrait.naturalWidth > 0) {
    const off = document.createElement("canvas");
    off.width = W;
    off.height = zoneH;
    const octx = off.getContext("2d");

    if (octx) {
      const scale = Math.min(
        (W * 0.88) / portrait.naturalWidth,
        zoneH / portrait.naturalHeight,
      );
      const dw = portrait.naturalWidth * scale;
      const dh = portrait.naturalHeight * scale;
      const dx = (W - dw) / 2;
      const dy = Math.max(0, zoneH - dh);
      octx.drawImage(portrait, dx, dy, dw, dh);

      octx.globalCompositeOperation = "destination-in";
      const mask = octx.createLinearGradient(0, 0, 0, zoneH);
      mask.addColorStop(0, "rgba(0,0,0,1)");
      mask.addColorStop(0.76, "rgba(0,0,0,1)");
      mask.addColorStop(1, "rgba(0,0,0,0)");
      octx.fillStyle = mask;
      octx.fillRect(0, 0, W, zoneH);

      ctx.drawImage(off, 0, zoneY);
    }
  } else {
    const initiales = [formateur.firstName, formateur.lastName]
      .filter(Boolean)
      .map((s) => (s as string)[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2);
    ctx.fillStyle = "#2EE66B";
    ctx.font = "bold 110px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(initiales || "AI", W / 2, 275);
  }

  ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(58, 470);
  ctx.lineTo(W - 58, 470);
  ctx.stroke();

  const nomComplet = (
    formateur.lastName
      ? `${formateur.firstName} ${formateur.lastName}`
      : formateur.firstName
  )
    .trim()
    .toUpperCase();

  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 36px sans-serif";
  ctx.fillText(nomComplet.slice(0, 22), W / 2, 530);

  const roleTexte = formateur.role.trim().toUpperCase().slice(0, 32);
  ctx.font = "bold 24px sans-serif";
  const roleWidth = Math.min(ctx.measureText(roleTexte).width + 36, W - 64);
  const pillX = (W - roleWidth) / 2;
  const pillY = 550;
  const pillH = 38;
  ctx.fillStyle = "rgba(46, 230, 107, 0.16)";
  ctx.strokeStyle = "rgba(61, 245, 122, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, roleWidth, pillH, 19);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#4DFF88";
  ctx.fillText(roleTexte, W / 2, 577);

  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  ctx.font = "bold 15px monospace";
  ctx.fillText("AIDEVCLASSROOM", W / 2, 636);

  ctx.fillStyle = "#2EE66B";
  ctx.fillRect(0, 0, W, 16);

  return canvas.toDataURL("image/webp", 0.9);
}
