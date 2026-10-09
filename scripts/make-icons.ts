/**
 * Renders the raster app icons from `src/app/icon.svg` (the logo badge, drawn by hand from
 * `components/ui/Logo.tsx`). Run it after changing the SVG; Next serves all three from `src/app`.
 *
 *   pnpm icons   → src/app/favicon.ico (16, 32, 48 px) and src/app/apple-icon.png (180 px, on paper)
 */
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const APP = "src/app";
const PAPER = "#F8F9F6"; // --color-paper: iOS fills a transparent home-screen icon with black

async function main() {
  const svg = await readFile(`${APP}/icon.svg`);
  // Rasterise at 4× the target size, then downscale, so thin rings stay smooth.
  const png = (size: number) => sharp(svg, { density: (72 * size * 4) / 100 }).resize(size, size).png().toBuffer();

  // An .ico is a directory of embedded PNGs: a 6-byte header, a 16-byte entry per image, then the images.
  const sizes = [16, 32, 48];
  const images = await Promise.all(sizes.map(png));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length + 16 * sizes.length;
  const entries = sizes.map((size, i) => {
    const entry = Buffer.alloc(16);
    entry[0] = size;
    entry[1] = size;
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(images[i].length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += images[i].length;
    return entry;
  });
  await writeFile(`${APP}/favicon.ico`, Buffer.concat([header, ...entries, ...images]));

  await sharp({ create: { width: 180, height: 180, channels: 4, background: PAPER } })
    .composite([{ input: await png(140), left: 20, top: 20 }])
    .png()
    .toFile(`${APP}/apple-icon.png`);

  console.log(`  ✓ ${APP}/favicon.ico (${sizes.join(", ")} px), ${APP}/apple-icon.png (180 px)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
