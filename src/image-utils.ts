import { Work } from './model';
import webp from 'webp-converter';

export function processImage(work: Work, variantId: string) {
  const imagePath = `works/${work.id}/${variantId}/${variantId}.png`;
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
