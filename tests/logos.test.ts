import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { decodeIco, findIconCandidates, LOGO_SIZE, normalizeLogo } from "@/lib/logos";

/** A two-colour square image (logo-like: has variation). */
const logoPng = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 4, background: { r: 200, g: 20, b: 20, alpha: 1 } } })
    .composite([{ input: Buffer.from(`<svg width="${w}" height="${h}"><rect x="${w / 4}" y="${h / 4}" width="${w / 2}" height="${h / 2}" fill="white"/></svg>`) }])
    .png()
    .toBuffer();

function icoWithPng(png: Buffer, size: number) {
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header[6] = size;
  header[7] = size;
  header.writeUInt32LE(png.length, 6 + 8);
  header.writeUInt32LE(22, 6 + 12);
  return Buffer.concat([header, png]);
}

function icoWithBmp32(size: number) {
  const rowBytes = size * 4;
  const bmp = Buffer.alloc(40 + rowBytes * size + Math.ceil(size / 32) * 4 * size);
  bmp.writeUInt32LE(40, 0);
  bmp.writeInt32LE(size, 4);
  bmp.writeInt32LE(size * 2, 8);
  bmp.writeUInt16LE(1, 12);
  bmp.writeUInt16LE(32, 14);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const o = 40 + y * rowBytes + x * 4;
      const inner = x > size / 4 && x < (3 * size) / 4;
      bmp[o] = inner ? 255 : 20; // B
      bmp[o + 1] = inner ? 255 : 20; // G
      bmp[o + 2] = 200; // R
      bmp[o + 3] = 255; // A
    }
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header[6] = size;
  header[7] = size;
  header.writeUInt32LE(bmp.length, 14);
  header.writeUInt32LE(22, 18);
  return Buffer.concat([header, bmp]);
}

describe("normalizeLogo", () => {
  it("re-encodes an image to a 128×128 WebP", async () => {
    const { webp, sourceWidth } = await normalizeLogo(await logoPng(180, 180));
    const meta = await sharp(webp).metadata();
    expect(meta).toMatchObject({ format: "webp", width: LOGO_SIZE, height: LOGO_SIZE });
    expect(sourceWidth).toBe(180);
  });
  it("rejects tiny icons, blank images, banners and non-images", async () => {
    await expect(normalizeLogo(await logoPng(16, 16))).rejects.toThrow(/too small/);
    const blank = await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer();
    await expect(normalizeLogo(blank)).rejects.toThrow(/blank/);
    await expect(normalizeLogo(await logoPng(400, 80))).rejects.toThrow(/banner/);
    await expect(normalizeLogo(Buffer.from("<html>not an image</html>"))).rejects.toThrow(/supported image/);
    await expect(normalizeLogo(Buffer.alloc(2 * 1024 * 1024, 1))).rejects.toThrow(/larger than 1 MB/);
  });
  it("rasterises SVG, so scripts in it cannot survive", async () => {
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><script>alert(1)</script><rect width="100" height="100" fill="navy"/><circle cx="50" cy="50" r="30" fill="orange"/></svg>`);
    const { webp } = await normalizeLogo(svg);
    expect((await sharp(webp).metadata()).format).toBe("webp");
    expect(webp.includes(Buffer.from("script"))).toBe(false);
  });
  it("reads .ico files with an embedded PNG or a 32-bit bitmap", async () => {
    const png = await logoPng(64, 64);
    expect(decodeIco(icoWithPng(png, 64))).toHaveProperty("png");
    expect((await sharp((await normalizeLogo(icoWithPng(png, 64))).webp).metadata()).width).toBe(LOGO_SIZE);
    const bmp = decodeIco(icoWithBmp32(48));
    expect(bmp).toMatchObject({ width: 48, height: 48 });
    expect((await sharp((await normalizeLogo(icoWithBmp32(48))).webp).metadata()).width).toBe(LOGO_SIZE);
  });
});

describe("findIconCandidates", () => {
  it("prefers apple-touch and large declared icons, then header logo images, then well-known paths", () => {
    const html = `<html><head>
      <link rel="icon" href="/favicon-16.png" sizes="16x16">
      <link rel="icon" href="/favicon-192.png" sizes="192x192">
      <link rel="apple-touch-icon" href="/apple.png">
    </head><body><header><img src="/img/site-logo.png" class="logo" alt="Logo"><img src="/img/digital-india-logo.png" class="logo"></header>
    <footer><img src="/img/partner-logo.png" class="footer-logo"></footer></body></html>`;
    const c = findIconCandidates(html, "https://example.gov.in/careers/");
    expect(c.slice(0, 3)).toEqual(["https://example.gov.in/favicon-192.png", "https://example.gov.in/apple.png", "https://example.gov.in/favicon-16.png"]);
    expect(c[3]).toBe("https://example.gov.in/img/site-logo.png");
    expect(c).not.toContain("https://example.gov.in/img/digital-india-logo.png");
    expect(c).not.toContain("https://example.gov.in/img/partner-logo.png");
    expect(c.slice(-2)).toEqual(["https://example.gov.in/apple-touch-icon.png", "https://example.gov.in/favicon.ico"]);
  });
});
