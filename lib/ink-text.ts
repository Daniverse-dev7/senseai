/** Isolate ink alpha, crop whitespace, and produce high-contrast OCR input. */
export function prepareInkText(
  source: HTMLCanvasElement,
): HTMLCanvasElement | null {
  const ctx = source.getContext("2d")!;
  const { width: w, height: h } = source;
  const data = ctx.getImageData(0, 0, w, h).data;
  let minX = w,
    minY = h,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > 40) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
  if (maxX < 0) return null;
  const crop = document.createElement("canvas"),
    cw = maxX - minX + 1,
    ch = maxY - minY + 1;
  crop.width = cw;
  crop.height = ch;
  const c = crop.getContext("2d")!,
    pixels = c.createImageData(cw, ch);
  for (let y = 0; y < ch; y++)
    for (let x = 0; x < cw; x++) {
      const a = data[((y + minY) * w + x + minX) * 4 + 3],
        i = (y * cw + x) * 4;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255 - a;
      pixels.data[i + 3] = 255;
    }
  c.putImageData(pixels, 0, 0);
  const out = document.createElement("canvas"),
    scale = Math.min(3, 1600 / cw, 1000 / ch);
  out.width = Math.ceil(cw * scale) + 64;
  out.height = Math.ceil(ch * scale) + 64;
  const o = out.getContext("2d")!;
  o.fillStyle = "white";
  o.fillRect(0, 0, out.width, out.height);
  o.drawImage(crop, 32, 32, cw * scale, ch * scale);
  return out;
}
export type TextStyle = "editorial" | "signature" | "modern";
export function renderStyledText(
  canvas: HTMLCanvasElement,
  text: string,
  style: TextStyle,
) {
  const c = canvas.getContext("2d")!,
    w = canvas.width,
    h = canvas.height;
  c.clearRect(0, 0, w, h);
  if (!text.trim()) {
    canvas.dataset.active = "false";
    return;
  }
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#101827");
  g.addColorStop(1, "#080b12");
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  const lines = text
    .trim()
    .slice(0, 160)
    .split(/\n/)
    .flatMap((line) => {
      const words = line.split(/\s+/),
        result: string[] = [];
      let row = "";
      for (const word of words) {
        if ((row + " " + word).length > 28 && row) {
          result.push(row);
          row = word;
        } else row += (row ? " " : "") + word;
      }
      result.push(row);
      return result;
    });
  const family =
    style === "editorial"
      ? "Georgia, serif"
      : style === "signature"
        ? '"Brush Script MT", "Segoe Script", cursive'
        : "Arial, sans-serif";
  let size = Math.min(w * 0.075, (h * 0.58) / Math.max(1, lines.length));
  c.font = `${style === "signature" ? "italic " : ""}${style === "modern" ? 600 : 400} ${size}px ${family}`;
  const longest = Math.max(...lines.map((line) => c.measureText(line).width));
  if (longest > w * 0.8) size *= (w * 0.8) / longest;
  c.font = `${style === "signature" ? "italic " : ""}${style === "modern" ? 600 : 400} ${size}px ${family}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle =
    style === "editorial"
      ? "#ead6ac"
      : style === "signature"
        ? "#b5ddff"
        : "#f0f4fc";
  lines.forEach((line, i) =>
    c.fillText(line, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.35),
  );
  c.strokeStyle = "#7f99b155";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(w * 0.38, h * 0.82);
  c.lineTo(w * 0.62, h * 0.82);
  c.stroke();
  canvas.dataset.active = "true";
}
