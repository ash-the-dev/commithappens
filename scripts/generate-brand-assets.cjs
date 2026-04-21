/**
 * Crops the block "C" from the full logo and writes Next.js metadata icons.
 * Tune CROP_* if the favicon framing needs a nudge after a logo update.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const root = path.join(__dirname, "..");
const input = path.join(root, "app", "Assets", "Logo.png");
const publicLogo = path.join(root, "public", "brand", "commit-happens.png");

/** Native pixels: left portion of upper "COMMIT" row where the C sits. */
const CROP = { left: 0, top: 72, width: 360, height: 480 };

async function main() {
  if (!fs.existsSync(input)) {
    console.error("Missing:", input);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(publicLogo), { recursive: true });
  await fs.promises.copyFile(input, publicLogo);

  const pipeline = () => sharp(input).extract(CROP);

  await pipeline()
    .resize(32, 32, {
      fit: "contain",
      position: "centre",
      background: { r: 5, g: 5, b: 5, alpha: 1 },
    })
    .png()
    .toFile(path.join(root, "app", "icon.png"));

  await pipeline()
    .resize(180, 180, {
      fit: "contain",
      position: "centre",
      background: { r: 5, g: 5, b: 5, alpha: 1 },
    })
    .png()
    .toFile(path.join(root, "app", "apple-icon.png"));

  const ogW = 1200;
  const ogH = 630;
  const logoForOg = await sharp(input)
    .resize({
      width: Math.round(ogW * 0.78),
      height: Math.round(ogH * 0.78),
      fit: "inside",
    })
    .toBuffer();

  await sharp({
    create: {
      width: ogW,
      height: ogH,
      channels: 3,
      background: { r: 5, g: 5, b: 5 },
    },
  })
    .composite([{ input: logoForOg, gravity: "centre" }])
    .png()
    .toFile(path.join(root, "app", "opengraph-image.png"));

  await fs.promises.copyFile(
    path.join(root, "app", "opengraph-image.png"),
    path.join(root, "app", "twitter-image.png"),
  );

  console.log(
    "Wrote public/brand/commit-happens.png, app/icon.png, app/apple-icon.png, app/opengraph-image.png, app/twitter-image.png",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
