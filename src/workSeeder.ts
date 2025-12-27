import { seedNodes } from './nodeSeeder';
import { Variant, Work } from './model';
import { processImage } from './image-utils';
import { parseAsciiDocFile } from './asciidoctor-utils';
import { closeDb, initDb, insertVariant, insertWork } from './db-utils';
import fs from 'fs';
import { getVersion } from './version-utils';

export async function seedWorkVariant(variantPath: string) {
  const [workId, variantId] = variantPath.split('/');

  const workDocument = parseAsciiDocFile(`../works/${workId}/${workId}.adoc`);
  const work: Work = {
    id: workId,
    title: workDocument.getAttribute('doctitle') as string,
    variants: [variantId],
  };

  const variantDocument = parseAsciiDocFile(
    `../works/${workId}/${variantId}/${variantId}.adoc`,
  );
  const variant: Variant = {
    id: variantId,
    title: variantDocument.getAttribute('doctitle') as string,
    workId: workId,
    language: variantDocument.getAttribute('lang') as string,
    version: getVersion(workId, variantId),
  };

  if (fs.existsSync(`dist/${variantId}`)) {
    fs.rmSync(`dist/${variantId}`, { recursive: true });
  }
  fs.mkdirSync(`dist/${variantId}`, { recursive: true });

  const db = initDb(`dist/${variantId}/${variantId}`);

  await seedNodes(variantId, work, db);
  await insertWork(work, db);

  processImage(work, variantId);
  await insertVariant(variant, db);

  closeDb(db);
}
