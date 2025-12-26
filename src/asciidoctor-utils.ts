import type { Document } from 'asciidoctor';
import asciidoctor from 'asciidoctor';
import path from 'node:path';

export function parseAsciiDocFile(file: string): Document {
  const Asciidoctor = asciidoctor();
  const filePath = path.resolve(__dirname, file);

  return Asciidoctor.loadFile(filePath, {
    safe: 'server',
  });
}
