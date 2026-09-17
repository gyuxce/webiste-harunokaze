const NAME_COLOR = "#c41e3a";
const NAME_FONT = '"Great Vibes"';
const FONT_PATH = "/certificate/great-vibes.woff2";
const SCALE = 2;

let fontFacePromise: Promise<FontFace> | null = null;

export function certificateNameFontSize(fullName: string): number {
  const nameLength = fullName.trim().length;
  return nameLength > 32 ? 42 : nameLength > 24 ? 48 : 56;
}

/**
 * Great Vibes is a script font whose capitals are decorative swashes meant
 * for one letter per word, not a run of them — a name typed in ALL CAPS
 * (common on Indonesian registration forms) renders as a broken, overlapping
 * mess. Normalize to Title Case before it ever touches that font.
 */
export function formatCertificateName(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

async function loadGreatVibesFace(): Promise<FontFace> {
  if (!fontFacePromise) {
    fontFacePromise = (async () => {
      const response = await fetch(FONT_PATH);
      if (!response.ok) {
        throw new Error("Gagal memuat font nama sertifikat.");
      }
      const buffer = await response.arrayBuffer();
      const face = new FontFace("Great Vibes", buffer, { weight: "400", style: "normal" });
      await face.load();
      document.fonts.add(face);
      if (document.fonts.ready) {
        await document.fonts.ready;
      }
      return face;
    })();
  }
  return fontFacePromise;
}

function inkMetrics(ctx: CanvasRenderingContext2D, text: string) {
  const metrics = ctx.measureText(text);
  const left = metrics.actualBoundingBoxLeft || 0;
  const right = metrics.actualBoundingBoxRight || metrics.width;
  const ascent = metrics.actualBoundingBoxAscent || parseFloat(ctx.font) * 0.8;
  const descent = metrics.actualBoundingBoxDescent || parseFloat(ctx.font) * 0.35;
  return {
    left,
    right,
    width: Math.max(left + right, metrics.width),
    ascent,
    descent,
  };
}

function wrapName(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (inkMetrics(ctx, text).width <= maxWidth) return [text];
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return [text];

  const lines: string[] = [];
  let current = words[0];
  for (let index = 1; index < words.length; index += 1) {
    const candidate = `${current} ${words[index]}`;
    if (inkMetrics(ctx, candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[index];
    }
  }
  lines.push(current);
  return lines;
}

function fitName(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  preferredSize: number,
): { lines: string[]; fontSize: number } {
  let fontSize = preferredSize;
  while (fontSize >= 36) {
    ctx.font = `400 ${fontSize}px ${NAME_FONT}`;
    const lines = wrapName(ctx, text, maxWidth);
    const widest = Math.max(...lines.map((line) => inkMetrics(ctx, line).width));
    if (widest <= maxWidth && lines.length <= 2) {
      return { lines, fontSize };
    }
    fontSize -= 2;
  }
  ctx.font = `400 ${fontSize}px ${NAME_FONT}`;
  return { lines: wrapName(ctx, text, maxWidth), fontSize };
}

/** Paint the recipient name with optical centering so html2canvas only copies pixels. */
export async function paintRecipientNameDataUrl(
  fullName: string,
  cssWidth: number,
  preferredSize: number,
): Promise<string> {
  await loadGreatVibesFace();
  const text = formatCertificateName(fullName) || "Peserta";
  const width = Math.max(120, Math.round(cssWidth));
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) {
    throw new Error("Canvas nama sertifikat tidak tersedia.");
  }

  const fitted = fitName(probe, text, width * 0.94, preferredSize);
  const lineHeight = fitted.fontSize * 1.28;
  const height = Math.ceil(lineHeight * fitted.lines.length + fitted.fontSize * 0.28);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * SCALE);
  canvas.height = Math.round(height * SCALE);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas nama sertifikat tidak tersedia.");
  }

  ctx.scale(SCALE, SCALE);
  ctx.font = `400 ${fitted.fontSize}px ${NAME_FONT}`;
  ctx.fillStyle = NAME_COLOR;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  fitted.lines.forEach((line, index) => {
    const ink = inkMetrics(ctx, line);
    const x = width / 2 - ink.width / 2 + ink.left;
    const y = fitted.fontSize * 0.22 + ink.ascent + index * lineHeight;
    ctx.fillText(line, x, y);
  });

  return canvas.toDataURL("image/png");
}

export async function replaceRecipientNameWithArt(
  certificateDocument: Document,
  fullName: string,
): Promise<void> {
  const slot = certificateDocument.querySelector<HTMLElement>(".name");
  if (!slot) return;

  if (!slot.clientWidth) {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  }

  const cssWidth = slot.clientWidth || 788;
  const preferredSize = certificateNameFontSize(fullName);
  const dataUrl = await paintRecipientNameDataUrl(fullName, cssWidth, preferredSize);
  const image = certificateDocument.createElement("img");
  image.className = "name-art";
  image.alt = fullName;
  image.style.display = "block";
  image.style.width = "100%";
  image.style.height = "auto";
  image.src = dataUrl;

  await new Promise<void>((resolve) => {
    image.onload = () => resolve();
    image.onerror = () => resolve();
  });

  slot.replaceWith(image);
}
