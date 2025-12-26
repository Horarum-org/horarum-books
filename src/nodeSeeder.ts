import { closeDb, initDb, insertNode, insertNodeId } from './db-utils';
import { parseAsciiDocFile } from './asciidoctor-utils';
import { Work } from './model';
import { Database } from 'sqlite3';
import type { AbstractBlock, AbstractNode, Block, Document } from 'asciidoctor';
import fs from 'fs';

export async function seedNodes(variantId: string, work: Work) {
  fs.mkdirSync(`dist/${variantId}`, { recursive: true });

  const db = initDb(`dist/${variantId}/${variantId}`);
  const doc = parseAsciiDocFile(
    `../works/${work.id}/${variantId}/${variantId}.adoc`,
  );

  await insertDocument(doc, db);
  closeDb(db);
}

async function insertDocument(doc: Document, db: Database) {
  const docRowId = await insertNode(
    {
      name: doc.getNodeName(),
      attributes: {
        title: doc.getTitle(),
        language: doc.getAttribute('lang') as string,
      },
    },
    db,
  );

  await insertNodeId(doc.getId(), docRowId, db);

  if (doc.hasBlocks()) {
    for (const b of doc.getBlocks()) {
      await insertBlock(b as AbstractBlock, docRowId, db);
    }
  }
}

async function insertBlock(
  block: AbstractBlock,
  parentId: number,
  db: Database,
) {
  const content = getContent(block);
  const blockRowId = await insertNode(
    {
      name: block.getNodeName(),
      parentRowId: parentId,
      attributes: {
        title: block.getTitle(),
      },
      content,
    },
    db,
  );

  if (content != null) {
    const regex = /\[\[(.*?)\]\]/g;
    const matches = [...content.matchAll(regex)];
    if (matches.length > 0) {
      for (const match of matches) {
        await insertNodeId(match[1], blockRowId, db);
        console.log(`Inserted reference ${match[1]} for block ${blockRowId}`);
      }
    }
  }

  const id = getId(block);
  if (id != null) {
    await insertNodeId(id, blockRowId, db);
  }

  if (block.hasBlocks()) {
    for (const b of block.getBlocks()) {
      await insertBlock(b as AbstractBlock, blockRowId, db);
    }
  }
}

function getId(node: AbstractNode): string | undefined {
  switch (node.getNodeName()) {
    case 'floating_title':
      return undefined;
    default:
      return node.getId();
  }
}

function getContent(node: AbstractNode): string | undefined {
  switch (node.getNodeName()) {
    case 'verse':
    case 'paragraph': {
      const block = node as Block;
      return JSON.stringify(block.getSourceLines());
    }
    default:
      return undefined;
  }
}
