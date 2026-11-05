/** Cached multi-octave turbulence: generated once, never per animation frame. */
export function plasmaTexture(color: "blue" | "fire" | "nebula") {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(256, 256);
  const hash = (x: number, y: number) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const noise = (x: number, y: number) => {
    const ix = Math.floor(x),
      iy = Math.floor(y);
    let u = x - ix,
      v = y - iy;
    u = u * u * (3 - 2 * u);
    v = v * v * (3 - 2 * v);
    return (
      (hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u) * (1 - v) +
      (hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u) * v
    );
  };
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const dx = (x - 128) / 128,
        dy = (y - 128) / 128,
        r = Math.hypot(dx, dy);
      let n = 0,
        weight = 0.55;
      for (let octave = 0; octave < 5; octave++) {
        const f = 3 * 2 ** octave;
        n += noise(dx * f + 7, dy * f + 19) * weight;
        weight *= 0.5;
      }
      const ridge = Math.pow(Math.max(0, 1 - Math.abs(n - 0.52) * 7), 3);
      const shade = Math.sqrt(Math.max(0, 1 - r * r));
      const heat = Math.min(1, ridge * 0.8 + shade * 0.3);
      const i = (y * 256 + x) * 4;
      image.data[i] = color === "fire" ? 255 : 35 + heat * 160;
      image.data[i + 1] =
        color === "fire"
          ? 40 + heat * 210
          : color === "nebula"
            ? 15 + heat * 90
            : 80 + heat * 175;
      image.data[i + 2] = color === "fire" ? heat ** 3 * 180 : 140 + heat * 115;
      image.data[i + 3] =
        Math.max(0, Math.min(1, (1 - r) * 12)) * (0.25 + ridge * 0.75) * 255;
    }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
