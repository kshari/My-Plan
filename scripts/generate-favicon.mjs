import sharp from 'sharp';
import { writeFileSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Target icon: 3 concentric circles (Lucide style), dark stroke for visibility
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="10" fill="none" stroke="#18181b" stroke-width="2"/>
  <circle cx="12" cy="12" r="6" fill="none" stroke="#18181b" stroke-width="2"/>
  <circle cx="12" cy="12" r="2" fill="#18181b"/>
</svg>`;

try {
  await sharp(Buffer.from(svg))
    .resize(48, 48)
    .png()
    .toFile(join(root, 'app', 'favicon.ico'));
  console.log('Created app/favicon.ico');
} catch (e) {
  console.error('Sharp SVG failed:', e.message);
  process.exit(1);
}
