/**
 * Writes Next.js metadata icons from the checked-in brand assets.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const root = path.join(__dirname, "..");
const logoInput = path.join(root, "app", "Assets", "Logo.png");
const iconInput = path.join(root, "app", "Assets", "LittleCommitHappens.png");
const ogInput = path.join(root, "app", "Assets", "CommitHappensOG.png");
const publicLogo = path.join(root, "public", "brand", "commit-happens.png");

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
  for (const input of [logoInput, iconInput, ogInput]) {
    if (!fs.existsSync(input)) {
      console.error("Missing:", input);
      process.exit(1);
    }
  }

  fs.mkdirSync(path.dirname(publicLogo), { recursive: true });
  await fs.promises.copyFile(logoInput, publicLogo);

  const iconPipeline = () => sharp(iconInput);

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
