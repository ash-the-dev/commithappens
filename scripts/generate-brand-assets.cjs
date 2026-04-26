/**
 * Writes Next.js metadata icons from the checked-in brand assets.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const root = path.join(__dirname, "..");
const logoInput = path.join(root, "app", "Assets", "Logo.png");
const publicLogo = path.join(root, "public", "brand", "commit-happens.png");

function neonCMarkSvg(size) {
  return Buffer.from(`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bgGlow" cx="50%" cy="45%" r="72%">
          <stop offset="0" stop-color="#32103f"/>
          <stop offset="0.58" stop-color="#070713"/>
          <stop offset="1" stop-color="#000000"/>
        </radialGradient>
        <linearGradient id="stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ff4fc3"/>
          <stop offset="0.58" stop-color="#f679d0"/>
          <stop offset="1" stop-color="#a855f7"/>
        </linearGradient>
        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="${Math.max(1, size * 0.025)}" result="blur"/>
          <feColorMatrix in="blur" type="matrix" values="1 0 0 0 1  0 0.2 0 0 0.2  0 0 1 0 0.9  0 0 0 0.85 0"/>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bgGlow)"/>
      <text
        x="50%"
        y="53%"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family="Arial Black, Impact, sans-serif"
        font-size="${size * 0.76}"
        font-weight="900"
        fill="#05040a"
        stroke="url(#stroke)"
        stroke-width="${size * 0.07}"
        paint-order="stroke fill"
        filter="url(#glow)"
      >C</text>
    </svg>
  `);
}

function socialImageSvg() {
  return Buffer.from(`
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bg" cx="50%" cy="45%" r="78%">
          <stop offset="0" stop-color="#23082e"/>
          <stop offset="0.56" stop-color="#060611"/>
          <stop offset="1" stop-color="#000000"/>
        </radialGradient>
        <linearGradient id="pink" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ff4fc3"/>
          <stop offset="0.52" stop-color="#f679d0"/>
          <stop offset="1" stop-color="#a855f7"/>
        </linearGradient>
        <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="18" result="blur"/>
          <feColorMatrix in="blur" type="matrix" values="1 0 0 0 1  0 0.2 0 0 0.2  0 0 1 0 0.9  0 0 0 0.75 0"/>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="1200" height="630" fill="url(#bg)"/>
      <circle cx="600" cy="315" r="250" fill="#ff4fc3" opacity="0.08"/>
      <text
        x="50%"
        y="51%"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family="Arial Black, Impact, sans-serif"
        font-size="390"
        font-weight="900"
        fill="#05040a"
        stroke="url(#pink)"
        stroke-width="34"
        paint-order="stroke fill"
        filter="url(#softGlow)"
      >C</text>
    </svg>
  `);
}

function icoFromPng(png) {
  const header = Buffer.alloc(22);

  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header[6] = 32;
  header[7] = 32;
  header[8] = 0;
  header[9] = 0;
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);

  return Buffer.concat([header, png]);
}

async function main() {
  for (const input of [logoInput]) {
    if (!fs.existsSync(input)) {
      console.error("Missing:", input);
      process.exit(1);
    }
  }

  fs.mkdirSync(path.dirname(publicLogo), { recursive: true });
  await fs.promises.copyFile(logoInput, publicLogo);

  const iconPipeline = () => sharp(neonCMarkSvg(512));

  await iconPipeline()
    .resize(32, 32, {
      fit: "cover",
      position: "centre",
    })
    .png()
    .toFile(path.join(root, "app", "icon.png"));

  const faviconPng = await iconPipeline()
    .resize(32, 32, {
      fit: "cover",
      position: "centre",
    })
    .png()
    .toBuffer();
  await fs.promises.writeFile(path.join(root, "app", "favicon.ico"), icoFromPng(faviconPng));

  await iconPipeline()
    .resize(180, 180, {
      fit: "cover",
      position: "centre",
    })
    .png()
    .toFile(path.join(root, "app", "apple-icon.png"));

  await sharp(socialImageSvg())
    .png()
    .toFile(path.join(root, "app", "opengraph-image.png"));

  await fs.promises.copyFile(
    path.join(root, "app", "opengraph-image.png"),
    path.join(root, "app", "twitter-image.png"),
  );

  console.log(
    "Wrote public/brand/commit-happens.png, app/favicon.ico, app/icon.png, app/apple-icon.png, app/opengraph-image.png, app/twitter-image.png from app/Assets",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
