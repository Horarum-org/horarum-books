import Asciidoctor, { Asciidoctor as AsciidoctorType } from 'asciidoctor';
import { SqlConverter } from './asciidoc-converter';
import { parseAsciiDocFile } from './asciidoctor-utils';
import { Work } from './model';
import { processImage } from './image-utils';
import { insertWork } from './db-utils';

function seedSqlite() {
  const variantPath = process.argv[2];

  // Initialize Asciidoctor
  const asciidoctor: AsciidoctorType = Asciidoctor();

  const sqlConverter = new SqlConverter(variantPath);

  asciidoctor.ConverterFactory.register(sqlConverter, ['sql']);

  const [workId, variantId] = variantPath.split('/');

  const workDocument = parseAsciiDocFile(`../works/${workId}/${workId}.adoc`);
  const work: Work = {
    id: workId,
    title: workDocument.getAttribute('doctitle') as string,
    variants: [variantId],
  };

  insertWork(work, sqlConverter.db);

  asciidoctor.convertFile(`works/${workId}/${variantId}/${variantId}.adoc`, {
    backend: 'sql',
    safe: 'unsafe',
    standalone: true, // Ensures the 'document' node is the root
  });

  processImage(work, variantId);
}

seedSqlite();
