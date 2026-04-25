/**
 * Writes Next.js metadata icons from the checked-in brand assets.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const root = path.join(__dirname, "..");
const logoInput = path.join(root, "app", "Assets", "Logo.png");
const ogInput = path.join(root, "app", "Assets", "CommitHappensOG.png");
const publicLogo = path.join(root, "public", "brand", "commit-happens.png");

function currentMarkSvg(size) {
  return Buffer.from(`
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#18051f"/>
          <stop offset="0.55" stop-color="#050816"/>
          <stop offset="1" stop-color="#071328"/>
        </linearGradient>
        <linearGradient id="stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f679d0"/>
          <stop offset="0.58" stop-color="#ff5fbe"/>
          <stop offset="1" stop-color="#a855f7"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bg)"/>
      <text
        x="50%"
        y="53%"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family="Arial Black, Impact, sans-serif"
        font-size="${size * 0.78}"
        font-weight="900"
        fill="#050816"
        stroke="url(#stroke)"
        stroke-width="${size * 0.07}"
        paint-order="stroke fill"
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
  for (const input of [logoInput, ogInput]) {
    if (!fs.existsSync(input)) {
      console.error("Missing:", input);
      process.exit(1);
    }
  }

  fs.mkdirSync(path.dirname(publicLogo), { recursive: true });
  await fs.promises.copyFile(logoInput, publicLogo);

  const iconPipeline = () => sharp(currentMarkSvg(512));

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

  await sharp(ogInput)
    .resize(1200, 630, {
      fit: "cover",
      position: "centre",
    })
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
