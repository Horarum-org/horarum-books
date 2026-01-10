import { Work } from './model';
import webp from 'webp-converter';
import * as fs from 'fs';

export function processImage(work: Work, variantId: string) {
  let imagePath = `works/${work.id}/${variantId}/${variantId}.png`;

  if (!fs.existsSync(imagePath)) {
    imagePath = `works/${work.id}/${variantId}/${variantId}.jpg`;
  }

  const destinationFolder = `dist/${variantId}`;

  webp.cwebp(
    imagePath,
    `${destinationFolder}/${variantId}-200w.webp`,
    '-q 80 -resize 200 300',
  );

  webp.cwebp(
    imagePath,
    `${destinationFolder}/${variantId}-600w.webp`,
    '-q 80 -resize 600 900',
  );

  webp.cwebp(
    imagePath,
    `${destinationFolder}/${variantId}-1200w.webp`,
    '-q 80 -resize 1200 1800',
  );
}
