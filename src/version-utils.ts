import * as fs from 'fs';
import * as path from 'path';

export function getVersion(workId: string, variantId: string): string {
  const versionFilePath = path.join('works', workId, variantId, 'version.json');
  const versionFileContent = fs.readFileSync(versionFilePath, 'utf-8');
  const versionData = JSON.parse(versionFileContent) as object;
  return versionData['version'] as string;
}
