import {seedNodes} from './nodeSeeder';
import {Work} from './model';
import {processImage} from './image-utils';

export async function seedWorkVariant(variantPath: string) {
  const [workId, variantId] = variantPath.split('/');

  const work: Work = {
    id: workId,
    title: 'Catecismo de la Iglesia Católica',
    variants: [variantId],
  }

  await seedNodes(variantId, work);

  processImage(work, variantId);
}
