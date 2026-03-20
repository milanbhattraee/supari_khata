import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

// Read the SVG file
const svgBuffer = readFileSync(join(publicDir, "icon.svg"));

// Generate icons
const sizes = [192, 512];

async function generateIcons() {
  for (const size of sizes) {
    // Regular icon
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(publicDir, `icon-${size}.png`));
    console.log(`Generated icon-${size}.png`);

    // Maskable icon (with padding for safe zone)
    const paddedSize = Math.floor(size * 0.8);
    const padding = Math.floor((size - paddedSize) / 2);

    await sharp(svgBuffer)
      .resize(paddedSize, paddedSize)
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: { r: 16, g: 185, b: 129, alpha: 1 }, // #10b981
      })
      .png()
      .toFile(join(publicDir, `icon-maskable-${size}.png`));
    console.log(`Generated icon-maskable-${size}.png`);
  }

  console.log("All icons generated successfully!");
}

generateIcons().catch(console.error);
